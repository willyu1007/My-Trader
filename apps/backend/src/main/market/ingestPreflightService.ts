import type {
  ConnectivityTestRecord,
  DataDomainId,
  IngestPreflightResult,
  RunIngestPreflightInput
} from "@mytrader/shared";

import { getMarketDataSourceConfig } from "../storage/marketDataSourceRepository";
import type { SqliteDatabase } from "../storage/sqlite";
import {
  testDomainConnectivity,
  testModuleConnectivity
} from "./connectivityTestService";
import { validateDataSourceReadiness } from "./dataSourceReadinessService";
import { getDataSourceCatalog } from "./dataSourceCatalog";

const TARGET_SCOPE_MODULE_IDS = new Set([
  "stock.market.daily",
  "stock.moneyflow",
  "etf.daily_quote"
]);

export async function runIngestPreflight(input: {
  businessDb: SqliteDatabase;
  scope?: RunIngestPreflightInput["scope"];
}): Promise<IngestPreflightResult> {
  const scope = input.scope ?? "both";
  const [catalog, config] = await Promise.all([
    Promise.resolve(getDataSourceCatalog()),
    getMarketDataSourceConfig(input.businessDb)
  ]);

  const selectedDomains: DataDomainId[] = [];
  const selectedModules: Array<{ domainId: DataDomainId; moduleId: string }> = [];

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
    if (enabledModules.length === 0) continue;

    selectedDomains.push(domain.id);
    enabledModules.forEach((module) => {
      selectedModules.push({
        domainId: domain.id,
        moduleId: module.id
      });
    });
  }

  const refreshedDomainTests: ConnectivityTestRecord[] = [];
  for (const domainId of selectedDomains) {
    refreshedDomainTests.push(
      await testDomainConnectivity({
        businessDb: input.businessDb,
        domainId
      })
    );
  }

  const refreshedModuleTests: ConnectivityTestRecord[] = [];
  for (const module of selectedModules) {
    refreshedModuleTests.push(
      await testModuleConnectivity({
        businessDb: input.businessDb,
        domainId: module.domainId,
        moduleId: module.moduleId
      })
    );
  }

  const readiness = await validateDataSourceReadiness({
    businessDb: input.businessDb,
    scope
  });

  return {
    scope,
    selectedDomains: readiness.selectedDomains,
    selectedModules: readiness.selectedModules,
    refreshedDomainTests,
    refreshedModuleTests,
    readiness,
    updatedAt: Date.now()
  };
}
