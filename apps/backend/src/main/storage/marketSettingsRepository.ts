import type {
  MarketRolloutFlags,
  MarketIngestSchedulerConfig,
  SetMarketRolloutFlagsInput,
  MarketTargetsConfig
} from "@mytrader/shared";

import { get, run } from "./sqlite";
import type { SqliteDatabase } from "./sqlite";

const TARGETS_KEY = "targets_config_v1";
const TEMP_TARGETS_KEY = "targets_temp_symbols_v1";
const INGEST_SCHEDULER_KEY = "ingest_scheduler_config_v1";
const INGEST_CONTROL_STATE_KEY = "ingest_control_state_v1";
const ROLLOUT_FLAGS_KEY = "rollout_flags_v1";

export interface PersistedIngestControlState {
  paused: boolean;
  updatedAt: number;
}

export type TempTargetSymbolRow = {
  symbol: string;
  expiresAt: number;
  updatedAt: number;
};

const DEFAULT_INGEST_SCHEDULER_CONFIG: MarketIngestSchedulerConfig = {
  enabled: true,
  runAt: "19:30",
  timezone: "Asia/Shanghai",
  scope: "both",
  runOnStartup: true,
  catchUpMissed: true
};

const DEFAULT_MARKET_ROLLOUT_FLAGS: Omit<MarketRolloutFlags, "updatedAt"> = {
  p0Enabled: true,
  p1Enabled: true,
  p2Enabled: true,
  universeIndexDailyEnabled: false,
  universeDailyBasicEnabled: false,
  universeMoneyflowEnabled: false,
  p2RealtimeIndexV1: true,
  p2RealtimeEquityEtfV1: true,
  p2FuturesMicrostructureV1: true,
  p2SpecialPermissionStkPremarketV1: false
};

export async function getMarketTargetsConfig(
  db: SqliteDatabase
): Promise<MarketTargetsConfig> {
  const row = await get<{ value_json: string }>(
    db,
    `select value_json from market_settings where key = ?`,
    [TARGETS_KEY]
  );
  if (!row) {
    const defaults = buildDefaultTargetsConfig();
    await setMarketTargetsConfig(db, defaults);
    return defaults;
  }
  const parsed = safeParseTargetsConfig(row.value_json);
  return parsed ?? buildDefaultTargetsConfig();
}

export async function setMarketTargetsConfig(
  db: SqliteDatabase,
  config: MarketTargetsConfig
): Promise<void> {
  const normalized = normalizeTargetsConfig(config);
  await run(
    db,
    `
      insert into market_settings (key, value_json)
      values (?, ?)
      on conflict(key) do update set
        value_json = excluded.value_json
    `,
    [TARGETS_KEY, JSON.stringify(normalized)]
  );
}

function buildDefaultTargetsConfig(): MarketTargetsConfig {
  return {
    includeHoldings: true,
    includeRegistryAutoIngest: true,
    includeWatchlist: true,
    portfolioIds: null,
    explicitSymbols: [],
    tagFilters: []
  };
}

function safeParseTargetsConfig(value: string): MarketTargetsConfig | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return normalizeTargetsConfig(parsed as Partial<MarketTargetsConfig>);
  } catch {
    return null;
  }
}

function normalizeTargetsConfig(
  input: Partial<MarketTargetsConfig>
): MarketTargetsConfig {
  const explicitSymbols = Array.isArray(input.explicitSymbols)
    ? input.explicitSymbols.map((value) => String(value).trim()).filter(Boolean)
    : [];
  const tagFilters = Array.isArray(input.tagFilters)
    ? input.tagFilters.map((value) => String(value).trim()).filter(Boolean)
    : [];
  const portfolioIds = Array.isArray(input.portfolioIds)
    ? input.portfolioIds.map((value) => String(value).trim()).filter(Boolean)
    : null;

  return {
    includeHoldings: Boolean(input.includeHoldings ?? true),
    includeRegistryAutoIngest: Boolean(input.includeRegistryAutoIngest ?? true),
    includeWatchlist: Boolean(input.includeWatchlist ?? true),
    portfolioIds: portfolioIds && portfolioIds.length > 0 ? portfolioIds : null,
    explicitSymbols,
    tagFilters
  };
}

