import type {
  AssetClass,
  TargetTaskModuleId,
  TargetTaskStatus
} from "@mytrader/shared";

const MODULES_BY_ASSET_CLASS: Record<
  Exclude<AssetClass, "cash">,
  {
    required: TargetTaskModuleId[];
    optional: TargetTaskModuleId[];
  }
> = {
  stock: {
    required: [
      "core.daily_prices",
      "core.instrument_meta",
      "core.daily_basics",
      "core.daily_moneyflows"
    ],
    optional: ["task.exposure", "task.momentum", "task.liquidity"]
  },
  etf: {
    required: ["core.daily_prices", "core.instrument_meta"],
    optional: ["task.momentum", "task.liquidity"]
  },
  futures: {
    required: [
      "core.daily_prices",
      "core.instrument_meta",
      "core.futures_settle",
      "core.futures_oi"
    ],
    optional: ["task.exposure", "task.momentum", "task.liquidity"]
  },
  spot: {
    required: [
      "core.daily_prices",
      "core.instrument_meta",
      "core.spot_price_avg",
      "core.spot_settle"
    ],
    optional: ["task.momentum"]
  }
};

type ModulePresence = Partial<Record<TargetTaskModuleId, boolean>>;

export function getApplicableModulesForAssetClass(
  assetClass: AssetClass | null
): {
  required: TargetTaskModuleId[];
  optional: TargetTaskModuleId[];
} {
  if (!assetClass || assetClass === "cash") {
    return { required: [], optional: [] };
  }
  return MODULES_BY_ASSET_CLASS[assetClass] ?? { required: [], optional: [] };
}

export function resolveTargetModuleStatus(
  input: {
    moduleId: TargetTaskModuleId;
    assetClass: AssetClass | null;
    presence: ModulePresence;
  }
): TargetTaskStatus {
  if (!input.assetClass || input.assetClass === "cash") {
    return "not_applicable";
  }
  const modules = getApplicableModulesForAssetClass(input.assetClass);
  const applicable =
    modules.required.includes(input.moduleId) ||
    modules.optional.includes(input.moduleId);
  if (!applicable) return "not_applicable";
  if (input.presence[input.moduleId]) return "complete";
  return modules.required.includes(input.moduleId) ? "missing" : "partial";
}

export function buildCoverageRatio(
  statuses: TargetTaskStatus[]
): number | null {
  const applicable = statuses.filter((item) => item !== "not_applicable");
  if (applicable.length === 0) return null;
  const complete = applicable.filter((item) => item === "complete").length;
  return complete / applicable.length;
}

