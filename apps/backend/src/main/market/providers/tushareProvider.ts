import type { AssetClass } from "@mytrader/shared";

import type { PriceInput } from "../marketRepository";
import { fetchTushareDailyPrices } from "../tushareClient";
import { fetchTusharePaged } from "./tushareBulkFetch";
import type {
  MarketProvider,
  ProviderDailyBasic,
  ProviderDailyMoneyflow,
  ProviderInstrumentProfile,
  TradingCalendarDayInput
} from "./types";

const TUSHARE_URL = "https://api.tushare.pro";
const TUSHARE_HTTP_TIMEOUT_MS = 20_000;

type ForexWhitelistEntry = {
  symbol: string;
  name: string;
};

const FOREX_WHITELIST: ForexWhitelistEntry[] = [
  { symbol: "USDCNH.FXCM", name: "USD/CNH" },
  { symbol: "EURUSD.FXCM", name: "EUR/USD" },
  { symbol: "GBPUSD.FXCM", name: "GBP/USD" },
  { symbol: "USDJPY.FXCM", name: "USD/JPY" },
  { symbol: "AUDUSD.FXCM", name: "AUD/USD" },
  { symbol: "NZDUSD.FXCM", name: "NZD/USD" },
  { symbol: "USDCAD.FXCM", name: "USD/CAD" },
  { symbol: "USDCHF.FXCM", name: "USD/CHF" }
];

type TushareRawResponse = {
  fields: string[];
  items: (string | number | null)[][];
};

type TushareEnvelope = {
  code: number;
  msg: string;
  data?: TushareRawResponse;
};

type SwIndustryLevel = "l1" | "l2";

type SwIndustryNode = {
  code: string;
  name: string;
  level: SwIndustryLevel;
  parentCode: string | null;
};

type StockSwClassification = {
  l1Code: string | null;
  l1Name: string | null;
  l2Code: string | null;
  l2Name: string | null;
};

type SwIndexMemberRow = {
  indexCode: string;
  symbol: string;
  outDate: string | null;
  isNew: string | null;
};

type ConceptMemberRow = {
  conceptCode: string | null;
  conceptName: string | null;
  symbol: string;
  outDate: string | null;
};

const SW_CLASSIFY_SOURCES = ["SW2021", "SW"];
const SW_MEMBER_FALLBACK_CONCURRENCY = 6;
const CONCEPT_DETAIL_FALLBACK_CONCURRENCY = 6;

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
    const [
      stocksRaw,
      funds,
      indexProfiles,
      futuresProfiles,
      spotProfiles,
      forexProfiles,
      swClassificationBySymbol,
      conceptsBySymbol
    ] =
      await Promise.all([
        fetchStockBasic(input.token),
        fetchFundBasic(input.token),
        fetchOptionalCatalog("index_basic", () => fetchIndexBasic(input.token)),
        fetchOptionalCatalog("fut_basic", () => fetchFuturesBasic(input.token)),
        fetchOptionalCatalog("sge_basic", () => fetchSpotBasic(input.token)),
        Promise.resolve(fetchForexWhitelistProfiles()),
        fetchOptionalSwClassificationBySymbol(input.token),
        fetchOptionalConceptNamesBySymbol(input.token)
      ]);

    const stocks = enrichStockProfilesWithClassification(
      stocksRaw,
      swClassificationBySymbol,
      conceptsBySymbol
    );

    return [
      ...stocks,
      ...funds,
      ...indexProfiles,
      ...futuresProfiles,
      ...spotProfiles,
      ...forexProfiles
    ];
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

    const tags = buildProviderTags({
      kind: "stock",
      industry,
      board,
      exchange
    });

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

async function fetchOptionalSwClassificationBySymbol(
  token: string
): Promise<Map<string, StockSwClassification>> {
  try {
    return await fetchSwClassificationBySymbol(token);
  } catch (error) {
    console.warn(
      "[mytrader] optional sw industry classification unavailable, continue."
    );
    console.warn(error);
    return new Map();
  }
}