export async function listTempTargetSymbols(
  db: SqliteDatabase,
  now = Date.now()
): Promise<TempTargetSymbolRow[]> {
  const row = await get<{ value_json: string }>(
    db,
    `select value_json from market_settings where key = ?`,
    [TEMP_TARGETS_KEY]
  );
  if (!row?.value_json) return [];

  const parsed = safeParseTempTargets(row.value_json);
  if (!parsed) return [];

  const kept = parsed.filter((item) => item.expiresAt > now);
  if (kept.length !== parsed.length) {
    await writeTempTargets(db, kept);
  }
  return kept;
}

export async function touchTempTargetSymbol(
  db: SqliteDatabase,
  symbol: string,
  ttlDays = 7,
  now = Date.now()
): Promise<TempTargetSymbolRow[]> {
  const key = symbol.trim();
  if (!key) return await listTempTargetSymbols(db, now);

  const safeTtlDays = Math.min(90, Math.max(1, Math.floor(ttlDays)));
  const expiresAt = now + safeTtlDays * 86_400_000;

  const existing = await listTempTargetSymbols(db, now);
  const next: TempTargetSymbolRow[] = [];
  let updated = false;
  for (const item of existing) {
    if (item.symbol === key) {
      next.push({ symbol: key, expiresAt, updatedAt: now });
      updated = true;
    } else {
      next.push(item);
    }
  }
  if (!updated) {
    next.push({ symbol: key, expiresAt, updatedAt: now });
  }

  next.sort((a, b) => a.symbol.localeCompare(b.symbol));
  await writeTempTargets(db, next);
  return next;
}

export async function removeTempTargetSymbol(
  db: SqliteDatabase,
  symbol: string,
  now = Date.now()
): Promise<TempTargetSymbolRow[]> {
  const key = symbol.trim();
  const existing = await listTempTargetSymbols(db, now);
  const next = existing.filter((item) => item.symbol !== key);
  if (next.length === existing.length) return existing;
  await writeTempTargets(db, next);
  return next;
}

async function writeTempTargets(
  db: SqliteDatabase,
  items: TempTargetSymbolRow[]
): Promise<void> {
  const payload = JSON.stringify({ items });
  await run(
    db,
    `
      insert into market_settings (key, value_json)
      values (?, ?)
      on conflict(key) do update set
        value_json = excluded.value_json
    `,
    [TEMP_TARGETS_KEY, payload]
  );
}

function safeParseTempTargets(value: string): TempTargetSymbolRow[] | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    const items = (parsed as any)?.items;
    if (!Array.isArray(items)) return null;
    return items
      .map((item) => {
        const symbol = typeof item?.symbol === "string" ? item.symbol.trim() : "";
        const expiresAt = Number(item?.expiresAt);
        const updatedAt = Number(item?.updatedAt);
        if (!symbol) return null;
        if (!Number.isFinite(expiresAt) || expiresAt <= 0) return null;
        if (!Number.isFinite(updatedAt) || updatedAt <= 0) return null;
        return { symbol, expiresAt, updatedAt } satisfies TempTargetSymbolRow;
      })
      .filter((item): item is TempTargetSymbolRow => Boolean(item));
  } catch {
    return null;
  }
}

export async function getMarketIngestSchedulerConfig(
  db: SqliteDatabase
): Promise<MarketIngestSchedulerConfig> {
  const row = await get<{ value_json: string }>(
    db,
    `select value_json from market_settings where key = ?`,
    [INGEST_SCHEDULER_KEY]
  );
  if (!row?.value_json) {
    await setMarketIngestSchedulerConfig(db, DEFAULT_INGEST_SCHEDULER_CONFIG);
    return { ...DEFAULT_INGEST_SCHEDULER_CONFIG };
  }
  const parsed = safeParseMarketIngestSchedulerConfig(row.value_json);
  if (!parsed) {
    await setMarketIngestSchedulerConfig(db, DEFAULT_INGEST_SCHEDULER_CONFIG);
    return { ...DEFAULT_INGEST_SCHEDULER_CONFIG };
  }
  return parsed;
}

