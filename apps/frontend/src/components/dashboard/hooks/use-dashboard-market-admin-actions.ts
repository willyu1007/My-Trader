import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";

import type {
  DataSourceReadinessResult,
  MarketTokenStatus,
  MarketUniversePoolConfig,
  MarketUniversePoolOverview
} from "@mytrader/shared";

type UniversePoolBucketId = MarketUniversePoolConfig["enabledBuckets"][number];

export interface UseDashboardMarketAdminActionsOptions {
  marketTokenProvider: string;
  marketTokenDraft: string;
  marketUniversePoolConfig: MarketUniversePoolConfig | null;
  refreshMarketTokenStatus: () => Promise<void>;
  refreshMarketIngestRuns: () => Promise<void>;
  refreshMarketIngestControl: () => Promise<void>;
  refreshMarketTargetPoolStats: () => Promise<void>;
  toUserErrorMessage: (err: unknown) => string;
  universePoolBucketOrder: UniversePoolBucketId[];
  setError: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setMarketTokenStatus: Dispatch<SetStateAction<MarketTokenStatus | null>>;
  setMarketTokenDraft: Dispatch<SetStateAction<string>>;
  setMarketTokenSaving: Dispatch<SetStateAction<boolean>>;
  setMarketTokenTesting: Dispatch<SetStateAction<boolean>>;
  setMarketUniversePoolConfig: Dispatch<
    SetStateAction<MarketUniversePoolConfig | null>
  >;
  setMarketUniversePoolSavedConfig: Dispatch<
    SetStateAction<MarketUniversePoolConfig | null>
  >;
  setMarketUniversePoolOverview: Dispatch<
    SetStateAction<MarketUniversePoolOverview | null>
  >;
  setMarketUniversePoolSaving: Dispatch<SetStateAction<boolean>>;
  setMarketIngestTriggering: Dispatch<SetStateAction<boolean>>;
  setMarketTriggerIngestBlockedOpen?: Dispatch<SetStateAction<boolean>>;
  setMarketTriggerIngestBlockedMessage?: Dispatch<SetStateAction<string>>;
}

