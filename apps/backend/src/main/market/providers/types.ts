import type { AssetClass } from "@mytrader/shared";

import type { PriceInput } from "../marketRepository";

export type MarketProviderId = "tushare";

export type MarketInstrumentKind =
  | "stock"
  | "fund"
  | "index"
  | "futures"
  | "spot"
  | "forex";

export type ProviderInstrumentProfile = {
  provider: MarketProviderId;
  kind: MarketInstrumentKind;
  symbol: string;
  name: string | null;
  assetClass: AssetClass | null;
  market: string | null;
  currency: string | null;
  tags: string[];
  providerData: Record<string, unknown>;
};

export type TradingCalendarDayInput = {
  market: string;
  date: string; // YYYY-MM-DD
  isOpen: boolean;
  provider: MarketProviderId;
};

export type ProviderDailyBasic = {
  symbol: string;
  tradeDate: string; // YYYY-MM-DD
  circMv: number | null;
  totalMv: number | null;
  provider: MarketProviderId;
};

export type ProviderDailyMoneyflow = {
  symbol: string;
  tradeDate: string; // YYYY-MM-DD
  netMfVol: number | null;
  netMfAmount: number | null;
  provider: MarketProviderId;
};

export interface MarketProvider {
  readonly id: MarketProviderId;

  testToken(token: string): Promise<void>;

  fetchDailyPrices(input: {
    token: string;
    items: { symbol: string; assetClass: AssetClass }[];
    startDate: string;
    endDate?: string | null;
  }): Promise<PriceInput[]>;

  fetchInstrumentCatalog(input: {
    token: string;
  }): Promise<ProviderInstrumentProfile[]>;

  fetchTradingCalendar(input: {
    token: string;
    market: string;
    startDate: string;
    endDate: string;
  }): Promise<TradingCalendarDayInput[]>;

  fetchDailyBasics(input: {
    token: string;
    symbols: string[];
    startDate: string;
    endDate: string;
  }): Promise<ProviderDailyBasic[]>;

  fetchDailyMoneyflows(input: {
    token: string;
    symbol: string;
    startDate: string;
    endDate: string;
  }): Promise<ProviderDailyMoneyflow[]>;
}
