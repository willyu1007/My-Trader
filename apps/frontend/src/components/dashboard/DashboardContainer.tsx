import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import type {
  AssetClass,
  CorporateActionKind,
  CreateLedgerEntryInput,
  CreatePositionInput,
  CreateRiskLimitInput,
  LedgerEntry,
  LedgerEventType,
  LedgerSide,
  LedgerSource,
  MarketTargetsConfig,
  MarketDailyBar,
  MarketUniversePoolBucketStatus,
  PerformanceRangeKey,
  Portfolio,
  PortfolioPerformanceRangeResult,
  PortfolioSnapshot,
  PositionValuation,
  RiskLimit,
  RiskLimitType,
} from "@mytrader/shared";
import {
  DEFAULT_LEDGER_END_DATE,
  DEFAULT_LEDGER_START_DATE,
  MARKET_EXPLORER_DEFAULT_WIDTH,
  MARKET_EXPLORER_MAX_WIDTH,
  MARKET_EXPLORER_MIN_WIDTH,
  MARKET_EXPLORER_WIDTH_STORAGE_KEY,
  TARGETS_EDITOR_SPLIT_DEFAULT,
  TARGETS_EDITOR_SPLIT_MAX,
  TARGETS_EDITOR_SPLIT_MIN,
  TARGETS_EDITOR_SPLIT_STORAGE_KEY,
  analysisTabs,
  marketChartRanges,
  navItems,
  otherTabs,
  performanceRanges,
  portfolioTabs,
  schedulerTimezoneDefaults
} from "./constants";
import type {
  DashboardProps,
  PortfolioTab,
  WorkspaceView
} from "./types";
import {
  Panel,
  PlaceholderPanel,
  Modal,
  FormGroup,
  Input,
  Select,
  PopoverSelect,
  Button,
  IconButton,
  Badge,
  MarketQuoteHeader,
  ChartErrorBoundary,
  MarketAreaChart,
  MarketVolumeMiniChart,
  SummaryCard,
  EmptyState,
  ErrorState,
  HelpHint,
  ConfirmDialog,
  LedgerTable,
  LedgerForm,
  DataQualityCard,
  clampNumber,
  formatNumber,
  formatCnWanYiNullable,
  formatSignedCnWanYiNullable,
  formatCurrency,
  formatPct,
  formatPctNullable,
  formatSignedPctNullable,
  getCnChangeTone,
  getCnToneTextClass,
  formatPerformanceMethod,
  formatDateRange,
  computeTagAggregate,
  sortTagMembersByChangePct,
  formatAssetClassLabel,
  formatRiskLimitTypeLabel,
  formatLedgerEventType,
  isCorporateActionMeta,
  formatDateTime,
  formatDurationMs,
  formatMarketTokenSource,
  formatTagSourceLabel,
  formatIngestRunStatusLabel,
  formatIngestRunScopeLabel,
  formatIngestRunModeLabel,
  formatTargetsReasons,
  formatIngestRunTone,
  formatIngestControlStateLabel,
  getIngestControlStateDotClass,
  getUniversePoolBucketLabel,
  isSameSchedulerConfig,
  isSameUniversePoolConfig,
  isSameTargetsConfig,
  formatDateTimeInput,
  sanitizeToastMessage,
  toUserErrorMessage,
  formatInputDate,
  formatCnDate,
  parseTargetPriceFromTags,
  buildManualThemeOptions,
  formatThemeLabel,
  computeFifoUnitCost,
  resolveMarketChartDateRange,
  loadStoredRates,
  deriveRateValue,
  parseOptionalNumberInput,
  parseOptionalIntegerInput,
  formatCorporateAfterShares,
  parseCorporateAfterShares,
  parseOptionalDateTimeInput,
  createEmptyLedgerForm,
  DescriptionItem,
  PerformanceChart,
  ContributionTable,
  RiskMetricCard
} from "./shared";
import { AccountView } from "./views/AccountView";
import { DataAnalysisView } from "./views/DataAnalysisView";
import { DashboardOverlays } from "./views/DashboardOverlays";
import { MarketView } from "./views/MarketView";
import { OtherView } from "./views/OtherView";
import { PortfolioView } from "./views/PortfolioView";
import { RiskView } from "./views/RiskView";
import { SidebarNav } from "./views/SidebarNav";
import { TopToolbar } from "./views/TopToolbar";
import { useDashboardAnalysis } from "./hooks/use-dashboard-analysis";
import {
  useDashboardMarket,
  useDashboardMarketManagementActions,
  useDashboardMarketRuntimeEffects
} from "./hooks/use-dashboard-market";
import { useDashboardMarketInstrumentActions } from "./hooks/use-dashboard-market-instrument-actions";
import { useDashboardMarketAdminRefresh } from "./hooks/use-dashboard-market-admin-refresh";
import { useDashboardMarketTargetActions } from "./hooks/use-dashboard-market-target-actions";
import { useDashboardMarketTargetPoolStats } from "./hooks/use-dashboard-market-target-pool-stats";
import {
  useDashboardPortfolio
} from "./hooks/use-dashboard-portfolio";
import { useDashboardUi } from "./hooks/use-dashboard-ui";

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
type TargetPoolStatsScope = "universe" | "focus";
type UniversePoolBucketId = MarketUniversePoolBucketStatus["bucket"];

interface TargetPoolCategoryDetail {
  key: string;
  label: string;
  symbols: string[];
}

interface TargetPoolStructureStats {
  totalSymbols: number;
  industryL1Count: number;
  industryL2Count: number;
  conceptCount: number;
  unclassifiedCount: number;
  classificationCoverage: number | null;
  allSymbols: string[];
  classifiedSymbols: string[];
  industryL1Details: TargetPoolCategoryDetail[];
  industryL2Details: TargetPoolCategoryDetail[];
  conceptDetails: TargetPoolCategoryDetail[];
  unclassifiedSymbols: string[];
  symbolNames: Record<string, string | null>;
  loading: boolean;
  error: string | null;
}

