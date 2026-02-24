import type { TargetTaskModuleId } from "@mytrader/shared";

export const TARGET_TASK_MODULE_ORDER: TargetTaskModuleId[] = [
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

const TARGET_CHECK_PREFIX = "target.";

export function toTargetCompletenessCheckId(moduleId: TargetTaskModuleId): string {
  return `${TARGET_CHECK_PREFIX}${moduleId}`;
}

export function fromTargetCompletenessCheckId(
  checkId: string
): TargetTaskModuleId | null {
  const raw = checkId.startsWith(TARGET_CHECK_PREFIX)
    ? checkId.slice(TARGET_CHECK_PREFIX.length)
    : checkId;
  return isTargetTaskModuleId(raw) ? raw : null;
}

export function isTargetTaskModuleId(value: string): value is TargetTaskModuleId {
  return TARGET_TASK_MODULE_ORDER.includes(value as TargetTaskModuleId);
}