export async function setMarketIngestSchedulerConfig(
  db: SqliteDatabase,
  input: MarketIngestSchedulerConfig
): Promise<MarketIngestSchedulerConfig> {
  const normalized = normalizeMarketIngestSchedulerConfig(input);
  await run(
    db,
    `
      insert into market_settings (key, value_json)
      values (?, ?)
      on conflict(key) do update set
        value_json = excluded.value_json
    `,
    [INGEST_SCHEDULER_KEY, JSON.stringify(normalized)]
  );
  return normalized;
}

export async function getPersistedIngestControlState(
  db: SqliteDatabase
): Promise<PersistedIngestControlState> {
  const row = await get<{ value_json: string }>(
    db,
    `select value_json from market_settings where key = ?`,
    [INGEST_CONTROL_STATE_KEY]
  );
  if (!row?.value_json) {
    return { paused: false, updatedAt: Date.now() };
  }
  try {
    const parsed = JSON.parse(row.value_json) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { paused: false, updatedAt: Date.now() };
    }
    const paused = Boolean((parsed as { paused?: boolean }).paused);
    const updatedAtRaw = Number((parsed as { updatedAt?: number }).updatedAt);
    return {
      paused,
      updatedAt:
        Number.isFinite(updatedAtRaw) && updatedAtRaw > 0
          ? Math.floor(updatedAtRaw)
          : Date.now()
    };
  } catch {
    return { paused: false, updatedAt: Date.now() };
  }
}

export async function setPersistedIngestControlState(
  db: SqliteDatabase,
  input: PersistedIngestControlState
): Promise<PersistedIngestControlState> {
  const normalized: PersistedIngestControlState = {
    paused: Boolean(input.paused),
    updatedAt:
      Number.isFinite(input.updatedAt) && input.updatedAt > 0
        ? Math.floor(input.updatedAt)
        : Date.now()
  };
  await run(
    db,
    `
      insert into market_settings (key, value_json)
      values (?, ?)
      on conflict(key) do update set
        value_json = excluded.value_json
    `,
    [INGEST_CONTROL_STATE_KEY, JSON.stringify(normalized)]
  );
  return normalized;
}

export async function getMarketRolloutFlags(
  db: SqliteDatabase
): Promise<MarketRolloutFlags> {
  const row = await get<{ value_json: string }>(
    db,
    `select value_json from market_settings where key = ?`,
    [ROLLOUT_FLAGS_KEY]
  );
  if (!row?.value_json) {
    const defaults = buildDefaultRolloutFlags();
    await writeMarketRolloutFlags(db, defaults);
    return defaults;
  }
  const parsed = safeParseMarketRolloutFlags(row.value_json);
  if (!parsed) {
    const defaults = buildDefaultRolloutFlags();
    await writeMarketRolloutFlags(db, defaults);
    return defaults;
  }
  return parsed;
}

