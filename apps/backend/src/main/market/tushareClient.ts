import type { AssetClass } from "@mytrader/shared";

import type { PriceInput } from "./marketRepository";

const TUSHARE_URL = "https://api.tushare.pro";

interface TushareResponse {
  code: number;
  msg: string;
  data?: {
    fields: string[];
    items: (string | number | null)[][];
  };
}

export async function fetchTushareDailyPrices(
  token: string,
  items: { symbol: string; assetClass: AssetClass }[],
  startDate: string,
  endDate?: string | null
): Promise<PriceInput[]> {
  const start = toTushareDate(startDate);
  const end = endDate ? toTushareDate(endDate) : undefined;
  const results: PriceInput[] = [];

  for (const item of items) {
    const apiName = item.assetClass === "etf" ? "fund_daily" : "daily";
    const response = await callTushare(apiName, token, {
      ts_code: item.symbol,
      start_date: start,
      end_date: end
    });

    const fields = response.data?.fields ?? [];
    const rows = response.data?.items ?? [];

    const idxTsCode = fields.indexOf("ts_code");
    const idxTradeDate = fields.indexOf("trade_date");
    const idxOpen = fields.indexOf("open");
    const idxHigh = fields.indexOf("high");
    const idxLow = fields.indexOf("low");
    const idxClose = fields.indexOf("close");
    const idxVol = fields.indexOf("vol");

    if (idxTsCode === -1 || idxTradeDate === -1 || idxClose === -1) {
      throw new Error(`Tushare 响应缺少必要字段：${item.symbol}。`);
    }

    for (const row of rows) {
      const tradeDate = normalizeDate(row[idxTradeDate]);
      if (!tradeDate) continue;

      results.push({
        symbol: String(row[idxTsCode]),
        tradeDate,
        open: toNumber(row[idxOpen]),
        high: toNumber(row[idxHigh]),
        low: toNumber(row[idxLow]),
        close: toNumber(row[idxClose]),
        volume: toNumber(row[idxVol]),
        source: "tushare"
      });
    }
  }

  return results;
}

async function callTushare(
  apiName: string,
  token: string,
  params: Record<string, string | undefined>
): Promise<TushareResponse> {
  const body = {
    api_name: apiName,
    token,
    params,
    fields: "ts_code,trade_date,open,high,low,close,vol"
  };

  const res = await fetch(TUSHARE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error(`Tushare 请求失败，状态码 ${res.status}。`);
  }

  const json = (await res.json()) as TushareResponse;
  if (json.code !== 0) {
    throw new Error(`Tushare 返回错误：${json.msg || "未知错误"}`);
  }

  return json;
}

function toTushareDate(value: string): string {
  return value.replace(/-/g, "");
}

function normalizeDate(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return null;
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}
