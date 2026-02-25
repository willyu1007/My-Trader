import type {
  CompletenessBucketId,
  CompletenessEntityType,
  CompletenessScopeId,
  DataDomainId,
  TargetTaskModuleId
} from "@mytrader/shared";

import {
  TARGET_TASK_MODULE_ORDER,
  fromTargetCompletenessCheckId,
  toTargetCompletenessCheckId
} from "./legacyTargetModule";
import {
  buildUiApplicationTooltips,
  buildUsageContextTooltips,
  listSourceUiApplications,
  resolveTargetUiApplications,
  resolveTargetUsageContexts
} from "./uiApplicationRegistry";

export interface CompletenessCheckDefinition {
  id: string;
  label: string;
  scopeId: CompletenessScopeId;
  bucketId: CompletenessBucketId;
  entityType: CompletenessEntityType;
  domainId: DataDomainId | null;
  moduleId: string | null;
  usageContexts: string[];
  uiApplications: string[];
  usageContextTooltips: Record<string, string>;
  uiApplicationTooltips: Record<string, string>;
  editable: boolean;
  sortOrder: number;
  requiredDatasetIds: string[];
  optionalDatasetIds: string[];
  legacyTargetModuleId: TargetTaskModuleId | null;
}

export const COMPLETENESS_BUCKET_ORDER: Record<CompletenessBucketId, number> = {
  stock: 10,
  etf: 20,
  futures: 30,
  spot: 40,
  index: 50,
  fx: 60,
  macro: 70,
  global: 80
};

const TARGET_MODULE_LABELS: Record<TargetTaskModuleId, string> = {
  "core.daily_prices": "行情日线",
  "core.instrument_meta": "标的元数据",
  "core.daily_basics": "股票基础面",
  "core.daily_moneyflows": "股票资金流",
  "core.futures_settle": "期货结算价",
  "core.futures_oi": "期货持仓量",
  "core.spot_price_avg": "现货均价",
  "core.spot_settle": "现货交割量",
  "task.exposure": "任务-敞口",
  "task.momentum": "任务-动量",
  "task.liquidity": "任务-流动性"
};

function resolveTargetBucket(moduleId: TargetTaskModuleId): CompletenessBucketId {
  if (moduleId === "core.daily_basics" || moduleId === "core.daily_moneyflows") {
    return "stock";
  }
  if (moduleId === "core.futures_settle" || moduleId === "core.futures_oi") {
    return "futures";
  }
  if (moduleId === "core.spot_price_avg" || moduleId === "core.spot_settle") {
    return "spot";
  }
  return "global";
}

function resolveTargetRequiredDatasets(moduleId: TargetTaskModuleId): string[] {
  if (moduleId === "core.daily_prices") return ["sqlite.daily_prices"];
  if (moduleId === "core.instrument_meta") return ["sqlite.instruments"];
  if (moduleId === "core.daily_basics") return ["sqlite.daily_basics"];
  if (moduleId === "core.daily_moneyflows") return ["sqlite.daily_moneyflows"];
  if (moduleId === "core.futures_settle" || moduleId === "core.futures_oi") {
    return ["duckdb.futures_daily_ext"];
  }
  if (moduleId === "core.spot_price_avg" || moduleId === "core.spot_settle") {
    return ["duckdb.spot_sge_daily_ext"];
  }
  return ["sqlite.daily_prices"];
}

const TARGET_CHECKS: CompletenessCheckDefinition[] = TARGET_TASK_MODULE_ORDER.map(
  (moduleId, index) => {
    const usageContexts = resolveTargetUsageContexts(moduleId);
    const uiApplications = resolveTargetUiApplications(moduleId);
    return {
      id: toTargetCompletenessCheckId(moduleId),
      label: TARGET_MODULE_LABELS[moduleId],
      scopeId: "target_pool",
      bucketId: resolveTargetBucket(moduleId),
      entityType: "instrument",
      domainId:
        moduleId === "core.daily_basics" || moduleId === "core.daily_moneyflows"
          ? "stock"
          : moduleId === "core.futures_settle" || moduleId === "core.futures_oi"
            ? "futures"
            : moduleId === "core.spot_price_avg" || moduleId === "core.spot_settle"
              ? "spot"
              : null,
      moduleId,
      usageContexts,
      uiApplications,
      usageContextTooltips: buildUsageContextTooltips(usageContexts),
      uiApplicationTooltips: buildUiApplicationTooltips(uiApplications),
      editable: true,
      sortOrder: 100 + index,
      requiredDatasetIds: resolveTargetRequiredDatasets(moduleId),
      optionalDatasetIds: [],
      legacyTargetModuleId: moduleId
    };
  }
);