async function fetchSwClassificationBySymbol(
  token: string
): Promise<Map<string, StockSwClassification>> {
  const nodes = await fetchSwIndustryNodes(token);
  if (nodes.size === 0) return new Map();

  const members = await fetchSwMembersWithFallback(token, nodes);
  if (members.length === 0) return new Map();

  return buildSwClassificationBySymbol(nodes, members);
}

async function fetchSwIndustryNodes(token: string): Promise<Map<string, SwIndustryNode>> {
  const paramsList: Array<Record<string, string | undefined>> = SW_CLASSIFY_SOURCES.map(
    (src) => ({ src })
  );
  paramsList.push({});

  let lastError: unknown = null;
  for (const params of paramsList) {
    try {
      const res = await fetchTusharePaged(
        "index_classify",
        token,
        params,
        "index_code,industry_name,level,parent_code,src"
      );
      const parsed = parseSwIndustryNodes(res);
      if (parsed.size > 0) return parsed;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  return new Map();
}

function parseSwIndustryNodes(
  response: TushareRawResponse
): Map<string, SwIndustryNode> {
  const fields = response.fields ?? [];
  const rows = response.items ?? [];
  const idxCode = fields.indexOf("index_code");
  const idxName = fields.indexOf("industry_name");
  const idxLevel = fields.indexOf("level");
  const idxParentCode = fields.indexOf("parent_code");

  if (idxCode === -1 || idxName === -1 || idxLevel === -1) {
    return new Map();
  }

  const result = new Map<string, SwIndustryNode>();
  rows.forEach((row) => {
    const code = normalizeString(row[idxCode]);
    const name = normalizeString(row[idxName]);
    const level = normalizeSwIndustryLevel(row[idxLevel]);
    if (!code || !name || !level) return;
    const parentCode =
      idxParentCode === -1 ? null : normalizeString(row[idxParentCode]);

    result.set(code, {
      code,
      name,
      level,
      parentCode
    });
  });

  return result;
}

function normalizeSwIndustryLevel(
  value: string | number | null | undefined
): SwIndustryLevel | null {
  const raw = normalizeString(value)?.toUpperCase().replace(/\s+/g, "");
  if (!raw) return null;
  if (raw === "L1" || raw === "1" || raw === "SWL1") return "l1";
  if (raw === "L2" || raw === "2" || raw === "SWL2") return "l2";
  return null;
}

async function fetchSwMembersWithFallback(
  token: string,
  nodes: Map<string, SwIndustryNode>
): Promise<SwIndexMemberRow[]> {
  const allApiRows = await fetchSwMembersFromIndexMemberAll(token);
  if (allApiRows.length > 0) return allApiRows;

  const l2Codes = Array.from(nodes.values())
    .filter((item) => item.level === "l2")
    .map((item) => item.code);
  if (l2Codes.length === 0) return [];

  let failedCount = 0;
  const rowsByCode = await mapWithConcurrency(
    l2Codes,
    SW_MEMBER_FALLBACK_CONCURRENCY,
    async (indexCode) => {
      try {
        const res = await fetchTusharePaged(
          "index_member",
          token,
          { index_code: indexCode, is_new: "Y" },
          "index_code,con_code,out_date,is_new"
        );
        return parseSwIndexMemberRows(res);
      } catch {
        failedCount += 1;
        return [];
      }
    }
  );
  if (failedCount > 0) {
    console.warn(
      `[mytrader] optional sw industry fallback partial failures: ${failedCount}/${l2Codes.length}.`
    );
  }
  return rowsByCode.flat();
}

async function fetchSwMembersFromIndexMemberAll(
  token: string
): Promise<SwIndexMemberRow[]> {
  const paramsList: Array<Record<string, string | undefined>> = SW_CLASSIFY_SOURCES.map(
    (src) => ({ src, is_new: "Y" })
  );
  paramsList.push({ is_new: "Y" });

  for (const params of paramsList) {
    try {
      const res = await fetchTusharePaged(
        "index_member_all",
        token,
        params,
        "index_code,con_code,out_date,is_new"
      );
      const rows = parseSwIndexMemberRows(res);
      if (rows.length > 0) return rows;
    } catch {
      // Fallback to per-index requests below.
    }
  }

  return [];
}

function parseSwIndexMemberRows(response: TushareRawResponse): SwIndexMemberRow[] {
  const fields = response.fields ?? [];
  const rows = response.items ?? [];
  const idxIndexCode = fields.indexOf("index_code");
  const idxConCode = fields.indexOf("con_code");
  const idxOutDate = fields.indexOf("out_date");
  const idxIsNew = fields.indexOf("is_new");

  if (idxIndexCode === -1 || idxConCode === -1) return [];

  return rows
    .map((row) => {
      const indexCode = normalizeString(row[idxIndexCode]);
      const symbol = normalizeSymbol(row[idxConCode]);
      if (!indexCode || !symbol) return null;
      const outDate = idxOutDate === -1 ? null : normalizeDate(row[idxOutDate]);
      const isNew = idxIsNew === -1 ? null : normalizeString(row[idxIsNew]);
      return {
        indexCode,
        symbol,
        outDate,
        isNew
      } satisfies SwIndexMemberRow;
    })
    .filter((row): row is SwIndexMemberRow => Boolean(row));
}

function buildSwClassificationBySymbol(
  nodes: Map<string, SwIndustryNode>,
  members: SwIndexMemberRow[]
): Map<string, StockSwClassification> {
  const l1ByCode = new Map<string, SwIndustryNode>();
  nodes.forEach((node) => {
    if (node.level === "l1") {
      l1ByCode.set(node.code, node);
    }
  });

  const activeMembers = members
    .filter((item) => isSwMemberActive(item))
    .sort((a, b) => {
      if (a.symbol !== b.symbol) return a.symbol.localeCompare(b.symbol);
      return a.indexCode.localeCompare(b.indexCode);
    });

  const result = new Map<string, StockSwClassification>();
  activeMembers.forEach((item) => {
    const node = nodes.get(item.indexCode);
    if (!node) return;

    const l2Node = node.level === "l2" ? node : null;
    const l1Node =
      node.level === "l1"
        ? node
        : node.parentCode
          ? l1ByCode.get(node.parentCode) ?? null
          : null;
    const next: StockSwClassification = {
      l1Code: l1Node?.code ?? null,
      l1Name: l1Node?.name ?? null,
      l2Code: l2Node?.code ?? null,
      l2Name: l2Node?.name ?? null
    };
    if (!next.l1Name && !next.l2Name) return;

    const current = result.get(item.symbol);
    if (!current || shouldReplaceSwClassification(current, next)) {
      result.set(item.symbol, next);
    }
  });

  return result;
}

function isSwMemberActive(row: SwIndexMemberRow): boolean {
  const isNew = row.isNew?.trim().toUpperCase();
  if (isNew === "Y") return true;
  if (isNew === "N") return false;
  if (!row.outDate) return true;
  return row.outDate >= todayDate();
}

function shouldReplaceSwClassification(
  current: StockSwClassification,
  next: StockSwClassification
): boolean {
  if (!current.l2Code && next.l2Code) return true;
  if (
    current.l2Code &&
    next.l2Code &&
    current.l2Code !== next.l2Code &&
    next.l2Code.localeCompare(current.l2Code) < 0
  ) {
    return true;
  }
  if (!current.l1Code && next.l1Code) return true;
  return false;
}

async function fetchOptionalConceptNamesBySymbol(
  token: string
): Promise<Map<string, string[]>> {
  try {
    return await fetchConceptNamesBySymbol(token);
  } catch (error) {
    console.warn("[mytrader] optional concept classification unavailable, continue.");
    console.warn(error);
    return new Map();
  }
}

async function fetchConceptNamesBySymbol(token: string): Promise<Map<string, string[]>> {
  const conceptNameByCode = await fetchConceptNameByCode(token);
  const detailRows = await fetchConceptDetailRows(
    token,
    Array.from(conceptNameByCode.keys())
  );
  if (detailRows.length === 0) return new Map();

  const bySymbol = new Map<string, Set<string>>();
  detailRows.forEach((row) => {
    if (!isConceptMemberActive(row)) return;
    const conceptName =
      row.conceptName ??
      (row.conceptCode ? conceptNameByCode.get(row.conceptCode) ?? null : null);
    if (!conceptName) return;
    const set = bySymbol.get(row.symbol) ?? new Set<string>();
    set.add(conceptName);
    bySymbol.set(row.symbol, set);
  });

  const result = new Map<string, string[]>();
  bySymbol.forEach((set, symbol) => {
    const concepts = Array.from(set.values()).sort((a, b) => a.localeCompare(b));
    if (concepts.length > 0) {
      result.set(symbol, concepts);
    }
  });
  return result;
}

async function fetchConceptNameByCode(token: string): Promise<Map<string, string>> {
  try {
    const res = await fetchTusharePaged("concept", token, {}, "code,name,src");
    const fields = res.fields ?? [];
    const rows = res.items ?? [];
    const idxCode = fields.indexOf("code");
    const idxName = fields.indexOf("name");
    if (idxCode === -1 || idxName === -1) return new Map();

    const result = new Map<string, string>();
    rows.forEach((row) => {
      const code = normalizeString(row[idxCode]);
      const name = normalizeString(row[idxName]);
      if (!code || !name) return;
      result.set(code, name);
    });
    return result;
  } catch {
    return new Map();
  }
}

async function fetchConceptDetailRows(
  token: string,
  conceptCodes: string[]
): Promise<ConceptMemberRow[]> {
  let allRows: ConceptMemberRow[] | null = null;
  let fullFetchError: unknown = null;
  try {
    const res = await fetchTusharePaged(
      "concept_detail",
      token,
      {},
      "id,concept_name,ts_code,out_date"
    );
    allRows = parseConceptMemberRows(res);
    if (allRows.length > 0) return allRows;
  } catch (error) {
    fullFetchError = error;
  }

  if (fullFetchError) throw fullFetchError;
  if (conceptCodes.length === 0) return [];

  let failedCount = 0;
  const rowsByCode = await mapWithConcurrency(
    conceptCodes,
    CONCEPT_DETAIL_FALLBACK_CONCURRENCY,
    async (conceptCode) => {
      try {
        const res = await fetchTusharePaged(
          "concept_detail",
          token,
          { id: conceptCode },
          "id,concept_name,ts_code,out_date"
        );
        return parseConceptMemberRows(res);
      } catch {
        failedCount += 1;
        return [];
      }
    }
  );
  if (failedCount > 0) {
    console.warn(
      `[mytrader] optional concept detail fallback partial failures: ${failedCount}/${conceptCodes.length}.`
    );
  }

  return rowsByCode.flat();
}

function parseConceptMemberRows(response: TushareRawResponse): ConceptMemberRow[] {
  const fields = response.fields ?? [];
  const rows = response.items ?? [];
  const idxConceptCode = fields.indexOf("id");
  const idxConceptName = fields.indexOf("concept_name");
  const idxSymbol = fields.indexOf("ts_code");
  const idxOutDate = fields.indexOf("out_date");
  if (idxSymbol === -1) return [];

  return rows
    .map((row) => {
      const symbol = normalizeSymbol(row[idxSymbol]);
      if (!symbol) return null;
      const conceptCode =
        idxConceptCode === -1 ? null : normalizeString(row[idxConceptCode]);
      const conceptName =
        idxConceptName === -1 ? null : normalizeString(row[idxConceptName]);
      const outDate = idxOutDate === -1 ? null : normalizeDate(row[idxOutDate]);
      return {
        conceptCode,
        conceptName,
        symbol,
        outDate
      } satisfies ConceptMemberRow;
    })
    .filter((row): row is ConceptMemberRow => Boolean(row));
}

function isConceptMemberActive(row: ConceptMemberRow): boolean {
  if (!row.outDate) return true;
  return row.outDate >= todayDate();
}

function enrichStockProfilesWithClassification(
  profiles: ProviderInstrumentProfile[],
  swClassificationBySymbol: Map<string, StockSwClassification>,
  conceptsBySymbol: Map<string, string[]>
): ProviderInstrumentProfile[] {
  if (profiles.length === 0) return profiles;

  return profiles.map((profile) => {
    const symbol = profile.symbol.trim().toUpperCase();
    const swIndustry = swClassificationBySymbol.get(symbol);
    const concepts = conceptsBySymbol.get(symbol) ?? [];
    if (!swIndustry && concepts.length === 0) {
      return profile;
    }

    const tags = new Set(profile.tags.map((item) => item.trim()).filter(Boolean));
    if (swIndustry?.l1Name) {
      tags.add(`ind:sw:l1:${swIndustry.l1Name}`);
    }
    if (swIndustry?.l2Name) {
      tags.add(`ind:sw:l2:${swIndustry.l2Name}`);
    }
    concepts.forEach((concept) => {
      tags.add(`concept:${concept}`);
      tags.add(`theme:ths:${concept}`);
    });

    const providerData = {
      ...(profile.providerData ?? {})
    } as Record<string, unknown>;
    if (swIndustry) {
      providerData.swIndustry = {
        l1Code: swIndustry.l1Code,
        l1Name: swIndustry.l1Name,
        l2Code: swIndustry.l2Code,
        l2Name: swIndustry.l2Name
      };
    }
    if (concepts.length > 0) {
      providerData.concepts = concepts;
    }

    return {
      ...profile,
      tags: Array.from(tags.values()).sort((a, b) => a.localeCompare(b)),
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

    const tags = buildProviderTags({
      kind: "fund",
      fund_type: fundType,
      invest_type: investType,
      type,
      market
    });

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

async function fetchIndexBasic(
  token: string
): Promise<ProviderInstrumentProfile[]> {
  const res = await callTushare(
    "index_basic",
    token,
    {},
    "ts_code,name,market,publisher,category,base_date,list_date,exp_date"
  );

  const fields = res.fields ?? [];
  const rows = res.items ?? [];
  const idxTsCode = fields.indexOf("ts_code");
  if (idxTsCode === -1) {
    throw new Error("Tushare index_basic 响应缺少 ts_code。");
  }

  const idxName = fields.indexOf("name");
  const idxMarket = fields.indexOf("market");
  const idxPublisher = fields.indexOf("publisher");
  const idxCategory = fields.indexOf("category");
  const idxBaseDate = fields.indexOf("base_date");
  const idxListDate = fields.indexOf("list_date");
  const idxExpDate = fields.indexOf("exp_date");

  return rows.map((row) => {
    const symbol = String(row[idxTsCode]);
    const name = idxName === -1 ? null : normalizeString(row[idxName]);
    const market = idxMarket === -1 ? null : normalizeString(row[idxMarket]);
    const publisher = idxPublisher === -1 ? null : normalizeString(row[idxPublisher]);
    const category = idxCategory === -1 ? null : normalizeString(row[idxCategory]);
    const baseDate = idxBaseDate === -1 ? null : normalizeDate(row[idxBaseDate]);
    const listDate = idxListDate === -1 ? null : normalizeDate(row[idxListDate]);
    const expDate = idxExpDate === -1 ? null : normalizeDate(row[idxExpDate]);

    const providerData: Record<string, unknown> = {
      kind: "index_basic",
      raw: buildRowObject(fields, row),
      publisher,
      category,
      baseDate,
      listDate,
      expDate
    };

    const tags = buildProviderTags({
      kind: "index",
      market,
      publisher,
      category
    });

    return {
      provider: "tushare",
      kind: "index",
      symbol,
      name,
      assetClass: null,
      market: "CN",
      currency: "CNY",
      tags,
      providerData
    } satisfies ProviderInstrumentProfile;
  });
}

async function fetchFuturesBasic(
  token: string
): Promise<ProviderInstrumentProfile[]> {
  const exchanges = ["CFFEX", "SHFE", "DCE", "CZCE", "INE", "GFEX"];
  const profiles: ProviderInstrumentProfile[] = [];
  const seenSymbols = new Set<string>();

  for (const exchangeParam of exchanges) {
    const res = await callTushare(
      "fut_basic",
      token,
      { exchange: exchangeParam },
      "ts_code,symbol,exchange,name,fut_code,multiplier,trade_unit,quote_unit,list_date,delist_date"
    );

    const fields = res.fields ?? [];
    const rows = res.items ?? [];
    const idxTsCode = fields.indexOf("ts_code");
    if (idxTsCode === -1) {
      throw new Error("Tushare fut_basic 响应缺少 ts_code。");
    }

    const idxName = fields.indexOf("name");
    const idxExchange = fields.indexOf("exchange");
    const idxFutCode = fields.indexOf("fut_code");
    const idxMultiplier = fields.indexOf("multiplier");
    const idxTradeUnit = fields.indexOf("trade_unit");
    const idxQuoteUnit = fields.indexOf("quote_unit");
    const idxListDate = fields.indexOf("list_date");
    const idxDelistDate = fields.indexOf("delist_date");

    for (const row of rows) {
      const symbol = String(row[idxTsCode]);
      if (!symbol || seenSymbols.has(symbol)) continue;
      seenSymbols.add(symbol);

      const name = idxName === -1 ? null : normalizeString(row[idxName]);
      const exchange =
        idxExchange === -1 ? exchangeParam : normalizeString(row[idxExchange]);
      const futCode = idxFutCode === -1 ? null : normalizeString(row[idxFutCode]);
      const multiplier =
        idxMultiplier === -1 ? null : normalizeNumber(row[idxMultiplier]);
      const tradeUnit =
        idxTradeUnit === -1 ? null : normalizeString(row[idxTradeUnit]);
      const quoteUnit =
        idxQuoteUnit === -1 ? null : normalizeString(row[idxQuoteUnit]);
      const listDate =
        idxListDate === -1 ? null : normalizeDate(row[idxListDate]);
      const delistDate =
        idxDelistDate === -1 ? null : normalizeDate(row[idxDelistDate]);

      const providerData: Record<string, unknown> = {
        kind: "fut_basic",
        raw: buildRowObject(fields, row),
        exchange,
        futCode,
        multiplier,
        tradeUnit,
        quoteUnit,
        listDate,
        delistDate
      };

      const tags = buildProviderTags({
        kind: "futures",
        exchange,
        fut_code: futCode
      });

      profiles.push({
        provider: "tushare",
        kind: "futures",
        symbol,
        name,
        assetClass: null,
        market: "CN",
        currency: "CNY",
        tags,
        providerData
      } satisfies ProviderInstrumentProfile);
    }
  }

  return profiles;
}

async function fetchSpotBasic(token: string): Promise<ProviderInstrumentProfile[]> {
  const res = await callTushare(
    "sge_basic",
    token,
    {},
    "ts_code,ts_name,trade_type,t_unit,p_unit,min_change,price_limit,min_vol,max_vol,trade_mode"
  );

  const fields = res.fields ?? [];
  const rows = res.items ?? [];
  const idxTsCode = fields.indexOf("ts_code");
  if (idxTsCode === -1) {
    throw new Error("Tushare sge_basic 响应缺少 ts_code。");
  }

  const idxName = fields.indexOf("ts_name");
  const idxTradeType = fields.indexOf("trade_type");
  const idxTradeUnit = fields.indexOf("t_unit");
  const idxPriceUnit = fields.indexOf("p_unit");
  const idxTradeMode = fields.indexOf("trade_mode");

  return rows.map((row) => {
    const symbol = String(row[idxTsCode]);
    const name = idxName === -1 ? null : normalizeString(row[idxName]);
    const tradeType =
      idxTradeType === -1 ? null : normalizeString(row[idxTradeType]);
    const tradeUnit =
      idxTradeUnit === -1 ? null : normalizeString(row[idxTradeUnit]);
    const priceUnit =
      idxPriceUnit === -1 ? null : normalizeString(row[idxPriceUnit]);
    const tradeMode =
      idxTradeMode === -1 ? null : normalizeString(row[idxTradeMode]);

    const providerData: Record<string, unknown> = {
      kind: "sge_basic",
      raw: buildRowObject(fields, row),
      tradeType,
      tradeUnit,
      priceUnit,
      tradeMode
    };

    const tags = buildProviderTags({
      kind: "spot",
      exchange: "SGE",
      trade_type: tradeType,
      trade_mode: tradeMode
    });

    return {
      provider: "tushare",
      kind: "spot",
      symbol,
      name,
      assetClass: null,
      market: "CN",
      currency: "CNY",
      tags,
      providerData
    } satisfies ProviderInstrumentProfile;
  });
}

async function fetchOptionalCatalog(
  apiName: string,
  run: () => Promise<ProviderInstrumentProfile[]>
): Promise<ProviderInstrumentProfile[]> {
  try {
    return await run();
  } catch (error) {
    console.warn(`[mytrader] optional catalog ${apiName} unavailable, continue.`);
    console.warn(error);
    return [];
  }
}

async function callTushare(
  apiName: string,
  token: string,
  params: Record<string, string | undefined>,
  fields: string
): Promise<TushareRawResponse> {
  const body = { api_name: apiName, token, params, fields };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TUSHARE_HTTP_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(TUSHARE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(`Tushare 请求超时（>${TUSHARE_HTTP_TIMEOUT_MS}ms）。`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new Error(`Tushare 请求失败，状态码 ${res.status}。`);
  }

  const json = (await res.json()) as TushareEnvelope;
  if (json.code !== 0) {
    throw new Error(`Tushare 返回错误：${json.msg || "未知错误"}`);
  }
  return json.data ?? { fields: [], items: [] };
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" ||
      error.message.toLowerCase().includes("aborted"))
  );
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

function normalizeSymbol(value: string | number | null | undefined): string | null {
  const normalized = normalizeString(value);
  return normalized ? normalized.toUpperCase() : null;
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

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function mapMarketToTushareExchange(market: string): string {
  if (market === "CN") return "SSE";
  return "SSE";
}

function fetchForexWhitelistProfiles(): ProviderInstrumentProfile[] {
  return FOREX_WHITELIST.map((entry) => {
    const { baseCurrency, quoteCurrency, venue } = parseForexSymbol(entry.symbol);
    const providerData: Record<string, unknown> = {
      kind: "fx_whitelist",
      baseCurrency,
      quoteCurrency,
      venue
    };
    const tags = buildProviderTags({
      kind: "forex",
      venue,
      base_currency: baseCurrency,
      quote_currency: quoteCurrency
    });

    return {
      provider: "tushare",
      kind: "forex",
      symbol: entry.symbol,
      name: entry.name,
      assetClass: null,
      market: "FX",
      currency: quoteCurrency ?? "USD",
      tags,
      providerData
    } satisfies ProviderInstrumentProfile;
  });
}

function parseForexSymbol(symbol: string): {
  baseCurrency: string | null;
  quoteCurrency: string | null;
  venue: string | null;
} {
  const [pairRaw, venueRaw] = symbol.split(".", 2);
  const pair = (pairRaw ?? "").trim().toUpperCase();
  const venue = venueRaw ? venueRaw.trim().toUpperCase() : null;

  if (pair.length < 6) {
    return {
      baseCurrency: null,
      quoteCurrency: null,
      venue
    };
  }
  return {
    baseCurrency: pair.slice(0, 3),
    quoteCurrency: pair.slice(3, 6),
    venue
  };
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

async function mapWithConcurrency<TItem, TResult>(
  items: TItem[],
  concurrency: number,
  mapper: (item: TItem, index: number) => Promise<TResult>
): Promise<TResult[]> {
  if (items.length === 0) return [];
  const safeConcurrency = Math.max(1, Math.floor(concurrency));
  const results: TResult[] = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(safeConcurrency, items.length) }).map(
    async () => {
      while (true) {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) return;
        results[index] = await mapper(items[index], index);
      }
    }
  );

  await Promise.all(workers);
  return results;
}
