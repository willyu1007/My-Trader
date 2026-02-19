import type {
  IngestPreflightResult,
  IngestRunMode,
  MarketIngestControlStatus
} from "@mytrader/shared";

import {
  getPersistedIngestControlState,
  setPersistedIngestControlState
} from "../storage/marketSettingsRepository";
import {
  getResolvedTokenForDomain,
  getResolvedTushareToken
} from "../storage/marketTokenRepository";
import type { SqliteDatabase } from "../storage/sqlite";
import type { IngestExecutionControl } from "./marketIngestRunner";
import { runTargetsIngest, runUniverseIngest } from "./marketIngestRunner";
import { createIngestRun, finishIngestRun } from "./ingestRunsRepository";
import { runIngestPreflight } from "./ingestPreflightService";
import { validateDataSourceReadiness } from "./dataSourceReadinessService";

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

type BlockedStage = "preflight" | "readiness" | "token" | "analysis_init";

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
    if (
      hasScopeInFlight({
        scope,
        mode: input.mode,
        source: input.source
      })
    ) {
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
  let preflight: IngestPreflightResult | null = null;

  try {
    preflight = await runIngestPreflight({
      businessDb,
      scope: job.scope
    });
  } catch (error) {
    const message = `预检执行失败：${toErrorMessage(error)}`;
    await persistBlockedRun({
      marketDb,
      job,
      stage: "preflight",
      errorCode: "PREFLIGHT_FAILED",
      message,
      preflight: null
    });
    if (job.source === "manual") {
      throw new Error(message);
    }
    console.warn(`[mytrader] ${job.source} ingest skipped: ${message}`);
    return;
  }

  const readiness = await validateDataSourceReadiness({
    businessDb,
    scope: job.scope
  });
  if (!readiness.ready) {
    const message = buildReadinessBlockMessage(readiness.issues.map((item) => item.message));
    await persistBlockedRun({
      marketDb,
      job,
      stage: "readiness",
      errorCode: "READINESS_BLOCKED",
      message,
      preflight
    });
    if (job.source === "manual") {
      throw new Error(message);
    }
    console.warn(`[mytrader] ${job.source} ingest skipped: ${message}`);
    return;
  }

  const tokenSourcesByDomain: Record<string, string> = {};
  let token: string | null = null;
  for (const domainId of readiness.selectedDomains) {
    const resolved = await getResolvedTokenForDomain(businessDb, domainId);
    tokenSourcesByDomain[domainId] = resolved.source;
    if (!token && resolved.token) {
      token = resolved.token;
    }
  }

  if (!token) {
    const fallback = await getResolvedTushareToken(businessDb);
    token = fallback.token?.trim() ?? null;
  }

  if (!token) {
    const message = "未配置可用数据源令牌。";
    await persistBlockedRun({
      marketDb,
      job,
      stage: "token",
      errorCode: "TOKEN_MISSING",
      message,
      preflight
    });
    if (job.source === "manual") {
      throw new Error(message);
    }
    console.warn(`[mytrader] ${job.source} ingest skipped: ${message}`);
    return;
  }

  const control = buildControl(sessionId);
  const preflightUpdatedAt = preflight?.updatedAt ?? null;
  if (job.scope === "targets") {
    if (!state.analysisDbPath) {
      const message = "analysis.duckdb 尚未初始化。";
      await persistBlockedRun({
        marketDb,
        job,
        stage: "analysis_init",
        errorCode: "ANALYSIS_DB_NOT_INITIALIZED",
        message,
        preflight
      });
      if (job.source === "manual") {
        throw new Error(message);
      }
      console.warn(`[mytrader] ${job.source} ingest skipped: ${message}`);
      return;
    }
    await runUniverseIngest({
      businessDb,
      marketDb,
      analysisDbPath: state.analysisDbPath,
      token,
      mode: "on_demand",
      meta: {
        ...(job.meta ?? {}),
        source: job.source,
        reason: "targets_ssot_prewarm",
        windowYears: 3,
        selectedDomains: readiness.selectedDomains,
        selectedModules: readiness.selectedModules,
        blockedModules: [],
        tokenSourcesByDomain,
        preflightUpdatedAt
      },
      control
    });
    await runTargetsIngest({
      businessDb,
      marketDb,
      analysisDbPath: state.analysisDbPath,
      token,
      mode: job.mode,
      meta: {
        ...(job.meta ?? {}),
        source: job.source,
        selectedDomains: readiness.selectedDomains,
        selectedModules: readiness.selectedModules,
        blockedModules: [],
        tokenSourcesByDomain,
        preflightUpdatedAt
      },
      control
    });
    return;
  }

  if (!state.analysisDbPath) {
    const message = "analysis.duckdb 尚未初始化。";
    await persistBlockedRun({
      marketDb,
      job,
      stage: "analysis_init",
      errorCode: "ANALYSIS_DB_NOT_INITIALIZED",
      message,
      preflight
    });
    if (job.source === "manual") {
      throw new Error(message);
    }
    console.warn(`[mytrader] ${job.source} ingest skipped: ${message}`);
    return;
  }
  await runUniverseIngest({
    businessDb,
    marketDb,
    analysisDbPath: state.analysisDbPath,
    token,
    mode: job.mode,
    meta: {
      ...(job.meta ?? {}),
      source: job.source,
      windowYears: 3,
      selectedDomains: readiness.selectedDomains,
      selectedModules: readiness.selectedModules,
      blockedModules: [],
      tokenSourcesByDomain,
      preflightUpdatedAt
    },
    control
  });
}

async function persistBlockedRun(input: {
  marketDb: SqliteDatabase;
  job: QueueJob;
  stage: BlockedStage;
  errorCode: string;
  message: string;
  preflight: IngestPreflightResult | null;
}): Promise<void> {
  const meta: Record<string, unknown> = {
    ...(input.job.meta ?? {}),
    source: input.job.source,
    scope: input.job.scope,
    blockedStage: input.stage,
    errorCode: input.errorCode
  };
  if (input.preflight) {
    meta.preflightUpdatedAt = input.preflight.updatedAt;
    meta.selectedDomains = input.preflight.selectedDomains;
    meta.selectedModules = input.preflight.selectedModules;
  }

  const runId = await createIngestRun(input.marketDb, {
    scope: input.job.scope,
    mode: input.job.mode,
    meta
  });
  await finishIngestRun(input.marketDb, {
    id: runId,
    status: "failed",
    errors: 1,
    errorMessage: input.message,
    meta
  });
}

function buildReadinessBlockMessage(messages: string[]): string {
  if (messages.length === 0) {
    return "数据来源未就绪。";
  }
  const lines = messages.slice(0, 8).map((item, index) => `${index + 1}. ${item}`);
  return `数据来源未就绪：${lines.join(" | ")}`;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return String(error);
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

function hasScopeInFlight(input: {
  scope: JobScope;
  mode: IngestRunMode;
  source: JobSource;
}): boolean {
  if (
    state.currentJob?.scope === input.scope &&
    state.currentJob.mode === input.mode &&
    state.currentJob.source === input.source
  ) {
    return true;
  }
  return state.queue.some(
    (job) =>
      job.scope === input.scope &&
      job.mode === input.mode &&
      job.source === input.source
  );
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
