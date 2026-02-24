import type {
  MarketCompletenessConfig,
  MarketRolloutFlags,
  MarketIngestSchedulerConfig,
  MarketTargetTaskMatrixConfig,
  SetMarketCompletenessConfigInput,
  SetMarketRolloutFlagsInput,
  MarketTargetsConfig,
  MarketUniversePoolBucketStatus,
  MarketUniversePoolConfig,
  MarketUniversePoolOverview,
  TargetTaskModuleId,
  UniversePoolBucketId
} from "@mytrader/shared";

import {
  getDefaultTargetEnabledCheckIds,
  getTargetModuleFromCompletenessCheckId,
  listCompletenessChecks
} from "../market/completeness/checkRegistry";

import { get, run } from "./sqlite";
import type { SqliteDatabase } from "./sqlite";

const TARGETS_KEY = "targets_config_v1";
const TEMP_TARGETS_KEY = "targets_temp_symbols_v1";
const TARGET_TASK_MATRIX_KEY = "target_task_matrix_config_v1";
const COMPLETENESS_CONFIG_KEY = "completeness_config_v2";
const INGEST_SCHEDULER_KEY = "ingest_scheduler_config_v1";
const INGEST_SCHEDULER_STARTUP_CONVERGENCE_KEY =
  "ingest_scheduler_startup_disabled_converged_v1";
const INGEST_CONTROL_STATE_KEY = "ingest_control_state_v1";
const UNIVERSE_POOL_STATE_KEY = "universe_pool_state_v1";
const ROLLOUT_FLAGS_KEY = "rollout_flags_v1";

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
  runOnStartup: false,
  catchUpMissed: false
};

const UNIVERSE_POOL_BUCKETS: UniversePoolBucketId[] = [
  "cn_a",
  "etf",
  "metal_futures",
  "metal_spot"
];

const DEFAULT_UNIVERSE_POOL_CONFIG: MarketUniversePoolConfig = {
  enabledBuckets: [...UNIVERSE_POOL_BUCKETS]
};

const TARGET_TASK_MODULES: TargetTaskModuleId[] = [
  "core.daily_prices",
  "core.instrument_meta",
  "core.daily_basics",
  "core.daily_moneyflows",
  "core.futures_settle",
  "core.futures_oi",
  "core.spot_price_avg",
  "core.spot_settle",
  "task.exposure",
  "task.momentum",
  "task.liquidity"
];

const DEFAULT_TARGET_TASK_MATRIX_CONFIG: MarketTargetTaskMatrixConfig = {
  version: 1,
  defaultLookbackDays: 180,
  enabledModules: [...TARGET_TASK_MODULES]
};

const COMPLETENESS_CHECKS = listCompletenessChecks();

const TARGET_EDITABLE_CHECK_IDS = new Set(
  COMPLETENESS_CHECKS
    .filter((check) => check.scopeId === "target_pool" && check.editable)
    .map((check) => check.id)
);

const DEFAULT_MARKET_COMPLETENESS_CONFIG_BASE: Omit<
  MarketCompletenessConfig,
  "updatedAt"
> = {
  version: 1,
  defaultLookbackDays: 180,
  targetEnabledCheckIds: getDefaultTargetEnabledCheckIds(),
  checks: COMPLETENESS_CHECKS.map((check) => ({
    id: check.id,
    scopeId: check.scopeId,
    bucketId: check.bucketId,
    label: check.label,
    domainId: check.domainId,
    moduleId: check.moduleId,
    editable: check.editable,
    sortOrder: check.sortOrder,
    legacyTargetModuleId: check.legacyTargetModuleId
  }))
};

const DEFAULT_UNIVERSE_POOL_STATE: PersistedUniversePoolState = buildDefaultUniversePoolState();

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

export async function convergeMarketIngestSchedulerStartupDisabled(
  db: SqliteDatabase
): Promise<MarketIngestSchedulerConfig> {
  const marker = await get<{ value: string }>(
    db,
    `select value from app_meta where key = ?`,
    [INGEST_SCHEDULER_STARTUP_CONVERGENCE_KEY]
  );
  if (marker?.value === "1") {
    return await getMarketIngestSchedulerConfig(db);
  }

  const current = await getMarketIngestSchedulerConfig(db);
  const next = await setMarketIngestSchedulerConfig(db, {
    ...current,
    runOnStartup: false,
    catchUpMissed: false
  });

  await run(
    db,
    `insert or replace into app_meta (key, value) values (?, ?)`,
    [INGEST_SCHEDULER_STARTUP_CONVERGENCE_KEY, "1"]
  );

  return next;
}

