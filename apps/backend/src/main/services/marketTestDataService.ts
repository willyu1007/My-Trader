import crypto from "node:crypto";

import type {
  CleanupMarketTestDataInput,
  CleanupMarketTestDataResult,
  GetMarketTestDataStatusResult,
  InjectMarketTestDataInput,
  InjectMarketTestDataResult,
  ListMarketTestDataScenariosResult,
  MarketTestDataScenarioStatus,
  MarketTestDataScenarioExecution,
  MarketTestDataScenarioId,
  MarketTestDataScenarioSpec
} from "@mytrader/shared";

import { all, get, run, transaction } from "../storage/sqlite";
import type { SqliteDatabase } from "../storage/sqlite";
import { upsertInstruments, upsertPrices } from "../market/marketRepository";
import { upsertInstrumentProfiles } from "../market/instrumentCatalogRepository";
import { upsertDailyBasics } from "../market/dailyBasicRepository";
import { upsertDailyMoneyflows } from "../market/dailyMoneyflowRepository";
import { upsertWatchlistItem } from "../storage/watchlistRepository";
import { addInstrumentTag } from "../storage/instrumentTagRepository";
import {
  getMarketTargetsConfig,
  listTempTargetSymbols,
  removeTempTargetSymbol,
  setMarketTargetsConfig,
  touchTempTargetSymbol
} from "../storage/marketSettingsRepository";
import { upsertPositions } from "../storage/positionRepository";
import { upsertBaselineLedgerFromPosition } from "../storage/ledgerBaseline";
import { createRiskLimit } from "../storage/riskLimitRepository";
import {
  createInsight,
  createInsightFact,
  upsertInsightEffectChannel,
  upsertInsightEffectPoint,
  upsertInsightScopeRule,
  upsertValuationSubjectiveDefault,
  upsertValuationSubjectiveOverride
} from "./insightService";

type ScenarioContext = {
  businessDb: SqliteDatabase;
  marketDb: SqliteDatabase;
  portfolioId: string | null;
};

type ScenarioDelta = {
  inserted: number;
  updated: number;
  skipped: number;
  deleted: number;
  warnings: string[];
};

type ScenarioRuntime = {
  spec: MarketTestDataScenarioSpec;
  inject: (context: ScenarioContext) => Promise<ScenarioDelta>;
  cleanup: (context: ScenarioContext) => Promise<ScenarioDelta>;
};

type SeedInstrument = {
  symbol: string;
  name: string;
  kind: "stock" | "fund" | "index" | "futures" | "spot" | "forex";
  assetClass: "stock" | "etf" | "futures" | "spot" | null;
  market: string;
  currency: string;
  tags: string[];
  priceBase: number;
};

const SCENARIOS: Record<MarketTestDataScenarioId, ScenarioRuntime> = {
  "portfolio.core": {
    spec: {
      id: "portfolio.core",
      name: "组合核心链路",
      description: "注入组合、持仓、流水、风险限额与基础行情样本。",
      coverage: ["投资组合", "风险管理", "市场行情"],
      sizeLabel: "中",
      dependencies: [],
      defaultSelected: true
    },
    inject: injectPortfolioCoreScenario,
    cleanup: cleanupPortfolioCoreScenario
  },
  "market.multi_domain": {
    spec: {
      id: "market.multi_domain",
      name: "多资产域行情",
      description: "注入股票/ETF/指数/期货/现货/外汇等多域行情样本。",
      coverage: ["市场行情", "数据分析"],
      sizeLabel: "大",
      dependencies: ["portfolio.core"],
      defaultSelected: true
    },
    inject: injectMarketMultiDomainScenario,
    cleanup: cleanupMarketMultiDomainScenario
  },
  "tags.watchlist.targets": {
    spec: {
      id: "tags.watchlist.targets",
      name: "标签与目标池",
      description: "注入 provider/user/manual/watchlist 标签与目标池临时标的样本。",
      coverage: ["标的管理", "数据管理"],
      sizeLabel: "中",
      dependencies: ["market.multi_domain"],
      defaultSelected: true
    },
    inject: injectTagsWatchlistTargetsScenario,
    cleanup: cleanupTagsWatchlistTargetsScenario
  },
  "data_status.ingest_completeness": {
    spec: {
      id: "data_status.ingest_completeness",
      name: "数据状态样本",
      description: "注入拉取记录、步骤记录与供给完整性样本。",
      coverage: ["数据状态"],
      sizeLabel: "小",
      dependencies: ["market.multi_domain"],
      defaultSelected: true
    },
    inject: injectDataStatusScenario,
    cleanup: cleanupDataStatusScenario
  },
  "valuation.ready": {
    spec: {
      id: "valuation.ready",
      name: "估值就绪参数",
      description: "注入客观快照、主观默认与覆盖样本，支持估值入口联调。",
      coverage: ["估值方法", "标的详情估值"],
      sizeLabel: "中",
      dependencies: ["market.multi_domain"],
      defaultSelected: true
    },
    inject: injectValuationReadyScenario,
    cleanup: cleanupValuationReadyScenario
  },
  "insights.sample": {
    spec: {
      id: "insights.sample",
      name: "观点样本",
      description: "注入事实、观点、作用范围与效果通道样本。",
      coverage: ["观点"],
      sizeLabel: "小",
      dependencies: ["valuation.ready", "tags.watchlist.targets"],
      defaultSelected: true
    },
    inject: injectInsightsSampleScenario,
    cleanup: cleanupInsightsSampleScenario
  }
};

const SCENARIO_ORDER: MarketTestDataScenarioId[] = [
  "portfolio.core",
  "market.multi_domain",
  "tags.watchlist.targets",
  "data_status.ingest_completeness",
  "valuation.ready",
  "insights.sample"
];

const TEST_SYMBOL_PREFIX = "TEST";
const TEST_TAG_PREFIX = "test:";
const TEST_WATCHLIST_GROUP = "test:watchlist";
const TEST_FACT_PREFIX = "[TEST-DATA]";
const TEST_INSIGHT_TITLE = "[TEST-DATA] 估值联动样本观点";
const TEST_SOURCE_RUN_PREFIX = "test:seed:";
const TEST_MANUAL_TAGS = [
  {
    tag: "user:测试成长",
    name: "测试成长",
    description: "测试样本：成长风格跟踪标签。",
    color: "#0EA5E9"
  },
  {
    tag: "user:测试防御",
    name: "测试防御",
    description: "测试样本：防御风格跟踪标签。",
    color: "#22C55E"
  }
] as const;

const CORE_INSTRUMENTS: SeedInstrument[] = [
  {
    symbol: "TESTSTK01.CN",
    name: "测试股票 Alpha",
    kind: "stock",
    assetClass: "stock",
    market: "CN",
    currency: "CNY",
    tags: ["test:all", "test:portfolio", "kind:stock", "market:CN"],
    priceBase: 18
  },
  {
    symbol: "TESTSTK02.CN",
    name: "测试股票 Beta",
    kind: "stock",
    assetClass: "stock",
    market: "CN",
    currency: "CNY",
    tags: ["test:all", "test:portfolio", "kind:stock", "market:CN"],
    priceBase: 32
  },
  {
    symbol: "TESTETF01.CN",
    name: "测试 ETF 01",
    kind: "fund",
    assetClass: "etf",
    market: "CN",
    currency: "CNY",
    tags: ["test:all", "test:portfolio", "kind:fund", "market:CN"],
    priceBase: 3.2
  }
];