export function useDashboardMarketAdminActions(
  options: UseDashboardMarketAdminActionsOptions
) {
  const handleOpenMarketProvider = useCallback(async () => {
    if (!window.mytrader) return;
    try {
      await window.mytrader.market.openProviderHomepage({
        provider: options.marketTokenProvider
      });
    } catch (err) {
      options.setError(options.toUserErrorMessage(err));
    }
  }, [options.marketTokenProvider, options.setError, options.toUserErrorMessage]);

  const handleSaveMarketToken = useCallback(async () => {
    if (!window.mytrader) return;
    options.setError(null);
    options.setNotice(null);
    options.setMarketTokenSaving(true);
    try {
      const token = options.marketTokenDraft.trim();
      const status = await window.mytrader.market.setToken({
        token: token ? token : null
      });
      options.setMarketTokenStatus(status);
      options.setMarketTokenDraft("");
      options.setNotice(token ? "令牌已保存（本地加密存储）。" : "本地令牌已清除。");
    } catch (err) {
      options.setError(options.toUserErrorMessage(err));
    } finally {
      options.setMarketTokenSaving(false);
    }
  }, [
    options.marketTokenDraft,
    options.setError,
    options.setMarketTokenDraft,
    options.setMarketTokenSaving,
    options.setMarketTokenStatus,
    options.setNotice,
    options.toUserErrorMessage
  ]);

  const handleClearMarketToken = useCallback(async () => {
    if (!window.mytrader) return;
    options.setError(null);
    options.setNotice(null);
    options.setMarketTokenSaving(true);
    try {
      const status = await window.mytrader.market.setToken({ token: null });
      options.setMarketTokenStatus(status);
      options.setMarketTokenDraft("");
      options.setNotice("本地令牌已清除。");
    } catch (err) {
      options.setError(options.toUserErrorMessage(err));
    } finally {
      options.setMarketTokenSaving(false);
    }
  }, [
    options.setError,
    options.setMarketTokenDraft,
    options.setMarketTokenSaving,
    options.setMarketTokenStatus,
    options.setNotice,
    options.toUserErrorMessage
  ]);

  const handleTestMarketToken = useCallback(async () => {
    if (!window.mytrader) return;
    options.setError(null);
    options.setNotice(null);
    options.setMarketTokenTesting(true);
    try {
      const token = options.marketTokenDraft.trim() || null;
      await window.mytrader.market.testToken({ token });
      options.setNotice("连接测试成功。");
      await options.refreshMarketTokenStatus();
    } catch (err) {
      options.setError(options.toUserErrorMessage(err));
    } finally {
      options.setMarketTokenTesting(false);
    }
  }, [
    options.marketTokenDraft,
    options.refreshMarketTokenStatus,
    options.setError,
    options.setMarketTokenTesting,
    options.setNotice,
    options.toUserErrorMessage
  ]);

  const handleToggleUniversePoolBucket = useCallback(
    (bucket: UniversePoolBucketId) => {
      options.setMarketUniversePoolConfig((prev) => {
        const current = prev ?? { enabledBuckets: [...options.universePoolBucketOrder] };
        const enabled = new Set(current.enabledBuckets);
        if (enabled.has(bucket)) {
          if (enabled.size === 1) return current;
          enabled.delete(bucket);
        } else {
          enabled.add(bucket);
        }
        const nextBuckets = options.universePoolBucketOrder.filter((item) =>
          enabled.has(item)
        );
        return { enabledBuckets: nextBuckets };
      });
    },
    [options.setMarketUniversePoolConfig, options.universePoolBucketOrder]
  );

  const handleSaveUniversePoolConfig = useCallback(async () => {
    if (!window.mytrader || !options.marketUniversePoolConfig) return;
    const buckets = options.marketUniversePoolConfig.enabledBuckets;
    if (buckets.length === 0) {
      options.setError("全量池配置至少保留一个分类。");
      return;
    }
    options.setError(null);
    options.setNotice(null);
    options.setMarketUniversePoolSaving(true);
    try {
      const saved = await window.mytrader.market.setUniversePoolConfig({
        enabledBuckets: buckets
      });
      options.setMarketUniversePoolConfig(saved);
      options.setMarketUniversePoolSavedConfig(saved);
      const overview = await window.mytrader.market.getUniversePoolOverview();
      options.setMarketUniversePoolOverview(overview);
      options.setNotice("全量池配置已保存。");
      await options.refreshMarketTargetPoolStats();
    } catch (err) {
      options.setError(options.toUserErrorMessage(err));
    } finally {
      options.setMarketUniversePoolSaving(false);
    }
  }, [
    options.marketUniversePoolConfig,
    options.refreshMarketTargetPoolStats,
    options.setError,
    options.setMarketUniversePoolConfig,
    options.setMarketUniversePoolOverview,
    options.setMarketUniversePoolSavedConfig,
    options.setMarketUniversePoolSaving,
    options.setNotice,
    options.toUserErrorMessage
  ]);

  const handleTriggerMarketIngest = useCallback(
    async (scope: "targets" | "universe" | "both") => {
      if (!window.mytrader) return;
      options.setError(null);
      options.setNotice(null);
      options.setMarketIngestTriggering(true);
      try {
        const preflight = await window.mytrader.market.runIngestPreflight({
          scope
        });
        if (!preflight.readiness.ready) {
          const message = formatReadinessBlockMessage(preflight.readiness);
          options.setError(message);
          options.setMarketTriggerIngestBlockedMessage?.(message);
          options.setMarketTriggerIngestBlockedOpen?.(true);
          return;
        }

        await window.mytrader.market.triggerIngest({ scope });
        options.setNotice("拉取任务已加入队列。");
        await Promise.all([
          options.refreshMarketIngestRuns(),
          options.refreshMarketIngestControl()
        ]);
      } catch (err) {
        options.setError(options.toUserErrorMessage(err));
        await Promise.all([
          options.refreshMarketIngestRuns(),
          options.refreshMarketIngestControl()
        ]);
      } finally {
        options.setMarketIngestTriggering(false);
      }
    },
    [
      options.refreshMarketIngestControl,
      options.refreshMarketIngestRuns,
      options.setError,
      options.setMarketIngestTriggering,
      options.setNotice,
      options.toUserErrorMessage
    ]
  );

  return {
    handleOpenMarketProvider,
    handleSaveMarketToken,
    handleClearMarketToken,
    handleTestMarketToken,
    handleToggleUniversePoolBucket,
    handleSaveUniversePoolConfig,
    handleTriggerMarketIngest
  };
}

function formatReadinessBlockMessage(readiness: DataSourceReadinessResult): string {
  const issues = readiness.issues.filter((item) => item.level === "error");
  if (issues.length === 0) {
    return "数据来源尚未就绪，请先完成配置与测试。";
  }
  return issues
    .slice(0, 8)
    .map((item, index) => `${index + 1}. ${item.message}`)
    .join("\n");
}
