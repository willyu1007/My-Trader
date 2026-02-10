import type { AssetClass } from "@mytrader/shared";

import type { PriceInput } from "../marketRepository";
import { matchUniversePoolBuckets, getUniversePoolTag } from "../universePoolBuckets";
import { fetchTushareDailyPrices } from "../tushareClient";
import type {
  MarketProvider,
  ProviderDailyBasic,
  ProviderDailyMoneyflow,
  ProviderInstrumentProfile,
  TradingCalendarDayInput
} from "./types";

const TUSHARE_URL = "https://api.tushare.pro";

type TushareRawResponse = {
  fields: string[];
  items: (string | number | null)[][];
};

type TushareEnvelope = {
  code: number;
  msg: string;
  data?: TushareRawResponse;
};

export const tushareProvider: MarketProvider = {
  id: "tushare",

  async testToken(token: string): Promise<void> {
    try {
      const res = await callTushare(
        "stock_basic",
        token,
        { ts_code: "000001.SZ" },
        "ts_code,name"
      );
      const rows = res.items ?? [];
      if (rows.length === 0) {
        throw new Error("Tushare token 校验失败：未返回任何数据。");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("没有接口访问权限")) {
        throw new Error(
          "Tushare 权限不足：当前账号没有 stock_basic 接口访问权限。请在 TuShare Pro 开通接口权限或更换 token。"
        );
      }
      throw err;
    }
  },

  async fetchDailyPrices(input): Promise<PriceInput[]> {
    return await fetchTushareDailyPrices(
      input.token,
      input.items,
      input.startDate,
      input.endDate ?? null
    );
  },

  async fetchInstrumentCatalog(input): Promise<ProviderInstrumentProfile[]> {
    const [stocks, funds] = await Promise.all([
      fetchStockBasic(input.token),
      fetchFundBasic(input.token)
    ]);
    return [...stocks, ...funds];
  },

  async fetchTradingCalendar(
    input: {
      token: string;
      market: string;
      startDate: string;
      endDate: string;
    }
  ): Promise<TradingCalendarDayInput[]> {
    const exchange = mapMarketToTushareExchange(input.market);
    const res = await callTushare(
      "trade_cal",
      input.token,
      {
        exchange,
        start_date: toTushareDate(input.startDate),
        end_date: toTushareDate(input.endDate)
      },
      "exchange,cal_date,is_open,pretrade_date"
    );

    const fields = res.fields ?? [];
    const rows = res.items ?? [];
    const idxDate = fields.indexOf("cal_date");
    const idxOpen = fields.indexOf("is_open");
    if (idxDate === -1 || idxOpen === -1) {
      throw new Error("Tushare 交易日历响应缺少必要字段。");
    }

    return rows
      .map((row) => {
        const date = normalizeDate(row[idxDate]);
        if (!date) return null;
        const isOpenRaw = row[idxOpen];
        const isOpen = String(isOpenRaw) === "1";
        return {
          market: input.market,
          date,
          isOpen,
          provider: "tushare"
        } satisfies TradingCalendarDayInput;
      })
      .filter((row): row is TradingCalendarDayInput => Boolean(row));
  },

  async fetchDailyBasics(input): Promise<ProviderDailyBasic[]> {
    const symbols = Array.from(
      new Set(input.symbols.map((value) => value.trim()).filter(Boolean))
    );
    if (symbols.length === 0) return [];

    const startDate = toTushareDate(input.startDate);
    const endDate = toTushareDate(input.endDate);

    const results: ProviderDailyBasic[] = [];
    for (const symbol of symbols) {
      try {
        const res = await callTushare(
          "daily_basic",
          input.token,
          {
            ts_code: symbol,
            start_date: startDate,
            end_date: endDate
          },
          "ts_code,trade_date,circ_mv,total_mv"
        );

        const fields = res.fields ?? [];
        const rows = res.items ?? [];
        const idxTsCode = fields.indexOf("ts_code");
        const idxTradeDate = fields.indexOf("trade_date");
        const idxCircMv = fields.indexOf("circ_mv");
        const idxTotalMv = fields.indexOf("total_mv");
        if (idxTsCode === -1 || idxTradeDate === -1) {
          throw new Error("Tushare daily_basic 响应缺少必要字段。");
        }

        rows.forEach((row) => {
          const tsCode = normalizeString(row[idxTsCode]);
          const tradeDate = normalizeDate(row[idxTradeDate]);
          if (!tsCode || !tradeDate) return;
          const circMv = idxCircMv === -1 ? null : normalizeNumber(row[idxCircMv]);
          const totalMv = idxTotalMv === -1 ? null : normalizeNumber(row[idxTotalMv]);
          results.push({
            provider: "tushare",
            symbol: tsCode,
            tradeDate,
            circMv,
            totalMv
          } satisfies ProviderDailyBasic);
        });
      } catch (err) {
        console.warn(`[mytrader] tushare daily_basic failed for ${symbol}.`);
        console.warn(err);
      }
    }

    return results;
  },

  async fetchDailyMoneyflows(input): Promise<ProviderDailyMoneyflow[]> {
    const symbol = input.symbol.trim();
    if (!symbol) return [];

    const startDate = toTushareDate(input.startDate);
    const endDate = toTushareDate(input.endDate);

    const res = await callTushare(
      "moneyflow",
      input.token,
      {
        ts_code: symbol,
        start_date: startDate,
        end_date: endDate
      },
      "ts_code,trade_date,net_mf_vol,net_mf_amount"
    );

    const fields = res.fields ?? [];
    const rows = res.items ?? [];
    const idxTsCode = fields.indexOf("ts_code");
    const idxTradeDate = fields.indexOf("trade_date");
    const idxNetVol = fields.indexOf("net_mf_vol");
    const idxNetAmount = fields.indexOf("net_mf_amount");
    if (idxTsCode === -1 || idxTradeDate === -1) {
      throw new Error("Tushare moneyflow 响应缺少必要字段。");
    }

    return rows
      .map((row) => {
        const tsCode = normalizeString(row[idxTsCode]);
        const tradeDate = normalizeDate(row[idxTradeDate]);
        if (!tsCode || !tradeDate) return null;
        const netMfVol = idxNetVol === -1 ? null : normalizeNumber(row[idxNetVol]);
        const netMfAmount =
          idxNetAmount === -1 ? null : normalizeNumber(row[idxNetAmount]);
        return {
          provider: "tushare",
          symbol: tsCode,
          tradeDate,
          netMfVol,
          netMfAmount
        } satisfies ProviderDailyMoneyflow;
      })
      .filter((row): row is ProviderDailyMoneyflow => Boolean(row));
  }
};