const MULTI_DOMAIN_INSTRUMENTS: SeedInstrument[] = [
  {
    symbol: "TESTIDX01.CN",
    name: "测试指数 01",
    kind: "index",
    assetClass: null,
    market: "CN",
    currency: "CNY",
    tags: ["test:all", "test:domain:index", "kind:index", "market:CN"],
    priceBase: 3250
  },
  {
    symbol: "TESTFUT01.CN",
    name: "测试期货 01",
    kind: "futures",
    assetClass: "futures",
    market: "CN",
    currency: "CNY",
    tags: ["test:all", "test:domain:futures", "kind:futures", "market:CN"],
    priceBase: 410
  },
  {
    symbol: "TESTSPT01.CN",
    name: "测试现货 01",
    kind: "spot",
    assetClass: "spot",
    market: "CN",
    currency: "CNY",
    tags: ["test:all", "test:domain:spot", "kind:spot", "market:CN"],
    priceBase: 68
  },
  {
    symbol: "TESTFXUSDCNY.FX",
    name: "测试 USD/CNY",
    kind: "forex",
    assetClass: null,
    market: "FX",
    currency: "CNY",
    tags: ["test:all", "test:domain:fx", "kind:forex", "market:FX"],
    priceBase: 7.08
  },
  {
    symbol: "TESTBOND01.CN",
    name: "测试债券指数 01",
    kind: "index",
    assetClass: null,
    market: "CN",
    currency: "CNY",
    tags: ["test:all", "test:domain:bond", "domain:bond", "market:CN"],
    priceBase: 102.8
  },
  {
    symbol: "TESTRATE01.CN",
    name: "测试利率指数 01",
    kind: "index",
    assetClass: null,
    market: "CN",
    currency: "CNY",
    tags: ["test:all", "test:domain:rate", "domain:rate", "market:CN"],
    priceBase: 99.4
  }
];

export async function listMarketTestDataScenarios(): Promise<ListMarketTestDataScenariosResult> {
  return {
    scenarios: SCENARIO_ORDER.map((id) => SCENARIOS[id].spec),
    updatedAt: Date.now()
  };
}

export async function getMarketTestDataStatus(
  businessDb: SqliteDatabase,
  marketDb: SqliteDatabase
): Promise<GetMarketTestDataStatusResult> {
  const scenarios: MarketTestDataScenarioStatus[] = [];
  for (const scenarioId of SCENARIO_ORDER) {
    const status = await buildScenarioStatus(scenarioId, businessDb, marketDb);
    scenarios.push(status);
  }
  return {
    scenarios,
    updatedAt: Date.now()
  };
}

export async function injectMarketTestData(
  businessDb: SqliteDatabase,
  marketDb: SqliteDatabase,
  input: InjectMarketTestDataInput
): Promise<InjectMarketTestDataResult> {
  const startedAt = Date.now();
  const scenarioIds = resolveScenarioIds(
    input.scenarioIds,
    input.includeDependencies !== false
  );
  const portfolioId = normalizeOptionalString(input.portfolioId);
  const context: ScenarioContext = { businessDb, marketDb, portfolioId };
  const executions: MarketTestDataScenarioExecution[] = [];

  for (const scenarioId of scenarioIds) {
    const runtime = SCENARIOS[scenarioId];
    const scenarioStart = Date.now();
    try {
      const delta = await runtime.inject(context);
      executions.push({
        scenarioId,
        status: "success",
        inserted: delta.inserted,
        updated: delta.updated,
        skipped: delta.skipped,
        deleted: delta.deleted,
        warnings: delta.warnings,
        durationMs: Date.now() - scenarioStart
      });
    } catch (error) {
      executions.push({
        scenarioId,
        status: "failed",
        inserted: 0,
        updated: 0,
        skipped: 0,
        deleted: 0,
        warnings: [toErrorMessage(error)],
        durationMs: Date.now() - scenarioStart
      });
    }
  }

  return aggregateOperationResult("inject", startedAt, executions);
}

export async function cleanupMarketTestData(
  businessDb: SqliteDatabase,
  marketDb: SqliteDatabase,
  input?: CleanupMarketTestDataInput | null
): Promise<CleanupMarketTestDataResult> {
  const startedAt = Date.now();
  const selected = normalizeScenarioSelection(input?.scenarioIds ?? null);
  const scenarioIds = [...selected].sort(
    (a, b) => SCENARIO_ORDER.indexOf(b) - SCENARIO_ORDER.indexOf(a)
  );
  const context: ScenarioContext = {
    businessDb,
    marketDb,
    portfolioId: normalizeOptionalString(input?.portfolioId)
  };
  const executions: MarketTestDataScenarioExecution[] = [];

  for (const scenarioId of scenarioIds) {
    const runtime = SCENARIOS[scenarioId];
    const scenarioStart = Date.now();
    try {
      const delta = await runtime.cleanup(context);
      executions.push({
        scenarioId,
        status: "success",
        inserted: delta.inserted,
        updated: delta.updated,
        skipped: delta.skipped,
        deleted: delta.deleted,
        warnings: delta.warnings,
        durationMs: Date.now() - scenarioStart
      });
    } catch (error) {
      executions.push({
        scenarioId,
        status: "failed",
        inserted: 0,
        updated: 0,
        skipped: 0,
        deleted: 0,
        warnings: [toErrorMessage(error)],
        durationMs: Date.now() - scenarioStart
      });
    }
  }

  return aggregateOperationResult("cleanup", startedAt, executions);
}

