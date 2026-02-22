import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";

import type {
  ListInstrumentRegistryResult,
  MarketIngestControlStatus,
  MarketIngestSchedulerConfig,
  MarketIngestRun,
  MarketTokenStatus,
  MarketUniversePoolConfig,
  MarketUniversePoolOverview
} from "@mytrader/shared";

export interface UseDashboardMarketAdminRefreshOptions {
  marketRegistryQuery: string;
  marketRegistryAutoFilter: "all" | "enabled" | "disabled";
  toUserErrorMessage: (err: unknown) => string;
  setError: Dispatch<SetStateAction<string | null>>;
  setMarketTokenStatus: Dispatch<SetStateAction<MarketTokenStatus | null>>;
  setMarketIngestRuns: Dispatch<SetStateAction<MarketIngestRun[]>>;
  setMarketIngestRunsLoading: Dispatch<SetStateAction<boolean>>;
  setMarketIngestControlStatus: Dispatch<
    SetStateAction<MarketIngestControlStatus | null>
  >;
  setMarketSchedulerConfig: Dispatch<
    SetStateAction<MarketIngestSchedulerConfig | null>
  >;
  setMarketSchedulerSavedConfig: Dispatch<
    SetStateAction<MarketIngestSchedulerConfig | null>
  >;
  setMarketSchedulerLoading: Dispatch<SetStateAction<boolean>>;
  setMarketUniversePoolConfig: Dispatch<
    SetStateAction<MarketUniversePoolConfig | null>
  >;
  setMarketUniversePoolSavedConfig: Dispatch<
    SetStateAction<MarketUniversePoolConfig | null>
  >;
  setMarketUniversePoolOverview: Dispatch<
    SetStateAction<MarketUniversePoolOverview | null>
  >;
  setMarketUniversePoolLoading: Dispatch<SetStateAction<boolean>>;
  setMarketRegistryResult: Dispatch<SetStateAction<ListInstrumentRegistryResult | null>>;
  setMarketRegistryLoading: Dispatch<SetStateAction<boolean>>;
  setMarketRegistrySelectedSymbols: Dispatch<SetStateAction<string[]>>;
  setMarketSelectedIngestRunId: Dispatch<SetStateAction<string | null>>;
  setMarketSelectedIngestRun: Dispatch<SetStateAction<MarketIngestRun | null>>;
  setMarketSelectedIngestRunLoading: Dispatch<SetStateAction<boolean>>;
}

