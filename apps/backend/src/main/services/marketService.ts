import crypto from "node:crypto";

import type {
  GetDailyBarsInput,
  GetQuotesInput,
  GetTagMembersInput,
  GetTagSeriesInput,
  ImportHoldingsCsvInput,
  ImportPricesCsvInput,
  ListTagsInput,
  MarketDailyBar,
  MarketImportResult,
  MarketQuote,
  MarketTagSeriesPoint,
  MarketTagSeriesResult,
  SeedMarketDemoDataInput,
  SeedMarketDemoDataResult,
  TagSummary,
  TushareIngestInput
} from "@mytrader/shared";

import { parseHoldingsCsv, parsePricesCsv } from "../market/csvImport";
import { upsertDailyBasics } from "../market/dailyBasicRepository";
import {
  getDailyMoneyflowCoverage,
  upsertDailyMoneyflows
} from "../market/dailyMoneyflowRepository";
import {
  ensureInstrumentProfileTagsBackfilled,
  getInstrumentProfile,
  listInstrumentSymbolsByTag,
  searchInstrumentProfiles,
  upsertInstrumentProfiles
} from "../market/instrumentCatalogRepository";
import { upsertInstruments, upsertPrices } from "../market/marketRepository";
import { getMarketProvider } from "../market/providers";
import { config } from "../config";
import { upsertPositions } from "../storage/positionRepository";
import { upsertBaselineLedgerFromPosition } from "../storage/ledgerBaseline";
import { all, run, transaction } from "../storage/sqlite";
import type { SqliteDatabase } from "../storage/sqlite";
import { upsertWatchlistItem } from "../storage/watchlistRepository";

export async function importHoldingsCsv(
  businessDb: SqliteDatabase,
  marketDb: SqliteDatabase,
  input: ImportHoldingsCsvInput
): Promise<MarketImportResult> {
  const parsed = parseHoldingsCsv(input.filePath);

  await upsertInstruments(
    marketDb,
    parsed.rows.map((row) => ({
      symbol: row.symbol,
      name: row.name,
      assetClass: row.assetClass,
      market: row.market,
      currency: row.currency
    }))
  );

  const result = await upsertPositions(
    businessDb,
    input.portfolioId,
    parsed.rows.map((row) => ({
      portfolioId: input.portfolioId,
      symbol: row.symbol,
      name: row.name,
      assetClass: row.assetClass,
      market: row.market,
      currency: row.currency,
      quantity: row.quantity,
      cost: row.cost,
      openDate: row.openDate
    }))
  );

  for (const row of parsed.rows) {
    await upsertBaselineLedgerFromPosition(businessDb, {
      portfolioId: input.portfolioId,
      symbol: row.symbol,
      assetClass: row.assetClass,
      currency: row.currency,
      quantity: row.quantity,
      cost: row.cost,
      openDate: row.openDate
    });
  }

  return {
    inserted: result.inserted,
    updated: result.updated,
    skipped: parsed.skipped,
    warnings: parsed.warnings
  };
}

export async function importPricesCsv(
  marketDb: SqliteDatabase,
  input: ImportPricesCsvInput
): Promise<MarketImportResult> {
  const parsed = parsePricesCsv(input.filePath, input.source);
  await upsertPrices(marketDb, parsed.rows);

  return {
    inserted: parsed.rows.length,
    updated: 0,
    skipped: parsed.skipped,
    warnings: parsed.warnings
  };
}

export async function ingestTushare(
  marketDb: SqliteDatabase,
  input: TushareIngestInput,
  tokenOverride?: string | null
): Promise<MarketImportResult> {
  const token = (tokenOverride ?? config.tushareToken)?.trim() || null;
  if (!token) {
    throw new Error("未配置 Tushare token。");
  }

  await upsertInstruments(
    marketDb,
    input.items.map((item) => ({
      symbol: item.symbol,
      assetClass: item.assetClass,
      name: null,
      market: null,
      currency: null
    }))
  );

  const provider = getMarketProvider("tushare");
  const prices = await provider.fetchDailyPrices({
    token,
    items: input.items,
    startDate: input.startDate,
    endDate: input.endDate ?? null
  });

  await upsertPrices(marketDb, prices);

  return {
    inserted: prices.length,
    updated: 0,
    skipped: 0,
    warnings: []
  };
}

export async function syncTushareInstrumentCatalog(
  marketDb: SqliteDatabase,
  tokenOverride?: string | null
): Promise<MarketImportResult> {
  const token = (tokenOverride ?? config.tushareToken)?.trim() || null;
  if (!token) {
    throw new Error("未配置 Tushare token。");
  }

  const provider = getMarketProvider("tushare");
  const profiles = await provider.fetchInstrumentCatalog({ token });

  const { inserted, updated } = await upsertInstrumentProfiles(marketDb, profiles);
  await upsertInstruments(
    marketDb,
    profiles.map((profile) => ({
      symbol: profile.symbol,
      name: profile.name,
      assetClass: profile.assetClass ?? null,
      market: profile.market ?? null,
      currency: profile.currency ?? null
    }))
  );

  return { inserted, updated, skipped: 0, warnings: [] };
}

