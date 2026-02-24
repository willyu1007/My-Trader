import type {
  DataDomainId,
  MarketDataSourceConfigV2,
  MarketRolloutFlags
} from "@mytrader/shared";

export type ManagedExecutionModuleId =
  | "stock.market.daily"
  | "stock.moneyflow"
  | "etf.daily_quote"
  | "futures.daily"
  | "spot.sge_daily"
  | "index.daily"
  | "fx.daily"
  | "macro.snapshot";

export interface ExecutionModuleDecision {
  moduleId: ManagedExecutionModuleId;
  domainId: DataDomainId;
  dataSourceEnabled: boolean;
  rolloutEnabled: boolean;
  enabled: boolean;
}

export interface MarketExecutionPlan {
  decisions: ExecutionModuleDecision[];
  allowedModules: Set<ManagedExecutionModuleId>;
  targetModules: Set<ManagedExecutionModuleId>;
  universeModules: Set<ManagedExecutionModuleId>;
}

const MODULE_DOMAIN_MAP: Record<ManagedExecutionModuleId, DataDomainId> = {
  "stock.market.daily": "stock",
  "stock.moneyflow": "stock",
  "etf.daily_quote": "etf",
  "futures.daily": "futures",
  "spot.sge_daily": "spot",
  "index.daily": "index",
  "fx.daily": "fx",
  "macro.snapshot": "macro"
};

const TARGET_SCOPE_MODULES = new Set<ManagedExecutionModuleId>([
  "stock.market.daily",
  "stock.moneyflow",
  "etf.daily_quote"
]);

export function resolveMarketExecutionPlan(input: {
  dataSourceConfig: MarketDataSourceConfigV2;
  rolloutFlags: MarketRolloutFlags;
}): MarketExecutionPlan {
  const decisions: ExecutionModuleDecision[] = [];

  (Object.keys(MODULE_DOMAIN_MAP) as ManagedExecutionModuleId[]).forEach((moduleId) => {
    const domainId = MODULE_DOMAIN_MAP[moduleId];
    const dataSourceEnabled = isModuleEnabledByDataSource(
      input.dataSourceConfig,
      domainId,
      moduleId
    );
    const rolloutEnabled = isModuleEnabledByRollout(input.rolloutFlags, moduleId);
    decisions.push({
      moduleId,
      domainId,
      dataSourceEnabled,
      rolloutEnabled,
      enabled: dataSourceEnabled && rolloutEnabled
    });
  });

  const allowedModules = new Set<ManagedExecutionModuleId>();
  const targetModules = new Set<ManagedExecutionModuleId>();
  const universeModules = new Set<ManagedExecutionModuleId>();

  for (const decision of decisions) {
    if (!decision.enabled) continue;
    allowedModules.add(decision.moduleId);
    universeModules.add(decision.moduleId);
    if (TARGET_SCOPE_MODULES.has(decision.moduleId)) {
      targetModules.add(decision.moduleId);
    }
  }

  return {
    decisions,
    allowedModules,
    targetModules,
    universeModules
  };
}

function isModuleEnabledByDataSource(
  config: MarketDataSourceConfigV2,
  domainId: DataDomainId,
  moduleId: ManagedExecutionModuleId
): boolean {
  const domain = config.domains[domainId];
  if (!domain?.enabled) return false;
  if (moduleId === "macro.snapshot") {
    const explicitSnapshot = domain.modules["macro.snapshot"];
    if (explicitSnapshot) {
      return Boolean(explicitSnapshot.enabled);
    }
    const macroModules = Object.values(domain.modules);
    if (macroModules.length === 0) return domain.enabled;
    return macroModules.some((item) => item.enabled);
  }
  const moduleConfig = domain.modules[moduleId];
  return Boolean(moduleConfig?.enabled);
}

function isModuleEnabledByRollout(
  flags: MarketRolloutFlags,
  moduleId: ManagedExecutionModuleId
): boolean {
  if (moduleId === "stock.market.daily") return flags.p0Enabled;
  if (moduleId === "stock.moneyflow") {
    return flags.p0Enabled && flags.universeMoneyflowEnabled;
  }
  if (moduleId === "etf.daily_quote") return flags.p0Enabled;
  if (moduleId === "index.daily") {
    return flags.p1Enabled && flags.universeIndexDailyEnabled;
  }
  if (moduleId === "futures.daily") return flags.p1Enabled;
  if (moduleId === "spot.sge_daily") return flags.p1Enabled;
  if (moduleId === "fx.daily") return flags.p1Enabled;
  if (moduleId === "macro.snapshot") return flags.p1Enabled;
  return false;
}
