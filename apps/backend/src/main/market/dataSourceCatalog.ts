import type {
  DataDomainId,
  DataSourceDomainCatalogItem,
  DataSourceModuleCatalogItem,
  DataSourceProviderInfo,
  MarketDataSourceCatalog,
  MarketDataSourceConfigV2
} from "@mytrader/shared";

type DomainModuleSeed = Omit<DataSourceModuleCatalogItem, "providerIds"> & {
  providerIds?: string[];
};

type DomainSeed = Omit<DataSourceDomainCatalogItem, "modules"> & {
  modules: DomainModuleSeed[];
};

const PROVIDERS: DataSourceProviderInfo[] = [
  {
    id: "tushare",
    label: "Tushare",
    status: "active",
    homepage: "https://tushare.pro"
  },
  {
    id: "akshare",
    label: "AkShare",
    status: "planned",
    homepage: "https://www.akshare.xyz"
  },
  {
    id: "wind",
    label: "Wind",
    status: "planned",
    homepage: null
  }
];

const DOMAIN_SEEDS: DomainSeed[] = [
  {
    id: "stock",
    label: "股票数据",
    modules: [
      { id: "stock.basic", label: "基础数据", implemented: true, syncCapable: true, defaultEnabled: true },
      { id: "stock.market.daily", label: "行情数据", implemented: true, syncCapable: true, defaultEnabled: true },
      { id: "stock.finance", label: "财务数据", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "stock.reference", label: "参考数据", implemented: true, syncCapable: true, defaultEnabled: true },
      { id: "stock.feature", label: "特色数据", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "stock.margin", label: "两融及转融通", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "stock.moneyflow", label: "资金流向数据", implemented: true, syncCapable: true, defaultEnabled: true },
      { id: "stock.board_concept", label: "板块专题数据", implemented: false, syncCapable: false, defaultEnabled: false }
    ]
  },
  {
    id: "etf",
    label: "ETF专题",
    modules: [
      { id: "etf.basic_info", label: "ETF基本信息", implemented: true, syncCapable: true, defaultEnabled: true },
      { id: "etf.benchmark", label: "ETF基准指数", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "etf.realtime_min", label: "ETF实时分钟", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "etf.history_min", label: "ETF历史分钟", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "etf.realtime_daily", label: "ETF实时日线", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "etf.daily_quote", label: "ETF日线行情", implemented: true, syncCapable: true, defaultEnabled: true },
      { id: "etf.adj_factor", label: "ETF复权因子", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "etf.share_scale", label: "ETF份额规模", implemented: false, syncCapable: false, defaultEnabled: false }
    ]
  },
  {
    id: "index",
    label: "指数专题",
    modules: [
      { id: "index.basic", label: "指数基本信息", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "index.daily", label: "指数日线行情", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "index.realtime_daily", label: "指数实时日线", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "index.realtime_min", label: "指数实时分钟", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "index.weekly", label: "指数周线行情", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "index.monthly", label: "指数月线行情", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "index.history_min", label: "指数历史分钟", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "index.components_weights", label: "指数成分和权重", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "index.market_indicators", label: "大盘指数每日指标", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "index.sw_classification", label: "申万行业分类", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "index.sw_components", label: "申万行业成分（分级）", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "index.sw_daily", label: "申万行业指数日行情", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "index.sw_realtime", label: "申万实时行情", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "index.citic_components", label: "中信行业成分", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "index.citic_daily", label: "中信行业指数日行情", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "index.global_major", label: "国际主要指数", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "index.tech_factor", label: "指数技术面因子", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "index.market_stats_shsz", label: "沪深市场每日交易统计", implemented: false, syncCapable: false, defaultEnabled: false }
    ]
  },
  {
    id: "public_fund",
    label: "公募基金",
    modules: [
      { id: "fund.basic", label: "基本信息", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "fund.nav", label: "基金净值", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "fund.adj_nav", label: "复权净值", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "fund.holdings", label: "基金持仓", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "fund.scale", label: "基金规模", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "fund.dividend", label: "分红", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "fund.manager", label: "基金经理", implemented: false, syncCapable: false, defaultEnabled: false }
    ]
  },
  {
    id: "futures",
    label: "期货数据",
    modules: [
      { id: "futures.basic", label: "基础信息", implemented: true, syncCapable: true, defaultEnabled: true },
      { id: "futures.daily", label: "日线行情", implemented: true, syncCapable: true, defaultEnabled: true },
      { id: "futures.min", label: "分钟行情", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "futures.main_contract", label: "主力连续", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "futures.position_warehouse", label: "持仓/仓单", implemented: false, syncCapable: false, defaultEnabled: false }
    ]
  },
  {
    id: "spot",
    label: "现货数据",
    modules: [
      { id: "spot.sge_basic", label: "上海黄金基础信息", implemented: true, syncCapable: true, defaultEnabled: true },
      { id: "spot.sge_daily", label: "上海黄金现货日行情", implemented: true, syncCapable: true, defaultEnabled: true }
    ]
  },
  {
    id: "options",
    label: "期权数据",
    modules: [
      { id: "options.basic", label: "基础信息", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "options.daily", label: "日线行情", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "options.min", label: "分钟行情", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "options.greeks", label: "Greeks", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "options.exercise_expiry", label: "行权与到期", implemented: false, syncCapable: false, defaultEnabled: false }
    ]
  },
  {
    id: "bond",
    label: "债券专题",
    modules: [
      { id: "bond.cb_basic", label: "可转债基础信息", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "bond.cb_issue", label: "可转债发行", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "bond.cb_redeem", label: "可转债赎回信息", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "bond.cb_coupon", label: "可转债票面利率", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "bond.cb_quote", label: "可转债行情", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "bond.cb_tech_factor", label: "可转债技术面因子", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "bond.cb_conv_price", label: "可转债转股价变动", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "bond.cb_conv_result", label: "可转债转股结果", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "bond.repo_daily", label: "债券回购日行情", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "bond.otc_quote", label: "柜台流通式债券报价", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "bond.otc_best_quote", label: "柜台流通式债券最优报价", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "bond.block_trade", label: "大宗交易", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "bond.block_trade_detail", label: "大宗交易明细", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "bond.yield_curve", label: "国债收益率曲线", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "bond.global_events", label: "全球财经事件", implemented: false, syncCapable: false, defaultEnabled: false }
    ]
  },
  {
    id: "fx",
    label: "外汇数据",
    modules: [
      { id: "fx.basic", label: "外汇基础信息", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "fx.daily", label: "外汇日线行情", implemented: false, syncCapable: false, defaultEnabled: false }
    ]
  },
  {
    id: "hk_stock",
    label: "港股数据",
    modules: [
      { id: "hk.basic", label: "港股基本信息", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "hk.calendar", label: "港股交易日历", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "hk.daily", label: "港股日线行情", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "hk.adj_daily", label: "港股复权行情", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "hk.adj_factor", label: "港股复权因子", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "hk.min", label: "港股分钟行情", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "hk.realtime_daily", label: "港股实时日线", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "hk.income", label: "港股利润表", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "hk.balance", label: "港股资产负债表", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "hk.cashflow", label: "港股现金流量表", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "hk.fin_indicator", label: "港股财务指标数据", implemented: false, syncCapable: false, defaultEnabled: false }
    ]
  },
  {
    id: "us_stock",
    label: "美股数据",
    modules: [
      { id: "us.basic", label: "美股基本信息", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "us.calendar", label: "美股交易日历", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "us.daily", label: "美股日线行情", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "us.adj_daily", label: "美股复权行情", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "us.adj_factor", label: "美股复权因子", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "us.income", label: "美股利润表", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "us.balance", label: "美股资产负债表", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "us.cashflow", label: "美股现金流量表", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "us.fin_indicator", label: "美股财务指标数据", implemented: false, syncCapable: false, defaultEnabled: false }
    ]
  },
  {
    id: "industry_economy",
    label: "行业经济",
    modules: [
      { id: "industry.classification", label: "行业分类", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "industry.components", label: "行业成分", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "industry.index_daily", label: "行业指数", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "industry.prosperity", label: "行业景气", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "industry.indicators", label: "行业指标", implemented: false, syncCapable: false, defaultEnabled: false }
    ]
  },
  {
    id: "macro",
    label: "宏观经济",
    modules: [
      { id: "macro.rates", label: "利率数据", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "macro.national_economy", label: "国民经济", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "macro.price_index", label: "价格指数", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "macro.financial", label: "金融", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "macro.sentiment", label: "景气度", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "macro.fiscal_tax", label: "财政税收", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "macro.employment", label: "就业", implemented: false, syncCapable: false, defaultEnabled: false },
      { id: "macro.events", label: "宏观事件日历", implemented: false, syncCapable: false, defaultEnabled: false }
    ]
  }
];

