import type {
  AssetClass,
  LedgerEventType,
  RiskLimitType
} from "@mytrader/shared";

import type {
  AnalysisTab,
  PositionFormState,
  RiskFormState,
  TargetPoolStructureStats,
  UniversePoolBucketId
} from "./types";

export const DEFAULT_LEDGER_START_DATE = "2000-01-01";
export const DEFAULT_LEDGER_END_DATE = "2099-12-31";

export const MARKET_EXPLORER_WIDTH_STORAGE_KEY = "mytrader:market:explorerWidth";
export const MARKET_EXPLORER_DEFAULT_WIDTH = 240;
export const MARKET_EXPLORER_MIN_WIDTH = 220;
export const MARKET_EXPLORER_MAX_WIDTH = 520;

export const TARGETS_EDITOR_SPLIT_STORAGE_KEY = "mytrader:other:targetsEditorLeftPct";
export const TARGETS_EDITOR_SPLIT_DEFAULT = 50;
export const TARGETS_EDITOR_SPLIT_MIN = 34;
export const TARGETS_EDITOR_SPLIT_MAX = 66;

export const navItems = [
  {
    key: "portfolio",
    label: "投资组合",
    meta: "概览",
    description: "集中查看组合、持仓与估值变化。",
    icon: "pie_chart"
  },
  {
    key: "risk",
    label: "风险管理",
    meta: "敞口/限额",
    description: "跟踪风险敞口、限额与预警。",
    icon: "shield"
  },
  {
    key: "market",
    label: "市场行情",
    meta: "数据/报价",
    description: "导入行情与价格数据，更新估值。",
    icon: "show_chart"
  },
  {
    key: "index-tracking",
    label: "指数跟踪",
    meta: "指数/对标",
    description: "跟踪核心指数与对标走势。",
    icon: "track_changes"
  },
  {
    key: "data-analysis",
    label: "数据分析",
    meta: "分析/洞察",
    description: "更全面的多情景分析入口（组合/个股/指数/板块）。",
    icon: "functions"
  },
  {
    key: "opportunities",
    label: "机会",
    meta: "扫描/策略",
    description: "聚合潜在机会与策略提示。",
    icon: "lightbulb"
  },
  {
    key: "backtest",
    label: "回测",
    meta: "历史验证",
    description: "回测策略并对比历史表现。",
    icon: "query_stats"
  },
  {
    key: "insights",
    label: "观点",
    meta: "研究/复盘",
    description: "记录观点、研究与复盘笔记。",
    icon: "psychology"
  },
  {
    key: "alerts",
    label: "提醒",
    meta: "预警/到价",
    description: "集中管理交易提醒与到价预警。",
    icon: "notifications_active"
  },
  {
    key: "other",
    label: "其他",
    meta: "工具箱",
    description: "工具与实验功能入口。",
    icon: "more_horiz"
  },
  {
    key: "account",
    label: "账号",
    meta: "权限/锁定",
    description: "账号信息、权限与锁定管理。",
    icon: "manage_accounts"
  }
] as const;

export const portfolioTabs = [
  { key: "overview", label: "总览", icon: "dashboard", description: "资产、现金、估值与关键预警。" },
  { key: "holdings", label: "持仓", icon: "view_list", description: "当前持仓、成本与权重。" },
  { key: "trades", label: "交易", icon: "swap_horiz", description: "流水、现金流与对账。" },
  { key: "performance", label: "收益", icon: "timeline", description: "收益率与区间表现。" },
  { key: "risk", label: "风险", icon: "shield", description: "风险指标与回撤。" },
  { key: "allocation", label: "目标配置", icon: "tune", description: "目标权重与再平衡。" },
  { key: "corporate", label: "公司行为", icon: "corporate_fare", description: "分红、拆合股与事件追溯。" }
] as const;

export const otherTabs = [
  { key: "data-management", label: "数据管理", icon: "settings_suggest" },
  { key: "instrument-management", label: "标的管理", icon: "inventory_2" },
  { key: "data-status", label: "数据状态", icon: "monitoring" },
  { key: "test", label: "测试", icon: "science" }
] as const;

export const performanceRanges = [
  { key: "1M", label: "1M" },
  { key: "3M", label: "3M" },
  { key: "6M", label: "6M" },
  { key: "1Y", label: "1Y" },
  { key: "YTD", label: "YTD" },
  { key: "ALL", label: "全部" }
] as const;

export const analysisTabs: {
  key: AnalysisTab;
  label: string;
  icon: string;
  description: string;
}[] = [
  { key: "portfolio", label: "组合", icon: "pie_chart", description: "组合收益、贡献与风险的详细分析。" },
  { key: "instrument", label: "个股", icon: "candlestick_chart", description: "个股走势、指标与事件分析（待实现）。" },
  { key: "index", label: "指数", icon: "show_chart", description: "指数趋势、区间对比与成分分析（待实现）。" },
  { key: "sector", label: "板块", icon: "grid_view", description: "板块热度、走势与聚合对比（待实现）。" }
];

export const marketChartRanges = [
  { key: "1W", label: "1周" },
  { key: "1M", label: "1个月" },
  { key: "3M", label: "3个月" },
  { key: "6M", label: "6个月" },
  { key: "YTD", label: "年初至今" },
  { key: "1Y", label: "1年" },
  { key: "2Y", label: "2年" },
  { key: "5Y", label: "5年" },
  { key: "10Y", label: "10年" }
] as const;

export const schedulerTimezoneDefaults = [
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Singapore",
  "Asia/Tokyo",
  "America/New_York",
  "Europe/London",
  "UTC"
];

export const UNIVERSE_POOL_BUCKET_ORDER: UniversePoolBucketId[] = [
  "cn_a",
  "etf",
  "precious_metal"
];

export const emptyPositionForm: PositionFormState = {
  symbol: "",
  name: "",
  assetClass: "stock",
  market: "CN",
  currency: "CNY",
  quantity: "",
  cost: "",
  openDate: ""
};

export const emptyRiskForm: RiskFormState = {
  limitType: "position_weight",
  target: "",
  thresholdPct: ""
};

export const assetClassLabels: Record<AssetClass, string> = {
  stock: "股票",
  etf: "ETF",
  cash: "现金"
};

export const riskLimitTypeLabels: Record<RiskLimitType, string> = {
  position_weight: "持仓权重",
  asset_class_weight: "资产类别权重"
};

export const ledgerEventTypeLabels: Record<LedgerEventType, string> = {
  trade: "交易",
  cash: "现金流",
  fee: "费用（历史）",
  tax: "税费（历史）",
  dividend: "公司行为·分红",
  adjustment: "调整（历史）",
  corporate_action: "公司行为"
};

export const ledgerEventTypeOptions: { value: LedgerEventType; label: string }[] = [
  { value: "trade", label: ledgerEventTypeLabels.trade },
  { value: "cash", label: ledgerEventTypeLabels.cash },
  { value: "corporate_action", label: ledgerEventTypeLabels.corporate_action }
];

export const TARGET_POOL_STRUCTURE_EMPTY: TargetPoolStructureStats = {
  totalSymbols: 0,
  industryL1Count: 0,
  industryL2Count: 0,
  conceptCount: 0,
  unclassifiedCount: 0,
  classificationCoverage: null,
  allSymbols: [],
  classifiedSymbols: [],
  industryL1Details: [],
  industryL2Details: [],
  conceptDetails: [],
  unclassifiedSymbols: [],
  symbolNames: {},
  loading: false,
  error: null
};

export const CONTRIBUTION_TOP_N = 5;
export const HHI_WARN_THRESHOLD = 0.25;
