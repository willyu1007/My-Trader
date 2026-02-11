import type {
  ConnectivityTestRecord,
  DataDomainId,
  MarketDataSourceConfigV2,
  MarketUniversePoolConfig,
  UniversePoolBucketId
} from "@mytrader/shared";

import {
  buildDefaultDataSourceConfig,
  getDataDomainCatalogItem,
  getDataSourceCatalog,
  getDataSourceModuleCatalogItem,
  isActiveProvider,
  listDataDomainIds,
  mergeLegacyBucketsIntoDataSourceConfig,
  toLegacyUniversePoolBuckets
} from "../market/dataSourceCatalog";
import { get, run } from "./sqlite";
import type { SqliteDatabase } from "./sqlite";

const DATA_SOURCE_CONFIG_KEY = "data_source_config_v2";
const DATA_SOURCE_TEST_STATE_KEY = "data_source_test_state_v1";
const LEGACY_UNIVERSE_POOL_CONFIG_KEY = "universe_pool_config_v1";

const LEGACY_BUCKETS: UniversePoolBucketId[] = [
  "cn_a",
  "etf",
  "precious_metal"
];

type PersistedConnectivityTestState = {
  records: ConnectivityTestRecord[];
  updatedAt: number;
};

export async function getMarketDataSourceCatalog() {
  return getDataSourceCatalog();
}

export async function getMarketDataSourceConfig(
  db: SqliteDatabase
): Promise<MarketDataSourceConfigV2> {
  const row = await get<{ value_json: string }>(
    db,
    `select value_json from market_settings where key = ?`,
    [DATA_SOURCE_CONFIG_KEY]
  );

  if (row?.value_json) {
    const parsed = safeParseDataSourceConfig(row.value_json);
    if (parsed) return parsed;
  }

  const migrated = await migrateDataSourceConfigFromLegacy(db);
  await persistDataSourceConfig(db, migrated);
  return migrated;
}

export async function setMarketDataSourceConfig(
  db: SqliteDatabase,
  input: MarketDataSourceConfigV2
): Promise<MarketDataSourceConfigV2> {
  const normalized = normalizeDataSourceConfig(input);
  await persistDataSourceConfig(db, normalized);
  return normalized;
}

export async function getLegacyUniversePoolConfigFromDataSource(
  db: SqliteDatabase
): Promise<MarketUniversePoolConfig> {
  const dataSourceConfig = await getMarketDataSourceConfig(db);
  const enabledBuckets = toLegacyUniversePoolBuckets(dataSourceConfig);
  return {
    enabledBuckets:
      enabledBuckets.length > 0 ? enabledBuckets : ["cn_a", "etf"]
  };
}

export async function setLegacyUniversePoolConfigToDataSource(
  db: SqliteDatabase,
  input: MarketUniversePoolConfig
): Promise<MarketUniversePoolConfig> {
  const normalizedLegacy = normalizeLegacyUniversePoolConfig(input);
  const current = await getMarketDataSourceConfig(db);
  const merged = mergeLegacyBucketsIntoDataSourceConfig(
    current,
    normalizedLegacy.enabledBuckets
  );
  const saved = await setMarketDataSourceConfig(db, merged);
  return {
    enabledBuckets: toLegacyUniversePoolBuckets(saved)
  };
}

export async function listConnectivityTestRecords(
  db: SqliteDatabase
): Promise<ConnectivityTestRecord[]> {
  const persisted = await getPersistedConnectivityState(db);
  const persistedByKey = new Map<string, ConnectivityTestRecord>();
  persisted.records.forEach((record) => {
    persistedByKey.set(buildTestRecordKey(record), record);
  });

  const records: ConnectivityTestRecord[] = [];
  const catalog = getDataSourceCatalog();
  for (const domain of catalog.domains) {
    const domainKey = buildTestRecordKey({
      scope: "domain",
      domainId: domain.id,
      moduleId: null
    });
    const persistedDomain = persistedByKey.get(domainKey);
    records.push(
      normalizeConnectivityTestRecord(
        persistedDomain ?? {
          scope: "domain",
          domainId: domain.id,
          moduleId: null,
          status: "untested",
          testedAt: null,
          message: null,
          stale: false
        }
      )
    );

    for (const module of domain.modules) {
      const moduleKey = buildTestRecordKey({
        scope: "module",
        domainId: domain.id,
        moduleId: module.id
      });
      const persistedModule = persistedByKey.get(moduleKey);
      const fallbackStatus =
        module.implemented && module.syncCapable ? "untested" : "unsupported";
      records.push(
        normalizeConnectivityTestRecord(
          persistedModule ?? {
            scope: "module",
            domainId: domain.id,
            moduleId: module.id,
            status: fallbackStatus,
            testedAt: null,
            message: null,
            stale: false
          }
        )
      );
    }
  }

  return records;
}