export async function getMarketCompletenessConfig(
  db: SqliteDatabase
): Promise<MarketCompletenessConfig> {
  const row = await get<{ value_json: string }>(
    db,
    `select value_json from market_settings where key = ?`,
    [COMPLETENESS_CONFIG_KEY]
  );
  if (row?.value_json) {
    const parsed = safeParseMarketCompletenessConfig(row.value_json);
    if (parsed) return parsed;
  }

  const legacyRow = await get<{ value_json: string }>(
    db,
    `select value_json from market_settings where key = ?`,
    [TARGET_TASK_MATRIX_KEY]
  );
  const legacy = legacyRow?.value_json
    ? safeParseTargetTaskMatrixConfig(legacyRow.value_json)
    : null;

  const migrated = normalizeMarketCompletenessConfig({
    version: 1,
    defaultLookbackDays:
      legacy?.defaultLookbackDays ??
      DEFAULT_MARKET_COMPLETENESS_CONFIG_BASE.defaultLookbackDays,
    targetEnabledCheckIds: (
      legacy?.enabledModules ?? DEFAULT_TARGET_TASK_MATRIX_CONFIG.enabledModules
    )
      .map((moduleId) => resolveCompletenessCheckIdByTargetModule(moduleId))
      .filter((checkId): checkId is string => Boolean(checkId)),
    checks: DEFAULT_MARKET_COMPLETENESS_CONFIG_BASE.checks,
    updatedAt: Date.now()
  });
  await writeMarketCompletenessConfig(db, migrated);
  return migrated;
}

export async function setMarketCompletenessConfig(
  db: SqliteDatabase,
  input: SetMarketCompletenessConfigInput
): Promise<MarketCompletenessConfig> {
  const current = await getMarketCompletenessConfig(db);
  const next = normalizeMarketCompletenessConfig({
    ...current,
    defaultLookbackDays:
      typeof input.defaultLookbackDays === "number"
        ? input.defaultLookbackDays
        : current.defaultLookbackDays,
    targetEnabledCheckIds:
      input.targetEnabledCheckIds ?? current.targetEnabledCheckIds,
    updatedAt: Date.now()
  });
  await writeMarketCompletenessConfig(db, next);

  const legacy = toLegacyTargetTaskMatrixConfig(next);
  await run(
    db,
    `
      insert into market_settings (key, value_json)
      values (?, ?)
      on conflict(key) do update set
        value_json = excluded.value_json
    `,
    [TARGET_TASK_MATRIX_KEY, JSON.stringify(legacy)]
  );

  return next;
}

export async function getMarketTargetTaskMatrixConfig(
  db: SqliteDatabase
): Promise<MarketTargetTaskMatrixConfig> {
  const completeness = await getMarketCompletenessConfig(db);
  return toLegacyTargetTaskMatrixConfig(completeness);
}

export async function setMarketTargetTaskMatrixConfig(
  db: SqliteDatabase,
  input: MarketTargetTaskMatrixConfig
): Promise<MarketTargetTaskMatrixConfig> {
  const normalized = normalizeTargetTaskMatrixConfig(input);
  await setMarketCompletenessConfig(db, {
    defaultLookbackDays: normalized.defaultLookbackDays,
    targetEnabledCheckIds: normalized.enabledModules
      .map((moduleId) => resolveCompletenessCheckIdByTargetModule(moduleId))
      .filter((checkId): checkId is string => Boolean(checkId))
  });
  return await getMarketTargetTaskMatrixConfig(db);
}

export async function getMarketUniversePoolOverview(
  db: SqliteDatabase
): Promise<MarketUniversePoolOverview> {
  const state = await getPersistedUniversePoolState(db);
  const enabled = new Set(DEFAULT_UNIVERSE_POOL_CONFIG.enabledBuckets);
  const buckets: MarketUniversePoolBucketStatus[] = UNIVERSE_POOL_BUCKETS.map((bucket) => ({
    bucket,
    enabled: enabled.has(bucket),
    lastAsOfTradeDate: state.buckets[bucket]?.lastAsOfTradeDate ?? null,
    lastRunAt: state.buckets[bucket]?.lastRunAt ?? null
  }));
  return {
    config: { ...DEFAULT_UNIVERSE_POOL_CONFIG },
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

function safeParseTargetTaskMatrixConfig(
  value: string
): MarketTargetTaskMatrixConfig | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return normalizeTargetTaskMatrixConfig(parsed as Partial<MarketTargetTaskMatrixConfig>);
  } catch {
    return null;
  }
}

function safeParseMarketCompletenessConfig(
  value: string
): MarketCompletenessConfig | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return normalizeMarketCompletenessConfig(parsed as Partial<MarketCompletenessConfig>);
  } catch {
    return null;
  }
}