const UNIVERSE_POOL_BUCKET_ORDER: UniversePoolBucketId[] = [
  "cn_a",
  "etf",
  "precious_metal"
];

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
const TARGET_POOL_STRUCTURE_EMPTY: TargetPoolStructureStats = {
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

const CONTRIBUTION_TOP_N = 5;
const HHI_WARN_THRESHOLD = 0.25;

export function Dashboard({ account, onLock, onActivePortfolioChange }: DashboardProps) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [activePortfolioId, setActivePortfolioId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const {
    error,
    setError,
    notice,
    setNotice,
    activeView,
    setActiveView,
    otherTab,
    setOtherTab,
    analysisTab,
    setAnalysisTab,
    isNavCollapsed,
    setIsNavCollapsed
  } = useDashboardUi();
  const {
    analysisInstrumentQuery,
    setAnalysisInstrumentQuery,
    analysisInstrumentSearchResults,
    setAnalysisInstrumentSearchResults,
    analysisInstrumentSearchLoading,
    setAnalysisInstrumentSearchLoading,
    analysisInstrumentSymbol,
    setAnalysisInstrumentSymbol,
    analysisInstrumentRange,
    setAnalysisInstrumentRange,
    analysisInstrumentProfile,
    setAnalysisInstrumentProfile,
    analysisInstrumentUserTags,
    setAnalysisInstrumentUserTags,
    analysisInstrumentQuote,
    setAnalysisInstrumentQuote,
    analysisInstrumentBars,
    setAnalysisInstrumentBars,
    analysisInstrumentLoading,
    setAnalysisInstrumentLoading,
    analysisInstrumentError,
    setAnalysisInstrumentError
  } = useDashboardAnalysis<MarketChartRangeKey>({
    defaultInstrumentRange: "6M"
  });
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

  const analysisInstrumentSearchTimerRef = useRef<number | null>(null);
  const analysisInstrumentSearchRequestIdRef = useRef(0);
  const analysisInstrumentLoadRequestIdRef = useRef(0);

  const {
    marketCatalogSyncing,
    setMarketCatalogSyncing,
    marketCatalogSyncSummary,
    setMarketCatalogSyncSummary,
    marketSearchQuery,
    setMarketSearchQuery,
    marketSearchResults,
    marketSearchLoading,
    marketScope,
    setMarketScope,
    marketExplorerWidth,
    setMarketExplorerWidth,
    targetsEditorLeftPct,
    setTargetsEditorLeftPct,
    marketTags,
    setMarketTags,
    marketTagsLoading,
    setMarketTagsLoading,
    marketTagPickerOpen,
    setMarketTagPickerOpen,
    marketTagPickerQuery,
    setMarketTagPickerQuery,
    marketSelectedTag,
    setMarketSelectedTag,
    marketTagMembers,
    setMarketTagMembers,
    marketTagMembersLoading,
    setMarketTagMembersLoading,
    marketFiltersOpen,
    setMarketFiltersOpen,
    marketFilterMarket,
    setMarketFilterMarket,
    marketFilterAssetClasses,
    setMarketFilterAssetClasses,
    marketFilterKinds,
    setMarketFilterKinds,
    marketQuotesBySymbol,
    setMarketQuotesBySymbol,
    marketQuotesLoading,
    setMarketQuotesLoading,
    marketChartRange,
    setMarketChartRange,
    marketChartBars,
    setMarketChartBars,
    marketChartLoading,
    setMarketChartLoading,
    marketVolumeMode,
    setMarketVolumeMode,
    marketDemoSeeding,
    setMarketDemoSeeding,
    marketTagSeriesResult,
    marketTagSeriesBars,
    marketTagSeriesLoading,
    marketTagSeriesError,
    marketTagChartHoverDate,
    setMarketTagChartHoverDate,
    marketTagChartHoverPrice,
    setMarketTagChartHoverPrice,
    marketInstrumentDetailsOpen,
    setMarketInstrumentDetailsOpen,
    marketTagMembersModalOpen,
    setMarketTagMembersModalOpen,
    marketTokenStatus,
    setMarketTokenStatus,
    marketTokenDraft,
    setMarketTokenDraft,
    marketTokenProvider,
    setMarketTokenProvider,
    marketTokenSaving,
    setMarketTokenSaving,
    marketTokenTesting,
    setMarketTokenTesting,
    marketIngestRuns,
    setMarketIngestRuns,
    marketIngestRunsLoading,
    setMarketIngestRunsLoading,
    marketIngestTriggering,
    setMarketIngestTriggering,
    marketSelectedSymbol,
    setMarketSelectedSymbol,
    marketSelectedProfile,
    setMarketSelectedProfile,
    marketSelectedUserTags,
    setMarketSelectedUserTags,
    marketUserTagDraft,
    setMarketUserTagDraft,
    marketShowProviderData,
    setMarketShowProviderData,
    marketManualThemeOptions,
    setMarketManualThemeOptions,
    marketManualThemeLoading,
    setMarketManualThemeLoading,
    marketManualThemeDraft,
    setMarketManualThemeDraft,
    marketWatchlistItems,
    setMarketWatchlistItems,
    marketWatchlistLoading,
    setMarketWatchlistLoading,
    marketWatchlistGroupDraft,
    setMarketWatchlistGroupDraft,
    marketTargetsConfig,
    setMarketTargetsConfig,
    marketTargetsSavedConfig,
    setMarketTargetsSavedConfig,
    marketTargetsPreview,
    setMarketTargetsPreview,
    marketTargetsDiffPreview,
    setMarketTargetsDiffPreview,
    marketTargetsLoading,
    setMarketTargetsLoading,
    marketTargetsSaving,
    setMarketTargetsSaving,
    marketTargetsSymbolDraft,
    setMarketTargetsSymbolDraft,
    marketManualSymbolPreview,
    setMarketManualSymbolPreview,
    marketTargetsTagDraft,
    setMarketTargetsTagDraft,
    marketTagManagementQuery,
    setMarketTagManagementQuery,
    marketCurrentTargetsModalOpen,
    setMarketCurrentTargetsModalOpen,
    marketCurrentTargetsFilter,
    setMarketCurrentTargetsFilter,
    marketTargetPoolDetailMetric,
    setMarketTargetPoolDetailMetric,
    marketTargetPoolDetailCategoryKey,
    setMarketTargetPoolDetailCategoryKey,
    marketTargetPoolDetailMemberFilter,
    setMarketTargetPoolDetailMemberFilter,
    marketTargetsSectionOpen,
    setMarketTargetsSectionOpen,
    marketDiffSectionOpen,
    setMarketDiffSectionOpen,
    marketTargetPoolStatsScope,
    setMarketTargetPoolStatsScope,
    marketTargetPoolStatsByScope,
    setMarketTargetPoolStatsByScope,
    marketTempTargets,
    setMarketTempTargets,
    marketTempTargetsLoading,
    setMarketTempTargetsLoading,
    marketSelectedTempTargetSymbols,
    setMarketSelectedTempTargetSymbols,
    marketIngestControlStatus,
    setMarketIngestControlStatus,
    marketIngestControlUpdating,
    setMarketIngestControlUpdating,
    marketSchedulerConfig,
    setMarketSchedulerConfig,
    marketSchedulerSavedConfig,
    setMarketSchedulerSavedConfig,
    marketSchedulerLoading,
    setMarketSchedulerLoading,
    marketSchedulerSaving,
    setMarketSchedulerSaving,
    marketUniversePoolConfig,
    setMarketUniversePoolConfig,
    marketUniversePoolSavedConfig,
    setMarketUniversePoolSavedConfig,
    marketUniversePoolOverview,
    setMarketUniversePoolOverview,
    marketUniversePoolLoading,
    setMarketUniversePoolLoading,
    marketUniversePoolSaving,
    setMarketUniversePoolSaving,
    marketSchedulerAdvancedOpen,
    setMarketSchedulerAdvancedOpen,
    marketTriggerIngestBlockedOpen,
    setMarketTriggerIngestBlockedOpen,
    marketTriggerIngestBlockedMessage,
    setMarketTriggerIngestBlockedMessage,
    marketRegistryResult,
    setMarketRegistryResult,
    marketRegistryLoading,
    setMarketRegistryLoading,
    marketRegistryQuery,
    setMarketRegistryQuery,
    marketRegistryAutoFilter,
    setMarketRegistryAutoFilter,
    marketRegistrySelectedSymbols,
    setMarketRegistrySelectedSymbols,
    marketRegistryUpdating,
    setMarketRegistryUpdating,
    marketSelectedIngestRunId,
    setMarketSelectedIngestRunId,
    marketSelectedIngestRun,
    setMarketSelectedIngestRun,
    marketSelectedIngestRunLoading,
    setMarketSelectedIngestRunLoading,
    marketChartHoverDate,
    setMarketChartHoverDate,
    marketChartHoverPrice,
    setMarketChartHoverPrice
  } = useDashboardMarket({
    clampNumber,
    defaultMarketScope: "holdings" as MarketScope,
    defaultMarketFilterMarket: "all" as MarketFilterMarket,
    defaultMarketChartRange: "6M" as MarketChartRangeKey,
    defaultTokenProvider: "tushare",
    marketExplorerDefaultWidth: MARKET_EXPLORER_DEFAULT_WIDTH,
    marketExplorerMinWidth: MARKET_EXPLORER_MIN_WIDTH,
    marketExplorerMaxWidth: MARKET_EXPLORER_MAX_WIDTH,
    marketExplorerStorageKey: MARKET_EXPLORER_WIDTH_STORAGE_KEY,
    targetsEditorSplitDefault: TARGETS_EDITOR_SPLIT_DEFAULT,
    targetsEditorSplitMin: TARGETS_EDITOR_SPLIT_MIN,
    targetsEditorSplitMax: TARGETS_EDITOR_SPLIT_MAX,
    targetsEditorSplitStorageKey: TARGETS_EDITOR_SPLIT_STORAGE_KEY,
    defaultTargetsConfig: {
      includeHoldings: true,
      includeRegistryAutoIngest: false,
      includeWatchlist: true,
      portfolioIds: null,
      explicitSymbols: [],
      tagFilters: []
    },
    defaultManualSymbolPreview: {
      addable: [],
      existing: [],
      invalid: [],
      duplicates: 0
    },
    defaultTargetsSectionOpen: {
      scope: true,
      symbols: true
    },
    defaultDiffSectionOpen: {
      added: false,
      removed: false,
      reasonChanged: false
    },
    defaultTargetPoolStatsScope: "focus" as TargetPoolStatsScope,
    defaultTargetPoolStatsByScope: {
      universe: { ...TARGET_POOL_STRUCTURE_EMPTY },
      focus: { ...TARGET_POOL_STRUCTURE_EMPTY }
    } as Record<TargetPoolStatsScope, TargetPoolStructureStats>,
    defaultRegistryAutoFilter: "all",
    activeView,
    snapshotPriceAsOf: snapshot?.priceAsOf ?? null,
    toUserErrorMessage,
    reportError: (message) => setError(message),
    resolveMarketChartDateRange,
    formatInputDate
  });
  const marketExplorerResizeRef = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
  } | null>(null);
  const targetsEditorGridRef = useRef<HTMLDivElement | null>(null);
  const targetsEditorResizeRef = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
    startPct: number;
  } | null>(null);

  const latestMarketIngestRun = useMemo(() => {
    if (marketIngestRuns.length === 0) return null;
    return marketIngestRuns.reduce((latest, candidate) =>
      candidate.startedAt > latest.startedAt ? candidate : latest
    );
  }, [marketIngestRuns]);

  const marketSelectedIndustry = marketSelectedProfile?.tagFacets?.industry ?? [];
  const marketSelectedThemes = marketSelectedProfile?.tagFacets?.themes ?? [];
  const marketSelectedManualThemes = useMemo(
    () => marketSelectedUserTags.filter((tag) => tag.startsWith("theme:manual:")),
    [marketSelectedUserTags]
  );
  const marketSelectedPlainUserTags = useMemo(
    () => marketSelectedUserTags.filter((tag) => !tag.startsWith("theme:manual:")),
    [marketSelectedUserTags]
  );

  const marketTargetsDirty = useMemo(() => {
    if (!marketTargetsSavedConfig) return false;
    return !isSameTargetsConfig(marketTargetsSavedConfig, marketTargetsConfig);
  }, [marketTargetsConfig, marketTargetsSavedConfig]);

  const marketSchedulerDirty = useMemo(() => {
    if (!marketSchedulerConfig || !marketSchedulerSavedConfig) return false;
    return !isSameSchedulerConfig(marketSchedulerSavedConfig, marketSchedulerConfig);
  }, [marketSchedulerConfig, marketSchedulerSavedConfig]);

  const marketUniversePoolDirty = useMemo(() => {
    if (!marketUniversePoolConfig || !marketUniversePoolSavedConfig) return false;
    return !isSameUniversePoolConfig(
      marketUniversePoolSavedConfig,
      marketUniversePoolConfig
    );
  }, [marketUniversePoolConfig, marketUniversePoolSavedConfig]);

  const marketIngestControlState = marketIngestControlStatus?.state ?? "idle";
  const marketCanTriggerIngestNow =
    !marketIngestControlUpdating && Boolean(marketTokenStatus?.configured);
  const marketCanPauseIngest =
    !marketIngestControlUpdating && marketIngestControlState === "running";
  const marketCanResumeIngest =
    !marketIngestControlUpdating && marketIngestControlState === "paused";
  const marketCanCancelIngest =
    !marketIngestControlUpdating &&
    (marketIngestControlState === "running" ||
      marketIngestControlState === "paused");

  const marketSchedulerTimezoneOptions = useMemo(() => {
    const values = [...schedulerTimezoneDefaults];
    const current = marketSchedulerConfig?.timezone?.trim();
    if (current && !values.includes(current)) {
      values.unshift(current);
    }
    return values.map((value) => ({ value, label: value }));
  }, [marketSchedulerConfig?.timezone]);

  const marketRegistryEntryEnabled = false;

  const marketCurrentTargetsSource = useMemo(
    () => marketTargetsDiffPreview?.draft.symbols ?? marketTargetsPreview?.symbols ?? [],
    [marketTargetsDiffPreview?.draft.symbols, marketTargetsPreview?.symbols]
  );

  const marketCurrentTargetsKeyword = marketCurrentTargetsFilter
    .trim()
    .toLowerCase();

  const marketFilteredCurrentTargets = useMemo(() => {
    if (!marketCurrentTargetsKeyword) return marketCurrentTargetsSource;
    return marketCurrentTargetsSource.filter((row) =>
      row.symbol.toLowerCase().includes(marketCurrentTargetsKeyword)
    );
  }, [marketCurrentTargetsKeyword, marketCurrentTargetsSource]);

  const marketFilteredAddedSymbols = useMemo(() => {
    return marketTargetsDiffPreview?.addedSymbols ?? [];
  }, [marketTargetsDiffPreview?.addedSymbols]);

  const marketFilteredRemovedSymbols = useMemo(() => {
    return marketTargetsDiffPreview?.removedSymbols ?? [];
  }, [marketTargetsDiffPreview?.removedSymbols]);

  const marketFilteredReasonChangedSymbols = useMemo(() => {
    return marketTargetsDiffPreview?.reasonChangedSymbols ?? [];
  }, [marketTargetsDiffPreview?.reasonChangedSymbols]);

  const marketFocusTargetSymbols = useMemo(
    () =>
      Array.from(
        new Set(
          (marketTargetsDiffPreview?.draft.symbols ?? marketTargetsPreview?.symbols ?? [])
            .map((item) => item.symbol.trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [marketTargetsDiffPreview?.draft.symbols, marketTargetsPreview?.symbols]
  );

  const marketActiveTargetPoolStats = useMemo(
    () => marketTargetPoolStatsByScope[marketTargetPoolStatsScope],
    [marketTargetPoolStatsByScope, marketTargetPoolStatsScope]
  );

  const marketTargetPoolScopeLabel = useMemo(
    () => (marketTargetPoolStatsScope === "universe" ? "全量标的" : "强相关标的"),
    [marketTargetPoolStatsScope]
  );

  const marketUniverseEnabledBuckets = useMemo(() => {
    const source = marketUniversePoolConfig?.enabledBuckets ?? UNIVERSE_POOL_BUCKET_ORDER;
    return new Set(source);
  }, [marketUniversePoolConfig?.enabledBuckets]);

  const marketUniverseBucketStatusById = useMemo(() => {
    const map = new Map<UniversePoolBucketId, MarketUniversePoolBucketStatus>();
    marketUniversePoolOverview?.buckets.forEach((item) => map.set(item.bucket, item));
    return map;
  }, [marketUniversePoolOverview?.buckets]);

  const marketTargetPoolMetricCards = useMemo(
    () => [
      {
        key: "totalSymbols" as const,
        label: "标的总数",
        value: String(marketActiveTargetPoolStats.totalSymbols)
      },
      {
        key: "industryL1Count" as const,
        label: "一级行业分类",
        value: String(marketActiveTargetPoolStats.industryL1Count)
      },
      {
        key: "industryL2Count" as const,
        label: "二级行业分类",
        value: String(marketActiveTargetPoolStats.industryL2Count)
      },
      {
        key: "conceptCount" as const,
        label: "概念分类数",
        value: String(marketActiveTargetPoolStats.conceptCount)
      },
      {
        key: "unclassifiedCount" as const,
        label: "未分类标的",
        value: String(marketActiveTargetPoolStats.unclassifiedCount)
      },
      {
        key: "classificationCoverage" as const,
        label: "分类覆盖率",
        value:
          marketActiveTargetPoolStats.classificationCoverage === null
            ? "--"
            : formatPct(marketActiveTargetPoolStats.classificationCoverage)
      }
    ],
    [marketActiveTargetPoolStats]
  );

  const marketTargetPoolDetailTitle = useMemo(() => {
    if (!marketTargetPoolDetailMetric) return "";
    const card = marketTargetPoolMetricCards.find(
      (item) => item.key === marketTargetPoolDetailMetric
    );
    return `${marketTargetPoolScopeLabel} · ${card?.label ?? "指标详情"}`;
  }, [marketTargetPoolDetailMetric, marketTargetPoolMetricCards, marketTargetPoolScopeLabel]);

  const marketTargetPoolDetailValue = useMemo(() => {
    if (!marketTargetPoolDetailMetric) return "--";
    const card = marketTargetPoolMetricCards.find(
      (item) => item.key === marketTargetPoolDetailMetric
    );
    return card?.value ?? "--";
  }, [marketTargetPoolDetailMetric, marketTargetPoolMetricCards]);

  const marketTargetPoolDetailDescription = useMemo(() => {
    if (!marketTargetPoolDetailMetric) return "";
    switch (marketTargetPoolDetailMetric) {
      case "totalSymbols":
        return "当前口径下参与统计的标的总数。";
      case "industryL1Count":
        return "已命中的一级行业分类标签。";
      case "industryL2Count":
        return "已命中的二级行业分类标签。";
      case "conceptCount":
        return "已命中的概念（主题）分类标签。";
      case "unclassifiedCount":
        return "未命中行业与概念分类的标的数量。";
      case "classificationCoverage":
        return "有任一行业或概念分类的标的占比。";
      default:
        return "";
    }
  }, [marketTargetPoolDetailMetric]);

  const marketTargetPoolDetailCategoryRows = useMemo(() => {
    if (!marketTargetPoolDetailMetric) {
      return [] as Array<{
        key: string;
        label: string;
        symbols: string[];
        count: number;
        ratio: number | null;
      }>;
    }

    const total = Math.max(0, marketActiveTargetPoolStats.totalSymbols);
    const toRow = (detail: TargetPoolCategoryDetail) => {
      const count = detail.symbols.length;
      return {
        key: detail.key,
        label: detail.label,
        symbols: detail.symbols,
        count,
        ratio: total > 0 ? count / total : null
      };
    };

    switch (marketTargetPoolDetailMetric) {
      case "industryL1Count":
        return marketActiveTargetPoolStats.industryL1Details.map(toRow);
      case "industryL2Count":
        return marketActiveTargetPoolStats.industryL2Details.map(toRow);
      case "conceptCount":
        return marketActiveTargetPoolStats.conceptDetails.map(toRow);
      case "unclassifiedCount":
        return [
          toRow({
            key: "unclassified",
            label: "未分类",
            symbols: marketActiveTargetPoolStats.unclassifiedSymbols
          })
        ];
      case "classificationCoverage":
        return [
          toRow({
            key: "classified",
            label: "已分类",
            symbols: marketActiveTargetPoolStats.classifiedSymbols
          }),
          toRow({
            key: "unclassified",
            label: "未分类",
            symbols: marketActiveTargetPoolStats.unclassifiedSymbols
          })
        ];
      case "totalSymbols":
      default:
        return [
          toRow({
            key: "all",
            label: "全部标的",
            symbols: marketActiveTargetPoolStats.allSymbols
          }),
          toRow({
            key: "classified",
            label: "已分类",
            symbols: marketActiveTargetPoolStats.classifiedSymbols
          }),
          toRow({
            key: "unclassified",
            label: "未分类",
            symbols: marketActiveTargetPoolStats.unclassifiedSymbols
          })
        ];
    }
  }, [marketActiveTargetPoolStats, marketTargetPoolDetailMetric]);

  const marketTargetPoolActiveCategoryRow = useMemo(() => {
    if (marketTargetPoolDetailCategoryRows.length === 0) return null;
    const selected = marketTargetPoolDetailCategoryRows.find(
      (row) => row.key === marketTargetPoolDetailCategoryKey
    );
    return selected ?? marketTargetPoolDetailCategoryRows[0];
  }, [marketTargetPoolDetailCategoryRows, marketTargetPoolDetailCategoryKey]);

  const marketTargetPoolDetailMembers = useMemo(() => {
    const source = marketTargetPoolActiveCategoryRow?.symbols ?? [];
    const keyword = marketTargetPoolDetailMemberFilter.trim().toLowerCase();
    if (!keyword) return source;
    return source.filter((symbol) => {
      const normalized = symbol.toLowerCase();
      if (normalized.includes(keyword)) return true;
      const name = marketActiveTargetPoolStats.symbolNames[symbol]?.toLowerCase() ?? "";
      return Boolean(name && name.includes(keyword));
    });
  }, [
    marketTargetPoolActiveCategoryRow,
    marketTargetPoolDetailMemberFilter,
    marketActiveTargetPoolStats.symbolNames
  ]);

  useEffect(() => {
    if (!marketTargetPoolDetailMetric) {
      setMarketTargetPoolDetailCategoryKey(null);
      setMarketTargetPoolDetailMemberFilter("");
      return;
    }
    setMarketTargetPoolDetailCategoryKey(null);
    setMarketTargetPoolDetailMemberFilter("");
  }, [marketTargetPoolDetailMetric, marketTargetPoolStatsScope]);

  useEffect(() => {
    if (!marketTargetPoolDetailCategoryRows.length) {
      setMarketTargetPoolDetailCategoryKey(null);
      return;
    }
    if (
      !marketTargetPoolDetailCategoryKey ||
      !marketTargetPoolDetailCategoryRows.some(
        (row) => row.key === marketTargetPoolDetailCategoryKey
      )
    ) {
      setMarketTargetPoolDetailCategoryKey(marketTargetPoolDetailCategoryRows[0]?.key ?? null);
    }
  }, [marketTargetPoolDetailCategoryRows, marketTargetPoolDetailCategoryKey]);

  const handleToggleTargetsSection = useCallback(
    (section: "scope" | "symbols") => {
      setMarketTargetsSectionOpen((prev) => ({
        ...prev,
        [section]: !prev[section]
      }));
    },
    []
  );

  const handleToggleDiffSection = useCallback(
    (section: "added" | "removed" | "reasonChanged") => {
      setMarketDiffSectionOpen((prev) => ({
        ...prev,
        [section]: !prev[section]
      }));
    },
    []
  );

  const activePortfolio = useMemo(
    () => portfolios.find((portfolio) => portfolio.id === activePortfolioId) ?? null,
    [portfolios, activePortfolioId]
  );

  const {
    portfolioName,
    setPortfolioName,
    portfolioBaseCurrency,
    setPortfolioBaseCurrency,
    portfolioRename,
    setPortfolioRename,
    positionForm,
    setPositionForm,
    riskForm,
    setRiskForm,
    ledgerEntries,
    setLedgerEntries,
    ledgerLoading,
    setLedgerLoading,
    ledgerError,
    setLedgerError,
    ledgerFilter,
    setLedgerFilter,
    ledgerStartDate,
    setLedgerStartDate,
    ledgerEndDate,
    setLedgerEndDate,
    ledgerForm,
    setLedgerForm,
    isLedgerFormOpen,
    setIsLedgerFormOpen,
    ledgerDeleteTarget,
    setLedgerDeleteTarget,
    holdingsCsvPath,
    setHoldingsCsvPath,
    pricesCsvPath,
    setPricesCsvPath
  } = useDashboardPortfolio<
    PositionFormState,
    RiskFormState,
    LedgerFormState,
    LedgerEntry,
    LedgerFilter
  >({
    activePortfolioName: activePortfolio?.name ?? null,
    activePortfolioBaseCurrency: activePortfolio?.baseCurrency ?? null,
    activePortfolioResetKey: activePortfolio?.id ?? null,
    emptyPositionForm,
    emptyRiskForm,
    createEmptyLedgerForm,
    defaultBaseCurrency: "CNY",
    defaultLedgerFilter: "all",
    defaultLedgerStartDate: DEFAULT_LEDGER_START_DATE,
    defaultLedgerEndDate: DEFAULT_LEDGER_END_DATE
  });

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

  const marketSearchResultSymbols = useMemo(
    () => marketSearchResultsFiltered.map((item) => item.symbol),
    [marketSearchResultsFiltered]
  );

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

  const analysisInstrumentNameBySymbol = useMemo(() => {
    const map = new Map<string, string>();
    snapshot?.positions.forEach((pos) => {
      const symbol = pos.position.symbol;
      if (symbol) map.set(symbol, pos.position.name ?? symbol);
    });
    marketWatchlistItems.forEach((item) => {
      map.set(item.symbol, item.name ?? item.symbol);
    });
    analysisInstrumentSearchResults.forEach((item) => {
      map.set(item.symbol, item.name ?? item.symbol);
    });
    if (analysisInstrumentProfile) {
      map.set(
        analysisInstrumentProfile.symbol,
        analysisInstrumentProfile.name ?? analysisInstrumentProfile.symbol
      );
    }
    return map;
  }, [
    analysisInstrumentProfile,
    analysisInstrumentSearchResults,
    marketWatchlistItems,
    snapshot
  ]);

  const analysisInstrumentQuickSymbols = useMemo(() => {
    const set = new Set<string>();
    snapshot?.positions.forEach((pos) => {
      if (pos.position.assetClass === "cash") return;
      if (!pos.position.symbol) return;
      set.add(pos.position.symbol);
    });
    marketWatchlistItems.forEach((item) => {
      if (item.symbol) set.add(item.symbol);
    });
    return Array.from(set).slice(0, 16);
  }, [marketWatchlistItems, snapshot]);

  const analysisInstrumentLatestBar = useMemo(() => {
    for (let idx = analysisInstrumentBars.length - 1; idx >= 0; idx -= 1) {
      const bar = analysisInstrumentBars[idx];
      if (bar.close !== null) return bar;
    }
    return null;
  }, [analysisInstrumentBars]);

  const analysisInstrumentHasEnoughData = useMemo(() => {
    let count = 0;
    for (const bar of analysisInstrumentBars) {
      if (bar.close !== null && Number.isFinite(bar.close)) {
        count += 1;
      }
      if (count >= 2) return true;
    }
    return false;
  }, [analysisInstrumentBars]);

  const analysisInstrumentRangeSummary = useMemo(() => {
    const closes = analysisInstrumentBars
      .map((bar) => bar.close)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const highs = analysisInstrumentBars
      .map((bar) => bar.high)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const lows = analysisInstrumentBars
      .map((bar) => bar.low)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const volumes = analysisInstrumentBars
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
    const startDate = analysisInstrumentBars[0]?.date ?? null;
    const endDate = analysisInstrumentBars[analysisInstrumentBars.length - 1]?.date ?? null;
    return { rangeHigh, rangeLow, avgVolume, rangeReturn, startDate, endDate };
  }, [analysisInstrumentBars]);

  const analysisInstrumentPositionValuation = useMemo(() => {
    if (!snapshot || !analysisInstrumentSymbol) return null;
    return (
      snapshot.positions.find((pos) => pos.position.symbol === analysisInstrumentSymbol) ??
      null
    );
  }, [analysisInstrumentSymbol, snapshot]);

  const analysisInstrumentHoldingUnitCost = useMemo(() => {
    if (!analysisInstrumentSymbol) return null;
    const position = analysisInstrumentPositionValuation?.position ?? null;
    if (!position || position.quantity <= 0) return null;

    const direct = position.cost;
    if (direct !== null && Number.isFinite(direct) && direct > 0) return direct;

    const fifo = computeFifoUnitCost(ledgerEntries, analysisInstrumentSymbol);
    if (fifo !== null && Number.isFinite(fifo) && fifo > 0) return fifo;
    return null;
  }, [analysisInstrumentPositionValuation, analysisInstrumentSymbol, ledgerEntries]);

  const analysisInstrumentTargetPrice = useMemo(() => {
    return parseTargetPriceFromTags(analysisInstrumentUserTags);
  }, [analysisInstrumentUserTags]);

  const analysisInstrumentTone = useMemo(() => {
    return getCnChangeTone(
      analysisInstrumentQuote?.changePct ?? analysisInstrumentRangeSummary.rangeReturn
    );
  }, [analysisInstrumentQuote?.changePct, analysisInstrumentRangeSummary.rangeReturn]);

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

  const loadAnalysisInstrument = useCallback(
    async (symbol: string) => {
      if (!window.mytrader) {
        setAnalysisInstrumentError("未检测到桌面端后端接口。");
        return;
      }
      const key = symbol.trim();
      if (!key) return;

      const requestId = analysisInstrumentLoadRequestIdRef.current + 1;
      analysisInstrumentLoadRequestIdRef.current = requestId;

      setAnalysisInstrumentLoading(true);
      setAnalysisInstrumentError(null);

      try {
        const [profile, tags, quotes] = await Promise.all([
          window.mytrader.market.getInstrumentProfile(key),
          window.mytrader.market.listInstrumentTags(key),
          window.mytrader.market.getQuotes({ symbols: [key] })
        ]);
        if (analysisInstrumentLoadRequestIdRef.current !== requestId) return;

        const quote = quotes[0] ?? null;
        setAnalysisInstrumentProfile(profile);
        setAnalysisInstrumentUserTags(tags);
        setAnalysisInstrumentQuote(quote);

        const endDate =
          quote?.tradeDate ?? snapshot?.priceAsOf ?? formatInputDate(new Date());
        const { startDate, endDate: resolvedEndDate } = resolveMarketChartDateRange(
          analysisInstrumentRange,
          endDate
        );
        const bars = await window.mytrader.market.getDailyBars({
          symbol: key,
          startDate,
          endDate: resolvedEndDate,
          includeMoneyflow: false
        });
        if (analysisInstrumentLoadRequestIdRef.current !== requestId) return;
        setAnalysisInstrumentBars(bars);
      } catch (err) {
        if (analysisInstrumentLoadRequestIdRef.current !== requestId) return;
        setAnalysisInstrumentError(toUserErrorMessage(err));
        setAnalysisInstrumentProfile(null);
        setAnalysisInstrumentUserTags([]);
        setAnalysisInstrumentQuote(null);
        setAnalysisInstrumentBars([]);
      } finally {
        if (analysisInstrumentLoadRequestIdRef.current !== requestId) return;
        setAnalysisInstrumentLoading(false);
      }
    },
    [analysisInstrumentRange, snapshot?.priceAsOf]
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

    const shouldLoadPerformance =
      (activeView === "data-analysis" && analysisTab === "portfolio") ||
      (activeView === "portfolio" &&
        (portfolioTab === "performance" || portfolioTab === "risk"));
    if (!shouldLoadPerformance) return;

    loadPerformance(activePortfolioId, performanceRange).catch((err) =>
      setPerformanceError(toUserErrorMessage(err))
    );
  }, [
    activePortfolioId,
    activeView,
    analysisTab,
    loadPerformance,
    performanceRange,
    portfolioTab
  ]);

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
    if (activeView !== "data-analysis" || analysisTab !== "instrument") return;
    if (!window.mytrader) return;
    const query = analysisInstrumentQuery.trim();
    if (!query) {
      setAnalysisInstrumentSearchResults([]);
      setAnalysisInstrumentSearchLoading(false);
      return;
    }

    setAnalysisInstrumentSearchLoading(true);
    const requestId = analysisInstrumentSearchRequestIdRef.current + 1;
    analysisInstrumentSearchRequestIdRef.current = requestId;

    if (analysisInstrumentSearchTimerRef.current !== null) {
      window.clearTimeout(analysisInstrumentSearchTimerRef.current);
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const results = await window.mytrader!.market.searchInstruments({
            query,
            limit: 50
          });
          if (analysisInstrumentSearchRequestIdRef.current !== requestId) return;
          setAnalysisInstrumentSearchResults(results);
        } catch (err) {
          if (analysisInstrumentSearchRequestIdRef.current !== requestId) return;
          setAnalysisInstrumentError(toUserErrorMessage(err));
          setAnalysisInstrumentSearchResults([]);
        } finally {
          if (analysisInstrumentSearchRequestIdRef.current !== requestId) return;
          setAnalysisInstrumentSearchLoading(false);
        }
      })();
    }, 250);

    analysisInstrumentSearchTimerRef.current = timer;
    return () => window.clearTimeout(timer);
  }, [activeView, analysisTab, analysisInstrumentQuery]);

  useEffect(() => {
    if (activeView !== "data-analysis" || analysisTab !== "instrument") return;
    if (!analysisInstrumentSymbol) return;
    void loadAnalysisInstrument(analysisInstrumentSymbol);
  }, [activeView, analysisTab, analysisInstrumentSymbol, loadAnalysisInstrument]);

  useEffect(() => {
    if (activeView !== "data-analysis" || analysisTab !== "instrument") return;
    if (analysisInstrumentSymbol) return;
    if (analysisInstrumentQuickSymbols.length === 0) return;
    setAnalysisInstrumentSymbol(analysisInstrumentQuickSymbols[0]);
  }, [
    activeView,
    analysisTab,
    analysisInstrumentQuickSymbols,
    analysisInstrumentSymbol
  ]);

  useEffect(() => {
    if (activeView === "market") return;
    setMarketInstrumentDetailsOpen(false);
    setMarketTagMembersModalOpen(false);
  }, [activeView]);

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
    if (typeof window === "undefined") return;
    const handleMove = (event: PointerEvent) => {
      const state = targetsEditorResizeRef.current;
      if (!state) return;
      if (state.startWidth <= 0) return;
      const delta = event.clientX - state.startX;
      const deltaPct = (delta / state.startWidth) * 100;
      const next = clampNumber(
        state.startPct + deltaPct,
        TARGETS_EDITOR_SPLIT_MIN,
        TARGETS_EDITOR_SPLIT_MAX
      );
      setTargetsEditorLeftPct(next);
    };

    const stop = () => {
      if (!targetsEditorResizeRef.current) return;
      targetsEditorResizeRef.current = null;
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
      const normalizedConfig: MarketTargetsConfig = {
        ...config,
        includeRegistryAutoIngest: false,
        tagFilters: []
      };
      setMarketTargetsSavedConfig(normalizedConfig);
      setMarketTargetsConfig(normalizedConfig);
      const diff = await window.mytrader.market.previewTargetsDraft({
        config: normalizedConfig
      });
      setMarketTargetsDiffPreview(diff);
      setMarketTargetsPreview(diff.draft);
      setMarketTempTargetsLoading(true);
      const temp = await window.mytrader.market.listTempTargets();
      setMarketTempTargets(temp);
      setMarketManualSymbolPreview({
        addable: [],
        existing: [],
        invalid: [],
        duplicates: 0
      });
    } catch (err) {
      setError(toUserErrorMessage(err));
    } finally {
      setMarketTempTargetsLoading(false);
      setMarketTargetsLoading(false);
    }
  }, []);

  const refreshMarketTargetPoolStats = useDashboardMarketTargetPoolStats({
    marketFocusTargetSymbols,
    marketUniversePoolEnabledBuckets: marketUniversePoolConfig?.enabledBuckets,
    universePoolBucketOrder: UNIVERSE_POOL_BUCKET_ORDER,
    toUserErrorMessage,
    setMarketTargetPoolStatsByScope
  });

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

  const {
    refreshMarketTokenStatus,
    refreshMarketIngestRuns,
    refreshMarketIngestControl,
    refreshMarketSchedulerConfig,
    refreshMarketUniversePool,
    refreshMarketUniversePoolOverview,
    refreshMarketRegistry,
    refreshMarketIngestRunDetail
  } = useDashboardMarketAdminRefresh({
    marketRegistryQuery,
    marketRegistryAutoFilter,
    toUserErrorMessage,
    setError,
    setMarketTokenStatus,
    setMarketIngestRuns,
    setMarketIngestRunsLoading,
    setMarketIngestControlStatus,
    setMarketSchedulerConfig,
    setMarketSchedulerSavedConfig,
    setMarketSchedulerLoading,
    setMarketUniversePoolConfig,
    setMarketUniversePoolSavedConfig,
    setMarketUniversePoolOverview,
    setMarketUniversePoolLoading,
    setMarketRegistryResult,
    setMarketRegistryLoading,
    setMarketRegistrySelectedSymbols,
    setMarketSelectedIngestRunId,
    setMarketSelectedIngestRun,
    setMarketSelectedIngestRunLoading
  });

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

  const handleToggleUniversePoolBucket = useCallback((bucket: UniversePoolBucketId) => {
    setMarketUniversePoolConfig((prev) => {
      const current = prev ?? { enabledBuckets: [...UNIVERSE_POOL_BUCKET_ORDER] };
      const enabled = new Set(current.enabledBuckets);
      if (enabled.has(bucket)) {
        if (enabled.size === 1) return current;
        enabled.delete(bucket);
      } else {
        enabled.add(bucket);
      }
      const nextBuckets = UNIVERSE_POOL_BUCKET_ORDER.filter((item) => enabled.has(item));
      return { enabledBuckets: nextBuckets };
    });
  }, []);

  const handleSaveUniversePoolConfig = useCallback(async () => {
    if (!window.mytrader) return;
    if (!marketUniversePoolConfig) return;
    const buckets = marketUniversePoolConfig.enabledBuckets;
    if (buckets.length === 0) {
      setError("全量池配置至少保留一个分类。");
      return;
    }
    setError(null);
    setNotice(null);
    setMarketUniversePoolSaving(true);
    try {
      const saved = await window.mytrader.market.setUniversePoolConfig({
        enabledBuckets: buckets
      });
      setMarketUniversePoolConfig(saved);
      setMarketUniversePoolSavedConfig(saved);
      const overview = await window.mytrader.market.getUniversePoolOverview();
      setMarketUniversePoolOverview(overview);
      setNotice("全量池配置已保存。");
      await refreshMarketTargetPoolStats();
    } catch (err) {
      setError(toUserErrorMessage(err));
    } finally {
      setMarketUniversePoolSaving(false);
    }
  }, [marketUniversePoolConfig, refreshMarketTargetPoolStats]);

  const handleTriggerMarketIngest = useCallback(
    async (scope: "targets" | "universe" | "both") => {
      if (!window.mytrader) return;
      setError(null);
      setNotice(null);
      setMarketIngestTriggering(true);
      try {
        await window.mytrader.market.triggerIngest({ scope });
        setNotice("拉取任务已加入队列。");
        await Promise.all([
          refreshMarketIngestRuns(),
          refreshMarketIngestControl()
        ]);
      } catch (err) {
        setError(toUserErrorMessage(err));
        await Promise.all([
          refreshMarketIngestRuns(),
          refreshMarketIngestControl()
        ]);
      } finally {
        setMarketIngestTriggering(false);
      }
    },
    [refreshMarketIngestControl, refreshMarketIngestRuns]
  );

  const setMarketScopeToTags = useCallback(() => {
    setMarketScope("tags");
  }, [setMarketScope]);

  const {
    handleSyncInstrumentCatalog,
    handleSelectInstrument,
    handleSelectTag,
    handleSeedMarketDemoData,
    handleAddUserTag,
    handleRemoveUserTag,
    handleAddManualTheme,
    handleAddSelectedToWatchlist,
    handleRemoveWatchlistItem
  } = useDashboardMarketInstrumentActions({
    activePortfolioId,
    marketSelectedSymbol,
    marketUserTagDraft,
    marketManualThemeDraft,
    marketManualThemeOptions,
    marketSelectedUserTags,
    marketSelectedProfile,
    marketWatchlistGroupDraft,
    toUserErrorMessage,
    loadSnapshot,
    loadMarketQuotes,
    refreshMarketTargets,
    refreshMarketWatchlist,
    refreshMarketTags,
    setMarketScopeToTags,
    setError,
    setNotice,
    setMarketCatalogSyncing,
    setMarketCatalogSyncSummary,
    setMarketInstrumentDetailsOpen,
    setMarketTagMembersModalOpen,
    setMarketSelectedSymbol,
    setMarketSelectedProfile,
    setMarketSelectedUserTags,
    setMarketShowProviderData,
    setMarketChartHoverDate,
    setMarketChartHoverPrice,
    setMarketChartLoading,
    setMarketTempTargets,
    setMarketTargetsPreview,
    setMarketSelectedTag,
    setMarketTagMembers,
    setMarketChartBars,
    setMarketTagMembersLoading,
    setMarketDemoSeeding,
    setMarketUserTagDraft
  });

  const handleAddTargetTag = useCallback(
    (raw?: string) => {
      const tag = (raw ?? marketTargetsTagDraft).trim();
      if (!tag) return;
      if (!tag.includes(":")) {
        setError("标签必须包含命名空间，例如 industry:白酒。");
        return;
      }
      setMarketTargetsConfig((prev) => {
        if (prev.tagFilters.includes(tag)) return prev;
        return { ...prev, tagFilters: [...prev.tagFilters, tag] };
      });
      setError(null);
      if (raw === undefined) setMarketTargetsTagDraft("");
    },
    [marketTargetsTagDraft]
  );

  const refreshMarketTargetsDiff = useCallback(async () => {
    if (!window.mytrader) return;
    try {
      const diff = await window.mytrader.market.previewTargetsDraft({
        config: marketTargetsConfig
      });
      setMarketTargetsDiffPreview(diff);
      setMarketTargetsPreview(diff.draft);
    } catch (err) {
      setError(toUserErrorMessage(err));
    }
  }, [marketTargetsConfig]);

  const {
    handlePreviewManualTargetSymbols,
    handleApplyManualTargetSymbols,
    handleRemoveManualPreviewSymbol,
    handleRemoveTempTarget,
    handlePromoteTempTarget,
    handleSaveTargets,
    handleResetTargetsDraft,
    handleToggleTempTargetSelection,
    handleSelectAllTempTargets,
    handleBatchPromoteTempTargets,
    handleBatchRemoveTempTargets,
    handleBatchExtendTempTargets
  } = useDashboardMarketTargetActions({
    marketTargetsConfig,
    marketTargetsSavedConfig,
    marketTargetsSymbolDraft,
    marketManualSymbolPreview,
    marketSelectedTempTargetSymbols,
    marketTempTargets,
    toUserErrorMessage,
    refreshMarketTargets,
    refreshMarketTargetsDiff,
    setError,
    setNotice,
    setMarketTargetsConfig,
    setMarketTargetsSavedConfig,
    setMarketTargetsSymbolDraft,
    setMarketManualSymbolPreview,
    setMarketTargetsDiffPreview,
    setMarketTargetsPreview,
    setMarketTargetsSaving,
    setMarketTempTargets,
    setMarketTempTargetsLoading,
    setMarketSelectedTempTargetSymbols
  });

  const {
    handlePauseMarketIngest,
    handleResumeMarketIngest,
    handleCancelMarketIngest,
    updateMarketSchedulerConfig,
    handleSaveMarketSchedulerConfig,
    handleRunMarketIngestNow,
    handleToggleRegistrySymbol,
    handleToggleSelectAllRegistry,
    handleSetRegistryAutoIngest,
    handleBatchSetRegistryAutoIngest
  } = useDashboardMarketManagementActions({
    marketSchedulerConfig,
    marketIngestControlState,
    marketIngestTriggering,
    marketRegistryResult,
    marketRegistrySelectedSymbols,
    toUserErrorMessage,
    handleTriggerMarketIngest,
    refreshMarketIngestRuns,
    refreshMarketRegistry,
    refreshMarketTargetsDiff,
    setError,
    setNotice,
    setMarketIngestControlStatus,
    setMarketIngestControlUpdating,
    setMarketSchedulerConfig,
    setMarketSchedulerSavedConfig,
    setMarketSchedulerSaving,
    setMarketTriggerIngestBlockedOpen,
    setMarketTriggerIngestBlockedMessage,
    setMarketRegistrySelectedSymbols,
    setMarketRegistryUpdating
  });

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

  const handleTargetsEditorResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const width = targetsEditorGridRef.current?.getBoundingClientRect().width ?? 0;
      if (width <= 0) return;
      event.preventDefault();
      targetsEditorResizeRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startWidth: width,
        startPct: targetsEditorLeftPct
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      document.body.style.userSelect = "none";
    },
    [targetsEditorLeftPct]
  );

  const handleTargetsEditorResizeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? 6 : 3;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setTargetsEditorLeftPct((prev) =>
          clampNumber(prev - step, TARGETS_EDITOR_SPLIT_MIN, TARGETS_EDITOR_SPLIT_MAX)
        );
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setTargetsEditorLeftPct((prev) =>
          clampNumber(prev + step, TARGETS_EDITOR_SPLIT_MIN, TARGETS_EDITOR_SPLIT_MAX)
        );
      }
    },
    []
  );

  const restoreDataManagementView = useCallback(() => {
    setActiveView("other");
    setOtherTab("data-management");
  }, []);

  useDashboardMarketRuntimeEffects({
    activeView,
    otherTab,
    analysisInstrumentViewActive:
      activeView === "data-analysis" && analysisTab === "instrument",
    marketEffectiveScope,
    holdingsScopeValue: "holdings",
    searchScopeValue: "search",
    tagsScopeValue: "tags",
    holdingsSymbols: marketHoldingsSymbolsFiltered,
    searchSymbols: marketSearchResultSymbols,
    loadMarketQuotes,
    marketSelectedSymbol,
    marketSelectedTag,
    marketSearchQuery,
    marketTagManagementQuery,
    marketWatchlistCount: marketWatchlistItems.length,
    marketInstrumentDetailsOpen,
    marketIngestRuns,
    marketSelectedIngestRunId,
    marketRegistryEntryEnabled,
    marketRegistryAutoFilter,
    marketRegistryQuery,
    marketTargetsConfig,
    marketFocusTargetSymbols,
    marketTargetsDirty,
    restoreDataManagementView,
    setMarketSelectedIngestRunId,
    setMarketSelectedIngestRun,
    setMarketScope,
    selectDefaultTag: handleSelectTag,
    refreshMarketTokenStatus,
    refreshMarketTargets,
    refreshMarketIngestRuns,
    refreshMarketIngestControl,
    refreshMarketSchedulerConfig,
    refreshMarketUniversePool,
    refreshMarketRegistry,
    refreshMarketTargetsDiff,
    refreshMarketTargetPoolStats,
    refreshMarketUniversePoolOverview,
    refreshMarketWatchlist,
    refreshMarketTags,
    refreshManualThemeOptions,
    refreshMarketIngestRunDetail
  });

  return (
    <div className="flex h-full bg-white/90 dark:bg-background-dark/80 backdrop-blur-xl overflow-hidden">
      <SidebarNav
        activeView={activeView}
        isNavCollapsed={isNavCollapsed}
        items={navItems}
        onSelectView={(view) => setActiveView(view as WorkspaceView)}
        onToggleCollapse={() => setIsNavCollapsed((prev) => !prev)}
      />

      {/* Main Content */}
      <section className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-white/85 dark:bg-background-dark/70 backdrop-blur-lg">
        <TopToolbar
          activeView={activeView}
          otherTab={otherTab}
          navItems={navItems}
          marketPriceAsOf={snapshot?.priceAsOf ?? null}
          onLock={onLock}
        />

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
            <AccountView account={account} formatDateTime={formatDateTime} />
          )}

          {/* View: Portfolio */}
          {activeView === "portfolio" && (
            <PortfolioView
              {...{
                Badge,
                Button,
                DataQualityCard,
                DescriptionItem,
                EmptyState,
                ErrorState,
                FormGroup,
                HHI_WARN_THRESHOLD,
                IconButton,
                Input,
                LedgerForm,
                LedgerTable,
                Panel,
                PerformanceChart,
                PlaceholderPanel,
                RiskMetricCard,
                Select,
                SummaryCard,
                activePortfolio,
                activePortfolioId,
                assetClassLabels,
                cashFlowTotals,
                cashTotal,
                dataQuality,
                filteredLedgerEntries,
                formatAssetClassLabel,
                formatCurrency,
                formatDateRange,
                formatNumber,
                formatPct,
                formatPctNullable,
                formatPerformanceMethod,
                handleCancelEditPosition,
                handleCancelLedgerEdit,
                handleCreatePortfolio,
                handleDeletePortfolio,
                handleDeletePosition,
                handleEditLedgerEntry,
                handleEditPosition,
                handleOpenLedgerForm,
                handleRenamePortfolio,
                handleRequestDeleteLedgerEntry,
                handleSubmitLedgerEntry,
                handleSubmitPosition,
                hhiValue,
                isLedgerFormOpen,
                isLoading,
                ledgerEndDate,
                ledgerEntries,
                ledgerError,
                ledgerEventTypeOptions,
                ledgerFilter,
                ledgerForm,
                ledgerLoading,
                ledgerStartDate,
                loadLedgerEntries,
                loadPerformance,
                performanceError,
                performanceLoading,
                performance,
                performanceRange,
                performanceRanges,
                performanceResult,
                performanceSeries,
                portfolioBaseCurrency,
                portfolioName,
                portfolioRename,
                portfolioTab,
                portfolioTabs,
                portfolios,
                positionForm,
                riskAnnualized,
                riskMetrics,
                selectedPerformance,
                setActivePortfolioId,
                setActiveView,
                setAnalysisTab,
                setLedgerEndDate,
                setLedgerError,
                setLedgerFilter,
                setLedgerStartDate,
                setOtherTab,
                setPerformanceError,
                setPerformanceRange,
                setPortfolioBaseCurrency,
                setPortfolioName,
                setPortfolioRename,
                setPositionForm,
                setRiskAnnualized,
                snapshot,
                toUserErrorMessage,
                updateLedgerForm,
              }}
            />
          )}

          {/* View: Risk */}
          {activeView === "risk" && (
            <RiskView
              snapshot={snapshot}
              formatAssetClassLabel={formatAssetClassLabel}
              formatPct={formatPct}
              formatCurrency={formatCurrency}
              formatRiskLimitTypeLabel={formatRiskLimitTypeLabel}
              handleEditRiskLimit={handleEditRiskLimit}
              handleDeleteRiskLimit={handleDeleteRiskLimit}
              riskForm={riskForm}
              setRiskForm={setRiskForm}
              riskLimitTypeLabels={riskLimitTypeLabels}
              handleSubmitRiskLimit={handleSubmitRiskLimit}
              handleCancelRiskEdit={handleCancelRiskEdit}
            />
          )}

          {/* View: Data Analysis */}
          {activeView === "data-analysis" && (
            <DataAnalysisView
              {...{
                Badge,
                CONTRIBUTION_TOP_N,
                ChartErrorBoundary,
                ContributionTable,
                EmptyState,
                ErrorState,
                Input,
                MarketAreaChart,
                Panel,
                PerformanceChart,
                PlaceholderPanel,
                RiskMetricCard,
                SummaryCard,
                activePortfolio,
                activePortfolioId,
                analysisInstrumentBars,
                analysisInstrumentError,
                analysisInstrumentHasEnoughData,
                analysisInstrumentHoldingUnitCost,
                analysisInstrumentLatestBar,
                analysisInstrumentLoading,
                analysisInstrumentNameBySymbol,
                analysisInstrumentPositionValuation,
                analysisInstrumentProfile,
                analysisInstrumentQuery,
                analysisInstrumentQuickSymbols,
                analysisInstrumentQuote,
                analysisInstrumentRange,
                analysisInstrumentRangeSummary,
                analysisInstrumentSearchLoading,
                analysisInstrumentSearchResults,
                analysisInstrumentSymbol,
                analysisInstrumentTargetPrice,
                analysisInstrumentTone,
                analysisInstrumentUserTags,
                analysisTab,
                analysisTabs,
                contributionBreakdown,
                formatCnWanYiNullable,
                formatDateRange,
                formatNumber,
                formatPctNullable,
                formatPerformanceMethod,
                formatSignedPctNullable,
                loadAnalysisInstrument,
                loadPerformance,
                marketChartRanges,
                performanceError,
                performanceLoading,
                performance,
                performanceRange,
                performanceRanges,
                performanceResult,
                performanceSeries,
                riskAnnualized,
                riskMetrics,
                selectedPerformance,
                setAnalysisInstrumentQuery,
                setAnalysisInstrumentRange,
                setAnalysisInstrumentSymbol,
                setAnalysisTab,
                setPerformanceError,
                setPerformanceRange,
                setRiskAnnualized,
                setShowAllAssetContribution,
                setShowAllSymbolContribution,
                showAllAssetContribution,
                showAllSymbolContribution,
                toUserErrorMessage
              }}
            />
          )}

          {/* View: Market */}
          {activeView === "market" && (
            <MarketView
              {...{
                Button,
                ChartErrorBoundary,
                FormGroup,
                IconButton,
                Input,
                MarketAreaChart,
                MarketQuoteHeader,
                MarketVolumeMiniChart,
                Modal,
                PopoverSelect,
                formatCnDate,
                formatCnWanYiNullable,
                formatNumber,
                formatSignedCnWanYiNullable,
                formatSignedPctNullable,
                formatThemeLabel,
                getCnChangeTone,
                getCnToneTextClass,
                handleAddManualTheme,
                handleAddSelectedToWatchlist,
                handleAddTargetTag,
                handleAddUserTag,
                handleMarketExplorerResizeKeyDown,
                handleMarketExplorerResizePointerDown,
                handleRemoveUserTag,
                handleRemoveWatchlistItem,
                handleSelectInstrument,
                handleSelectTag,
                handleSyncInstrumentCatalog,
                marketActiveMoneyflowRatio,
                marketActiveMoneyflowVol,
                marketActiveVolume,
                marketCatalogSyncSummary,
                marketCatalogSyncing,
                marketChartBars,
                marketChartHasEnoughData,
                marketChartHoverDate,
                marketChartHoverPrice,
                marketChartLoading,
                marketChartRange,
                marketChartRanges,
                marketCollectionSelectValue,
                marketEffectiveScope,
                marketExplorerWidth,
                marketFilterAssetClasses,
                marketFilterKinds,
                marketFilterMarket,
                marketFilteredListSymbols,
                marketFiltersActiveCount,
                marketFiltersOpen,
                marketHoldingUnitCost,
                marketHoldingsSymbols,
                marketHoldingsSymbolsFiltered,
                marketInstrumentDetailsOpen,
                marketLatestBar,
                marketManualThemeDraft,
                marketManualThemeLoading,
                marketManualThemeOptions,
                marketNameBySymbol,
                marketQuotesBySymbol,
                marketQuotesLoading,
                marketRangeSummary,
                marketSearchLoading,
                marketSearchQuery,
                marketSearchResults,
                marketSearchResultsFiltered,
                marketSelectedIndustry,
                marketSelectedManualThemes,
                marketSelectedPlainUserTags,
                marketSelectedProfile,
                marketSelectedQuote,
                marketSelectedSymbol,
                marketSelectedTag,
                marketSelectedTagAggregate,
                marketSelectedTagSeriesReturnPct,
                marketSelectedTagSeriesTone,
                marketSelectedThemes,
                marketShowProviderData,
                marketTagChartHoverDate,
                marketTagChartHoverPrice,
                marketTagMembers,
                marketTagMembersLoading,
                marketTagMembersModalOpen,
                marketTagPickerOpen,
                marketTagPickerQuery,
                marketTagSeriesBars,
                marketTagSeriesError,
                marketTagSeriesLatestCoverageLabel,
                marketTagSeriesLoading,
                marketTagSeriesResult,
                marketTags,
                marketTagsLoading,
                marketTargetPrice,
                marketUserTagDraft,
                marketVolumeMode,
                marketWatchlistGroupDraft,
                marketWatchlistLoading,
                refreshMarketTags,
                resetMarketFilters,
                setMarketChartHoverDate,
                setMarketChartHoverPrice,
                setMarketChartRange,
                setMarketFilterAssetClasses,
                setMarketFilterKinds,
                setMarketFilterMarket,
                setMarketFiltersOpen,
                setMarketInstrumentDetailsOpen,
                setMarketManualThemeDraft,
                setMarketScope,
                setMarketSearchQuery,
                setMarketSelectedSymbol,
                setMarketSelectedTag,
                setMarketShowProviderData,
                setMarketTagChartHoverDate,
                setMarketTagChartHoverPrice,
                setMarketTagMembersModalOpen,
                setMarketTagPickerOpen,
                setMarketTagPickerQuery,
                setMarketUserTagDraft,
                setMarketVolumeMode,
                setMarketWatchlistGroupDraft,
                snapshot,
                sortTagMembersByChangePct,
              }}
            />
          )}

          {/* View: Other */}
          {activeView === "other" && (
            <OtherView
              {...{
                Button,
                FormGroup,
                HelpHint,
                Input,
                Modal,
                Panel,
                PopoverSelect,
                UNIVERSE_POOL_BUCKET_ORDER,
                activePortfolio,
                dataQuality,
                formatCnDate,
                formatDateTime,
                formatDurationMs,
                formatIngestControlStateLabel,
                formatIngestRunModeLabel,
                formatIngestRunScopeLabel,
                formatIngestRunStatusLabel,
                formatIngestRunTone,
                formatMarketTokenSource,
                formatPctNullable,
                formatTagSourceLabel,
                formatTargetsReasons,
                getIngestControlStateDotClass,
                getUniversePoolBucketLabel,
                handleApplyManualTargetSymbols,
                handleBatchExtendTempTargets,
                handleBatchPromoteTempTargets,
                handleBatchRemoveTempTargets,
                handleBatchSetRegistryAutoIngest,
                handleCancelMarketIngest,
                handleChooseCsv,
                handleClearMarketToken,
                handleImportHoldings,
                handleImportPrices,
                handleOpenMarketProvider,
                handlePauseMarketIngest,
                handlePreviewManualTargetSymbols,
                handlePromoteTempTarget,
                handleRemoveManualPreviewSymbol,
                handleRemoveTempTarget,
                handleResetTargetsDraft,
                handleResumeMarketIngest,
                handleRunMarketIngestNow,
                handleSaveMarketSchedulerConfig,
                handleSaveMarketToken,
                handleSaveTargets,
                handleSaveUniversePoolConfig,
                handleSeedMarketDemoData,
                handleSelectAllTempTargets,
                handleSetRegistryAutoIngest,
                handleTargetsEditorResizeKeyDown,
                handleTargetsEditorResizePointerDown,
                handleTestMarketToken,
                handleToggleDiffSection,
                handleToggleRegistrySymbol,
                handleToggleSelectAllRegistry,
                handleToggleTargetsSection,
                handleToggleTempTargetSelection,
                handleToggleUniversePoolBucket,
                handleTriggerMarketIngest,
                holdingsCsvPath,
                latestMarketIngestRun,
                marketActiveTargetPoolStats,
                marketCanCancelIngest,
                marketCanPauseIngest,
                marketCanResumeIngest,
                marketCanTriggerIngestNow,
                marketDemoSeeding,
                marketDiffSectionOpen,
                marketFilteredAddedSymbols,
                marketFilteredReasonChangedSymbols,
                marketFilteredRemovedSymbols,
                marketIngestControlStatus,
                marketIngestRuns,
                marketIngestRunsLoading,
                marketIngestTriggering,
                marketManualSymbolPreview,
                marketRegistryAutoFilter,
                marketRegistryEntryEnabled,
                marketRegistryLoading,
                marketRegistryQuery,
                marketRegistryResult,
                marketRegistrySelectedSymbols,
                marketRegistryUpdating,
                marketSchedulerAdvancedOpen,
                marketSchedulerConfig,
                marketSchedulerDirty,
                marketSchedulerLoading,
                marketSchedulerSaving,
                marketSchedulerTimezoneOptions,
                marketSelectedIngestRun,
                marketSelectedIngestRunId,
                marketSelectedIngestRunLoading,
                marketSelectedTempTargetSymbols,
                marketTagManagementQuery,
                marketTags,
                marketTagsLoading,
                marketTargetPoolMetricCards,
                marketTargetPoolStatsScope,
                marketTargetsConfig,
                marketTargetsDiffPreview,
                marketTargetsDirty,
                marketTargetsLoading,
                marketTargetsPreview,
                marketTargetsSaving,
                marketTargetsSectionOpen,
                marketTargetsSymbolDraft,
                marketTempTargets,
                marketTempTargetsLoading,
                marketTokenDraft,
                marketTokenProvider,
                marketTokenSaving,
                marketTokenStatus,
                marketTokenTesting,
                marketTriggerIngestBlockedMessage,
                marketTriggerIngestBlockedOpen,
                marketUniverseBucketStatusById,
                marketUniverseEnabledBuckets,
                marketUniversePoolConfig,
                marketUniversePoolDirty,
                marketUniversePoolLoading,
                marketUniversePoolSaving,
                otherTab,
                otherTabs,
                pricesCsvPath,
                refreshMarketIngestRunDetail,
                refreshMarketIngestRuns,
                refreshMarketRegistry,
                refreshMarketTags,
                refreshMarketTargets,
                refreshMarketTargetsDiff,
                setActiveView,
                setMarketCurrentTargetsModalOpen,
                setMarketManualSymbolPreview,
                setMarketRegistryAutoFilter,
                setMarketRegistryQuery,
                setMarketSchedulerAdvancedOpen,
                setMarketTagManagementQuery,
                setMarketTargetPoolDetailMetric,
                setMarketTargetPoolStatsScope,
                setMarketTargetsConfig,
                setMarketTargetsSymbolDraft,
                setMarketTokenDraft,
                setMarketTokenProvider,
                setMarketTriggerIngestBlockedOpen,
                setOtherTab,
                snapshot,
                targetsEditorGridRef,
                targetsEditorLeftPct,
                updateMarketSchedulerConfig,
              }}
            />
          )}

          {/* Placeholders */}
          {["opportunities", "backtest", "insights", "alerts", "index-tracking"].includes(activeView) && (
            <PlaceholderPanel 
              title={navItems.find(n => n.key === activeView)?.label ?? ""}
              description={navItems.find(n => n.key === activeView)?.description ?? ""}
            />
          )}

        </div>

        <DashboardOverlays
          {...{
            Button,
            ConfirmDialog,
            Input,
            error,
            formatPct,
            formatTargetsReasons,
            handleCancelDeleteLedgerEntry,
            handleConfirmDeleteLedgerEntry,
            ledgerDeleteSummary,
            ledgerDeleteTarget,
            marketActiveTargetPoolStats,
            marketCurrentTargetsFilter,
            marketCurrentTargetsModalOpen,
            marketCurrentTargetsSource,
            marketFilteredCurrentTargets,
            marketTargetPoolActiveCategoryRow,
            marketTargetPoolDetailCategoryRows,
            marketTargetPoolDetailDescription,
            marketTargetPoolDetailMemberFilter,
            marketTargetPoolDetailMembers,
            marketTargetPoolDetailMetric,
            marketTargetPoolDetailTitle,
            marketTargetPoolDetailValue,
            notice,
            setError,
            setMarketCurrentTargetsFilter,
            setMarketCurrentTargetsModalOpen,
            setMarketTargetPoolDetailCategoryKey,
            setMarketTargetPoolDetailMemberFilter,
            setMarketTargetPoolDetailMetric,
            setNotice,
            toastMessage,
          }}
        />

      </section>
    </div>
  );
}