async function fetchStockBasic(token: string): Promise<ProviderInstrumentProfile[]> {
  const res = await callTushare(
    "stock_basic",
    token,
    { list_status: "L" },
    "ts_code,symbol,name,area,industry,market,exchange,curr_type,list_status,list_date,delist_date,is_hs"
  );

  const fields = res.fields ?? [];
  const rows = res.items ?? [];
  const idxTsCode = fields.indexOf("ts_code");
  if (idxTsCode === -1) {
    throw new Error("Tushare stock_basic 响应缺少 ts_code。");
  }

  const idxName = fields.indexOf("name");
  const idxIndustry = fields.indexOf("industry");
  const idxMarket = fields.indexOf("market");
  const idxExchange = fields.indexOf("exchange");
  const idxListDate = fields.indexOf("list_date");

  return rows.map((row) => {
    const symbol = String(row[idxTsCode]);
    const name = idxName === -1 ? null : normalizeString(row[idxName]);
    const industry = idxIndustry === -1 ? null : normalizeString(row[idxIndustry]);
    const board = idxMarket === -1 ? null : normalizeString(row[idxMarket]);
    const exchange = idxExchange === -1 ? null : normalizeString(row[idxExchange]);
    const listDate = idxListDate === -1 ? null : normalizeDate(row[idxListDate]);

    const providerData: Record<string, unknown> = {
      kind: "stock_basic",
      raw: buildRowObject(fields, row),
      industry,
      board,
      exchange,
      listDate
    };

    const tags = appendUniversePoolTags(
      buildProviderTags({
        kind: "stock",
        industry,
        board,
        exchange
      }),
      {
        assetClass: "stock",
        market: "CN",
        name,
        symbol,
        tags: []
      }
    );

    return {
      provider: "tushare",
      kind: "stock",
      symbol,
      name,
      assetClass: "stock" satisfies AssetClass,
      market: "CN",
      currency: "CNY",
      tags,
      providerData
    } satisfies ProviderInstrumentProfile;
  });
}