export async function searchInstrumentCatalog(
  marketDb: SqliteDatabase,
  query: string,
  limit = 50
) {
  const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
  return await searchInstrumentProfiles(marketDb, query, safeLimit);
}

export async function getInstrumentCatalogProfile(
  marketDb: SqliteDatabase,
  symbol: string
) {
  return await getInstrumentProfile(marketDb, symbol);
}

export async function listMarketTags(
  businessDb: SqliteDatabase,
  marketDb: SqliteDatabase,
  input: ListTagsInput
): Promise<TagSummary[]> {
  const query = input.query?.trim() ?? "";
  const safeLimit = Math.max(1, Math.min(500, Math.floor(input.limit ?? 200)));

  const watchlistGroups = await all<{
    group_name: string | null;
    member_count: number;
  }>(
    businessDb,
    `
      select group_name, count(*) as member_count
      from watchlist_items
      group by group_name
      order by member_count desc, group_name asc
    `
  );

  const watchlistTotal = watchlistGroups.reduce(
    (sum, row) => sum + (row.member_count ?? 0),
    0
  );

  const watchlistTags: TagSummary[] = [];
  if (watchlistTotal > 0) {
    watchlistTags.push({
      tag: "watchlist:all",
      source: "watchlist",
      memberCount: watchlistTotal
    });
  }
  watchlistGroups.forEach((row) => {
    const group = row.group_name?.trim() ? row.group_name.trim() : "default";
    watchlistTags.push({
      tag: `watchlist:${group}`,
      source: "watchlist",
      memberCount: row.member_count ?? 0
    });
  });

  const like = query ? `%${escapeLike(query)}%` : null;

  const userTags = await all<{ tag: string; member_count: number }>(
    businessDb,
    query
      ? `
          select tag, count(distinct symbol) as member_count
          from instrument_tags
          where tag like ? escape '\\'
          group by tag
          order by member_count desc, tag asc
          limit ?
        `
      : `
          select tag, count(distinct symbol) as member_count
          from instrument_tags
          group by tag
          order by member_count desc, tag asc
          limit ?
        `,
    query ? [like, safeLimit] : [safeLimit]
  );

  await ensureInstrumentProfileTagsBackfilled(marketDb);
  const providerTags = await all<{ tag: string; member_count: number }>(
    marketDb,
    query
      ? `
          select tag, count(distinct symbol) as member_count
          from instrument_profile_tags
          where tag like ? escape '\\'
          group by tag
          order by member_count desc, tag asc
          limit ?
        `
      : `
          select tag, count(distinct symbol) as member_count
          from instrument_profile_tags
          group by tag
          order by member_count desc, tag asc
          limit ?
        `,
    query ? [like, safeLimit] : [safeLimit]
  );

  const combined: TagSummary[] = [
    ...watchlistTags,
    ...userTags.map(
      (row): TagSummary => ({
      tag: row.tag,
      source: "user",
      memberCount: row.member_count ?? 0
      })
    ),
    ...providerTags.map(
      (row): TagSummary => ({
      tag: row.tag,
      source: "provider",
      memberCount: row.member_count ?? 0
      })
    )
  ].filter((row) => (query ? row.tag.includes(query) : true));

  const sourceOrder: Record<TagSummary["source"], number> = {
    watchlist: 0,
    user: 1,
    provider: 2
  };
  combined.sort((a, b) => {
    const bySource = (sourceOrder[a.source] ?? 99) - (sourceOrder[b.source] ?? 99);
    if (bySource !== 0) return bySource;
    const byCount = (b.memberCount ?? 0) - (a.memberCount ?? 0);
    if (byCount !== 0) return byCount;
    return a.tag.localeCompare(b.tag);
  });

  return combined.slice(0, safeLimit);
}

export async function getMarketTagMembers(
  businessDb: SqliteDatabase,
  marketDb: SqliteDatabase,
  input: GetTagMembersInput
): Promise<string[]> {
  const tag = input.tag.trim();
  const safeLimit = Math.max(1, Math.min(50000, Math.floor(input.limit ?? 50000)));
  if (!tag) return [];

  if (tag.startsWith("watchlist:")) {
    const group = tag.slice("watchlist:".length).trim();
    if (group === "all") {
      const rows = await all<{ symbol: string }>(
        businessDb,
        `
          select symbol
          from watchlist_items
          order by symbol asc
          limit ?
        `,
        [safeLimit]
      );
      return rows.map((row) => row.symbol);
    }

    const normalizedGroup = group ? group : "default";
    const rows = await all<{ symbol: string }>(
      businessDb,
      `
        select symbol
        from watchlist_items
        where (group_name = ?)
           or (? = 'default' and (group_name is null or group_name = ''))
        order by symbol asc
        limit ?
      `,
      [normalizedGroup, normalizedGroup, safeLimit]
    );
    return rows.map((row) => row.symbol);
  }

  const [providerSymbols, userRows] = await Promise.all([
    listInstrumentSymbolsByTag(marketDb, tag, safeLimit),
    all<{ symbol: string }>(
      businessDb,
      `
        select symbol
        from instrument_tags
        where tag = ?
        order by symbol asc
        limit ?
      `,
      [tag, safeLimit]
    )
  ]);

  const result = new Set<string>();
  providerSymbols.forEach((symbol) => result.add(symbol));
  userRows.forEach((row) => result.add(row.symbol));

  return Array.from(result.values()).sort((a, b) => a.localeCompare(b)).slice(0, safeLimit);
}

