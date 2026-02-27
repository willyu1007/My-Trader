import type {
  AssetClass,
  AccountSummary,
  CorporateActionKind,
  InstrumentKind,
  InstrumentProfile,
  InstrumentProfileSummary,
  LedgerEntry,
  LedgerEventType,
  LedgerSide,
  LedgerSource,
  MarketDailyBar,
  MarketUniversePoolBucketStatus,
  MarketQuote,
  Portfolio,
  PortfolioPerformanceRangeResult,
  PortfolioSnapshot,
  RiskLimitType,
  TagSummary,
  WatchlistItem
} from "@mytrader/shared";

export interface DashboardProps {
  account: AccountSummary;
  onOpenSettings?: () => void;
  navCollapsed?: boolean;
  onNavCollapsedChange?: (collapsed: boolean) => void;
  onActiveViewChange?: (view: WorkspaceView) => void;
  onActivePortfolioChange?: (portfolio: {
    id: string | null;
    name: string | null;
  }) => void;
}

export type WorkspaceView =
  | "portfolio"
  | "risk"
  | "market"
  | "index-tracking"
  | "data-analysis"
  | "opportunities"
  | "backtest"
  | "insights"
  | "alerts"
  | "other"
  | "account";

export type PortfolioTab =
  | "overview"
  | "holdings"
  | "trades"
  | "performance"
  | "risk"
  | "allocation"
  | "corporate";

export type OtherTab =
  | "data-management"
  | "instrument-management"
  | "valuation-methods"
  | "data-status"
  | "test";

export type AnalysisTab = "portfolio" | "instrument" | "index" | "sector";
export type InsightsTab = "generate" | "manage";

export interface DashboardUiState {
  activeView: WorkspaceView;
  portfolioTab: PortfolioTab;
  otherTab: OtherTab;
  analysisTab: AnalysisTab;
  insightsTab: InsightsTab;
  isNavCollapsed: boolean;
  error: string | null;
  notice: string | null;
}

export interface PortfolioDomainState {
  portfolios: Portfolio[];
  activePortfolioId: string | null;
  snapshot: PortfolioSnapshot | null;
  performanceResult: PortfolioPerformanceRangeResult | null;
  ledgerEntries: LedgerEntry[];
}

export interface MarketDomainState {
  searchQuery: string;
  searchResults: InstrumentProfileSummary[];
  selectedSymbol: string | null;
  selectedProfile: InstrumentProfile | null;
  selectedQuote: MarketQuote | null;
  chartBars: MarketDailyBar[];
  tags: TagSummary[];
  watchlistItems: WatchlistItem[];
}

export interface AnalysisDomainState {
  instrumentQuery: string;
  instrumentSearchResults: InstrumentProfileSummary[];
  instrumentSymbol: string | null;
  instrumentProfile: InstrumentProfile | null;
  instrumentQuote: MarketQuote | null;
  instrumentBars: MarketDailyBar[];
}

export interface PortfolioViewModel {
  activePortfolio: Portfolio | null;
  snapshot: PortfolioSnapshot | null;
  performanceResult: PortfolioPerformanceRangeResult | null;
  ledgerEntries: LedgerEntry[];
}

export interface MarketViewModel {
  selectedSymbol: string | null;
  selectedProfile: InstrumentProfile | null;
  selectedQuote: MarketQuote | null;
  chartBars: MarketDailyBar[];
  tags: TagSummary[];
  watchlistItems: WatchlistItem[];
}

export interface OtherViewModel {
  activeTab: OtherTab;
}

export interface PositionFormState {
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

export interface RiskFormState {
  id?: string;
  limitType: RiskLimitType;
  target: string;
  thresholdPct: string;
}

export type CorporateActionKindUi = CorporateActionKind | "dividend";

export interface LedgerFormState {
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

export type LedgerFilter = "all" | LedgerEventType;
export type MarketScope = "tags" | "holdings" | "search";
export type MarketCategoryTab =
  | "stock"
  | "etf"
  | "index"
  | "spot"
  | "forex"
  | "futures"
  | "bond"
  | "rate";
export type MarketChartRangeKey =
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
export type MarketFilterMarket = "all" | "CN" | "FX";
export interface MarketCategoryPreset {
  filterMarket: MarketFilterMarket;
  filterAssetClasses: AssetClass[];
  filterKinds: InstrumentKind[];
  defaultScope: MarketScope;
  defaultTag: string | null;
  construction: boolean;
  constructionTitle?: string;
  constructionDescription?: string;
}
export type TargetPoolStatsScope = "universe" | "focus";
export type UniversePoolBucketId = MarketUniversePoolBucketStatus["bucket"];

export interface TargetPoolCategoryDetail {
  key: string;
  label: string;
  symbols: string[];
}

export interface TargetPoolStructureStats {
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
