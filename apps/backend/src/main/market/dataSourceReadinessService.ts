import type {
  ConnectivityTestRecord,
  DataDomainId,
  DataSourceReadinessIssue,
  DataSourceReadinessResult,
  ValidateDataSourceReadinessInput
} from "@mytrader/shared";

import type { SqliteDatabase } from "../storage/sqlite";
import { getMarketTokenMatrixStatus } from "../storage/marketTokenRepository";
import { getMarketDataSourceConfig } from "../storage/marketDataSourceRepository";
import { getDataSourceCatalog, isActiveProvider } from "./dataSourceCatalog";
import { listConnectivityTests } from "./connectivityTestService";

const TARGET_SCOPE_MODULE_IDS = new Set([
  "stock.market.daily",
  "stock.moneyflow",
  "etf.daily_quote"
]);

export async function validateDataSourceReadiness(input: {
  businessDb: SqliteDatabase;
  scope?: ValidateDataSourceReadinessInput["scope"];
}): Promise<DataSourceReadinessResult> {
  const scope = input.scope ?? "both";

  const [catalog, config, tokenMatrix, tests] = await Promise.all([
    Promise.resolve(getDataSourceCatalog()),
    getMarketDataSourceConfig(input.businessDb),
    getMarketTokenMatrixStatus(input.businessDb),
    listConnectivityTests(input.businessDb)
  ]);

  const testMap = buildTestMap(tests);
  const issues: DataSourceReadinessIssue[] = [];
  const selectedDomains: DataDomainId[] = [];
  const selectedModules: { domainId: DataDomainId; moduleId: string }[] = [];

  for (const domain of catalog.domains) {
    const domainConfig = config.domains[domain.id];
    if (!domainConfig?.enabled) continue;

    const enabledModules = domain.modules.filter((module) => {
      if (!domainConfig.modules[module.id]?.enabled) return false;
      if (scope === "targets") {
        return TARGET_SCOPE_MODULE_IDS.has(module.id);
      }
      return true;
    });

    if (enabledModules.length === 0) {
      issues.push({
        level: "error",
        code: "DOMAIN_HAS_NO_ENABLED_MODULES",
        message: `数据域「${domain.label}」未启用可同步模块。`,
        domainId: domain.id,
        moduleId: null
      });
      continue;
    }

    selectedDomains.push(domain.id);

    if (!isActiveProvider(domainConfig.provider)) {
      issues.push({
        level: "error",
        code: "DOMAIN_PROVIDER_NOT_ACTIVE",
        message: `数据域「${domain.label}」使用的数据源「${domainConfig.provider}」尚不可用。`,
        domainId: domain.id,
        moduleId: null
      });
    }

    const tokenStatus = tokenMatrix.domains[domain.id];
    if (!tokenStatus?.configured) {
      issues.push({
        level: "error",
        code: "DOMAIN_TOKEN_MISSING",
        message: `数据域「${domain.label}」缺少可用令牌（域覆盖/主令牌/env兜底）。`,
        domainId: domain.id,
        moduleId: null
      });
    }

    const domainTest = testMap.get(buildDomainTestKey(domain.id));
    if (!domainTest) {
      issues.push({
        level: "error",
        code: "DOMAIN_TEST_REQUIRED",
        message: `数据域「${domain.label}」尚未完成连通性测试。`,
        domainId: domain.id,
        moduleId: null
      });
    } else if (domainTest.status === "fail") {
      issues.push({
        level: "error",
        code: "DOMAIN_TEST_FAILED",
        message:
          domainTest.message ?? `数据域「${domain.label}」连通性测试失败。`,
        domainId: domain.id,
        moduleId: null
      });
    } else if (domainTest.status !== "pass") {
      issues.push({
        level: "error",
        code: "DOMAIN_TEST_REQUIRED",
        message: `数据域「${domain.label}」尚未通过连通性测试。`,
        domainId: domain.id,
        moduleId: null
      });
    } else if (domainTest.stale) {
      issues.push({
        level: "error",
        code: "DOMAIN_TEST_STALE",
        message: `数据域「${domain.label}」测试结果已过期，请重新测试。`,
        domainId: domain.id,
        moduleId: null
      });
    }

    for (const module of enabledModules) {
      selectedModules.push({
        domainId: domain.id,
        moduleId: module.id
      });

      if (!module.implemented || !module.syncCapable) {
        issues.push({
          level: "error",
          code: "MODULE_NOT_SYNC_CAPABLE",
          message: `模块「${module.label}」尚未接入，当前不可纳入同步。`,
          domainId: domain.id,
          moduleId: module.id
        });
        continue;
      }

      const moduleTest = testMap.get(buildModuleTestKey(domain.id, module.id));
      if (!moduleTest) {
        issues.push({
          level: "error",
          code: "MODULE_TEST_REQUIRED",
          message: `模块「${module.label}」尚未完成连通性测试。`,
          domainId: domain.id,
          moduleId: module.id
        });
        continue;
      }

      if (moduleTest.status === "unsupported") {
        issues.push({
          level: "error",
          code: "MODULE_NOT_SYNC_CAPABLE",
          message: `模块「${module.label}」尚未接入，当前不可纳入同步。`,
          domainId: domain.id,
          moduleId: module.id
        });
        continue;
      }

      if (moduleTest.status === "fail") {
        issues.push({
          level: "error",
          code: "MODULE_TEST_FAILED",
          message:
            moduleTest.message ?? `模块「${module.label}」连通性测试失败。`,
          domainId: domain.id,
          moduleId: module.id
        });
        continue;
      }

      if (moduleTest.status !== "pass") {
        issues.push({
          level: "error",
          code: "MODULE_TEST_REQUIRED",
          message: `模块「${module.label}」尚未通过连通性测试。`,
          domainId: domain.id,
          moduleId: module.id
        });
        continue;
      }

      if (moduleTest.stale) {
        issues.push({
          level: "error",
          code: "MODULE_TEST_STALE",
          message: `模块「${module.label}」测试结果已过期，请重新测试。`,
          domainId: domain.id,
          moduleId: module.id
        });
      }
    }
  }

  if (selectedDomains.length === 0 || selectedModules.length === 0) {
    issues.push({
      level: "error",
      code: "NO_SYNC_MODULE_SELECTED",
      message: "当前没有可执行同步的模块，请先启用并测试至少一个模块。",
      domainId: null,
      moduleId: null
    });
  }

  return {
    ready: issues.every((issue) => issue.level !== "error"),
    selectedDomains,
    selectedModules,
    issues,
    updatedAt: Date.now()
  };
}

function buildTestMap(
  records: ConnectivityTestRecord[]
): Map<string, ConnectivityTestRecord> {
  const map = new Map<string, ConnectivityTestRecord>();
  records.forEach((record) => {
    if (record.scope === "domain") {
      map.set(buildDomainTestKey(record.domainId), record);
      return;
    }
    if (record.moduleId) {
      map.set(buildModuleTestKey(record.domainId, record.moduleId), record);
    }
  });
  return map;
}

function buildDomainTestKey(domainId: DataDomainId): string {
  return `domain:${domainId}`;
}

function buildModuleTestKey(domainId: DataDomainId, moduleId: string): string {
  return `module:${domainId}:${moduleId}`;
}