async function injectPortfolioCoreScenario(context: ScenarioContext): Promise<ScenarioDelta> {
  const profileDelta = await upsertInstrumentBundle(
    context.marketDb,
    CORE_INSTRUMENTS,
    220,
    "test:scenario:portfolio.core"
  );
  let inserted = profileDelta.inserted;
  let updated = profileDelta.updated;
  let skipped = profileDelta.skipped;
  const warnings = [...profileDelta.warnings];

  if (!context.portfolioId) {
    warnings.push("未选择目标组合，已跳过持仓/流水注入。");
    skipped += 1;
    return { inserted, updated, skipped, deleted: 0, warnings };
  }

  const positions = [
    {
      portfolioId: context.portfolioId,
      symbol: "TESTSTK01.CN",
      name: "测试股票 Alpha",
      assetClass: "stock" as const,
      market: "CN",
      currency: "CNY",
      quantity: 1200,
      cost: 17.2,
      openDate: buildIsoDate(new Date(Date.now() - 240 * 86_400_000))
    },
    {
      portfolioId: context.portfolioId,
      symbol: "TESTSTK02.CN",
      name: "测试股票 Beta",
      assetClass: "stock" as const,
      market: "CN",
      currency: "CNY",
      quantity: 800,
      cost: 31.6,
      openDate: buildIsoDate(new Date(Date.now() - 190 * 86_400_000))
    }
  ];
  const positionResult = await upsertPositions(
    context.businessDb,
    context.portfolioId,
    positions
  );
  inserted += positionResult.inserted;
  updated += positionResult.updated;

  for (const row of positions) {
    await upsertBaselineLedgerFromPosition(context.businessDb, {
      portfolioId: row.portfolioId,
      symbol: row.symbol,
      assetClass: row.assetClass,
      currency: row.currency,
      quantity: row.quantity,
      cost: row.cost ?? null,
      openDate: row.openDate ?? null
    });
    inserted += 1;
  }

  inserted += await upsertTestTradeLedgerEntries(context.businessDb, context.portfolioId);
  inserted += await ensureTestRiskLimits(context.businessDb, context.portfolioId);

  return { inserted, updated, skipped, deleted: 0, warnings };
}

async function cleanupPortfolioCoreScenario(context: ScenarioContext): Promise<ScenarioDelta> {
  let deleted = 0;

  deleted += await deleteByCount(
    context.businessDb,
    `select count(*) as total from ledger_entries where symbol like '${TEST_SYMBOL_PREFIX}%'`,
    `delete from ledger_entries where symbol like '${TEST_SYMBOL_PREFIX}%'`
  );
  deleted += await deleteByCount(
    context.businessDb,
    `select count(*) as total from positions where symbol like '${TEST_SYMBOL_PREFIX}%'`,
    `delete from positions where symbol like '${TEST_SYMBOL_PREFIX}%'`
  );
  deleted += await deleteByCount(
    context.businessDb,
    `select count(*) as total from risk_limits where target like 'test:%'`,
    `delete from risk_limits where target like 'test:%'`
  );

  return { inserted: 0, updated: 0, skipped: 0, deleted, warnings: [] };
}

async function injectMarketMultiDomainScenario(context: ScenarioContext): Promise<ScenarioDelta> {
  const delta = await upsertInstrumentBundle(
    context.marketDb,
    MULTI_DOMAIN_INSTRUMENTS,
    180,
    "test:scenario:market.multi_domain"
  );

  for (const item of MULTI_DOMAIN_INSTRUMENTS) {
    await addInstrumentTag(context.businessDb, item.symbol, "test:all");
    await addInstrumentTag(
      context.businessDb,
      item.symbol,
      `test:domain:${item.kind === "fund" ? "etf" : item.kind}`
    );
  }

  return {
    inserted: delta.inserted + MULTI_DOMAIN_INSTRUMENTS.length * 2,
    updated: delta.updated,
    skipped: delta.skipped,
    deleted: 0,
    warnings: delta.warnings
  };
}

async function cleanupMarketMultiDomainScenario(context: ScenarioContext): Promise<ScenarioDelta> {
  let deleted = 0;

  deleted += await deleteByCount(
    context.marketDb,
    `select count(*) as total from daily_moneyflows where symbol like '${TEST_SYMBOL_PREFIX}%'`,
    `delete from daily_moneyflows where symbol like '${TEST_SYMBOL_PREFIX}%'`
  );
  deleted += await deleteByCount(
    context.marketDb,
    `select count(*) as total from daily_basics where symbol like '${TEST_SYMBOL_PREFIX}%'`,
    `delete from daily_basics where symbol like '${TEST_SYMBOL_PREFIX}%'`
  );
  deleted += await deleteByCount(
    context.marketDb,
    `select count(*) as total from daily_prices where symbol like '${TEST_SYMBOL_PREFIX}%'`,
    `delete from daily_prices where symbol like '${TEST_SYMBOL_PREFIX}%'`
  );
  deleted += await deleteByCount(
    context.marketDb,
    `select count(*) as total from instrument_profile_tags where symbol like '${TEST_SYMBOL_PREFIX}%' or tag like '${TEST_TAG_PREFIX}%'`,
    `delete from instrument_profile_tags where symbol like '${TEST_SYMBOL_PREFIX}%' or tag like '${TEST_TAG_PREFIX}%'`
  );
  deleted += await deleteByCount(
    context.marketDb,
    `select count(*) as total from instrument_profiles where symbol like '${TEST_SYMBOL_PREFIX}%'`,
    `delete from instrument_profiles where symbol like '${TEST_SYMBOL_PREFIX}%'`
  );
  deleted += await deleteByCount(
    context.marketDb,
    `select count(*) as total from instruments where symbol like '${TEST_SYMBOL_PREFIX}%'`,
    `delete from instruments where symbol like '${TEST_SYMBOL_PREFIX}%'`
  );
  deleted += await deleteByCount(
    context.businessDb,
    `select count(*) as total from instrument_tags where symbol like '${TEST_SYMBOL_PREFIX}%' or tag like '${TEST_TAG_PREFIX}%'`,
    `delete from instrument_tags where symbol like '${TEST_SYMBOL_PREFIX}%' or tag like '${TEST_TAG_PREFIX}%'`
  );

  return { inserted: 0, updated: 0, skipped: 0, deleted, warnings: [] };
}

async function injectTagsWatchlistTargetsScenario(
  context: ScenarioContext
): Promise<ScenarioDelta> {
  let inserted = 0;
  const warnings: string[] = [];
  const watchSymbols = [
    "TESTSTK01.CN",
    "TESTSTK02.CN",
    "TESTETF01.CN",
    "TESTFUT01.CN"
  ];

  for (const symbol of watchSymbols) {
    await upsertWatchlistItem(context.businessDb, {
      symbol,
      name: `测试标的 ${symbol}`,
      groupName: TEST_WATCHLIST_GROUP,
      note: "test scenario watchlist"
    });
    inserted += 1;
  }

  for (const symbol of ["TESTSTK01.CN", "TESTETF01.CN"]) {
    await addInstrumentTag(context.businessDb, symbol, "test:focus");
    await addInstrumentTag(context.businessDb, symbol, "test:strategy:quality");
    inserted += 2;
  }

  inserted += await ensureManualTags(context.businessDb);

  const targets = await getMarketTargetsConfig(context.businessDb);
  const nextTagFilters = Array.from(new Set([...targets.tagFilters, "test:all"]));
  const nextSymbols = Array.from(
    new Set([...targets.explicitSymbols, "TESTSTK01.CN", "TESTETF01.CN"])
  );
  await setMarketTargetsConfig(context.businessDb, {
    ...targets,
    includeWatchlist: true,
    includeHoldings: true,
    includeRegistryAutoIngest: true,
    explicitSymbols: nextSymbols,
    tagFilters: nextTagFilters
  });
  inserted += 1;

  await touchTempTargetSymbol(context.businessDb, "TESTFXUSDCNY.FX", 14);
  inserted += 1;

  if (!context.portfolioId) {
    warnings.push("当前未激活组合：目标池仍已写入显式标的和标签筛选。");
  }

  return { inserted, updated: 0, skipped: 0, deleted: 0, warnings };
}

