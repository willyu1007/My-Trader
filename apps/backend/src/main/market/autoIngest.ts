import { config } from "../config";
import type { SqliteDatabase } from "../storage/sqlite";
import { enqueueManagedIngest } from "./ingestOrchestrator";

type AutoIngestState = {
  timer: NodeJS.Timeout | null;
  running: boolean;
  sessionId: number;
  businessDb: SqliteDatabase | null;
  marketDb: SqliteDatabase | null;
};

const state: AutoIngestState = {
  timer: null,
  running: false,
  sessionId: 0,
  businessDb: null,
  marketDb: null
};

export function startAutoIngest(
  businessDb: SqliteDatabase,
  marketDb: SqliteDatabase
): void {
  stopAutoIngest();
  state.businessDb = businessDb;
  state.marketDb = marketDb;

  if (!config.autoIngest.enabled) {
    console.log("[mytrader] auto-ingest disabled (MYTRADER_AUTO_INGEST=false).");
    return;
  }

  const intervalMs = config.autoIngest.intervalMs;
  console.log(
    `[mytrader] auto-ingest scheduled every ${Math.round(intervalMs / 60000)} min.`
  );
  state.timer = setInterval(() => {
    void runOnce("interval").catch((err) => {
      console.error("[mytrader] auto-ingest interval failed");
      console.error(err);
    });
  }, intervalMs);
}

export function stopAutoIngest(): void {
  state.sessionId += 1;
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
  state.running = false;
  state.businessDb = null;
  state.marketDb = null;
}

export function triggerAutoIngest(reason: "import" | "positions"): void {
  if (!config.autoIngest.enabled) return;
  if (!state.businessDb || !state.marketDb) return;
  void runOnce("trigger", reason).catch((err) => {
    console.error("[mytrader] auto-ingest trigger failed");
    console.error(err);
  });
}

async function runOnce(
  schedule: "interval" | "trigger",
  reason?: "import" | "positions"
): Promise<void> {
  if (state.running) return;
  if (!state.businessDb || !state.marketDb) return;
  if (!config.autoIngest.enabled) return;

  state.running = true;
  try {
    await enqueueManagedIngest({
      scope: "targets",
      mode: "on_demand",
      source: "auto",
      meta: { schedule, reason: reason ?? null }
    });
  } finally {
    state.running = false;
  }
}