export async function setMarketRolloutFlags(
  db: SqliteDatabase,
  input: SetMarketRolloutFlagsInput | null | undefined
): Promise<MarketRolloutFlags> {
  const current = await getMarketRolloutFlags(db);
  const next: MarketRolloutFlags = {
    p0Enabled:
      typeof input?.p0Enabled === "boolean" ? input.p0Enabled : current.p0Enabled,
    p1Enabled:
      typeof input?.p1Enabled === "boolean" ? input.p1Enabled : current.p1Enabled,
    p2Enabled:
      typeof input?.p2Enabled === "boolean" ? input.p2Enabled : current.p2Enabled,
    universeIndexDailyEnabled:
      typeof input?.universeIndexDailyEnabled === "boolean"
        ? input.universeIndexDailyEnabled
        : current.universeIndexDailyEnabled,
    universeDailyBasicEnabled:
      typeof input?.universeDailyBasicEnabled === "boolean"
        ? input.universeDailyBasicEnabled
        : current.universeDailyBasicEnabled,
    universeMoneyflowEnabled:
      typeof input?.universeMoneyflowEnabled === "boolean"
        ? input.universeMoneyflowEnabled
        : current.universeMoneyflowEnabled,
    p2RealtimeIndexV1:
      typeof input?.p2RealtimeIndexV1 === "boolean"
        ? input.p2RealtimeIndexV1
        : current.p2RealtimeIndexV1,
    p2RealtimeEquityEtfV1:
      typeof input?.p2RealtimeEquityEtfV1 === "boolean"
        ? input.p2RealtimeEquityEtfV1
        : current.p2RealtimeEquityEtfV1,
    p2FuturesMicrostructureV1:
      typeof input?.p2FuturesMicrostructureV1 === "boolean"
        ? input.p2FuturesMicrostructureV1
        : current.p2FuturesMicrostructureV1,
    p2SpecialPermissionStkPremarketV1:
      typeof input?.p2SpecialPermissionStkPremarketV1 === "boolean"
        ? input.p2SpecialPermissionStkPremarketV1
        : current.p2SpecialPermissionStkPremarketV1,
    updatedAt: Date.now()
  };
  await writeMarketRolloutFlags(db, next);
  return next;
}

export async function convergeMarketRolloutFlagsToDefaultOpen(
  db: SqliteDatabase
): Promise<MarketRolloutFlags> {
  const current = await getMarketRolloutFlags(db);
  if (isConvergedRolloutFlags(current)) {
    return current;
  }

  const next: MarketRolloutFlags = {
    ...current,
    p0Enabled: true,
    p1Enabled: true,
    p2Enabled: true,
    universeIndexDailyEnabled: false,
    universeDailyBasicEnabled: false,
    universeMoneyflowEnabled: false,
    p2RealtimeIndexV1: true,
    p2RealtimeEquityEtfV1: true,
    p2FuturesMicrostructureV1: true,
    updatedAt: Date.now()
  };
  await writeMarketRolloutFlags(db, next);
  return next;
}

function buildDefaultRolloutFlags(now = Date.now()): MarketRolloutFlags {
  return {
    ...DEFAULT_MARKET_ROLLOUT_FLAGS,
    updatedAt: now
  };
}

function safeParseMarketRolloutFlags(value: string): MarketRolloutFlags | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return normalizeMarketRolloutFlags(parsed as Partial<MarketRolloutFlags>);
  } catch {
    return null;
  }
}

function normalizeMarketRolloutFlags(
  input: Partial<MarketRolloutFlags>
): MarketRolloutFlags {
  const updatedAtRaw = Number(input.updatedAt);
  return {
    p0Enabled: Boolean(input.p0Enabled ?? DEFAULT_MARKET_ROLLOUT_FLAGS.p0Enabled),
    p1Enabled: Boolean(input.p1Enabled ?? DEFAULT_MARKET_ROLLOUT_FLAGS.p1Enabled),
    p2Enabled: Boolean(input.p2Enabled ?? DEFAULT_MARKET_ROLLOUT_FLAGS.p2Enabled),
    universeIndexDailyEnabled: Boolean(
      input.universeIndexDailyEnabled ??
        DEFAULT_MARKET_ROLLOUT_FLAGS.universeIndexDailyEnabled
    ),
    universeDailyBasicEnabled: Boolean(
      input.universeDailyBasicEnabled ??
        DEFAULT_MARKET_ROLLOUT_FLAGS.universeDailyBasicEnabled
    ),
    universeMoneyflowEnabled: Boolean(
      input.universeMoneyflowEnabled ??
        DEFAULT_MARKET_ROLLOUT_FLAGS.universeMoneyflowEnabled
    ),
    p2RealtimeIndexV1: Boolean(
      input.p2RealtimeIndexV1 ?? DEFAULT_MARKET_ROLLOUT_FLAGS.p2RealtimeIndexV1
    ),
    p2RealtimeEquityEtfV1: Boolean(
      input.p2RealtimeEquityEtfV1 ??
        DEFAULT_MARKET_ROLLOUT_FLAGS.p2RealtimeEquityEtfV1
    ),
    p2FuturesMicrostructureV1: Boolean(
      input.p2FuturesMicrostructureV1 ??
        DEFAULT_MARKET_ROLLOUT_FLAGS.p2FuturesMicrostructureV1
    ),
    p2SpecialPermissionStkPremarketV1: Boolean(
      input.p2SpecialPermissionStkPremarketV1 ??
        DEFAULT_MARKET_ROLLOUT_FLAGS.p2SpecialPermissionStkPremarketV1
    ),
    updatedAt:
      Number.isFinite(updatedAtRaw) && updatedAtRaw > 0
        ? Math.floor(updatedAtRaw)
        : Date.now()
  };
}

