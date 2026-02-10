import type {
  MarketIngestSchedulerConfig,
  MarketTargetsConfig,
  MarketUniversePoolBucketStatus,
  MarketUniversePoolConfig,
  MarketUniversePoolOverview,
  UniversePoolBucketId
} from "@mytrader/shared";

import { get, run } from "./sqlite";
import type { SqliteDatabase } from "./sqlite";

const TARGETS_KEY = "targets_config_v1";
const TEMP_TARGETS_KEY = "targets_temp_symbols_v1";
const INGEST_SCHEDULER_KEY = "ingest_scheduler_config_v1";
const INGEST_CONTROL_STATE_KEY = "ingest_control_state_v1";
const UNIVERSE_POOL_CONFIG_KEY = "universe_pool_config_v1";
const UNIVERSE_POOL_STATE_KEY = "universe_pool_state_v1";

export interface PersistedIngestControlState {
  paused: boolean;
  updatedAt: number;
}

type PersistedUniversePoolBucketState = {
  lastAsOfTradeDate: string | null;
  lastRunAt: number | null;
};

type PersistedUniversePoolState = {
  buckets: Record<UniversePoolBucketId, PersistedUniversePoolBucketState>;
  updatedAt: number;
};

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

const UNIVERSE_POOL_BUCKETS: UniversePoolBucketId[] = [
  "cn_a",
  "etf",
  "precious_metal"
];

const DEFAULT_UNIVERSE_POOL_CONFIG: MarketUniversePoolConfig = {
  enabledBuckets: [...UNIVERSE_POOL_BUCKETS]
};

const DEFAULT_UNIVERSE_POOL_STATE: PersistedUniversePoolState = buildDefaultUniversePoolState();

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

export async function getMarketUniversePoolConfig(
  db: SqliteDatabase
): Promise<MarketUniversePoolConfig> {
  const row = await get<{ value_json: string }>(
    db,
    `select value_json from market_settings where key = ?`,
    [UNIVERSE_POOL_CONFIG_KEY]
  );
  if (!row?.value_json) {
    await setMarketUniversePoolConfig(db, DEFAULT_UNIVERSE_POOL_CONFIG);
    return { ...DEFAULT_UNIVERSE_POOL_CONFIG };
  }
  const parsed = safeParseMarketUniversePoolConfig(row.value_json);
  if (!parsed) {
    await setMarketUniversePoolConfig(db, DEFAULT_UNIVERSE_POOL_CONFIG);
    return { ...DEFAULT_UNIVERSE_POOL_CONFIG };
  }
  return parsed;
}

export async function setMarketUniversePoolConfig(
  db: SqliteDatabase,
  input: MarketUniversePoolConfig
): Promise<MarketUniversePoolConfig> {
  const normalized = normalizeMarketUniversePoolConfig(input);
  await run(
    db,
    `
      insert into market_settings (key, value_json)
      values (?, ?)
      on conflict(key) do update set
        value_json = excluded.value_json
    `,
    [UNIVERSE_POOL_CONFIG_KEY, JSON.stringify(normalized)]
  );
  return normalized;
}

export async function getMarketUniversePoolOverview(
  db: SqliteDatabase
): Promise<MarketUniversePoolOverview> {
  const [config, state] = await Promise.all([
    getMarketUniversePoolConfig(db),
    getPersistedUniversePoolState(db)
  ]);
  const enabled = new Set(config.enabledBuckets);
  const buckets: MarketUniversePoolBucketStatus[] = UNIVERSE_POOL_BUCKETS.map((bucket) => ({
    bucket,
    enabled: enabled.has(bucket),
    lastAsOfTradeDate: state.buckets[bucket]?.lastAsOfTradeDate ?? null,
    lastRunAt: state.buckets[bucket]?.lastRunAt ?? null
  }));
  return {
    config,
    buckets,
    updatedAt: state.updatedAt
  };
}

