import type { TagFacets } from "./tagFacets";

export type AccountId = string;
export type PortfolioId = string;
export type PositionId = string;
export type RiskLimitId = string;

export interface AccountSummary {
  id: AccountId;
  label: string;
  dataDir: string;
  createdAt: number;
  lastLoginAt: number | null;
}

export interface CreateAccountInput {
  label: string;
  password: string;
  dataRootDir?: string | null;
}

export interface UnlockAccountInput {
  accountId: AccountId;
  password?: string;
  devBypass?: boolean;
}

export type AssetClass = "stock" | "etf" | "futures" | "spot" | "cash";

export interface Portfolio {
  id: PortfolioId;
  name: string;
  baseCurrency: string;
  createdAt: number;
  updatedAt: number;
}

export interface Position {
  id: PositionId;
  portfolioId: PortfolioId;
  symbol: string;
  name: string | null;
  assetClass: AssetClass;
  market: string;
  currency: string;
  quantity: number;
  cost: number | null;
  openDate: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface PositionValuation {
  position: Position;
  latestPrice: number | null;
  priceDate: string | null;
  marketValue: number | null;
  costValue: number | null;
  pnl: number | null;
  pnlPct: number | null;
}

export interface ExposureEntry {
  key: string;
  label: string;
  weight: number;
  marketValue: number;
}

export type RiskLimitType = "position_weight" | "asset_class_weight";

export interface RiskLimit {
  id: RiskLimitId;
  portfolioId: PortfolioId;
  limitType: RiskLimitType;
  target: string;
  threshold: number;
  createdAt: number;
  updatedAt: number;
}

export interface RiskWarning {
  limitId: RiskLimitId;
  limitType: RiskLimitType;
  target: string;
  threshold: number;
  actual: number;
  message: string;
}

export interface PortfolioSnapshot {
  portfolio: Portfolio;
  positions: PositionValuation[];
  totals: {
    marketValue: number;
    costValue: number;
    pnl: number;
  };
  performance: PortfolioPerformance | null;
  dataQuality: MarketDataQuality | null;
  exposures: {
    byAssetClass: ExposureEntry[];
    bySymbol: ExposureEntry[];
  };
  riskLimits: RiskLimit[];
  riskWarnings: RiskWarning[];
  priceAsOf: string | null;
}

export type DataQualityLevel = "ok" | "partial" | "insufficient";

export interface MarketDataQuality {
  overallLevel: DataQualityLevel;
  coverageLevel: DataQualityLevel;
  freshnessLevel: DataQualityLevel;
  coverageRatio: number | null;
  freshnessDays: number | null;
  asOfDate: string | null;
  missingSymbols: string[];
  notes: string[];
}

export type PerformanceMethod = "twr" | "mwr" | "none";

export interface PerformanceMetric {
  method: "twr" | "mwr";
  totalReturn: number;
  annualizedReturn: number | null;
  startDate: string;
  endDate: string;
}

export interface PortfolioPerformance {
  selectedMethod: PerformanceMethod;
  reason: string | null;
  twr: PerformanceMetric | null;
  mwr: PerformanceMetric | null;
}

export type PerformanceRangeKey = "1M" | "3M" | "6M" | "1Y" | "YTD" | "ALL";

export interface PortfolioPerformanceSeriesPoint {
  date: string;
  value: number;
  returnPct: number;
}

export interface PortfolioPerformanceSeries {
  method: PerformanceMethod;
  points: PortfolioPerformanceSeriesPoint[];
  startDate: string;
  endDate: string;
  reason: string | null;
}

export interface PortfolioPerformanceRangeInput {
  portfolioId: PortfolioId;
  range: PerformanceRangeKey;
}

export interface PortfolioPerformanceRangeResult {
  performance: PortfolioPerformance;
  series: PortfolioPerformanceSeries | null;
  analysis: PortfolioPerformanceAnalysis | null;
}

export interface ContributionEntry {
  key: string;
  label: string;
  weight: number;
  marketValue: number;
  returnPct: number | null;
  contribution: number | null;
  priceStart: number | null;
  priceEnd: number | null;
}

export interface ContributionBreakdown {
  startDate: string;
  endDate: string;
  bySymbol: ContributionEntry[];
  byAssetClass: ContributionEntry[];
  missingSymbols: string[];
  reason: string | null;
}

export interface RiskSeriesMetrics {
  volatility: number | null;
  volatilityAnnualized: number | null;
  maxDrawdown: number | null;
  startDate: string | null;
  endDate: string | null;
  points: number;
  reason: string | null;
}

export interface PortfolioRiskMetrics {
  nav: RiskSeriesMetrics;
  twr: RiskSeriesMetrics;
}

export interface PortfolioPerformanceAnalysis {
  contributions: ContributionBreakdown;
  riskMetrics: PortfolioRiskMetrics;
}

export interface CreatePortfolioInput {
  name: string;
  baseCurrency?: string | null;
}

export interface UpdatePortfolioInput {
  id: PortfolioId;
  name: string;
  baseCurrency?: string | null;
}

export interface CreatePositionInput {
  portfolioId: PortfolioId;
  symbol: string;
  name?: string | null;
  assetClass: AssetClass;
  market: string;
  currency: string;
  quantity: number;
  cost?: number | null;
  openDate?: string | null;
}

export interface UpdatePositionInput extends CreatePositionInput {
  id: PositionId;
}


export interface CreateRiskLimitInput {
  portfolioId: PortfolioId;
  limitType: RiskLimitType;
  target: string;
  threshold: number;
}

export interface UpdateRiskLimitInput extends CreateRiskLimitInput {
  id: RiskLimitId;
}

export type MarketDataSource = "tushare" | "csv";

export type MarketProviderId = "tushare";

export type InstrumentKind =
  | "stock"
  | "fund"
  | "index"
  | "futures"
  | "spot"
  | "forex";

export interface InstrumentProfileSummary {
  provider: MarketProviderId;
  kind: InstrumentKind;
  symbol: string;
  name: string | null;
  assetClass: AssetClass | null;
  market: string | null;
  currency: string | null;
  tags: string[];
  tagFacets?: TagFacets;
}

export interface InstrumentProfile extends InstrumentProfileSummary {
  providerData: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface SearchInstrumentsInput {
  query: string;
  limit?: number | null;
}

export type WatchlistItemId = string;

export interface WatchlistItem {
  id: WatchlistItemId;
  symbol: string;
  name: string | null;
  groupName: string | null;
  note: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface UpsertWatchlistItemInput {
  symbol: string;
  name?: string | null;
  groupName?: string | null;
  note?: string | null;
}

export interface MarketTargetsConfig {
  includeHoldings: boolean;
  includeRegistryAutoIngest: boolean;
  includeWatchlist: boolean;
  portfolioIds: PortfolioId[] | null;
  explicitSymbols: string[];
  tagFilters: string[];
}

export interface ResolvedTargetSymbol {
  symbol: string;
  reasons: string[];
}

export interface PreviewTargetsResult {
  config: MarketTargetsConfig;
  symbols: ResolvedTargetSymbol[];
}

export interface TargetReasonsDiff {
  symbol: string;
  baselineReasons: string[];
  draftReasons: string[];
}

export interface PreviewTargetsDraftInput {
  config: MarketTargetsConfig;
  query?: string | null;
  limit?: number | null;
}

export interface PreviewTargetsDiffResult {
  baseline: PreviewTargetsResult;
  draft: PreviewTargetsResult;
  addedSymbols: ResolvedTargetSymbol[];
  removedSymbols: ResolvedTargetSymbol[];
  reasonChangedSymbols: TargetReasonsDiff[];
}

export type TagSource = "provider" | "user" | "watchlist";

export interface TagSummary {
  tag: string;
  source: TagSource;
  memberCount: number;
}

export interface ListTagsInput {
  query?: string | null;
  limit?: number | null;
}

export interface GetTagMembersInput {
  tag: string;
  limit?: number | null;
}

export interface GetTagSeriesInput {
  tag: string;
  startDate: string;
  endDate: string;
  memberLimit?: number | null;
}

export interface MarketTagSeriesPoint {
  date: string;
  value: number | null;
  includedCount: number;
  totalCount: number;
  weightSum: number | null;
}

export interface MarketTagSeriesResult {
  tag: string;
  startDate: string;
  endDate: string;
  memberCount: number;
  usedMemberCount: number;
  truncated: boolean;
  base: number;
  weight: "prev_circ_mv_fallback_current";
  points: MarketTagSeriesPoint[];
}

export interface MarketQuote {
  symbol: string;
  tradeDate: string | null;
  close: number | null;
  prevTradeDate: string | null;
  prevClose: number | null;
  change: number | null;
  changePct: number | null;
  circMv: number | null;
  circMvDate: string | null;
}

export interface GetQuotesInput {
  symbols: string[];
}

export interface MarketDailyBar {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  netMfVol?: number | null;
  netMfAmount?: number | null;
}

export interface GetDailyBarsInput {
  symbol: string;
  startDate: string;
  endDate: string;
  includeMoneyflow?: boolean;
}

export interface ImportHoldingsCsvInput {
  portfolioId: PortfolioId;
  filePath: string;
}

export interface ImportPricesCsvInput {
  filePath: string;
  source: MarketDataSource;
}

export interface MarketImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  warnings: string[];
}

export interface SeedMarketDemoDataResult {
  symbols: string[];
  tags: string[];
  watchlistGroup: string;
  tradeDateCount: number;
  pricesInserted: number;
  dailyBasicsInserted: number;
  dailyMoneyflowsInserted: number;
  instrumentProfilesInserted: number;
  instrumentProfilesUpdated: number;
  warnings: string[];
}

export interface SeedMarketDemoDataInput {
  portfolioId?: PortfolioId | null;
  seedHoldings?: boolean;
}

export interface TushareIngestItem {
  symbol: string;
  assetClass: AssetClass;
}

export interface TushareIngestInput {
  items: TushareIngestItem[];
  startDate: string;
  endDate?: string | null;
}

export type LedgerEntryId = string;

export type LedgerEventType =
  | "trade"
  | "cash"
  | "fee"
  | "tax"
  | "dividend"
  | "adjustment"
  | "corporate_action";

export type LedgerSide = "buy" | "sell";

export type LedgerSource = "manual" | "csv" | "broker_import" | "system";

export type CorporateActionKind = "split" | "reverse_split" | "info";

export type CorporateActionCategory =
  | "decision"
  | "org_change"
  | "policy_support"
  | "other";

export interface CorporateActionSplitMeta {
  kind: "split" | "reverse_split";
  numerator: number;
  denominator: number;
}

export interface CorporateActionInfoMeta {
  kind: "info";
  category: CorporateActionCategory;
  title: string;
  description?: string | null;
}

export type CorporateActionMeta =
  | CorporateActionSplitMeta
  | CorporateActionInfoMeta;

export type LedgerEntryMeta = Record<string, unknown> | CorporateActionMeta;

export interface LedgerEntry {
  id: LedgerEntryId;
  portfolioId: PortfolioId;
  accountKey: string | null;
  eventType: LedgerEventType;
  tradeDate: string;
  eventTs: number | null;
  sequence: number | null;
  instrumentId: string | null;
  symbol: string | null;
  side: LedgerSide | null;
  quantity: number | null;
  price: number | null;
  priceCurrency: string | null;
  cashAmount: number | null;
  cashCurrency: string | null;
  fee: number | null;
  tax: number | null;
  note: string | null;
  source: LedgerSource;
  externalId: string | null;
  meta: LedgerEntryMeta | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export type IngestRunScope = "targets" | "universe";
export type IngestRunMode = "daily" | "bootstrap" | "manual" | "on_demand";
export type IngestRunStatus =
  | "running"
  | "success"
  | "partial"
  | "failed"
  | "canceled";

export interface MarketIngestRun {
  id: string;
  scope: IngestRunScope;
  mode: IngestRunMode;
  status: IngestRunStatus;
  asOfTradeDate: string | null;
  startedAt: number;
  finishedAt: number | null;
  symbolCount: number | null;
  inserted: number | null;
  updated: number | null;
  errors: number | null;
  errorMessage: string | null;
  meta: Record<string, unknown> | null;
}

export interface ListIngestRunsInput {
  limit?: number | null;
}

export interface RemoveIngestRunInput {
  id: string;
}

export type MarketTokenSource = "env" | "local" | "none";

export interface MarketTokenStatus {
  source: MarketTokenSource;
  configured: boolean;
}

export type DataDomainId =
  | "stock"
  | "etf"
  | "index"
  | "public_fund"
  | "futures"
  | "spot"
  | "options"
  | "bond"
  | "fx"
  | "hk_stock"
  | "us_stock"
  | "industry_economy"
  | "macro";

export type DataSourceProviderStatus = "active" | "planned";

export interface DataSourceProviderInfo {
  id: string;
  label: string;
  status: DataSourceProviderStatus;
  homepage: string | null;
}

export interface DataSourceModuleCatalogItem {
  id: string;
  label: string;
  implemented: boolean;
  syncCapable: boolean;
  defaultEnabled: boolean;
  providerIds: string[];
}

export interface DataSourceDomainCatalogItem {
  id: DataDomainId;
  label: string;
  modules: DataSourceModuleCatalogItem[];
}

export interface MarketDataSourceCatalog {
  providers: DataSourceProviderInfo[];
  domains: DataSourceDomainCatalogItem[];
  updatedAt: number;
}

export type DataSourceTokenMode = "inherit_main" | "override";

export interface DataSourceModuleConfig {
  enabled: boolean;
}

export interface DataSourceDomainConfig {
  enabled: boolean;
  provider: string;
  tokenMode: DataSourceTokenMode;
  modules: Record<string, DataSourceModuleConfig>;
}

export interface MarketDataSourceConfigV2 {
  version: 2;
  mainProvider: string;
  domains: Record<DataDomainId, DataSourceDomainConfig>;
}

export type DomainTokenSource =
  | "domain_override"
  | "main"
  | "env_fallback"
  | "none";

export interface DomainTokenStatus {
  source: DomainTokenSource;
  configured: boolean;
}

export interface MarketTokenMatrixStatus {
  mainConfigured: boolean;
  domains: Record<DataDomainId, DomainTokenStatus>;
}

export type ConnectivityTestScope = "domain" | "module";
export type ConnectivityTestStatus = "untested" | "pass" | "fail" | "unsupported";

export interface ConnectivityTestRecord {
  scope: ConnectivityTestScope;
  domainId: DataDomainId;
  moduleId: string | null;
  status: ConnectivityTestStatus;
  testedAt: number | null;
  message: string | null;
  stale: boolean;
}

export interface SetMarketMainTokenInput {
  token: string | null;
}

export interface SetMarketDomainTokenInput {
  domainId: DataDomainId;
  token: string | null;
}

export interface ClearMarketDomainTokenInput {
  domainId: DataDomainId;
}

export interface TestMarketDomainConnectivityInput {
  domainId: DataDomainId;
}

export interface TestMarketModuleConnectivityInput {
  domainId: DataDomainId;
  moduleId: string;
}

export interface ValidateDataSourceReadinessInput {
  scope?: "targets" | "universe" | "both" | null;
}

export interface RunIngestPreflightInput {
  scope?: "targets" | "universe" | "both" | null;
}

export type DataSourceReadinessIssueLevel = "error" | "warning";

export interface DataSourceReadinessIssue {
  level: DataSourceReadinessIssueLevel;
  code: string;
  message: string;
  domainId?: DataDomainId | null;
  moduleId?: string | null;
}

export interface DataSourceReadinessResult {
  ready: boolean;
  selectedDomains: DataDomainId[];
  selectedModules: { domainId: DataDomainId; moduleId: string }[];
  issues: DataSourceReadinessIssue[];
  updatedAt: number;
}

export interface IngestPreflightResult {
  scope: "targets" | "universe" | "both";
  selectedDomains: DataDomainId[];
  selectedModules: Array<{ domainId: DataDomainId; moduleId: string }>;
  refreshedDomainTests: ConnectivityTestRecord[];
  refreshedModuleTests: ConnectivityTestRecord[];
  readiness: DataSourceReadinessResult;
  updatedAt: number;
}

export interface SetMarketTokenInput {
  token: string | null;
}

export interface TestMarketTokenInput {
  token?: string | null;
}

export interface OpenMarketProviderInput {
  provider: string;
}

export interface TriggerMarketIngestInput {
  scope: "targets" | "universe" | "both";
}

export type MarketIngestControlState =
  | "idle"
  | "running"
  | "paused"
  | "canceling";

export interface MarketIngestCurrentJob {
  scope: IngestRunScope;
  mode: IngestRunMode;
  source: "manual" | "schedule" | "startup" | "auto";
  enqueuedAt: number;
}

export interface MarketIngestControlStatus {
  state: MarketIngestControlState;
  queueLength: number;
  paused: boolean;
  cancelRequested: boolean;
  currentJob: MarketIngestCurrentJob | null;
  currentRunId: string | null;
  updatedAt: number;
}

export interface MarketIngestSchedulerConfig {
  enabled: boolean;
  runAt: string;
  timezone: string;
  scope: "targets" | "universe" | "both";
  runOnStartup: boolean;
  catchUpMissed: boolean;
}

export type SqliteFlushTrigger =
  | "scheduled"
  | "transaction_commit"
  | "close"
  | "manual";

export interface MarketRuntimePerfFlushRecord {
  filePath: string;
  trigger: SqliteFlushTrigger;
  bytes: number;
  durationMs: number;
  timestamp: number;
}

export interface MarketRuntimePerfStats {
  collectedAt: number;
  processUptimeMs: number;
  processRssBytes: number;
  processHeapUsedBytes: number;
  sqlite: {
    flushDebounceMs: number;
    dirtyDbCount: number;
    scheduledFlushCount: number;
    completedFlushCount: number;
    totalFlushBytes: number;
    totalFlushDurationMs: number;
    lastFlushError: string | null;
    recentFlushes: MarketRuntimePerfFlushRecord[];
  };
}

export type UniversePoolBucketId = "cn_a" | "etf" | "metal_futures" | "metal_spot";

export interface MarketUniversePoolConfig {
  enabledBuckets: UniversePoolBucketId[];
}

export interface MarketUniversePoolBucketStatus {
  bucket: UniversePoolBucketId;
  enabled: boolean;
  lastAsOfTradeDate: string | null;
  lastRunAt: number | null;
}

export interface MarketUniversePoolOverview {
  config: MarketUniversePoolConfig;
  buckets: MarketUniversePoolBucketStatus[];
  updatedAt: number;
}

export type TargetTaskModuleId =
  | "core.daily_prices"
  | "core.instrument_meta"
  | "core.daily_basics"
  | "core.daily_moneyflows"
  | "core.futures_settle"
  | "core.futures_oi"
  | "core.spot_price_avg"
  | "core.spot_settle"
  | "task.exposure"
  | "task.momentum"
  | "task.liquidity";

export type TargetTaskStatus =
  | "complete"
  | "partial"
  | "missing"
  | "not_applicable";

export interface MarketTargetTaskMatrixConfig {
  version: 1;
  defaultLookbackDays: number;
  enabledModules: TargetTaskModuleId[];
}

export interface MarketTargetTaskStatusRow {
  symbol: string;
  moduleId: TargetTaskModuleId;
  assetClass: AssetClass | null;
  asOfTradeDate: string | null;
  status: TargetTaskStatus;
  coverageRatio: number | null;
  sourceRunId: string | null;
  lastError: string | null;
  updatedAt: number;
}

export interface ListTargetTaskStatusInput {
  symbol?: string | null;
  moduleId?: TargetTaskModuleId | null;
  status?: TargetTaskStatus | null;
  limit?: number | null;
  offset?: number | null;
}

export interface ListTargetTaskStatusResult {
  items: MarketTargetTaskStatusRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface PreviewTargetTaskCoverageResult {
  asOfTradeDate: string | null;
  totals: {
    symbols: number;
    modules: number;
    complete: number;
    partial: number;
    missing: number;
    notApplicable: number;
  };
  byAssetClass: Array<{
    assetClass: AssetClass | "unknown";
    complete: number;
    partial: number;
    missing: number;
    notApplicable: number;
  }>;
}

export interface RunTargetMaterializationInput {
  symbols?: string[] | null;
}

export type CompletenessScopeId = "target_pool" | "source_pool";

export type CompletenessBucketId =
  | "stock"
  | "etf"
  | "futures"
  | "spot"
  | "index"
  | "fx"
  | "macro"
  | "global";

export type CompletenessEntityType =
  | "instrument"
  | "fx_pair"
  | "macro_module"
  | "global";

export type CompletenessStatus =
  | "complete"
  | "partial"
  | "missing"
  | "not_applicable"
  | "not_started";

export interface MarketCompletenessCheckDescriptor {
  id: string;
  scopeId: CompletenessScopeId;
  bucketId: CompletenessBucketId;
  label: string;
  domainId?: DataDomainId | null;
  moduleId?: string | null;
  usageContexts: string[];
  uiApplications: string[];
  usageContextTooltips: Record<string, string>;
  uiApplicationTooltips: Record<string, string>;
  editable: boolean;
  sortOrder: number;
  legacyTargetModuleId?: TargetTaskModuleId | null;
}

export interface MarketCompletenessConfig {
  version: 1;
  defaultLookbackDays: number;
  targetEnabledCheckIds: string[];
  checks: MarketCompletenessCheckDescriptor[];
  updatedAt: number;
}

export interface SetMarketCompletenessConfigInput {
  defaultLookbackDays?: number | null;
  targetEnabledCheckIds?: string[] | null;
}

export interface MarketCompletenessStatusRow {
  scopeId: CompletenessScopeId;
  checkId: string;
  entityType: CompletenessEntityType;
  entityId: string;
  bucketId: CompletenessBucketId;
  domainId: DataDomainId | null;
  moduleId: string | null;
  assetClass: AssetClass | "unknown" | null;
  asOfTradeDate: string | null;
  status: CompletenessStatus;
  coverageRatio: number | null;
  sourceRunId: string | null;
  detail: Record<string, unknown> | null;
  updatedAt: number;
}

export interface ListCompletenessStatusInput {
  scopeId?: CompletenessScopeId | null;
  checkId?: string | null;
  status?: CompletenessStatus | null;
  entityType?: CompletenessEntityType | null;
  bucketId?: CompletenessBucketId | null;
  domainId?: DataDomainId | null;
  moduleId?: string | null;
  asOfTradeDate?: string | null;
  keyword?: string | null;
  keywordFields?: Array<"entity" | "check" | "module"> | null;
  onlyExceptions?: boolean | null;
  sortBy?: "updatedAt" | "asOfTradeDate" | "status" | null;
  sortOrder?: "asc" | "desc" | null;
  limit?: number | null;
  offset?: number | null;
}

export interface ListCompletenessStatusResult {
  items: MarketCompletenessStatusRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface PreviewCompletenessCoverageInput {
  scopeId?: CompletenessScopeId | null;
}

export interface PreviewCompletenessCoverageResult {
  scopeId: CompletenessScopeId;
  asOfTradeDate: string | null;
  totals: {
    entities: number;
    checks: number;
    complete: number;
    partial: number;
    missing: number;
    notApplicable: number;
    notStarted: number;
  };
  byBucket: Array<{
    bucketId: CompletenessBucketId;
    complete: number;
    partial: number;
    missing: number;
    notApplicable: number;
    notStarted: number;
  }>;
}

export interface RunCompletenessMaterializationInput {
  scopeId?: CompletenessScopeId | null;
  symbols?: string[] | null;
}

export interface MarketRolloutFlags {
  p0Enabled: boolean;
  p1Enabled: boolean;
  p2Enabled: boolean;
  universeIndexDailyEnabled: boolean;
  universeDailyBasicEnabled: boolean;
  universeMoneyflowEnabled: boolean;
  p2RealtimeIndexV1: boolean;
  p2RealtimeEquityEtfV1: boolean;
  p2FuturesMicrostructureV1: boolean;
  p2SpecialPermissionStkPremarketV1: boolean;
  updatedAt: number;
}

export interface SetMarketRolloutFlagsInput {
  p0Enabled?: boolean | null;
  p1Enabled?: boolean | null;
  p2Enabled?: boolean | null;
  universeIndexDailyEnabled?: boolean | null;
  universeDailyBasicEnabled?: boolean | null;
  universeMoneyflowEnabled?: boolean | null;
  p2RealtimeIndexV1?: boolean | null;
  p2RealtimeEquityEtfV1?: boolean | null;
  p2FuturesMicrostructureV1?: boolean | null;
  p2SpecialPermissionStkPremarketV1?: boolean | null;
}

export interface InstrumentRegistryEntry {
  symbol: string;
  name: string | null;
  assetClass: AssetClass | null;
  market: string | null;
  currency: string | null;
  autoIngest: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ListInstrumentRegistryInput {
  query?: string | null;
  autoIngest?: "all" | "enabled" | "disabled";
  limit?: number | null;
  offset?: number | null;
}

export interface ListInstrumentRegistryResult {
  items: InstrumentRegistryEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface SetInstrumentAutoIngestInput {
  symbol: string;
  enabled: boolean;
}

export interface BatchSetInstrumentAutoIngestInput {
  symbols: string[];
  enabled: boolean;
}

export interface GetIngestRunDetailInput {
  id: string;
}

export interface TempTargetSymbol {
  symbol: string;
  expiresAt: number;
  updatedAt: number;
}

export interface TouchTempTargetSymbolInput {
  symbol: string;
  ttlDays?: number | null;
}

export interface RemoveTempTargetSymbolInput {
  symbol: string;
}

export interface CreateLedgerEntryInput {
  portfolioId: PortfolioId;
  accountKey?: string | null;
  eventType: LedgerEventType;
  tradeDate: string;
  eventTs?: number | null;
  sequence?: number | null;
  instrumentId?: string | null;
  symbol?: string | null;
  side?: LedgerSide | null;
  quantity?: number | null;
  price?: number | null;
  priceCurrency?: string | null;
  cashAmount?: number | null;
  cashCurrency?: string | null;
  fee?: number | null;
  tax?: number | null;
  note?: string | null;
  source: LedgerSource;
  externalId?: string | null;
  meta?: LedgerEntryMeta | null;
}

export interface UpdateLedgerEntryInput extends CreateLedgerEntryInput {
  id: LedgerEntryId;
}

export interface MyTraderApi {
  account: {
    getActive(): Promise<AccountSummary | null>;
    list(): Promise<AccountSummary[]>;
    create(input: CreateAccountInput): Promise<AccountSummary>;
    unlock(input: UnlockAccountInput): Promise<AccountSummary>;
    lock(): Promise<void>;
    chooseDataRootDir(): Promise<string | null>;
  };
  portfolio: {
    list(): Promise<Portfolio[]>;
    create(input: CreatePortfolioInput): Promise<Portfolio>;
    update(input: UpdatePortfolioInput): Promise<Portfolio>;
    remove(portfolioId: PortfolioId): Promise<void>;
    getSnapshot(portfolioId: PortfolioId): Promise<PortfolioSnapshot>;
    getPerformance(
      input: PortfolioPerformanceRangeInput
    ): Promise<PortfolioPerformanceRangeResult>;
  };
  position: {
    create(input: CreatePositionInput): Promise<Position>;
    update(input: UpdatePositionInput): Promise<Position>;
    remove(positionId: PositionId): Promise<void>;
  };
  risk: {
    create(input: CreateRiskLimitInput): Promise<RiskLimit>;
    update(input: UpdateRiskLimitInput): Promise<RiskLimit>;
    remove(riskLimitId: RiskLimitId): Promise<void>;
  };
  ledger: {
    list(portfolioId: PortfolioId): Promise<LedgerEntry[]>;
    create(input: CreateLedgerEntryInput): Promise<LedgerEntry>;
    update(input: UpdateLedgerEntryInput): Promise<LedgerEntry>;
    remove(ledgerEntryId: LedgerEntryId): Promise<void>;
  };
  market: {
    chooseCsvFile(kind: "holdings" | "prices"): Promise<string | null>;
    importHoldingsCsv(input: ImportHoldingsCsvInput): Promise<MarketImportResult>;
    importPricesCsv(input: ImportPricesCsvInput): Promise<MarketImportResult>;
    ingestTushare(input: TushareIngestInput): Promise<MarketImportResult>;
    syncInstrumentCatalog(): Promise<MarketImportResult>;
    searchInstruments(
      input: SearchInstrumentsInput
    ): Promise<InstrumentProfileSummary[]>;
    getInstrumentProfile(symbol: string): Promise<InstrumentProfile | null>;
    getTargets(): Promise<MarketTargetsConfig>;
    setTargets(config: MarketTargetsConfig): Promise<MarketTargetsConfig>;
    previewTargets(): Promise<PreviewTargetsResult>;
    listWatchlist(): Promise<WatchlistItem[]>;
    upsertWatchlistItem(input: UpsertWatchlistItemInput): Promise<WatchlistItem>;
    removeWatchlistItem(symbol: string): Promise<void>;
    listInstrumentTags(symbol: string): Promise<string[]>;
    addInstrumentTag(symbol: string, tag: string): Promise<void>;
    removeInstrumentTag(symbol: string, tag: string): Promise<void>;
    listTags(input: ListTagsInput): Promise<TagSummary[]>;
    getTagMembers(input: GetTagMembersInput): Promise<string[]>;
    getTagSeries(input: GetTagSeriesInput): Promise<MarketTagSeriesResult>;
    getQuotes(input: GetQuotesInput): Promise<MarketQuote[]>;
    getDailyBars(input: GetDailyBarsInput): Promise<MarketDailyBar[]>;
    seedDemoData(input?: SeedMarketDemoDataInput): Promise<SeedMarketDemoDataResult>;
    getTokenStatus(): Promise<MarketTokenStatus>;
    setToken(input: SetMarketTokenInput): Promise<MarketTokenStatus>;
    testToken(input?: TestMarketTokenInput): Promise<void>;
    getDataSourceCatalog(): Promise<MarketDataSourceCatalog>;
    getDataSourceConfig(): Promise<MarketDataSourceConfigV2>;
    setDataSourceConfig(
      input: MarketDataSourceConfigV2
    ): Promise<MarketDataSourceConfigV2>;
    getTokenMatrixStatus(): Promise<MarketTokenMatrixStatus>;
    setMainToken(input: SetMarketMainTokenInput): Promise<MarketTokenMatrixStatus>;
    setDomainToken(
      input: SetMarketDomainTokenInput
    ): Promise<MarketTokenMatrixStatus>;
    clearDomainToken(
      input: ClearMarketDomainTokenInput
    ): Promise<MarketTokenMatrixStatus>;
    testDomainConnectivity(input: TestMarketDomainConnectivityInput): Promise<ConnectivityTestRecord>;
    testModuleConnectivity(input: TestMarketModuleConnectivityInput): Promise<ConnectivityTestRecord>;
    listConnectivityTests(): Promise<ConnectivityTestRecord[]>;
    runIngestPreflight(
      input?: RunIngestPreflightInput
    ): Promise<IngestPreflightResult>;
    validateDataSourceReadiness(
      input?: ValidateDataSourceReadinessInput
    ): Promise<DataSourceReadinessResult>;
    openProviderHomepage(input: OpenMarketProviderInput): Promise<void>;
    listIngestRuns(input?: ListIngestRunsInput): Promise<MarketIngestRun[]>;
    getIngestRunDetail(input: GetIngestRunDetailInput): Promise<MarketIngestRun | null>;
    removeIngestRun(input: RemoveIngestRunInput): Promise<void>;
    clearIngestRuns(): Promise<void>;
    triggerIngest(input: TriggerMarketIngestInput): Promise<void>;
    getIngestControlStatus(): Promise<MarketIngestControlStatus>;
    pauseIngest(): Promise<MarketIngestControlStatus>;
    resumeIngest(): Promise<MarketIngestControlStatus>;
    cancelIngest(): Promise<MarketIngestControlStatus>;
    getIngestSchedulerConfig(): Promise<MarketIngestSchedulerConfig>;
    setIngestSchedulerConfig(
      input: MarketIngestSchedulerConfig
    ): Promise<MarketIngestSchedulerConfig>;
    getRuntimePerfStats(): Promise<MarketRuntimePerfStats>;
    getUniversePoolConfig(): Promise<MarketUniversePoolConfig>;
    setUniversePoolConfig(input: MarketUniversePoolConfig): Promise<MarketUniversePoolConfig>;
    getUniversePoolOverview(): Promise<MarketUniversePoolOverview>;
    getTargetTaskMatrixConfig(): Promise<MarketTargetTaskMatrixConfig>;
    setTargetTaskMatrixConfig(
      input: MarketTargetTaskMatrixConfig
    ): Promise<MarketTargetTaskMatrixConfig>;
    previewTargetTaskCoverage(): Promise<PreviewTargetTaskCoverageResult>;
    listTargetTaskStatus(
      input?: ListTargetTaskStatusInput
    ): Promise<ListTargetTaskStatusResult>;
    runTargetMaterialization(input?: RunTargetMaterializationInput): Promise<void>;
    getCompletenessConfig(): Promise<MarketCompletenessConfig>;
    setCompletenessConfig(
      input: SetMarketCompletenessConfigInput
    ): Promise<MarketCompletenessConfig>;
    previewCompletenessCoverage(
      input?: PreviewCompletenessCoverageInput
    ): Promise<PreviewCompletenessCoverageResult>;
    listCompletenessStatus(
      input?: ListCompletenessStatusInput
    ): Promise<ListCompletenessStatusResult>;
    runCompletenessMaterialization(
      input?: RunCompletenessMaterializationInput
    ): Promise<void>;
    getRolloutFlags(): Promise<MarketRolloutFlags>;
    setRolloutFlags(input: SetMarketRolloutFlagsInput): Promise<MarketRolloutFlags>;
    listTempTargets(): Promise<TempTargetSymbol[]>;
    touchTempTarget(input: TouchTempTargetSymbolInput): Promise<TempTargetSymbol[]>;
    removeTempTarget(input: RemoveTempTargetSymbolInput): Promise<TempTargetSymbol[]>;
    promoteTempTarget(input: RemoveTempTargetSymbolInput): Promise<MarketTargetsConfig>;
    previewTargetsDraft(input: PreviewTargetsDraftInput): Promise<PreviewTargetsDiffResult>;
    listInstrumentRegistry(
      input?: ListInstrumentRegistryInput
    ): Promise<ListInstrumentRegistryResult>;
    setInstrumentAutoIngest(input: SetInstrumentAutoIngestInput): Promise<void>;
    batchSetInstrumentAutoIngest(
      input: BatchSetInstrumentAutoIngestInput
    ): Promise<void>;
  };
}

export const IPC_CHANNELS = {
  ACCOUNT_GET_ACTIVE: "account:getActive",
  ACCOUNT_LIST: "account:list",
  ACCOUNT_CREATE: "account:create",
  ACCOUNT_UNLOCK: "account:unlock",
  ACCOUNT_LOCK: "account:lock",
  ACCOUNT_CHOOSE_DATA_ROOT_DIR: "account:chooseDataRootDir",
  PORTFOLIO_LIST: "portfolio:list",
  PORTFOLIO_CREATE: "portfolio:create",
  PORTFOLIO_UPDATE: "portfolio:update",
  PORTFOLIO_REMOVE: "portfolio:remove",
  PORTFOLIO_GET_SNAPSHOT: "portfolio:getSnapshot",
  PORTFOLIO_GET_PERFORMANCE: "portfolio:getPerformance",
  POSITION_CREATE: "position:create",
  POSITION_UPDATE: "position:update",
  POSITION_REMOVE: "position:remove",
  RISK_CREATE: "risk:create",
  RISK_UPDATE: "risk:update",
  RISK_REMOVE: "risk:remove",
  LEDGER_LIST: "ledger:list",
  LEDGER_CREATE: "ledger:create",
  LEDGER_UPDATE: "ledger:update",
  LEDGER_REMOVE: "ledger:remove",
  MARKET_CHOOSE_CSV_FILE: "market:chooseCsvFile",
  MARKET_IMPORT_HOLDINGS_CSV: "market:importHoldingsCsv",
  MARKET_IMPORT_PRICES_CSV: "market:importPricesCsv",
  MARKET_INGEST_TUSHARE: "market:ingestTushare",
  MARKET_SYNC_INSTRUMENT_CATALOG: "market:syncInstrumentCatalog",
  MARKET_SEARCH_INSTRUMENTS: "market:searchInstruments",
  MARKET_GET_INSTRUMENT_PROFILE: "market:getInstrumentProfile",
  MARKET_GET_TARGETS: "market:getTargets",
  MARKET_SET_TARGETS: "market:setTargets",
  MARKET_PREVIEW_TARGETS: "market:previewTargets",
  MARKET_WATCHLIST_LIST: "market:watchlist:list",
  MARKET_WATCHLIST_UPSERT: "market:watchlist:upsert",
  MARKET_WATCHLIST_REMOVE: "market:watchlist:remove",
  MARKET_TAGS_LIST: "market:tags:list",
  MARKET_TAGS_ADD: "market:tags:add",
  MARKET_TAGS_REMOVE: "market:tags:remove",
  MARKET_LIST_TAGS: "market:listTags",
  MARKET_GET_TAG_MEMBERS: "market:getTagMembers",
  MARKET_GET_TAG_SERIES: "market:getTagSeries",
  MARKET_GET_QUOTES: "market:getQuotes",
  MARKET_GET_DAILY_BARS: "market:getDailyBars",
  MARKET_SEED_DEMO_DATA: "market:seedDemoData",
  MARKET_TOKEN_GET_STATUS: "market:token:getStatus",
  MARKET_TOKEN_SET: "market:token:set",
  MARKET_TOKEN_TEST: "market:token:test",
  MARKET_DATA_SOURCE_GET_CATALOG: "market:dataSource:getCatalog",
  MARKET_DATA_SOURCE_GET_CONFIG: "market:dataSource:getConfig",
  MARKET_DATA_SOURCE_SET_CONFIG: "market:dataSource:setConfig",
  MARKET_TOKEN_GET_MATRIX_STATUS: "market:token:getMatrixStatus",
  MARKET_TOKEN_SET_MAIN: "market:token:setMain",
  MARKET_TOKEN_SET_DOMAIN: "market:token:setDomain",
  MARKET_TOKEN_CLEAR_DOMAIN: "market:token:clearDomain",
  MARKET_TEST_DOMAIN_CONNECTIVITY: "market:dataSource:testDomainConnectivity",
  MARKET_TEST_MODULE_CONNECTIVITY: "market:dataSource:testModuleConnectivity",
  MARKET_LIST_CONNECTIVITY_TESTS: "market:dataSource:listConnectivityTests",
  MARKET_INGEST_PREFLIGHT_RUN: "market:ingest:preflightRun",
  MARKET_VALIDATE_SOURCE_READINESS: "market:dataSource:validateReadiness",
  MARKET_PROVIDER_OPEN: "market:provider:open",
  MARKET_INGEST_RUNS_LIST: "market:ingestRuns:list",
  MARKET_INGEST_RUN_GET: "market:ingestRuns:get",
  MARKET_INGEST_RUN_REMOVE: "market:ingestRuns:remove",
  MARKET_INGEST_RUNS_CLEAR: "market:ingestRuns:clear",
  MARKET_INGEST_TRIGGER: "market:ingest:trigger",
  MARKET_INGEST_CONTROL_STATUS: "market:ingest:controlStatus",
  MARKET_INGEST_CONTROL_PAUSE: "market:ingest:pause",
  MARKET_INGEST_CONTROL_RESUME: "market:ingest:resume",
  MARKET_INGEST_CONTROL_CANCEL: "market:ingest:cancel",
  MARKET_INGEST_SCHEDULER_GET: "market:ingestScheduler:get",
  MARKET_INGEST_SCHEDULER_SET: "market:ingestScheduler:set",
  MARKET_RUNTIME_PERF_STATS_GET: "market:runtimePerf:getStats",
  MARKET_UNIVERSE_POOL_GET_CONFIG: "market:universePool:getConfig",
  MARKET_UNIVERSE_POOL_SET_CONFIG: "market:universePool:setConfig",
  MARKET_UNIVERSE_POOL_GET_OVERVIEW: "market:universePool:getOverview",
  MARKET_TARGET_TASK_MATRIX_GET_CONFIG: "market:targetTaskMatrix:getConfig",
  MARKET_TARGET_TASK_MATRIX_SET_CONFIG: "market:targetTaskMatrix:setConfig",
  MARKET_TARGET_TASK_PREVIEW_COVERAGE: "market:targetTask:previewCoverage",
  MARKET_TARGET_TASK_LIST_STATUS: "market:targetTask:listStatus",
  MARKET_TARGET_TASK_RUN_MATERIALIZATION: "market:targetTask:runMaterialization",
  MARKET_COMPLETENESS_GET_CONFIG: "market:completeness:getConfig",
  MARKET_COMPLETENESS_SET_CONFIG: "market:completeness:setConfig",
  MARKET_COMPLETENESS_PREVIEW_COVERAGE: "market:completeness:previewCoverage",
  MARKET_COMPLETENESS_LIST_STATUS: "market:completeness:listStatus",
  MARKET_COMPLETENESS_RUN_MATERIALIZATION: "market:completeness:runMaterialization",
  MARKET_ROLLOUT_FLAGS_GET: "market:rolloutFlags:get",
  MARKET_ROLLOUT_FLAGS_SET: "market:rolloutFlags:set",
  MARKET_TEMP_TARGETS_LIST: "market:targetsTemp:list",
  MARKET_TEMP_TARGETS_TOUCH: "market:targetsTemp:touch",
  MARKET_TEMP_TARGETS_REMOVE: "market:targetsTemp:remove",
  MARKET_TEMP_TARGETS_PROMOTE: "market:targetsTemp:promote",
  MARKET_TARGETS_PREVIEW_DRAFT: "market:targets:previewDraft",
  MARKET_INSTRUMENT_REGISTRY_LIST: "market:instrumentRegistry:list",
  MARKET_INSTRUMENT_REGISTRY_SET_AUTO_INGEST:
    "market:instrumentRegistry:setAutoIngest",
  MARKET_INSTRUMENT_REGISTRY_BATCH_SET_AUTO_INGEST:
    "market:instrumentRegistry:batchSetAutoIngest"
} as const;