function isConvergedRolloutFlags(flags: MarketRolloutFlags): boolean {
  return (
    flags.p0Enabled &&
    flags.p1Enabled &&
    flags.p2Enabled &&
    flags.p2RealtimeIndexV1 &&
    flags.p2RealtimeEquityEtfV1 &&
    flags.p2FuturesMicrostructureV1
  );
}

async function writeMarketRolloutFlags(
  db: SqliteDatabase,
  flags: MarketRolloutFlags
): Promise<void> {
  const normalized = normalizeMarketRolloutFlags(flags);
  await run(
    db,
    `
      insert into market_settings (key, value_json)
      values (?, ?)
      on conflict(key) do update set
        value_json = excluded.value_json
    `,
    [ROLLOUT_FLAGS_KEY, JSON.stringify(normalized)]
  );
}

function safeParseMarketIngestSchedulerConfig(
  value: string
): MarketIngestSchedulerConfig | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return normalizeMarketIngestSchedulerConfig(
      parsed as Partial<MarketIngestSchedulerConfig>
    );
  } catch {
    return null;
  }
}

function normalizeMarketIngestSchedulerConfig(
  input: Partial<MarketIngestSchedulerConfig>
): MarketIngestSchedulerConfig {
  const runAtRaw =
    typeof input.runAt === "string" ? input.runAt.trim() : DEFAULT_INGEST_SCHEDULER_CONFIG.runAt;
  const runAt = normalizeRunAt(runAtRaw);
  const timezoneRaw =
    typeof input.timezone === "string" && input.timezone.trim()
      ? input.timezone.trim()
      : DEFAULT_INGEST_SCHEDULER_CONFIG.timezone;
  const timezone = normalizeTimezone(timezoneRaw);
  const scope =
    input.scope === "targets" || input.scope === "universe" || input.scope === "both"
      ? input.scope
      : DEFAULT_INGEST_SCHEDULER_CONFIG.scope;
  return {
    enabled: Boolean(input.enabled ?? DEFAULT_INGEST_SCHEDULER_CONFIG.enabled),
    runAt,
    timezone,
    scope,
    runOnStartup: Boolean(
      input.runOnStartup ?? DEFAULT_INGEST_SCHEDULER_CONFIG.runOnStartup
    ),
    catchUpMissed: Boolean(
      input.catchUpMissed ?? DEFAULT_INGEST_SCHEDULER_CONFIG.catchUpMissed
    )
  };
}

function normalizeRunAt(input: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(input);
  if (!match) return DEFAULT_INGEST_SCHEDULER_CONFIG.runAt;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || hours < 0 || hours > 23) {
    return DEFAULT_INGEST_SCHEDULER_CONFIG.runAt;
  }
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > 59) {
    return DEFAULT_INGEST_SCHEDULER_CONFIG.runAt;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function normalizeTimezone(input: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone: input });
    if (!formatter.resolvedOptions().timeZone) {
      return DEFAULT_INGEST_SCHEDULER_CONFIG.timezone;
    }
    return input;
  } catch {
    return DEFAULT_INGEST_SCHEDULER_CONFIG.timezone;
  }
}
