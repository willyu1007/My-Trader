import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  createInsight,
  excludeInsightTarget,
  listValuationMethods,
  previewMaterializeInsightTargets,
  previewValuationBySymbol,
  removeInsight,
  searchInsights,
  unexcludeInsightTarget,
  updateInsight,
  upsertInsightEffectChannel,
  upsertInsightEffectPoint,
  upsertInsightScopeRule
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
          symbol, trade_date, circ_mv, total_mv, source, ingested_at
        )
        values ('600519.SH', '2026-01-06', 2000000, 3000000, 'verify', ?)
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
      valuationMethods.items.length >= 6,
      "expected builtin valuation methods to be seeded"
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
      asOfDate: "2026-01-06"
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
      asOfDate: "2026-01-06"
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
      asOfDate: "2026-01-06"
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