export async function getMarketQuotes(
  marketDb: SqliteDatabase,
  input: GetQuotesInput,
  tokenOverride?: string | null
): Promise<MarketQuote[]> {
  const symbols = Array.from(
    new Set(input.symbols.map((value) => value.trim()).filter(Boolean))
  ).slice(0, 5000);
  if (symbols.length === 0) return [];

  // sql.js (SQLite) can be compiled with a low host-parameter limit (often 999).
  // Chunk large IN(...) queries to avoid runtime failures like "too many SQL variables".
  const rows: {
    symbol: string;
    trade_date: string;
    close: number | null;
    rn: number;
  }[] = [];
  for (const chunk of chunkArray(symbols, SQLITE_HOST_PARAMETER_CHUNK_SIZE)) {
    const placeholders = chunk.map(() => "?").join(", ");
    const chunkRows = await all<{
      symbol: string;
      trade_date: string;
      close: number | null;
      rn: number;
    }>(
      marketDb,
      `
        select symbol, trade_date, close, rn
        from (
          select symbol, trade_date, close,
                 row_number() over (partition by symbol order by trade_date desc) as rn
          from daily_prices
          where symbol in (${placeholders})
        )
        where rn <= 2
        order by symbol asc, trade_date desc
      `,
      chunk
    );
    rows.push(...chunkRows);
  }

  const bySymbol = new Map<
    string,
    { latest?: { date: string; close: number | null }; prev?: { date: string; close: number | null } }
  >();
  rows.forEach((row) => {
    const entry = bySymbol.get(row.symbol) ?? {};
    if (row.rn === 1) entry.latest = { date: row.trade_date, close: row.close };
    if (row.rn === 2) entry.prev = { date: row.trade_date, close: row.close };
    bySymbol.set(row.symbol, entry);
  });

  const quotes: MarketQuote[] = symbols.map((symbol) => {
    const item = bySymbol.get(symbol);
    const latest = item?.latest ?? null;
    const prev = item?.prev ?? null;
    const latestClose = latest?.close ?? null;
    const prevClose = prev?.close ?? null;
    const change =
      latestClose !== null && prevClose !== null ? latestClose - prevClose : null;
    const changePct =
      change !== null && prevClose !== null && prevClose !== 0
        ? change / prevClose
        : null;

    const circMvDate = (prev?.date ?? latest?.date) ?? null;

    return {
      symbol,
      tradeDate: latest?.date ?? null,
      close: latestClose,
      prevTradeDate: prev?.date ?? null,
      prevClose,
      change,
      changePct,
      circMv: null,
      circMvDate
    } satisfies MarketQuote;
  });

  const token = (tokenOverride ?? config.tushareToken)?.trim() || null;
  const provider = token ? getMarketProvider("tushare") : null;

  const neededByDate = new Map<string, string[]>();
  quotes.forEach((quote) => {
    if (!quote.circMvDate) return;
    const list = neededByDate.get(quote.circMvDate) ?? [];
    list.push(quote.symbol);
    neededByDate.set(quote.circMvDate, list);
  });

  const circMvByKey = new Map<string, number | null>();
  for (const [date, list] of neededByDate.entries()) {
    const uniqueSymbols = Array.from(new Set(list));
    const existingMap = new Map<string, number | null>();
    for (const chunk of chunkArray(uniqueSymbols, SQLITE_HOST_PARAMETER_CHUNK_SIZE)) {
      const existing = await all<{ symbol: string; circ_mv: number | null }>(
        marketDb,
        `
          select symbol, circ_mv
          from daily_basics
          where trade_date = ?
            and symbol in (${chunk.map(() => "?").join(", ")})
        `,
        [date, ...chunk]
      );
      existing.forEach((row) => existingMap.set(row.symbol, row.circ_mv ?? null));
    }

    const missingSymbols = uniqueSymbols.filter((symbol) => !existingMap.has(symbol));
    if (missingSymbols.length > 0 && token && provider) {
      const limitedMissing = missingSymbols.slice(0, DAILY_BASICS_AUTO_FETCH_SYMBOL_CAP);
      if (missingSymbols.length > limitedMissing.length) {
        console.warn(
          `[mytrader] daily_basics auto-fetch capped: ${missingSymbols.length} -> ${limitedMissing.length} (trade_date=${date})`
        );
      }
      const fetched = await provider.fetchDailyBasics({
        token,
        symbols: limitedMissing,
        startDate: date,
        endDate: date
      });

      await upsertDailyBasics(
        marketDb,
        fetched.map((row) => ({
          symbol: row.symbol,
          tradeDate: row.tradeDate,
          circMv: row.circMv,
          totalMv: row.totalMv,
          source: "tushare"
        }))
      );

      for (const chunk of chunkArray(uniqueSymbols, SQLITE_HOST_PARAMETER_CHUNK_SIZE)) {
        const refreshed = await all<{ symbol: string; circ_mv: number | null }>(
          marketDb,
          `
            select symbol, circ_mv
            from daily_basics
            where trade_date = ?
              and symbol in (${chunk.map(() => "?").join(", ")})
          `,
          [date, ...chunk]
        );
        refreshed.forEach((row) => existingMap.set(row.symbol, row.circ_mv ?? null));
      }
    }

    uniqueSymbols.forEach((symbol) => {
      const key = `${symbol}@@${date}`;
      circMvByKey.set(key, existingMap.get(symbol) ?? null);
    });
  }

  quotes.forEach((quote) => {
    if (!quote.circMvDate) return;
    const key = `${quote.symbol}@@${quote.circMvDate}`;
    quote.circMv = circMvByKey.get(key) ?? null;
  });

  return quotes;
}