const DOMAIN_IDS: DataDomainId[] = DOMAIN_SEEDS.map((item) => item.id);

const DOMAINS: DataSourceDomainCatalogItem[] = DOMAIN_SEEDS.map((domain) => ({
  id: domain.id,
  label: domain.label,
  modules: domain.modules.map((module) => ({
    ...module,
    providerIds:
      module.providerIds && module.providerIds.length > 0
        ? [...module.providerIds]
        : ["tushare"]
  }))
}));

const ACTIVE_PROVIDER_IDS = new Set(
  PROVIDERS.filter((item) => item.status === "active").map((item) => item.id)
);

export function getDataSourceCatalog(): MarketDataSourceCatalog {
  return {
    providers: PROVIDERS.map((item) => ({ ...item })),
    domains: DOMAINS.map((domain) => ({
      id: domain.id,
      label: domain.label,
      modules: domain.modules.map((module) => ({ ...module }))
    })),
    updatedAt: Date.now()
  };
}

export function listDataDomainIds(): DataDomainId[] {
  return [...DOMAIN_IDS];
}

export function getDataDomainCatalogItem(
  domainId: DataDomainId
): DataSourceDomainCatalogItem | null {
  return DOMAINS.find((item) => item.id === domainId) ?? null;
}

export function getDataSourceModuleCatalogItem(
  domainId: DataDomainId,
  moduleId: string
): DataSourceModuleCatalogItem | null {
  const domain = getDataDomainCatalogItem(domainId);
  if (!domain) return null;
  return domain.modules.find((module) => module.id === moduleId) ?? null;
}