export function useDashboardMarketAdminRefresh(
  options: UseDashboardMarketAdminRefreshOptions
) {
  const refreshMarketTokenStatus = useCallback(async () => {
    if (!window.mytrader) return;
    try {
      const status = await window.mytrader.market.getTokenStatus();
      options.setMarketTokenStatus(status);
    } catch (err) {
      options.setError(options.toUserErrorMessage(err));
    }
  }, [options.setError, options.setMarketTokenStatus, options.toUserErrorMessage]);

  const refreshMarketIngestRuns = useCallback(async () => {
    if (!window.mytrader) return;
    options.setMarketIngestRunsLoading(true);
    try {
      const runs = await window.mytrader.market.listIngestRuns({ limit: 100 });
      options.setMarketIngestRuns(runs);
    } catch (err) {
      options.setError(options.toUserErrorMessage(err));
      options.setMarketIngestRuns([]);
    } finally {
      options.setMarketIngestRunsLoading(false);
    }
  }, [
    options.setError,
    options.setMarketIngestRuns,
    options.setMarketIngestRunsLoading,
    options.toUserErrorMessage
  ]);

  const refreshMarketIngestControl = useCallback(async () => {
    if (!window.mytrader) return;
    try {
      const status = await window.mytrader.market.getIngestControlStatus();
      options.setMarketIngestControlStatus(status);
    } catch (err) {
      options.setError(options.toUserErrorMessage(err));
    }
  }, [
    options.setError,
    options.setMarketIngestControlStatus,
    options.toUserErrorMessage
  ]);

  const refreshMarketSchedulerConfig = useCallback(async () => {
    if (!window.mytrader) return;
    options.setMarketSchedulerLoading(true);
    try {
      const config = await window.mytrader.market.getIngestSchedulerConfig();
      options.setMarketSchedulerConfig(config);
      options.setMarketSchedulerSavedConfig(config);
    } catch (err) {
      options.setError(options.toUserErrorMessage(err));
    } finally {
      options.setMarketSchedulerLoading(false);
    }
  }, [
    options.setError,
    options.setMarketSchedulerConfig,
    options.setMarketSchedulerLoading,
    options.setMarketSchedulerSavedConfig,
    options.toUserErrorMessage
  ]);

  const refreshMarketUniversePool = useCallback(async () => {
    if (!window.mytrader) return;
    options.setMarketUniversePoolLoading(true);
    try {
      const [config, overview] = await Promise.all([
        window.mytrader.market.getUniversePoolConfig(),
        window.mytrader.market.getUniversePoolOverview()
      ]);
      options.setMarketUniversePoolConfig(config);
      options.setMarketUniversePoolSavedConfig(config);
      options.setMarketUniversePoolOverview(overview);
    } catch (err) {
      options.setError(options.toUserErrorMessage(err));
    } finally {
      options.setMarketUniversePoolLoading(false);
    }
  }, [
    options.setError,
    options.setMarketUniversePoolConfig,
    options.setMarketUniversePoolLoading,
    options.setMarketUniversePoolOverview,
    options.setMarketUniversePoolSavedConfig,
    options.toUserErrorMessage
  ]);

  const refreshMarketUniversePoolOverview = useCallback(async () => {
    if (!window.mytrader) return;
    try {
      const overview = await window.mytrader.market.getUniversePoolOverview();
      options.setMarketUniversePoolOverview(overview);
    } catch (err) {
      options.setError(options.toUserErrorMessage(err));
    }
  }, [
    options.setError,
    options.setMarketUniversePoolOverview,
    options.toUserErrorMessage
  ]);

  const refreshMarketRegistry = useCallback(async () => {
    if (!window.mytrader) return;
    options.setMarketRegistryLoading(true);
    try {
      const result = await window.mytrader.market.listInstrumentRegistry({
        query: options.marketRegistryQuery.trim()
          ? options.marketRegistryQuery.trim()
          : null,
        autoIngest: options.marketRegistryAutoFilter,
        limit: 200,
        offset: 0
      });
      options.setMarketRegistryResult(result);
      options.setMarketRegistrySelectedSymbols((prev) =>
        prev.filter((symbol) => result.items.some((item) => item.symbol === symbol))
      );
    } catch (err) {
      options.setError(options.toUserErrorMessage(err));
      options.setMarketRegistryResult(null);
    } finally {
      options.setMarketRegistryLoading(false);
    }
  }, [
    options.marketRegistryAutoFilter,
    options.marketRegistryQuery,
    options.setError,
    options.setMarketRegistryLoading,
    options.setMarketRegistryResult,
    options.setMarketRegistrySelectedSymbols,
    options.toUserErrorMessage
  ]);

  const refreshMarketIngestRunDetail = useCallback(
    async (runId: string) => {
      if (!window.mytrader) return;
      const id = runId.trim();
      if (!id) {
        options.setMarketSelectedIngestRunId(null);
        options.setMarketSelectedIngestRun(null);
        return;
      }
      options.setMarketSelectedIngestRunId(id);
      options.setMarketSelectedIngestRunLoading(true);
      try {
        const detail = await window.mytrader.market.getIngestRunDetail({ id });
        options.setMarketSelectedIngestRun(detail);
      } catch (err) {
        options.setError(options.toUserErrorMessage(err));
        options.setMarketSelectedIngestRun(null);
      } finally {
        options.setMarketSelectedIngestRunLoading(false);
      }
    },
    [
      options.setError,
      options.setMarketSelectedIngestRun,
      options.setMarketSelectedIngestRunId,
      options.setMarketSelectedIngestRunLoading,
      options.toUserErrorMessage
    ]
  );

  return {
    refreshMarketTokenStatus,
    refreshMarketIngestRuns,
    refreshMarketIngestControl,
    refreshMarketSchedulerConfig,
    refreshMarketUniversePool,
    refreshMarketUniversePoolOverview,
    refreshMarketRegistry,
    refreshMarketIngestRunDetail
  };
}