export async function updateMarketUniversePoolBucketStates(
  db: SqliteDatabase,
  input: {
    buckets: UniversePoolBucketId[];
    asOfTradeDate: string | null;
    runAt?: number | null;
  }
): Promise<MarketUniversePoolOverview> {
  if (input.buckets.length === 0) {
    return await getMarketUniversePoolOverview(db);
  }
  const now = normalizeEpoch(input.runAt);
  const current = await getPersistedUniversePoolState(db);
  const next: PersistedUniversePoolState = {
    buckets: { ...current.buckets },
    updatedAt: now
  };

  for (const bucket of input.buckets) {
    next.buckets[bucket] = {
      lastAsOfTradeDate: input.asOfTradeDate ?? current.buckets[bucket]?.lastAsOfTradeDate ?? null,
      lastRunAt: now
    };
  }

  await run(
    db,
    `
      insert into market_settings (key, value_json)
      values (?, ?)
      on conflict(key) do update set
        value_json = excluded.value_json
    `,
    [UNIVERSE_POOL_STATE_KEY, JSON.stringify(next)]
  );
  return await getMarketUniversePoolOverview(db);
}

async function getPersistedUniversePoolState(
  db: SqliteDatabase
): Promise<PersistedUniversePoolState> {
  const row = await get<{ value_json: string }>(
    db,
    `select value_json from market_settings where key = ?`,
    [UNIVERSE_POOL_STATE_KEY]
  );
  if (!row?.value_json) return buildDefaultUniversePoolState();
  const parsed = safeParsePersistedUniversePoolState(row.value_json);
  if (!parsed) return buildDefaultUniversePoolState();
  return parsed;
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

function safeParseMarketUniversePoolConfig(
  value: string
): MarketUniversePoolConfig | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return normalizeMarketUniversePoolConfig(parsed as Partial<MarketUniversePoolConfig>);
  } catch {
    return null;
  }
}

function normalizeMarketUniversePoolConfig(
  input: Partial<MarketUniversePoolConfig>
): MarketUniversePoolConfig {
  const enabledSet = new Set<UniversePoolBucketId>();
  if (Array.isArray(input.enabledBuckets)) {
    input.enabledBuckets.forEach((value) => {
      const key = String(value).trim() as UniversePoolBucketId;
      if (UNIVERSE_POOL_BUCKETS.includes(key)) {
        enabledSet.add(key);
      }
    });
  }
  const enabledBuckets =
    enabledSet.size > 0 ? Array.from(enabledSet.values()) : [...DEFAULT_UNIVERSE_POOL_CONFIG.enabledBuckets];
  return { enabledBuckets };
}

function safeParsePersistedUniversePoolState(
  value: string
): PersistedUniversePoolState | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const valueObj = parsed as {
      buckets?: Record<string, { lastAsOfTradeDate?: string | null; lastRunAt?: number | null }>;
      updatedAt?: number;
    };
    const buckets = { ...DEFAULT_UNIVERSE_POOL_STATE.buckets };
    for (const key of UNIVERSE_POOL_BUCKETS) {
      const raw = valueObj.buckets?.[key];
      const lastAsOfTradeDate =
        typeof raw?.lastAsOfTradeDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.lastAsOfTradeDate)
          ? raw.lastAsOfTradeDate
          : null;
      const lastRunAt = normalizeOptionalEpoch(raw?.lastRunAt);
      buckets[key] = { lastAsOfTradeDate, lastRunAt };
    }
    return {
      buckets,
      updatedAt: normalizeEpoch(valueObj.updatedAt)
    };
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

function normalizeOptionalEpoch(value: unknown): number | null {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return Math.floor(raw);
}

function normalizeEpoch(value: unknown): number {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return Date.now();
  return Math.floor(raw);
}

function buildDefaultUniversePoolState(): PersistedUniversePoolState {
  return {
    buckets: {
      cn_a: { lastAsOfTradeDate: null, lastRunAt: null },
      etf: { lastAsOfTradeDate: null, lastRunAt: null },
      precious_metal: { lastAsOfTradeDate: null, lastRunAt: null }
    },
    updatedAt: Date.now()
  };
}
