import type {
  IngestRunMode,
  MarketIngestControlStatus
} from "@mytrader/shared";

import {
  getMarketRolloutFlags,
  getPersistedIngestControlState,
  setPersistedIngestControlState
} from "../storage/marketSettingsRepository";
import { getResolvedTushareToken } from "../storage/marketTokenRepository";
import type { SqliteDatabase } from "../storage/sqlite";
import type { IngestExecutionControl } from "./marketIngestRunner";
import { convergeStaleRunningIngestRuns } from "./ingestRunsRepository";
import { runTargetsIngest, runUniverseIngest } from "./marketIngestRunner";

type OrchestratorScope = "targets" | "universe" | "both";
type JobScope = Exclude<OrchestratorScope, "both">;
type JobSource = "manual" | "schedule" | "startup" | "auto";

type QueueJob = {
  scope: JobScope;
  mode: IngestRunMode;
  source: JobSource;
  meta: Record<string, unknown> | null;
  enqueuedAt: number;
};

type OrchestratorState = {
  businessDb: SqliteDatabase | null;
  marketDb: SqliteDatabase | null;
  analysisDbPath: string | null;
  queue: QueueJob[];
  paused: boolean;
  cancelRequested: boolean;
  processing: boolean;
  sessionId: number;
  currentJob: QueueJob | null;
  currentRunId: string | null;
  updatedAt: number;
  waiters: Array<() => void>;
};

const state: OrchestratorState = {
  businessDb: null,
  marketDb: null,
  analysisDbPath: null,
  queue: [],
  paused: false,
  cancelRequested: false,
  processing: false,
  sessionId: 0,
  currentJob: null,
  currentRunId: null,
  updatedAt: Date.now(),
  waiters: []
};

export async function startIngestOrchestrator(input: {
  businessDb: SqliteDatabase;
  marketDb: SqliteDatabase;
  analysisDbPath: string | null;
}): Promise<void> {
  stopIngestOrchestrator();
  state.businessDb = input.businessDb;
  state.marketDb = input.marketDb;
  state.analysisDbPath = input.analysisDbPath ?? null;
  const converged = await convergeStaleRunningIngestRuns(input.marketDb, {
    olderThanMs: 0,
    reason: "Ingest run was interrupted by process exit; auto-converged on startup."
  });
  if (converged > 0) {
    console.warn(`[mytrader] converged stale running ingest runs: ${converged}`);
  }
  const persisted = await getPersistedIngestControlState(input.businessDb);
  state.paused = persisted.paused;
  touchState();
}

export function stopIngestOrchestrator(): void {
  state.sessionId += 1;
  state.businessDb = null;
  state.marketDb = null;
  state.analysisDbPath = null;
  state.queue = [];
  state.paused = false;
  state.cancelRequested = false;
  state.processing = false;
  state.currentJob = null;
  state.currentRunId = null;
  touchState();
  wakeWaiters();
}

export async function enqueueManagedIngest(input: {
  scope: OrchestratorScope;
  mode: IngestRunMode;
  source: JobSource;
  meta?: Record<string, unknown> | null;
}): Promise<{ enqueued: number; skipped: number }> {
  if (!state.businessDb || !state.marketDb) {
    throw new Error("ingest orchestrator 未初始化。");
  }
  const scopes = expandScopes(input.scope);
  let enqueued = 0;
  let skipped = 0;
  const now = Date.now();

  for (const scope of scopes) {
    if (hasScopeInFlight(scope)) {
      skipped += 1;
      continue;
    }
    state.queue.push({
      scope,
      mode: input.mode,
      source: input.source,
      meta: input.meta ?? null,
      enqueuedAt: now
    });
    enqueued += 1;
  }
  touchState();
  void processQueue();
  return { enqueued, skipped };
}

export function getManagedIngestControlStatus(): MarketIngestControlStatus {
  return {
    state: deriveControlState(),
    queueLength: state.queue.length,
    paused: state.paused,
    cancelRequested: state.cancelRequested,
    currentJob: state.currentJob
      ? {
          scope: state.currentJob.scope,
          mode: state.currentJob.mode,
          source: state.currentJob.source,
          enqueuedAt: state.currentJob.enqueuedAt
        }
      : null,
    currentRunId: state.currentRunId,
    updatedAt: state.updatedAt
  };
}

export async function pauseManagedIngest(): Promise<MarketIngestControlStatus> {
  const businessDb = requireBusinessDb();
  if (!state.paused) {
    state.paused = true;
    touchState();
    await setPersistedIngestControlState(businessDb, {
      paused: true,
      updatedAt: Date.now()
    });
  }
  return getManagedIngestControlStatus();
}

export async function resumeManagedIngest(): Promise<MarketIngestControlStatus> {
  const businessDb = requireBusinessDb();
  if (state.paused) {
    state.paused = false;
    touchState();
    await setPersistedIngestControlState(businessDb, {
      paused: false,
      updatedAt: Date.now()
    });
    wakeWaiters();
    void processQueue();
  }
  return getManagedIngestControlStatus();
}