async function cleanupTagsWatchlistTargetsScenario(
  context: ScenarioContext
): Promise<ScenarioDelta> {
  let deleted = 0;

  deleted += await deleteByCount(
    context.businessDb,
    `select count(*) as total from watchlist_items where group_name like '${TEST_TAG_PREFIX}%' or symbol like '${TEST_SYMBOL_PREFIX}%'`,
    `delete from watchlist_items where group_name like '${TEST_TAG_PREFIX}%' or symbol like '${TEST_SYMBOL_PREFIX}%'`
  );
  deleted += await deleteByCount(
    context.businessDb,
    `select count(*) as total from manual_tags where tag in ('user:测试成长', 'user:测试防御')`,
    `delete from manual_tags where tag in ('user:测试成长', 'user:测试防御') and ifnull(is_reserved, 0) = 0`
  );

  const existingTargets = await getMarketTargetsConfig(context.businessDb);
  const cleaned = {
    ...existingTargets,
    explicitSymbols: existingTargets.explicitSymbols.filter(
      (item) => !item.startsWith(TEST_SYMBOL_PREFIX)
    ),
    tagFilters: existingTargets.tagFilters.filter(
      (item) => !item.startsWith(TEST_TAG_PREFIX)
    )
  };
  await setMarketTargetsConfig(context.businessDb, cleaned);
  deleted += 1;

  const tempRows = await listTempTargetSymbols(context.businessDb);
  for (const row of tempRows) {
    if (!row.symbol.startsWith(TEST_SYMBOL_PREFIX)) continue;
    await removeTempTargetSymbol(context.businessDb, row.symbol);
    deleted += 1;
  }

  return { inserted: 0, updated: 0, skipped: 0, deleted, warnings: [] };
}

async function injectDataStatusScenario(context: ScenarioContext): Promise<ScenarioDelta> {
  const now = Date.now();
  const asOfDate = buildIsoDate(new Date());
  let inserted = 0;

  const ingestRuns = [
    {
      id: `${TEST_SOURCE_RUN_PREFIX}ingest:success:${now}`,
      scope: "universe",
      mode: "manual",
      status: "success",
      as_of_trade_date: asOfDate,
      started_at: now - 22_000,
      finished_at: now - 18_000,
      symbol_count: 96,
      inserted: 420,
      updated: 135,
      errors: 0,
      error_message: null,
      meta_json: JSON.stringify({ testData: true, scenario: "data_status.ingest_completeness" })
    },
    {
      id: `${TEST_SOURCE_RUN_PREFIX}ingest:partial:${now}`,
      scope: "target",
      mode: "manual",
      status: "partial",
      as_of_trade_date: asOfDate,
      started_at: now - 15_000,
      finished_at: now - 11_500,
      symbol_count: 64,
      inserted: 182,
      updated: 48,
      errors: 3,
      error_message: "部分模块供给延迟（测试样本）",
      meta_json: JSON.stringify({ testData: true, scenario: "data_status.ingest_completeness" })
    }
  ];

  await transaction(context.marketDb, async () => {
    for (const row of ingestRuns) {
      await run(
        context.marketDb,
        `
          insert into ingest_runs (
            id, scope, mode, status, as_of_trade_date, started_at, finished_at,
            symbol_count, inserted, updated, errors, error_message, meta_json
          )
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          on conflict(id) do update set
            status = excluded.status,
            finished_at = excluded.finished_at,
            symbol_count = excluded.symbol_count,
            inserted = excluded.inserted,
            updated = excluded.updated,
            errors = excluded.errors,
            error_message = excluded.error_message,
            meta_json = excluded.meta_json
        `,
        [
          row.id,
          row.scope,
          row.mode,
          row.status,
          row.as_of_trade_date,
          row.started_at,
          row.finished_at,
          row.symbol_count,
          row.inserted,
          row.updated,
          row.errors,
          row.error_message,
          row.meta_json
        ]
      );
      inserted += 1;
    }
  });

  const completenessRows = [
    {
      checkId: "source.stock.market.daily",
      entityType: "instrument",
      entityId: "TESTSTK01.CN",
      bucketId: "stock",
      domainId: "stock",
      moduleId: "stock.market.daily",
      status: "complete",
      coverageRatio: 1
    },
    {
      checkId: "source.stock.moneyflow",
      entityType: "instrument",
      entityId: "TESTSTK02.CN",
      bucketId: "stock",
      domainId: "stock",
      moduleId: "stock.moneyflow",
      status: "partial",
      coverageRatio: 0.62
    },
    {
      checkId: "source.fx.daily",
      entityType: "fx_pair",
      entityId: "TESTFXUSDCNY.FX",
      bucketId: "fx",
      domainId: "fx",
      moduleId: "fx.daily",
      status: "complete",
      coverageRatio: 1
    },
    {
      checkId: "source.macro.snapshot",
      entityType: "macro_module",
      entityId: "TEST:macro",
      bucketId: "macro",
      domainId: "macro",
      moduleId: "macro.snapshot",
      status: "missing",
      coverageRatio: 0
    }
  ] as const;

  for (const row of completenessRows) {
    await run(
      context.marketDb,
      `
        insert into completeness_status_v2 (
          scope_id, check_id, entity_type, entity_id, bucket_id, domain_id,
          module_id, asset_class, as_of_trade_date, status, coverage_ratio,
          source_run_id, detail_json, updated_at
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(scope_id, check_id, entity_type, entity_id) do update set
          status = excluded.status,
          coverage_ratio = excluded.coverage_ratio,
          source_run_id = excluded.source_run_id,
          as_of_trade_date = excluded.as_of_trade_date,
          updated_at = excluded.updated_at,
          detail_json = excluded.detail_json
      `,
      [
        "source_pool",
        row.checkId,
        row.entityType,
        row.entityId,
        row.bucketId,
        row.domainId,
        row.moduleId,
        null,
        asOfDate,
        row.status,
        row.coverageRatio,
        ingestRuns[0].id,
        JSON.stringify({ testData: true, scenario: "data_status.ingest_completeness" }),
        now
      ]
    );
    inserted += 1;
  }

  return { inserted, updated: 0, skipped: 0, deleted: 0, warnings: [] };
}

async function cleanupDataStatusScenario(context: ScenarioContext): Promise<ScenarioDelta> {
  let deleted = 0;
  deleted += await deleteByCount(
    context.marketDb,
    `select count(*) as total from ingest_runs where id like '${TEST_SOURCE_RUN_PREFIX}%'`,
    `delete from ingest_runs where id like '${TEST_SOURCE_RUN_PREFIX}%'`
  );
  deleted += await deleteByCount(
    context.marketDb,
    `select count(*) as total from completeness_status_v2 where source_run_id like '${TEST_SOURCE_RUN_PREFIX}%' or entity_id like '${TEST_SYMBOL_PREFIX}%' or entity_id like 'TEST:%'`,
    `delete from completeness_status_v2 where source_run_id like '${TEST_SOURCE_RUN_PREFIX}%' or entity_id like '${TEST_SYMBOL_PREFIX}%' or entity_id like 'TEST:%'`
  );
  return { inserted: 0, updated: 0, skipped: 0, deleted, warnings: [] };
}

