import type { TargetTaskModuleId } from "@mytrader/shared";

const TARGET_USAGE_CONTEXTS_BY_MODULE: Record<TargetTaskModuleId, string[]> = {
  "core.daily_prices": ["目标池物化", "任务-动量", "任务-流动性"],
  "core.instrument_meta": ["目标池物化", "标的识别"],
  "core.daily_basics": ["目标池物化", "任务-敞口"],
  "core.daily_moneyflows": ["目标池物化", "资金流分析"],
  "core.futures_settle": ["目标池物化", "任务-敞口"],
  "core.futures_oi": ["目标池物化", "衍生品持仓分析"],
  "core.spot_price_avg": ["目标池物化", "任务-敞口"],
  "core.spot_settle": ["目标池物化", "现货交割分析"],
  "task.exposure": ["任务指标输出", "策略-敞口"],
  "task.momentum": ["任务指标输出", "策略-动量"],
  "task.liquidity": ["任务指标输出", "策略-流动性"]
};

const TARGET_UI_APPLICATIONS_BY_MODULE: Record<TargetTaskModuleId, string[]> = {
  "core.daily_prices": ["市场行情-行情绘制", "数据分析-行情特征", "交易执行-滑点基准"],
  "core.instrument_meta": ["市场行情-标的检索", "数据管理-标的映射", "数据分析-样本对齐"],
  "core.daily_basics": ["数据分析-基本面因子", "组合看板-资产概览", "风控-规模约束"],
  "core.daily_moneyflows": ["市场行情-资金流看板", "数据分析-资金流因子", "风控-资金拥挤度"],
  "core.futures_settle": ["市场行情-期货行情", "数据分析-期限结构", "风控-衍生品敞口"],
  "core.futures_oi": ["市场行情-期货持仓", "数据分析-持仓结构", "风控-拥挤度监控"],
  "core.spot_price_avg": ["市场行情-现货行情", "数据分析-现货特征", "组合看板-跨市场对照"],
  "core.spot_settle": ["市场行情-交割跟踪", "数据分析-交割节奏", "风控-供需压力"],
  "task.exposure": ["组合看板-敞口分解", "风控-敞口告警", "数据分析-风险归因"],
  "task.momentum": ["组合看板-动量信号", "数据分析-因子验证", "交易执行-调仓优先级"],
  "task.liquidity": ["风控-流动性约束", "交易执行-可成交性评估", "组合看板-流动性体检"]
};

const DEFAULT_TARGET_UI_APPLICATIONS = ["数据分析-通用消费"];
const SOURCE_UI_APPLICATIONS = ["数据管理-供给详情", "监控告警-供给异常"];
const DEFAULT_TARGET_USAGE_CONTEXTS = ["目标池物化"];

const USAGE_CONTEXT_TOOLTIPS: Record<string, string> = {
  "目标池物化": "用于将目标池实体与核心行情数据对齐，并生成可消费的完备性状态。",
  "标的识别": "用于补全标的基础信息，确保后续任务能正确识别资产与市场属性。",
  "任务-敞口": "用于敞口相关任务计算，衡量策略在不同资产维度的暴露情况。",
  "资金流分析": "用于资金流相关分析任务，辅助识别成交结构与资金方向。",
  "衍生品持仓分析": "用于衍生品持仓量相关分析任务，跟踪合约热度与仓位变化。",
  "现货交割分析": "用于现货交割相关任务，观察交割量变化与供需状态。",
  "任务指标输出": "用于汇总任务级指标结果，供策略和看板读取。",
  "策略-敞口": "用于策略层敞口规则评估与风控判断。",
  "策略-动量": "用于策略层动量规则计算与信号判断。",
  "策略-流动性": "用于策略层流动性规则评估，过滤交易可执行性。",
  "数据源供给监控": "用于监控数据源供给状态与异常，支撑完备性诊断。"
};