const SOURCE_CHECKS: CompletenessCheckDefinition[] = [
  {
    id: "source.stock.market.daily",
    label: "股票日线供给",
    scopeId: "source_pool",
    bucketId: "stock",
    entityType: "instrument",
    domainId: "stock",
    moduleId: "stock.market.daily",
    usageContexts: ["数据源供给监控"],
    uiApplications: listSourceUiApplications(),
    usageContextTooltips: buildUsageContextTooltips(["数据源供给监控"]),
    uiApplicationTooltips: buildUiApplicationTooltips(listSourceUiApplications()),
    editable: false,
    sortOrder: 200,
    requiredDatasetIds: ["sqlite.daily_prices"],
    optionalDatasetIds: ["sqlite.instruments"],
    legacyTargetModuleId: null
  },
  {
    id: "source.stock.moneyflow",
    label: "股票资金流供给",
    scopeId: "source_pool",
    bucketId: "stock",
    entityType: "instrument",
    domainId: "stock",
    moduleId: "stock.moneyflow",
    usageContexts: ["数据源供给监控"],
    uiApplications: listSourceUiApplications(),
    usageContextTooltips: buildUsageContextTooltips(["数据源供给监控"]),
    uiApplicationTooltips: buildUiApplicationTooltips(listSourceUiApplications()),
    editable: false,
    sortOrder: 210,
    requiredDatasetIds: ["sqlite.daily_moneyflows"],
    optionalDatasetIds: [],
    legacyTargetModuleId: null
  },
  {
    id: "source.etf.daily_quote",
    label: "ETF 日线供给",
    scopeId: "source_pool",
    bucketId: "etf",
    entityType: "instrument",
    domainId: "etf",
    moduleId: "etf.daily_quote",
    usageContexts: ["数据源供给监控"],
    uiApplications: listSourceUiApplications(),
    usageContextTooltips: buildUsageContextTooltips(["数据源供给监控"]),
    uiApplicationTooltips: buildUiApplicationTooltips(listSourceUiApplications()),
    editable: false,
    sortOrder: 220,
    requiredDatasetIds: ["sqlite.daily_prices"],
    optionalDatasetIds: ["sqlite.instruments"],
    legacyTargetModuleId: null
  },
  {
    id: "source.futures.daily",
    label: "期货日线供给",
    scopeId: "source_pool",
    bucketId: "futures",
    entityType: "instrument",
    domainId: "futures",
    moduleId: "futures.daily",
    usageContexts: ["数据源供给监控"],
    uiApplications: listSourceUiApplications(),
    usageContextTooltips: buildUsageContextTooltips(["数据源供给监控"]),
    uiApplicationTooltips: buildUiApplicationTooltips(listSourceUiApplications()),
    editable: false,
    sortOrder: 230,
    requiredDatasetIds: ["sqlite.daily_prices"],
    optionalDatasetIds: ["sqlite.instruments"],
    legacyTargetModuleId: null
  },
  {
    id: "source.spot.sge_daily",
    label: "现货日线供给",
    scopeId: "source_pool",
    bucketId: "spot",
    entityType: "instrument",
    domainId: "spot",
    moduleId: "spot.sge_daily",
    usageContexts: ["数据源供给监控"],
    uiApplications: listSourceUiApplications(),
    usageContextTooltips: buildUsageContextTooltips(["数据源供给监控"]),
    uiApplicationTooltips: buildUiApplicationTooltips(listSourceUiApplications()),
    editable: false,
    sortOrder: 240,
    requiredDatasetIds: ["sqlite.daily_prices"],
    optionalDatasetIds: ["sqlite.instruments"],
    legacyTargetModuleId: null
  },
  {
    id: "source.index.daily",
    label: "指数日线供给",
    scopeId: "source_pool",
    bucketId: "index",
    entityType: "instrument",
    domainId: "index",
    moduleId: "index.daily",
    usageContexts: ["数据源供给监控"],
    uiApplications: listSourceUiApplications(),
    usageContextTooltips: buildUsageContextTooltips(["数据源供给监控"]),
    uiApplicationTooltips: buildUiApplicationTooltips(listSourceUiApplications()),
    editable: false,
    sortOrder: 250,
    requiredDatasetIds: ["sqlite.daily_prices"],
    optionalDatasetIds: ["sqlite.instrument_profiles"],
    legacyTargetModuleId: null
  },
  {
    id: "source.fx.daily",
    label: "外汇日线供给",
    scopeId: "source_pool",
    bucketId: "fx",
    entityType: "fx_pair",
    domainId: "fx",
    moduleId: "fx.daily",
    usageContexts: ["数据源供给监控"],
    uiApplications: listSourceUiApplications(),
    usageContextTooltips: buildUsageContextTooltips(["数据源供给监控"]),
    uiApplicationTooltips: buildUiApplicationTooltips(listSourceUiApplications()),
    editable: false,
    sortOrder: 260,
    requiredDatasetIds: ["sqlite.daily_prices"],
    optionalDatasetIds: ["sqlite.fx_pair_meta"],
    legacyTargetModuleId: null
  },
  {
    id: "source.macro.snapshot",
    label: "宏观快照供给",
    scopeId: "source_pool",
    bucketId: "macro",
    entityType: "macro_module",
    domainId: "macro",
    moduleId: "macro.snapshot",
    usageContexts: ["数据源供给监控"],
    uiApplications: listSourceUiApplications(),
    usageContextTooltips: buildUsageContextTooltips(["数据源供给监控"]),
    uiApplicationTooltips: buildUiApplicationTooltips(listSourceUiApplications()),
    editable: false,
    sortOrder: 270,
    requiredDatasetIds: ["sqlite.macro_module_snapshot"],
    optionalDatasetIds: [],
    legacyTargetModuleId: null
  }
];

