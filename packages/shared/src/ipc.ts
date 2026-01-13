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
  password: string;
}

export type AssetClass = "stock" | "etf" | "cash";

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
  exposures: {
    byAssetClass: ExposureEntry[];
    bySymbol: ExposureEntry[];
  };
  riskLimits: RiskLimit[];
  riskWarnings: RiskWarning[];
  priceAsOf: string | null;
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

export interface TushareIngestItem {
  symbol: string;
  assetClass: AssetClass;
}

export interface TushareIngestInput {
  items: TushareIngestItem[];
  startDate: string;
  endDate?: string | null;
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
  market: {
    chooseCsvFile(kind: "holdings" | "prices"): Promise<string | null>;
    importHoldingsCsv(input: ImportHoldingsCsvInput): Promise<MarketImportResult>;
    importPricesCsv(input: ImportPricesCsvInput): Promise<MarketImportResult>;
    ingestTushare(input: TushareIngestInput): Promise<MarketImportResult>;
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
  POSITION_CREATE: "position:create",
  POSITION_UPDATE: "position:update",
  POSITION_REMOVE: "position:remove",
  RISK_CREATE: "risk:create",
  RISK_UPDATE: "risk:update",
  RISK_REMOVE: "risk:remove",
  MARKET_CHOOSE_CSV_FILE: "market:chooseCsvFile",
  MARKET_IMPORT_HOLDINGS_CSV: "market:importHoldingsCsv",
  MARKET_IMPORT_PRICES_CSV: "market:importPricesCsv",
  MARKET_INGEST_TUSHARE: "market:ingestTushare"
} as const;