const UI_APPLICATION_TOOLTIPS: Record<string, string> = {
  "市场行情-行情绘制": "用于行情页图表与列表绘制，保障展示口径稳定。",
  "数据分析-行情特征": "用于分析模块生成价格与波动相关特征。",
  "交易执行-滑点基准": "用于执行模块评估成交偏差与滑点基线。",
  "市场行情-标的检索": "用于行情页标的检索与基础信息展示。",
  "数据管理-标的映射": "用于数据管理场景下的标的映射与校验。",
  "数据分析-样本对齐": "用于分析样本池与标的信息对齐。",
  "数据分析-基本面因子": "用于基本面相关因子与横截面分析。",
  "组合看板-资产概览": "用于组合概览页展示资产规模与结构。",
  "风控-规模约束": "用于风控规则评估规模与容量边界。",
  "市场行情-资金流看板": "用于资金流向的可视化展示与监控。",
  "数据分析-资金流因子": "用于资金流驱动的分析特征构建。",
  "风控-资金拥挤度": "用于识别资金拥挤与风险集中。",
  "市场行情-期货行情": "用于期货价格与主力合约展示。",
  "数据分析-期限结构": "用于期限结构与展期特征分析。",
  "风控-衍生品敞口": "用于衍生品维度敞口与风险约束。",
  "市场行情-期货持仓": "用于期货持仓变化与热度展示。",
  "数据分析-持仓结构": "用于持仓结构与行为模式分析。",
  "风控-拥挤度监控": "用于高拥挤合约风险监控。",
  "市场行情-现货行情": "用于现货价格走势与横向对照展示。",
  "数据分析-现货特征": "用于现货序列特征提取与分析。",
  "组合看板-跨市场对照": "用于多市场联动对照展示。",
  "市场行情-交割跟踪": "用于交割量与交割节奏展示。",
  "数据分析-交割节奏": "用于交割周期与供需节奏分析。",
  "风控-供需压力": "用于供需失衡风险监控。",
  "组合看板-敞口分解": "用于组合敞口拆解与归因展示。",
  "风控-敞口告警": "用于敞口越界与异常变化告警。",
  "数据分析-风险归因": "用于风险来源归因分析。",
  "组合看板-动量信号": "用于组合层动量信号展示。",
  "数据分析-因子验证": "用于因子有效性检验与回顾。",
  "交易执行-调仓优先级": "用于调仓候选排序与执行优先级决策。",
  "风控-流动性约束": "用于交易前流动性风控判定。",
  "交易执行-可成交性评估": "用于执行前可成交性打分。",
  "组合看板-流动性体检": "用于组合流动性健康度展示。",
  "数据管理-供给详情": "用于数据管理页展示供给覆盖详情。",
  "监控告警-供给异常": "用于供给异常监控与告警联动。"
};

export function resolveTargetUiApplications(moduleId: TargetTaskModuleId): string[] {
  const values =
    TARGET_UI_APPLICATIONS_BY_MODULE[moduleId] ?? DEFAULT_TARGET_UI_APPLICATIONS;
  return [...values];
}

export function resolveTargetUsageContexts(moduleId: TargetTaskModuleId): string[] {
  const values =
    TARGET_USAGE_CONTEXTS_BY_MODULE[moduleId] ?? DEFAULT_TARGET_USAGE_CONTEXTS;
  return [...values];
}

export function listSourceUiApplications(): string[] {
  return [...SOURCE_UI_APPLICATIONS];
}

export function resolveUsageContextTooltip(label: string): string {
  return (
    USAGE_CONTEXT_TOOLTIPS[label] ??
    `${label}：用于目标池完备性评估与下游任务消费。`
  );
}

function parseUiApplicationLabel(label: string): { domain: string; feature: string } {
  const separatorIndex = label.indexOf("-");
  if (separatorIndex <= 0 || separatorIndex >= label.length - 1) {
    return { domain: label, feature: "通用消费" };
  }
  return {
    domain: label.slice(0, separatorIndex).trim(),
    feature: label.slice(separatorIndex + 1).trim()
  };
}

export function resolveUiApplicationTooltip(label: string): string {
  if (UI_APPLICATION_TOOLTIPS[label]) return UI_APPLICATION_TOOLTIPS[label];
  const parsed = parseUiApplicationLabel(label);
  return `${parsed.domain}：用于${parsed.feature}场景消费该检查项数据。`;
}

export function buildUsageContextTooltips(
  labels: string[]
): Record<string, string> {
  const result: Record<string, string> = {};
  labels.forEach((item) => {
    const key = String(item).trim();
    if (!key) return;
    result[key] = resolveUsageContextTooltip(key);
  });
  return result;
}

export function buildUiApplicationTooltips(
  labels: string[]
): Record<string, string> {
  const result: Record<string, string> = {};
  labels.forEach((item) => {
    const key = String(item).trim();
    if (!key) return;
    result[key] = resolveUiApplicationTooltip(key);
  });
  return result;
}