const CHECKS = [...TARGET_CHECKS, ...SOURCE_CHECKS].sort((a, b) => {
  if (a.scopeId !== b.scopeId) return a.scopeId.localeCompare(b.scopeId);
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.id.localeCompare(b.id);
});

export function listCompletenessChecks(): CompletenessCheckDefinition[] {
  return CHECKS.map((check) => ({
    ...check,
    usageContexts: [...check.usageContexts],
    uiApplications: [...check.uiApplications],
    usageContextTooltips: { ...check.usageContextTooltips },
    uiApplicationTooltips: { ...check.uiApplicationTooltips },
    requiredDatasetIds: [...check.requiredDatasetIds],
    optionalDatasetIds: [...check.optionalDatasetIds]
  }));
}

export function listCompletenessChecksByScope(
  scopeId: CompletenessScopeId
): CompletenessCheckDefinition[] {
  return listCompletenessChecks().filter((check) => check.scopeId === scopeId);
}

export function getCompletenessCheckById(
  checkId: string
): CompletenessCheckDefinition | null {
  const check = CHECKS.find((item) => item.id === checkId);
  if (!check) return null;
  return {
    ...check,
    usageContexts: [...check.usageContexts],
    uiApplications: [...check.uiApplications],
    usageContextTooltips: { ...check.usageContextTooltips },
    uiApplicationTooltips: { ...check.uiApplicationTooltips },
    requiredDatasetIds: [...check.requiredDatasetIds],
    optionalDatasetIds: [...check.optionalDatasetIds]
  };
}

export function getDefaultTargetEnabledCheckIds(): string[] {
  return TARGET_CHECKS.map((check) => check.id);
}

export function getCompletenessCheckIdForTargetModule(
  moduleId: TargetTaskModuleId
): string {
  return toTargetCompletenessCheckId(moduleId);
}

export function getTargetModuleFromCompletenessCheckId(
  checkId: string
): TargetTaskModuleId | null {
  const fromPrefix = fromTargetCompletenessCheckId(checkId);
  if (fromPrefix) return fromPrefix;
  const byLegacy = CHECKS.find((check) => check.id === checkId)?.legacyTargetModuleId;
  return byLegacy ?? null;
}