async function injectValuationReadyScenario(context: ScenarioContext): Promise<ScenarioDelta> {
  const now = Date.now();
  const asOfDate = buildIsoDate(new Date());
  let inserted = 0;
  let updated = 0;

  const snapshots = [
    {
      symbol: "TESTSTK01.CN",
      methodKey: "builtin.stock.pe.relative.v1",
      metricKey: "market.price",
      value: 18.6,
      quality: "fresh",
      source: "test:valuation.seed"
    },
    {
      symbol: "TESTSTK01.CN",
      methodKey: "builtin.stock.pe.relative.v1",
      metricKey: "valuation.pe_ttm",
      value: 14.8,
      quality: "fresh",
      source: "test:valuation.seed"
    },
    {
      symbol: "TESTSTK01.CN",
      methodKey: "builtin.stock.ev_ebitda.relative.v1",
      metricKey: "valuation.ev_ebitda_ttm",
      value: 8.2,
      quality: "fresh",
      source: "test:valuation.seed"
    },
    {
      symbol: "TESTETF01.CN",
      methodKey: "builtin.etf.pe.relative.v1",
      metricKey: "valuation.pe_ttm",
      value: 17.4,
      quality: "stale",
      source: "test:valuation.seed"
    }
  ] as const;

  for (const row of snapshots) {
    const existing = await get<{ id: string }>(
      context.businessDb,
      `
        select id
        from valuation_objective_metric_snapshots
        where symbol = ?
          and method_key = ?
          and metric_key = ?
          and as_of_date = ?
        limit 1
      `,
      [row.symbol, row.methodKey, row.metricKey, asOfDate]
    );

    await run(
      context.businessDb,
      `
        insert into valuation_objective_metric_snapshots (
          id, symbol, method_key, metric_key, as_of_date, value,
          quality, source, created_at, updated_at
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(symbol, method_key, metric_key, as_of_date) do update set
          value = excluded.value,
          quality = excluded.quality,
          source = excluded.source,
          updated_at = excluded.updated_at
      `,
      [
        existing?.id ?? crypto.randomUUID(),
        row.symbol,
        row.methodKey,
        row.metricKey,
        asOfDate,
        row.value,
        row.quality,
        row.source,
        now,
        now
      ]
    );
    if (existing) updated += 1;
    else inserted += 1;
  }

  await upsertValuationSubjectiveDefault(context.businessDb, {
    methodKey: "builtin.stock.ddm.gordon.v1",
    inputKey: "discountRate",
    market: "CN",
    industryTag: "test:all",
    value: 0.1,
    source: "test:valuation.seed"
  });
  await upsertValuationSubjectiveDefault(context.businessDb, {
    methodKey: "builtin.stock.ddm.gordon.v1",
    inputKey: "growthRate",
    market: "CN",
    industryTag: "test:all",
    value: 0.045,
    source: "test:valuation.seed"
  });
  await upsertValuationSubjectiveOverride(context.businessDb, {
    symbol: "TESTSTK01.CN",
    methodKey: "builtin.stock.ddm.gordon.v1",
    inputKey: "dividendYield",
    value: 0.032,
    note: "test seed override"
  });
  inserted += 3;

  await run(
    context.businessDb,
    `
      insert into valuation_refresh_runs (
        id, status, reason, total_symbols, refreshed, failed, message,
        started_at, finished_at, created_at, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        status = excluded.status,
        updated_at = excluded.updated_at
    `,
    [
      `${TEST_SOURCE_RUN_PREFIX}valuation:${now}`,
      "success",
      "test_seed",
      4,
      4,
      0,
      "测试数据注入触发",
      now - 1200,
      now - 800,
      now,
      now
    ]
  );
  inserted += 1;

  return { inserted, updated, skipped: 0, deleted: 0, warnings: [] };
}

async function cleanupValuationReadyScenario(context: ScenarioContext): Promise<ScenarioDelta> {
  let deleted = 0;
  deleted += await deleteByCount(
    context.businessDb,
    `select count(*) as total from valuation_objective_metric_snapshots where symbol like '${TEST_SYMBOL_PREFIX}%' or source like 'test:%'`,
    `delete from valuation_objective_metric_snapshots where symbol like '${TEST_SYMBOL_PREFIX}%' or source like 'test:%'`
  );
  deleted += await deleteByCount(
    context.businessDb,
    `select count(*) as total from valuation_subjective_defaults where ifnull(industry_tag, '') like 'test:%' or ifnull(source, '') like 'test:%'`,
    `delete from valuation_subjective_defaults where ifnull(industry_tag, '') like 'test:%' or ifnull(source, '') like 'test:%'`
  );
  deleted += await deleteByCount(
    context.businessDb,
    `select count(*) as total from valuation_subjective_symbol_overrides where symbol like '${TEST_SYMBOL_PREFIX}%' or ifnull(note, '') like 'test%'`,
    `delete from valuation_subjective_symbol_overrides where symbol like '${TEST_SYMBOL_PREFIX}%' or ifnull(note, '') like 'test%'`
  );
  deleted += await deleteByCount(
    context.businessDb,
    `select count(*) as total from valuation_refresh_runs where id like '${TEST_SOURCE_RUN_PREFIX}valuation:%' or ifnull(reason, '') = 'test_seed'`,
    `delete from valuation_refresh_runs where id like '${TEST_SOURCE_RUN_PREFIX}valuation:%' or ifnull(reason, '') = 'test_seed'`
  );
  return { inserted: 0, updated: 0, skipped: 0, deleted, warnings: [] };
}

async function injectInsightsSampleScenario(context: ScenarioContext): Promise<ScenarioDelta> {
  let inserted = 0;

  const existingFact = await get<{ id: string }>(
    context.businessDb,
    `select id from insight_facts where content = ? limit 1`,
    [`${TEST_FACT_PREFIX} 多资产估值样本已准备，可用于联调。`]
  );
  if (!existingFact) {
    await createInsightFact(context.businessDb, {
      content: `${TEST_FACT_PREFIX} 多资产估值样本已准备，可用于联调。`
    });
    inserted += 1;
  }

  let insightId =
    (
      await get<{ id: string }>(
        context.businessDb,
        `
          select id
          from insights
          where title = ?
            and deleted_at is null
          limit 1
        `,
        [TEST_INSIGHT_TITLE]
      )
    )?.id ?? null;

  if (!insightId) {
    const created = await createInsight(context.businessDb, {
      title: TEST_INSIGHT_TITLE,
      thesis: "用于验证观点作用域、参数通道与估值联动。",
      status: "active",
      tags: ["test:all", "test:insight", "demo:insight"],
      meta: { testData: true, scenario: "insights.sample" }
    });
    insightId = created.id;
    inserted += 1;
  }

  await upsertInsightScopeRule(context.businessDb, {
    insightId,
    scopeType: "tag",
    scopeKey: "test:all",
    mode: "include",
    enabled: true
  });
  inserted += 1;

  const channel = await upsertInsightEffectChannel(context.businessDb, {
    insightId,
    methodKey: "builtin.stock.pe.relative.v1",
    metricKey: "valuation.multiplier",
    stage: "first_order",
    operator: "mul",
    priority: 90,
    enabled: true,
    meta: { testData: true }
  });
  inserted += 1;

  await upsertInsightEffectPoint(context.businessDb, {
    channelId: channel.id,
    effectDate: buildIsoDate(new Date()),
    effectValue: 1.08
  });
  inserted += 1;

  return { inserted, updated: 0, skipped: 0, deleted: 0, warnings: [] };
}

