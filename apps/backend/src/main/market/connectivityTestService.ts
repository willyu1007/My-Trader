import type {
  ConnectivityTestRecord,
  DataDomainId
} from "@mytrader/shared";

import type { SqliteDatabase } from "../storage/sqlite";
import {
  getMarketDataSourceConfig,
  listConnectivityTestRecords,
  upsertConnectivityTestRecord
} from "../storage/marketDataSourceRepository";
import { getResolvedTokenForDomain } from "../storage/marketTokenRepository";
import {
  getDataDomainCatalogItem,
  getDataSourceModuleCatalogItem,
  isActiveProvider
} from "./dataSourceCatalog";
import { getMarketProvider } from "./providers";

const TEST_RESULT_STALE_MS = 24 * 60 * 60 * 1000;

export async function listConnectivityTests(
  businessDb: SqliteDatabase,
  now = Date.now()
): Promise<ConnectivityTestRecord[]> {
  const records = await listConnectivityTestRecords(businessDb);
  return records.map((record) => applyFreshness(record, now));
}

export async function testDomainConnectivity(input: {
  businessDb: SqliteDatabase;
  domainId: DataDomainId;
}): Promise<ConnectivityTestRecord> {
  const domainCatalog = getDataDomainCatalogItem(input.domainId);
  if (!domainCatalog) {
    throw new Error(`未知数据域：${input.domainId}`);
  }

  const config = await getMarketDataSourceConfig(input.businessDb);
  const domainConfig = config.domains[input.domainId];
  if (!domainConfig) {
    throw new Error(`缺少数据域配置：${input.domainId}`);
  }

  const baseRecord: ConnectivityTestRecord = {
    scope: "domain",
    domainId: input.domainId,
    moduleId: null,
    status: "untested",
    testedAt: null,
    message: null,
    stale: false
  };

  const providerId = domainConfig.provider;
  if (!isActiveProvider(providerId)) {
    return await persistRecord(input.businessDb, {
      ...baseRecord,
      status: "fail",
      testedAt: Date.now(),
      message: `数据源 ${providerId} 处于规划中，当前不可测试。`
    });
  }

  const resolved = await getResolvedTokenForDomain(input.businessDb, input.domainId);
  if (!resolved.token) {
    return await persistRecord(input.businessDb, {
      ...baseRecord,
      status: "fail",
      testedAt: Date.now(),
      message: "未配置可用令牌（域覆盖 / 主令牌 / 环境兜底）。"
    });
  }

  try {
    await runDomainProbe({
      providerId,
      token: resolved.token,
      domainId: input.domainId
    });

    return await persistRecord(input.businessDb, {
      ...baseRecord,
      status: "pass",
      testedAt: Date.now(),
      message: "域级连通性测试通过。"
    });
  } catch (error) {
    return await persistRecord(input.businessDb, {
      ...baseRecord,
      status: "fail",
      testedAt: Date.now(),
      message: toErrorMessage(error)
    });
  }
}

export async function testModuleConnectivity(input: {
  businessDb: SqliteDatabase;
  domainId: DataDomainId;
  moduleId: string;
}): Promise<ConnectivityTestRecord> {
  const moduleId = input.moduleId.trim();
  if (!moduleId) {
    throw new Error("moduleId 不能为空。");
  }

  const moduleCatalog = getDataSourceModuleCatalogItem(input.domainId, moduleId);
  if (!moduleCatalog) {
    throw new Error(`未知模块：${input.domainId}/${moduleId}`);
  }

  const baseRecord: ConnectivityTestRecord = {
    scope: "module",
    domainId: input.domainId,
    moduleId,
    status: "untested",
    testedAt: null,
    message: null,
    stale: false
  };

  if (!moduleCatalog.implemented || !moduleCatalog.syncCapable) {
    return await persistRecord(input.businessDb, {
      ...baseRecord,
      status: "unsupported",
      testedAt: null,
      message: "该模块尚未接入，当前不可纳入同步。",
      stale: false
    });
  }

  const config = await getMarketDataSourceConfig(input.businessDb);
  const domainConfig = config.domains[input.domainId];
  if (!domainConfig) {
    throw new Error(`缺少数据域配置：${input.domainId}`);
  }

  const providerId = domainConfig.provider;
  if (!isActiveProvider(providerId)) {
    return await persistRecord(input.businessDb, {
      ...baseRecord,
      status: "fail",
      testedAt: Date.now(),
      message: `数据源 ${providerId} 处于规划中，当前不可测试。`
    });
  }

  const resolved = await getResolvedTokenForDomain(input.businessDb, input.domainId);
  if (!resolved.token) {
    return await persistRecord(input.businessDb, {
      ...baseRecord,
      status: "fail",
      testedAt: Date.now(),
      message: "未配置可用令牌（域覆盖 / 主令牌 / 环境兜底）。"
    });
  }

  try {
    await runModuleProbe({
      providerId,
      token: resolved.token,
      domainId: input.domainId,
      moduleId
    });

    return await persistRecord(input.businessDb, {
      ...baseRecord,
      status: "pass",
      testedAt: Date.now(),
      message: "模块连通性测试通过。"
    });
  } catch (error) {
    return await persistRecord(input.businessDb, {
      ...baseRecord,
      status: "fail",
      testedAt: Date.now(),
      message: toErrorMessage(error)
    });
  }
}