export function cancelManagedIngest(): MarketIngestControlStatus {
  if (state.currentJob) {
    state.cancelRequested = true;
  }
  touchState();
  wakeWaiters();
  return getManagedIngestControlStatus();
}

async function processQueue(): Promise<void> {
  if (state.processing) return;
  const sessionId = state.sessionId;
  state.processing = true;
  touchState();

  try {
    while (sessionId === state.sessionId) {
      if (state.paused) {
        await waitUntilUnpaused(sessionId);
        continue;
      }

      const nextJob = state.queue.shift();
      if (!nextJob) break;

      state.currentJob = nextJob;
      state.currentRunId = null;
      state.cancelRequested = false;
      touchState();

      try {
        await runJob(sessionId, nextJob);
      } catch (error) {
        console.error("[mytrader] managed ingest job failed");
        console.error(error);
      } finally {
        state.currentJob = null;
        state.currentRunId = null;
        state.cancelRequested = false;
        touchState();
      }
    }
  } finally {
    if (sessionId === state.sessionId) {
      state.processing = false;
      touchState();
    }
  }
}

async function runJob(sessionId: number, job: QueueJob): Promise<void> {
  if (sessionId !== state.sessionId) return;
  const businessDb = requireBusinessDb();
  const marketDb = requireMarketDb();
  const rolloutFlags = await getMarketRolloutFlags(businessDb);
  if (!rolloutFlags.p0Enabled) {
    if (job.source === "manual") {
      throw new Error("当前已关闭 P0 批次开关，禁止执行数据拉取。");
    }
    console.warn(
      `[mytrader] ${job.source} ingest skipped: P0 rollout is disabled.`
    );
    return;
  }
  const resolved = await getResolvedTushareToken(businessDb);
  const token = resolved.token?.trim() ?? "";

  if (!token) {
    if (job.source === "manual") {
      throw new Error("未配置 Tushare token。");
    }
    console.warn(
      `[mytrader] ${job.source} ingest skipped: missing Tushare token.`
    );
    return;
  }

  const control = buildControl(sessionId);
  if (job.scope === "targets") {
    await runTargetsIngest({
      businessDb,
      marketDb,
      token,
      mode: job.mode,
      meta: { ...(job.meta ?? {}), source: job.source },
      control
    });
    return;
  }

  if (!state.analysisDbPath) {
    throw new Error("analysis.duckdb 尚未初始化。");
  }
  await runUniverseIngest({
    businessDb,
    marketDb,
    analysisDbPath: state.analysisDbPath,
    token,
    mode: job.mode,
    p1Enabled: rolloutFlags.p1Enabled,
    universeIndexDailyEnabled: rolloutFlags.universeIndexDailyEnabled,
    universeDailyBasicEnabled: rolloutFlags.universeDailyBasicEnabled,
    universeMoneyflowEnabled: rolloutFlags.universeMoneyflowEnabled,
    meta: { ...(job.meta ?? {}), source: job.source, windowYears: 3 },
    control
  });
}

function buildControl(sessionId: number): IngestExecutionControl {
  return {
    onRunCreated: (runId) => {
      if (sessionId !== state.sessionId) return;
      state.currentRunId = runId;
      touchState();
    },
    checkpoint: async () => {
      if (sessionId !== state.sessionId) return "cancel";
      while (state.paused && !state.cancelRequested && sessionId === state.sessionId) {
        await waitUntilUnpaused(sessionId);
      }
      if (sessionId !== state.sessionId) return "cancel";
      if (state.cancelRequested) return "cancel";
      return "continue";
    }
  };
}

function hasScopeInFlight(scope: JobScope): boolean {
  if (state.currentJob?.scope === scope) return true;
  return state.queue.some((job) => job.scope === scope);
}

function expandScopes(scope: OrchestratorScope): JobScope[] {
  if (scope === "both") return ["targets", "universe"];
  return [scope];
}

function deriveControlState(): MarketIngestControlStatus["state"] {
  if (state.cancelRequested && state.currentJob) return "canceling";
  if (state.paused) return "paused";
  if (state.currentJob) return "running";
  return "idle";
}

function touchState(): void {
  state.updatedAt = Date.now();
}

async function waitUntilUnpaused(sessionId: number): Promise<void> {
  if (!state.paused) return;
  if (sessionId !== state.sessionId) return;
  await new Promise<void>((resolve) => {
    state.waiters.push(resolve);
  });
}

function wakeWaiters(): void {
  const waiters = state.waiters.splice(0, state.waiters.length);
  waiters.forEach((resolve) => resolve());
}

function requireBusinessDb(): SqliteDatabase {
  if (!state.businessDb) throw new Error("businessDb 未初始化。");
  return state.businessDb;
}

function requireMarketDb(): SqliteDatabase {
  if (!state.marketDb) throw new Error("marketDb 未初始化。");
  return state.marketDb;
}