async function fetchFundBasic(token: string): Promise<ProviderInstrumentProfile[]> {
  // Prefer exchange-traded funds for now (ETFs/LOF). Future: add other fund markets as needed.
  const res = await callTushare(
    "fund_basic",
    token,
    { market: "E" },
    "ts_code,name,management,custodian,fund_type,invest_type,type,market,status,found_date,list_date,delist_date"
  );

  const fields = res.fields ?? [];
  const rows = res.items ?? [];
  const idxTsCode = fields.indexOf("ts_code");
  if (idxTsCode === -1) {
    throw new Error("Tushare fund_basic 响应缺少 ts_code。");
  }

  const idxName = fields.indexOf("name");
  const idxFundType = fields.indexOf("fund_type");
  const idxInvestType = fields.indexOf("invest_type");
  const idxType = fields.indexOf("type");
  const idxMarket = fields.indexOf("market");
  const idxStatus = fields.indexOf("status");
  const idxListDate = fields.indexOf("list_date");

  type FundProfile = ProviderInstrumentProfile & { kind: "fund"; assetClass: AssetClass };

  return rows
    .map((row): FundProfile | null => {
      const symbol = String(row[idxTsCode]);
      const name = idxName === -1 ? null : normalizeString(row[idxName]);
      const fundType = idxFundType === -1 ? null : normalizeString(row[idxFundType]);
      const investType = idxInvestType === -1 ? null : normalizeString(row[idxInvestType]);
      const type = idxType === -1 ? null : normalizeString(row[idxType]);
      const market = idxMarket === -1 ? null : normalizeString(row[idxMarket]);
      const status = idxStatus === -1 ? null : normalizeString(row[idxStatus]);
      const listDate = idxListDate === -1 ? null : normalizeDate(row[idxListDate]);

      const isEtf =
        (fundType ?? "").toUpperCase().includes("ETF") ||
        (investType ?? "").toUpperCase().includes("ETF") ||
        (type ?? "").toUpperCase().includes("ETF");
      const isDelisted = Boolean(status && status.toUpperCase() !== "L");
      if (!isEtf || isDelisted) return null;

      const providerData: Record<string, unknown> = {
        kind: "fund_basic",
        raw: buildRowObject(fields, row),
        fundType,
        investType,
        type,
        market,
        status,
        listDate
      };

      const tags = appendUniversePoolTags(
        buildProviderTags({
          kind: "fund",
          fund_type: fundType,
          invest_type: investType,
          type,
          market
        }),
        {
          assetClass: "etf",
          market: "CN",
          name,
          symbol,
          tags: []
        }
      );

      return {
        provider: "tushare",
        kind: "fund",
        symbol,
        name,
        assetClass: "etf" satisfies AssetClass,
        market: "CN",
        currency: "CNY",
        tags,
        providerData
      } satisfies FundProfile;
    })
    .filter((row): row is FundProfile => row !== null);
}

async function callTushare(
  apiName: string,
  token: string,
  params: Record<string, string | undefined>,
  fields: string
): Promise<TushareRawResponse> {
  const body = { api_name: apiName, token, params, fields };

  const res = await fetch(TUSHARE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    throw new Error(`Tushare 请求失败，状态码 ${res.status}。`);
  }

  const json = (await res.json()) as TushareEnvelope;
  if (json.code !== 0) {
    throw new Error(`Tushare 返回错误：${json.msg || "未知错误"}`);
  }
  return json.data ?? { fields: [], items: [] };
}

function normalizeDate(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return null;
}

function normalizeString(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  return raw ? raw : null;
}

function normalizeNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const raw = typeof value === "number" ? value : Number(String(value));
  if (!Number.isFinite(raw)) return null;
  return raw;
}

function toTushareDate(value: string): string {
  return value.replace(/-/g, "");
}

function mapMarketToTushareExchange(market: string): string {
  if (market === "CN") return "SSE";
  return "SSE";
}

function buildRowObject(
  fields: string[],
  row: (string | number | null)[]
): Record<string, string | number | null> {
  const result: Record<string, string | number | null> = {};
  fields.forEach((field, index) => {
    result[field] = row[index] ?? null;
  });
  return result;
}

function buildProviderTags(input: Record<string, string | null>): string[] {
  const tags: string[] = [];
  Object.entries(input).forEach(([key, rawValue]) => {
    const value = rawValue?.trim();
    if (!value) return;
    tags.push(`${key}:${value}`);
  });
  return tags;
}

function appendUniversePoolTags(
  baseTags: string[],
  input: {
    assetClass: AssetClass | null;
    market: string | null;
    name: string | null;
    symbol: string;
    tags: string[];
  }
): string[] {
  const tags = new Set(baseTags.map((value) => value.trim()).filter(Boolean));
  const buckets = matchUniversePoolBuckets({
    assetClass: input.assetClass,
    market: input.market,
    name: input.name,
    symbol: input.symbol,
    tags: [...tags.values(), ...input.tags]
  });
  buckets.forEach((bucket) => tags.add(getUniversePoolTag(bucket)));
  return Array.from(tags.values());
}
