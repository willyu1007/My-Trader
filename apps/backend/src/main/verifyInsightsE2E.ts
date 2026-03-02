import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  computeValuationBySymbol,
  createInsight,
  deleteValuationSubjectiveOverride,
  excludeInsightTarget,
  getValuationObjectiveRefreshStatus,
  listValuationMethods,
  listValuationObjectiveMetricSnapshots,
  previewMaterializeInsightTargets,
  previewValuationBySymbol,
  removeInsight,
  searchInsights,
  triggerValuationObjectiveRefresh,
  unexcludeInsightTarget,
  updateInsight,
  upsertInsightEffectChannel,
  upsertInsightEffectPoint,
  upsertInsightScopeRule,
  upsertValuationSubjectiveDefault,
  upsertValuationSubjectiveOverride
} from "./services/insightService";
import { ensureMarketCacheSchema } from "./market/marketCache";
import { ensureBusinessSchema } from "./storage/businessSchema";
import { close, openSqliteDatabase, run } from "./storage/sqlite";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function approxEqual(left: number, right: number, tolerance = 1e-9): boolean {
  return Math.abs(left - right) <= tolerance;
}

function buildTempPath(prefix: string): string {
  return path.join(
    os.tmpdir(),
    `mytrader-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`
  );
}

async function seedMarketData(marketDbPath: string, businessDbPath: string): Promise<void> {
  const marketDb = await openSqliteDatabase(marketDbPath);
  const businessDb = await openSqliteDatabase(businessDbPath);
  try {
    await ensureMarketCacheSchema(marketDb);
    await ensureBusinessSchema(businessDb);
    const now = Date.now();

    const profiles = [
      {
        symbol: "600519.SH",
        provider: "tushare",
        kind: "stock",
        assetClass: "stock",
        market: "CN",
        currency: "CNY",
        tags: ["kind:stock", "market:CN", "sector:consumer"]
      },
      {
        symbol: "AU9999.SGE",
        provider: "tushare",
        kind: "spot",
        assetClass: "spot",
        market: "CN",
        currency: "CNY",
        tags: ["kind:spot", "commodity:gold", "domain:spot"]
      },
      {
        symbol: "510300.SH",
        provider: "tushare",
        kind: "fund",
        assetClass: "etf",
        market: "CN",
        currency: "CNY",
        tags: ["kind:fund", "domain:etf", "market:CN"]
      },
      {
        symbol: "IF8888.CFE",
        provider: "tushare",
        kind: "futures",
        assetClass: "futures",
        market: "CN",
        currency: "CNY",
        tags: ["kind:futures", "domain:futures", "market:CN"]
      },
      {
        symbol: "USDCNY.FX",
        provider: "tushare",
        kind: "forex",
        assetClass: null,
        market: "FX",
        currency: "CNY",
        tags: ["kind:forex", "domain:fx", "market:FX"]
      },
      {
        symbol: "CGB10Y.CN",
        provider: "tushare",
        kind: "index",
        assetClass: null,
        market: "CN",
        currency: "CNY",
        tags: ["kind:bond", "domain:bond"]
      }
    ] as const;

    for (const profile of profiles) {
      await run(
        marketDb,
        `
          insert into instrument_profiles (
            symbol, provider, kind, name, asset_class, market, currency,
            tags_json, provider_data_json, created_at, updated_at
          )
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          profile.symbol,
          profile.provider,
          profile.kind,
          profile.symbol,
          profile.assetClass,
          profile.market,
          profile.currency,
          JSON.stringify(profile.tags),
          "{}",
          now,
          now
        ]
      );
      for (const tag of profile.tags) {
        await run(
          marketDb,
          `
            insert into instrument_profile_tags (tag, symbol)
            values (?, ?)
          `,
          [tag, profile.symbol]
        );
      }
    }

    const dailyPrices = [
      ["600519.SH", "2026-01-01", 100],
      ["600519.SH", "2026-01-06", 110],
      ["600519.SH", "2026-01-11", 120],
      ["AU9999.SGE", "2026-01-01", 450],
      ["AU9999.SGE", "2026-01-06", 460],
      ["510300.SH", "2026-01-01", 4.2],
      ["510300.SH", "2026-01-06", 4.4],
      ["IF8888.CFE", "2026-01-01", 3500],
      ["IF8888.CFE", "2026-01-06", 3600],
      ["USDCNY.FX", "2026-01-01", 7.1],
      ["USDCNY.FX", "2026-01-06", 7.2],
      ["CGB10Y.CN", "2026-01-01", 100],
      ["CGB10Y.CN", "2026-01-06", 100]
    ] as const;
    for (const [symbol, tradeDate, closePrice] of dailyPrices) {
      await run(
        marketDb,
        `
          insert into daily_prices (
            symbol, trade_date, open, high, low, close, volume, source, ingested_at
          )
          values (?, ?, ?, ?, ?, ?, ?, 'verify', ?)
        `,
        [symbol, tradeDate, closePrice, closePrice, closePrice, closePrice, 1_000, now]
      );
    }

    await run(
      marketDb,
      `
        insert into daily_basics (
          symbol, trade_date, circ_mv, total_mv, pe_ttm, pb, ps_ttm, ev_ebitda_ttm, ev_sales_ttm, dv_ttm, turnover_rate, source, ingested_at
        )
        values ('600519.SH', '2026-01-06', 2000000, 3000000, 22, 4.4, 6.6, 11, 4.2, 0.03, 1.5, 'verify', ?)
      `,
      [now]
    );
    await run(
      marketDb,
      `
        insert into daily_basics (
          symbol, trade_date, circ_mv, total_mv, pe_ttm, pb, ps_ttm, ev_ebitda_ttm, ev_sales_ttm, dv_ttm, turnover_rate, source, ingested_at
        )
        values ('510300.SH', '2026-01-06', 5000000, 5200000, 16, 1.8, 2.4, 13, 3.1, 0.018, 2.2, 'verify', ?)
      `,
      [now]
    );

    await run(
      businessDb,
      `
        insert into watchlist_items (
          id, symbol, name, group_name, note, created_at, updated_at
        )
        values (?, '600519.SH', 'Moutai', 'core', null, ?, ?)
      `,
      ["watchlist-600519", now, now]
    );
  } finally {
    await close(marketDb);
    await close(businessDb);
  }
}

async function runSmokeE2E(): Promise<void> {
  const businessDbPath = buildTempPath("insights-e2e-business");
  const marketDbPath = buildTempPath("insights-e2e-market");

  let businessDb = await openSqliteDatabase(businessDbPath);
  let marketDb = await openSqliteDatabase(marketDbPath);
  try {
    await ensureBusinessSchema(businessDb);
    await ensureMarketCacheSchema(marketDb);
    await close(businessDb);
    await close(marketDb);

    await seedMarketData(marketDbPath, businessDbPath);

    businessDb = await openSqliteDatabase(businessDbPath);
    marketDb = await openSqliteDatabase(marketDbPath);

    const valuationMethods = await listValuationMethods(businessDb, {
      includeArchived: true,
      includeBuiltin: true,
      limit: 100
    });
    assert(
      valuationMethods.items.length >= 25,
      "expected expanded builtin valuation methods to be seeded"
    );
    assert(
      valuationMethods.items.some((item) => item.methodKey === "builtin.stock.pe.relative.v1"),
      "expected stock PE builtin method"
    );
    assert(
      valuationMethods.items.some((item) => item.methodKey === "builtin.etf.pe.relative.v1"),
      "expected etf PE builtin method"
    );
    assert(
      valuationMethods.items.some((item) => item.methodKey === "builtin.futures.term.structure.v1"),
      "expected futures method expansion"
    );
    assert(
      valuationMethods.items.some((item) => item.methodKey === "builtin.forex.rate.differential.v1"),
      "expected forex method expansion"
    );
    assert(
      valuationMethods.items.some((item) => item.methodKey === "builtin.bond.spread.duration.v1"),
      "expected bond method expansion"
    );

    const refreshRun = await triggerValuationObjectiveRefresh(businessDb, marketDb, {
      symbols: ["600519.SH"],
      asOfDate: "2026-01-06",
      reason: "verify-v2"
    });
    assert(
      refreshRun.status === "success" || refreshRun.status === "partial",
      `unexpected refresh status: ${refreshRun.status}`
    );
    const refreshStatus = await getValuationObjectiveRefreshStatus(businessDb, {
      runId: refreshRun.runId
    });
    assert(
      refreshStatus?.runId === refreshRun.runId,
      "refresh status should be queryable by run id"
    );

    const objectiveSnapshots = await listValuationObjectiveMetricSnapshots(businessDb, {
      symbol: "600519.SH",
      asOfDate: "2026-01-06"
    });
    assert(
      objectiveSnapshots.some((item) => item.metricKey === "valuation.pe_ttm"),
      "objective snapshots should include pe_ttm"
    );
    assert(
      objectiveSnapshots.some((item) => item.metricKey === "valuation.ev_ebitda_ttm"),
      "objective snapshots should include ev_ebitda_ttm"
    );

    await upsertValuationSubjectiveDefault(businessDb, {
      methodKey: "builtin.stock.pe.relative.v1",
      inputKey: "targetPe",
      market: "CN",
      value: 24,
      source: "verify-default"
    });
    const stockAutoPreview = await computeValuationBySymbol(businessDb, marketDb, {
      symbol: "600519.SH",
      asOfDate: "2026-01-06"
    });
    assert(
      stockAutoPreview.methodKey === "builtin.stock.pe.relative.v1",
      `stock default method should route to builtin.stock.pe.relative.v1, got ${stockAutoPreview.methodKey}`
    );
    const stockPeWithDefault = await computeValuationBySymbol(businessDb, marketDb, {
      symbol: "600519.SH",
      asOfDate: "2026-01-06",
      methodKey: "builtin.stock.pe.relative.v1"
    });
    assert(!stockPeWithDefault.notApplicable, "stock PE compute should be applicable");
    assert(
      approxEqual(stockPeWithDefault.baseValue ?? 0, 120, 1e-6),
      `stock PE with default should be 120, got ${stockPeWithDefault.baseValue}`
    );
    assert(
      stockPeWithDefault.confidence === "high",
      `stock PE with fresh inputs should be high confidence, got ${stockPeWithDefault.confidence}`
    );

    await upsertValuationSubjectiveDefault(businessDb, {
      methodKey: "builtin.stock.ev_ebitda.relative.v1",
      inputKey: "targetEvEbitda",
      market: "CN",
      value: 13,
      source: "verify-default"
    });
    const stockEvEbitdaPreview = await computeValuationBySymbol(businessDb, marketDb, {
      symbol: "600519.SH",
      asOfDate: "2026-01-06",
      methodKey: "builtin.stock.ev_ebitda.relative.v1"
    });
    assert(!stockEvEbitdaPreview.notApplicable, "stock EV/EBITDA compute should be applicable");
    assert(
      approxEqual(stockEvEbitdaPreview.baseValue ?? 0, 130, 1e-6),
      `stock EV/EBITDA base value should follow target/ev_ebitda_ttm ratio, got ${stockEvEbitdaPreview.baseValue}`
    );

    await upsertValuationSubjectiveOverride(businessDb, {
      symbol: "600519.SH",
      methodKey: "builtin.stock.pe.relative.v1",
      inputKey: "targetPe",
      value: 30,
      note: "verify override"
    });
    const stockPeWithOverride = await computeValuationBySymbol(businessDb, marketDb, {
      symbol: "600519.SH",
      asOfDate: "2026-01-06",
      methodKey: "builtin.stock.pe.relative.v1"
    });
    assert(
      approxEqual(stockPeWithOverride.baseValue ?? 0, 150, 1e-6),
      `stock PE with override should be 150, got ${stockPeWithOverride.baseValue}`
    );
    assert(
      stockPeWithOverride.inputBreakdown?.some(
        (item) => item.key === "targetPe" && item.source === "subjective.override"
      ),
      "input breakdown should indicate subjective override source"
    );

    await deleteValuationSubjectiveOverride(businessDb, {
      symbol: "600519.SH",
      methodKey: "builtin.stock.pe.relative.v1",
      inputKey: "targetPe"
    });
    const stockPeAfterOverrideDelete = await computeValuationBySymbol(businessDb, marketDb, {
      symbol: "600519.SH",
      asOfDate: "2026-01-06",
      methodKey: "builtin.stock.pe.relative.v1"
    });
    assert(
      approxEqual(stockPeAfterOverrideDelete.baseValue ?? 0, 120, 1e-6),
      `stock PE after override deletion should fallback to default 120, got ${stockPeAfterOverrideDelete.baseValue}`
    );

    const stockPeStale = await computeValuationBySymbol(businessDb, marketDb, {
      symbol: "600519.SH",
      asOfDate: "2026-01-11",
      methodKey: "builtin.stock.pe.relative.v1"
    });
    assert(
      stockPeStale.confidence === "medium",
      `stale objective input should lower confidence to medium, got ${stockPeStale.confidence}`
    );
    assert(
      stockPeStale.degradationReasons?.some((reason) => reason.includes("stale")),
      "stale valuation should carry degradation reason"
    );

    const legacyStockPePreview = await previewValuationBySymbol(businessDb, marketDb, {
      symbol: "600519.SH",
      asOfDate: "2026-01-06",
      methodKey: "builtin.stock.pe.relative.v1"
    });
    assert(
      approxEqual(
        legacyStockPePreview.baseValue ?? 0,
        stockPeAfterOverrideDelete.baseValue ?? 0,
        1e-6
      ),
      "legacy preview API should remain compatible with compute API"
    );

    const etfPreview = await computeValuationBySymbol(businessDb, marketDb, {
      symbol: "510300.SH",
      asOfDate: "2026-01-06"
    });
    assert(
      etfPreview.methodKey === "builtin.etf.pe.relative.v1",
      `ETF default method should route to builtin.etf.pe.relative.v1, got ${etfPreview.methodKey}`
    );
    assert(etfPreview.notApplicable === false, "ETF preview should be applicable");
    assert(
      etfPreview.baseValue !== null,
      "ETF preview should produce base value"
    );
    const etfTargetPe =
      etfPreview.inputBreakdown?.find((item) => item.key === "targetPe")?.value ?? null;
    assert(etfTargetPe !== null, "ETF preview should include targetPe input");
    const etfExpectedBase = 4.4 * (etfTargetPe / 16);
    assert(
      approxEqual(etfPreview.baseValue ?? 0, etfExpectedBase, 1e-6),
      `ETF PE base value should follow targetPe/pe_ttm ratio, got ${etfPreview.baseValue}`
    );

    const futuresPreview = await computeValuationBySymbol(businessDb, marketDb, {
      symbol: "IF8888.CFE",
      asOfDate: "2026-01-06",
      methodKey: "builtin.futures.term.structure.v1"
    });
    assert(
      futuresPreview.methodKey === "builtin.futures.term.structure.v1",
      "futures term structure method should be runnable"
    );
    assert(
      futuresPreview.baseValue !== null && futuresPreview.notApplicable === false,
      "futures term structure should produce applicable valuation"
    );

    const spotMeanReversionPreview = await computeValuationBySymbol(businessDb, marketDb, {
      symbol: "AU9999.SGE",
      asOfDate: "2026-01-06",
      methodKey: "builtin.spot.mean.reversion.v1"
    });
    assert(
      spotMeanReversionPreview.methodKey === "builtin.spot.mean.reversion.v1",
      "spot mean reversion method should be runnable"
    );
    assert(
      spotMeanReversionPreview.baseValue !== null && spotMeanReversionPreview.notApplicable === false,
      "spot mean reversion should produce applicable valuation"
    );

    const forexRateDiffPreview = await computeValuationBySymbol(businessDb, marketDb, {
      symbol: "USDCNY.FX",
      asOfDate: "2026-01-06",
      methodKey: "builtin.forex.rate.differential.v1"
    });
    assert(
      forexRateDiffPreview.methodKey === "builtin.forex.rate.differential.v1",
      "forex rate differential method should be runnable"
    );
    assert(
      forexRateDiffPreview.baseValue !== null && forexRateDiffPreview.notApplicable === false,
      "forex rate differential should produce applicable valuation"
    );

    const bondSpreadPreview = await computeValuationBySymbol(businessDb, marketDb, {
      symbol: "CGB10Y.CN",
      asOfDate: "2026-01-06",
      methodKey: "builtin.bond.spread.duration.v1"
    });
    assert(
      bondSpreadPreview.methodKey === "builtin.bond.spread.duration.v1",
      "bond spread-duration method should be runnable"
    );
    assert(
      bondSpreadPreview.baseValue !== null && bondSpreadPreview.notApplicable === false,
      "bond spread-duration should produce applicable valuation"
    );

    const scopeInsight = await createInsight(businessDb, {
      title: "Scope fan-out verify",
      thesis: "验证 scope 类型展开能力",
      status: "active",
      validFrom: "2026-01-01",
      validTo: "2026-12-31",
      tags: ["scope", "smoke"]
    });
    await upsertInsightScopeRule(businessDb, {
      insightId: scopeInsight.id,
      scopeType: "symbol",
      scopeKey: "600519.SH",
      mode: "include"
    });
    await upsertInsightScopeRule(businessDb, {
      insightId: scopeInsight.id,
      scopeType: "tag",
      scopeKey: "commodity:gold",
      mode: "include"
    });
    await upsertInsightScopeRule(businessDb, {
      insightId: scopeInsight.id,
      scopeType: "kind",
      scopeKey: "stock",
      mode: "include"
    });
    await upsertInsightScopeRule(businessDb, {
      insightId: scopeInsight.id,
      scopeType: "asset_class",
      scopeKey: "spot",
      mode: "include"
    });
    await upsertInsightScopeRule(businessDb, {
      insightId: scopeInsight.id,
      scopeType: "market",
      scopeKey: "CN",
      mode: "include"
    });
    await upsertInsightScopeRule(businessDb, {
      insightId: scopeInsight.id,
      scopeType: "domain",
      scopeKey: "bond",
      mode: "include"
    });
    await upsertInsightScopeRule(businessDb, {
      insightId: scopeInsight.id,
      scopeType: "watchlist",
      scopeKey: "all",
      mode: "include"
    });
    await upsertInsightScopeRule(businessDb, {
      insightId: scopeInsight.id,
      scopeType: "symbol",
      scopeKey: "CGB10Y.CN",
      mode: "exclude"
    });
    const scopeMaterialize = await previewMaterializeInsightTargets(businessDb, marketDb, {
      insightId: scopeInsight.id,
      persist: true
    });
    assert(
      scopeMaterialize.symbols.includes("600519.SH"),
      "scope materialization should include stock symbol"
    );
    assert(
      scopeMaterialize.symbols.includes("AU9999.SGE"),
      "scope materialization should include spot symbol"
    );
    assert(
      !scopeMaterialize.symbols.includes("CGB10Y.CN"),
      "scope materialization should exclude target symbol by exclude rule"
    );

    const stockInsight = await createInsight(businessDb, {
      title: "盈利预期修复",
      thesis: "股价动量因政策边际改善上修",
      status: "active",
      validFrom: "2026-01-01",
      validTo: "2026-12-31",
      tags: ["stock", "policy"]
    });
    const stockUpdated = await updateInsight(businessDb, {
      id: stockInsight.id,
      title: stockInsight.title,
      thesis: "股价动量因政策边际改善上修（更新）"
    });
    assert(
      stockUpdated.thesis.includes("更新"),
      "update insight should persist new thesis"
    );
    await upsertInsightScopeRule(businessDb, {
      insightId: stockInsight.id,
      scopeType: "symbol",
      scopeKey: "600519.SH",
      mode: "include"
    });
    const stockChannel = await upsertInsightEffectChannel(businessDb, {
      insightId: stockInsight.id,
      methodKey: "builtin.equity.factor",
      metricKey: "factor.momentum.20d",
      stage: "first_order",
      operator: "add",
      priority: 10
    });
    await upsertInsightEffectPoint(businessDb, {
      channelId: stockChannel.id,
      effectDate: "2026-01-01",
      effectValue: 0
    });
    await upsertInsightEffectPoint(businessDb, {
      channelId: stockChannel.id,
      effectDate: "2026-01-11",
      effectValue: 0.1
    });
    await previewMaterializeInsightTargets(businessDb, marketDb, {
      insightId: stockInsight.id,
      persist: true
    });
    const stockPreview = await previewValuationBySymbol(businessDb, marketDb, {
      symbol: "600519.SH",
      asOfDate: "2026-01-06",
      methodKey: "builtin.equity.factor"
    });
    assert(
      stockPreview.notApplicable === false,
      "stock preview should be applicable"
    );
    assert(
      stockPreview.methodKey === "builtin.equity.factor",
      "stock should route to builtin.equity.factor"
    );
    const stockEffect = stockPreview.appliedEffects.find(
      (item) => item.insightId === stockInsight.id
    );
    assert(stockEffect, "stock preview should contain applied effect");
    assert(
      approxEqual(stockEffect.value, 0.05, 1e-6),
      `interpolated effect should be 0.05, got ${stockEffect.value}`
    );
    assert(
      stockPreview.baseValue !== stockPreview.adjustedValue,
      "stock base and adjusted should differ"
    );

    await excludeInsightTarget(businessDb, marketDb, {
      insightId: stockInsight.id,
      symbol: "600519.SH",
      reason: "smoke exclusion"
    });
    const excludedPreview = await previewValuationBySymbol(businessDb, marketDb, {
      symbol: "600519.SH",
      asOfDate: "2026-01-06",
      methodKey: "builtin.equity.factor"
    });
    assert(
      !excludedPreview.appliedEffects.some((item) => item.insightId === stockInsight.id),
      "excluded insight should not be applied"
    );
    await unexcludeInsightTarget(businessDb, marketDb, {
      insightId: stockInsight.id,
      symbol: "600519.SH"
    });
    const unexcludedPreview = await previewValuationBySymbol(businessDb, marketDb, {
      symbol: "600519.SH",
      asOfDate: "2026-01-06",
      methodKey: "builtin.equity.factor"
    });
    assert(
      unexcludedPreview.appliedEffects.some((item) => item.insightId === stockInsight.id),
      "unexcluded insight should apply again"
    );

    const spotInsight = await createInsight(businessDb, {
      title: "黄金 carry 观点",
      thesis: "库存结构变化提升 carry",
      status: "active",
      validFrom: "2026-01-01",
      validTo: "2026-12-31",
      tags: ["gold", "spot"]
    });
    await upsertInsightScopeRule(businessDb, {
      insightId: spotInsight.id,
      scopeType: "symbol",
      scopeKey: "AU9999.SGE",
      mode: "include"
    });
    const spotChannel = await upsertInsightEffectChannel(businessDb, {
      insightId: spotInsight.id,
      methodKey: "builtin.spot.carry",
      metricKey: "factor.carry.annualized",
      stage: "first_order",
      operator: "add",
      priority: 20
    });
    await upsertInsightEffectPoint(businessDb, {
      channelId: spotChannel.id,
      effectDate: "2026-01-06",
      effectValue: 0.02
    });
    await previewMaterializeInsightTargets(businessDb, marketDb, {
      insightId: spotInsight.id,
      persist: true
    });
    const spotPreview = await previewValuationBySymbol(businessDb, marketDb, {
      symbol: "AU9999.SGE",
      asOfDate: "2026-01-06"
    });
    assert(
      spotPreview.methodKey === "builtin.spot.carry",
      "spot should route to builtin.spot.carry"
    );
    assert(
      spotPreview.appliedEffects.some((item) => item.insightId === spotInsight.id),
      "spot insight should be applied"
    );
    assert(
      spotPreview.adjustedValue !== spotPreview.baseValue,
      "spot base and adjusted should differ"
    );

    const bondInsight = await createInsight(businessDb, {
      title: "债券久期观点",
      thesis: "期限利差变化影响久期敏感性",
      status: "active",
      validFrom: "2026-01-01",
      validTo: "2026-12-31",
      tags: ["bond", "rate"]
    });
    await upsertInsightScopeRule(businessDb, {
      insightId: bondInsight.id,
      scopeType: "symbol",
      scopeKey: "CGB10Y.CN",
      mode: "include"
    });
    const bondDurationChannel = await upsertInsightEffectChannel(businessDb, {
      insightId: bondInsight.id,
      methodKey: "builtin.bond.yield",
      metricKey: "risk.duration",
      stage: "first_order",
      operator: "set",
      priority: 5
    });
    await upsertInsightEffectPoint(businessDb, {
      channelId: bondDurationChannel.id,
      effectDate: "2026-01-06",
      effectValue: 7
    });
    const bondYieldShiftChannel = await upsertInsightEffectChannel(businessDb, {
      insightId: bondInsight.id,
      methodKey: "builtin.bond.yield",
      metricKey: "risk.yield_shift",
      stage: "first_order",
      operator: "set",
      priority: 6
    });
    await upsertInsightEffectPoint(businessDb, {
      channelId: bondYieldShiftChannel.id,
      effectDate: "2026-01-06",
      effectValue: 0.01
    });
    await previewMaterializeInsightTargets(businessDb, marketDb, {
      insightId: bondInsight.id,
      persist: true
    });
    const bondPreview = await previewValuationBySymbol(businessDb, marketDb, {
      symbol: "CGB10Y.CN",
      asOfDate: "2026-01-06"
    });
    assert(
      bondPreview.methodKey === "builtin.bond.yield",
      "bond should route to builtin.bond.yield"
    );
    assert(
      bondPreview.baseValue !== null && bondPreview.adjustedValue !== null,
      "bond preview should produce value pair"
    );
    assert(
      bondPreview.adjustedValue! < bondPreview.baseValue!,
      "bond adjusted value should be lower after duration/yield_shift shock"
    );

    const fts = await searchInsights(businessDb, { query: "黄金", limit: 20, offset: 0 });
    assert(
      fts.items.some((item) => item.insight.id === spotInsight.id),
      "FTS should hit spot insight by chinese keyword"
    );

    await removeInsight(businessDb, { id: scopeInsight.id });
    const deletedSearch = await searchInsights(businessDb, {
      query: "scope",
      limit: 20,
      offset: 0
    });
    assert(
      !deletedSearch.items.some((item) => item.insight.id === scopeInsight.id),
      "soft deleted insight should not appear in FTS search results"
    );

    console.log("[verify-insights-e2e] ok");
    console.log(
      "[verify-insights-e2e] coverage:",
      JSON.stringify(
        {
          refreshStatus: refreshRun.status,
          objectiveSnapshots: objectiveSnapshots.length,
          stockMethod: stockAutoPreview.methodKey,
          stockPeDefault: stockPeWithDefault.baseValue,
          stockPeOverride: stockPeWithOverride.baseValue,
          stockPeStaleConfidence: stockPeStale.confidence,
          etfMethod: etfPreview.methodKey,
          etfBaseValue: etfPreview.baseValue,
          futuresMethod: futuresPreview.methodKey,
          futuresBaseValue: futuresPreview.baseValue,
          spotMeanReversionMethod: spotMeanReversionPreview.methodKey,
          forexMethod: forexRateDiffPreview.methodKey,
          bondSpreadMethod: bondSpreadPreview.methodKey,
          scopeSymbols: scopeMaterialize.symbols.length,
          stockEffects: stockPreview.appliedEffects.length,
          spotEffects: spotPreview.appliedEffects.length,
          bondEffects: bondPreview.appliedEffects.length,
          ftsHits: fts.items.length
        },
        null,
        2
      )
    );
  } finally {
    await close(businessDb);
    await close(marketDb);
    if (fs.existsSync(businessDbPath)) fs.unlinkSync(businessDbPath);
    if (fs.existsSync(marketDbPath)) fs.unlinkSync(marketDbPath);
  }
}

void runSmokeE2E().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error("[verify-insights-e2e] failed");
  console.error(message);
  process.exitCode = 1;
});
