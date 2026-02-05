import {
  Component,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from "react";

import type {
  AccountSummary,
  AssetClass,
  CorporateActionKind,
  CorporateActionMeta,
  ContributionEntry,
  CreateLedgerEntryInput,
  CreatePositionInput,
  CreateRiskLimitInput,
  DataQualityLevel,
  InstrumentProfile,
  InstrumentProfileSummary,
  InstrumentKind,
  LedgerEntry,
  LedgerEntryMeta,
  LedgerEventType,
  LedgerSide,
  LedgerSource,
  MarketTargetsConfig,
  MarketQuote,
  MarketDailyBar,
  MarketDataQuality,
  MarketIngestRun,
  MarketTagSeriesResult,
  MarketTokenStatus,
  TempTargetSymbol,
  PerformanceMethod,
  PerformanceRangeKey,
  PreviewTargetsResult,
  Portfolio,
  PortfolioPerformanceRangeResult,
  PortfolioPerformanceSeries,
  PortfolioSnapshot,
  PositionValuation,
  RiskLimit,
  RiskSeriesMetrics,
  RiskLimitType,
  TagSummary,
  TagFacetTheme,
  WatchlistItem
} from "@mytrader/shared";

interface DashboardProps {
  account: AccountSummary;
  onLock: () => Promise<void>;
  onActivePortfolioChange?: (portfolio: { id: string | null; name: string | null }) => void;
}

interface PositionFormState {
  id?: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  market: string;
  currency: string;
  quantity: string;
  cost: string;
  openDate: string;
}

interface RiskFormState {
  id?: string;
  limitType: RiskLimitType;
  target: string;
  thresholdPct: string;
}

interface LedgerFormState {
  id?: string;
  eventType: LedgerEventType;
  tradeDate: string;
  eventTime: string;
  sequence: string;
  accountKey: string;
  instrumentId: string;
  symbol: string;
  side: LedgerSide | "";
  quantity: string;
  price: string;
  priceCurrency: string;
  cashAmount: string;
  cashCurrency: string;
  fee: string;
  tax: string;
  feeRate: string;
  taxRate: string;
  cashAmountAuto: boolean;
  note: string;
  source: LedgerSource;
  externalId: string;
  corporateKind: CorporateActionKindUi;
  corporateAfterShares: string;
}

type LedgerFilter = "all" | LedgerEventType;
type CorporateActionKindUi = CorporateActionKind | "dividend";
type MarketScope = "tags" | "holdings" | "search";
type MarketChartRangeKey =
  | "1D"
  | "1W"
  | "1M"
  | "3M"
  | "6M"
  | "YTD"
  | "1Y"
  | "2Y"
  | "5Y"
  | "10Y";

type MarketFilterMarket = "all" | "CN";

const emptyPositionForm: PositionFormState = {
  symbol: "",
  name: "",
  assetClass: "stock",
  market: "CN",
  currency: "CNY",
  quantity: "",
  cost: "",
  openDate: ""
};

const emptyRiskForm: RiskFormState = {
  limitType: "position_weight",
  target: "",
  thresholdPct: ""
};

const assetClassLabels: Record<AssetClass, string> = {
  stock: "股票",
  etf: "ETF",
  cash: "现金"
};

const riskLimitTypeLabels: Record<RiskLimitType, string> = {
  position_weight: "持仓权重",
  asset_class_weight: "资产类别权重"
};

const ledgerEventTypeLabels: Record<LedgerEventType, string> = {
  trade: "交易",
  cash: "现金流",
  fee: "费用（历史）",
  tax: "税费（历史）",
  dividend: "公司行为·分红",
  adjustment: "调整（历史）",
  corporate_action: "公司行为"
};

const ledgerEventTypeOptions: { value: LedgerEventType; label: string }[] = [
  { value: "trade", label: ledgerEventTypeLabels.trade },
  { value: "cash", label: ledgerEventTypeLabels.cash },
  { value: "corporate_action", label: ledgerEventTypeLabels.corporate_action }
];

const ledgerSideLabels: Record<LedgerSide, string> = {
  buy: "买入",
  sell: "卖出"
};

const ledgerSourceLabels: Record<LedgerSource, string> = {
  manual: "手动",
  csv: "文件导入",
  broker_import: "券商导入",
  system: "系统"
};

const DEFAULT_LEDGER_START_DATE = "2000-01-01";
const DEFAULT_LEDGER_END_DATE = "2099-12-31";

const MARKET_EXPLORER_WIDTH_STORAGE_KEY = "mytrader:market:explorerWidth";
const MARKET_EXPLORER_DEFAULT_WIDTH = 240;
const MARKET_EXPLORER_MIN_WIDTH = 220;
const MARKET_EXPLORER_MAX_WIDTH = 520;

const corporateActionKindLabels: Record<CorporateActionKindUi, string> = {
  split: "拆股",
  reverse_split: "合股",
  info: "信息",
  dividend: "分红"
};

const corporateActionCategoryLabels: Record<string, string> = {
  decision: "关键决策",
  org_change: "组织调整",
  policy_support: "政策支持",
  other: "其他"
};

const navItems = [
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
    label: "\u6307\u6570\u8ddf\u8e2a",
    meta: "\u6307\u6570/\u5bf9\u6807",
    description: "\u8ddf\u8e2a\u6838\u5fc3\u6307\u6570\u4e0e\u5bf9\u6807\u8d70\u52bf\u3002",
    icon: "track_changes"
  },
  {
    key: "data-analysis",
    label: "\u6570\u636e\u5206\u6790",
    meta: "\u5206\u6790/\u6d1e\u5bdf",
    description: "\u5bf9\u7ec4\u5408\u4e0e\u884c\u60c5\u8fdb\u884c\u6307\u6807\u5206\u6790\u3002",
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

const portfolioTabs = [
  { key: "overview", label: "总览", icon: "dashboard", description: "资产、现金、估值与关键预警。" },
  { key: "holdings", label: "持仓", icon: "view_list", description: "当前持仓、成本与权重。" },
  { key: "trades", label: "交易", icon: "swap_horiz", description: "流水、现金流与对账。" },
  { key: "performance", label: "收益", icon: "timeline", description: "收益率与区间表现。" },
  { key: "risk", label: "风险", icon: "shield", description: "风险指标与回撤。" },
  { key: "allocation", label: "目标配置", icon: "tune", description: "目标权重与再平衡。" },
  { key: "corporate", label: "公司行为", icon: "corporate_fare", description: "分红、拆合股与事件追溯。" }
] as const;

const otherTabs = [
  { key: "data-management", label: "数据管理", icon: "settings_suggest" },
  { key: "data-status", label: "数据状态", icon: "monitoring" },
  { key: "test", label: "测试", icon: "science" }
] as const;

const performanceRanges = [
  { key: "1M", label: "1M" },
  { key: "3M", label: "3M" },
  { key: "6M", label: "6M" },
  { key: "1Y", label: "1Y" },
  { key: "YTD", label: "YTD" },
  { key: "ALL", label: "\u5168\u90e8" }
] as const;

const marketChartRanges = [
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

const CONTRIBUTION_TOP_N = 5;
const HHI_WARN_THRESHOLD = 0.25;

type OtherTab = (typeof otherTabs)[number]["key"];

type WorkspaceView = (typeof navItems)[number]["key"];
type PortfolioTab = (typeof portfolioTabs)[number]["key"];

export function Dashboard({ account, onLock, onActivePortfolioChange }: DashboardProps) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [activePortfolioId, setActivePortfolioId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<WorkspaceView>("portfolio");
  const [otherTab, setOtherTab] = useState<OtherTab>("data-management");
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const navCollapsedBeforeMarketRef = useRef<boolean | null>(null);
  const navAutoCollapsedActiveRef = useRef(false);
  const [portfolioTab, setPortfolioTab] = useState<PortfolioTab>("overview");
  const [performanceRange, setPerformanceRange] = useState<PerformanceRangeKey>(
    "1Y"
  );
  const [performanceResult, setPerformanceResult] =
    useState<PortfolioPerformanceRangeResult | null>(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [performanceError, setPerformanceError] = useState<string | null>(null);
  const [showAllSymbolContribution, setShowAllSymbolContribution] =
    useState(false);
  const [showAllAssetContribution, setShowAllAssetContribution] =
    useState(false);
  const [riskAnnualized, setRiskAnnualized] = useState(true);

  const [portfolioName, setPortfolioName] = useState("");
  const [portfolioBaseCurrency, setPortfolioBaseCurrency] = useState("CNY");
  const [portfolioRename, setPortfolioRename] = useState("");

  const [positionForm, setPositionForm] = useState<PositionFormState>(
    emptyPositionForm
  );
  const [riskForm, setRiskForm] = useState<RiskFormState>(emptyRiskForm);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>("all");
  const [ledgerStartDate, setLedgerStartDate] = useState(
    DEFAULT_LEDGER_START_DATE
  );
  const [ledgerEndDate, setLedgerEndDate] = useState(DEFAULT_LEDGER_END_DATE);
  const [ledgerForm, setLedgerForm] = useState<LedgerFormState>(() =>
    createEmptyLedgerForm("CNY")
  );
  const [isLedgerFormOpen, setIsLedgerFormOpen] = useState(false);
  const [ledgerDeleteTarget, setLedgerDeleteTarget] = useState<LedgerEntry | null>(
    null
  );

  const [holdingsCsvPath, setHoldingsCsvPath] = useState<string | null>(null);
  const [pricesCsvPath, setPricesCsvPath] = useState<string | null>(null);

  const marketSearchTimerRef = useRef<number | null>(null);
  const marketSearchRequestIdRef = useRef(0);

  const [marketCatalogSyncing, setMarketCatalogSyncing] = useState(false);
  const [marketCatalogSyncSummary, setMarketCatalogSyncSummary] = useState<
    string | null
  >(null);

  const [marketSearchQuery, setMarketSearchQuery] = useState("");
  const [marketSearchResults, setMarketSearchResults] = useState<
    InstrumentProfileSummary[]
  >([]);
  const [marketSearchLoading, setMarketSearchLoading] = useState(false);

  const [marketScope, setMarketScope] = useState<MarketScope>("holdings");
  const [marketExplorerWidth, setMarketExplorerWidth] = useState<number>(() => {
    if (typeof window === "undefined" || !window.localStorage) {
      return MARKET_EXPLORER_DEFAULT_WIDTH;
    }
    try {
      const raw = window.localStorage.getItem(MARKET_EXPLORER_WIDTH_STORAGE_KEY);
      const value = raw ? Number(raw) : NaN;
      if (!Number.isFinite(value)) return MARKET_EXPLORER_DEFAULT_WIDTH;
      return clampNumber(value, MARKET_EXPLORER_MIN_WIDTH, MARKET_EXPLORER_MAX_WIDTH);
    } catch {
      return MARKET_EXPLORER_DEFAULT_WIDTH;
    }
  });
  const marketExplorerResizeRef = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
  } | null>(null);

  const [marketTags, setMarketTags] = useState<TagSummary[]>([]);
  const [marketTagsLoading, setMarketTagsLoading] = useState(false);
  const [marketTagPickerOpen, setMarketTagPickerOpen] = useState(false);
  const [marketTagPickerQuery, setMarketTagPickerQuery] = useState("");

  const [marketSelectedTag, setMarketSelectedTag] = useState<string | null>(null);
  const [marketTagMembers, setMarketTagMembers] = useState<string[]>([]);
  const [marketTagMembersLoading, setMarketTagMembersLoading] = useState(false);

  const [marketFiltersOpen, setMarketFiltersOpen] = useState(false);
  const [marketFilterMarket, setMarketFilterMarket] =
    useState<MarketFilterMarket>("all");
  const [marketFilterAssetClasses, setMarketFilterAssetClasses] = useState<
    AssetClass[]
  >([]);
  const [marketFilterKinds, setMarketFilterKinds] = useState<InstrumentKind[]>(
    []
  );

  const [marketQuotesBySymbol, setMarketQuotesBySymbol] = useState<
    Record<string, MarketQuote>
  >({});
  const [marketQuotesLoading, setMarketQuotesLoading] = useState(false);

  const [marketChartRange, setMarketChartRange] =
    useState<MarketChartRangeKey>("6M");
  const [marketChartBars, setMarketChartBars] = useState<MarketDailyBar[]>([]);
  const [marketChartLoading, setMarketChartLoading] = useState(false);
  const [marketVolumeMode, setMarketVolumeMode] = useState<
    "volume" | "moneyflow"
  >("volume");

  const [marketDemoSeeding, setMarketDemoSeeding] = useState(false);

  const marketTagSeriesRequestIdRef = useRef(0);
  const [marketTagSeriesResult, setMarketTagSeriesResult] =
    useState<MarketTagSeriesResult | null>(null);
  const [marketTagSeriesBars, setMarketTagSeriesBars] = useState<
    MarketDailyBar[]
  >([]);
  const [marketTagSeriesLoading, setMarketTagSeriesLoading] = useState(false);
  const [marketTagSeriesError, setMarketTagSeriesError] = useState<string | null>(
    null
  );
  const [marketTagChartHoverDate, setMarketTagChartHoverDate] = useState<
    string | null
  >(null);
  const [marketTagChartHoverPrice, setMarketTagChartHoverPrice] = useState<
    number | null
  >(null);

  const [marketInstrumentDetailsOpen, setMarketInstrumentDetailsOpen] =
    useState(false);
  const [marketTagMembersModalOpen, setMarketTagMembersModalOpen] =
    useState(false);
  const [marketTokenStatus, setMarketTokenStatus] =
    useState<MarketTokenStatus | null>(null);
  const [marketTokenDraft, setMarketTokenDraft] = useState("");
  const [marketTokenProvider, setMarketTokenProvider] = useState("tushare");
  const [marketTokenSaving, setMarketTokenSaving] = useState(false);
  const [marketTokenTesting, setMarketTokenTesting] = useState(false);
  const [marketIngestRuns, setMarketIngestRuns] = useState<MarketIngestRun[]>([]);
  const [marketIngestRunsLoading, setMarketIngestRunsLoading] = useState(false);
  const [marketIngestTriggering, setMarketIngestTriggering] = useState(false);

  const latestMarketIngestRun = useMemo(() => {
    if (marketIngestRuns.length === 0) return null;
    return marketIngestRuns.reduce((latest, candidate) =>
      candidate.startedAt > latest.startedAt ? candidate : latest
    );
  }, [marketIngestRuns]);

  const [marketSelectedSymbol, setMarketSelectedSymbol] = useState<string | null>(
    null
  );
  const [marketSelectedProfile, setMarketSelectedProfile] =
    useState<InstrumentProfile | null>(null);
  const marketSelectedIndustry = marketSelectedProfile?.tagFacets?.industry ?? [];
  const marketSelectedThemes = marketSelectedProfile?.tagFacets?.themes ?? [];
  const [marketSelectedUserTags, setMarketSelectedUserTags] = useState<string[]>(
    []
  );
  const marketSelectedManualThemes = useMemo(
    () => marketSelectedUserTags.filter((tag) => tag.startsWith("theme:manual:")),
    [marketSelectedUserTags]
  );
  const marketSelectedPlainUserTags = useMemo(
    () => marketSelectedUserTags.filter((tag) => !tag.startsWith("theme:manual:")),
    [marketSelectedUserTags]
  );
  const [marketUserTagDraft, setMarketUserTagDraft] = useState("");
  const [marketShowProviderData, setMarketShowProviderData] = useState(false);
  const [marketManualThemeOptions, setMarketManualThemeOptions] = useState<
    PopoverSelectOption[]
  >([]);
  const [marketManualThemeLoading, setMarketManualThemeLoading] = useState(false);
  const [marketManualThemeDraft, setMarketManualThemeDraft] = useState("");

  const [marketWatchlistItems, setMarketWatchlistItems] = useState<
    WatchlistItem[]
  >([]);
  const [marketWatchlistLoading, setMarketWatchlistLoading] = useState(false);
  const [marketWatchlistGroupDraft, setMarketWatchlistGroupDraft] = useState("");

  const [marketTargetsConfig, setMarketTargetsConfig] =
    useState<MarketTargetsConfig>(() => ({
      includeHoldings: true,
      includeRegistryAutoIngest: true,
      includeWatchlist: true,
      portfolioIds: null,
      explicitSymbols: [],
      tagFilters: []
    }));
  const [marketTargetsPreview, setMarketTargetsPreview] =
    useState<PreviewTargetsResult | null>(null);
  const [marketTargetsLoading, setMarketTargetsLoading] = useState(false);
  const [marketTargetsSaving, setMarketTargetsSaving] = useState(false);
  const [marketTargetsSymbolDraft, setMarketTargetsSymbolDraft] = useState("");
  const [marketTargetsTagDraft, setMarketTargetsTagDraft] = useState("");
  const [marketTempTargets, setMarketTempTargets] = useState<TempTargetSymbol[]>([]);
  const [marketTempTargetsLoading, setMarketTempTargetsLoading] = useState(false);

  const autoIngestScopeValue = useMemo(() => {
    const { includeHoldings, includeWatchlist, includeRegistryAutoIngest } =
      marketTargetsConfig;
    if (includeHoldings && includeWatchlist && includeRegistryAutoIngest) {
      return "holdings+watchlist+registry";
    }
    if (includeHoldings && includeWatchlist && !includeRegistryAutoIngest) {
      return "holdings+watchlist";
    }
    if (includeHoldings && !includeWatchlist && includeRegistryAutoIngest) {
      return "holdings+registry";
    }
    if (!includeHoldings && includeWatchlist && includeRegistryAutoIngest) {
      return "watchlist+registry";
    }
    if (includeHoldings && !includeWatchlist && !includeRegistryAutoIngest) {
      return "holdings";
    }
    if (!includeHoldings && includeWatchlist && !includeRegistryAutoIngest) {
      return "watchlist";
    }
    if (!includeHoldings && !includeWatchlist && includeRegistryAutoIngest) {
      return "registry";
    }
    return "holdings+watchlist+registry";
  }, [marketTargetsConfig]);

  const handleChangeAutoIngestScope = useCallback((value: string) => {
    const next = {
      includeHoldings: false,
      includeWatchlist: false,
      includeRegistryAutoIngest: false
    };
    switch (value) {
      case "holdings+watchlist+registry":
        next.includeHoldings = true;
        next.includeWatchlist = true;
        next.includeRegistryAutoIngest = true;
        break;
      case "holdings+watchlist":
        next.includeHoldings = true;
        next.includeWatchlist = true;
        break;
      case "holdings+registry":
        next.includeHoldings = true;
        next.includeRegistryAutoIngest = true;
        break;
      case "watchlist+registry":
        next.includeWatchlist = true;
        next.includeRegistryAutoIngest = true;
        break;
      case "holdings":
        next.includeHoldings = true;
        break;
      case "watchlist":
        next.includeWatchlist = true;
        break;
      case "registry":
        next.includeRegistryAutoIngest = true;
        break;
      default:
        next.includeHoldings = true;
        next.includeWatchlist = true;
        next.includeRegistryAutoIngest = true;
    }
    setMarketTargetsConfig((prev) => ({
      ...prev,
      ...next
    }));
  }, []);

  const [marketChartHoverDate, setMarketChartHoverDate] = useState<string | null>(
    null
  );
  const [marketChartHoverPrice, setMarketChartHoverPrice] = useState<
    number | null
  >(null);

  useEffect(() => {
    setMarketChartHoverDate(null);
    setMarketChartHoverPrice(null);
  }, [marketSelectedSymbol]);

  useEffect(() => {
    setMarketTagChartHoverDate(null);
    setMarketTagChartHoverPrice(null);
  }, [marketSelectedTag, marketChartRange]);

  const activePortfolio = useMemo(
    () => portfolios.find((portfolio) => portfolio.id === activePortfolioId) ?? null,
    [portfolios, activePortfolioId]
  );

  useEffect(() => {
    if (!onActivePortfolioChange) return;
    onActivePortfolioChange({
      id: activePortfolio?.id ?? null,
      name: activePortfolio?.name ?? null
    });
  }, [activePortfolio?.id, activePortfolio?.name, onActivePortfolioChange]);

  const marketHoldingsSymbols = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.positions
      .filter((pos) => pos.position.assetClass !== "cash")
      .map((pos) => pos.position.symbol)
      .filter(Boolean);
  }, [snapshot]);

  const marketHoldingsMetaBySymbol = useMemo(() => {
    const map = new Map<
      string,
      { assetClass: AssetClass | null; market: string | null }
    >();
    snapshot?.positions.forEach((pos) => {
      if (pos.position.assetClass === "cash") return;
      const symbol = pos.position.symbol;
      if (!symbol) return;
      map.set(symbol, {
        assetClass: pos.position.assetClass ?? null,
        market: pos.position.market ?? null
      });
    });
    return map;
  }, [snapshot]);

  const marketHoldingsSymbolsFiltered = useMemo(() => {
    return marketHoldingsSymbols.filter((symbol) => {
      const meta = marketHoldingsMetaBySymbol.get(symbol) ?? null;
      if (marketFilterMarket !== "all") {
        if (!meta?.market || meta.market !== marketFilterMarket) return false;
      }
      if (marketFilterAssetClasses.length > 0) {
        if (!meta?.assetClass) return false;
        if (!marketFilterAssetClasses.includes(meta.assetClass)) return false;
      }
      return true;
    });
  }, [
    marketFilterAssetClasses,
    marketFilterMarket,
    marketHoldingsMetaBySymbol,
    marketHoldingsSymbols
  ]);

  const marketSelectedQuote = useMemo(() => {
    if (!marketSelectedSymbol) return null;
    return marketQuotesBySymbol[marketSelectedSymbol] ?? null;
  }, [marketQuotesBySymbol, marketSelectedSymbol]);

  const marketBarsByDate = useMemo(() => {
    const map = new Map<string, MarketDailyBar>();
    marketChartBars.forEach((bar) => {
      map.set(bar.date, bar);
    });
    return map;
  }, [marketChartBars]);

  const marketActiveVolume = useMemo(() => {
    if (!marketChartHoverDate) return null;
    const bar = marketBarsByDate.get(marketChartHoverDate) ?? null;
    return bar?.volume ?? null;
  }, [marketBarsByDate, marketChartHoverDate]);

  const marketActiveMoneyflowVol = useMemo(() => {
    if (!marketChartHoverDate) return null;
    const bar = marketBarsByDate.get(marketChartHoverDate) ?? null;
    const value = bar?.netMfVol ?? null;
    return value !== null && Number.isFinite(value) ? value : null;
  }, [marketBarsByDate, marketChartHoverDate]);

  const marketActiveMoneyflowRatio = useMemo(() => {
    if (!marketChartHoverDate) return null;
    const bar = marketBarsByDate.get(marketChartHoverDate) ?? null;
    const volume = bar?.volume ?? null;
    const mf = bar?.netMfVol ?? null;
    if (
      volume === null ||
      !Number.isFinite(volume) ||
      volume <= 0 ||
      mf === null ||
      !Number.isFinite(mf)
    ) {
      return null;
    }
    return Math.abs(mf) / volume;
  }, [marketBarsByDate, marketChartHoverDate]);

  const marketNameBySymbol = useMemo(() => {
    const map = new Map<string, string>();
    snapshot?.positions.forEach((pos) => {
      const symbol = pos.position.symbol;
      if (symbol) map.set(symbol, pos.position.name ?? symbol);
    });
    marketWatchlistItems.forEach((item) => {
      map.set(item.symbol, item.name ?? item.symbol);
    });
    marketSearchResults.forEach((item) => {
      map.set(item.symbol, item.name ?? item.symbol);
    });
    if (marketSelectedProfile) {
      map.set(
        marketSelectedProfile.symbol,
        marketSelectedProfile.name ?? marketSelectedProfile.symbol
      );
    }
    return map;
  }, [marketSearchResults, marketSelectedProfile, marketWatchlistItems, snapshot]);

  const marketListFilter = marketSearchQuery.trim().toLowerCase();
  const marketEffectiveScope: MarketScope =
    marketListFilter.length > 0 ? "search" : marketScope;
  const marketCollectionSelectValue = useMemo(() => {
    if (marketScope === "holdings") return "builtin:holdings";
    if (marketScope === "tags") {
      if (marketSelectedTag === "watchlist:all") return "builtin:watchlist";
      if (marketSelectedTag) return `tag:${marketSelectedTag}`;
    }
    return "builtin:holdings";
  }, [marketScope, marketSelectedTag]);

  const marketSearchResultsFiltered = useMemo(() => {
    return marketSearchResults.filter((item) => {
      if (marketFilterMarket !== "all") {
        if (!item.market || item.market !== marketFilterMarket) return false;
      }
      if (marketFilterKinds.length > 0) {
        if (!marketFilterKinds.includes(item.kind)) return false;
      }
      if (marketFilterAssetClasses.length > 0) {
        if (!item.assetClass) return false;
        if (!marketFilterAssetClasses.includes(item.assetClass)) return false;
      }
      return true;
    });
  }, [marketFilterAssetClasses, marketFilterKinds, marketFilterMarket, marketSearchResults]);

  const marketCurrentListSymbols = useMemo(() => {
    if (marketEffectiveScope === "holdings") return marketHoldingsSymbolsFiltered;
    if (marketEffectiveScope === "search")
      return marketSearchResults.map((item) => item.symbol);
    if (marketEffectiveScope === "tags") return marketSelectedTag ? marketTagMembers : [];
    return [];
  }, [
    marketHoldingsSymbolsFiltered,
    marketEffectiveScope,
    marketSearchResults,
    marketSelectedTag,
    marketTagMembers
  ]);

  const marketFilteredListSymbols = useMemo(() => {
    if (!marketListFilter || marketEffectiveScope === "search") return marketCurrentListSymbols;
    return marketCurrentListSymbols.filter((symbol) => {
      const name = marketNameBySymbol.get(symbol) ?? "";
      return (
        symbol.toLowerCase().includes(marketListFilter) ||
        name.toLowerCase().includes(marketListFilter)
      );
    });
  }, [marketCurrentListSymbols, marketListFilter, marketNameBySymbol, marketEffectiveScope]);

  const marketSelectedTagAggregate = useMemo(() => {
    if (!marketSelectedTag) return null;
    return computeTagAggregate(marketTagMembers, marketQuotesBySymbol);
  }, [marketQuotesBySymbol, marketSelectedTag, marketTagMembers]);

  const marketSelectedTagSeriesReturnPct = useMemo(() => {
    const closes = marketTagSeriesBars
      .map((bar) => bar.close)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    if (closes.length < 2) return null;
    const first = closes[0];
    const last = closes[closes.length - 1];
    if (first === 0) return null;
    return (last - first) / first;
  }, [marketTagSeriesBars]);

  const marketSelectedTagSeriesTone = useMemo(() => {
    return getCnChangeTone(marketSelectedTagSeriesReturnPct);
  }, [marketSelectedTagSeriesReturnPct]);

  const marketTagSeriesLatestCoverageLabel = useMemo(() => {
    const points = marketTagSeriesResult?.points ?? [];
    if (points.length === 0) return "--";
    const last = points[points.length - 1];
    return `覆盖 ${last.includedCount}/${last.totalCount}`;
  }, [marketTagSeriesResult]);

  const marketFiltersActiveCount = useMemo(() => {
    let count = 0;
    if (marketFilterMarket !== "all") count += 1;
    if (marketFilterAssetClasses.length > 0) count += 1;
    if (marketFilterKinds.length > 0) count += 1;
    return count;
  }, [marketFilterAssetClasses, marketFilterKinds, marketFilterMarket]);

  const marketLatestBar = useMemo(() => {
    for (let idx = marketChartBars.length - 1; idx >= 0; idx -= 1) {
      const bar = marketChartBars[idx];
      if (bar.close !== null) return bar;
    }
    return null;
  }, [marketChartBars]);

  const marketChartHasEnoughData = useMemo(() => {
    let count = 0;
    for (const bar of marketChartBars) {
      const close = bar.close;
      if (close !== null && Number.isFinite(close)) count += 1;
      if (count >= 2) return true;
    }
    return false;
  }, [marketChartBars]);

  const marketRangeSummary = useMemo(() => {
    const closes = marketChartBars
      .map((bar) => bar.close)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const highs = marketChartBars
      .map((bar) => bar.high)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const lows = marketChartBars
      .map((bar) => bar.low)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const volumes = marketChartBars
      .map((bar) => bar.volume)
      .filter((value): value is number => value !== null && Number.isFinite(value));

    const firstClose = closes.length > 0 ? closes[0] : null;
    const lastClose = closes.length > 0 ? closes[closes.length - 1] : null;
    const rangeReturn =
      firstClose !== null && lastClose !== null && firstClose !== 0
        ? (lastClose - firstClose) / firstClose
        : null;

    const rangeHigh = highs.length > 0 ? Math.max(...highs) : null;
    const rangeLow = lows.length > 0 ? Math.min(...lows) : null;
    const avgVolume =
      volumes.length > 0
        ? volumes.reduce((sum, value) => sum + value, 0) / volumes.length
        : null;

    return { rangeHigh, rangeLow, avgVolume, rangeReturn };
  }, [marketChartBars]);

  const marketSelectedPositionValuation = useMemo(() => {
    if (!snapshot || !marketSelectedSymbol) return null;
    return (
      snapshot.positions.find((pos) => pos.position.symbol === marketSelectedSymbol) ??
      null
    );
  }, [marketSelectedSymbol, snapshot]);

  const marketHoldingUnitCost = useMemo(() => {
    if (!marketSelectedSymbol) return null;
    const position = marketSelectedPositionValuation?.position ?? null;
    if (!position || position.quantity <= 0) return null;

    const direct = position.cost;
    if (direct !== null && Number.isFinite(direct) && direct > 0) return direct;

    const fifo = computeFifoUnitCost(ledgerEntries, marketSelectedSymbol);
    if (fifo !== null && Number.isFinite(fifo) && fifo > 0) return fifo;
    return null;
  }, [ledgerEntries, marketSelectedPositionValuation, marketSelectedSymbol]);

  const marketTargetPrice = useMemo(() => {
    return parseTargetPriceFromTags(marketSelectedUserTags);
  }, [marketSelectedUserTags]);

  const cashTotal = useMemo(() => {
    if (!snapshot) return 0;
    return snapshot.positions.reduce((sum, valuation) => {
      if (valuation.position.assetClass !== "cash") return sum;
      return sum + (valuation.marketValue ?? valuation.position.quantity);
    }, 0);
  }, [snapshot]);

  const performance = performanceResult?.performance ?? null;
  const performanceSeries = performanceResult?.series ?? null;
  const performanceAnalysis = performanceResult?.analysis ?? null;
  const contributionBreakdown = performanceAnalysis?.contributions ?? null;
  const riskMetrics = performanceAnalysis?.riskMetrics ?? null;
  const dataQuality = snapshot?.dataQuality ?? null;
  const hhiValue = useMemo(() => {
    if (!snapshot) return null;
    return snapshot.exposures.bySymbol.reduce((sum, entry) => {
      return sum + entry.weight * entry.weight;
    }, 0);
  }, [snapshot]);
  const filteredLedgerEntries = useMemo(() => {
    let entries = ledgerEntries;
    if (ledgerFilter !== "all") {
      entries = entries.filter((entry) => {
        if (ledgerFilter === "corporate_action") {
          return (
            entry.eventType === "corporate_action" ||
            entry.eventType === "dividend"
          );
        }
        return entry.eventType === ledgerFilter;
      });
    }
    if (ledgerStartDate) {
      entries = entries.filter((entry) => entry.tradeDate >= ledgerStartDate);
    }
    if (ledgerEndDate) {
      entries = entries.filter((entry) => entry.tradeDate <= ledgerEndDate);
    }
    return entries;
  }, [ledgerEntries, ledgerFilter, ledgerStartDate, ledgerEndDate]);
  const cashFlowTotals = useMemo(() => {
    const totals = new Map<string, number>();
    filteredLedgerEntries.forEach((entry) => {
      if (entry.cashAmount === null || !entry.cashCurrency) return;
      totals.set(
        entry.cashCurrency,
        (totals.get(entry.cashCurrency) ?? 0) + entry.cashAmount
      );
    });
    return Array.from(totals.entries()).map(([currency, amount]) => ({
      currency,
      amount
    }));
  }, [filteredLedgerEntries]);

  const ledgerDeleteSummary = useMemo(() => {
    if (!ledgerDeleteTarget) return "";
    const symbolLabel =
      ledgerDeleteTarget.symbol ??
      ledgerDeleteTarget.instrumentId ??
      "\u65e0\u6807\u7684";
    return `${formatLedgerEventType(ledgerDeleteTarget.eventType)} · ${ledgerDeleteTarget.tradeDate} · ${symbolLabel}`;
  }, [ledgerDeleteTarget]);
  const toastMessage = useMemo(() => {
    if (error) return sanitizeToastMessage(error);
    return notice ?? "";
  }, [error, notice]);

  const selectedPerformance = useMemo(() => {
    if (!performance) return null;
    if (performance.selectedMethod === "twr") {
      return performance.twr;
    }
    if (performance.selectedMethod === "mwr") {
      return performance.mwr;
    }
    return null;
  }, [performance]);

  const loadPortfolios = useCallback(
    async (preferredId?: string | null) => {
      if (!window.mytrader) {
        setError("未检测到桌面端后端接口。");
        return;
      }
      const list = await window.mytrader.portfolio.list();
      setPortfolios(list);
      const nextId = preferredId ?? list[0]?.id ?? null;
      setActivePortfolioId(nextId);
      if (nextId) {
        const selected = list.find((item) => item.id === nextId);
        setPortfolioRename(selected?.name ?? "");
      }
    },
    []
  );

  const loadSnapshot = useCallback(async (portfolioId: string) => {
    if (!window.mytrader) {
      setError("未检测到桌面端后端接口。");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await window.mytrader.portfolio.getSnapshot(portfolioId);
      setSnapshot(data);
    } catch (err) {
      setError(toUserErrorMessage(err));
      setSnapshot(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadLedgerEntries = useCallback(async (portfolioId: string) => {
    if (!window.mytrader) {
      setLedgerError("未检测到桌面端后端接口。");
      return;
    }
    setLedgerLoading(true);
    setLedgerError(null);
    try {
      const entries = await window.mytrader.ledger.list(portfolioId);
      setLedgerEntries(entries);
    } catch (err) {
      setLedgerError(toUserErrorMessage(err));
    } finally {
      setLedgerLoading(false);
    }
  }, []);

  const loadPerformance = useCallback(
    async (portfolioId: string, range: PerformanceRangeKey) => {
      if (!window.mytrader) {
        setPerformanceError("未检测到桌面端后端接口。");
        return;
      }
      setPerformanceLoading(true);
      setPerformanceError(null);
      try {
        const data = await window.mytrader.portfolio.getPerformance({
          portfolioId,
          range
        });
        setPerformanceResult(data);
      } catch (err) {
        setPerformanceError(toUserErrorMessage(err));
        setPerformanceResult(null);
      } finally {
        setPerformanceLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadPortfolios().catch((err) => setError(toUserErrorMessage(err)));
  }, [loadPortfolios]);

  useEffect(() => {
    if (!activePortfolioId) {
      setSnapshot(null);
      return;
    }
    loadSnapshot(activePortfolioId).catch((err) =>
      setError(toUserErrorMessage(err))
    );
  }, [activePortfolioId, loadSnapshot]);

  useEffect(() => {
    if (!activePortfolioId) {
      setPerformanceResult(null);
      return;
    }
    if (portfolioTab !== "performance" && portfolioTab !== "risk") return;
    loadPerformance(activePortfolioId, performanceRange).catch((err) =>
      setPerformanceError(toUserErrorMessage(err))
    );
  }, [activePortfolioId, loadPerformance, performanceRange, portfolioTab]);

  useEffect(() => {
    if (!activePortfolioId) {
      setLedgerEntries([]);
      return;
    }
    if (portfolioTab !== "trades") return;
    loadLedgerEntries(activePortfolioId).catch((err) =>
      setLedgerError(toUserErrorMessage(err))
    );
  }, [activePortfolioId, loadLedgerEntries, portfolioTab]);

  useEffect(() => {
    if (!activePortfolio) return;
    setPortfolioRename(activePortfolio.name);
  }, [activePortfolio]);

  useEffect(() => {
    if (!activePortfolio) {
      setLedgerForm(createEmptyLedgerForm("CNY"));
      setIsLedgerFormOpen(false);
      setLedgerDeleteTarget(null);
      setLedgerStartDate(DEFAULT_LEDGER_START_DATE);
      setLedgerEndDate(DEFAULT_LEDGER_END_DATE);
      return;
    }
    setLedgerForm(createEmptyLedgerForm(activePortfolio.baseCurrency));
    setLedgerFilter("all");
    setIsLedgerFormOpen(false);
    setLedgerDeleteTarget(null);
    setLedgerStartDate(DEFAULT_LEDGER_START_DATE);
    setLedgerEndDate(DEFAULT_LEDGER_END_DATE);
  }, [activePortfolio?.id, activePortfolio?.baseCurrency]);

  useEffect(() => {
    if (activeView === "market") {
      if (!navAutoCollapsedActiveRef.current) {
        navCollapsedBeforeMarketRef.current = isNavCollapsed;
        navAutoCollapsedActiveRef.current = true;
      }
      setIsNavCollapsed(true);
      return;
    }

    if (navAutoCollapsedActiveRef.current) {
      navAutoCollapsedActiveRef.current = false;
      const previous = navCollapsedBeforeMarketRef.current;
      navCollapsedBeforeMarketRef.current = null;
      if (previous !== null) setIsNavCollapsed(previous);
    }
  }, [activeView]);

  useEffect(() => {
    if (activeView === "market") return;
    setMarketInstrumentDetailsOpen(false);
    setMarketTagMembersModalOpen(false);
  }, [activeView]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      window.localStorage.setItem(
        MARKET_EXPLORER_WIDTH_STORAGE_KEY,
        String(marketExplorerWidth)
      );
    } catch {
      // ignore
    }
  }, [marketExplorerWidth]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleMove = (event: PointerEvent) => {
      const state = marketExplorerResizeRef.current;
      if (!state) return;
      const delta = event.clientX - state.startX;
      const nextWidth = clampNumber(
        state.startWidth + delta,
        MARKET_EXPLORER_MIN_WIDTH,
        MARKET_EXPLORER_MAX_WIDTH
      );
      setMarketExplorerWidth(nextWidth);
    };

    const stop = () => {
      if (!marketExplorerResizeRef.current) return;
      marketExplorerResizeRef.current = null;
      document.body.style.userSelect = "";
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      document.body.style.userSelect = "";
    };
  }, []);

  useEffect(() => {
    if (activeView === "portfolio") {
      setPortfolioTab("overview");
    }
  }, [activeView]);

  useEffect(() => {
    setShowAllSymbolContribution(false);
    setShowAllAssetContribution(false);
  }, [performanceRange, activePortfolioId]);

  useEffect(() => {
    if (!error && !notice) return;
    const timer = window.setTimeout(() => {
      setError(null);
      setNotice(null);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [error, notice]);

  const handleCreatePortfolio = useCallback(async () => {
    if (!window.mytrader) return;
    setError(null);
    setNotice(null);
    const name = portfolioName.trim();
    if (!name) {
      setError("请输入组合名称。");
      return;
    }
    const created = await window.mytrader.portfolio.create({
      name,
      baseCurrency: portfolioBaseCurrency.trim() || "CNY"
    });
    setPortfolioName("");
    setPortfolioBaseCurrency("CNY");
    await loadPortfolios(created.id);
    setNotice(`组合已创建：${created.name}。`);
  }, [portfolioName, portfolioBaseCurrency, loadPortfolios]);

  const handleRenamePortfolio = useCallback(async () => {
    if (!window.mytrader || !activePortfolio) return;
    setError(null);
    setNotice(null);
    const name = portfolioRename.trim();
    if (!name) {
      setError("请输入组合名称。");
      return;
    }
    const updated = await window.mytrader.portfolio.update({
      id: activePortfolio.id,
      name,
      baseCurrency: activePortfolio.baseCurrency
    });
    await loadPortfolios(updated.id);
    setNotice(`组合已重命名为：${updated.name}。`);
  }, [activePortfolio, portfolioRename, loadPortfolios]);

  const handleDeletePortfolio = useCallback(async () => {
    if (!window.mytrader || !activePortfolio) return;
    setError(null);
    setNotice(null);
    await window.mytrader.portfolio.remove(activePortfolio.id);
    await loadPortfolios();
    setNotice("组合已删除。");
  }, [activePortfolio, loadPortfolios]);

  const handleEditPosition = useCallback((position: PositionValuation) => {
    setPositionForm({
      id: position.position.id,
      symbol: position.position.symbol,
      name: position.position.name ?? "",
      assetClass: position.position.assetClass,
      market: position.position.market,
      currency: position.position.currency,
      quantity: String(position.position.quantity),
      cost: position.position.cost?.toString() ?? "",
      openDate: position.position.openDate ?? ""
    });
  }, []);

  const handleCancelEditPosition = useCallback(() => {
    setPositionForm(emptyPositionForm);
  }, []);

  const handleSubmitPosition = useCallback(async () => {
    if (!window.mytrader || !activePortfolio) return;
    setError(null);
    setNotice(null);

    const quantity = Number(positionForm.quantity);
    const costValue = positionForm.cost ? Number(positionForm.cost) : null;
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("数量必须大于 0。");
      return;
    }
    if (positionForm.cost && !Number.isFinite(costValue)) {
      setError("成本必须是数字。");
      return;
    }
    if (!positionForm.symbol.trim()) {
      setError("请输入代码。");
      return;
    }
    if (!positionForm.market.trim() || !positionForm.currency.trim()) {
      setError("请输入市场与币种。");
      return;
    }

    const payload: CreatePositionInput = {
      portfolioId: activePortfolio.id,
      symbol: positionForm.symbol.trim(),
      name: positionForm.name.trim() || null,
      assetClass: positionForm.assetClass,
      market: positionForm.market.trim(),
      currency: positionForm.currency.trim(),
      quantity,
      cost: costValue,
      openDate: positionForm.openDate.trim() || null
    };

    if (positionForm.id) {
      await window.mytrader.position.update({ ...payload, id: positionForm.id });
      setNotice("持仓已更新。");
    } else {
      await window.mytrader.position.create(payload);
      setNotice("持仓已新增。");
    }

    setPositionForm(emptyPositionForm);
    await loadSnapshot(activePortfolio.id);
  }, [activePortfolio, positionForm, loadSnapshot]);

  const handleDeletePosition = useCallback(
    async (positionId: string) => {
      if (!window.mytrader || !activePortfolio) return;
      setError(null);
      setNotice(null);
      await window.mytrader.position.remove(positionId);
      await loadSnapshot(activePortfolio.id);
      setNotice("持仓已删除。");
    },
    [activePortfolio, loadSnapshot]
  );

  const handleEditRiskLimit = useCallback((limit: RiskLimit) => {
    setRiskForm({
      id: limit.id,
      limitType: limit.limitType,
      target: limit.target,
      thresholdPct: (limit.threshold * 100).toFixed(2)
    });
  }, []);

  const handleCancelRiskEdit = useCallback(() => {
    setRiskForm(emptyRiskForm);
  }, []);

  const handleSubmitRiskLimit = useCallback(async () => {
    if (!window.mytrader || !activePortfolio) return;
    setError(null);
    setNotice(null);

    const threshold = Number(riskForm.thresholdPct) / 100;
    if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
      setError("阈值必须在 0 到 100 之间。");
      return;
    }
    if (!riskForm.target.trim()) {
      setError("请输入目标。");
      return;
    }

    const payload: CreateRiskLimitInput = {
      portfolioId: activePortfolio.id,
      limitType: riskForm.limitType,
      target: riskForm.target.trim(),
      threshold
    };

    if (riskForm.id) {
      await window.mytrader.risk.update({ ...payload, id: riskForm.id });
      setNotice("风险限额已更新。");
    } else {
      await window.mytrader.risk.create(payload);
      setNotice("风险限额已新增。");
    }

    setRiskForm(emptyRiskForm);
    await loadSnapshot(activePortfolio.id);
  }, [activePortfolio, riskForm, loadSnapshot]);

  const handleDeleteRiskLimit = useCallback(
    async (riskLimitId: string) => {
      if (!window.mytrader || !activePortfolio) return;
      setError(null);
      setNotice(null);
      await window.mytrader.risk.remove(riskLimitId);
      await loadSnapshot(activePortfolio.id);
      setNotice("风险限额已删除。");
    },
    [activePortfolio, loadSnapshot]
  );

  const updateLedgerForm = useCallback((patch: Partial<LedgerFormState>) => {
    setLedgerForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleOpenLedgerForm = useCallback(() => {
    if (!activePortfolio) return;
    setLedgerForm(createEmptyLedgerForm(activePortfolio.baseCurrency));
    setIsLedgerFormOpen(true);
  }, [activePortfolio]);

  const handleEditLedgerEntry = useCallback((entry: LedgerEntry) => {
    const storedRates = loadStoredRates(entry.eventType);
    const derivedFeeRate = deriveRateValue(entry.fee, entry.quantity, entry.price);
    const derivedTaxRate = deriveRateValue(entry.tax, entry.quantity, entry.price);
    const isDividendEntry = entry.eventType === "dividend";
    const corporateMeta = isCorporateActionMeta(entry.meta) ? entry.meta : null;
    const corporateAfterShares =
      !isDividendEntry && corporateMeta && corporateMeta.kind !== "info"
        ? formatCorporateAfterShares(corporateMeta.numerator, corporateMeta.denominator)
        : "";
    setLedgerForm({
      id: entry.id,
      eventType: isDividendEntry ? "corporate_action" : entry.eventType,
      tradeDate: entry.tradeDate,
      eventTime: formatDateTimeInput(entry.eventTs),
      sequence: entry.sequence?.toString() ?? "",
      accountKey: entry.accountKey ?? "",
      instrumentId: entry.instrumentId ?? "",
      symbol: entry.symbol ?? "",
      side: entry.side ?? "",
      quantity: entry.quantity?.toString() ?? "",
      price: entry.price?.toString() ?? "",
      priceCurrency: entry.priceCurrency ?? "",
      cashAmount: entry.cashAmount?.toString() ?? "",
      cashCurrency: entry.cashCurrency ?? "",
      fee: entry.fee?.toString() ?? "",
      tax: entry.tax?.toString() ?? "",
      feeRate: derivedFeeRate || storedRates.feeRate,
      taxRate: derivedTaxRate || storedRates.taxRate,
      cashAmountAuto: entry.cashAmount === null,
      note: entry.note ?? "",
      source: entry.source,
      externalId: entry.externalId ?? "",
      corporateKind: isDividendEntry ? "dividend" : corporateMeta?.kind ?? "split",
      corporateAfterShares
    });
    setIsLedgerFormOpen(true);
  }, []);

  const handleCancelLedgerEdit = useCallback(() => {
    setLedgerForm(createEmptyLedgerForm(activePortfolio?.baseCurrency ?? "CNY"));
    setIsLedgerFormOpen(false);
  }, [activePortfolio]);

  const handleSubmitLedgerEntry = useCallback(async () => {
    if (!window.mytrader || !activePortfolio) return;
    setError(null);
    setNotice(null);

    const tradeDate = ledgerForm.tradeDate.trim();
    if (!tradeDate) {
      setError("请输入交易日期。");
      return;
    }

    const eventType = ledgerForm.eventType;
    const isCorporateDividend =
      eventType === "corporate_action" && ledgerForm.corporateKind === "dividend";
    const effectiveEventType: LedgerEventType = isCorporateDividend
      ? "dividend"
      : eventType;
    const symbol = ledgerForm.symbol.trim();
    const instrumentId = ledgerForm.instrumentId.trim();
    const side = ledgerForm.side || null;
    const cashCurrency = ledgerForm.cashCurrency.trim();
    const priceCurrency = ledgerForm.priceCurrency.trim();
    const autoFeeTaxEnabled = effectiveEventType === "trade";
    const normalizedCurrency =
      effectiveEventType === "trade"
        ? priceCurrency || cashCurrency || activePortfolio.baseCurrency
        : cashCurrency || activePortfolio.baseCurrency;
    const normalizedPriceCurrency =
      effectiveEventType === "trade" ? normalizedCurrency : priceCurrency;
    const normalizedCashCurrency =
      effectiveEventType === "trade" ? normalizedCurrency : cashCurrency;

    let eventTs: number | null;
    let sequence: number | null;
    let quantity: number | null;
    let price: number | null;
    let cashAmount: number | null;
    let fee: number | null;
    let tax: number | null;
    let feeRate: number | null = null;
    let taxRate: number | null = null;

    try {
      eventTs = parseOptionalDateTimeInput(ledgerForm.eventTime, "事件时间");
      sequence = parseOptionalIntegerInput(ledgerForm.sequence, "排序序号");
      quantity = parseOptionalNumberInput(ledgerForm.quantity, "数量");
      price = parseOptionalNumberInput(ledgerForm.price, "价格");
      cashAmount = parseOptionalNumberInput(ledgerForm.cashAmount, "现金腿");
      fee = parseOptionalNumberInput(ledgerForm.fee, "费用");
      tax = parseOptionalNumberInput(ledgerForm.tax, "税费");
      if (autoFeeTaxEnabled) {
        feeRate = parseOptionalNumberInput(ledgerForm.feeRate, "费用费率");
        taxRate = parseOptionalNumberInput(ledgerForm.taxRate, "税费率");
      }
    } catch (err) {
      setError(toUserErrorMessage(err));
      return;
    }

    if (eventTs !== null && eventTs <= 0) {
      setError("事件时间格式不正确。");
      return;
    }
    if (sequence !== null && sequence < 0) {
      setError("排序序号不能为负数。");
      return;
    }
    if (quantity !== null && quantity < 0) {
      setError("数量不能为负数。");
      return;
    }
    if (price !== null && price < 0) {
      setError("价格不能为负数。");
      return;
    }
    if (fee !== null && fee < 0) {
      setError("费用必须为非负数。");
      return;
    }
    if (tax !== null && tax < 0) {
      setError("税费必须为非负数。");
      return;
    }
    if (autoFeeTaxEnabled) {
      if (feeRate === null || taxRate === null) {
        setError("请填写费用费率与税费率。");
        return;
      }
      if (feeRate < 0 || taxRate < 0) {
        setError("费率与税率不能为负数。");
        return;
      }
      if (quantity === null || price === null || quantity <= 0 || price < 0) {
        setError("自动计算费用/税费需要填写有效的数量与价格。");
        return;
      }
      const baseAmount = quantity * price;
      if (!Number.isFinite(baseAmount)) {
        setError("自动计算费用/税费需要有效的数量与价格。");
        return;
      }
      fee = Number((baseAmount * (feeRate / 100)).toFixed(2));
      tax = Number((baseAmount * (taxRate / 100)).toFixed(2));
    }

    if (
      ["trade", "dividend", "adjustment", "corporate_action"].includes(effectiveEventType) &&
      !symbol &&
      !instrumentId
    ) {
      setError("请输入代码或 instrumentId。");
      return;
    }

    if ((ledgerForm.source === "csv" || ledgerForm.source === "broker_import") && sequence === null) {
      setError("文件/券商导入需要填写排序序号。");
      return;
    }

    if (effectiveEventType === "trade") {
      if (!side) {
        setError("交易需要填写方向。");
        return;
      }
      if (!quantity || quantity <= 0) {
        setError("交易数量必须大于 0。");
        return;
      }
      if (price === null) {
        setError("交易需要填写价格。");
        return;
      }
      if (cashAmount === null || cashAmount === 0) {
        setError("交易需要填写现金腿金额。");
        return;
      }
      if (side === "buy" && cashAmount > 0) {
        setError("买入交易现金腿必须为负数。");
        return;
      }
      if (side === "sell" && cashAmount < 0) {
        setError("卖出交易现金腿必须为正数。");
        return;
      }
    }

    if (effectiveEventType === "cash") {
      if (cashAmount === null || cashAmount === 0) {
        setError("现金流需要填写金额。");
        return;
      }
      if (!normalizedCashCurrency) {
        setError("现金流需要填写币种。");
        return;
      }
    }

    if (effectiveEventType === "fee" || effectiveEventType === "tax") {
      if (cashAmount === null || cashAmount >= 0) {
        setError(`${formatLedgerEventType(effectiveEventType)} 需要填写负数金额。`);
        return;
      }
      if (!normalizedCashCurrency) {
        setError(`${formatLedgerEventType(effectiveEventType)} 需要填写币种。`);
        return;
      }
    }

    if (effectiveEventType === "dividend") {
      if (cashAmount === null || cashAmount <= 0) {
        setError("分红需要填写正数金额。");
        return;
      }
      if (!normalizedCashCurrency) {
        setError("分红需要填写币种。");
        return;
      }
    }

    if (effectiveEventType === "adjustment") {
      if (!side) {
        setError("持仓调整需要填写方向。");
        return;
      }
      if (!quantity || quantity <= 0) {
        setError("持仓调整数量必须大于 0。");
        return;
      }
    }

    let meta: CreateLedgerEntryInput["meta"] = null;
    if (eventType === "corporate_action" && !isCorporateDividend) {
      if (ledgerForm.corporateKind === "info") {
        setError("公司行为不支持信息类型。");
        return;
      }
      let ratio: { numerator: number; denominator: number };
      try {
        ratio = parseCorporateAfterShares(ledgerForm.corporateAfterShares);
      } catch (err) {
        setError(toUserErrorMessage(err));
        return;
      }
      meta = {
        kind: ledgerForm.corporateKind,
        numerator: ratio.numerator,
        denominator: ratio.denominator
      };
    }

    const payloadEventType = isCorporateDividend ? "dividend" : eventType;
    const payload: CreateLedgerEntryInput = {
      portfolioId: activePortfolio.id,
      accountKey: ledgerForm.accountKey.trim() || null,
      eventType: payloadEventType,
      tradeDate,
      eventTs,
      sequence,
      instrumentId: instrumentId || null,
      symbol: symbol || null,
      side,
      quantity,
      price,
      priceCurrency: normalizedPriceCurrency || null,
      cashAmount,
      cashCurrency: normalizedCashCurrency || null,
      fee,
      tax,
      note: ledgerForm.note.trim() || null,
      source: ledgerForm.source,
      externalId: ledgerForm.externalId.trim() || null,
      meta
    };

    if (ledgerForm.id) {
      await window.mytrader.ledger.update({ ...payload, id: ledgerForm.id });
      setNotice("流水已更新。");
    } else {
      await window.mytrader.ledger.create(payload);
      setNotice("流水已新增。");
    }

    setLedgerForm(createEmptyLedgerForm(activePortfolio.baseCurrency));
    setIsLedgerFormOpen(false);
    await loadLedgerEntries(activePortfolio.id);
    await loadSnapshot(activePortfolio.id);
  }, [activePortfolio, ledgerForm, loadLedgerEntries, loadSnapshot]);

  const handleRequestDeleteLedgerEntry = useCallback((entry: LedgerEntry) => {
    setLedgerDeleteTarget(entry);
  }, []);

  const handleConfirmDeleteLedgerEntry = useCallback(async () => {
    if (!window.mytrader || !activePortfolio || !ledgerDeleteTarget) return;
    setError(null);
    setNotice(null);
    const entryId = ledgerDeleteTarget.id;
    setLedgerDeleteTarget(null);
    await window.mytrader.ledger.remove(entryId);
    await loadLedgerEntries(activePortfolio.id);
    await loadSnapshot(activePortfolio.id);
    setNotice("流水已删除。");
  }, [activePortfolio, ledgerDeleteTarget, loadLedgerEntries, loadSnapshot]);

  const handleCancelDeleteLedgerEntry = useCallback(() => {
    setLedgerDeleteTarget(null);
  }, []);

  const handleChooseCsv = useCallback(async (kind: "holdings" | "prices") => {
    if (!window.mytrader) return;
    setError(null);
    const selected = await window.mytrader.market.chooseCsvFile(kind);
    if (kind === "holdings") setHoldingsCsvPath(selected);
    else setPricesCsvPath(selected);
  }, []);

  const handleImportHoldings = useCallback(async () => {
    if (!window.mytrader || !activePortfolio || !holdingsCsvPath) return;
    setError(null);
    setNotice(null);
    const result = await window.mytrader.market.importHoldingsCsv({
      portfolioId: activePortfolio.id,
      filePath: holdingsCsvPath
    });
    await loadSnapshot(activePortfolio.id);
    setNotice(
      `持仓导入：新增 ${result.inserted}，更新 ${result.updated}，跳过 ${result.skipped}。`
    );
  }, [activePortfolio, holdingsCsvPath, loadSnapshot]);

  const handleImportPrices = useCallback(async () => {
    if (!window.mytrader || !pricesCsvPath) return;
    setError(null);
    setNotice(null);
    const result = await window.mytrader.market.importPricesCsv({
      filePath: pricesCsvPath,
      source: "csv"
    });
    if (activePortfolio) await loadSnapshot(activePortfolio.id);
    setNotice(`行情导入：新增 ${result.inserted} 条，跳过 ${result.skipped} 条。`);
  }, [pricesCsvPath, activePortfolio, loadSnapshot]);

  const refreshMarketWatchlist = useCallback(async () => {
    if (!window.mytrader) return;
    setMarketWatchlistLoading(true);
    try {
      const items = await window.mytrader.market.listWatchlist();
      setMarketWatchlistItems(items);
    } catch (err) {
      setError(toUserErrorMessage(err));
    } finally {
      setMarketWatchlistLoading(false);
    }
  }, []);

  const refreshMarketTags = useCallback(async (query: string) => {
    if (!window.mytrader) return;
    setMarketTagsLoading(true);
    try {
      const tags = await window.mytrader.market.listTags({
        query: query.trim() ? query.trim() : null,
        limit: 200
      });
      setMarketTags(tags);
    } catch (err) {
      setError(toUserErrorMessage(err));
      setMarketTags([]);
    } finally {
      setMarketTagsLoading(false);
    }
  }, []);

  const refreshManualThemeOptions = useCallback(async () => {
    if (!window.mytrader) return;
    setMarketManualThemeLoading(true);
    try {
      const tags = await window.mytrader.market.listTags({
        query: "theme:ths:",
        limit: 500
      });
      const options = buildManualThemeOptions(tags);
      setMarketManualThemeOptions(options);
      setMarketManualThemeDraft((prev) =>
        options.some((opt) => opt.value === prev) ? prev : ""
      );
    } catch (err) {
      setError(toUserErrorMessage(err));
      setMarketManualThemeOptions([]);
      setMarketManualThemeDraft("");
    } finally {
      setMarketManualThemeLoading(false);
    }
  }, []);

  const resetMarketFilters = useCallback(() => {
    setMarketFilterMarket("all");
    setMarketFilterAssetClasses([]);
    setMarketFilterKinds([]);
  }, []);

  const loadMarketQuotes = useCallback(async (symbols: string[]) => {
    if (!window.mytrader) return;
    const unique = Array.from(new Set(symbols.map((s) => s.trim()).filter(Boolean)));
    if (unique.length === 0) return;

    setMarketQuotesLoading(true);
    try {
      const quotes = await window.mytrader.market.getQuotes({ symbols: unique });
      setMarketQuotesBySymbol((prev) => {
        const next = { ...prev };
        quotes.forEach((quote) => {
          next[quote.symbol] = quote;
        });
        return next;
      });
    } catch (err) {
      setError(toUserErrorMessage(err));
    } finally {
      setMarketQuotesLoading(false);
    }
  }, []);

  const refreshMarketTargets = useCallback(async () => {
    if (!window.mytrader) return;
    setMarketTargetsLoading(true);
    try {
      const config = await window.mytrader.market.getTargets();
      setMarketTargetsConfig(config);
      const preview = await window.mytrader.market.previewTargets();
      setMarketTargetsPreview(preview);
      setMarketTempTargetsLoading(true);
      const temp = await window.mytrader.market.listTempTargets();
      setMarketTempTargets(temp);
    } catch (err) {
      setError(toUserErrorMessage(err));
    } finally {
      setMarketTempTargetsLoading(false);
      setMarketTargetsLoading(false);
    }
  }, []);

  const refreshMarketTokenStatus = useCallback(async () => {
    if (!window.mytrader) return;
    try {
      const status = await window.mytrader.market.getTokenStatus();
      setMarketTokenStatus(status);
    } catch (err) {
      setError(toUserErrorMessage(err));
    }
  }, []);

  const handleOpenMarketProvider = useCallback(async () => {
    if (!window.mytrader) return;
    try {
      await window.mytrader.market.openProviderHomepage({
        provider: marketTokenProvider
      });
    } catch (err) {
      setError(toUserErrorMessage(err));
    }
  }, [marketTokenProvider]);

  const refreshMarketIngestRuns = useCallback(async () => {
    if (!window.mytrader) return;
    setMarketIngestRunsLoading(true);
    try {
      const runs = await window.mytrader.market.listIngestRuns({ limit: 100 });
      setMarketIngestRuns(runs);
    } catch (err) {
      setError(toUserErrorMessage(err));
      setMarketIngestRuns([]);
    } finally {
      setMarketIngestRunsLoading(false);
    }
  }, []);

  const handleSaveMarketToken = useCallback(async () => {
    if (!window.mytrader) return;
    setError(null);
    setNotice(null);
    setMarketTokenSaving(true);
    try {
      const token = marketTokenDraft.trim();
      const status = await window.mytrader.market.setToken({
        token: token ? token : null
      });
      setMarketTokenStatus(status);
      setMarketTokenDraft("");
      setNotice(token ? "令牌已保存（本地加密存储）。" : "本地令牌已清除。");
    } catch (err) {
      setError(toUserErrorMessage(err));
    } finally {
      setMarketTokenSaving(false);
    }
  }, [marketTokenDraft]);

  const handleClearMarketToken = useCallback(async () => {
    if (!window.mytrader) return;
    setError(null);
    setNotice(null);
    setMarketTokenSaving(true);
    try {
      const status = await window.mytrader.market.setToken({ token: null });
      setMarketTokenStatus(status);
      setMarketTokenDraft("");
      setNotice("本地令牌已清除。");
    } catch (err) {
      setError(toUserErrorMessage(err));
    } finally {
      setMarketTokenSaving(false);
    }
  }, []);

  const handleTestMarketToken = useCallback(async () => {
    if (!window.mytrader) return;
    setError(null);
    setNotice(null);
    setMarketTokenTesting(true);
    try {
      const token = marketTokenDraft.trim() || null;
      await window.mytrader.market.testToken({ token });
      setNotice("连接测试成功。");
      await refreshMarketTokenStatus();
    } catch (err) {
      setError(toUserErrorMessage(err));
    } finally {
      setMarketTokenTesting(false);
    }
  }, [marketTokenDraft, refreshMarketTokenStatus]);

  const handleTriggerMarketIngest = useCallback(
    async (scope: "targets" | "universe" | "both") => {
      if (!window.mytrader) return;
      setError(null);
      setNotice(null);
      setMarketIngestTriggering(true);
      try {
        await window.mytrader.market.triggerIngest({ scope });
        setNotice("拉取任务已执行完成。");
        await refreshMarketIngestRuns();
      } catch (err) {
        setError(toUserErrorMessage(err));
        await refreshMarketIngestRuns();
      } finally {
        setMarketIngestTriggering(false);
      }
    },
    [refreshMarketIngestRuns]
  );

  const handleSyncInstrumentCatalog = useCallback(async () => {
    if (!window.mytrader) return;
    setError(null);
    setNotice(null);
    setMarketCatalogSyncing(true);
    try {
      const result = await window.mytrader.market.syncInstrumentCatalog();
      setMarketCatalogSyncSummary(
        `标的库已同步：新增 ${result.inserted}，更新 ${result.updated}。`
      );
      await refreshMarketTargets();
      setNotice(`标的库同步完成：新增 ${result.inserted}，更新 ${result.updated}。`);
    } catch (err) {
      setError(toUserErrorMessage(err));
    } finally {
      setMarketCatalogSyncing(false);
    }
  }, [refreshMarketTargets]);

  const handleSelectInstrument = useCallback(async (symbol: string) => {
    if (!window.mytrader) return;
    const key = symbol.trim();
    if (!key) return;
    setMarketInstrumentDetailsOpen(false);
    setMarketTagMembersModalOpen(false);
    setMarketSelectedSymbol(key);
    setMarketSelectedProfile(null);
    setMarketSelectedUserTags([]);
    setMarketShowProviderData(false);
    setMarketChartHoverDate(null);
    setMarketChartHoverPrice(null);
    setMarketChartLoading(true);
    setError(null);
    try {
      const profile = await window.mytrader.market.getInstrumentProfile(key);
      setMarketSelectedProfile(profile);
      const tags = await window.mytrader.market.listInstrumentTags(key);
      setMarketSelectedUserTags(tags);
      await loadMarketQuotes([key]);

      if (profile) {
        const preview = await window.mytrader.market.previewTargets();
        const entry = preview.symbols.find((item) => item.symbol === key) ?? null;
        const isTempOnly = entry?.reasons?.includes("temp:search") ?? false;

        if (!entry || isTempOnly) {
          const temp = await window.mytrader.market.touchTempTarget({ symbol: key });
          setMarketTempTargets(temp);
          const refreshed = await window.mytrader.market.previewTargets();
          setMarketTargetsPreview(refreshed);
          if (!entry) {
            setNotice(`已临时加入目标池：${key}（7天后自动清理，可在「数据管理」转为长期）。`);
          }
        }
      }
    } catch (err) {
      setError(toUserErrorMessage(err));
      setMarketChartLoading(false);
    }
  }, [loadMarketQuotes]);

  const handleSelectTag = useCallback(
    async (tag: string) => {
      if (!window.mytrader) return;
      const key = tag.trim();
      if (!key) return;

      setMarketInstrumentDetailsOpen(false);
      setMarketTagMembersModalOpen(false);
      setMarketSelectedTag(key);
      setMarketSelectedSymbol(null);
      setMarketSelectedProfile(null);
      setMarketSelectedUserTags([]);
      setMarketShowProviderData(false);
      setMarketTagMembers([]);
      setMarketChartBars([]);

      setError(null);
      setMarketTagMembersLoading(true);
      try {
        const members = await window.mytrader.market.getTagMembers({
          tag: key,
          limit: 5000
        });
        setMarketTagMembers(members);
        await loadMarketQuotes(members);
      } catch (err) {
        setError(toUserErrorMessage(err));
      } finally {
        setMarketTagMembersLoading(false);
      }
    },
    [loadMarketQuotes]
  );

  const handleSeedMarketDemoData = useCallback(async () => {
    if (!window.mytrader) return;
    setError(null);
    setNotice(null);
    setMarketDemoSeeding(true);
    try {
      const result = await window.mytrader.market.seedDemoData({
        portfolioId: activePortfolioId,
        seedHoldings: true
      });
      await refreshMarketWatchlist();
      await refreshMarketTags("demo");
      if (activePortfolioId) {
        await loadSnapshot(activePortfolioId);
      }
      setMarketScope("tags");
      await handleSelectTag("demo:all");
      setNotice(
        `已注入示例数据：${result.symbols.length} 个标的，${result.tradeDateCount} 个交易日。${
          result.warnings.length ? `（${result.warnings.join("；")}）` : ""
        }`
      );
    } catch (err) {
      setError(toUserErrorMessage(err));
    } finally {
      setMarketDemoSeeding(false);
    }
  }, [
    activePortfolioId,
    handleSelectTag,
    loadSnapshot,
    refreshMarketTags,
    refreshMarketWatchlist
  ]);

  const handleAddUserTag = useCallback(async () => {
    if (!window.mytrader || !marketSelectedSymbol) return;
    const tag = marketUserTagDraft.trim();
    if (!tag) return;
    if (!tag.includes(":")) {
      setError("标签必须符合 namespace:value，例如 user:核心 或 theme:AI。");
      return;
    }
    if (tag.startsWith("theme:")) {
      setError("主题请通过“手动主题（THS）”选择，不支持手动输入。");
      return;
    }
    setError(null);
    setNotice(null);
    try {
      await window.mytrader.market.addInstrumentTag(marketSelectedSymbol, tag);
      setMarketUserTagDraft("");
      const tags = await window.mytrader.market.listInstrumentTags(
        marketSelectedSymbol
      );
      setMarketSelectedUserTags(tags);
      setNotice("标签已添加。");
    } catch (err) {
      setError(toUserErrorMessage(err));
    }
  }, [marketSelectedSymbol, marketUserTagDraft]);

  const handleRemoveUserTag = useCallback(
    async (tag: string) => {
      if (!window.mytrader || !marketSelectedSymbol) return;
      const key = tag.trim();
      if (!key) return;
      setError(null);
      setNotice(null);
      try {
        await window.mytrader.market.removeInstrumentTag(
          marketSelectedSymbol,
          key
        );
        const tags = await window.mytrader.market.listInstrumentTags(
          marketSelectedSymbol
        );
        setMarketSelectedUserTags(tags);
        setNotice("标签已移除。");
      } catch (err) {
        setError(toUserErrorMessage(err));
      }
    },
    [marketSelectedSymbol]
  );

  const handleAddManualTheme = useCallback(async () => {
    if (!window.mytrader || !marketSelectedSymbol) return;
    const tag = marketManualThemeDraft.trim();
    if (!tag) return;
    if (!tag.startsWith("theme:manual:")) {
      setError("请选择 THS 主题后再添加。");
      return;
    }
    if (!marketManualThemeOptions.some((opt) => opt.value === tag)) {
      setError("主题不在 THS 列表中，请重新选择。");
      return;
    }
    if (marketSelectedUserTags.includes(tag)) {
      setNotice("主题已存在。");
      return;
    }
    setError(null);
    setNotice(null);
    try {
      await window.mytrader.market.addInstrumentTag(marketSelectedSymbol, tag);
      const tags = await window.mytrader.market.listInstrumentTags(
        marketSelectedSymbol
      );
      setMarketSelectedUserTags(tags);
      setNotice("主题已添加。");
    } catch (err) {
      setError(toUserErrorMessage(err));
    }
  }, [
    marketManualThemeDraft,
    marketManualThemeOptions,
    marketSelectedSymbol,
    marketSelectedUserTags
  ]);

  const handleAddSelectedToWatchlist = useCallback(async () => {
    if (!window.mytrader || !marketSelectedProfile) return;
    const groupName = marketWatchlistGroupDraft.trim();
    setError(null);
    setNotice(null);
    try {
      await window.mytrader.market.upsertWatchlistItem({
        symbol: marketSelectedProfile.symbol,
        name: marketSelectedProfile.name ?? null,
        groupName: groupName ? groupName : null
      });
      await refreshMarketWatchlist();
      setNotice("已加入自选列表。");
    } catch (err) {
      setError(toUserErrorMessage(err));
    }
  }, [marketSelectedProfile, marketWatchlistGroupDraft, refreshMarketWatchlist]);

  const handleRemoveWatchlistItem = useCallback(
    async (symbol: string) => {
      if (!window.mytrader) return;
      const key = symbol.trim();
      if (!key) return;
      setError(null);
      setNotice(null);
      try {
        await window.mytrader.market.removeWatchlistItem(key);
        await refreshMarketWatchlist();
        setNotice("已从自选列表移除。");
      } catch (err) {
        setError(toUserErrorMessage(err));
      }
    },
    [refreshMarketWatchlist]
  );

  const handleAddTargetSymbol = useCallback(() => {
    const symbol = marketTargetsSymbolDraft.trim();
    if (!symbol) return;
    setMarketTargetsConfig((prev) => {
      if (prev.explicitSymbols.includes(symbol)) return prev;
      return { ...prev, explicitSymbols: [...prev.explicitSymbols, symbol] };
    });
    setMarketTargetsSymbolDraft("");
  }, [marketTargetsSymbolDraft]);

  const handleRemoveTargetSymbol = useCallback((symbol: string) => {
    const key = symbol.trim();
    if (!key) return;
    setMarketTargetsConfig((prev) => ({
      ...prev,
      explicitSymbols: prev.explicitSymbols.filter((item) => item !== key)
    }));
  }, []);

  const handleAddTargetTag = useCallback(
    (raw?: string) => {
      const tag = (raw ?? marketTargetsTagDraft).trim();
      if (!tag) return;
      setMarketTargetsConfig((prev) => {
        if (prev.tagFilters.includes(tag)) return prev;
        return { ...prev, tagFilters: [...prev.tagFilters, tag] };
      });
      if (raw === undefined) setMarketTargetsTagDraft("");
    },
    [marketTargetsTagDraft]
  );

  const handleRemoveTargetTag = useCallback((tag: string) => {
    const key = tag.trim();
    if (!key) return;
    setMarketTargetsConfig((prev) => ({
      ...prev,
      tagFilters: prev.tagFilters.filter((item) => item !== key)
    }));
  }, []);

  const handleRemoveTempTarget = useCallback(
    async (symbol: string) => {
      if (!window.mytrader) return;
      const key = symbol.trim();
      if (!key) return;
      setError(null);
      setNotice(null);
      setMarketTempTargetsLoading(true);
      try {
        const next = await window.mytrader.market.removeTempTarget({ symbol: key });
        setMarketTempTargets(next);
        const preview = await window.mytrader.market.previewTargets();
        setMarketTargetsPreview(preview);
        setNotice(`已移除临时标的：${key}`);
      } catch (err) {
        setError(toUserErrorMessage(err));
      } finally {
        setMarketTempTargetsLoading(false);
      }
    },
    []
  );

  const handlePromoteTempTarget = useCallback(
    async (symbol: string) => {
      if (!window.mytrader) return;
      const key = symbol.trim();
      if (!key) return;
      setError(null);
      setNotice(null);
      setMarketTempTargetsLoading(true);
      setMarketTargetsSaving(true);
      try {
        const saved = await window.mytrader.market.promoteTempTarget({ symbol: key });
        setMarketTargetsConfig(saved);
        const preview = await window.mytrader.market.previewTargets();
        setMarketTargetsPreview(preview);
        const temp = await window.mytrader.market.listTempTargets();
        setMarketTempTargets(temp);
        setNotice(`已转为长期目标：${key}`);
      } catch (err) {
        setError(toUserErrorMessage(err));
      } finally {
        setMarketTargetsSaving(false);
        setMarketTempTargetsLoading(false);
      }
    },
    []
  );

  const handleSaveTargets = useCallback(async () => {
    if (!window.mytrader) return;
    setError(null);
    setNotice(null);
    setMarketTargetsSaving(true);
    try {
      const saved = await window.mytrader.market.setTargets(marketTargetsConfig);
      setMarketTargetsConfig(saved);
      const preview = await window.mytrader.market.previewTargets();
      setMarketTargetsPreview(preview);
      setNotice("目标池已保存。");
    } catch (err) {
      setError(toUserErrorMessage(err));
    } finally {
      setMarketTargetsSaving(false);
    }
  }, [marketTargetsConfig]);

  const handleMarketExplorerResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      marketExplorerResizeRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startWidth: marketExplorerWidth
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      document.body.style.userSelect = "none";
    },
    [marketExplorerWidth]
  );

  const handleMarketExplorerResizeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? 32 : 16;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setMarketExplorerWidth((prev) =>
          clampNumber(
            prev - step,
            MARKET_EXPLORER_MIN_WIDTH,
            MARKET_EXPLORER_MAX_WIDTH
          )
        );
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setMarketExplorerWidth((prev) =>
          clampNumber(
            prev + step,
            MARKET_EXPLORER_MIN_WIDTH,
            MARKET_EXPLORER_MAX_WIDTH
          )
        );
      }
    },
    []
  );

  useEffect(() => {
    if (activeView !== "market") return;
    if (!window.mytrader) return;
    refreshMarketWatchlist().catch(() => undefined);
    refreshMarketTags("").catch(() => undefined);
  }, [activeView, refreshMarketTags, refreshMarketWatchlist]);

  useEffect(() => {
    if (!marketInstrumentDetailsOpen) return;
    refreshManualThemeOptions().catch(() => undefined);
  }, [marketInstrumentDetailsOpen, refreshManualThemeOptions]);

  useEffect(() => {
    if (activeView !== "other") return;
    if (!window.mytrader) return;

    if (otherTab === "data-management") {
      refreshMarketTokenStatus().catch(() => undefined);
      refreshMarketTargets().catch(() => undefined);
      refreshMarketIngestRuns().catch(() => undefined);
      return;
    }

    if (otherTab === "data-status") {
      refreshMarketTokenStatus().catch(() => undefined);
      refreshMarketIngestRuns().catch(() => undefined);
    }
  }, [
    activeView,
    otherTab,
    refreshMarketIngestRuns,
    refreshMarketTargets,
    refreshMarketTokenStatus
  ]);

  useEffect(() => {
    if (activeView !== "market") return;
    if (!marketTagPickerOpen) return;
    if (!window.mytrader) return;
    void refreshMarketTags(marketTagPickerQuery);
  }, [activeView, marketTagPickerOpen, marketTagPickerQuery, refreshMarketTags]);

  useEffect(() => {
    if (activeView !== "market") return;
    if (!window.mytrader) return;
    const query = marketSearchQuery.trim();
    if (!query) {
      setMarketSearchResults([]);
      setMarketSearchLoading(false);
      return;
    }

    setMarketSearchLoading(true);
    const requestId = marketSearchRequestIdRef.current + 1;
    marketSearchRequestIdRef.current = requestId;

    if (marketSearchTimerRef.current !== null) {
      window.clearTimeout(marketSearchTimerRef.current);
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const results = await window.mytrader!.market.searchInstruments({
            query,
            limit: 50
          });
          if (marketSearchRequestIdRef.current !== requestId) return;
          setMarketSearchResults(results);
        } catch (err) {
          if (marketSearchRequestIdRef.current !== requestId) return;
          setError(toUserErrorMessage(err));
          setMarketSearchResults([]);
        } finally {
          if (marketSearchRequestIdRef.current === requestId) {
            setMarketSearchLoading(false);
          }
        }
      })();
    }, 250);

    marketSearchTimerRef.current = timer;
    return () => window.clearTimeout(timer);
  }, [activeView, marketSearchQuery]);

  useEffect(() => {
    if (activeView !== "market") return;
    if (marketEffectiveScope !== "holdings") return;
    void loadMarketQuotes(marketHoldingsSymbolsFiltered);
  }, [activeView, loadMarketQuotes, marketEffectiveScope, marketHoldingsSymbolsFiltered]);

  useEffect(() => {
    if (activeView !== "market") return;
    if (marketEffectiveScope !== "search") return;
    void loadMarketQuotes(marketSearchResultsFiltered.map((item) => item.symbol));
  }, [activeView, loadMarketQuotes, marketEffectiveScope, marketSearchResultsFiltered]);

  useEffect(() => {
    if (activeView !== "market") return;
    if (!window.mytrader) return;
    if (!marketSelectedSymbol) return;

    const quote = marketQuotesBySymbol[marketSelectedSymbol];
    const endDate = quote?.tradeDate ?? formatInputDate(new Date());
    const { startDate, endDate: resolvedEndDate } = resolveMarketChartDateRange(
      marketChartRange,
      endDate
    );

    setMarketChartLoading(true);
    void (async () => {
      try {
        const bars = await window.mytrader!.market.getDailyBars({
          symbol: marketSelectedSymbol,
          startDate,
          endDate: resolvedEndDate,
          includeMoneyflow: marketVolumeMode === "moneyflow"
        });
        setMarketChartBars(bars);
      } catch (err) {
        setError(toUserErrorMessage(err));
        setMarketChartBars([]);
      } finally {
        setMarketChartLoading(false);
      }
    })();
  }, [
    activeView,
    marketChartRange,
    marketQuotesBySymbol,
    marketSelectedSymbol,
    marketVolumeMode
  ]);

  useEffect(() => {
    if (activeView !== "market") return;
    if (!window.mytrader) return;
    if (marketEffectiveScope !== "tags") {
      setMarketTagSeriesError(null);
      setMarketTagSeriesResult(null);
      setMarketTagSeriesBars([]);
      setMarketTagSeriesLoading(false);
      return;
    }
    if (!marketSelectedTag || marketSelectedSymbol) {
      setMarketTagSeriesError(null);
      setMarketTagSeriesResult(null);
      setMarketTagSeriesBars([]);
      setMarketTagSeriesLoading(false);
      return;
    }

    const endDate = snapshot?.priceAsOf ?? formatInputDate(new Date());
    const { startDate, endDate: resolvedEndDate } = resolveMarketChartDateRange(
      marketChartRange,
      endDate
    );

    const requestId = (marketTagSeriesRequestIdRef.current += 1);
    setMarketTagSeriesLoading(true);
    setMarketTagSeriesError(null);
    void (async () => {
      try {
        const result = await window.mytrader!.market.getTagSeries({
          tag: marketSelectedTag,
          startDate,
          endDate: resolvedEndDate,
          memberLimit: 300
        });
        if (marketTagSeriesRequestIdRef.current !== requestId) return;
        setMarketTagSeriesResult(result);
        setMarketTagSeriesBars(
          result.points.map((point) => ({
            date: point.date,
            open: null,
            high: null,
            low: null,
            close: point.value,
            volume: null
          }))
        );
      } catch (err) {
        if (marketTagSeriesRequestIdRef.current !== requestId) return;
        setMarketTagSeriesError(toUserErrorMessage(err));
        setMarketTagSeriesResult(null);
        setMarketTagSeriesBars([]);
      } finally {
        if (marketTagSeriesRequestIdRef.current !== requestId) return;
        setMarketTagSeriesLoading(false);
      }
    })();
  }, [
    activeView,
    marketChartRange,
    marketEffectiveScope,
    marketSelectedSymbol,
    marketSelectedTag,
    snapshot?.priceAsOf
  ]);

  useEffect(() => {
    if (activeView !== "market") return;
    if (marketSelectedSymbol || marketSelectedTag) return;
    if (marketSearchQuery.trim()) return;

    if (marketHoldingsSymbolsFiltered.length > 0) {
      setMarketScope("holdings");
      return;
    }

    if (marketWatchlistItems.length > 0) {
      setMarketScope("tags");
      void handleSelectTag("watchlist:all");
    }
  }, [
    activeView,
    handleSelectTag,
    marketHoldingsSymbolsFiltered,
    marketSearchQuery,
    marketSelectedSymbol,
    marketSelectedTag,
    marketWatchlistItems.length
  ]);

  return (
    <div className="flex h-full bg-white/90 dark:bg-background-dark/80 backdrop-blur-xl overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`${
          isNavCollapsed ? "w-16" : "w-40"
        } flex-shrink-0 bg-surface-light/95 dark:bg-surface-dark/90 backdrop-blur-xl border-r border-border-light dark:border-border-dark flex flex-col transition-all duration-300 z-20`}
      >
        <div className="flex items-center justify-between p-2 border-b border-border-light dark:border-border-dark h-10">
          <p className={`text-xs font-semibold text-slate-400 ${isNavCollapsed ? "hidden" : "block"}`}>
            导航
          </p>
          <button
            className="p-1 rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-background-dark/80 transition-colors"
            type="button"
            onClick={() => setIsNavCollapsed((prev) => !prev)}
            aria-label={isNavCollapsed ? "展开导航" : "收起导航"}
          >
            <span className="material-icons-outlined text-lg">
              {isNavCollapsed ? "chevron_right" : "chevron_left"}
            </span>
          </button>
        </div>
        
        {/* Account info moved to global top bar */}

        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {navItems.map((item) => {
            const isActive = item.key === activeView;
            return (
              <button
                key={item.key}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 group
                  ${isActive 
                    ? "bg-primary text-white font-medium" 
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-background-dark/80 hover:text-slate-900 dark:hover:text-white"
                  }
                  ${isNavCollapsed ? "justify-center px-2" : ""}
                `}
                type="button"
                onClick={() => setActiveView(item.key)}
                title={item.label}
              >
                <span className={`material-icons-outlined ${isNavCollapsed ? "text-xl" : "text-lg"} ${isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300"}`}>
                  {item.icon}
                </span>
                {!isNavCollapsed && (
                  <div className="flex flex-col items-start text-left leading-tight">
                    <span>{item.label}</span>
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <section className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-white/85 dark:bg-background-dark/70 backdrop-blur-lg">
        {/* Top Navigation / Toolbar */}
        <div className="h-10 border-b border-border-light dark:border-border-dark flex items-center justify-between px-3 flex-shrink-0 bg-white/85 dark:bg-background-dark/75 backdrop-blur-lg">
           <div className="flex items-baseline gap-3 min-w-0">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                {activeView === "other" && otherTab === "data-status"
                  ? "数据状态"
                  : navItems.find(n => n.key === activeView)?.label}
              </h2>
              {activeView === "market" && (
                <span className="relative top-[1px] text-xs font-mono text-slate-500 dark:text-slate-400">
                  {snapshot?.priceAsOf ?? "--"}
                </span>
              )}
           </div>
           <div className="flex items-center gap-2">
              {activeView === "account" && (
                 <Button variant="secondary" size="sm" onClick={onLock} icon="lock">锁定</Button>
              )}
           </div>
        </div>

        {activeView === "portfolio" && (
          <div className="border-b border-border-light dark:border-border-dark bg-white/90 dark:bg-background-dark/75">
            <div className="flex items-center gap-0 overflow-x-auto px-3">
              {portfolioTabs.map((tab) => {
                const isActive = portfolioTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
	                    className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors border-b-2 ${
	                      isActive
	                        ? "text-slate-900 dark:text-white border-primary bg-slate-100 dark:bg-surface-dark"
	                        : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-background-dark/80"
	                    }`}
                    onClick={() => setPortfolioTab(tab.key)}
                  >
                    <span className="material-icons-outlined text-base">{tab.icon}</span>
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div
          className={`flex-1 p-0 scroll-smooth ${
            activeView === "market" ? "overflow-hidden" : "overflow-y-auto"
          }`}
        >
          
          {/* View: Account */}
          {activeView === "account" && (
            <Panel>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 max-w-4xl">
                 <DescriptionItem label="当前账号" value={account.label} />
                 <DescriptionItem label="账号 ID" value={<span className="font-mono text-xs">{account.id}</span>} />
                 <DescriptionItem label="数据目录" value={<span className="font-mono text-xs">{account.dataDir}</span>} />
                 <DescriptionItem label="创建时间" value={formatDateTime(account.createdAt)} />
                 <DescriptionItem label="最近登录" value={formatDateTime(account.lastLoginAt)} />
              </div>
            </Panel>
          )}

          {/* View: Portfolio */}
          {activeView === "portfolio" && (
            <>
              {portfolioTab === "overview" && (
                <>
                  <Panel>
                    {isLoading && <EmptyState message="正在加载组合数据..." />}
                    {!isLoading && !activePortfolio && <EmptyState message="请先选择或创建组合。" />}
                    {!isLoading && activePortfolio && !snapshot && <EmptyState message="暂无估值快照。" />}

                    {snapshot && (
                        <div className="space-y-6">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <SummaryCard label="总资产" value={formatCurrency(snapshot.totals.marketValue)} />
                          <SummaryCard label="现金余额" value={formatCurrency(cashTotal)} />
                          <SummaryCard
                            label="总盈亏"
                            value={formatCurrency(snapshot.totals.pnl)}
                            trend={snapshot.totals.pnl >= 0 ? "up" : "down"}
                          />
                          <SummaryCard label="成本合计" value={formatCurrency(snapshot.totals.costValue)} />
                          <SummaryCard label="行情更新" value={snapshot.priceAsOf ?? "--"} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-slate-50 dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark border border-slate-200 dark:border-border-dark rounded-lg p-4">
                            <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">数据状态</div>
                            <p className="text-sm text-slate-700 dark:text-slate-300">
                              {snapshot.priceAsOf ? `价格更新至 ${snapshot.priceAsOf}` : "暂无行情数据"}
                            </p>
                          </div>
                          <div className="bg-slate-50 dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark border border-slate-200 dark:border-border-dark rounded-lg p-4">
                            <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">风险提示</div>
                            <p className="text-sm text-slate-700 dark:text-slate-300">
                              {snapshot.riskWarnings.length > 0
                                ? `${snapshot.riskWarnings.length} 条风险预警`
                                : "暂无触发预警"}
                            </p>
                          </div>
                          <div className="bg-slate-50 dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark border border-slate-200 dark:border-border-dark rounded-lg p-4">
                            <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">快速动作</div>
                            <p className="text-sm text-slate-700 dark:text-slate-300">刷新行情 / 导入流水</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </Panel>

                  <Panel>
                    <h3 className="text-sm font-semibold mb-4 text-slate-800 dark:text-slate-200">组合管理</h3>
                    <div className="space-y-6 max-w-5xl">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormGroup label="切换组合">
                          <Select
                            value={activePortfolioId ?? ""}
                            onChange={(e) => setActivePortfolioId(e.target.value)}
                            options={[
                              { value: "", label: "请选择组合", disabled: true },
                              ...portfolios.map((p) => ({ value: p.id, label: p.name }))
                            ]}
                            className="w-full"
                          />
                        </FormGroup>

                        <FormGroup label="重命名当前组合">
                          <div className="flex gap-2">
                            <Input
                              value={portfolioRename}
                              onChange={(e) => setPortfolioRename(e.target.value)}
                              placeholder="组合名称"
                              className="flex-1"
                            />
                            <Button variant="secondary" onClick={handleRenamePortfolio} disabled={!activePortfolio}>
                              更新
                            </Button>
                            <Button variant="danger" onClick={handleDeletePortfolio} disabled={!activePortfolio}>
                              删除
                            </Button>
                          </div>
                        </FormGroup>
                      </div>

                      <div className="border-t border-slate-100 dark:border-border-dark" />

                      <FormGroup label="新建组合">
                        <div className="flex gap-2 items-center">
                          <Input
                            value={portfolioName}
                            onChange={(e) => setPortfolioName(e.target.value)}
                            placeholder="例如：核心持仓"
                            className="flex-[2]"
                          />
                          <Input
                            value={portfolioBaseCurrency}
                            onChange={(e) => setPortfolioBaseCurrency(e.target.value)}
                            placeholder="基准币种"
                            className="flex-1"
                          />
                          <Button
                            variant="primary"
                            onClick={handleCreatePortfolio}
                            disabled={!portfolioName.trim()}
                            icon="add"
                          >
                            创建
                          </Button>
                        </div>
                      </FormGroup>
                    </div>
                  </Panel>
                </>
              )}

              {portfolioTab === "holdings" && (
                <Panel>
                  <h3 className="text-sm font-semibold mb-4 text-slate-800 dark:text-slate-200">持仓明细</h3>

                  {isLoading && <EmptyState message="正在加载组合数据..." />}
                  {!isLoading && !activePortfolio && <EmptyState message="请先选择或创建组合。" />}
                  {!isLoading && activePortfolio && !snapshot && <EmptyState message="暂无估值快照。" />}

                  {snapshot && (
                    <>
                      <div className="overflow-x-auto border border-slate-200 dark:border-border-dark mb-6">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-border-dark">
                          <thead className="bg-slate-50 dark:bg-background-dark">
                            <tr>
                              {["代码", "名称", "类型", "数量", "成本", "现价", "市值", "盈亏", "权重", "操作"].map((h) => (
                                <th
                                  key={h}
                                  className="px-4 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-surface-dark/70 divide-y divide-slate-200 dark:divide-border-dark">
                            {snapshot.positions.length === 0 ? (
                              <tr>
                                <td colSpan={10} className="px-4 py-8 text-center text-sm text-slate-500">
                                  暂无持仓
                                </td>
                              </tr>
                            ) : (
                              snapshot.positions.map((pos) => (
                                <tr
                                  key={pos.position.id}
                                  className="hover:bg-slate-50 dark:hover:bg-background-dark/70 transition-colors group"
                                >
                                  <td className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 font-mono">
                                    {pos.position.symbol}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400">
                                    {pos.position.name ?? "-"}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-slate-500">
                                    <Badge>{formatAssetClassLabel(pos.position.assetClass)}</Badge>
                                  </td>
                                  <td className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 font-mono text-right">
                                    {formatNumber(pos.position.quantity)}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-slate-500 dark:text-slate-500 font-mono text-right">
                                    {formatCurrency(pos.position.cost)}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 font-mono text-right">
                                    {formatCurrency(pos.latestPrice)}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-slate-900 dark:text-slate-100 font-medium font-mono text-right">
                                    {formatCurrency(pos.marketValue)}
                                  </td>
                                  <td
                                    className={`px-4 py-2 text-sm font-mono text-right ${
                                      pos.pnl && pos.pnl < 0 ? "text-red-500" : "text-emerald-500"
                                    }`}
                                  >
                                    {formatCurrency(pos.pnl)}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-slate-500 dark:text-slate-500 font-mono text-right">
                                    {formatPct(
                                      snapshot.exposures.bySymbol.find((e) => e.key === pos.position.symbol)
                                        ?.weight ?? 0
                                    )}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-right">
                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={() => handleEditPosition(pos)}
                                        className="p-1 text-slate-400 hover:text-primary transition-colors"
                                        title="编辑"
                                      >
                                        <span className="material-icons-outlined text-base">edit</span>
                                      </button>
                                      <button
                                        onClick={() => handleDeletePosition(pos.position.id)}
                                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                        title="删除"
                                      >
                                        <span className="material-icons-outlined text-base">delete</span>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="bg-slate-50 dark:bg-background-dark p-4 border-t border-slate-200 dark:border-border-dark">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                            <span className="material-icons-outlined text-primary text-base">edit_note</span>
                            {positionForm.id ? "编辑持仓" : "新增持仓"}
                          </h3>
                          {positionForm.id && (
                            <Button variant="secondary" size="sm" onClick={handleCancelEditPosition}>
                              取消编辑
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <FormGroup label="代码">
                            <Input
                              value={positionForm.symbol}
                              onChange={(e) => setPositionForm((p) => ({ ...p, symbol: e.target.value }))}
                              placeholder="例如: 600519.SH"
                            />
                          </FormGroup>
                          <FormGroup label="名称">
                            <Input
                              value={positionForm.name}
                              onChange={(e) => setPositionForm((p) => ({ ...p, name: e.target.value }))}
                              placeholder="可选"
                            />
                          </FormGroup>
                          <FormGroup label="资产类别">
                            <Select
                              value={positionForm.assetClass}
                              onChange={(e) =>
                                setPositionForm((p) => ({ ...p, assetClass: e.target.value as AssetClass }))
                              }
                              options={Object.entries(assetClassLabels).map(([v, l]) => ({
                                value: v,
                                label: l
                              }))}
                            />
                          </FormGroup>
                          <FormGroup label="市场 / 币种">
                            <div className="flex gap-2">
                              <Input
                                value={positionForm.market}
                                onChange={(e) => setPositionForm((p) => ({ ...p, market: e.target.value }))}
                                placeholder="CN"
                              />
                              <Input
                                value={positionForm.currency}
                                onChange={(e) => setPositionForm((p) => ({ ...p, currency: e.target.value }))}
                                placeholder="CNY"
                              />
                            </div>
                          </FormGroup>
                          <FormGroup label="数量">
                            <Input
                              type="number"
                              value={positionForm.quantity}
                              onChange={(e) => setPositionForm((p) => ({ ...p, quantity: e.target.value }))}
                              placeholder="0"
                            />
                          </FormGroup>
                          <FormGroup label="成本单价">
                            <Input
                              type="number"
                              value={positionForm.cost}
                              onChange={(e) => setPositionForm((p) => ({ ...p, cost: e.target.value }))}
                              placeholder="0.00"
                            />
                          </FormGroup>
                          <FormGroup label="建仓日期">
                            <Input
                              type="date"
                              value={positionForm.openDate}
                              onChange={(e) => setPositionForm((p) => ({ ...p, openDate: e.target.value }))}
                            />
                          </FormGroup>
                          <div className="flex items-end">
                            <Button variant="primary" onClick={handleSubmitPosition} className="w-full">
                              {positionForm.id ? "保存更改" : "添加持仓"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </Panel>
              )}

              {portfolioTab === "performance" && (
                <Panel>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">收益表现</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        收益曲线与口径区间保持一致。
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {performanceRanges.map((range) => {
                        const isActive = performanceRange === range.key;
                        return (
                          <button
                            key={range.key}
                            type="button"
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                              isActive
                                ? "bg-primary text-white border-primary"
                                : "bg-white dark:bg-surface-dark text-slate-500 dark:text-slate-300 border-slate-200 dark:border-border-dark hover:text-slate-900 dark:hover:text-white"
                            }`}
                            onClick={() => setPerformanceRange(range.key)}
                          >
                            {range.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {performanceLoading && <EmptyState message="正在加载收益曲线..." />}
                  {!performanceLoading && performanceError && (
                    <ErrorState
                      message={performanceError}
                      onRetry={() => {
                        if (!activePortfolioId) return;
                        loadPerformance(activePortfolioId, performanceRange).catch((err) =>
                          setPerformanceError(toUserErrorMessage(err))
                        );
                      }}
                    />
                  )}
                  {!performanceLoading && !performanceError && !activePortfolio && (
                    <EmptyState message="请先选择或创建组合。" />
                  )}
                  {!performanceLoading &&
                    !performanceError &&
                    activePortfolio &&
                    !performanceResult && <EmptyState message="暂无收益数据。" />}

                  {!performanceLoading && !performanceError && performance && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <SummaryCard
                          label="当前口径"
                          value={formatPerformanceMethod(performance.selectedMethod)}
                        />
                        <SummaryCard
                          label="区间"
                          value={formatDateRange(
                            selectedPerformance?.startDate,
                            selectedPerformance?.endDate
                          )}
                        />
                        <SummaryCard
                          label="总收益率"
                          value={formatPctNullable(selectedPerformance?.totalReturn ?? null)}
                        />
                        <SummaryCard
                          label="年化收益率"
                          value={formatPctNullable(selectedPerformance?.annualizedReturn ?? null)}
                        />
                      </div>

                      {dataQuality && (
                        <DataQualityCard
                          quality={dataQuality}
                          onOpenMarketDataStatus={() => {
                            setActiveView("other");
                            setOtherTab("data-status");
                          }}
                        />
                      )}

	                      {performance.reason && (
	                        <div className="bg-slate-50 dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark border border-slate-200 dark:border-border-dark rounded-lg p-4 text-sm text-slate-600 dark:text-slate-300">
	                          {performance.reason}
	                        </div>
	                      )}

                      {performanceSeries ? (
                        <PerformanceChart series={performanceSeries} />
                      ) : (
                        <EmptyState message="暂无收益曲线。" />
                      )}

                      {contributionBreakdown ? (
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-xs uppercase tracking-wider text-slate-500">
                                收益贡献
                              </div>
                              <div className="text-[11px] text-slate-400">
                                区间 {contributionBreakdown.startDate} ~ {contributionBreakdown.endDate}
                              </div>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              默认展示 Top {CONTRIBUTION_TOP_N}
                            </div>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            按区间起止价格与期末持仓估算。
                          </div>
                          {contributionBreakdown.reason && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {contributionBreakdown.reason}
                            </div>
                          )}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <ContributionTable
                              title="标的贡献"
                              entries={contributionBreakdown.bySymbol}
                              showAll={showAllSymbolContribution}
                              topCount={CONTRIBUTION_TOP_N}
                              onToggle={() =>
                                setShowAllSymbolContribution((prev) => !prev)
                              }
                              showMarketValue={showAllSymbolContribution}
                            />
                            <ContributionTable
                              title="资产类别贡献"
                              labelHeader="类别"
                              entries={contributionBreakdown.byAssetClass}
                              showAll={showAllAssetContribution}
                              topCount={CONTRIBUTION_TOP_N}
                              onToggle={() =>
                                setShowAllAssetContribution((prev) => !prev)
                              }
                              showMarketValue={showAllAssetContribution}
                            />
                          </div>
                        </div>
                      ) : (
                        <EmptyState message="暂无贡献数据。" />
                      )}

	                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
	                        <div className="bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark border border-slate-200 dark:border-border-dark rounded-lg p-4">
	                          <div className="text-xs uppercase tracking-wider text-slate-500 mb-3">TWR</div>
                          <DescriptionItem
                            label="区间"
                            value={formatDateRange(
                              performance.twr?.startDate,
                              performance.twr?.endDate
                            )}
                          />
                          <DescriptionItem
                            label="总收益率"
                            value={formatPctNullable(performance.twr?.totalReturn ?? null)}
                          />
                          <DescriptionItem
                            label="年化收益率"
                            value={formatPctNullable(
                              performance.twr?.annualizedReturn ?? null
                            )}
                          />
                        </div>
	                        <div className="bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark border border-slate-200 dark:border-border-dark rounded-lg p-4">
	                          <div className="text-xs uppercase tracking-wider text-slate-500 mb-3">MWR</div>
                          <DescriptionItem
                            label="区间"
                            value={formatDateRange(
                              performance.mwr?.startDate,
                              performance.mwr?.endDate
                            )}
                          />
                          <DescriptionItem
                            label="总收益率"
                            value={formatPctNullable(performance.mwr?.totalReturn ?? null)}
                          />
                          <DescriptionItem
                            label="年化收益率"
                            value={formatPctNullable(
                              performance.mwr?.annualizedReturn ?? null
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </Panel>
              )}

              {portfolioTab === "trades" && (
                <Panel>
	                  <div className="mb-2 rounded-none border border-slate-200 dark:border-border-dark bg-white/70 dark:bg-surface-dark overflow-hidden">
	                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-b border-slate-200 dark:border-border-dark">
                      <div className="flex items-center gap-2">
                        <span className="material-icons-outlined text-base text-primary">
                          swap_horiz
                        </span>
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          交易流水
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 rounded-none bg-transparent px-2 py-0.5">
                        <Input
                          type="date"
                          value={ledgerStartDate}
                          onChange={(e) => setLedgerStartDate(e.target.value)}
                          className="text-xs w-32 border-0 bg-transparent dark:bg-transparent focus:ring-0 focus:border-transparent rounded-none"
                          disabled={!activePortfolio}
                        />
                        <span className="text-xs text-slate-400">至</span>
                        <Input
                          type="date"
                          value={ledgerEndDate}
                          onChange={(e) => setLedgerEndDate(e.target.value)}
                          className="text-xs w-32 border-0 bg-transparent dark:bg-transparent focus:ring-0 focus:border-transparent rounded-none"
                          disabled={!activePortfolio}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5">
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <Select
                          value={ledgerFilter}
                          onChange={(e) => setLedgerFilter(e.target.value as LedgerFilter)}
                          options={[
                            { value: "all", label: "全部交易类型" },
                            ...ledgerEventTypeOptions
                          ]}
                          className="text-[11px] w-40 rounded-none border-0 !bg-transparent dark:!bg-transparent text-primary focus:ring-0 focus:border-transparent pl-2 pr-6"
                          disabled={!activePortfolio}
                        />
                        <span className="h-4 w-px bg-slate-200 dark:bg-border-dark" />
                        <span>
                          筛选结果 {filteredLedgerEntries.length} / {ledgerEntries.length}
                        </span>
                        {cashFlowTotals.map((item) => (
                          <span
                            key={item.currency}
                            className="text-[11px] font-mono text-emerald-500 dark:text-emerald-300"
                          >
                            现金净流 {item.currency} {formatCurrency(item.amount)}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <IconButton
                          icon="refresh"
                          label="刷新流水"
                          size="sm"
                          className="rounded-none"
                          onClick={() => {
                            if (!activePortfolioId) return;
                            loadLedgerEntries(activePortfolioId).catch((err) =>
                              setLedgerError(toUserErrorMessage(err))
                            );
                          }}
                          disabled={!activePortfolioId || ledgerLoading}
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          icon="add"
                          className={`rounded-none px-2 py-1 text-[11px] ${
                            isLedgerFormOpen || Boolean(ledgerForm.id)
                              ? "bg-slate-400 border-slate-400 hover:bg-slate-400 text-white"
                              : ""
                          }`}
                          onClick={handleOpenLedgerForm}
                          disabled={!activePortfolio || isLedgerFormOpen || Boolean(ledgerForm.id)}
                        >
                          录入
                        </Button>
                      </div>
                    </div>
                  </div>

                  {!activePortfolio && <EmptyState message="请先选择或创建组合。" />}
                  {activePortfolio && ledgerLoading && <EmptyState message="正在加载流水..." />}
                  {activePortfolio && ledgerError && (
                    <ErrorState
                      message={ledgerError}
                      onRetry={() => {
                        if (!activePortfolioId) return;
                        loadLedgerEntries(activePortfolioId).catch((err) =>
                          setLedgerError(toUserErrorMessage(err))
                        );
                      }}
                    />
                  )}

                  {activePortfolio && (isLedgerFormOpen || Boolean(ledgerForm.id)) && (
                    <div className="mb-3 bg-cyan-50/45 dark:bg-cyan-950/20 border border-slate-200 dark:border-border-dark border-t-0 border-l-2 border-r-2 border-b-2 border-l-cyan-300 border-r-cyan-300 border-b-cyan-300 dark:border-l-cyan-800 dark:border-r-cyan-800 dark:border-b-cyan-800 rounded-none p-3">
                      <LedgerForm
                        form={ledgerForm}
                        baseCurrency={activePortfolio.baseCurrency}
                        onChange={updateLedgerForm}
                        onSubmit={handleSubmitLedgerEntry}
                        onCancel={handleCancelLedgerEdit}
                      />
                    </div>
                  )}

                  {activePortfolio && !ledgerLoading && !ledgerError && (
                    <>
                      {filteredLedgerEntries.length === 0 ? (
                        <EmptyState message="暂无流水记录。" />
                      ) : (
                        <LedgerTable
                          entries={filteredLedgerEntries}
                          onEdit={handleEditLedgerEntry}
                          onDelete={handleRequestDeleteLedgerEntry}
                        />
                      )}
                    </>
                  )}
                </Panel>
              )}

              {portfolioTab === "risk" && (
                <Panel>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">风险指标</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        波动率与最大回撤基于区间曲线计算。
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {performanceRanges.map((range) => {
                        const isActive = performanceRange === range.key;
                        return (
                          <button
                            key={range.key}
                            type="button"
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                              isActive
                                ? "bg-primary text-white border-primary"
                                : "bg-white dark:bg-surface-dark text-slate-500 dark:text-slate-300 border-slate-200 dark:border-border-dark hover:text-slate-900 dark:hover:text-white"
                            }`}
                            onClick={() => setPerformanceRange(range.key)}
                          >
                            {range.label}
                          </button>
                        );
                      })}
                      <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300 ml-2">
                        <input
                          type="checkbox"
                          checked={riskAnnualized}
                          onChange={(e) => setRiskAnnualized(e.target.checked)}
                          className="h-3.5 w-3.5 rounded-none border-slate-300 text-primary focus:ring-primary"
                        />
                        年化波动
                      </label>
                    </div>
                  </div>

                  {performanceLoading && <EmptyState message="正在加载风险指标..." />}
                  {!performanceLoading && performanceError && (
                    <ErrorState
                      message={performanceError}
                      onRetry={() => {
                        if (!activePortfolioId) return;
                        loadPerformance(activePortfolioId, performanceRange).catch((err) =>
                          setPerformanceError(toUserErrorMessage(err))
                        );
                      }}
                    />
                  )}
                  {!performanceLoading && !performanceError && !activePortfolio && (
                    <EmptyState message="请先选择或创建组合。" />
                  )}
                  {!performanceLoading &&
                    !performanceError &&
                    activePortfolio &&
                    !performanceResult && <EmptyState message="暂无风险数据。" />}

                  {!performanceLoading &&
                    !performanceError &&
                    activePortfolio && (
                      <div className="space-y-4">
                        {riskMetrics ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <RiskMetricCard
                              title="估值曲线"
                              metrics={riskMetrics.nav}
                              annualized={riskAnnualized}
                            />
                            <RiskMetricCard
                              title="TWR 曲线"
                              metrics={riskMetrics.twr}
                              annualized={riskAnnualized}
                            />
                          </div>
                        ) : (
                          <EmptyState message="暂无风险指标。" />
                        )}
                        {snapshot && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-slate-50 dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark border border-slate-200/80 dark:border-border-dark rounded-lg p-4">
                              <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">
                                集中度 (HHI)
                              </div>
                              <div className="text-2xl font-mono text-slate-800 dark:text-slate-100">
                                {hhiValue === null ? "--" : hhiValue.toFixed(3)}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                阈值 {HHI_WARN_THRESHOLD.toFixed(2)}
                              </div>
                              {hhiValue !== null && hhiValue >= HHI_WARN_THRESHOLD && (
                                <div className="mt-2 text-xs text-rose-600 dark:text-rose-400">
                                  集中度偏高，请关注单一标的风险。
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                </Panel>
              )}

              {["allocation", "corporate"].includes(portfolioTab) && (
                <PlaceholderPanel
                  title={portfolioTabs.find((tab) => tab.key === portfolioTab)?.label ?? ""}
                  description={portfolioTabs.find((tab) => tab.key === portfolioTab)?.description ?? ""}
                />
              )}
            </>
          )}

          {/* View: Risk */}
          {activeView === "risk" && (
            <Panel>
              {!snapshot ? <EmptyState message="暂无风险数据。" /> : (
                <div className="space-y-8 max-w-6xl">
                  {/* Exposure Table */}
                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 pl-1">资产敞口分布</h3>
                    <div className="overflow-hidden border border-slate-200 dark:border-border-dark">
                      <table className="min-w-full divide-y divide-slate-200 dark:divide-border-dark">
                         <thead className="bg-slate-50 dark:bg-background-dark">
                           <tr>
                             <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">资产类别</th>
                             <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">权重</th>
                             <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">市值</th>
                           </tr>
                         </thead>
                         <tbody className="bg-white dark:bg-surface-dark/70 divide-y divide-slate-200 dark:divide-border-dark">
                           {snapshot.exposures.byAssetClass.map(e => (
                             <tr key={e.key}>
                               <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">{formatAssetClassLabel(e.key)}</td>
                               <td className="px-4 py-2 text-sm text-right font-mono text-slate-600 dark:text-slate-400">{formatPct(e.weight)}</td>
                               <td className="px-4 py-2 text-sm text-right font-mono text-slate-900 dark:text-white">{formatCurrency(e.marketValue)}</td>
                             </tr>
                           ))}
                         </tbody>
                      </table>
                    </div>
                  </section>
                  
                  {/* Risk Limits */}
                  <section>
                     <div className="flex justify-between items-center mb-3 px-1">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">限额监控</h3>
                        {snapshot.riskWarnings.length > 0 && (
                          <span className="text-xs font-medium text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
                            {snapshot.riskWarnings.length} 个预警
                          </span>
                        )}
                     </div>
                     <div className="space-y-4">
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                         {snapshot.riskLimits.map(limit => (
                           <div key={limit.id} className="bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark border border-slate-200 dark:border-border-dark p-4 flex flex-col justify-between hover:border-slate-300 dark:hover:border-border-dark/80 transition-colors">
                              <div className="flex justify-between items-start mb-2">
                                 <div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{formatRiskLimitTypeLabel(limit.limitType)}</div>
                                    <div className="font-medium text-slate-900 dark:text-white mt-1 text-lg">{limit.target}</div>
                                 </div>
                                 <div className="text-xl font-mono font-light text-slate-700 dark:text-slate-300">{formatPct(limit.threshold)}</div>
                              </div>
                              <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-border-dark">
                                 <button onClick={() => handleEditRiskLimit(limit)} className="text-xs font-medium text-slate-500 hover:text-primary transition-colors">编辑</button>
                                 <button onClick={() => handleDeleteRiskLimit(limit.id)} className="text-xs font-medium text-slate-500 hover:text-red-500 transition-colors">删除</button>
                              </div>
                           </div>
                         ))}
                         {/* Add New Limit Form */}
                         <div className="bg-slate-50 dark:bg-background-dark border border-dashed border-slate-300 dark:border-border-dark p-4 flex flex-col gap-3">
                           <div className="text-xs font-bold text-slate-400 uppercase text-center">{riskForm.id ? "编辑限额" : "新增限额"}</div>
                           <Select 
                              value={riskForm.limitType} 
                              onChange={(e) => setRiskForm(p => ({ ...p, limitType: e.target.value as RiskLimitType }))}
                              options={Object.entries(riskLimitTypeLabels).map(([v, l]) => ({ value: v, label: l }))}
                              className="text-xs"
                           />
                           <Input 
                              value={riskForm.target} 
                              onChange={(e) => setRiskForm(p => ({ ...p, target: e.target.value }))}
                              placeholder="目标 (如 600519)"
                              className="text-xs"
                           />
                           <Input 
                              type="number"
                              value={riskForm.thresholdPct} 
                              onChange={(e) => setRiskForm(p => ({ ...p, thresholdPct: e.target.value }))}
                              placeholder="阈值 %"
                              className="text-xs"
                           />
                           <div className="flex gap-2 mt-auto pt-2">
                              <Button variant="primary" size="sm" onClick={handleSubmitRiskLimit} className="w-full">{riskForm.id ? "保存" : "添加"}</Button>
                              {riskForm.id && <Button variant="secondary" size="sm" onClick={handleCancelRiskEdit}>取消</Button>}
                           </div>
                         </div>
                       </div>
                     </div>
                  </section>
                </div>
              )}
            </Panel>
          )}

          {/* View: Market */}
          {activeView === "market" && (
            <>
              <div className="h-full min-h-0 flex">
                {/* Explorer Sidebar */}
                <aside
                  className="flex-shrink-0 min-h-0 flex flex-col border-r border-border-light dark:border-border-dark bg-white/70 dark:bg-background-dark/65 backdrop-blur-lg"
                  style={{ width: marketExplorerWidth }}
                >
                  <div className="pt-0 pb-0 border-b border-border-light dark:border-border-dark space-y-0">
                    <div className="w-full rounded-none border border-slate-200 dark:border-border-dark bg-white/75 dark:bg-panel-dark/80 backdrop-blur shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_1px_12px_rgba(0,0,0,0.35)] focus-within:border-primary/60">
                      <div className="flex items-center px-0 bg-transparent dark:bg-white/5">
                        <div className="flex-1 relative">
                          <span className="material-icons-outlined absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                            search
                          </span>
                          <Input
                            value={marketSearchQuery}
                            onChange={(e) => setMarketSearchQuery(e.target.value)}
                            placeholder="搜索标的（代码/名称）"
                            className="pl-9 pr-2 !rounded-none !border-0 !bg-transparent dark:!bg-transparent shadow-none focus:ring-0 focus:border-transparent dark:placeholder:text-slate-500"
                          />
                        </div>
                      </div>

                      <div className="relative border-t border-slate-200/70 dark:border-border-dark/70">
                        <PopoverSelect
                          value={marketCollectionSelectValue}
                          onChangeValue={(value) => {
                            setMarketSearchQuery("");
                            setMarketSelectedSymbol(null);

                            if (value === "builtin:holdings") {
                              setMarketScope("holdings");
                              setMarketSelectedTag(null);
                              return;
                            }

                            if (value === "builtin:watchlist") {
                              setMarketScope("tags");
                              void handleSelectTag("watchlist:all");
                              return;
                            }

                            if (value.startsWith("tag:")) {
                              setMarketScope("tags");
                              void handleSelectTag(value.slice("tag:".length));
                            }
                          }}
                          options={[
                            { value: "builtin:holdings", label: "持仓" },
                            { value: "builtin:watchlist", label: "自选" },
                            ...marketTags
                              .filter(
                                (tag) =>
                                  !(
                                    tag.source === "watchlist" &&
                                    tag.tag === "watchlist:all"
                                  )
                              )
                              .map((tag) => {
                                const sourceLabel =
                                  tag.source === "provider"
                                    ? "提供方"
                                    : tag.source === "user"
                                      ? "用户"
                                      : "自选";
                                return {
                                  value: `tag:${tag.tag}`,
                                  label: `${sourceLabel}：${tag.tag}`
                                };
                              })
                          ]}
                          className="w-full"
                          buttonClassName="!rounded-none !border-0 !bg-transparent dark:!bg-transparent !shadow-none hover:!bg-transparent dark:hover:!bg-transparent pl-9 pr-8"
                        />

                        <IconButton
                          icon="filter_alt"
                          label={
                            marketFiltersActiveCount > 0
                              ? `筛选（${marketFiltersActiveCount}）`
                              : "筛选"
                          }
                          onClick={() => setMarketFiltersOpen(true)}
                          size="sm"
                          className="absolute right-0 top-0 z-10 h-6 w-6 rounded-none border-0 border-l border-slate-200/70 dark:border-border-dark/70"
                        />
                      </div>
                    </div>

                    {marketCatalogSyncSummary && marketSearchQuery.trim() && (
                      <div className="px-3 text-[11px] text-slate-500 dark:text-slate-400">
                        {marketCatalogSyncSummary}
                      </div>
                    )}

                    {(marketWatchlistLoading || marketQuotesLoading) && (
                      <div className="px-3 flex items-center justify-end text-[10px] leading-4 text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-2">
                          {marketWatchlistLoading && <span>自选更新中…</span>}
                          {marketQuotesLoading && <span>报价加载中…</span>}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto">
                    {marketEffectiveScope === "search" && (
                      <div className="py-2">
                        {marketSearchLoading && (
                          <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                            搜索中...
                          </div>
                        )}
                        {!marketSearchLoading && marketSearchQuery.trim() === "" && (
                          <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                            输入关键词开始搜索（如 600519 / 贵州茅台 / 510300）。
                          </div>
                        )}
                        {!marketSearchLoading &&
                          marketSearchQuery.trim() !== "" &&
                          marketSearchResults.length === 0 && (
                            <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                              <div className="flex items-center justify-between gap-2">
                                <span>未找到匹配标的（需先同步标的库）。</span>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  icon="download"
                                  onClick={handleSyncInstrumentCatalog}
                                  disabled={marketCatalogSyncing}
                                >
                                  {marketCatalogSyncing ? "同步中" : "同步"}
                                </Button>
                              </div>
                            </div>
                          )}

                        {!marketSearchLoading &&
                          marketSearchQuery.trim() !== "" &&
                          marketSearchResults.length > 0 &&
                          marketSearchResultsFiltered.length === 0 && (
                            <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                              筛选后无结果。
                            </div>
                          )}

                        {marketSearchResultsFiltered.map((item) => {
                          const isActive = item.symbol === marketSelectedSymbol;
                          const quote = marketQuotesBySymbol[item.symbol] ?? null;
                          const tone = getCnChangeTone(quote?.changePct ?? null);
                          return (
                            <button
                              key={item.symbol}
                              type="button"
                              onClick={() => handleSelectInstrument(item.symbol)}
                              className={`w-full text-left px-3 py-2 border-b border-slate-200/70 dark:border-border-dark/70 last:border-b-0 transition-colors ${
                                isActive
                                  ? "bg-primary/10"
                                  : "hover:bg-slate-50 dark:hover:bg-background-dark/70"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                    {item.name ?? item.symbol}
                                  </div>
                                  <div className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                    {item.symbol}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-mono text-sm text-slate-900 dark:text-white">
                                    {formatNumber(quote?.close ?? null, 2)}
                                  </div>
                                  <div
                                    className={`font-mono text-[11px] ${getCnToneTextClass(tone)}`}
                                  >
                                    {formatSignedPctNullable(quote?.changePct ?? null)}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {marketEffectiveScope === "holdings" && (
                      <div className="py-2">
                        {!snapshot && (
                          <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                            暂无组合数据。
                          </div>
                        )}
                        {snapshot && marketHoldingsSymbols.length === 0 && (
                          <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                            当前组合没有股票/ETF 持仓。
                          </div>
                        )}
                        {snapshot &&
                          marketHoldingsSymbols.length > 0 &&
                          marketHoldingsSymbolsFiltered.length === 0 && (
                            <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                              筛选后无结果。
                            </div>
                          )}
                        {marketFilteredListSymbols.map((symbol) => {
                          const isActive = symbol === marketSelectedSymbol;
                          const quote = marketQuotesBySymbol[symbol] ?? null;
                          const tone = getCnChangeTone(quote?.changePct ?? null);
                          const name = marketNameBySymbol.get(symbol) ?? symbol;
                          return (
                            <button
                              key={symbol}
                              type="button"
                              onClick={() => handleSelectInstrument(symbol)}
                              className={`w-full text-left px-3 py-2 border-b border-slate-200/70 dark:border-border-dark/70 last:border-b-0 transition-colors ${
                                isActive
                                  ? "bg-primary/10"
                                  : "hover:bg-slate-50 dark:hover:bg-background-dark/70"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                    {name}
                                  </div>
                                  <div className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                    {symbol}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-mono text-sm text-slate-900 dark:text-white">
                                    {formatNumber(quote?.close ?? null, 2)}
                                  </div>
                                  <div
                                    className={`font-mono text-[11px] ${getCnToneTextClass(tone)}`}
                                  >
                                    {formatSignedPctNullable(quote?.changePct ?? null)}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {marketEffectiveScope === "tags" && (
                      <div className="py-2">
                        {!marketSelectedTag && (
                          <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                            请选择一个集合（如 watchlist:all、industry:白酒）。
                          </div>
                        )}

                        {marketSelectedTag && (
                          <>
                            <button
                              type="button"
                              onClick={() => setMarketSelectedSymbol(null)}
                              className={`w-full text-left px-3 py-2 border-b border-slate-200/70 dark:border-border-dark/70 transition-colors ${
                                marketSelectedSymbol === null
                                  ? "bg-primary/10"
                                  : "hover:bg-slate-50 dark:hover:bg-background-dark/70"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                    整体（市值加权）
                                  </div>
                                  <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                    {marketSelectedTagAggregate
                                      ? `覆盖 ${marketSelectedTagAggregate.includedCount}/${marketSelectedTagAggregate.totalCount}`
                                      : "--"}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div
                                    className={`font-mono text-sm ${getCnToneTextClass(
                                      getCnChangeTone(
                                        marketSelectedTagAggregate?.weightedChangePct ??
                                          null
                                      )
                                    )}`}
                                  >
                                    {formatSignedPctNullable(
                                      marketSelectedTagAggregate?.weightedChangePct ?? null
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                    流通市值权重
                                  </div>
                                </div>
                              </div>
                            </button>

                            {marketTagMembersLoading && (
                              <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                                加载集合成分中...
                              </div>
                            )}

                            {!marketTagMembersLoading &&
                              marketFilteredListSymbols.map((symbol) => {
                                const isActive = symbol === marketSelectedSymbol;
                                const quote = marketQuotesBySymbol[symbol] ?? null;
                                const tone = getCnChangeTone(quote?.changePct ?? null);
                                const name = marketNameBySymbol.get(symbol) ?? symbol;
                                const canRemove =
                                  marketSelectedTag.startsWith("watchlist:");
                                return (
                                  <button
                                    key={symbol}
                                    type="button"
                                    onClick={() => handleSelectInstrument(symbol)}
                                    className={`w-full text-left px-3 py-2 border-b border-slate-200/70 dark:border-border-dark/70 last:border-b-0 transition-colors ${
                                      isActive
                                        ? "bg-primary/10"
                                        : "hover:bg-slate-50 dark:hover:bg-background-dark/70"
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0 flex-1">
                                        <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                          {name}
                                        </div>
                                        <div className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                          {symbol}
                                        </div>
                                      </div>
                                      <div className="flex items-start gap-2">
                                        <div className="text-right">
                                          <div className="font-mono text-sm text-slate-900 dark:text-white">
                                            {formatNumber(quote?.close ?? null, 2)}
                                          </div>
                                          <div
                                            className={`font-mono text-[11px] ${getCnToneTextClass(tone)}`}
                                          >
                                            {formatSignedPctNullable(
                                              quote?.changePct ?? null
                                            )}
                                          </div>
                                        </div>
                                        {canRemove && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              void handleRemoveWatchlistItem(symbol);
                                            }}
                                            className="mt-0.5 text-slate-400 hover:text-red-500"
                                            aria-label={`从自选移除 ${symbol}`}
                                            title="从自选移除"
                                          >
                                            <span className="material-icons-outlined text-base">
                                              close
                                            </span>
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </aside>

                <div
                  role="separator"
                  aria-orientation="vertical"
                  tabIndex={0}
                  onPointerDown={handleMarketExplorerResizePointerDown}
                  onKeyDown={handleMarketExplorerResizeKeyDown}
                  className="w-1 flex-shrink-0 cursor-col-resize bg-transparent hover:bg-primary/20 focus:bg-primary/25 focus:outline-none"
                  title="拖拽调节宽度（←/→ 可微调）"
                />

                {/* Detail Workspace */}
                <main className="flex-1 min-w-0 min-h-0 overflow-hidden bg-white/40 dark:bg-background-dark/40">
                  {!marketSelectedSymbol &&
                    !(marketEffectiveScope === "tags" && marketSelectedTag) && (
                    <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400">
                      请选择左侧列表中的标的或集合。
                    </div>
                  )}

                  {marketEffectiveScope === "tags" && marketSelectedTag && !marketSelectedSymbol && (
                    <div className="h-full min-h-0 flex flex-col">
                      <div className="flex-shrink-0 border-b border-border-light dark:border-border-dark bg-white/70 dark:bg-background-dark/70 backdrop-blur-lg px-6 py-5">
                        <div className="flex items-start justify-between gap-6">
                          <div>
                            <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
                              {marketSelectedTag}
                            </div>
                            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                              市值加权口径：流通市值（circ_mv）；缺价格/缺市值成分会被剔除并重归一化权重。
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div
                              className={`text-2xl font-mono font-semibold ${getCnToneTextClass(
                                getCnChangeTone(
                                  marketSelectedTagAggregate?.weightedChangePct ?? null
                                )
                              )}`}
                            >
                              {formatSignedPctNullable(
                                marketSelectedTagAggregate?.weightedChangePct ?? null
                              )}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {marketSelectedTagAggregate
                                ? `覆盖 ${marketSelectedTagAggregate.includedCount}/${marketSelectedTagAggregate.totalCount}（剔除 ${marketSelectedTagAggregate.excludedCount}）`
                                : "--"}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                icon="format_list_bulleted"
                                onClick={() => setMarketTagMembersModalOpen(true)}
                                disabled={marketTagMembersLoading || marketTagMembers.length === 0}
                              >
                                查看成分
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                icon="folder_open"
                                onClick={() => setMarketTagPickerOpen(true)}
                              >
                                切换集合
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 min-h-0 px-6 py-4 space-y-4">
                        <div className="rounded-xl border border-slate-200 dark:border-border-dark bg-white/70 dark:bg-panel-dark/80 backdrop-blur p-4">
                          <div className="flex items-start justify-between gap-6">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                整体走势（派生指数，base=100）
                              </div>
                              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                权重口径：优先使用上一交易日 `circ_mv`，缺失时回退当日 `circ_mv`；缺价格/缺市值成分会被剔除并重归一化权重。
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <div
                                className={`font-mono text-sm font-semibold ${getCnToneTextClass(
                                  marketSelectedTagSeriesTone
                                )}`}
                              >
                                {formatSignedPctNullable(marketSelectedTagSeriesReturnPct)}
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 relative group h-10 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-0.5 group-hover:opacity-0 transition-opacity">
                              <div className="text-[13px] font-semibold text-slate-900 dark:text-white">
                                {formatCnDate(
                                  marketTagChartHoverDate ??
                                    marketTagSeriesResult?.endDate ??
                                    null
                                )}
                              </div>
                              {marketTagChartHoverPrice !== null && (
                                <div className="text-[14px] font-mono font-semibold text-primary">
                                  {formatNumber(marketTagChartHoverPrice, 2)}
                                </div>
                              )}
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="flex items-center gap-1 rounded-full bg-slate-100/80 dark:bg-black/40 backdrop-blur px-2 py-1">
                                {marketChartRanges.map((item) => {
                                  const isActive = marketChartRange === item.key;
                                  return (
                                    <button
                                      key={item.key}
                                      type="button"
                                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors ${
                                        isActive
                                          ? "bg-primary/20 text-primary dark:bg-white/20 dark:text-white"
                                          : "text-slate-600 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-white/10"
                                      }`}
                                      onClick={() =>
                                        setMarketChartRange(item.key as MarketChartRangeKey)
                                      }
                                    >
                                      {item.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          <div className="h-52 overflow-hidden">
                            {marketTagSeriesLoading && (
                              <div className="h-full flex items-center justify-center text-sm text-slate-500 dark:text-slate-300">
                                加载中...
                              </div>
                            )}
                            {!marketTagSeriesLoading && marketTagSeriesError && (
                              <div className="h-full flex items-center justify-center text-sm text-slate-500 dark:text-slate-300">
                                {marketTagSeriesError}
                              </div>
                            )}
                            {!marketTagSeriesLoading &&
                              !marketTagSeriesError &&
                              marketTagSeriesBars.length === 0 && (
                                <div className="h-full flex items-center justify-center text-sm text-slate-500 dark:text-slate-300">
                                  暂无区间数据（需要 daily_prices + daily_basics/circ_mv）。
                                </div>
                              )}
                            {!marketTagSeriesLoading &&
                              !marketTagSeriesError &&
                              marketTagSeriesBars.length > 0 && (
                                <ChartErrorBoundary
                                  resetKey={`tag-series:${marketSelectedTag}:${marketChartRange}`}
                                >
                                  <MarketAreaChart
                                    bars={marketTagSeriesBars}
                                    tone={marketSelectedTagSeriesTone}
                                    onHoverDatumChange={(datum) => {
                                      setMarketTagChartHoverDate(datum?.date ?? null);
                                      setMarketTagChartHoverPrice(datum?.close ?? null);
                                    }}
                                  />
                                </ChartErrorBoundary>
                              )}
                          </div>

                          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                            <span>{marketTagSeriesLatestCoverageLabel}</span>
                            {marketTagSeriesResult &&
                              marketTagSeriesResult.usedMemberCount <
                                marketTagSeriesResult.memberCount && (
                                <span>
                                  仅使用前 {marketTagSeriesResult.usedMemberCount}/
                                  {marketTagSeriesResult.memberCount}
                                  {marketTagSeriesResult.truncated ? "（总数已截断）" : ""}
                                </span>
                              )}
                          </div>
                        </div>

                        {marketTagMembersLoading && (
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            加载中...
                          </div>
                        )}

                        {!marketTagMembersLoading && marketTagMembers.length === 0 && (
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            暂无成分。
                          </div>
                        )}

                        {!marketTagMembersLoading && marketTagMembers.length > 0 && (
                          <div className="rounded-xl border border-slate-200 dark:border-border-dark overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-white/80 dark:bg-background-dark/80 backdrop-blur">
                                <tr className="text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-border-dark">
                                  <th className="text-left font-semibold px-4 py-2">
                                    Symbol
                                  </th>
                                  <th className="text-right font-semibold px-4 py-2">
                                    Price
                                  </th>
                                  <th className="text-right font-semibold px-4 py-2">
                                    Change%
                                  </th>
                                  <th className="text-right font-semibold px-4 py-2">
                                    circ_mv
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {sortTagMembersByChangePct(
                                  marketTagMembers,
                                  marketQuotesBySymbol
                                )
                                  .slice(0, 20)
                                  .map((symbol) => {
                                    const quote = marketQuotesBySymbol[symbol] ?? null;
                                    const tone = getCnChangeTone(quote?.changePct ?? null);
                                    return (
                                      <tr
                                        key={symbol}
                                        className="border-b border-slate-200/70 dark:border-border-dark/70 last:border-b-0 hover:bg-slate-50 dark:hover:bg-background-dark/70 cursor-pointer"
                                        onClick={() => handleSelectInstrument(symbol)}
                                      >
                                        <td className="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-200">
                                          {symbol}
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono text-xs text-slate-900 dark:text-white">
                                          {formatNumber(quote?.close ?? null, 2)}
                                        </td>
                                        <td
                                          className={`px-4 py-2 text-right font-mono text-xs ${getCnToneTextClass(
                                            tone
                                          )}`}
                                        >
                                          {formatSignedPctNullable(quote?.changePct ?? null)}
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono text-xs text-slate-500 dark:text-slate-400">
                                          {formatNumber(quote?.circMv ?? null, 2)}
                                        </td>
                                      </tr>
                                    );
                                  })}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {!marketTagMembersLoading && marketTagMembers.length > 20 && (
                          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            仅展示前 20 个标的（共 {marketTagMembers.length}）。点击“查看成分”查看完整列表。
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {marketSelectedSymbol && (
                    <div className="h-full min-h-0 grid grid-rows-[1.3fr_5.7fr_3fr]">
                      <div className="min-h-0 border-b border-border-light dark:border-border-dark bg-white/70 dark:bg-background-dark/70 backdrop-blur-lg px-6 py-4">
                        <div className="flex items-start justify-between gap-6">
                          <div className="min-w-0">
                            <div className="flex items-baseline gap-3 flex-wrap">
                              <div className="text-4xl font-extrabold text-slate-900 dark:text-white">
                                {marketSelectedProfile?.symbol ?? marketSelectedSymbol}
                              </div>
                              <div className="text-lg font-semibold text-slate-700 dark:text-slate-200 truncate">
                                {marketSelectedProfile?.name ?? "--"}
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                              {marketSelectedProfile?.market ?? "--"} ·{" "}
                              {marketSelectedProfile?.currency ?? "--"} ·{" "}
                              {marketSelectedProfile?.assetClass ?? "--"}
                            </div>
                          </div>

                          <div className="flex items-start gap-4">
                            <div className="flex flex-col items-end gap-1">
                              <MarketQuoteHeader quote={marketSelectedQuote} />
                            </div>
                            <div className="flex flex-col items-end gap-2 pt-1">
                              <div className="flex items-center gap-2">
                                {marketEffectiveScope === "tags" && marketSelectedTag && (
                                  <IconButton
                                    icon="arrow_back"
                                    label="返回集合"
                                    onClick={() => setMarketSelectedSymbol(null)}
                                  />
                                )}
                                <IconButton
                                  icon="star"
                                  label="加入自选"
                                  onClick={handleAddSelectedToWatchlist}
                                  disabled={!marketSelectedProfile}
                                />
                                <IconButton
                                  icon="info"
                                  label="标的详情"
                                  onClick={() => setMarketInstrumentDetailsOpen(true)}
                                  disabled={!marketSelectedProfile}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="min-h-0 px-6 pt-3 pb-3 flex flex-col">
                        <div className="flex-shrink-0 pb-1">
                          <div className="relative group h-9">
                            <div className="absolute inset-0 z-0 flex items-center justify-center">
                              <div className="flex flex-col items-center gap-0.5 group-hover:opacity-0 transition-opacity">
                                <div className="text-[13px] font-semibold text-slate-900 dark:text-white">
                                  {formatCnDate(
                                    marketChartHoverDate ??
                                      marketSelectedQuote?.tradeDate ??
                                      marketLatestBar?.date ??
                                      null
                                  )}
                                </div>
                                {marketChartHoverPrice !== null && (
                                  <div className="text-[14px] font-mono font-semibold text-primary">
                                    {formatNumber(marketChartHoverPrice, 2)}
                                  </div>
                                )}
                              </div>
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="flex items-center gap-1 rounded-full bg-slate-100/80 dark:bg-black/40 backdrop-blur px-2 py-1">
                                  {marketChartRanges.map((item) => {
                                    const isActive = marketChartRange === item.key;
                                    return (
                                      <button
                                        key={item.key}
                                        type="button"
                                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors ${
                                          isActive
                                            ? "bg-primary/20 text-primary dark:bg-white/20 dark:text-white"
                                            : "text-slate-600 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-white/10"
                                        }`}
                                        onClick={() =>
                                          setMarketChartRange(item.key as MarketChartRangeKey)
                                        }
                                      >
                                        {item.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                            <div className="relative z-10 h-full flex items-center justify-between gap-3">
                              <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
                                <div className="flex items-baseline gap-1">
                                  <span>持仓价</span>
                                  <span className="font-mono text-xs text-slate-900 dark:text-white">
                                    {marketHoldingUnitCost === null
                                      ? "-"
                                      : formatNumber(marketHoldingUnitCost, 2)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-baseline gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                                <span>目标价</span>
                                <span
                                  className="font-mono text-xs text-slate-900 dark:text-white"
                                  title="可用用户标签 target:xx.xx 设置"
                                >
                                  {marketTargetPrice === null
                                    ? "-"
                                    : formatNumber(marketTargetPrice, 2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex-1 min-h-0 overflow-hidden relative">
                          {!marketChartHasEnoughData && (
                            <div className="h-full flex items-center justify-center text-sm text-slate-500 dark:text-slate-300">
                              {marketChartLoading ? "加载中..." : "暂无足够数据绘制图表。"}
                            </div>
                          )}

                          {marketChartHasEnoughData && (
                            <ChartErrorBoundary
                              resetKey={`symbol:${marketSelectedSymbol}:${marketChartRange}:${marketVolumeMode}`}
                            >
                              <MarketAreaChart
                                bars={marketChartBars}
                                tone={getCnChangeTone(
                                  marketSelectedQuote?.changePct ?? null
                                )}
                                onHoverDatumChange={(datum) => {
                                  setMarketChartHoverDate(datum?.date ?? null);
                                  setMarketChartHoverPrice(datum?.close ?? null);
                                }}
                              />
                            </ChartErrorBoundary>
                          )}

                          {marketChartLoading && marketChartHasEnoughData && (
                            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500 dark:text-slate-300 bg-white/40 dark:bg-black/20 backdrop-blur-sm">
                              加载中...
                            </div>
                          )}
                        </div>

                        <div className="flex-shrink-0 pt-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {marketVolumeMode === "volume" ? "每日成交量" : "势能（moneyflow）"}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-xs font-mono text-slate-700 dark:text-slate-200">
                                {marketVolumeMode === "volume" ? (
                                  formatCnWanYiNullable(marketActiveVolume, 2, 0)
                                ) : (
                                  <>
                                    {formatSignedCnWanYiNullable(marketActiveMoneyflowVol, 2, 0)}
                                    {marketActiveMoneyflowRatio !== null && (
                                      <span className="text-slate-400 dark:text-slate-500">
                                        {" "}
                                        · {(marketActiveMoneyflowRatio * 100).toFixed(1)}%
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                              <div className="flex items-center gap-1 rounded-full bg-slate-100/80 dark:bg-black/40 backdrop-blur px-1 py-1">
                                <button
                                  type="button"
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors ${
                                    marketVolumeMode === "volume"
                                      ? "bg-primary/20 text-primary dark:bg-white/20 dark:text-white"
                                      : "text-slate-600 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-white/10"
                                  }`}
                                  onClick={() => setMarketVolumeMode("volume")}
                                >
                                  总成交量
                                </button>
                                <button
                                  type="button"
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors ${
                                    marketVolumeMode === "moneyflow"
                                      ? "bg-primary/20 text-primary dark:bg-white/20 dark:text-white"
                                      : "text-slate-600 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-white/10"
                                  }`}
                                  onClick={() => setMarketVolumeMode("moneyflow")}
                                  title="势能来自行情数据源（Tushare moneyflow）。占比=|势能|/总成交量。"
                                >
                                  势能
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="mt-1 h-12 overflow-hidden">
                            <MarketVolumeMiniChart
                              bars={marketChartBars}
                              mode={marketVolumeMode}
                              activeDate={marketChartHoverDate}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="min-h-0 px-6 pb-6">
                        <div className="h-full border-t border-slate-200 dark:border-border-dark">
                          <table className="w-full text-sm">
                            <tbody className="divide-y divide-slate-200 dark:divide-border-dark">
                              <tr>
                                <td className="py-2 text-xs text-slate-500 dark:text-slate-400">
                                  今日开盘价
                                </td>
                                <td className="py-2 text-right font-mono text-sm text-slate-900 dark:text-white">
                                  {formatNumber(marketLatestBar?.open ?? null, 2)}
                                </td>
                                <td className="py-2 pl-6 text-xs text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-border-dark">
                                  区间最高价
                                </td>
                                <td className="py-2 text-right font-mono text-sm text-slate-900 dark:text-white">
                                  {formatNumber(marketRangeSummary.rangeHigh, 2)}
                                </td>
                              </tr>
                              <tr>
                                <td className="py-2 text-xs text-slate-500 dark:text-slate-400">
                                  今日最高价
                                </td>
                                <td className="py-2 text-right font-mono text-sm text-slate-900 dark:text-white">
                                  {formatNumber(marketLatestBar?.high ?? null, 2)}
                                </td>
                                <td className="py-2 pl-6 text-xs text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-border-dark">
                                  区间最低价
                                </td>
                                <td className="py-2 text-right font-mono text-sm text-slate-900 dark:text-white">
                                  {formatNumber(marketRangeSummary.rangeLow, 2)}
                                </td>
                              </tr>
                              <tr>
                                <td className="py-2 text-xs text-slate-500 dark:text-slate-400">
                                  今日最低价
                                </td>
                                <td className="py-2 text-right font-mono text-sm text-slate-900 dark:text-white">
                                  {formatNumber(marketLatestBar?.low ?? null, 2)}
                                </td>
                                <td className="py-2 pl-6 text-xs text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-border-dark">
                                  平均成交量
                                </td>
                                <td className="py-2 text-right font-mono text-sm text-slate-900 dark:text-white">
                                  {formatCnWanYiNullable(marketRangeSummary.avgVolume, 2, 0)}
                                </td>
                              </tr>
                              <tr>
                                <td className="py-2 text-xs text-slate-500 dark:text-slate-400">
                                  成交量
                                </td>
                                <td className="py-2 text-right font-mono text-sm text-slate-900 dark:text-white">
                                  {formatCnWanYiNullable(marketLatestBar?.volume ?? null, 2, 0)}
                                </td>
                                <td className="py-2 pl-6 text-xs text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-border-dark">
                                  区间收益率
                                </td>
                                <td className="py-2 text-right font-mono text-sm text-slate-900 dark:text-white">
                                  {formatSignedPctNullable(marketRangeSummary.rangeReturn)}
                                </td>
                              </tr>
                              <tr>
                                <td className="py-2 text-xs text-slate-500 dark:text-slate-400">
                                  前收
                                </td>
                                <td className="py-2 text-right font-mono text-sm text-slate-900 dark:text-white">
                                  {formatNumber(marketSelectedQuote?.prevClose ?? null, 2)}
                                </td>
                                <td className="py-2 pl-6 text-xs text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-border-dark">
                                  流通市值
                                </td>
                                <td className="py-2 text-right font-mono text-sm text-slate-900 dark:text-white">
                                  {formatCnWanYiNullable(marketSelectedQuote?.circMv ?? null, 2, 0)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </main>
              </div>

              <Modal
                open={marketFiltersOpen}
                title="筛选"
                onClose={() => setMarketFiltersOpen(false)}
              >
                <div className="space-y-4">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    当前筛选对「搜索 / 持仓」生效；集合成分（Tags）暂不做元数据筛选。
                  </div>

                  <FormGroup label="市场（market）">
                    <div className="flex items-center gap-2">
                      {([
                        { key: "all", label: "全部" },
                        { key: "CN", label: "CN" }
                      ] as const).map((item) => {
                        const isActive = marketFilterMarket === item.key;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                              isActive
                                ? "bg-primary/20 text-primary dark:bg-white/20 dark:text-white"
                                : "bg-slate-100 dark:bg-background-dark/80 text-slate-600 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-white/10"
                            }`}
                            onClick={() => setMarketFilterMarket(item.key)}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </FormGroup>

                  <FormGroup label="资产类别（assetClass）">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-slate-700 dark:text-slate-200">
                      {([
                        { key: "stock", label: "stock" },
                        { key: "etf", label: "etf" }
                      ] as const).map((item) => (
                        <label key={item.key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={marketFilterAssetClasses.includes(item.key)}
                            onChange={() =>
                              setMarketFilterAssetClasses((prev) =>
                                prev.includes(item.key)
                                  ? prev.filter((v) => v !== item.key)
                                  : [...prev, item.key]
                              )
                            }
                          />
                          <span className="font-mono text-xs">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </FormGroup>

                  <FormGroup label="标的类型（kind，仅搜索结果）">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-slate-700 dark:text-slate-200">
                      {([
                        { key: "stock", label: "stock" },
                        { key: "fund", label: "fund" }
                      ] as const).map((item) => (
                        <label key={item.key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={marketFilterKinds.includes(item.key)}
                            onChange={() =>
                              setMarketFilterKinds((prev) =>
                                prev.includes(item.key)
                                  ? prev.filter((v) => v !== item.key)
                                  : [...prev, item.key]
                              )
                            }
                          />
                          <span className="font-mono text-xs">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </FormGroup>

                  <div className="flex items-center justify-between gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="restart_alt"
                      onClick={resetMarketFilters}
                      disabled={marketFiltersActiveCount === 0}
                    >
                      重置
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      icon="done"
                      onClick={() => setMarketFiltersOpen(false)}
                    >
                      完成
                    </Button>
                  </div>
                </div>
              </Modal>

              <Modal
                open={marketInstrumentDetailsOpen}
                title="标的详情"
                onClose={() => setMarketInstrumentDetailsOpen(false)}
              >
                {!marketSelectedSymbol && (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    暂无选中标的。
                  </div>
                )}

                {marketSelectedSymbol && marketSelectedProfile === null && (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    载入中或该标的暂无详情：{" "}
                    <span className="font-mono">{marketSelectedSymbol}</span>
                  </div>
                )}

                {marketSelectedProfile && (
                  <div className="space-y-5">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-lg font-semibold text-slate-900 dark:text-white">
                          {marketSelectedProfile.name ?? "--"}
                        </span>
                        <span className="font-mono text-sm text-slate-600 dark:text-slate-300">
                          {marketSelectedProfile.symbol}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        提供方：{marketSelectedProfile.provider} · 类型：{" "}
                        {marketSelectedProfile.kind} · 资产类别：{" "}
                        {marketSelectedProfile.assetClass ?? "--"} · 市场：{" "}
                        {marketSelectedProfile.market ?? "--"} · 币种：{" "}
                        {marketSelectedProfile.currency ?? "--"}
                      </div>
                    </div>

                    <FormGroup label="自选">
                      <div className="flex gap-2">
                        <Input
                          value={marketWatchlistGroupDraft}
                          onChange={(e) => setMarketWatchlistGroupDraft(e.target.value)}
                          placeholder="自选分组（可选）"
                          className="text-xs"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          icon="star"
                          onClick={handleAddSelectedToWatchlist}
                        >
                          加入自选
                        </Button>
                      </div>
                    </FormGroup>

                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        提供方标签（可加入自动拉取筛选）
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {marketSelectedProfile.tags.length === 0 && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            --
                          </span>
                        )}
                        {marketSelectedProfile.tags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => handleAddTargetTag(tag)}
                            className="px-2 py-0.5 rounded-full text-[11px] border border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-background-dark/70"
                            title="加入标签筛选"
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        行业（SW 口径）
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {marketSelectedIndustry.length === 0 && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            --
                          </span>
                        )}
                        {marketSelectedIndustry.map((item) => (
                          <button
                            key={item.tag}
                            type="button"
                            onClick={() => handleAddTargetTag(item.tag)}
                            className="px-2 py-0.5 rounded-full text-[11px] border border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-background-dark/70"
                            title="加入标签筛选"
                          >
                            {`L${item.level.slice(1)}:${item.name}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        主题
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {marketSelectedThemes.length === 0 && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            --
                          </span>
                        )}
                        {marketSelectedThemes.map((theme) => (
                          <button
                            key={theme.tag}
                            type="button"
                            onClick={() => handleAddTargetTag(theme.tag)}
                            className="px-2 py-0.5 rounded-full text-[11px] border border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-background-dark/70"
                            title="加入标签筛选"
                          >
                            {formatThemeLabel(theme)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <FormGroup label="手动主题（THS 选择）">
                      <div className="flex gap-2">
                        <PopoverSelect
                          value={marketManualThemeDraft}
                          onChangeValue={setMarketManualThemeDraft}
                          options={marketManualThemeOptions}
                          className="flex-1"
                          disabled={marketManualThemeLoading}
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          icon="add"
                          onClick={handleAddManualTheme}
                          disabled={!marketManualThemeDraft || marketManualThemeLoading}
                        >
                          添加
                        </Button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {marketSelectedManualThemes.length === 0 && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            --
                          </span>
                        )}
                        {marketSelectedManualThemes.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-200"
                          >
                            <button
                              type="button"
                              onClick={() => handleAddTargetTag(tag)}
                              className="hover:underline"
                              title="加入标签筛选"
                            >
                              {tag.replace(/^theme:manual:/, "")}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveUserTag(tag)}
                              className="text-slate-400 hover:text-red-500"
                              aria-label={`移除主题 ${tag}`}
                              title="移除主题"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                      {marketManualThemeOptions.length === 0 && (
                        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          暂无 THS 主题可选（需先同步或导入相关主题标签）。
                        </div>
                      )}
                    </FormGroup>

                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        用户标签
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {marketSelectedPlainUserTags.length === 0 && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            --
                          </span>
                        )}
                        {marketSelectedPlainUserTags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-200"
                          >
                            <button
                              type="button"
                              onClick={() => handleAddTargetTag(tag)}
                              className="hover:underline"
                              title="加入标签筛选"
                            >
                              {tag}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveUserTag(tag)}
                              className="text-slate-400 hover:text-red-500"
                              aria-label={`移除标签 ${tag}`}
                              title="移除标签"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={marketUserTagDraft}
                          onChange={(e) => setMarketUserTagDraft(e.target.value)}
                          placeholder="例如：user:核心 / theme:AI"
                          className="text-xs"
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          icon="add"
                          onClick={handleAddUserTag}
                          disabled={!marketUserTagDraft.trim()}
                        >
                          添加
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          原始字段
                        </div>
                        <button
                          type="button"
                          className="text-xs text-slate-600 dark:text-slate-300 hover:underline"
                          onClick={() => setMarketShowProviderData((prev) => !prev)}
                        >
                          {marketShowProviderData ? "隐藏" : "显示"}
                        </button>
                      </div>
                      {marketShowProviderData && (
                        <pre className="max-h-96 overflow-auto rounded-md bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark p-3 text-xs font-mono text-slate-700 dark:text-slate-200">
                          {JSON.stringify(marketSelectedProfile.providerData, null, 2)}
                        </pre>
                      )}
                      {!marketShowProviderData && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          用于调试与字段映射。
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Modal>

              <Modal
                open={marketTagPickerOpen}
                title="选择集合（Tags）"
                onClose={() => setMarketTagPickerOpen(false)}
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Input
                      value={marketTagPickerQuery}
                      onChange={(e) => setMarketTagPickerQuery(e.target.value)}
                      placeholder="搜索 tag（例如 watchlist / industry / 白酒）"
                      className="text-sm"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="refresh"
                      onClick={() => refreshMarketTags(marketTagPickerQuery)}
                      disabled={marketTagsLoading}
                    >
                      刷新
                    </Button>
                  </div>

                  {marketTagsLoading && (
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      加载中...
                    </div>
                  )}

                  {!marketTagsLoading && marketTags.length === 0 && (
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      暂无可用集合。请先同步标的库或添加自选/用户标签。
                    </div>
                  )}

                  {!marketTagsLoading && marketTags.length > 0 && (
                    <div className="max-h-[520px] overflow-auto rounded-md border border-slate-200 dark:border-border-dark">
                      {marketTags.map((tag) => {
                        const isActive = marketSelectedTag === tag.tag;
                        return (
                          <button
                            key={`${tag.source}:${tag.tag}`}
                            type="button"
                            onClick={() => {
                              setMarketTagPickerOpen(false);
                              setMarketScope("tags");
                              void handleSelectTag(tag.tag);
                            }}
                            className={`w-full text-left px-3 py-2 border-b border-slate-200 dark:border-border-dark last:border-b-0 transition-colors ${
                              isActive
                                ? "bg-primary/10"
                                : "hover:bg-slate-50 dark:hover:bg-background-dark/70"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                  {tag.tag}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {tag.source}
                                </div>
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {tag.memberCount}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Modal>

              <Modal
                open={marketTagMembersModalOpen}
                title={`成分股 · ${marketSelectedTag ?? "--"}`}
                onClose={() => setMarketTagMembersModalOpen(false)}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-mono">
                      {marketTagMembers.length} symbols
                    </span>
                    <span>
                      {marketSelectedTagAggregate
                        ? `覆盖 ${marketSelectedTagAggregate.includedCount}/${marketSelectedTagAggregate.totalCount}（剔除 ${marketSelectedTagAggregate.excludedCount}）`
                        : "--"}
                    </span>
                  </div>

                  {marketTagMembersLoading && (
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      加载中...
                    </div>
                  )}

                  {!marketTagMembersLoading && marketTagMembers.length === 0 && (
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      暂无成分。
                    </div>
                  )}

                  {!marketTagMembersLoading && marketTagMembers.length > 0 && (
                    <div className="rounded-md border border-slate-200 dark:border-border-dark overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-white dark:bg-background-dark">
                          <tr className="text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-border-dark">
                            <th className="text-left font-semibold px-4 py-2">
                              Symbol
                            </th>
                            <th className="text-right font-semibold px-4 py-2">
                              Price
                            </th>
                            <th className="text-right font-semibold px-4 py-2">
                              Change%
                            </th>
                            <th className="text-right font-semibold px-4 py-2">
                              circ_mv
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortTagMembersByChangePct(
                            marketTagMembers,
                            marketQuotesBySymbol
                          )
                            .slice(0, 2000)
                            .map((symbol) => {
                              const quote = marketQuotesBySymbol[symbol] ?? null;
                              const tone = getCnChangeTone(quote?.changePct ?? null);
                              return (
                                <tr
                                  key={symbol}
                                  className="border-b border-slate-200/70 dark:border-border-dark/70 last:border-b-0 hover:bg-slate-50 dark:hover:bg-background-dark/70 cursor-pointer"
                                  onClick={() => {
                                    setMarketTagMembersModalOpen(false);
                                    void handleSelectInstrument(symbol);
                                  }}
                                >
                                  <td className="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-200">
                                    {symbol}
                                  </td>
                                  <td className="px-4 py-2 text-right font-mono text-xs text-slate-900 dark:text-white">
                                    {formatNumber(quote?.close ?? null, 2)}
                                  </td>
                                  <td
                                    className={`px-4 py-2 text-right font-mono text-xs ${getCnToneTextClass(
                                      tone
                                    )}`}
                                  >
                                    {formatSignedPctNullable(quote?.changePct ?? null)}
                                  </td>
                                  <td className="px-4 py-2 text-right font-mono text-xs text-slate-500 dark:text-slate-400">
                                    {formatCnWanYiNullable(quote?.circMv ?? null, 2, 0)}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {!marketTagMembersLoading && marketTagMembers.length > 2000 && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      仅展示前 2000 个标的（共 {marketTagMembers.length}）。
                    </div>
                  )}
                </div>
              </Modal>

              {/*
              <div className="space-y-8 max-w-6xl">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-slate-700 dark:text-slate-200">
                    最新行情日期：
                    <span className="ml-2 font-mono font-medium">
                      {snapshot?.priceAsOf ?? "--"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="refresh"
                      onClick={refreshMarketTargets}
                      disabled={marketTargetsLoading}
                    >
                      刷新 Targets
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="sync"
                      onClick={refreshMarketWatchlist}
                      disabled={marketWatchlistLoading}
                    >
                      刷新自选
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-bold text-slate-900 dark:text-white">
                        标的库（Tushare）
                      </h3>
                      <Button
                        variant="primary"
                        size="sm"
                        icon="download"
                        onClick={handleSyncInstrumentCatalog}
                        disabled={marketCatalogSyncing}
                      >
                        {marketCatalogSyncing ? "同步中..." : "同步"}
                      </Button>
                    </div>
                    {marketCatalogSyncSummary && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {marketCatalogSyncSummary}
                      </div>
                    )}
                    <FormGroup label="搜索（代码 / 名称）">
                      <Input
                        value={marketSearchQuery}
                        onChange={(e) => setMarketSearchQuery(e.target.value)}
                        placeholder="例如：600519 / 贵州茅台 / 510300"
                      />
                    </FormGroup>
                    <div className="border border-slate-200 dark:border-border-dark rounded-md overflow-hidden">
                      <div className="max-h-72 overflow-auto">
                        {marketSearchLoading && (
                          <div className="p-3 text-xs text-slate-500 dark:text-slate-400">
                            搜索中...
                          </div>
                        )}
                        {!marketSearchLoading &&
                          marketSearchQuery.trim() === "" && (
                            <div className="p-3 text-xs text-slate-500 dark:text-slate-400">
                              输入关键词开始搜索（需先同步标的库）。
                            </div>
                          )}
                        {!marketSearchLoading &&
                          marketSearchQuery.trim() !== "" &&
                          marketSearchResults.length === 0 && (
                            <div className="p-3 text-xs text-slate-500 dark:text-slate-400">
                              未找到匹配标的。
                            </div>
                          )}
                        {!marketSearchLoading &&
                          marketSearchResults.map((item) => {
                            const isActive = item.symbol === marketSelectedSymbol;
                            const tagsPreview = item.tags.slice(0, 3);
                            return (
                              <button
                                key={item.symbol}
                                type="button"
                                onClick={() => handleSelectInstrument(item.symbol)}
                                className={`w-full text-left px-3 py-2 border-b border-slate-200 dark:border-border-dark last:border-b-0 transition-colors ${
                                  isActive
                                    ? "bg-primary/10"
                                    : "hover:bg-slate-50 dark:hover:bg-background-dark/70"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">
                                    {item.symbol}
                                  </span>
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                    {item.kind}
                                  </span>
                                </div>
                                <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                  {item.name ?? "--"}
                                </div>
                                {tagsPreview.length > 0 && (
                                  <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                    {tagsPreview.join(" · ")}
                                    {item.tags.length > tagsPreview.length
                                      ? " · …"
                                      : ""}
                                  </div>
                                )}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-bold text-slate-900 dark:text-white">
                        标的详情
                      </h3>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon="star"
                          onClick={handleAddSelectedToWatchlist}
                          disabled={!marketSelectedProfile}
                        >
                          加入自选
                        </Button>
                      </div>
                    </div>

                    {!marketSelectedSymbol && (
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        从左侧搜索结果中选择一个标的查看详情。
                      </div>
                    )}

                    {marketSelectedSymbol && marketSelectedProfile === null && (
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        载入中或该标的暂无详情：{" "}
                        <span className="font-mono">{marketSelectedSymbol}</span>
                      </div>
                    )}

                    {marketSelectedProfile && (
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <span className="text-lg font-semibold text-slate-900 dark:text-white">
                              {marketSelectedProfile.name ?? "--"}
                            </span>
                            <span className="font-mono text-sm text-slate-600 dark:text-slate-300">
                              {marketSelectedProfile.symbol}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            provider: {marketSelectedProfile.provider} · kind:{" "}
                            {marketSelectedProfile.kind} · assetClass:{" "}
                            {marketSelectedProfile.assetClass ?? "--"} · market:{" "}
                            {marketSelectedProfile.market ?? "--"} · currency:{" "}
                            {marketSelectedProfile.currency ?? "--"}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                            Provider 标签（点击可加入 Targets 过滤）
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {marketSelectedProfile.tags.length === 0 && (
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                --
                              </span>
                            )}
                            {marketSelectedProfile.tags.map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => handleAddTargetTag(tag)}
                                className="px-2 py-0.5 rounded-full text-[11px] border border-slate-200 dark:border-border-dark text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-background-dark/70"
                                title="加入 Targets.tagFilters"
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                            用户标签
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {marketSelectedUserTags.length === 0 && (
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                --
                              </span>
                            )}
                            {marketSelectedUserTags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-200"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleAddTargetTag(tag)}
                                  className="hover:underline"
                                  title="加入 Targets.tagFilters"
                                >
                                  {tag}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveUserTag(tag)}
                                  className="text-slate-400 hover:text-red-500"
                                  aria-label={`移除标签 ${tag}`}
                                  title="移除标签"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Input
                              value={marketUserTagDraft}
                              onChange={(e) => setMarketUserTagDraft(e.target.value)}
                              placeholder="例如：my:watch / sector:新能源"
                              className="text-xs"
                            />
                            <Button
                              variant="primary"
                              size="sm"
                              icon="add"
                              onClick={handleAddUserTag}
                              disabled={
                                !marketSelectedSymbol || !marketUserTagDraft.trim()
                              }
                            >
                              添加
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <button
                            type="button"
                            className="text-xs text-slate-600 dark:text-slate-300 hover:underline"
                            onClick={() =>
                              setMarketShowProviderData((prev) => !prev)
                            }
                          >
                            {marketShowProviderData ? "隐藏" : "显示"} 原始字段
                          </button>
                          {marketShowProviderData && (
                            <pre className="max-h-72 overflow-auto rounded-md bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark p-3 text-xs font-mono text-slate-700 dark:text-slate-200">
                              {JSON.stringify(
                                marketSelectedProfile.providerData,
                                null,
                                2
                              )}
                            </pre>
                          )}
                        </div>
                      </div>
                    )}
                  </section>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-bold text-slate-900 dark:text-white">
                        自选列表
                      </h3>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon="refresh"
                        onClick={refreshMarketWatchlist}
                        disabled={marketWatchlistLoading}
                      >
                        刷新
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <Input
                        value={marketWatchlistSymbolDraft}
                        onChange={(e) =>
                          setMarketWatchlistSymbolDraft(e.target.value)
                        }
                        placeholder="代码（如 600519.SH）"
                        className="font-mono text-xs"
                      />
                      <Input
                        value={marketWatchlistGroupDraft}
                        onChange={(e) =>
                          setMarketWatchlistGroupDraft(e.target.value)
                        }
                        placeholder="分组（可选）"
                        className="text-xs"
                      />
                      <Button
                        variant="primary"
                        size="sm"
                        icon="add"
                        onClick={handleAddWatchlistItem}
                        disabled={!marketWatchlistSymbolDraft.trim()}
                      >
                        加入
                      </Button>
                    </div>

                    <div className="border border-slate-200 dark:border-border-dark rounded-md overflow-hidden">
                      <div className="max-h-72 overflow-auto">
                        {marketWatchlistLoading && (
                          <div className="p-3 text-xs text-slate-500 dark:text-slate-400">
                            加载中...
                          </div>
                        )}
                        {!marketWatchlistLoading && marketWatchlistItems.length === 0 && (
                          <div className="p-3 text-xs text-slate-500 dark:text-slate-400">
                            暂无自选标的。
                          </div>
                        )}
                        {!marketWatchlistLoading &&
                          marketWatchlistItems.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-3 px-3 py-2 border-b border-slate-200 dark:border-border-dark last:border-b-0"
                            >
                              <div className="min-w-0">
                                <div className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">
                                  {item.symbol}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                  {item.name ?? item.groupName ?? "--"}
                                </div>
                              </div>
                              <Button
                                variant="danger"
                                size="sm"
                                icon="delete"
                                onClick={() => handleRemoveWatchlistItem(item.symbol)}
                              >
                                移除
                              </Button>
                            </div>
                          ))}
                      </div>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-bold text-slate-900 dark:text-white">
                        目标池编辑
                      </h3>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon="refresh"
                          onClick={refreshMarketTargets}
                          disabled={marketTargetsLoading}
                        >
                          刷新
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          icon="save"
                          onClick={handleSaveTargets}
                          disabled={marketTargetsSaving}
                        >
                          保存
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={marketTargetsConfig.includeHoldings}
                          onChange={(e) =>
                            setMarketTargetsConfig((prev) => ({
                              ...prev,
                              includeHoldings: e.target.checked
                            }))
                          }
                        />
                        <span>包含持仓</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={marketTargetsConfig.includeWatchlist}
                          onChange={(e) =>
                            setMarketTargetsConfig((prev) => ({
                              ...prev,
                              includeWatchlist: e.target.checked
                            }))
                          }
                        />
                        <span>包含自选</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={marketTargetsConfig.includeRegistryAutoIngest}
                          onChange={(e) =>
                            setMarketTargetsConfig((prev) => ({
                              ...prev,
                              includeRegistryAutoIngest: e.target.checked
                            }))
                          }
                        />
                        <span>包含注册标的</span>
                      </label>
                    </div>

                    <FormGroup label="手动添加标的">
                      <div className="flex flex-wrap gap-2">
                        <Input
                          value={marketTargetsSymbolDraft}
                          onChange={(e) =>
                            setMarketTargetsSymbolDraft(e.target.value)
                          }
                          placeholder="600519.SH"
                          className="font-mono text-xs flex-1 min-w-[220px]"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          icon="add"
                          onClick={handleAddTargetSymbol}
                          disabled={!marketTargetsSymbolDraft.trim()}
                        >
                          添加
                        </Button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {marketTargetsConfig.explicitSymbols.length === 0 && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            --
                          </span>
                        )}
                        {marketTargetsConfig.explicitSymbols.map((symbol) => (
                          <span
                            key={symbol}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-200"
                          >
                            <span className="font-mono">{symbol}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTargetSymbol(symbol)}
                              className="text-slate-400 hover:text-red-500"
                              aria-label={`移除 symbol ${symbol}`}
                              title="移除"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </FormGroup>

                    <FormGroup label="标签筛选">
                      <div className="flex flex-wrap gap-2">
                        <Input
                          value={marketTargetsTagDraft}
                          onChange={(e) => setMarketTargetsTagDraft(e.target.value)}
                          placeholder="例如：industry:白酒 / fund_type:股票型"
                          className="text-xs flex-1 min-w-[220px]"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          icon="add"
                          onClick={() => handleAddTargetTag()}
                          disabled={!marketTargetsTagDraft.trim()}
                        >
                          添加
                        </Button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {marketTargetsConfig.tagFilters.length === 0 && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            --
                          </span>
                        )}
                        {marketTargetsConfig.tagFilters.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-200"
                          >
                            <span>{tag}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTargetTag(tag)}
                              className="text-slate-400 hover:text-red-500"
                              aria-label={`移除过滤器 ${tag}`}
                              title="移除"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </FormGroup>

                    <div className="rounded-md border border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-background-dark p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                        <span>预览（基于已保存配置）</span>
                        <span className="font-mono">
                          {marketTargetsPreview
                            ? `${marketTargetsPreview.symbols.length} symbols`
                            : "--"}
                        </span>
                      </div>
                      <div className="max-h-56 overflow-auto">
                        {!marketTargetsPreview && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            点击“刷新”加载预览。
                          </div>
                        )}
                        {marketTargetsPreview &&
                          marketTargetsPreview.symbols.slice(0, 200).map((row) => (
                            <div
                              key={row.symbol}
                              className="flex items-start justify-between gap-3 py-1 border-b border-slate-200/60 dark:border-border-dark/60 last:border-b-0"
                            >
                              <span className="font-mono text-xs text-slate-700 dark:text-slate-200">
                                {row.symbol}
                              </span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 text-right">
                                {formatTargetsReasons(row.reasons)}
                              </span>
                            </div>
                          ))}
                        {marketTargetsPreview &&
                          marketTargetsPreview.symbols.length > 200 && (
                            <div className="pt-2 text-[11px] text-slate-500 dark:text-slate-400">
                              仅展示前 200 个标的（共{" "}
                              {marketTargetsPreview.symbols.length}）。
                            </div>
                          )}
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </Panel>
              */}
            </>
          )}

          {/* View: Other */}
          {activeView === "other" && (
            <Panel>
              <div className="border-b border-border-light dark:border-border-dark bg-white/90 dark:bg-background-dark/75">
                <div className="flex items-center gap-1 overflow-x-auto px-3">
                  {otherTabs.map((tab) => {
                    const isActive = otherTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                          className={`flex-none min-w-[140px] flex items-center justify-center px-4 py-2 text-sm font-semibold text-center whitespace-nowrap transition-colors border-b-2 ${
                          isActive
                            ? "text-slate-900 dark:text-white border-primary bg-slate-100 dark:bg-surface-dark"
                            : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-background-dark/80"
                        }`}
                        onClick={() => setOtherTab(tab.key)}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-6 space-y-6 max-w-5xl">
                {otherTab === "data-management" && (
                  <>
                    <div className="rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark overflow-hidden">
                      <div className="divide-y divide-slate-200/70 dark:divide-border-dark/70">
                        <div className="grid grid-cols-3 divide-x divide-slate-200/70 dark:divide-border-dark/70">
                          <div className="px-3 py-2">
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              行情日期
                            </div>
                            <div className="mt-0.5 font-mono text-sm text-slate-900 dark:text-white">
                              {snapshot?.priceAsOf ?? "--"}
                            </div>
                          </div>
                          <div className="px-3 py-2">
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              最近一次拉取
                            </div>
                            <div className="mt-0.5 font-mono text-sm text-slate-900 dark:text-white">
                              {latestMarketIngestRun
                                ? formatDateTime(latestMarketIngestRun.startedAt)
                                : "--"}
                            </div>
                          </div>
                          <div className="px-3 py-2">
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              拉取状态
                            </div>
                            {latestMarketIngestRun ? (
                              <div className="mt-0.5 flex items-center gap-2">
                                <span
                                  className={`font-mono text-sm ${formatIngestRunTone(
                                    latestMarketIngestRun.status
                                  )}`}
                                >
                                  {formatIngestRunStatusLabel(latestMarketIngestRun.status)}
                                </span>
                                {!latestMarketIngestRun.finishedAt && (
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                    进行中
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="mt-0.5 font-mono text-sm text-slate-900 dark:text-white">
                                --
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 divide-x divide-slate-200/70 dark:divide-border-dark/70">
                          <div className="px-3 py-2">
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              令牌来源
                            </div>
                            <div className="mt-0.5 font-mono text-sm text-slate-900 dark:text-white">
                              {marketTokenStatus
                                ? formatMarketTokenSource(marketTokenStatus.source)
                                : "--"}
                            </div>
                          </div>
                          <div className="px-3 py-2">
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              令牌已配置
                            </div>
                            <div className="mt-0.5 font-mono text-sm text-slate-900 dark:text-white">
                              {marketTokenStatus?.configured === undefined ||
                              marketTokenStatus?.configured === null
                                ? "--"
                                : marketTokenStatus.configured
                                  ? "是"
                                  : "否"}
                            </div>
                          </div>
                          <div className="px-3 py-2">
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              截至日
                            </div>
                            <div className="mt-0.5 font-mono text-sm text-slate-900 dark:text-white">
                              {latestMarketIngestRun?.asOfTradeDate ?? "--"}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 divide-x divide-slate-200/70 dark:divide-border-dark/70">
                          <div className="px-3 py-2">
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              自动拉取标的
                            </div>
                            <div className="mt-0.5 font-mono text-sm text-slate-900 dark:text-white">
                              {marketTargetsPreview
                                ? marketTargetsPreview.symbols.length
                                : "--"}
                            </div>
                          </div>
                          <div className="px-3 py-2">
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              手动添加
                            </div>
                            <div className="mt-0.5 font-mono text-sm text-slate-900 dark:text-white">
                              {marketTargetsConfig.explicitSymbols.length}
                            </div>
                          </div>
                          <div className="px-3 py-2">
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              标签筛选
                            </div>
                            <div className="mt-0.5 font-mono text-sm text-slate-900 dark:text-white">
                              {marketTargetsConfig.tagFilters.length}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <section className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-bold text-slate-900 dark:text-white">
                          数据来源
                        </h3>
                      </div>

                      <div className="rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark p-2 space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-center">
                          <div className="flex flex-wrap items-center gap-2">
                            <PopoverSelect
                              value={marketTokenProvider}
                              onChangeValue={setMarketTokenProvider}
                              options={[{ value: "tushare", label: "Tushare" }]}
                              className="w-[180px]"
                            />
                            <span className="ml-3 text-[11px] text-slate-500 dark:text-slate-400">
                              当前提供商：{marketTokenProvider === "tushare" ? "Tushare" : "--"}
                            </span>
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              icon="open_in_new"
                              onClick={handleOpenMarketProvider}
                              className="min-w-[110px]"
                            >
                              访问
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              icon="save"
                              onClick={handleSaveMarketToken}
                              disabled={marketTokenSaving}
                              className="min-w-[110px]"
                            >
                              保存
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-center">
                          <div className="relative">
                            <Input
                              type="password"
                              value={marketTokenDraft}
                              onChange={(e) => setMarketTokenDraft(e.target.value)}
                              placeholder="输入数据源令牌"
                              className="font-mono text-xs pr-8"
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
                              <HelpHint
                                text={
                                  "需要接口权限：\n股票列表（stock_basic）\n基金/ETF 列表（fund_basic）\n交易日历（trade_cal）\n日线行情（daily）\n每日指标（daily_basic）\n资金流（moneyflow）"
                                }
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              icon="delete"
                              onClick={handleClearMarketToken}
                              disabled={marketTokenSaving}
                              className="min-w-[110px]"
                            >
                              清除
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              icon="check_circle"
                              onClick={handleTestMarketToken}
                              disabled={marketTokenTesting}
                              className="min-w-[110px]"
                            >
                              测试连接
                            </Button>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-bold text-slate-900 dark:text-white">
                          目标池编辑
                        </h3>
                      </div>

                      <div className="rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark p-3 space-y-4">
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          说明：目标池用于组合估值/缺口回补的快速路径；全市场（Universe，近 3 年）由定时跑批维护，也可在下方「手动拉取」触发。
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <PopoverSelect
                            value={autoIngestScopeValue}
                            onChangeValue={handleChangeAutoIngestScope}
                            options={[
                              { value: "holdings+watchlist+registry", label: "持仓 + 自选 + 注册标的" },
                              { value: "holdings+watchlist", label: "持仓 + 自选" },
                              { value: "holdings+registry", label: "持仓 + 注册标的" },
                              { value: "watchlist+registry", label: "自选 + 注册标的" },
                              { value: "holdings", label: "仅持仓" },
                              { value: "watchlist", label: "仅自选" },
                              { value: "registry", label: "仅注册标的" }
                            ]}
                            className="w-[220px]"
                          />
                          <Button
                            variant="secondary"
                            size="sm"
                            icon="refresh"
                            onClick={refreshMarketTargets}
                            disabled={marketTargetsLoading}
                          >
                            刷新
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            icon="save"
                            onClick={handleSaveTargets}
                            disabled={marketTargetsSaving}
                          >
                            保存
                          </Button>
                        </div>

                        <FormGroup label="手动添加标的">
                          <div className="flex gap-2">
                            <Input
                              value={marketTargetsSymbolDraft}
                              onChange={(e) =>
                                setMarketTargetsSymbolDraft(e.target.value)
                              }
                              placeholder="600519.SH"
                              className="font-mono text-xs"
                            />
                            <Button
                              variant="secondary"
                              size="sm"
                              icon="add"
                              onClick={handleAddTargetSymbol}
                              disabled={!marketTargetsSymbolDraft.trim()}
                            >
                              添加
                            </Button>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {marketTargetsConfig.explicitSymbols.length === 0 && (
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                --
                              </span>
                            )}
                            {marketTargetsConfig.explicitSymbols.map((symbol) => (
                              <span
                                key={symbol}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-200"
                              >
                                <span className="font-mono">{symbol}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTargetSymbol(symbol)}
                                  className="text-slate-400 hover:text-red-500"
                                  aria-label={`移除 symbol ${symbol}`}
                                  title="移除"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        </FormGroup>

                        <FormGroup label="标签筛选">
                          <div className="flex gap-2">
                            <Input
                              value={marketTargetsTagDraft}
                              onChange={(e) =>
                                setMarketTargetsTagDraft(e.target.value)
                              }
                              placeholder="输入标签"
                              className="text-xs"
                            />
                            <Button
                              variant="secondary"
                              size="sm"
                              icon="add"
                              onClick={() => handleAddTargetTag()}
                              disabled={!marketTargetsTagDraft.trim()}
                            >
                              添加
                            </Button>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {marketTargetsConfig.tagFilters.length === 0 && (
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                --
                              </span>
                            )}
                            {marketTargetsConfig.tagFilters.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-200"
                              >
                                <span>{tag}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTargetTag(tag)}
                                  className="text-slate-400 hover:text-red-500"
                                  aria-label={`移除过滤器 ${tag}`}
                                  title="移除"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        </FormGroup>

                        <FormGroup label="临时标的（自动）">
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            从「市场行情」搜索选中但不在目标池的标的，会临时加入并参与后续回补；默认 7 天未续期会自动清理。
                          </div>
                          <div className="mt-2 space-y-1">
                            {marketTempTargetsLoading && (
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                加载中...
                              </div>
                            )}
                            {!marketTempTargetsLoading && marketTempTargets.length === 0 && (
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                --
                              </div>
                            )}
                            {!marketTempTargetsLoading &&
                              marketTempTargets.map((item) => (
                                <div
                                  key={item.symbol}
                                  className="flex items-center justify-between gap-3 rounded-md border border-slate-200 dark:border-border-dark px-2 py-1"
                                >
                                  <div className="min-w-0">
                                    <div className="font-mono text-xs text-slate-700 dark:text-slate-200">
                                      {item.symbol}
                                    </div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                      到期 {formatDateTime(item.expiresAt)}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      icon="push_pin"
                                      onClick={() => handlePromoteTempTarget(item.symbol)}
                                      disabled={marketTargetsSaving}
                                    >
                                      转长期
                                    </Button>
                                    <Button
                                      variant="danger"
                                      size="sm"
                                      icon="delete"
                                      onClick={() => handleRemoveTempTarget(item.symbol)}
                                    >
                                      移除
                                    </Button>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </FormGroup>

                        <div className="rounded-md border border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-background-dark p-3 space-y-2">
                          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                            <span>预览</span>
                            <span className="font-mono">
                              {marketTargetsPreview
                                ? marketTargetsPreview.symbols.length
                                : "--"}
                            </span>
                          </div>
                          <div className="max-h-56 overflow-auto">
                            {marketTargetsPreview &&
                              marketTargetsPreview.symbols.slice(0, 200).map((row) => (
                                <div
                                  key={row.symbol}
                                  className="flex items-start justify-between gap-3 py-1 border-b border-slate-200/60 dark:border-border-dark/60 last:border-b-0"
                                >
                                  <span className="font-mono text-xs text-slate-700 dark:text-slate-200">
                                    {row.symbol}
                                  </span>
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 text-right">
                                    {formatTargetsReasons(row.reasons)}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-bold text-slate-900 dark:text-white">
                          手动拉取
                        </h3>
                      </div>

                      <div className="rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark p-3">
                        <div className="flex items-center gap-2 overflow-x-auto">
                          <Button
                            variant="primary"
                            size="sm"
                            icon="play_arrow"
                            onClick={() => handleTriggerMarketIngest("targets")}
                            disabled={marketIngestTriggering}
                          >
                            拉取目标池
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon="play_arrow"
                            onClick={() => handleTriggerMarketIngest("universe")}
                            disabled={marketIngestTriggering}
                          >
                            拉取全市场
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon="playlist_play"
                            onClick={() => handleTriggerMarketIngest("both")}
                            disabled={marketIngestTriggering}
                          >
                            全部拉取
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon="monitoring"
                            onClick={() => setOtherTab("data-status")}
                          >
                            查看记录
                          </Button>
                        </div>
                      </div>
                    </section>
                  </>
                )}

                {otherTab === "data-status" && (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-bold text-slate-900 dark:text-white">
                        数据状态
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="bg-slate-50 dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark border border-slate-200 dark:border-border-dark rounded-lg p-4">
                        <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">
                          行情更新
                        </div>
                        <div className="text-sm text-slate-700 dark:text-slate-300">
                          {snapshot?.priceAsOf ? (
                            <span className="font-mono">{snapshot.priceAsOf}</span>
                          ) : (
                            "--"
                          )}
                        </div>
                      </div>
                      <div className="bg-slate-50 dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark border border-slate-200 dark:border-border-dark rounded-lg p-4">
                        <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">
                          覆盖率
                        </div>
                        <div className="text-sm text-slate-700 dark:text-slate-300 font-mono">
                          {formatPctNullable(dataQuality?.coverageRatio ?? null)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          缺失标的 {dataQuality?.missingSymbols.length ?? 0}
                        </div>
                      </div>
                      <div className="bg-slate-50 dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark border border-slate-200 dark:border-border-dark rounded-lg p-4">
                        <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">
                          新鲜度
                        </div>
                        <div className="text-sm text-slate-700 dark:text-slate-300 font-mono">
                          {dataQuality?.freshnessDays === null || dataQuality?.freshnessDays === undefined
                            ? "--"
                            : `${dataQuality.freshnessDays} 天`}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          截至 {dataQuality?.asOfDate ?? "--"}
                        </div>
                      </div>
                      <div className="bg-slate-50 dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark border border-slate-200 dark:border-border-dark rounded-lg p-4">
                        <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">
                          Token
                        </div>
                        <div className="text-sm text-slate-700 dark:text-slate-300 font-mono">
                          {marketTokenStatus?.configured ? "已配置" : "未配置"}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          来源{" "}
                          {marketTokenStatus
                            ? formatMarketTokenSource(marketTokenStatus.source)
                            : "--"}
                        </div>
                      </div>
                    </div>

                    {dataQuality?.missingSymbols && dataQuality.missingSymbols.length > 0 && (
                      <div className="rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark p-3 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            缺失标的
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon="play_arrow"
                            onClick={() => handleTriggerMarketIngest("targets")}
                            disabled={
                              marketIngestTriggering || !marketTokenStatus?.configured
                            }
                          >
                            拉取目标池
                          </Button>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {marketTokenStatus?.configured
                            ? "将按 Targets 配置回补缺失行情。"
                            : "请先在「数据管理」配置 token。"}
                        </div>
                        <div className="max-h-32 overflow-auto rounded-md border border-slate-200/70 dark:border-border-dark/70 bg-slate-50/50 dark:bg-background-dark/40">
                          <div className="p-2 flex flex-wrap gap-1">
                            {dataQuality.missingSymbols.slice(0, 200).map((symbol) => (
                              <span
                                key={symbol}
                                className="px-2 py-1 rounded-full bg-white dark:bg-surface-dark border border-slate-200/60 dark:border-border-dark/60 text-[11px] font-mono text-slate-700 dark:text-slate-200"
                              >
                                {symbol}
                              </span>
                            ))}
                            {dataQuality.missingSymbols.length > 200 && (
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 px-1 py-1">
                                …共 {dataQuality.missingSymbols.length}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark p-3 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          拉取记录
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {marketIngestRunsLoading
                              ? "加载中..."
                              : `${marketIngestRuns.length} 条记录`}
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon="refresh"
                            onClick={refreshMarketIngestRuns}
                            disabled={marketIngestRunsLoading}
                          >
                            刷新
                          </Button>
                        </div>
                      </div>

                      {marketIngestRunsLoading && (
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          加载中...
                        </div>
                      )}

                      {!marketIngestRunsLoading && marketIngestRuns.length === 0 && (
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          暂无拉取记录。
                        </div>
                      )}

                      {!marketIngestRunsLoading && marketIngestRuns.length > 0 && (
                        <div className="max-h-[520px] overflow-auto rounded-md border border-slate-200 dark:border-border-dark">
                          <table className="w-full text-sm">
                            <thead className="bg-white dark:bg-background-dark sticky top-0">
                              <tr className="text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-border-dark">
                                <th className="text-left font-semibold px-3 py-2">
                                  时间
                                </th>
                                <th className="text-left font-semibold px-3 py-2">
                                  范围
                                </th>
                                <th className="text-left font-semibold px-3 py-2">
                                  状态
                                </th>
                                <th className="text-right font-semibold px-3 py-2">
                                  写入
                                </th>
                                <th className="text-right font-semibold px-3 py-2">
                                  错误
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {marketIngestRuns.slice(0, 200).map((run) => {
                                const statusTone = formatIngestRunTone(run.status);
                                return (
                                  <tr
                                    key={run.id}
                                    className="border-b border-slate-200/70 dark:border-border-dark/70 last:border-b-0"
                                  >
                                    <td className="px-3 py-2">
                                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                        {formatDateTime(run.startedAt)}
                                      </div>
                                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                        {run.finishedAt
                                          ? `耗时 ${formatDurationMs(
                                              run.finishedAt - run.startedAt
                                            )}`
                                          : "进行中..."}
                                      </div>
                                      <div className="text-[11px] text-slate-400 dark:text-slate-500">
                                        截至 {run.asOfTradeDate ?? "--"}
                                      </div>
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-200">
                                      <span className="font-mono">{formatIngestRunScopeLabel(run.scope)}</span>
                                      <span className="text-slate-400 dark:text-slate-500">
                                        {" "}
                                        · {formatIngestRunModeLabel(run.mode)}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-xs">
                                      <span className={statusTone}>
                                        {formatIngestRunStatusLabel(run.status)}
                                      </span>
                                      {run.errorMessage && (
                                        <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                                          {run.errorMessage}
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-right text-xs font-mono text-slate-700 dark:text-slate-200">
                                      {(run.inserted ?? 0) + (run.updated ?? 0)}
                                    </td>
                                    <td className="px-3 py-2 text-right text-xs font-mono text-slate-700 dark:text-slate-200">
                                      {run.errors ?? 0}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {otherTab === "test" && (
                  <>
                    <section className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-bold text-slate-900 dark:text-white">
                          示例数据
                        </h3>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon="show_chart"
                          onClick={() => setActiveView("market")}
                        >
                          打开市场行情
                        </Button>
                      </div>
                      <div className="rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark p-3 space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            icon="science"
                            onClick={() => {
                              void (async () => {
                                await handleSeedMarketDemoData();
                                setActiveView("market");
                              })();
                            }}
                            disabled={marketDemoSeeding}
                          >
                            {marketDemoSeeding ? "注入中..." : "注入示例数据"}
                          </Button>
                        </div>
                      </div>
                    </section>

                    <section className="space-y-4">
                      <h3 className="font-bold text-slate-900 dark:text-white">
                        数据导入
                      </h3>
                      <div className="grid grid-cols-1 gap-8">
                        <div className="space-y-4">
                          <FormGroup label="持仓文件">
                            <div className="flex gap-2">
                              <Input
                                value={holdingsCsvPath ?? ""}
                                readOnly
                                className="flex-1 text-xs font-mono"
                              />
                              <Button
                                variant="secondary"
                                onClick={() => handleChooseCsv("holdings")}
                              >
                                选择
                              </Button>
                              <Button
                                variant="primary"
                                onClick={handleImportHoldings}
                                disabled={!holdingsCsvPath || !activePortfolio}
                              >
                                导入
                              </Button>
                            </div>
                          </FormGroup>
                          <FormGroup label="价格文件">
                            <div className="flex gap-2">
                              <Input
                                value={pricesCsvPath ?? ""}
                                readOnly
                                className="flex-1 text-xs font-mono"
                              />
                              <Button
                                variant="secondary"
                                onClick={() => handleChooseCsv("prices")}
                              >
                                选择
                              </Button>
                              <Button
                                variant="primary"
                                onClick={handleImportPrices}
                                disabled={!pricesCsvPath}
                              >
                                导入
                              </Button>
                            </div>
                          </FormGroup>
                        </div>
                      </div>
                    </section>
                  </>
                )}
              </div>
            </Panel>
          )}

          {/* Placeholders */}
          {["opportunities", "backtest", "insights", "alerts", "index-tracking", "data-analysis"].includes(activeView) && (
            <PlaceholderPanel 
              title={navItems.find(n => n.key === activeView)?.label ?? ""}
              description={navItems.find(n => n.key === activeView)?.description ?? ""}
            />
          )}

        </div>

        {ledgerDeleteTarget && (
          <ConfirmDialog
            open={Boolean(ledgerDeleteTarget)}
            title="确认删除"
            message={
              <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <p>将删除以下流水记录，操作不可撤销。</p>
                <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  {ledgerDeleteSummary}
                </p>
              </div>
            }
            confirmLabel="删除"
            onConfirm={handleConfirmDeleteLedgerEntry}
            onCancel={handleCancelDeleteLedgerEntry}
          />
        )}

        {/* Global Notifications */}
        {(error || notice) && (
           <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in-up">
              <div className={`px-4 py-3 rounded-lg shadow-lg border flex items-center gap-3 ${
                 error 
                 ? "bg-red-50 dark:bg-red-900 border-red-200 dark:border-red-800 text-red-800 dark:text-red-100" 
                 : "bg-emerald-50 dark:bg-emerald-900 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-100"
              }`}>
                 <span className="material-icons-outlined">{error ? "error" : "check_circle"}</span>
                 <span className="text-sm font-medium">{toastMessage}</span>
                 <button onClick={() => { setError(null); setNotice(null); }} className="ml-2 opacity-60 hover:opacity-100">
                    <span className="material-icons-outlined text-sm">close</span>
                 </button>
              </div>
           </div>
        )}
      </section>
    </div>
  );
}

// --- UI Components ---

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-transparent mb-4 last:mb-0">
      <div className="px-4 py-3">
        {children}
      </div>
    </div>
  );
}

function PlaceholderPanel({ title, description }: { title: string, description: string }) {
   return (
      <Panel>
         <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <span className="material-icons-outlined text-5xl mb-4 opacity-30">construction</span>
            <h3 className="text-lg font-medium text-slate-600 dark:text-slate-300 mb-2">{title}</h3>
            <p className="text-sm opacity-80">{description}</p>
            <p className="text-xs mt-4 opacity-50">该模块为占位视图，将在后续版本逐步实现。</p>
         </div>
      </Panel>
   )
}

function Modal({
  open,
  title,
  onClose,
  children
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined") return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="关闭弹层"
        onClick={onClose}
      />
      <div className="relative w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-border-dark bg-white/70 dark:bg-surface-dark/80 backdrop-blur">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">
            {title}
          </div>
          <IconButton icon="close" label="关闭" onClick={onClose} />
        </div>
        <div className="p-4 overflow-auto max-h-[calc(85vh-52px)]">
          {children}
        </div>
      </div>
    </div>
  );
}

function FormGroup({ label, children }: { label: React.ReactNode, children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">{label}</label>
      {children}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}
function Input({ className, ...props }: InputProps) {
  const isDateInput =
    props.type === "date" || props.type === "datetime-local";
  const isEmpty =
    props.value === "" || props.value === undefined || props.value === null;
  const dateHintClass =
    isDateInput && isEmpty ? "text-slate-500 dark:text-slate-400" : "";

  return (
    <input 
      className={`block w-full rounded-md border-slate-300 dark:border-border-dark bg-white dark:bg-field-dark py-1.5 text-slate-900 dark:text-slate-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_12px_rgba(0,0,0,0.35)] focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm sm:leading-6 placeholder:text-slate-400 disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-background-dark ${dateHintClass} ${className}`}
      {...props}
    />
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string, label: string, disabled?: boolean }[];
}
function Select({ className, options, ...props }: SelectProps) {
  return (
    <select
      className={`block w-full rounded-md border-slate-300 dark:border-border-dark bg-white dark:bg-field-dark py-1.5 pl-3 pr-10 text-slate-900 dark:text-slate-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_12px_rgba(0,0,0,0.35)] focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm sm:leading-6 ${className}`}
      {...props}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</option>
      ))}
    </select>
  );
}

interface PopoverSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

function PopoverSelect({
  value,
  options,
  onChangeValue,
  disabled,
  className,
  buttonClassName
}: {
  value: string;
  options: PopoverSelectOption[];
  onChangeValue: (value: string) => void;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => options.find((opt) => opt.value === value) ?? null,
    [options, value]
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current && rootRef.current.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={`relative h-6 w-full rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-panel-dark pl-2 pr-8 text-left text-xs text-slate-900 dark:text-slate-100 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_1px_10px_rgba(0,0,0,0.35)] hover:bg-slate-50 dark:hover:bg-surface-dark/80 transition-colors disabled:opacity-60 ${buttonClassName ?? ""}`}
      >
        <span className="block truncate pr-6">{selected?.label ?? "--"}</span>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-icons-outlined text-[18px] text-slate-400">
          expand_more
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50">
          <div
            role="listbox"
            className="max-h-72 overflow-auto rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark shadow-xl dark:shadow-black/60 p-1"
          >
            {options.map((opt) => {
              const isActive = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  disabled={opt.disabled}
                  onClick={() => {
                    if (opt.disabled) return;
                    setOpen(false);
                    onChangeValue(opt.value);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-left text-xs transition-colors ${
                    opt.disabled
                      ? "opacity-50 cursor-not-allowed"
                      : isActive
                        ? "bg-primary/15 text-slate-900 dark:text-white"
                        : "hover:bg-slate-100 dark:hover:bg-background-dark/80 text-slate-700 dark:text-slate-200"
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isActive && (
                    <span className="material-icons-outlined text-base text-primary">
                      check
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md';
  icon?: string;
}
function Button({ children, variant = 'secondary', size = 'md', icon, className, ...props }: ButtonProps) {
  const baseClass = "inline-flex items-center justify-center rounded font-medium !text-white whitespace-nowrap break-keep shrink-0 transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:brightness-90 disabled:saturate-80 disabled:shadow-none";
  
  const variants = {
    primary: "bg-primary border border-primary/90 shadow-md hover:bg-[#14b8ca] focus:ring-primary/70",
    secondary: "bg-slate-500 border border-slate-400/80 shadow-md hover:bg-slate-400 dark:bg-surface-dark dark:border-border-dark dark:hover:bg-background-dark focus:ring-primary/50",
    danger: "bg-red-500 border border-red-400/90 shadow-md hover:bg-red-400 focus:ring-red-400/80"
  };
  
  const sizes = {
    sm: "px-2.5 py-1.5 text-xs",
    md: "px-4 py-2 text-sm"
  };
  const hasChildren = children !== undefined && children !== null && children !== false;

  return (
    <button 
      className={`${baseClass} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {icon && (
        <span
          className={`material-icons-outlined ${
            size === "sm" ? "text-sm" : "text-base"
          } ${hasChildren ? (size === "sm" ? "mr-1.5" : "mr-2") : ""}`}
        >
          {icon}
        </span>
      )}
      {children}
    </button>
  );
}

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  label: string;
  size?: "sm" | "md";
}

function IconButton({
  icon,
  label,
  size = "md",
  className,
  ...props
}: IconButtonProps) {
  const sizeClass = size === "sm" ? "p-1.5" : "p-2";
  const iconClass = size === "sm" ? "text-sm" : "text-base";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-border-dark ${sizeClass} text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-background-dark/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      <span className={`material-icons-outlined ${iconClass}`}>{icon}</span>
    </button>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-background-dark px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 ring-1 ring-inset ring-border-light/60 dark:ring-border-dark/40">
      {children}
    </span>
  );
}

function MarketQuoteHeader({ quote }: { quote: MarketQuote | null }) {
  const tone = getCnChangeTone(quote?.changePct ?? null);
  return (
    <div className="text-right">
      <div className="text-3xl font-mono font-semibold text-slate-900 dark:text-white">
        {formatNumber(quote?.close ?? null, 2)}
      </div>
      <div className={`mt-1 font-mono text-sm ${getCnToneTextClass(tone)}`}>
        {formatSignedNumberNullable(quote?.change ?? null, 2)}（
        {formatSignedPctNullable(quote?.changePct ?? null)}）
      </div>
    </div>
  );
}

class ChartErrorBoundary extends Component<
  { children: React.ReactNode; resetKey?: string | number },
  { error: string | null; lastResetKey?: string | number }
> {
  constructor(props: { children: React.ReactNode; resetKey?: string | number }) {
    super(props);
    this.state = { error: null, lastResetKey: props.resetKey };
  }

  static getDerivedStateFromProps(
    props: { resetKey?: string | number },
    state: { error: string | null; lastResetKey?: string | number }
  ): { error: string | null; lastResetKey?: string | number } | null {
    if (props.resetKey !== state.lastResetKey) {
      return { error: null, lastResetKey: props.resetKey };
    }
    return null;
  }

  static getDerivedStateFromError(error: unknown): { error: string } {
    return { error: toUserErrorMessage(error) };
  }

  componentDidCatch(error: unknown) {
    console.error("[mytrader] MarketAreaChart crashed", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-full flex items-center justify-center text-sm text-slate-500 dark:text-slate-300">
          图表渲染失败：{this.state.error}
        </div>
      );
    }
    return this.props.children;
  }
}

function MarketAreaChart({
  bars,
  tone,
  onHoverDatumChange
}: {
  bars: MarketDailyBar[];
  tone: ChangeTone;
  onHoverDatumChange?: (datum: { date: string; close: number } | null) => void;
}) {
  const colors = getCnToneColors(tone);
  const gradientId = useId();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const hoverDatumRef = useRef<{ date: string; close: number } | null>(null);
  const hoverIndexRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const latestClientXRef = useRef<number | null>(null);
  const series = useMemo(
    () =>
      bars
        .map((bar) => ({ date: bar.date, close: bar.close ?? null }))
        .filter(
          (bar): bar is { date: string; close: number } =>
            bar.close !== null && Number.isFinite(bar.close)
        ),
    [bars]
  );

  if (series.length < 2) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-slate-300">
        暂无足够数据绘制图表。
      </div>
    );
  }

  const width = 800;
  const height = 360;
  const paddingLeft = 18;
  const paddingRight = 72;
  const paddingTop = 12;
  const paddingBottom = 18;

  const values = series.map((point) => point.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const geometry = useMemo(() => {
    const points = series.map((point, idx) => {
      const x = paddingLeft + (idx / (series.length - 1)) * chartWidth;
      const y = paddingTop + (1 - (point.close - min) / span) * chartHeight;
      return { x, y };
    });
    const path = points
      .map((point, idx) => `${idx === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");
    const area = `${path} L ${points[points.length - 1].x} ${
      height - paddingBottom
    } L ${points[0].x} ${height - paddingBottom} Z`;
    return { points, path, area };
  }, [
    chartHeight,
    chartWidth,
    height,
    min,
    paddingBottom,
    paddingLeft,
    paddingTop,
    series,
    span
  ]);

  const hoverPoint =
    hoverIndex === null ? null : geometry.points[hoverIndex] ?? null;
  const hoverDatum = hoverIndex === null ? null : series[hoverIndex] ?? null;

  useEffect(() => {
    const datum = hoverDatum ? { date: hoverDatum.date, close: hoverDatum.close } : null;
    if (
      hoverDatumRef.current?.date === datum?.date &&
      hoverDatumRef.current?.close === datum?.close
    ) {
      return;
    }
    hoverDatumRef.current = datum;
    onHoverDatumChange?.(datum);
  }, [hoverDatum, onHoverDatumChange]);

  const path = geometry.path;
  const area = geometry.area;
  const yTicks = [max, (max + min) / 2, min];
  const gridLines = 5;
  const hoverStroke = "rgba(96,165,250,0.55)";

  const flushHoverIndex = useCallback(() => {
    rafIdRef.current = null;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (!rect.width) return;
    const clientX = latestClientXRef.current;
    if (clientX === null) return;

    const ratioX = (clientX - rect.left) / rect.width;
    const x = ratioX * width;
    const idxFloat = ((x - paddingLeft) / chartWidth) * (series.length - 1);
    const idx = Math.min(series.length - 1, Math.max(0, Math.round(idxFloat)));

    if (idx === hoverIndexRef.current) return;
    hoverIndexRef.current = idx;
    setHoverIndex(idx);
  }, [chartWidth, paddingLeft, series.length]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="w-full h-full"
      onPointerMove={(event) => {
        latestClientXRef.current = event.clientX;
        if (rafIdRef.current === null) {
          rafIdRef.current = requestAnimationFrame(flushHoverIndex);
        }
      }}
      onPointerLeave={() => {
        setHoverIndex(null);
        hoverIndexRef.current = null;
        hoverDatumRef.current = null;
        latestClientXRef.current = null;
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        onHoverDatumChange?.(null);
      }}
    >
      <defs>
        <linearGradient
          id={`market-area-fill-${gradientId}`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0%" stopColor={colors.fill} stopOpacity="0.28" />
          <stop offset="100%" stopColor={colors.fill} stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect
        x={paddingLeft}
        y={paddingTop}
        width={chartWidth}
        height={chartHeight}
        fill="transparent"
        pointerEvents="none"
      />

      {Array.from({ length: gridLines }, (_, idx) => {
        const y = paddingTop + (idx / (gridLines - 1)) * chartHeight;
        return (
          <line
            key={`grid-${idx}`}
            x1={paddingLeft}
            x2={width - paddingRight}
            y1={y}
            y2={y}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
        );
      })}

      <path d={area} fill={`url(#market-area-fill-${gradientId})`} />
      <path d={path} fill="none" stroke={colors.line} strokeWidth="2.2" />

      {hoverPoint && hoverDatum && (
        <>
          <line
            x1={hoverPoint.x}
            x2={hoverPoint.x}
            y1={paddingTop}
            y2={height - paddingBottom}
            stroke={hoverStroke}
            strokeWidth="1"
          />
          <circle
            cx={hoverPoint.x}
            cy={hoverPoint.y}
            r={3.5}
            fill={colors.line}
            stroke="rgba(15,23,42,0.9)"
            strokeWidth="1"
          />

        </>
      )}

      {yTicks.map((tick, idx) => {
        const y = paddingTop + (idx / (yTicks.length - 1)) * chartHeight;
        return (
          <text
            key={`y-${idx}`}
            x={width - 12}
            y={y + 4}
            textAnchor="end"
            fontSize="12"
            fill="rgba(226,232,240,0.85)"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
          >
            {formatNumber(tick, 2)}
          </text>
        );
      })}
    </svg>
  );
}

function MarketVolumeMiniChart({
  bars,
  mode,
  activeDate,
}: {
  bars: MarketDailyBar[];
  mode: "volume" | "moneyflow";
  activeDate: string | null;
}) {
  const series = useMemo(() => {
    return bars
      .map((bar) => ({
        date: bar.date,
        volume: bar.volume,
        netMfVol: bar.netMfVol ?? null
      }))
      .filter(
        (row): row is { date: string; volume: number; netMfVol: number | null } =>
          row.volume !== null && Number.isFinite(row.volume)
      );
  }, [bars]);

  if (series.length < 2) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
        --
      </div>
    );
  }

  const width = 800;
  const height = 80;
  const paddingTop = 6;
  const paddingBottom = 6;

  const values = series.map((row) => {
    if (mode === "volume") return row.volume;
    return row.netMfVol ?? 0;
  });

  const maxAbs =
    mode === "moneyflow"
      ? Math.max(1, ...values.map((value) => Math.abs(value)))
      : Math.max(1, ...values);

  const chartHeight = height - paddingTop - paddingBottom;
  const barWidth = width / series.length;
  const baselineY = mode === "moneyflow" ? paddingTop + chartHeight / 2 : height - paddingBottom;
  const scale = mode === "moneyflow" ? chartHeight / 2 / maxAbs : chartHeight / maxAbs;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-full">
      {mode === "moneyflow" && (
        <line
          x1={0}
          x2={width}
          y1={baselineY}
          y2={baselineY}
          stroke="rgba(148,163,184,0.22)"
          strokeWidth="1"
        />
      )}
      {series.map((row, idx) => {
        const value = values[idx] ?? 0;
        const isActive = activeDate !== null && row.date === activeDate;
        const x = idx * barWidth;
        const w = Math.max(1, barWidth - 1);

        let y = baselineY;
        let h = 0;
        if (mode === "moneyflow") {
          const scaled = value * scale;
          if (scaled >= 0) {
            y = baselineY - scaled;
            h = scaled;
          } else {
            y = baselineY;
            h = Math.abs(scaled);
          }
        } else {
          h = value * scale;
          y = baselineY - h;
        }

        const fill =
          mode === "moneyflow"
            ? value >= 0
              ? "rgba(96,165,250,0.55)"
              : "rgba(248,113,113,0.45)"
            : "rgba(148,163,184,0.35)";

        return (
          <rect
            key={row.date}
            x={x}
            y={y}
            width={w}
            height={h <= 0 ? 0 : Math.max(1, h)}
            fill={fill}
            stroke={isActive ? "rgba(96,165,250,0.6)" : "transparent"}
            strokeWidth={isActive ? 1 : 0}
            opacity={isActive ? 1 : 0.85}
          />
        );
      })}
    </svg>
  );
}

function SummaryCard({ label, value, trend }: { label: string, value: string, trend?: 'up' | 'down' }) {
  return (
    <div className="bg-slate-50 dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark rounded-lg p-4 border border-slate-200 dark:border-border-dark">
       <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</div>
       <div className={`text-xl font-bold font-mono ${
          trend === 'up' ? 'text-green-600 dark:text-green-500' : 
          trend === 'down' ? 'text-red-600 dark:text-red-500' : 
          'text-slate-900 dark:text-white'
       }`}>
          {value}
       </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-slate-400 bg-slate-50/50 dark:bg-background-dark rounded-lg border border-dashed border-slate-200 dark:border-border-dark">
      <span className="material-icons-outlined text-3xl mb-2 opacity-50">inbox</span>
      <p className="text-sm">{message}</p>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-4 px-4 text-sm text-rose-600 bg-rose-50 dark:bg-rose-900/20 rounded-lg border border-rose-200 dark:border-rose-900/40">
      <div className="flex items-center gap-2">
        <span className="material-icons-outlined text-base">error_outline</span>
        <span>{message}</span>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          重试
        </Button>
      )}
    </div>
  );
}

function HelpHint({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleOpen = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => setOpen(true), 500);
  };

  const closeHint = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setOpen(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={scheduleOpen}
      onMouseLeave={closeHint}
      onFocus={scheduleOpen}
      onBlur={closeHint}
    >
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded-none border border-slate-300 dark:border-border-dark text-[10px] text-slate-500 dark:text-slate-300 cursor-help"
        aria-label={text}
      >
        ?
      </span>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-full z-20 mt-1 w-max max-w-xs -translate-x-1/2 whitespace-pre-line rounded-none border border-border-dark bg-surface-dark px-2 py-1 text-[11px] leading-snug text-white shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "确认",
  cancelLabel = "取消",
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-lg shadow-xl w-full max-w-md mx-4 p-5"
      >
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">
          {title}
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-300">
          {message}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface LedgerTableProps {
  entries: LedgerEntry[];
  onEdit: (entry: LedgerEntry) => void;
  onDelete: (entry: LedgerEntry) => void;
}

function LedgerTable({ entries, onEdit, onDelete }: LedgerTableProps) {
  return (
    <div className="overflow-x-auto border border-slate-200 dark:border-border-dark mb-4">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-border-dark">
        <thead className="bg-slate-50 dark:bg-background-dark">
          <tr>
            {[
              "日期",
              "类型",
              "标的",
              "方向",
              "数量/价格",
              "现金腿",
              "费用/税费",
              "来源",
              "备注",
              "操作"
            ].map((h) => (
              <th
                key={h}
                className="px-4 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-surface-dark/70 divide-y divide-slate-200 dark:divide-border-dark">
          {entries.map((entry) => {
            const isReadonly = entry.source === "system";
            const cashClass =
              entry.cashAmount === null
                ? "text-slate-500 dark:text-slate-400"
                : entry.cashAmount < 0
                  ? "text-red-500"
                  : "text-emerald-600";
            return (
              <tr
                key={entry.id}
                className="hover:bg-slate-50 dark:hover:bg-background-dark/70 transition-colors group"
              >
                <td className="px-4 py-2">
                  <div className="text-sm font-mono text-slate-700 dark:text-slate-300">
                    {entry.tradeDate}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {entry.eventTs ? formatDateTime(entry.eventTs) : "无时间"}
                    {entry.sequence !== null ? ` / seq ${entry.sequence}` : ""}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {formatLedgerEventType(entry.eventType)}
                  </div>
                  {entry.eventType === "corporate_action" && (
                    <div className="text-[10px] text-slate-400">
                      {formatCorporateActionMeta(entry.meta)}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2">
                  <div className="text-sm font-mono text-slate-700 dark:text-slate-200">
                    {entry.symbol ?? entry.instrumentId ?? "--"}
                  </div>
                  {entry.symbol && entry.instrumentId && (
                    <div className="text-[10px] text-slate-400">
                      {entry.instrumentId}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300">
                  {formatLedgerSide(entry.side)}
                </td>
                <td className="px-4 py-2">
                  <div className="text-sm font-mono text-right text-slate-700 dark:text-slate-200">
                    {formatNumber(entry.quantity)}
                  </div>
                  <div className="text-[10px] text-slate-400 text-right">
                    {entry.price !== null ? formatCurrency(entry.price) : "--"}
                    {entry.priceCurrency ? ` ${entry.priceCurrency}` : ""}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <div className={`text-sm font-mono text-right ${cashClass}`}>
                    {formatCurrency(entry.cashAmount)}
                  </div>
                  <div className="text-[10px] text-slate-400 text-right">
                    {entry.cashCurrency ?? "--"}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <div className="text-[11px] font-mono text-right text-slate-600 dark:text-slate-300">
                    {entry.fee !== null ? formatCurrency(entry.fee) : "--"}
                  </div>
                  <div className="text-[11px] font-mono text-right text-slate-600 dark:text-slate-300">
                    {entry.tax !== null ? formatCurrency(entry.tax) : "--"}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    {formatLedgerSource(entry.source)}
                  </div>
                  {entry.externalId && (
                    <div className="text-[10px] text-slate-400">
                      {entry.externalId}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                  {entry.note ?? "--"}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEdit(entry)}
                      className={`p-1 transition-colors ${
                        isReadonly
                          ? "text-slate-300 cursor-not-allowed"
                          : "text-slate-400 hover:text-primary"
                      }`}
                      title={isReadonly ? "系统流水不可编辑" : "编辑"}
                      disabled={isReadonly}
                    >
                      <span className="material-icons-outlined text-base">edit</span>
                    </button>
                    <button
                      onClick={() => onDelete(entry)}
                      className={`p-1 transition-colors ${
                        isReadonly
                          ? "text-slate-300 cursor-not-allowed"
                          : "text-slate-400 hover:text-red-500"
                      }`}
                      title={isReadonly ? "系统流水不可删除" : "删除"}
                      disabled={isReadonly}
                    >
                      <span className="material-icons-outlined text-base">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface LedgerFormProps {
  form: LedgerFormState;
  baseCurrency: string;
  onChange: (patch: Partial<LedgerFormState>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

function LedgerForm({ form, baseCurrency, onChange, onSubmit, onCancel }: LedgerFormProps) {
  const isEditing = Boolean(form.id);
  const isCorporateDividend =
    form.eventType === "corporate_action" && form.corporateKind === "dividend";
  const effectiveEventType: LedgerEventType = isCorporateDividend
    ? "dividend"
    : form.eventType;
  const usesInstrument = [
    "trade",
    "dividend",
    "adjustment",
    "corporate_action"
  ].includes(effectiveEventType);
  const usesSide = ["trade", "adjustment"].includes(effectiveEventType);
  const usesQuantity = ["trade", "adjustment"].includes(effectiveEventType);
  const usesPrice = ["trade", "adjustment"].includes(effectiveEventType);
  const usesCash = ["trade", "cash", "fee", "tax", "dividend"].includes(
    effectiveEventType
  );
  const usesFeeTax = form.eventType === "trade";
  const tradeDateMissing = form.tradeDate.trim() === "";
  const instrumentMissing =
    usesInstrument &&
    form.symbol.trim() === "" &&
    form.instrumentId.trim() === "";
  const sideMissing = usesSide && !form.side;
  const quantityMissing = usesQuantity && form.quantity.trim() === "";
  const priceMissing = usesPrice && form.price.trim() === "";
  const cashAmountMissing = usesCash && form.cashAmount.trim() === "";
  const corporateAfterSharesMissing =
    form.eventType === "corporate_action" &&
    form.corporateKind !== "info" &&
    form.corporateKind !== "dividend" &&
    form.corporateAfterShares.trim() === "";
  const missingHintClass =
    "text-rose-600 dark:text-rose-400 placeholder:text-rose-500 dark:placeholder:text-rose-400";
  const compactInputClass = "h-8 py-1 text-xs sm:text-xs rounded-none";
  const compactSelectClass = "h-8 py-1 text-xs sm:text-xs rounded-none";
  const isDeprecatedEventType =
    form.eventType === "fee" ||
    form.eventType === "tax" ||
    form.eventType === "adjustment";
  const showCorporateControls = form.eventType === "corporate_action";
  const corporateKindOptions =
    form.corporateKind === "info"
      ? [
          { value: "split", label: corporateActionKindLabels.split },
          { value: "reverse_split", label: corporateActionKindLabels.reverse_split },
          { value: "info", label: "信息（历史）", disabled: true }
        ]
      : [
          { value: "split", label: corporateActionKindLabels.split },
          { value: "reverse_split", label: corporateActionKindLabels.reverse_split },
          { value: "dividend", label: corporateActionKindLabels.dividend }
        ];
  const eventTypeOptions = isDeprecatedEventType
    ? [
        ...ledgerEventTypeOptions,
        {
          value: form.eventType,
          label: ledgerEventTypeLabels[form.eventType],
          disabled: true
        }
      ]
    : ledgerEventTypeOptions;
  const showPrimaryInstrumentRow =
    usesInstrument || usesSide || usesQuantity || usesPrice;
  const shouldAutoFeeTax = form.eventType === "trade";
  const shouldAutoCashAmount = form.eventType === "trade" && form.cashAmountAuto;

  useEffect(() => {
    if (!shouldAutoFeeTax) return;
    const quantity = Number(form.quantity);
    const price = Number(form.price);
    if (!Number.isFinite(quantity) || !Number.isFinite(price) || quantity <= 0 || price < 0) {
      return;
    }
    const feeRateRaw =
      form.feeRate.trim() === "" ? null : Number(form.feeRate);
    const taxRateRaw =
      form.taxRate.trim() === "" ? null : Number(form.taxRate);
    const updates: Partial<LedgerFormState> = {};

    if (feeRateRaw !== null && Number.isFinite(feeRateRaw) && feeRateRaw >= 0) {
      const feeValue = (quantity * price * (feeRateRaw / 100)).toFixed(2);
      if (feeValue !== form.fee) {
        updates.fee = feeValue;
      }
    }
    if (taxRateRaw !== null && Number.isFinite(taxRateRaw) && taxRateRaw >= 0) {
      const taxValue = (quantity * price * (taxRateRaw / 100)).toFixed(2);
      if (taxValue !== form.tax) {
        updates.tax = taxValue;
      }
    }

    if (Object.keys(updates).length > 0) {
      onChange(updates);
    }
  }, [
    shouldAutoFeeTax,
    form.quantity,
    form.price,
    form.feeRate,
    form.taxRate,
    form.fee,
    form.tax,
    onChange
  ]);

  useEffect(() => {
    if (!shouldAutoCashAmount) return;
    if (!form.side) return;
    const quantity = Number(form.quantity);
    const price = Number(form.price);
    if (!Number.isFinite(quantity) || !Number.isFinite(price) || quantity <= 0 || price < 0) {
      return;
    }
    const feeRaw = Number(form.fee);
    const taxRaw = Number(form.tax);
    const feeValue = Number.isFinite(feeRaw) ? feeRaw : 0;
    const taxValue = Number.isFinite(taxRaw) ? taxRaw : 0;
    const baseAmount = quantity * price;
    const signedAmount = form.side === "buy" ? -baseAmount : baseAmount;
    const nextCashAmount = (signedAmount - feeValue - taxValue).toFixed(2);
    if (nextCashAmount !== form.cashAmount) {
      onChange({ cashAmount: nextCashAmount });
    }
  }, [
    shouldAutoCashAmount,
    form.side,
    form.quantity,
    form.price,
    form.fee,
    form.tax,
    form.cashAmount,
    onChange
  ]);

  useEffect(() => {
    if (form.eventType !== "trade") return;
    if (form.feeRate.trim() || form.taxRate.trim()) return;
    const storedRates = loadStoredRates(form.eventType);
    if (storedRates.feeRate || storedRates.taxRate) {
      onChange({
        feeRate: storedRates.feeRate,
        taxRate: storedRates.taxRate
      });
    }
  }, [form.eventType, form.feeRate, form.taxRate, onChange]);

  useEffect(() => {
    if (form.eventType !== "trade") return;
    const feeRateValue =
      form.feeRate.trim() === "" ? null : Number(form.feeRate);
    const taxRateValue =
      form.taxRate.trim() === "" ? null : Number(form.taxRate);
    if (
      feeRateValue === null ||
      taxRateValue === null ||
      !Number.isFinite(feeRateValue) ||
      !Number.isFinite(taxRateValue) ||
      feeRateValue < 0 ||
      taxRateValue < 0
    ) {
      return;
    }
    saveStoredRates(form.eventType, form.feeRate.trim(), form.taxRate.trim());
  }, [form.eventType, form.feeRate, form.taxRate]);

  useEffect(() => {
    if (form.eventType !== "trade") return;
    if (!form.priceCurrency) return;
    if (form.cashCurrency !== form.priceCurrency) {
      onChange({ cashCurrency: form.priceCurrency });
    }
  }, [form.eventType, form.priceCurrency, form.cashCurrency, onChange]);

  const corporateKindField = showCorporateControls ? (
    <FormGroup label="事件类型">
      <Select
        value={form.corporateKind}
        onChange={(e) =>
          onChange({ corporateKind: e.target.value as CorporateActionKindUi })
        }
        options={corporateKindOptions}
        className={compactSelectClass}
      />
    </FormGroup>
  ) : null;

  const cashLegField = usesCash ? (
    <FormGroup
      label={
        <span className="inline-flex items-center gap-1">
          现金腿
          <HelpHint text="买入为负，卖出为正；费用/税费为负；分红为正。" />
        </span>
      }
    >
      <Input
        type="number"
        value={form.cashAmount}
        onChange={(e) => {
          const nextValue = e.target.value;
          onChange({
            cashAmount: nextValue,
            cashAmountAuto: nextValue.trim() === ""
          });
        }}
        placeholder="0.00"
        className={`${cashAmountMissing ? missingHintClass : ""} ${compactInputClass}`}
      />
    </FormGroup>
  ) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
            <span
              className="material-icons-outlined text-primary text-base"
              aria-label={isEditing ? "编辑流水" : "新增流水"}
            >
              edit_note
            </span>
            <span className="sr-only">
              {isEditing ? "编辑流水" : "新增流水"}
            </span>
          </h3>
          <Select
            value={form.eventType}
            onChange={(e) =>
              {
                const nextCurrency =
                  form.priceCurrency || form.cashCurrency || baseCurrency;
                const nextEventType = e.target.value as LedgerEventType;
                onChange({
                  eventType: nextEventType,
                  cashCurrency: nextCurrency,
                  priceCurrency: nextCurrency,
                  cashAmountAuto: true
                });
              }
            }
            options={eventTypeOptions}
            className="h-6 w-32 rounded-none border-0 !bg-transparent dark:!bg-transparent py-0 pl-2 pr-6 text-[11px] focus:ring-0 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            className="rounded-none px-2 py-1 text-[11px]"
            onClick={onSubmit}
          >
            保存
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="rounded-none px-2 py-1 text-[11px]"
            onClick={onCancel}
          >
            取消
          </Button>
        </div>
      </div>
      <div className="border-t border-slate-200 dark:border-border-dark" />

      <div className="space-y-2">
        {showPrimaryInstrumentRow && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
            {usesInstrument && (
              <FormGroup label="代码">
                <Input
                  value={form.symbol}
                  onChange={(e) => onChange({ symbol: e.target.value })}
                  placeholder="例如: 600519.SH"
                  className={`${instrumentMissing ? missingHintClass : ""} ${compactInputClass}`}
                />
              </FormGroup>
            )}
              {usesSide && (
                <FormGroup label="方向">
                  <div
                    role="group"
                    aria-label="方向"
                    className={`grid grid-cols-2 overflow-hidden rounded-none border ${
                      sideMissing
                        ? "border-rose-500"
                        : "border-slate-300 dark:border-border-dark"
                    }`}
                  >
                    <button
                      type="button"
                      aria-pressed={form.side === "buy"}
                      onClick={() => onChange({ side: "buy" })}
                      className={`h-8 px-2 text-xs ${
                        form.side === "buy"
                          ? "bg-primary text-white"
                          : "bg-transparent text-slate-500 dark:text-slate-400"
                      } border-r border-slate-300 dark:border-border-dark`}
                    >
                      买入
                    </button>
                    <button
                      type="button"
                      aria-pressed={form.side === "sell"}
                      onClick={() => onChange({ side: "sell" })}
                      className={`h-8 px-2 text-xs ${
                        form.side === "sell"
                          ? "bg-primary text-white"
                          : "bg-transparent text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      卖出
                    </button>
                  </div>
                </FormGroup>
              )}
              {usesQuantity && (
                <FormGroup label="数量">
                  <Input
                    type="number"
                    value={form.quantity}
                    onChange={(e) => onChange({ quantity: e.target.value })}
                    placeholder="0"
                    className={`${quantityMissing ? missingHintClass : ""} ${compactInputClass}`}
                  />
                </FormGroup>
              )}
              {usesPrice && (
                <FormGroup label="价格">
                  <Input
                    type="number"
                    value={form.price}
                    onChange={(e) => onChange({ price: e.target.value })}
                    placeholder="0.00"
                    className={`${priceMissing ? missingHintClass : ""} ${compactInputClass}`}
                  />
                </FormGroup>
              )}
              {usesPrice && (
                <FormGroup label="价格币种">
                  <Input
                    value={form.priceCurrency}
                    onChange={(e) => {
                      const nextCurrency = e.target.value;
                      onChange({ priceCurrency: nextCurrency, cashCurrency: nextCurrency });
                    }}
                    placeholder={baseCurrency}
                    className={compactInputClass}
                  />
                </FormGroup>
              )}
              {usesInstrument && (
                <FormGroup
                  label={
                    <span className="inline-flex items-center gap-1">
                      标的标识
                      <HelpHint text="用于绑定稳定标的编号；可选，留空时使用代码。"/>
                    </span>
                  }
                >
                  <Input
                    value={form.instrumentId}
                    onChange={(e) => onChange({ instrumentId: e.target.value })}
                    placeholder="可选"
                    className={compactInputClass}
                  />
              </FormGroup>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          {isCorporateDividend ? (
            <>
              {corporateKindField}
              {cashLegField}
            </>
          ) : (
            <>
              {cashLegField}
              {corporateKindField}
            </>
          )}
          {showCorporateControls &&
            !isCorporateDividend &&
            form.corporateKind !== "info" && (
            <FormGroup
              label={
                <span className="inline-flex items-center gap-1">
                  调整后股数
                  <HelpHint text="当前 1 股调整后变为多少股。" />
                </span>
              }
            >
              <Input
                type="number"
                value={form.corporateAfterShares}
                onChange={(e) => onChange({ corporateAfterShares: e.target.value })}
                placeholder="例如: 2 或 0.5"
                className={`${corporateAfterSharesMissing ? missingHintClass : ""} ${compactInputClass}`}
              />
            </FormGroup>
          )}
          {usesFeeTax && (
            <FormGroup label="费率 %">
              <Input
                type="number"
                value={form.feeRate}
                onChange={(e) => onChange({ feeRate: e.target.value })}
                placeholder="0.03"
                className={compactInputClass}
              />
            </FormGroup>
          )}
          {usesFeeTax && (
            <FormGroup label="税率 %">
              <Input
                type="number"
                value={form.taxRate}
                onChange={(e) => onChange({ taxRate: e.target.value })}
                placeholder="0.1"
                className={compactInputClass}
              />
            </FormGroup>
          )}
          {usesFeeTax && (
            <FormGroup
              label={
                <span className="inline-flex items-center gap-1">
                  费用
                  <HelpHint text="交易手续费或佣金，通常为正数。"/>
                </span>
              }
            >
              <Input
                type="number"
                value={form.fee}
                onChange={(e) => onChange({ fee: e.target.value })}
                placeholder="0.00"
                disabled
                className={compactInputClass}
              />
            </FormGroup>
          )}
          {usesFeeTax && (
            <FormGroup
              label={
                <span className="inline-flex items-center gap-1">
                  税费
                  <HelpHint text="交易相关税费，通常为正数。"/>
                </span>
              }
            >
              <Input
                type="number"
                value={form.tax}
                onChange={(e) => onChange({ tax: e.target.value })}
                placeholder="0.00"
                disabled
                className={compactInputClass}
              />
            </FormGroup>
          )}
          <FormGroup
            label={
              <span className="inline-flex items-center gap-1">
                外部标识
                <HelpHint text="用于导入对账或去重的外部流水编号，可选。"/>
              </span>
            }
          >
            <Input
              value={form.externalId}
              onChange={(e) => onChange({ externalId: e.target.value })}
              placeholder="可选"
              className={compactInputClass}
            />
          </FormGroup>
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-border-dark" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <FormGroup label="交易日期">
          <Input
            type="date"
            value={form.tradeDate}
            onChange={(e) => onChange({ tradeDate: e.target.value })}
            className={`${tradeDateMissing ? missingHintClass : ""} ${compactInputClass}`}
          />
        </FormGroup>
        <FormGroup label="事件时间">
          <Input
            type="datetime-local"
            value={form.eventTime}
            onChange={(e) => onChange({ eventTime: e.target.value })}
            className={compactInputClass}
          />
        </FormGroup>
        <FormGroup label="排序序号">
          <Input
            type="number"
            value={form.sequence}
            onChange={(e) => onChange({ sequence: e.target.value })}
            placeholder="同日顺序"
            className={compactInputClass}
          />
        </FormGroup>
        <FormGroup
          label={
            <span className="inline-flex items-center gap-1">
              账户标识
              <HelpHint text="多账户预留字段，当前可留空。"/>
            </span>
          }
        >
          <Input
            value={form.accountKey}
            onChange={(e) => onChange({ accountKey: e.target.value })}
            placeholder="可选"
            className={compactInputClass}
          />
        </FormGroup>
        <FormGroup label="备注">
          <Input
            value={form.note}
            onChange={(e) => onChange({ note: e.target.value })}
            placeholder="可选"
            className={compactInputClass}
          />
        </FormGroup>
      </div>

    </div>
  );
}

function DataQualityCard({
  quality,
  onOpenMarketDataStatus
}: {
  quality: MarketDataQuality;
  onOpenMarketDataStatus?: () => void;
}) {
  const overall = describeDataQuality(quality.overallLevel);
  const coverage = describeDataQuality(quality.coverageLevel);
  const freshness = describeDataQuality(quality.freshnessLevel);
  const freshnessLabel =
    quality.freshnessDays === null ? "--" : `${quality.freshnessDays} 天`;

  return (
    <div className="bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark border border-slate-200 dark:border-border-dark rounded-lg p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${overall.badgeClass}`}>
            {overall.label}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">数据质量</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 dark:text-slate-500">
            截至 {quality.asOfDate ?? "--"}
          </span>
          {onOpenMarketDataStatus && (
            <button
              type="button"
              onClick={onOpenMarketDataStatus}
              className="text-xs text-primary hover:text-primary/80 transition-colors"
            >
              数据状态
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div className="bg-slate-50 dark:bg-background-dark rounded-md p-3">
          <div className="text-xs text-slate-500 mb-1">覆盖率</div>
          <div className="font-mono text-slate-800 dark:text-slate-200">
            {formatPctNullable(quality.coverageRatio ?? null)}
          </div>
          <div className={`text-[11px] font-semibold ${coverage.textClass}`}>
            {coverage.label}
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-background-dark rounded-md p-3">
          <div className="text-xs text-slate-500 mb-1">新鲜度</div>
          <div className="font-mono text-slate-800 dark:text-slate-200">
            {freshnessLabel}
          </div>
          <div className={`text-[11px] font-semibold ${freshness.textClass}`}>
            {freshness.label}
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-background-dark rounded-md p-3">
          <div className="text-xs text-slate-500 mb-1">缺失标的</div>
          <div className="font-mono text-slate-800 dark:text-slate-200">
            {quality.missingSymbols.length}
          </div>
          <div className="text-[11px] text-slate-400">
            {quality.missingSymbols.length ? "需要补齐行情" : "覆盖完整"}
          </div>
        </div>
      </div>
      {quality.notes.length > 0 && (
        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          {quality.notes.join("；")}
        </div>
      )}
    </div>
  );
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (min > max) return value;
  return Math.min(Math.max(value, min), max);
}

function formatNumber(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "--";
  return value.toFixed(digits);
}

function formatCnWanYiNullable(
  value: number | null | undefined,
  digits = 2,
  smallDigits = 0
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  const abs = Math.abs(value);
  if (abs >= 1e8) return `${(value / 1e8).toFixed(digits)}亿`;
  if (abs >= 1e4) return `${(value / 1e4).toFixed(digits)}万`;
  return value.toFixed(smallDigits);
}

function formatSignedCnWanYiNullable(
  value: number | null | undefined,
  digits = 2,
  smallDigits = 0
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(digits)}亿`;
  if (abs >= 1e4) return `${sign}${(abs / 1e4).toFixed(digits)}万`;
  return `${sign}${abs.toFixed(smallDigits)}`;
}

function formatCurrency(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "--";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatPctNullable(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return formatPct(value);
}

type ChangeTone = "up" | "down" | "flat" | "unknown";

function formatSignedNumberNullable(
  value: number | null | undefined,
  digits = 2
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}`;
}

function formatSignedPctNullable(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  const pct = value * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function getCnChangeTone(changePct: number | null | undefined): ChangeTone {
  if (changePct === null || changePct === undefined || Number.isNaN(changePct)) {
    return "unknown";
  }
  if (changePct > 0) return "up";
  if (changePct < 0) return "down";
  return "flat";
}

function getCnToneTextClass(tone: ChangeTone): string {
  switch (tone) {
    case "up":
      return "text-red-500";
    case "down":
      return "text-green-500";
    default:
      return "text-slate-500 dark:text-slate-400";
  }
}

function getCnToneColors(tone: ChangeTone): { line: string; fill: string } {
  switch (tone) {
    case "up":
      return { line: "#ef4444", fill: "#ef4444" };
    case "down":
      return { line: "#22c55e", fill: "#22c55e" };
    default:
      return { line: "#e2e8f0", fill: "#94a3b8" };
  }
}

function formatPerformanceMethod(value: PerformanceMethod): string {
  switch (value) {
    case "twr":
      return "TWR";
    case "mwr":
      return "MWR";
    default:
      return "--";
  }
}

function formatDateRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return "--";
  return `${start} ~ ${end}`;
}

function sortContributionEntries(entries: ContributionEntry[]): ContributionEntry[] {
  return [...entries].sort((a, b) => {
    const aScore = a.contribution === null ? -Infinity : Math.abs(a.contribution);
    const bScore = b.contribution === null ? -Infinity : Math.abs(b.contribution);
    if (aScore !== bScore) return bScore - aScore;
    return b.marketValue - a.marketValue;
  });
}

type TagAggregateResult = {
  totalCount: number;
  includedCount: number;
  excludedCount: number;
  weightedChangePct: number | null;
  totalWeight: number;
};

function computeTagAggregate(
  symbols: string[],
  quotesBySymbol: Record<string, MarketQuote>
): TagAggregateResult {
  let totalWeight = 0;
  let weightedChangeSum = 0;
  let includedCount = 0;

  symbols.forEach((symbol) => {
    const quote = quotesBySymbol[symbol];
    const changePct = quote?.changePct ?? null;
    const circMv = quote?.circMv ?? null;
    if (
      changePct === null ||
      circMv === null ||
      !Number.isFinite(changePct) ||
      !Number.isFinite(circMv) ||
      circMv <= 0
    ) {
      return;
    }
    includedCount += 1;
    totalWeight += circMv;
    weightedChangeSum += changePct * circMv;
  });

  return {
    totalCount: symbols.length,
    includedCount,
    excludedCount: Math.max(0, symbols.length - includedCount),
    weightedChangePct: totalWeight > 0 ? weightedChangeSum / totalWeight : null,
    totalWeight
  };
}

function sortTagMembersByChangePct(
  symbols: string[],
  quotesBySymbol: Record<string, MarketQuote>
): string[] {
  return [...symbols].sort((a, b) => {
    const aValue = quotesBySymbol[a]?.changePct;
    const bValue = quotesBySymbol[b]?.changePct;
    const aScore =
      aValue === null || aValue === undefined || Number.isNaN(aValue)
        ? -Infinity
        : aValue;
    const bScore =
      bValue === null || bValue === undefined || Number.isNaN(bValue)
        ? -Infinity
        : bValue;
    if (aScore !== bScore) return bScore - aScore;
    return a.localeCompare(b);
  });
}

function formatAssetClassLabel(value: string): string {
  if (value in assetClassLabels) {
    return assetClassLabels[value as AssetClass];
  }
  return value;
}

function formatRiskLimitTypeLabel(value: RiskLimitType): string {
  return riskLimitTypeLabels[value] ?? value;
}

function formatLedgerEventType(value: LedgerEventType): string {
  return ledgerEventTypeLabels[value] ?? value;
}

function formatLedgerSide(value: LedgerSide | null): string {
  if (!value) return "--";
  return ledgerSideLabels[value] ?? value;
}

function formatLedgerSource(value: LedgerSource): string {
  return ledgerSourceLabels[value] ?? value;
}

function isCorporateActionMeta(
  meta: LedgerEntryMeta | null
): meta is CorporateActionMeta {
  if (!meta || typeof meta !== "object") return false;
  const kind = (meta as CorporateActionMeta).kind;
  return kind === "split" || kind === "reverse_split" || kind === "info";
}

function formatCorporateActionMeta(meta: LedgerEntryMeta | null): string {
  if (!isCorporateActionMeta(meta)) return "--";
  if (meta.kind === "info") {
    const category = corporateActionCategoryLabels[meta.category] ?? meta.category;
    return `${category} · ${meta.title}`;
  }
  const kindLabel = corporateActionKindLabels[meta.kind] ?? meta.kind;
  return `${kindLabel} ${meta.numerator}:${meta.denominator}`;
}

function formatDateTime(value: number | null): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("zh-CN");
}

function formatDurationMs(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return "0s";
  const totalSeconds = Math.floor(durationMs / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  if (hours > 0) return `${hours}h${minutes}m`;
  if (minutes > 0) return `${minutes}m${seconds}s`;
  return `${seconds}s`;
}

function formatMarketTokenSource(source: MarketTokenStatus["source"]): string {
  switch (source) {
    case "env":
      return "环境变量";
    case "local":
      return "本地";
    case "none":
      return "无";
    default:
      return source;
  }
}

function formatIngestRunStatusLabel(status: MarketIngestRun["status"]): string {
  switch (status) {
    case "running":
      return "进行中";
    case "success":
      return "成功";
    case "partial":
      return "部分成功";
    case "failed":
      return "失败";
    case "canceled":
      return "已取消";
    default:
      return String(status);
  }
}

function formatIngestRunScopeLabel(scope: MarketIngestRun["scope"]): string {
  switch (scope) {
    case "targets":
      return "目标池";
    case "universe":
      return "全市场";
    default:
      return String(scope);
  }
}

function formatIngestRunModeLabel(mode: MarketIngestRun["mode"]): string {
  switch (mode) {
    case "daily":
      return "定时";
    case "bootstrap":
      return "初始化";
    case "manual":
      return "手动";
    case "on_demand":
      return "按需";
    default:
      return String(mode);
  }
}

function formatTargetsReasonLabel(reason: string): string {
  const normalized = reason.trim().toLowerCase();
  if (normalized === "holdings") return "持仓";
  if (normalized === "watchlist") return "自选";
  if (normalized === "registry" || normalized === "registry_auto_ingest") return "注册标的";
  if (normalized === "explicit") return "手动添加";
  if (normalized.startsWith("tag:")) return `标签：${reason.slice(4)}`;
  return reason;
}

function formatTargetsReasons(reasons: string[]): string {
  return reasons.map(formatTargetsReasonLabel).join("，");
}

function formatIngestRunTone(status: MarketIngestRun["status"]): string {
  switch (status) {
    case "success":
      return "text-emerald-600 dark:text-emerald-400";
    case "partial":
      return "text-amber-600 dark:text-amber-400";
    case "failed":
      return "text-red-600 dark:text-red-400";
    case "canceled":
      return "text-slate-500 dark:text-slate-400";
    case "running":
      return "text-primary";
    default:
      return "text-slate-700 dark:text-slate-200";
  }
}

function formatDateTimeInput(value: number | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function sanitizeToastMessage(message: string): string {
  if (!message) return message;
  const trimmed = message.trim();

  const redacted = trimmed.replace(/[A-Za-z0-9_-]{32,}/g, "[REDACTED]");

  if (/(^|\n)\s*at\s+/i.test(redacted)) {
    return "操作失败，请检查输入后重试。";
  }
  if (
    redacted.includes("node:") ||
    redacted.includes("file:") ||
    redacted.includes("/Volumes/") ||
    redacted.includes("/Users/")
  ) {
    return "操作失败，请检查输入后重试。";
  }

  const lower = redacted.toLowerCase();
  if (lower.includes("failed to fetch") || lower.includes("fetch failed")) {
    return "网络请求失败：无法访问数据源接口（请检查网络/代理/防火墙/DNS）。";
  }
  if (lower.includes("enotfound") || lower.includes("eai_again")) {
    return "DNS 解析失败：请检查网络或代理设置。";
  }
  if (lower.includes("etimedout") || lower.includes("timeout")) {
    return "请求超时：请检查网络或稍后重试。";
  }
  if (lower.includes("econnreset")) {
    return "连接被重置：请检查网络或稍后重试。";
  }

  return redacted || "操作失败，请检查输入后重试。";
}

function describeDataQuality(level: DataQualityLevel): {
  label: string;
  badgeClass: string;
  textClass: string;
} {
  switch (level) {
    case "ok":
      return {
        label: "可用",
        badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
        textClass: "text-emerald-600 dark:text-emerald-400"
      };
    case "partial":
      return {
        label: "有缺口",
        badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
        textClass: "text-amber-600 dark:text-amber-400"
      };
    default:
      return {
        label: "不可用",
        badgeClass: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
        textClass: "text-rose-600 dark:text-rose-400"
      };
  }
}

function toUserErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const raw = String(error.message ?? "").trim();
    if (!raw) return "未知错误。";

    const firstLine = raw.split("\n")[0]?.trim() ?? "";

    const handlerMatch =
      /^Error occurred in handler for '([^']+)': Error: (.+)$/.exec(firstLine);
    if (handlerMatch?.[2]) return handlerMatch[2].trim();

    const invokeMatch =
      /^Error invoking remote method '([^']+)': Error: (.+)$/.exec(firstLine);
    if (invokeMatch?.[2]) return invokeMatch[2].trim();

    const remoteMatch = /^Error: (.+)$/.exec(firstLine);
    if (remoteMatch?.[1]) return remoteMatch[1].trim();

    return firstLine || raw;
  }
  if (typeof error === "string") {
    const raw = error.trim();
    if (!raw) return "未知错误。";
    const firstLine = raw.split("\n")[0]?.trim() ?? "";

    const handlerMatch =
      /^Error occurred in handler for '([^']+)': Error: (.+)$/.exec(firstLine);
    if (handlerMatch?.[2]) return handlerMatch[2].trim();

    const invokeMatch =
      /^Error invoking remote method '([^']+)': Error: (.+)$/.exec(firstLine);
    if (invokeMatch?.[2]) return invokeMatch[2].trim();

    const remoteMatch = /^Error: (.+)$/.exec(firstLine);
    if (remoteMatch?.[1]) return remoteMatch[1].trim();

    return firstLine || raw;
  }
  return "未知错误。";
}

function formatInputDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseInputDate(value: string): Date | null {
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  const date = new Date();
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatCnDate(value: string | null | undefined): string {
  if (!value) return "--";
  const date = parseInputDate(value);
  if (!date) return value;
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function parseTargetPriceFromTags(tags: string[]): number | null {
  for (const raw of tags) {
    const tag = raw.trim();
    if (!tag) continue;
    const idx = tag.indexOf(":");
    if (idx <= 0) continue;
    const ns = tag.slice(0, idx).trim().toLowerCase();
    if (ns !== "target" && ns !== "tp" && ns !== "目标价") continue;
    const payload = tag.slice(idx + 1).trim();
    const value = Number(payload);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function buildManualThemeOptions(tags: TagSummary[]): PopoverSelectOption[] {
  const options: PopoverSelectOption[] = [];
  const seen = new Set<string>();
  tags.forEach((item) => {
    const raw = item.tag.trim();
    if (!raw.startsWith("theme:ths:")) return;
    const name = raw.slice("theme:ths:".length).trim();
    if (!name) return;
    const value = `theme:manual:${name}`;
    if (seen.has(value)) return;
    seen.add(value);
    options.push({ value, label: name });
  });
  options.sort((a, b) => a.label.localeCompare(b.label));
  return options;
}

function formatThemeLabel(theme: TagFacetTheme): string {
  if (theme.provider) {
    return `${theme.provider}:${theme.name}`;
  }
  return theme.name || theme.tag;
}

function computeFifoUnitCost(entries: LedgerEntry[], symbol: string): number | null {
  const key = symbol.trim();
  if (!key) return null;

  const candidates = entries
    .filter((entry) => {
      if (entry.symbol !== key) return false;
      if (entry.side !== "buy" && entry.side !== "sell") return false;
      if (entry.eventType !== "trade" && entry.eventType !== "adjustment") {
        return false;
      }
      const qty = entry.quantity;
      if (qty === null || !Number.isFinite(qty) || qty <= 0) return false;
      if (entry.side === "buy") {
        const price = entry.price;
        return price !== null && Number.isFinite(price) && price > 0;
      }
      return true;
    })
    .slice()
    .sort((a, b) => {
      if (a.tradeDate !== b.tradeDate) return a.tradeDate < b.tradeDate ? -1 : 1;
      const tsA = a.eventTs ?? 0;
      const tsB = b.eventTs ?? 0;
      if (tsA !== tsB) return tsA - tsB;
      const seqA = a.sequence ?? 0;
      const seqB = b.sequence ?? 0;
      if (seqA !== seqB) return seqA - seqB;
      return a.createdAt - b.createdAt;
    });

  if (candidates.length === 0) return null;

  const lots: Array<{ qty: number; price: number }> = [];
  for (const entry of candidates) {
    const qty = entry.quantity ?? 0;
    if (entry.side === "buy") {
      const price = entry.price ?? 0;
      lots.push({ qty, price });
      continue;
    }

    let remaining = qty;
    while (remaining > 0 && lots.length > 0) {
      const head = lots[0];
      const take = Math.min(head.qty, remaining);
      head.qty -= take;
      remaining -= take;
      if (head.qty <= 1e-12) lots.shift();
    }
  }

  let totalQty = 0;
  let totalCost = 0;
  for (const lot of lots) {
    totalQty += lot.qty;
    totalCost += lot.qty * lot.price;
  }
  if (totalQty <= 0) return null;
  return totalCost / totalQty;
}

function resolveMarketChartDateRange(
  range: MarketChartRangeKey,
  endDate: string
): { startDate: string; endDate: string } {
  const end = parseInputDate(endDate) ?? new Date();
  const start = new Date(end);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  switch (range) {
    case "1D":
      start.setDate(start.getDate() - 7);
      break;
    case "1W":
      start.setDate(start.getDate() - 7);
      break;
    case "1M":
      start.setMonth(start.getMonth() - 1);
      break;
    case "3M":
      start.setMonth(start.getMonth() - 3);
      break;
    case "6M":
      start.setMonth(start.getMonth() - 6);
      break;
    case "YTD":
      start.setMonth(0, 1);
      break;
    case "1Y":
      start.setFullYear(start.getFullYear() - 1);
      break;
    case "2Y":
      start.setFullYear(start.getFullYear() - 2);
      break;
    case "5Y":
      start.setFullYear(start.getFullYear() - 5);
      break;
    case "10Y":
      start.setFullYear(start.getFullYear() - 10);
      break;
    default:
      break;
  }

  return { startDate: formatInputDate(start), endDate: formatInputDate(end) };
}

const LEDGER_RATE_STORAGE_PREFIX = "mytrader:ledger:rates:";

function loadStoredRates(eventType: LedgerEventType): { feeRate: string; taxRate: string } {
  if (typeof window === "undefined" || !window.localStorage) {
    return { feeRate: "", taxRate: "" };
  }
  try {
    const raw = window.localStorage.getItem(`${LEDGER_RATE_STORAGE_PREFIX}${eventType}`);
    if (!raw) return { feeRate: "", taxRate: "" };
    const parsed = JSON.parse(raw) as { feeRate?: string; taxRate?: string };
    return {
      feeRate: typeof parsed.feeRate === "string" ? parsed.feeRate : "",
      taxRate: typeof parsed.taxRate === "string" ? parsed.taxRate : ""
    };
  } catch {
    return { feeRate: "", taxRate: "" };
  }
}

function saveStoredRates(eventType: LedgerEventType, feeRate: string, taxRate: string) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      `${LEDGER_RATE_STORAGE_PREFIX}${eventType}`,
      JSON.stringify({ feeRate, taxRate })
    );
  } catch {
    // ignore storage failures
  }
}

function deriveRateValue(
  amount: number | null | undefined,
  quantity: number | null | undefined,
  price: number | null | undefined
): string {
  if (amount === null || amount === undefined) return "";
  if (quantity === null || quantity === undefined) return "";
  if (price === null || price === undefined) return "";
  const base = quantity * price;
  if (!Number.isFinite(base) || base === 0) return "";
  const rate = (amount / base) * 100;
  if (!Number.isFinite(rate)) return "";
  return rate
    .toFixed(4)
    .replace(/\.?0+$/, "");
}

function parseOptionalNumberInput(value: string, field: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num)) {
    throw new Error(`${field}必须是数字。`);
  }
  return num;
}

function parseOptionalIntegerInput(value: string, field: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    throw new Error(`${field}必须是整数。`);
  }
  return num;
}

function formatCorporateAfterShares(numerator: number, denominator: number): string {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return "";
  }
  const value = numerator / denominator;
  if (!Number.isFinite(value) || value <= 0) return "";
  return value.toFixed(4).replace(/\.?0+$/, "");
}

function parseCorporateAfterShares(value: string): { numerator: number; denominator: number } {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("调整后股数不能为空。");
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("调整后股数必须为正数。");
  }
  const scale = 10000;
  const scaled = Math.round(parsed * scale);
  if (!Number.isFinite(scaled) || scaled <= 0) {
    throw new Error("调整后股数必须为正数。");
  }
  const divisor = greatestCommonDivisor(scaled, scale);
  return {
    numerator: scaled / divisor,
    denominator: scale / divisor
  };
}

function greatestCommonDivisor(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x || 1;
}

function parseOptionalDateTimeInput(value: string, field: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const ts = Date.parse(trimmed);
  if (Number.isNaN(ts)) {
    throw new Error(`${field}格式不正确。`);
  }
  return ts;
}

function createEmptyLedgerForm(baseCurrency: string): LedgerFormState {
  const storedRates = loadStoredRates("trade");
  return {
    eventType: "trade",
    tradeDate: formatInputDate(new Date()),
    eventTime: "",
    sequence: "",
    accountKey: "",
    instrumentId: "",
    symbol: "",
    side: "",
    quantity: "",
    price: "",
    priceCurrency: baseCurrency,
    cashAmount: "",
    cashCurrency: baseCurrency,
    fee: "",
    tax: "",
    feeRate: storedRates.feeRate,
    taxRate: storedRates.taxRate,
    cashAmountAuto: true,
    note: "",
    source: "manual",
    externalId: "",
    corporateKind: "split",
    corporateAfterShares: ""
  };
}

function DescriptionItem({ label, value }: { label: string, value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-2 border-b border-slate-50 dark:border-border-dark last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900 dark:text-slate-200">{value}</span>
    </div>
  )
}

function PerformanceChart({ series }: { series: PortfolioPerformanceSeries }) {
  if (series.points.length < 2) {
    return <EmptyState message={series.reason ?? "暂无收益曲线。"} />;
  }

  const width = 640;
  const height = 200;
  const returns = series.points.map((point) => point.returnPct);
  const min = Math.min(...returns, 0);
  const max = Math.max(...returns, 0);
  const range = max - min || 1;

  const toX = (index: number) =>
    (index / (series.points.length - 1)) * width;
  const toY = (value: number) => height - ((value - min) / range) * height;

  const path = series.points
    .map((point, index) => `${index === 0 ? "M" : "L"}${toX(index)},${toY(point.returnPct)}`)
    .join(" ");
  const baselineY = toY(0);
  const areaPath = `${path} L${width},${baselineY} L0,${baselineY} Z`;
  const endPoint = series.points[series.points.length - 1];

  return (
    <div className="bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark border border-slate-200 dark:border-border-dark rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wider text-slate-500">收益曲线</div>
        <Badge>{formatPerformanceMethod(series.method)}</Badge>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-40"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="performanceFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#performanceFill)" />
        <path d={path} fill="none" stroke="#0ea5e9" strokeWidth="2" />
        <line x1="0" y1={baselineY} x2={width} y2={baselineY} stroke="#94a3b8" strokeDasharray="4 4" />
      </svg>
      <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
        <span>{series.startDate}</span>
        <span className="font-mono">{formatPctNullable(endPoint?.returnPct)}</span>
        <span>{series.endDate}</span>
      </div>
      {series.reason && (
        <p className="text-xs text-slate-400 mt-2">{series.reason}</p>
      )}
    </div>
  );
}

interface ContributionTableProps {
  title: string;
  entries: ContributionEntry[];
  labelHeader?: string;
  showAll: boolean;
  topCount: number;
  showMarketValue: boolean;
  onToggle: () => void;
}

function ContributionTable({
  title,
  entries,
  labelHeader,
  showAll,
  topCount,
  showMarketValue,
  onToggle
}: ContributionTableProps) {
  const sorted = sortContributionEntries(entries);
  const visible = showAll ? sorted : sorted.slice(0, topCount);
  const canToggle = entries.length > topCount;

  return (
    <div className="bg-slate-50 dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark border border-slate-200/80 dark:border-border-dark rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wider text-slate-500">{title}</div>
        {canToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="text-xs text-primary hover:text-primary/80"
          >
            {showAll ? "收起" : "展开全部"}
          </button>
        )}
      </div>
      {visible.length === 0 ? (
        <div className="text-xs text-slate-400">暂无数据</div>
      ) : (
        <div className="overflow-hidden border border-slate-200 dark:border-border-dark">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-border-dark">
            <thead className="bg-slate-50 dark:bg-background-dark">
              <tr>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase">
                  {labelHeader ?? "标的"}
                </th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-500 uppercase">
                  权重
                </th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-500 uppercase">
                  区间涨跌
                </th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-500 uppercase">
                  贡献
                </th>
                {showMarketValue && (
                  <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-500 uppercase">
                    市值
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-surface-dark/70 divide-y divide-slate-200 dark:divide-border-dark">
              {visible.map((entry) => (
                <tr key={entry.key}>
                  <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-200">
                    {entry.label}
                  </td>
                  <td className="px-3 py-2 text-xs text-right font-mono text-slate-600 dark:text-slate-300">
                    {formatPct(entry.weight)}
                  </td>
                  <td className="px-3 py-2 text-xs text-right font-mono text-slate-600 dark:text-slate-300">
                    {formatPctNullable(entry.returnPct)}
                  </td>
                  <td className="px-3 py-2 text-xs text-right font-mono text-slate-700 dark:text-slate-100">
                    {formatPctNullable(entry.contribution)}
                  </td>
                  {showMarketValue && (
                    <td className="px-3 py-2 text-xs text-right font-mono text-slate-600 dark:text-slate-300">
                      {formatCurrency(entry.marketValue)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface RiskMetricCardProps {
  title: string;
  metrics: RiskSeriesMetrics;
  annualized: boolean;
}

function RiskMetricCard({ title, metrics, annualized }: RiskMetricCardProps) {
  const volatility = annualized ? metrics.volatilityAnnualized : metrics.volatility;
  return (
    <div className="bg-slate-50 dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark border border-slate-200/80 dark:border-border-dark rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wider text-slate-500">{title}</div>
        <div className="text-[11px] text-slate-400">{metrics.points} 点</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[11px] text-slate-500">
            波动率{annualized ? "（年化）" : ""}
          </div>
          <div className="text-lg font-mono text-slate-800 dark:text-slate-100">
            {formatPctNullable(volatility)}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-slate-500">最大回撤</div>
          <div className="text-lg font-mono text-slate-800 dark:text-slate-100">
            {formatPctNullable(metrics.maxDrawdown)}
          </div>
        </div>
      </div>
      <div className="text-[11px] text-slate-400 mt-2">
        区间 {formatDateRange(metrics.startDate, metrics.endDate)}
      </div>
      {metrics.reason && (
        <div className="text-[11px] text-slate-400 mt-1">{metrics.reason}</div>
      )}
    </div>
  );
}