export async function upsertConnectivityTestRecord(
  db: SqliteDatabase,
  input: ConnectivityTestRecord
): Promise<ConnectivityTestRecord> {
  const record = normalizeConnectivityTestRecord(input);
  const persisted = await getPersistedConnectivityState(db);
  const recordsByKey = new Map<string, ConnectivityTestRecord>();

  persisted.records.forEach((item) => {
    recordsByKey.set(buildTestRecordKey(item), normalizeConnectivityTestRecord(item));
  });
  recordsByKey.set(buildTestRecordKey(record), record);

  const next: PersistedConnectivityTestState = {
    records: Array.from(recordsByKey.values()),
    updatedAt: Date.now()
  };
  await persistConnectivityState(db, next);
  return record;
}

export async function markConnectivityTestsStale(
  db: SqliteDatabase,
  input?: { domainId?: DataDomainId | null; moduleId?: string | null }
): Promise<void> {
  const persisted = await getPersistedConnectivityState(db);
  if (persisted.records.length === 0) return;

  const domainId = input?.domainId ?? null;
  const moduleId = input?.moduleId ?? null;

  const nextRecords = persisted.records.map((record) => {
    if (record.status !== "pass" && record.status !== "fail") {
      return record;
    }

    if (!domainId && !moduleId) {
      return { ...record, stale: true };
    }

    if (domainId && record.domainId !== domainId) {
      return record;
    }

    if (moduleId) {
      if (record.scope !== "module" || record.moduleId !== moduleId) {
        return record;
      }
      return { ...record, stale: true };
    }

    return { ...record, stale: true };
  });

  await persistConnectivityState(db, {
    records: nextRecords,
    updatedAt: Date.now()
  });
}

function normalizeLegacyUniversePoolConfig(
  input: Partial<MarketUniversePoolConfig>
): MarketUniversePoolConfig {
  const set = new Set<UniversePoolBucketId>();
  if (Array.isArray(input.enabledBuckets)) {
    input.enabledBuckets.forEach((item) => {
      const bucket = String(item).trim() as UniversePoolBucketId;
      if (LEGACY_BUCKETS.includes(bucket)) {
        set.add(bucket);
      }
    });
  }

  if (set.size === 0) {
    set.add("cn_a");
    set.add("etf");
  }

  return {
    enabledBuckets: LEGACY_BUCKETS.filter((bucket) => set.has(bucket))
  };
}

async function migrateDataSourceConfigFromLegacy(
  db: SqliteDatabase
): Promise<MarketDataSourceConfigV2> {
  const defaults = buildDefaultDataSourceConfig();
  const legacyRow = await get<{ value_json: string }>(
    db,
    `select value_json from market_settings where key = ?`,
    [LEGACY_UNIVERSE_POOL_CONFIG_KEY]
  );

  if (!legacyRow?.value_json) {
    return normalizeDataSourceConfig(defaults);
  }

  const legacy = safeParseLegacyUniversePoolConfig(legacyRow.value_json);
  if (!legacy) return normalizeDataSourceConfig(defaults);

  const merged = mergeLegacyBucketsIntoDataSourceConfig(defaults, legacy.enabledBuckets);
  return normalizeDataSourceConfig(merged);
}

function safeParseLegacyUniversePoolConfig(
  value: string
): MarketUniversePoolConfig | null {
  try {
    const parsed = JSON.parse(value) as Partial<MarketUniversePoolConfig>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return normalizeLegacyUniversePoolConfig(parsed);
  } catch {
    return null;
  }
}

function safeParseDataSourceConfig(
  value: string
): MarketDataSourceConfigV2 | null {
  try {
    const parsed = JSON.parse(value) as Partial<MarketDataSourceConfigV2>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return normalizeDataSourceConfig(parsed);
  } catch {
    return null;
  }
}

