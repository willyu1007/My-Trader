import { getResolvedTushareToken } from "../storage/marketTokenRepository";
import type { SqliteDatabase } from "../storage/sqlite";
import { runTargetsIngest, runUniverseIngest } from "./marketIngestRunner";

type SchedulerState = {
  timer: NodeJS.Timeout | null;
  running: boolean;
  warnedMissingToken: boolean;
  sessionId: number;
  businessDb: SqliteDatabase | null;
  marketDb: SqliteDatabase | null;
  analysisDbPath: string | null;
};

const state: SchedulerState = {
  timer: null,
  running: false,
  warnedMissingToken: false,
  sessionId: 0,
  businessDb: null,
  marketDb: null,
  analysisDbPath: null
};

const DEFAULT_RUN_TIME = "19:30";

export function startMarketIngestScheduler(
  businessDb: SqliteDatabase,
  marketDb: SqliteDatabase,
  analysisDbPath: string
): void {
  stopMarketIngestScheduler();
  state.businessDb = businessDb;
  state.marketDb = marketDb;
  state.analysisDbPath = analysisDbPath;

  scheduleNextRun();

  setTimeout(() => {
    void triggerMarketIngest("startup").catch((err) => {
      console.error("[mytrader] startup ingest failed");
      console.error(err);
    });
  }, 1500);
}

export function stopMarketIngestScheduler(): void {
  state.sessionId += 1;
  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }
  state.running = false;
  state.warnedMissingToken = false;
  state.businessDb = null;
  state.marketDb = null;
  state.analysisDbPath = null;
}

export async function triggerMarketIngest(
  reason: "startup" | "manual" | "schedule"
): Promise<void> {
  if (state.running) return;
  if (!state.businessDb || !state.marketDb || !state.analysisDbPath) return;
  const sessionId = state.sessionId;

  state.running = true;
  try {
    const resolved = await getResolvedTushareToken(state.businessDb);
    const token = resolved.token;
    if (sessionId !== state.sessionId) return;

    if (!token && reason !== "manual") {
      if (!state.warnedMissingToken) {
        console.warn(
          `[mytrader] ${reason} ingest skipped: missing Tushare token.`
        );
        state.warnedMissingToken = true;
      }
      return;
    }
    state.warnedMissingToken = false;

    const mode = reason === "manual" ? "manual" : "daily";
    const meta = { schedule: reason };
    const errors: unknown[] = [];

    try {
      await runTargetsIngest({
        businessDb: state.businessDb,
        marketDb: state.marketDb,
        token,
        mode,
        meta
      });
    } catch (err) {
      errors.push(err);
    }
    if (sessionId !== state.sessionId) return;

    try {
      await runUniverseIngest({
        businessDb: state.businessDb,
        marketDb: state.marketDb,
        analysisDbPath: state.analysisDbPath,
        token,
        mode,
        meta: { ...meta, windowYears: 3 }
      });
    } catch (err) {
      errors.push(err);
    }

    if (errors.length > 0) {
      throw errors[0];
    }
  } finally {
    state.running = false;
    if (reason === "schedule") scheduleNextRun();
  }
}

function scheduleNextRun(): void {
  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }

  const now = new Date();
  const next = computeNextRun(now, DEFAULT_RUN_TIME);
  const delay = Math.max(1000, next.getTime() - now.getTime());

  state.timer = setTimeout(() => {
    void triggerMarketIngest("schedule").catch((err) => {
      console.error("[mytrader] scheduled ingest failed");
      console.error(err);
      scheduleNextRun();
    });
  }, delay);
}

function computeNextRun(now: Date, hhmm: string): Date {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  const hours = match ? Number(match[1]) : 19;
  const minutes = match ? Number(match[2]) : 30;

  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}