async function cleanupInsightsSampleScenario(context: ScenarioContext): Promise<ScenarioDelta> {
  let deleted = 0;
  deleted += await deleteByCount(
    context.businessDb,
    `select count(*) as total from insight_facts where content like '${TEST_FACT_PREFIX}%'`,
    `delete from insight_facts where content like '${TEST_FACT_PREFIX}%'`
  );
  deleted += await deleteByCount(
    context.businessDb,
    `select count(*) as total from insights where title = '${TEST_INSIGHT_TITLE}' or tags_json like '%\"test:insight\"%'`,
    `delete from insights where title = '${TEST_INSIGHT_TITLE}' or tags_json like '%\"test:insight\"%'`
  );
  return { inserted: 0, updated: 0, skipped: 0, deleted, warnings: [] };
}

async function upsertInstrumentBundle(
  marketDb: SqliteDatabase,
  inputs: SeedInstrument[],
  tradingDays: number,
  scenarioTag: string
): Promise<ScenarioDelta> {
  const dates = buildTradeDates(tradingDays);
  const prices = buildPriceRows(inputs, dates);
  const basics = buildBasicRows(inputs, prices);
  const moneyflows = buildMoneyflowRows(inputs, prices);
  const taggedInputs = inputs.map((item) => ({
    ...item,
    tags: Array.from(new Set([...item.tags, TEST_TAG_PREFIX + "all", scenarioTag]))
  }));

  await upsertInstruments(
    marketDb,
    taggedInputs.map((item) => ({
      symbol: item.symbol,
      name: item.name,
      assetClass: item.assetClass,
      market: item.market,
      currency: item.currency
    }))
  );

  await upsertInstrumentProfiles(
    marketDb,
    taggedInputs.map((item) => ({
      provider: "tushare",
      kind: item.kind,
      symbol: item.symbol,
      name: item.name,
      assetClass: item.assetClass,
      market: item.market,
      currency: item.currency,
      tags: item.tags,
      providerData: {
        testData: true,
        scenario: scenarioTag
      }
    }))
  );

  await upsertPrices(marketDb, prices);
  await upsertDailyBasics(marketDb, basics);
  await upsertDailyMoneyflows(marketDb, moneyflows);

  return {
    inserted: taggedInputs.length + prices.length + basics.length + moneyflows.length,
    updated: 0,
    skipped: 0,
    deleted: 0,
    warnings: []
  };
}

async function upsertTestTradeLedgerEntries(
  businessDb: SqliteDatabase,
  portfolioId: string
): Promise<number> {
  const today = Date.now();
  const tradeDates = buildTradeDates(90);
  const targetDates = [
    tradeDates[8],
    tradeDates[24],
    tradeDates[42],
    tradeDates[65]
  ].filter((value): value is string => Boolean(value));

  let inserted = 0;
  for (const symbol of ["TESTSTK01.CN", "TESTSTK02.CN"]) {
    for (const [index, tradeDate] of targetDates.entries()) {
      const side = index % 2 === 0 ? "buy" : "sell";
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
          tradeDate,
          null,
          null,
          null,
          symbol,
          side,
          100 + index * 20,
          null,
          null,
          null,
          null,
          0,
          0,
          "test seed trade",
          "system",
          `test:trade:${symbol}:${tradeDate}`,
          JSON.stringify({ testData: true }),
          today,
          today,
          null
        ]
      );
      inserted += 1;
    }
  }
  return inserted;
}

async function ensureTestRiskLimits(
  businessDb: SqliteDatabase,
  portfolioId: string
): Promise<number> {
  const existing = await all<{ target: string }>(
    businessDb,
    `select target from risk_limits where portfolio_id = ?`,
    [portfolioId]
  );
  const targetSet = new Set(existing.map((row) => row.target));
  let inserted = 0;
  if (!targetSet.has("test:position:max")) {
    await createRiskLimit(businessDb, {
      portfolioId,
      limitType: "position_weight",
      target: "test:position:max",
      threshold: 0.35
    });
    inserted += 1;
  }
  if (!targetSet.has("test:asset:stock")) {
    await createRiskLimit(businessDb, {
      portfolioId,
      limitType: "asset_class_weight",
      target: "test:asset:stock",
      threshold: 0.8
    });
    inserted += 1;
  }
  return inserted;
}

async function ensureManualTags(businessDb: SqliteDatabase): Promise<number> {
  let inserted = 0;
  for (const item of TEST_MANUAL_TAGS) {
    const existing = await get<{ tag: string }>(
      businessDb,
      `select tag from manual_tags where tag = ? limit 1`,
      [item.tag]
    );
    if (existing) continue;
    await run(
      businessDb,
      `
        insert into manual_tags (
          tag, name, description, color, is_reserved, created_at, updated_at
        )
        values (?, ?, ?, ?, 0, ?, ?)
      `,
      [item.tag, item.name, item.description, item.color, Date.now(), Date.now()]
    );
    inserted += 1;
  }
  return inserted;
}