export async function getMarketDailyBars(
  marketDb: SqliteDatabase,
  input: GetDailyBarsInput,
  tokenOverride?: string | null
): Promise<MarketDailyBar[]> {
  const symbol = input.symbol.trim();
  const startDate = input.startDate.trim();
  const endDate = input.endDate.trim();
  if (!symbol || !startDate || !endDate) return [];

  const includeMoneyflow = Boolean(input.includeMoneyflow);
  if (includeMoneyflow) {
    const token = (tokenOverride ?? config.tushareToken)?.trim() || null;
    const provider = token ? getMarketProvider("tushare") : null;
    if (token && provider) {
      try {
        const counts = await all<{ count: number }>(
          marketDb,
          `
            select count(*) as count
            from daily_prices
            where symbol = ?
              and trade_date >= ?
              and trade_date <= ?
          `,
          [symbol, startDate, endDate]
        );
        const priceCount = counts[0]?.count ?? 0;
        const moneyflowCoverage = await getDailyMoneyflowCoverage(marketDb, {
          symbol,
          startDate,
          endDate
        });

        if (moneyflowCoverage.count < priceCount) {
          const fetched = await provider.fetchDailyMoneyflows({
            token,
            symbol,
            startDate,
            endDate
          });
          await upsertDailyMoneyflows(
            marketDb,
            fetched.map((row) => ({
              symbol: row.symbol,
              tradeDate: row.tradeDate,
              netMfVol: row.netMfVol,
              netMfAmount: row.netMfAmount,
              source: "tushare"
            }))
          );
        }
      } catch (err) {
        console.warn(`[mytrader] moneyflow auto-fetch failed for ${symbol}.`);
        console.warn(err);
      }
    }
  }

  const rows = await all<{
    trade_date: string;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    volume: number | null;
    net_mf_vol: number | null;
    net_mf_amount: number | null;
  }>(
    marketDb,
    `
      select p.trade_date as trade_date,
             p.open as open,
             p.high as high,
             p.low as low,
             p.close as close,
             p.volume as volume,
             mf.net_mf_vol as net_mf_vol,
             mf.net_mf_amount as net_mf_amount
      from daily_prices p
      left join daily_moneyflows mf
        on mf.symbol = p.symbol
       and mf.trade_date = p.trade_date
      where p.symbol = ?
        and p.trade_date >= ?
        and p.trade_date <= ?
      order by p.trade_date asc
    `,
    [symbol, startDate, endDate]
  );

  return rows.map((row) => ({
    date: row.trade_date,
    open: row.open ?? null,
    high: row.high ?? null,
    low: row.low ?? null,
    close: row.close ?? null,
    volume: row.volume ?? null,
    netMfVol: row.net_mf_vol ?? null,
    netMfAmount: row.net_mf_amount ?? null
  }));
}