function normalizeMarketCompletenessConfig(
  input: Partial<MarketCompletenessConfig>
): MarketCompletenessConfig {
  const defaultLookbackDaysRaw = Number(input.defaultLookbackDays);
  const defaultLookbackDays =
    Number.isFinite(defaultLookbackDaysRaw) &&
    defaultLookbackDaysRaw >= 1 &&
    defaultLookbackDaysRaw <= 3650
      ? Math.floor(defaultLookbackDaysRaw)
      : DEFAULT_MARKET_COMPLETENESS_CONFIG_BASE.defaultLookbackDays;

  const editableSet = new Set<string>();
  if (Array.isArray(input.targetEnabledCheckIds)) {
    input.targetEnabledCheckIds.forEach((checkId) => {
      const key = String(checkId).trim();
      if (!key) return;
      if (!TARGET_EDITABLE_CHECK_IDS.has(key)) return;
      editableSet.add(key);
    });
  }

  const targetEnabledCheckIds =
    editableSet.size > 0
      ? DEFAULT_MARKET_COMPLETENESS_CONFIG_BASE.targetEnabledCheckIds.filter((id) =>
          editableSet.has(id)
        )
      : [...DEFAULT_MARKET_COMPLETENESS_CONFIG_BASE.targetEnabledCheckIds];

  const updatedAtRaw = Number(input.updatedAt);
  return {
    version: 1,
    defaultLookbackDays,
    targetEnabledCheckIds,
    checks: DEFAULT_MARKET_COMPLETENESS_CONFIG_BASE.checks.map((check) => ({
      ...check
    })),
    updatedAt:
      Number.isFinite(updatedAtRaw) && updatedAtRaw > 0
        ? Math.floor(updatedAtRaw)
        : Date.now()
  };
}

async function writeMarketCompletenessConfig(
  db: SqliteDatabase,
  config: MarketCompletenessConfig
): Promise<void> {
  const normalized = normalizeMarketCompletenessConfig(config);
  await run(
    db,
    `
      insert into market_settings (key, value_json)
      values (?, ?)
      on conflict(key) do update set
        value_json = excluded.value_json
    `,
    [COMPLETENESS_CONFIG_KEY, JSON.stringify(normalized)]
  );
}

function toLegacyTargetTaskMatrixConfig(
  config: MarketCompletenessConfig
): MarketTargetTaskMatrixConfig {
  const enabledModules = resolveTargetModulesFromCheckIds(config.targetEnabledCheckIds);
  return normalizeTargetTaskMatrixConfig({
    version: 1,
    defaultLookbackDays: config.defaultLookbackDays,
    enabledModules
  });
}

function resolveTargetModulesFromCheckIds(checkIds: string[]): TargetTaskModuleId[] {
  const moduleSet = new Set<TargetTaskModuleId>();
  checkIds.forEach((checkId) => {
    const moduleId = getTargetModuleFromCompletenessCheckId(checkId);
    if (!moduleId) return;
    moduleSet.add(moduleId);
  });
  if (moduleSet.size === 0) {
    return [...DEFAULT_TARGET_TASK_MATRIX_CONFIG.enabledModules];
  }
  return TARGET_TASK_MODULES.filter((moduleId) => moduleSet.has(moduleId));
}

function resolveCompletenessCheckIdByTargetModule(
  moduleId: TargetTaskModuleId
): string | null {
  const match = DEFAULT_MARKET_COMPLETENESS_CONFIG_BASE.checks.find(
    (check) => check.legacyTargetModuleId === moduleId
  );
  return match?.id ?? null;
}

function normalizeTargetTaskMatrixConfig(
  input: Partial<MarketTargetTaskMatrixConfig>
): MarketTargetTaskMatrixConfig {
  const enabledModulesSet = new Set<TargetTaskModuleId>();
  if (Array.isArray(input.enabledModules)) {
    input.enabledModules.forEach((module) => {
      const key = String(module).trim() as TargetTaskModuleId;
      if (TARGET_TASK_MODULES.includes(key)) {
        enabledModulesSet.add(key);
      }
    });
  }
  const defaultLookbackDaysRaw = Number(input.defaultLookbackDays);
  const defaultLookbackDays =
    Number.isFinite(defaultLookbackDaysRaw) &&
    defaultLookbackDaysRaw >= 1 &&
    defaultLookbackDaysRaw <= 3650
      ? Math.floor(defaultLookbackDaysRaw)
      : DEFAULT_TARGET_TASK_MATRIX_CONFIG.defaultLookbackDays;

  return {
    version: 1,
    defaultLookbackDays,
    enabledModules:
      enabledModulesSet.size > 0
        ? TARGET_TASK_MODULES.filter((module) => enabledModulesSet.has(module))
        : [...DEFAULT_TARGET_TASK_MATRIX_CONFIG.enabledModules]
  };
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
        typeof raw?.lastAsOfTradeDate === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(raw.lastAsOfTradeDate)
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
      metal_futures: { lastAsOfTradeDate: null, lastRunAt: null },
      metal_spot: { lastAsOfTradeDate: null, lastRunAt: null }
    },
    updatedAt: Date.now()
  };
}