export function isActiveProvider(providerId: string): boolean {
  return ACTIVE_PROVIDER_IDS.has(providerId);
}

export function buildDefaultDataSourceConfig(): MarketDataSourceConfigV2 {
  const domains = DOMAIN_SEEDS.reduce((acc, domain) => {
    const moduleEntries = domain.modules.reduce((moduleAcc, module) => {
      moduleAcc[module.id] = { enabled: Boolean(module.defaultEnabled) };
      return moduleAcc;
    }, {} as Record<string, { enabled: boolean }>);

    const enabledByDefault =
      domain.id === "stock" ||
      domain.id === "etf" ||
      domain.id === "futures" ||
      domain.id === "spot";

    acc[domain.id] = {
      enabled: enabledByDefault,
      provider: "tushare",
      tokenMode: "inherit_main",
      modules: moduleEntries
    };
    return acc;
  }, {} as MarketDataSourceConfigV2["domains"]);

  return {
    version: 2,
    mainProvider: "tushare",
    domains
  };
}

export function toLegacyUniversePoolBuckets(
  config: MarketDataSourceConfigV2
): Array<"cn_a" | "etf" | "metal_futures" | "metal_spot"> {
  const result = new Set<"cn_a" | "etf" | "metal_futures" | "metal_spot">();
  const stock = config.domains.stock;
  const etf = config.domains.etf;
  const futures = config.domains.futures;
  const spot = config.domains.spot;
  if (stock?.enabled && hasAnyEnabledSyncModule(stock.modules, "stock")) {
    result.add("cn_a");
  }
  if (etf?.enabled && hasAnyEnabledSyncModule(etf.modules, "etf")) {
    result.add("etf");
  }
  if (futures?.enabled && hasAnyEnabledSyncModule(futures.modules, "futures")) {
    result.add("metal_futures");
  }
  if (spot?.enabled && hasAnyEnabledSyncModule(spot.modules, "spot")) {
    result.add("metal_spot");
  }
  return Array.from(result.values());
}

export function mergeLegacyBucketsIntoDataSourceConfig(
  config: MarketDataSourceConfigV2,
  buckets: Array<"cn_a" | "etf" | "metal_futures" | "metal_spot">
): MarketDataSourceConfigV2 {
  const next: MarketDataSourceConfigV2 = {
    version: 2,
    mainProvider: config.mainProvider,
    domains: { ...config.domains }
  };
  const enabled = new Set(buckets);
  if (next.domains.stock) {
    const stockEnabled = enabled.has("cn_a");
    next.domains.stock = {
      ...next.domains.stock,
      enabled: stockEnabled,
      modules: {
        ...next.domains.stock.modules,
        "stock.basic": { enabled: stockEnabled },
        "stock.market.daily": { enabled: stockEnabled },
        "stock.reference": { enabled: stockEnabled },
        "stock.moneyflow": { enabled: stockEnabled }
      }
    };
  }
  if (next.domains.etf) {
    const etfEnabled = enabled.has("etf");
    next.domains.etf = {
      ...next.domains.etf,
      enabled: etfEnabled,
      modules: {
        ...next.domains.etf.modules,
        "etf.basic_info": { enabled: etfEnabled },
        "etf.daily_quote": { enabled: etfEnabled }
      }
    };
  }
  if (next.domains.futures) {
    const futuresEnabled = enabled.has("metal_futures");
    next.domains.futures = {
      ...next.domains.futures,
      enabled: futuresEnabled,
      modules: {
        ...next.domains.futures.modules,
        "futures.basic": { enabled: futuresEnabled },
        "futures.daily": { enabled: futuresEnabled }
      }
    };
  }
  if (next.domains.spot) {
    const spotEnabled = enabled.has("metal_spot");
    next.domains.spot = {
      ...next.domains.spot,
      enabled: spotEnabled,
      modules: {
        ...next.domains.spot.modules,
        "spot.sge_basic": { enabled: spotEnabled },
        "spot.sge_daily": { enabled: spotEnabled }
      }
    };
  }
  return next;
}

function hasAnyEnabledSyncModule(
  modules: Record<string, { enabled: boolean }>,
  domainId: DataDomainId
): boolean {
  const domain = getDataDomainCatalogItem(domainId);
  if (!domain) return false;
  return domain.modules.some(
    (module) =>
      module.implemented &&
      module.syncCapable &&
      Boolean(modules[module.id]?.enabled)
  );
}