export async function getMarketTagSeries(
  businessDb: SqliteDatabase,
  marketDb: SqliteDatabase,
  input: GetTagSeriesInput
): Promise<MarketTagSeriesResult> {
  const tag = input.tag.trim();
  const startDate = input.startDate.trim();
  const endDate = input.endDate.trim();
  if (!tag || !startDate || !endDate) {
    return {
      tag,
      startDate,
      endDate,
      memberCount: 0,
      usedMemberCount: 0,
      truncated: false,
      base: TAG_SERIES_BASE,
      weight: "prev_circ_mv_fallback_current",
      points: []
    };
  }

  const requestedLimit =
    input.memberLimit === null || input.memberLimit === undefined
      ? TAG_SERIES_MEMBER_LIMIT_DEFAULT
      : input.memberLimit;
  const safeMemberLimit = Math.min(
    Math.max(1, requestedLimit),
    TAG_SERIES_MEMBER_LIMIT_MAX
  );

  const membersAll = await getMarketTagMembers(businessDb, marketDb, {
    tag,
    limit: TAG_SERIES_MEMBER_LIMIT_TOTAL_CAP
  });
  const truncated = membersAll.length >= TAG_SERIES_MEMBER_LIMIT_TOTAL_CAP;
  const members = membersAll.slice(0, safeMemberLimit);
  const totalCount = members.length;

  if (totalCount === 0) {
    return {
      tag,
      startDate,
      endDate,
      memberCount: membersAll.length,
      usedMemberCount: 0,
      truncated,
      base: TAG_SERIES_BASE,
      weight: "prev_circ_mv_fallback_current",
      points: []
    };
  }

  type SeriesRow = {
    trade_date: string;
    value: number | null;
    weight: number | null;
  };

  const byDate = new Map<
    string,
    { sumWeight: number; sumWeighted: number; includedCount: number }
  >();

  for (const chunk of chunkArray(members, SQLITE_HOST_PARAMETER_CHUNK_SIZE)) {
    const placeholders = chunk.map(() => "?").join(", ");
    const rows = await all<SeriesRow>(
      marketDb,
      `
        with prices as (
          select symbol, trade_date, close
          from daily_prices
          where trade_date >= ?
            and trade_date <= ?
            and symbol in (${placeholders})
            and close is not null
        ),
        base as (
          select symbol, close as base_close
          from (
            select symbol, close,
                   row_number() over (partition by symbol order by trade_date asc) as rn
            from prices
          )
          where rn = 1
        ),
        basics as (
          select symbol, trade_date, circ_mv,
                 lag(circ_mv) over (partition by symbol order by trade_date asc) as prev_circ_mv
          from daily_basics
          where trade_date >= ?
            and trade_date <= ?
            and symbol in (${placeholders})
        )
        select p.trade_date as trade_date,
               case
                 when b.base_close is not null and b.base_close > 0
                   then (p.close / b.base_close) * ${TAG_SERIES_BASE}.0
                 else null
               end as value,
               coalesce(bas.prev_circ_mv, bas.circ_mv) as weight
        from prices p
        join base b on b.symbol = p.symbol
        left join basics bas on bas.symbol = p.symbol and bas.trade_date = p.trade_date
        order by p.trade_date asc
      `,
      [startDate, endDate, ...chunk, startDate, endDate, ...chunk]
    );

    rows.forEach((row) => {
      const date = row.trade_date;
      const value = row.value;
      const weight = row.weight;
      if (
        !date ||
        value === null ||
        weight === null ||
        !Number.isFinite(value) ||
        !Number.isFinite(weight) ||
        weight <= 0
      ) {
        return;
      }
      const entry = byDate.get(date) ?? {
        sumWeight: 0,
        sumWeighted: 0,
        includedCount: 0
      };
      entry.sumWeight += weight;
      entry.sumWeighted += value * weight;
      entry.includedCount += 1;
      byDate.set(date, entry);
    });
  }

  const points: MarketTagSeriesPoint[] = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, agg]) => ({
      date,
      value: agg.sumWeight > 0 ? agg.sumWeighted / agg.sumWeight : null,
      includedCount: agg.includedCount,
      totalCount,
      weightSum: agg.sumWeight > 0 ? agg.sumWeight : null
    }));

  return {
    tag,
    startDate,
    endDate,
    memberCount: membersAll.length,
    usedMemberCount: members.length,
    truncated,
    base: TAG_SERIES_BASE,
    weight: "prev_circ_mv_fallback_current",
    points
  };
}