function buildTradeDates(days: number): string[] {
  const result: string[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  const target = Math.max(20, Math.min(600, Math.floor(days)));
  while (result.length < target) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      result.push(buildIsoDate(cursor));
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return result.reverse();
}

function buildPriceRows(
  inputs: SeedInstrument[],
  tradeDates: string[]
): Array<{
  symbol: string;
  tradeDate: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  source: "csv";
}> {
  const rows: Array<{
    symbol: string;
    tradeDate: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    source: "csv";
  }> = [];
  const state = new Map<string, number>();
  for (const item of inputs) {
    state.set(item.symbol, item.priceBase);
  }
  for (let i = 0; i < tradeDates.length; i += 1) {
    const tradeDate = tradeDates[i]!;
    for (const item of inputs) {
      const prev = state.get(item.symbol) ?? item.priceBase;
      const season = Math.sin((i + item.symbol.length) / 18) * 0.012;
      const drift = item.kind === "forex" ? 0.0001 : 0.00035;
      const next = Math.max(0.01, prev * (1 + drift + season));
      const open = round2(prev * (1 + season * 0.3));
      const close = round2(next);
      const high = round2(Math.max(open, close) * 1.008);
      const low = round2(Math.min(open, close) * 0.992);
      const volume = Math.round(Math.abs(next * 12_000 + i * 120 + item.symbol.length * 100));
      rows.push({
        symbol: item.symbol,
        tradeDate,
        open,
        high,
        low,
        close,
        volume,
        source: "csv"
      });
      state.set(item.symbol, next);
    }
  }
  return rows;
}

function buildBasicRows(
  inputs: SeedInstrument[],
  prices: Array<{
    symbol: string;
    tradeDate: string;
    close: number;
  }>
): Array<{
  symbol: string;
  tradeDate: string;
  circMv: number;
  totalMv: number;
  peTtm: number;
  pb: number;
  psTtm: number;
  evEbitdaTtm: number;
  evSalesTtm: number;
  dvTtm: number;
  turnoverRate: number;
  source: "csv";
}> {
  const inputBySymbol = new Map(inputs.map((item) => [item.symbol, item]));
  return prices.map((row, index) => {
    const seed = inputBySymbol.get(row.symbol)!;
    const base = Math.max(1, row.close);
    return {
      symbol: row.symbol,
      tradeDate: row.tradeDate,
      circMv: round2(base * 100_000_000),
      totalMv: round2(base * 130_000_000),
      peTtm: round2(8 + (index % 12) * 0.6 + (seed.kind === "fund" ? 6 : 0)),
      pb: round2(0.9 + (index % 9) * 0.08),
      psTtm: round2(0.7 + (index % 11) * 0.15),
      evEbitdaTtm: round2(6 + (index % 10) * 0.35),
      evSalesTtm: round2(1.2 + (index % 7) * 0.18),
      dvTtm: round4(seed.kind === "fund" ? 0.022 : 0.017 + (index % 4) * 0.002),
      turnoverRate: round4(0.01 + (index % 8) * 0.004),
      source: "csv"
    };
  });
}

function buildMoneyflowRows(
  inputs: SeedInstrument[],
  prices: Array<{
    symbol: string;
    tradeDate: string;
    close: number;
    volume: number;
  }>
): Array<{
  symbol: string;
  tradeDate: string;
  netMfVol: number;
  netMfAmount: number;
  source: "csv";
}> {
  const inputBySymbol = new Map(inputs.map((item) => [item.symbol, item]));
  return prices.map((row, index) => {
    const seed = inputBySymbol.get(row.symbol)!;
    const sign = index % 2 === 0 ? 1 : -1;
    const ratio = seed.kind === "forex" ? 0.05 : 0.12;
    const netVol = Math.round(row.volume * ratio * sign);
    return {
      symbol: row.symbol,
      tradeDate: row.tradeDate,
      netMfVol: netVol,
      netMfAmount: round2(netVol * row.close),
      source: "csv"
    };
  });
}

function resolveScenarioIds(
  selectedIds: MarketTestDataScenarioId[],
  includeDependencies: boolean
): MarketTestDataScenarioId[] {
  const normalized = normalizeScenarioSelection(selectedIds);
  if (!includeDependencies) {
    return SCENARIO_ORDER.filter((item) => normalized.has(item));
  }
  const expanded = new Set<MarketTestDataScenarioId>();
  const visit = (id: MarketTestDataScenarioId) => {
    if (expanded.has(id)) return;
    const runtime = SCENARIOS[id];
    runtime.spec.dependencies.forEach((dep) => visit(dep));
    expanded.add(id);
  };
  normalized.forEach((id) => visit(id));
  return SCENARIO_ORDER.filter((item) => expanded.has(item));
}

function normalizeScenarioSelection(
  selectedIds: MarketTestDataScenarioId[] | null
): Set<MarketTestDataScenarioId> {
  const set = new Set<MarketTestDataScenarioId>();
  const source = selectedIds && selectedIds.length > 0 ? selectedIds : SCENARIO_ORDER;
  source.forEach((id) => {
    if (SCENARIOS[id]) {
      set.add(id);
    }
  });
  if (set.size === 0) {
    SCENARIO_ORDER.forEach((id) => set.add(id));
  }
  return set;
}

async function buildScenarioStatus(
  scenarioId: MarketTestDataScenarioId,
  businessDb: SqliteDatabase,
  marketDb: SqliteDatabase
): Promise<MarketTestDataScenarioStatus> {
  let breakdown: Array<{ label: string; count: number }> = [];
  switch (scenarioId) {
    case "portfolio.core":
      breakdown = await buildPortfolioCoreStatus(businessDb);
      break;
    case "market.multi_domain":
      breakdown = await buildMarketMultiDomainStatus(marketDb);
      break;
    case "tags.watchlist.targets":
      breakdown = await buildTagsWatchlistTargetsStatus(businessDb);
      break;
    case "data_status.ingest_completeness":
      breakdown = await buildDataStatusScenarioStatus(marketDb);
      break;
    case "valuation.ready":
      breakdown = await buildValuationReadyStatus(businessDb);
      break;
    case "insights.sample":
      breakdown = await buildInsightsSampleStatus(businessDb);
      break;
    default:
      breakdown = [];
      break;
  }
  const totalCount = breakdown.reduce((sum, item) => sum + item.count, 0);
  return {
    scenarioId,
    injected: totalCount > 0,
    totalCount,
    breakdown: breakdown.filter((item) => item.count > 0)
  };
}

async function buildPortfolioCoreStatus(
  businessDb: SqliteDatabase
): Promise<Array<{ label: string; count: number }>> {
  const positions = await countRows(
    businessDb,
    `select count(*) as total from positions where symbol like ?`,
    [`${TEST_SYMBOL_PREFIX}%`]
  );
  const ledger = await countRows(
    businessDb,
    `select count(*) as total from ledger_entries where symbol like ? or external_id like 'test:trade:%'`,
    [`${TEST_SYMBOL_PREFIX}%`]
  );
  const riskLimits = await countRows(
    businessDb,
    `select count(*) as total from risk_limits where target like '${TEST_TAG_PREFIX}%'`
  );
  return [
    { label: "持仓", count: positions },
    { label: "流水", count: ledger },
    { label: "风控", count: riskLimits }
  ];
}

async function buildMarketMultiDomainStatus(
  marketDb: SqliteDatabase
): Promise<Array<{ label: string; count: number }>> {
  const instruments = await countRows(
    marketDb,
    `select count(*) as total from instruments where symbol like ?`,
    [`${TEST_SYMBOL_PREFIX}%`]
  );
  const profiles = await countRows(
    marketDb,
    `select count(*) as total from instrument_profiles where symbol like ?`,
    [`${TEST_SYMBOL_PREFIX}%`]
  );
  const prices = await countRows(
    marketDb,
    `select count(*) as total from daily_prices where symbol like ?`,
    [`${TEST_SYMBOL_PREFIX}%`]
  );
  const basics = await countRows(
    marketDb,
    `select count(*) as total from daily_basics where symbol like ?`,
    [`${TEST_SYMBOL_PREFIX}%`]
  );
  const moneyflows = await countRows(
    marketDb,
    `select count(*) as total from daily_moneyflows where symbol like ?`,
    [`${TEST_SYMBOL_PREFIX}%`]
  );
  return [
    { label: "标的", count: instruments },
    { label: "画像", count: profiles },
    { label: "价格", count: prices },
    { label: "基础面", count: basics },
    { label: "资金流", count: moneyflows }
  ];
}

async function buildTagsWatchlistTargetsStatus(
  businessDb: SqliteDatabase
): Promise<Array<{ label: string; count: number }>> {
  const watchlist = await countRows(
    businessDb,
    `select count(*) as total from watchlist_items where group_name like ? or symbol like ?`,
    [`${TEST_TAG_PREFIX}%`, `${TEST_SYMBOL_PREFIX}%`]
  );
  const manualTags = await countRows(
    businessDb,
    `select count(*) as total from manual_tags where tag in ('user:测试成长', 'user:测试防御')`
  );
  const instrumentTags = await countRows(
    businessDb,
    `select count(*) as total from instrument_tags where tag like ? or symbol like ?`,
    [`${TEST_TAG_PREFIX}%`, `${TEST_SYMBOL_PREFIX}%`]
  );
  const targetConfig = await getMarketTargetsConfig(businessDb);
  const targetRules =
    targetConfig.explicitSymbols.some((item) => item.startsWith(TEST_SYMBOL_PREFIX)) ||
    targetConfig.tagFilters.some((item) => item.startsWith(TEST_TAG_PREFIX))
      ? 1
      : 0;
  const tempTargets = (await listTempTargetSymbols(businessDb)).filter((item) =>
    item.symbol.startsWith(TEST_SYMBOL_PREFIX)
  ).length;
  return [
    { label: "自选", count: watchlist },
    { label: "手动标签", count: manualTags },
    { label: "标的标签", count: instrumentTags },
    { label: "目标规则", count: targetRules },
    { label: "临时标的", count: tempTargets }
  ];
}

async function buildDataStatusScenarioStatus(
  marketDb: SqliteDatabase
): Promise<Array<{ label: string; count: number }>> {
  const ingestRuns = await countRows(
    marketDb,
    `select count(*) as total from ingest_runs where id like ?`,
    [`${TEST_SOURCE_RUN_PREFIX}%`]
  );
  const completeness = await countRows(
    marketDb,
    `select count(*) as total from completeness_status_v2 where source_run_id like ? or entity_id like ? or entity_id like 'TEST:%'`,
    [`${TEST_SOURCE_RUN_PREFIX}%`, `${TEST_SYMBOL_PREFIX}%`]
  );
  return [
    { label: "拉取记录", count: ingestRuns },
    { label: "完整性记录", count: completeness }
  ];
}

async function buildValuationReadyStatus(
  businessDb: SqliteDatabase
): Promise<Array<{ label: string; count: number }>> {
  const objectiveSnapshots = await countRows(
    businessDb,
    `select count(*) as total from valuation_objective_metric_snapshots where source like 'test:%'`
  );
  const subjectiveDefaults = await countRows(
    businessDb,
    `select count(*) as total from valuation_subjective_defaults where source like 'test:%'`
  );
  const subjectiveOverrides = await countRows(
    businessDb,
    `select count(*) as total from valuation_subjective_symbol_overrides where symbol like ?`,
    [`${TEST_SYMBOL_PREFIX}%`]
  );
  const refreshRuns = await countRows(
    businessDb,
    `select count(*) as total from valuation_refresh_runs where reason like 'test:%'`
  );
  return [
    { label: "客观快照", count: objectiveSnapshots },
    { label: "主观默认", count: subjectiveDefaults },
    { label: "主观覆盖", count: subjectiveOverrides },
    { label: "刷新记录", count: refreshRuns }
  ];
}

async function buildInsightsSampleStatus(
  businessDb: SqliteDatabase
): Promise<Array<{ label: string; count: number }>> {
  const insightTagLike = `%"test:insight"%`;
  const facts = await countRows(
    businessDb,
    `select count(*) as total from insight_facts where content like ?`,
    [`${TEST_FACT_PREFIX}%`]
  );
  const insights = await countRows(
    businessDb,
    `select count(*) as total from insights where title = ? or tags_json like ?`,
    [TEST_INSIGHT_TITLE, insightTagLike]
  );
  const scopeRules = await countRows(
    businessDb,
    `
      select count(*) as total
      from insight_scope_rules
      where insight_id in (
        select id from insights where title = ? or tags_json like ?
      )
    `,
    [TEST_INSIGHT_TITLE, insightTagLike]
  );
  const effectChannels = await countRows(
    businessDb,
    `
      select count(*) as total
      from insight_effect_channels
      where insight_id in (
        select id from insights where title = ? or tags_json like ?
      )
    `,
    [TEST_INSIGHT_TITLE, insightTagLike]
  );
  const effectPoints = await countRows(
    businessDb,
    `
      select count(*) as total
      from insight_effect_points
      where channel_id in (
        select id from insight_effect_channels
        where insight_id in (
          select id from insights where title = ? or tags_json like ?
        )
      )
    `,
    [TEST_INSIGHT_TITLE, insightTagLike]
  );
  return [
    { label: "事实", count: facts },
    { label: "观点", count: insights },
    { label: "作用范围", count: scopeRules },
    { label: "效果通道", count: effectChannels },
    { label: "效果点", count: effectPoints }
  ];
}

function aggregateOperationResult(
  operation: "inject" | "cleanup",
  startedAt: number,
  scenarios: MarketTestDataScenarioExecution[]
): InjectMarketTestDataResult | CleanupMarketTestDataResult {
  const result = scenarios.reduce(
    (acc, item) => {
      acc.inserted += item.inserted;
      acc.updated += item.updated;
      acc.skipped += item.skipped;
      acc.deleted += item.deleted;
      acc.warnings.push(...item.warnings);
      return acc;
    },
    {
      inserted: 0,
      updated: 0,
      skipped: 0,
      deleted: 0,
      warnings: [] as string[]
    }
  );

  return {
    operation,
    startedAt,
    finishedAt: Date.now(),
    inserted: result.inserted,
    updated: result.updated,
    skipped: result.skipped,
    deleted: result.deleted,
    warnings: result.warnings,
    scenarios
  };
}

async function countRows(
  db: SqliteDatabase,
  sql: string,
  params: unknown[] = []
): Promise<number> {
  const row = await get<{ total: number }>(db, sql, params);
  return Number(row?.total ?? 0);
}

async function deleteByCount(
  db: SqliteDatabase,
  countSql: string,
  deleteSql: string
): Promise<number> {
  const row = await get<{ total: number }>(db, countSql);
  const total = Number(row?.total ?? 0);
  if (total > 0) {
    await run(db, deleteSql);
  }
  return total;
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function buildIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || "未知错误。";
  if (typeof error === "string") return error;
  return "未知错误。";
}