async function runDomainProbe(input: {
  providerId: string;
  token: string;
  domainId: DataDomainId;
}): Promise<void> {
  if (input.providerId !== "tushare") {
    throw new Error(`当前版本仅支持 tushare 连通性测试：${input.providerId}`);
  }

  const provider = getMarketProvider("tushare");
  await provider.testToken(input.token);
}

async function runModuleProbe(input: {
  providerId: string;
  token: string;
  domainId: DataDomainId;
  moduleId: string;
}): Promise<void> {
  if (input.providerId !== "tushare") {
    throw new Error(`当前版本仅支持 tushare 连通性测试：${input.providerId}`);
  }

  const provider = getMarketProvider("tushare");
  const endDate = formatDate(new Date());
  const startDate = formatDate(addDays(new Date(), -30));

  switch (input.moduleId) {
    case "stock.basic": {
      await provider.testToken(input.token);
      return;
    }
    case "stock.market.daily": {
      await provider.fetchDailyPrices({
        token: input.token,
        items: [{ symbol: "000001.SZ", assetClass: "stock" }],
        startDate,
        endDate
      });
      return;
    }
    case "stock.reference": {
      const calendar = await provider.fetchTradingCalendar({
        token: input.token,
        market: "CN",
        startDate,
        endDate
      });
      if (calendar.length === 0) {
        throw new Error("交易日历探针未返回数据。请检查权限或网络。");
      }
      return;
    }
    case "stock.moneyflow": {
      await provider.fetchDailyMoneyflows({
        token: input.token,
        symbol: "000001.SZ",
        startDate,
        endDate
      });
      return;
    }
    case "etf.basic_info": {
      const catalog = await provider.fetchInstrumentCatalog({
        token: input.token
      });
      const hasEtf = catalog.some((item) => item.assetClass === "etf");
      if (!hasEtf) {
        throw new Error("ETF 探针未返回可用数据。请检查 token 权限。 ");
      }
      return;
    }
    case "etf.daily_quote": {
      await provider.fetchDailyPrices({
        token: input.token,
        items: [{ symbol: "510300.SH", assetClass: "etf" }],
        startDate,
        endDate
      });
      return;
    }
    default: {
      throw new Error(`模块 ${input.moduleId} 尚未配置连通性探针。`);
    }
  }
}

async function persistRecord(
  businessDb: SqliteDatabase,
  record: ConnectivityTestRecord
): Promise<ConnectivityTestRecord> {
  const saved = await upsertConnectivityTestRecord(businessDb, record);
  return applyFreshness(saved);
}

function applyFreshness(
  record: ConnectivityTestRecord,
  now = Date.now()
): ConnectivityTestRecord {
  if (!record.testedAt) return { ...record, stale: false };
  if (record.status !== "pass" && record.status !== "fail") {
    return { ...record, stale: false };
  }
  const staleByTtl = now - record.testedAt > TEST_RESULT_STALE_MS;
  return {
    ...record,
    stale: Boolean(record.stale || staleByTtl)
  };
}

function addDays(date: Date, days: number): Date {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return String(error);
}