export async function seedMarketDemoData(
  businessDb: SqliteDatabase,
  marketDb: SqliteDatabase,
  input?: SeedMarketDemoDataInput | null
): Promise<SeedMarketDemoDataResult> {
  const today = new Date();
  const warnings: string[] = [];
  const symbols = [
    "DEMO0001.CN",
    "DEMO0002.CN",
    "DEMO0003.CN",
    "DEMO0004.CN",
    "DEMO0005.CN",
    "DEMOETF01.CN"
  ];
  const tags = [
    "demo:all",
    "demo:sector:alpha",
    "demo:sector:beta",
    "demo:sector:gamma"
  ];
  const watchlistGroup = "demo";

  const profiles = [
    {
      provider: "tushare",
      kind: "stock",
      symbol: "DEMO0001.CN",
      name: "Demo Alpha 1",
      assetClass: "stock",
      market: "CN",
      currency: "CNY",
      tags: ["demo:all", "demo:sector:alpha"],
      providerData: { demo: true }
    },
    {
      provider: "tushare",
      kind: "stock",
      symbol: "DEMO0002.CN",
      name: "Demo Alpha 2",
      assetClass: "stock",
      market: "CN",
      currency: "CNY",
      tags: ["demo:all", "demo:sector:alpha"],
      providerData: { demo: true }
    },
    {
      provider: "tushare",
      kind: "stock",
      symbol: "DEMO0003.CN",
      name: "Demo Beta 1",
      assetClass: "stock",
      market: "CN",
      currency: "CNY",
      tags: ["demo:all", "demo:sector:beta"],
      providerData: { demo: true }
    },
    {
      provider: "tushare",
      kind: "stock",
      symbol: "DEMO0004.CN",
      name: "Demo Beta 2",
      assetClass: "stock",
      market: "CN",
      currency: "CNY",
      tags: ["demo:all", "demo:sector:beta"],
      providerData: { demo: true }
    },
    {
      provider: "tushare",
      kind: "stock",
      symbol: "DEMO0005.CN",
      name: "Demo Gamma 1",
      assetClass: "stock",
      market: "CN",
      currency: "CNY",
      tags: ["demo:all", "demo:sector:gamma"],
      providerData: { demo: true }
    },
    {
      provider: "tushare",
      kind: "fund",
      symbol: "DEMOETF01.CN",
      name: "Demo ETF 01",
      assetClass: "etf",
      market: "CN",
      currency: "CNY",
      tags: ["demo:all", "demo:sector:gamma"],
      providerData: { demo: true }
    }
  ] as const;

  const { inserted, updated } = await upsertInstrumentProfiles(
    marketDb,
    profiles.map((p) => ({
      provider: p.provider,
      kind: p.kind,
      symbol: p.symbol,
      name: p.name,
      assetClass: p.assetClass,
      market: p.market,
      currency: p.currency,
      tags: [...p.tags],
      providerData: p.providerData
    }))
  );

  await upsertInstruments(
    marketDb,
    profiles.map((p) => ({
      symbol: p.symbol,
      name: p.name,
      assetClass: p.assetClass,
      market: p.market,
      currency: p.currency
    }))
  );

  for (const p of profiles) {
    await upsertWatchlistItem(businessDb, {
      symbol: p.symbol,
      name: p.name,
      groupName: watchlistGroup
    });
  }

  const tradeDates = buildDemoTradeDates(today, DEMO_TRADING_DAYS_DEFAULT);
  const prices = buildDemoPrices(tradeDates, profiles);
  const basics = buildDemoDailyBasics(tradeDates, profiles);
  const moneyflows = buildDemoMoneyflows(tradeDates, profiles);

  await upsertPrices(marketDb, prices);
  await upsertDailyBasics(marketDb, basics);
  await upsertDailyMoneyflows(marketDb, moneyflows);

  const seedHoldings = input?.seedHoldings !== false;
  const portfolioId = input?.portfolioId ?? null;
  if (seedHoldings && portfolioId) {
    const rows = await all<{
      symbol: string;
      asset_class: string;
      quantity: number;
      cost: number | null;
      open_date: string | null;
    }>(
      businessDb,
      `
        select symbol, asset_class, quantity, cost, open_date
        from positions
        where portfolio_id = ?
          and quantity > 0
      `,
      [portfolioId]
    );
    const existingNonCash = rows.filter((row) => row.asset_class !== "cash");
    const existingNonDemo = existingNonCash.filter(
      (row) => !symbols.includes(row.symbol)
    );
    if (existingNonDemo.length > 0) {
      warnings.push(
        `已跳过注入示例持仓/交易：目标组合已有 ${existingNonDemo.length} 个非 demo 非现金持仓。`
      );
    } else {
      const targetHoldingSymbols = symbols
        .filter((symbol) => symbol !== "DEMOETF01.CN")
        .slice(0, 2);
      const existingHoldingSymbols = Array.from(
        new Set(existingNonCash.map((row) => row.symbol))
      );
      const holdingSymbols =
        existingHoldingSymbols.length > 0
          ? existingHoldingSymbols.slice(0, targetHoldingSymbols.length)
          : targetHoldingSymbols;
      const firstDate = tradeDates[0] ?? null;
      const firstCloseBySymbol = new Map<string, number>();
      if (firstDate) {
        prices.forEach((row) => {
          if (row.tradeDate !== firstDate) return;
          firstCloseBySymbol.set(row.symbol, row.close);
        });
      }

      if (existingHoldingSymbols.length === 0) {
        await upsertPositions(
          businessDb,
          portfolioId,
          holdingSymbols.map((symbol) => ({
            portfolioId,
            symbol,
            name: profiles.find((p) => p.symbol === symbol)?.name ?? symbol,
            assetClass: "stock",
            market: "CN",
            currency: "CNY",
            quantity: 1000,
            cost: firstCloseBySymbol.get(symbol) ?? 20,
            openDate: firstDate
          }))
        );
      }

      for (const symbol of holdingSymbols) {
        const existing = rows.find((row) => row.symbol === symbol) ?? null;
        const fallbackCost = firstCloseBySymbol.get(symbol) ?? 20;
        const existingCost = existing?.cost ?? null;
        const cost =
          existingCost !== null &&
          Number.isFinite(existingCost) &&
          existingCost > 0
            ? existingCost
            : fallbackCost;
        const existingQuantity = existing?.quantity ?? null;
        const quantity =
          existingQuantity !== null &&
          Number.isFinite(existingQuantity) &&
          existingQuantity > 0
            ? existingQuantity
            : 1000;
        const openDate = existing?.open_date ?? firstDate;
        await upsertBaselineLedgerFromPosition(businessDb, {
          portfolioId,
          symbol,
          assetClass: "stock",
          currency: "CNY",
          quantity,
          cost,
          openDate
        });
      }

      const step = 21; // ~1 month in trading days
      const startIdx = Math.min(15, Math.max(0, tradeDates.length - 1));
      await transaction(businessDb, async () => {
        const now = Date.now();
        for (let symIdx = 0; symIdx < holdingSymbols.length; symIdx += 1) {
          const symbol = holdingSymbols[symIdx]!;
          for (let idx = startIdx; idx < tradeDates.length; idx += step) {
            const date = tradeDates[idx]!;
            const isBuy = Math.floor((idx - startIdx) / step + symIdx) % 2 === 0;
            const qty = 200;
            const externalId = `demo_trade:${symbol}:${date}`;
            await run(
              businessDb,
              `
                insert into ledger_entries (
                  id, portfolio_id, account_key, event_type, trade_date, event_ts, sequence,
                  instrument_id, symbol, side, quantity, price, price_currency,
                  cash_amount, cash_currency, fee, tax, note, source, external_id, meta_json,
                  created_at, updated_at, deleted_at
                )
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                on conflict(portfolio_id, source, external_id) do nothing
              `,
              [
                crypto.randomUUID(),
                portfolioId,
                null,
                "trade",
                date,
                null,
                null,
                null,
                symbol,
                isBuy ? "buy" : "sell",
                qty,
                null,
                null,
                null,
                null,
                null,
                null,
                "demo",
                "csv",
                externalId,
                JSON.stringify({ demo: true }),
                now,
                now,
                null
              ]
            );
          }
        }
      });
    }
  }

  return {
    symbols,
    tags,
    watchlistGroup,
    tradeDateCount: tradeDates.length,
    pricesInserted: prices.length,
    dailyBasicsInserted: basics.length,
    dailyMoneyflowsInserted: moneyflows.length,
    instrumentProfilesInserted: inserted,
    instrumentProfilesUpdated: updated,
    warnings
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

const SQLITE_HOST_PARAMETER_CHUNK_SIZE = 800;
const DAILY_BASICS_AUTO_FETCH_SYMBOL_CAP = 50;
const TAG_SERIES_MEMBER_LIMIT_DEFAULT = 300;
const TAG_SERIES_MEMBER_LIMIT_MAX = 800;
const TAG_SERIES_MEMBER_LIMIT_TOTAL_CAP = 5000;
const TAG_SERIES_BASE = 100;
const DEMO_TRADING_DAYS_DEFAULT = 520;

function chunkArray<T>(values: T[], chunkSize: number): T[][] {
  if (values.length === 0) return [];
  if (chunkSize <= 0) return [values];
  const result: T[][] = [];
  for (let idx = 0; idx < values.length; idx += chunkSize) {
    result.push(values.slice(idx, idx + chunkSize));
  }
  return result;
}

function buildDemoTradeDates(endDate: Date, tradingDays: number): string[] {
  const target = Math.max(10, Math.min(2000, Math.floor(tradingDays)));
  const dates: string[] = [];
  const cursor = new Date(endDate);
  cursor.setHours(0, 0, 0, 0);

  while (dates.length < target) {
    const day = cursor.getDay(); // 0 Sun .. 6 Sat
    if (day !== 0 && day !== 6) {
      dates.push(formatIsoDate(cursor));
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  return dates.reverse();
}

function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type DemoProfile = {
  symbol: string;
  assetClass: "stock" | "etf";
};

function buildDemoPrices(
  tradeDates: string[],
  profiles: readonly DemoProfile[]
): { symbol: string; tradeDate: string; open: number; high: number; low: number; close: number; volume: number; source: "csv" }[] {
  const seedBase = 1337;
  const perSymbolState = new Map<string, { price: number; rng: () => number }>();

  profiles.forEach((profile, idx) => {
    const base = profile.assetClass === "etf" ? 3.2 : 20 + idx * 7.5;
    perSymbolState.set(profile.symbol, {
      price: base,
      rng: makeRng(`${seedBase}:${profile.symbol}`)
    });
  });

  const rows: {
    symbol: string;
    tradeDate: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    source: "csv";
  }[] = [];

  tradeDates.forEach((date, dayIdx) => {
    profiles.forEach((profile) => {
      const state = perSymbolState.get(profile.symbol)!;
      const noise = (state.rng() - 0.5) * 0.03;
      const drift = profile.assetClass === "etf" ? 0.0002 : 0.00035;
      const season = Math.sin((dayIdx / 40) * Math.PI * 2) * 0.004;
      const ret = drift + season + noise;

      const prevClose = state.price;
      const open = round2(prevClose * (1 + (state.rng() - 0.5) * 0.01));
      const close = round2(Math.max(0.2, prevClose * (1 + ret)));
      const high = round2(Math.max(open, close) * (1 + state.rng() * 0.01));
      const low = round2(Math.min(open, close) * (1 - state.rng() * 0.01));
      const baseVol = profile.assetClass === "etf" ? 8_000_000 : 2_500_000;
      const volume = Math.floor(baseVol * (0.6 + state.rng() * 0.8));

      state.price = close;
      rows.push({
        symbol: profile.symbol,
        tradeDate: date,
        open,
        high,
        low,
        close,
        volume,
        source: "csv"
      });
    });
  });

  return rows;
}

function buildDemoDailyBasics(
  tradeDates: string[],
  profiles: readonly DemoProfile[]
): { symbol: string; tradeDate: string; circMv: number; totalMv: number; source: "csv" }[] {
  const baseCaps = new Map<string, number>();
  profiles.forEach((profile, idx) => {
    const base = profile.assetClass === "etf" ? 60_000_000_000 : 120_000_000_000 + idx * 35_000_000_000;
    baseCaps.set(profile.symbol, base);
  });

  const priceByKey = new Map<string, number>();
  profiles.forEach((profile) => {
    // Seed base price for cap scaling.
    priceByKey.set(profile.symbol, profile.assetClass === "etf" ? 3.2 : 20);
  });

  // We derive circ_mv from the generated close series so that weights correlate with price moves.
  // Because this runs inside the backend, it's ok to re-run the same deterministic generator.
  const prices = buildDemoPrices(tradeDates, profiles);
  prices.forEach((row) => priceByKey.set(`${row.symbol}@@${row.tradeDate}`, row.close));

  return tradeDates.flatMap((date) =>
    profiles.map((profile) => {
      const close = priceByKey.get(`${profile.symbol}@@${date}`) ?? 1;
      const baseCap = baseCaps.get(profile.symbol) ?? 50_000_000_000;
      const scale = 0.9 + (close / 20) * 0.1;
      const circMv = Math.max(1, Math.round(baseCap * scale));
      const totalMv = Math.round(circMv * 1.25);
      return {
        symbol: profile.symbol,
        tradeDate: date,
        circMv,
        totalMv,
        source: "csv"
      };
    })
  );
}

function buildDemoMoneyflows(
  tradeDates: string[],
  profiles: readonly DemoProfile[]
): { symbol: string; tradeDate: string; netMfVol: number; netMfAmount: number; source: "csv" }[] {
  const seedBase = 4242;
  const rngBySymbol = new Map<string, () => number>();
  profiles.forEach((profile) => rngBySymbol.set(profile.symbol, makeRng(`${seedBase}:${profile.symbol}`)));

  // Reuse the same deterministic price/volume generator to align keys.
  const prices = buildDemoPrices(tradeDates, profiles);
  const byKey = new Map<string, { close: number; volume: number }>();
  prices.forEach((row) => {
    byKey.set(`${row.symbol}@@${row.tradeDate}`, { close: row.close, volume: row.volume });
  });

  return tradeDates.flatMap((date) =>
    profiles.map((profile) => {
      const key = `${profile.symbol}@@${date}`;
      const pv = byKey.get(key);
      const volume = pv?.volume ?? 0;
      const close = pv?.close ?? 1;
      const rng = rngBySymbol.get(profile.symbol) ?? Math.random;

      // 模拟：势能（净流入量）= 成交量 * [-18%, +18%]，并做一些平滑。
      const raw = (rng() - 0.5) * 0.36;
      const netMfVol = Math.round(volume * raw);
      // 金额口径：按 close 近似折算（仅用于 demo 展示，不追求精确）。
      const netMfAmount = Math.round(netMfVol * close * 100);

      return {
        symbol: profile.symbol,
        tradeDate: date,
        netMfVol,
        netMfAmount,
        source: "csv"
      };
    })
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function makeRng(seed: string): () => number {
  let state = fnv1a32(seed) >>> 0;
  return () => {
    // LCG constants from Numerical Recipes
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function fnv1a32(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