function normalizeDataSourceConfig(
  input: Partial<MarketDataSourceConfigV2>
): MarketDataSourceConfigV2 {
  const defaults = buildDefaultDataSourceConfig();
  const mainProvider =
    typeof input.mainProvider === "string" && isActiveProvider(input.mainProvider)
      ? input.mainProvider
      : defaults.mainProvider;

  const domains = listDataDomainIds().reduce((acc, domainId) => {
    const domainCatalog = getDataDomainCatalogItem(domainId);
    const domainDefaults = defaults.domains[domainId];
    const domainInput = input.domains?.[domainId];

    if (!domainCatalog || !domainDefaults) {
      acc[domainId] = domainDefaults;
      return acc;
    }

    const provider =
      typeof domainInput?.provider === "string" &&
      isActiveProvider(domainInput.provider)
        ? domainInput.provider
        : mainProvider;

    const tokenMode =
      domainInput?.tokenMode === "override" ? "override" : "inherit_main";

    const modules = domainCatalog.modules.reduce((moduleAcc, module) => {
      const rawEnabled = Boolean(domainInput?.modules?.[module.id]?.enabled);
      moduleAcc[module.id] = {
        enabled:
          module.implemented && module.syncCapable
            ? rawEnabled
            : false
      };
      return moduleAcc;
    }, {} as MarketDataSourceConfigV2["domains"][DataDomainId]["modules"]);

    const hasEnabledModule = domainCatalog.modules.some(
      (module) => Boolean(modules[module.id]?.enabled)
    );

    acc[domainId] = {
      enabled:
        Boolean(domainInput?.enabled ?? domainDefaults.enabled) &&
        hasEnabledModule,
      provider,
      tokenMode,
      modules
    };
    return acc;
  }, {} as MarketDataSourceConfigV2["domains"]);

  return {
    version: 2,
    mainProvider,
    domains
  };
}

async function persistDataSourceConfig(
  db: SqliteDatabase,
  config: MarketDataSourceConfigV2
): Promise<void> {
  await run(
    db,
    `
      insert into market_settings (key, value_json)
      values (?, ?)
      on conflict(key) do update set
        value_json = excluded.value_json
    `,
    [DATA_SOURCE_CONFIG_KEY, JSON.stringify(config)]
  );
}

async function getPersistedConnectivityState(
  db: SqliteDatabase
): Promise<PersistedConnectivityTestState> {
  const row = await get<{ value_json: string }>(
    db,
    `select value_json from market_settings where key = ?`,
    [DATA_SOURCE_TEST_STATE_KEY]
  );

  if (!row?.value_json) {
    return {
      records: [],
      updatedAt: Date.now()
    };
  }

  try {
    const parsed = JSON.parse(row.value_json) as Partial<PersistedConnectivityTestState>;
    const records = Array.isArray(parsed.records)
      ? parsed.records.map((item) => normalizeConnectivityTestRecord(item)).filter(Boolean)
      : [];
    const updatedAtRaw = Number(parsed.updatedAt);
    return {
      records,
      updatedAt:
        Number.isFinite(updatedAtRaw) && updatedAtRaw > 0
          ? Math.floor(updatedAtRaw)
          : Date.now()
    };
  } catch {
    return {
      records: [],
      updatedAt: Date.now()
    };
  }
}

async function persistConnectivityState(
  db: SqliteDatabase,
  state: PersistedConnectivityTestState
): Promise<void> {
  await run(
    db,
    `
      insert into market_settings (key, value_json)
      values (?, ?)
      on conflict(key) do update set
        value_json = excluded.value_json
    `,
    [DATA_SOURCE_TEST_STATE_KEY, JSON.stringify(state)]
  );
}

function normalizeConnectivityTestRecord(
  input: Partial<ConnectivityTestRecord>
): ConnectivityTestRecord {
  const scope = input.scope === "module" ? "module" : "domain";
  const domainId = listDataDomainIds().includes(input.domainId as DataDomainId)
    ? (input.domainId as DataDomainId)
    : "stock";

  const moduleIdRaw =
    scope === "module" && typeof input.moduleId === "string"
      ? input.moduleId.trim()
      : null;
  const moduleCatalog = moduleIdRaw
    ? getDataSourceModuleCatalogItem(domainId, moduleIdRaw)
    : null;
  const moduleId = moduleCatalog?.id ?? null;

  const statusRaw = input.status;
  let status: ConnectivityTestRecord["status"] =
    statusRaw === "pass" ||
    statusRaw === "fail" ||
    statusRaw === "unsupported" ||
    statusRaw === "untested"
      ? statusRaw
      : "untested";

  if (scope === "module") {
    if (!moduleId) {
      status = "unsupported";
    } else if (!moduleCatalog?.implemented || !moduleCatalog?.syncCapable) {
      status = "unsupported";
    }
  }

  const testedAtRaw = Number(input.testedAt);
  const testedAt = Number.isFinite(testedAtRaw) && testedAtRaw > 0
    ? Math.floor(testedAtRaw)
    : null;

  const message = typeof input.message === "string" && input.message.trim()
    ? input.message.trim()
    : null;

  return {
    scope,
    domainId,
    moduleId,
    status,
    testedAt,
    message,
    stale: Boolean(input.stale)
  };
}

function buildTestRecordKey(record: {
  scope: ConnectivityTestRecord["scope"];
  domainId: DataDomainId;
  moduleId: string | null;
}): string {
  return `${record.scope}:${record.domainId}:${record.moduleId ?? "*"}`;
}
