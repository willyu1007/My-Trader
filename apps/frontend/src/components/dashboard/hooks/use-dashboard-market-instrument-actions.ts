import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";

import type {
  InstrumentProfile,
  MarketDailyBar,
  PreviewTargetsResult,
  TempTargetSymbol
} from "@mytrader/shared";

import type { PopoverSelectOption } from "../shared";

export interface UseDashboardMarketInstrumentActionsOptions {
  activePortfolioId: string | null;
  marketSelectedSymbol: string | null;
  marketUserTagDraft: string;
  marketManualThemeDraft: string;
  marketManualThemeOptions: PopoverSelectOption[];
  marketSelectedUserTags: string[];
  marketSelectedProfile: InstrumentProfile | null;
  marketWatchlistGroupDraft: string;
  toUserErrorMessage: (err: unknown) => string;
  loadSnapshot: (portfolioId: string) => Promise<void>;
  loadMarketQuotes: (symbols: string[]) => Promise<void>;
  refreshMarketTargets: () => Promise<void>;
  refreshMarketWatchlist: () => Promise<void>;
  refreshMarketTags: (query: string) => Promise<void>;
  setMarketScopeToTags: () => void;
  setError: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setMarketCatalogSyncing: Dispatch<SetStateAction<boolean>>;
  setMarketCatalogSyncSummary: Dispatch<SetStateAction<string | null>>;
  setMarketInstrumentDetailsOpen: Dispatch<SetStateAction<boolean>>;
  setMarketTagMembersModalOpen: Dispatch<SetStateAction<boolean>>;
  setMarketSelectedSymbol: Dispatch<SetStateAction<string | null>>;
  setMarketSelectedProfile: Dispatch<SetStateAction<InstrumentProfile | null>>;
  setMarketSelectedUserTags: Dispatch<SetStateAction<string[]>>;
  setMarketShowProviderData: Dispatch<SetStateAction<boolean>>;
  setMarketChartHoverDate: Dispatch<SetStateAction<string | null>>;
  setMarketChartHoverPrice: Dispatch<SetStateAction<number | null>>;
  setMarketChartLoading: Dispatch<SetStateAction<boolean>>;
  setMarketTempTargets: Dispatch<SetStateAction<TempTargetSymbol[]>>;
  setMarketTargetsPreview: Dispatch<SetStateAction<PreviewTargetsResult | null>>;
  setMarketSelectedTag: Dispatch<SetStateAction<string | null>>;
  setMarketTagMembers: Dispatch<SetStateAction<string[]>>;
  setMarketChartBars: Dispatch<SetStateAction<MarketDailyBar[]>>;
  setMarketTagMembersLoading: Dispatch<SetStateAction<boolean>>;
  setMarketDemoSeeding: Dispatch<SetStateAction<boolean>>;
  setMarketUserTagDraft: Dispatch<SetStateAction<string>>;
}

export function useDashboardMarketInstrumentActions(
  options: UseDashboardMarketInstrumentActionsOptions
) {
  const handleSyncInstrumentCatalog = useCallback(async () => {
    if (!window.mytrader) return;
    options.setError(null);
    options.setNotice(null);
    options.setMarketCatalogSyncing(true);
    try {
      const result = await window.mytrader.market.syncInstrumentCatalog();
      options.setMarketCatalogSyncSummary(
        `标的库已同步：新增 ${result.inserted}，更新 ${result.updated}。`
      );
      await options.refreshMarketTargets();
      options.setNotice(
        `标的库同步完成：新增 ${result.inserted}，更新 ${result.updated}。`
      );
    } catch (err) {
      options.setError(options.toUserErrorMessage(err));
    } finally {
      options.setMarketCatalogSyncing(false);
    }
  }, [
    options.refreshMarketTargets,
    options.setError,
    options.setMarketCatalogSyncSummary,
    options.setMarketCatalogSyncing,
    options.setNotice,
    options.toUserErrorMessage
  ]);

  const handleSelectInstrument = useCallback(
    async (symbol: string) => {
      if (!window.mytrader) return;
      const key = symbol.trim();
      if (!key) return;
      options.setMarketInstrumentDetailsOpen(false);
      options.setMarketTagMembersModalOpen(false);
      options.setMarketSelectedSymbol(key);
      options.setMarketSelectedProfile(null);
      options.setMarketSelectedUserTags([]);
      options.setMarketShowProviderData(false);
      options.setMarketChartHoverDate(null);
      options.setMarketChartHoverPrice(null);
      options.setMarketChartLoading(true);
      options.setError(null);
      try {
        const profile = await window.mytrader.market.getInstrumentProfile(key);
        options.setMarketSelectedProfile(profile);
        const tags = await window.mytrader.market.listInstrumentTags(key);
        options.setMarketSelectedUserTags(tags);
        await options.loadMarketQuotes([key]);

        if (profile) {
          const preview = await window.mytrader.market.previewTargets();
          const entry = preview.symbols.find((item) => item.symbol === key) ?? null;
          const isTempOnly = entry?.reasons?.includes("temp:search") ?? false;

          if (!entry || isTempOnly) {
            const temp = await window.mytrader.market.touchTempTarget({ symbol: key });
            options.setMarketTempTargets(temp);
            const refreshed = await window.mytrader.market.previewTargets();
            options.setMarketTargetsPreview(refreshed);
            if (!entry) {
              options.setNotice(
                `已临时加入目标池：${key}（7天后自动清理，可在「数据管理」转为长期）。`
              );
            }
          }
        }
      } catch (err) {
        options.setError(options.toUserErrorMessage(err));
        options.setMarketChartLoading(false);
      }
    },
    [
      options.loadMarketQuotes,
      options.setError,
      options.setMarketChartHoverDate,
      options.setMarketChartHoverPrice,
      options.setMarketChartLoading,
      options.setMarketInstrumentDetailsOpen,
      options.setMarketSelectedProfile,
      options.setMarketSelectedSymbol,
      options.setMarketSelectedUserTags,
      options.setMarketShowProviderData,
      options.setMarketTagMembersModalOpen,
      options.setMarketTargetsPreview,
      options.setMarketTempTargets,
      options.setNotice,
      options.toUserErrorMessage
    ]
  );

  const handleSelectTag = useCallback(
    async (tag: string) => {
      if (!window.mytrader) return;
      const key = tag.trim();
      if (!key) return;

      options.setMarketInstrumentDetailsOpen(false);
      options.setMarketTagMembersModalOpen(false);
      options.setMarketSelectedTag(key);
      options.setMarketSelectedSymbol(null);
      options.setMarketSelectedProfile(null);
      options.setMarketSelectedUserTags([]);
      options.setMarketShowProviderData(false);
      options.setMarketTagMembers([]);
      options.setMarketChartBars([]);

      options.setError(null);
      options.setMarketTagMembersLoading(true);
      try {
        const members = await window.mytrader.market.getTagMembers({
          tag: key,
          limit: 5000
        });
        options.setMarketTagMembers(members);
        await options.loadMarketQuotes(members);
      } catch (err) {
        options.setError(options.toUserErrorMessage(err));
      } finally {
        options.setMarketTagMembersLoading(false);
      }
    },
    [
      options.loadMarketQuotes,
      options.setError,
      options.setMarketChartBars,
      options.setMarketInstrumentDetailsOpen,
      options.setMarketSelectedProfile,
      options.setMarketSelectedSymbol,
      options.setMarketSelectedTag,
      options.setMarketSelectedUserTags,
      options.setMarketShowProviderData,
      options.setMarketTagMembers,
      options.setMarketTagMembersLoading,
      options.setMarketTagMembersModalOpen,
      options.toUserErrorMessage
    ]
  );

  const handleSeedMarketDemoData = useCallback(async () => {
    if (!window.mytrader) return;
    options.setError(null);
    options.setNotice(null);
    options.setMarketDemoSeeding(true);
    try {
      const result = await window.mytrader.market.seedDemoData({
        portfolioId: options.activePortfolioId,
        seedHoldings: true
      });
      await options.refreshMarketWatchlist();
      await options.refreshMarketTags("demo");
      if (options.activePortfolioId) {
        await options.loadSnapshot(options.activePortfolioId);
      }
      options.setMarketScopeToTags();
      await handleSelectTag("demo:all");
      options.setNotice(
        `已注入示例数据：${result.symbols.length} 个标的，${result.tradeDateCount} 个交易日。${
          result.warnings.length ? `（${result.warnings.join("；")}）` : ""
        }`
      );
    } catch (err) {
      options.setError(options.toUserErrorMessage(err));
    } finally {
      options.setMarketDemoSeeding(false);
    }
  }, [
    options.activePortfolioId,
    options.loadSnapshot,
    options.refreshMarketTags,
    options.refreshMarketWatchlist,
    options.setError,
    options.setMarketDemoSeeding,
    options.setMarketScopeToTags,
    options.setNotice,
    options.toUserErrorMessage,
    handleSelectTag
  ]);

  const handleAddUserTag = useCallback(async () => {
    if (!window.mytrader || !options.marketSelectedSymbol) return;
    const tag = options.marketUserTagDraft.trim();
    if (!tag) return;
    if (!tag.includes(":")) {
      options.setError("标签必须符合 namespace:value，例如 user:核心 或 theme:AI。");
      return;
    }
    if (tag.startsWith("theme:")) {
      options.setError("主题请通过“手动主题（THS）”选择，不支持手动输入。");
      return;
    }
    options.setError(null);
    options.setNotice(null);
    try {
      await window.mytrader.market.addInstrumentTag(options.marketSelectedSymbol, tag);
      options.setMarketUserTagDraft("");
      const tags = await window.mytrader.market.listInstrumentTags(
        options.marketSelectedSymbol
      );
      options.setMarketSelectedUserTags(tags);
      options.setNotice("标签已添加。");
    } catch (err) {
      options.setError(options.toUserErrorMessage(err));
    }
  }, [
    options.marketSelectedSymbol,
    options.marketUserTagDraft,
    options.setError,
    options.setMarketSelectedUserTags,
    options.setMarketUserTagDraft,
    options.setNotice,
    options.toUserErrorMessage
  ]);

  const handleRemoveUserTag = useCallback(
    async (tag: string) => {
      if (!window.mytrader || !options.marketSelectedSymbol) return;
      const key = tag.trim();
      if (!key) return;
      options.setError(null);
      options.setNotice(null);
      try {
        await window.mytrader.market.removeInstrumentTag(
          options.marketSelectedSymbol,
          key
        );
        const tags = await window.mytrader.market.listInstrumentTags(
          options.marketSelectedSymbol
        );
        options.setMarketSelectedUserTags(tags);
        options.setNotice("标签已移除。");
      } catch (err) {
        options.setError(options.toUserErrorMessage(err));
      }
    },
    [
      options.marketSelectedSymbol,
      options.setError,
      options.setMarketSelectedUserTags,
      options.setNotice,
      options.toUserErrorMessage
    ]
  );

  const handleAddManualTheme = useCallback(async () => {
    if (!window.mytrader || !options.marketSelectedSymbol) return;
    const tag = options.marketManualThemeDraft.trim();
    if (!tag) return;
    if (!tag.startsWith("theme:manual:")) {
      options.setError("请选择 THS 主题后再添加。");
      return;
    }
    if (!options.marketManualThemeOptions.some((opt) => opt.value === tag)) {
      options.setError("主题不在 THS 列表中，请重新选择。");
      return;
    }
    if (options.marketSelectedUserTags.includes(tag)) {
      options.setNotice("主题已存在。");
      return;
    }
    options.setError(null);
    options.setNotice(null);
    try {
      await window.mytrader.market.addInstrumentTag(options.marketSelectedSymbol, tag);
      const tags = await window.mytrader.market.listInstrumentTags(
        options.marketSelectedSymbol
      );
      options.setMarketSelectedUserTags(tags);
      options.setNotice("主题已添加。");
    } catch (err) {
      options.setError(options.toUserErrorMessage(err));
    }
  }, [
    options.marketManualThemeDraft,
    options.marketManualThemeOptions,
    options.marketSelectedSymbol,
    options.marketSelectedUserTags,
    options.setError,
    options.setMarketSelectedUserTags,
    options.setNotice,
    options.toUserErrorMessage
  ]);

  const handleAddSelectedToWatchlist = useCallback(async () => {
    if (!window.mytrader || !options.marketSelectedProfile) return;
    const groupName = options.marketWatchlistGroupDraft.trim();
    options.setError(null);
    options.setNotice(null);
    try {
      await window.mytrader.market.upsertWatchlistItem({
        symbol: options.marketSelectedProfile.symbol,
        name: options.marketSelectedProfile.name ?? null,
        groupName: groupName ? groupName : null
      });
      await options.refreshMarketWatchlist();
      options.setNotice("已加入自选列表。");
    } catch (err) {
      options.setError(options.toUserErrorMessage(err));
    }
  }, [
    options.marketSelectedProfile,
    options.marketWatchlistGroupDraft,
    options.refreshMarketWatchlist,
    options.setError,
    options.setNotice,
    options.toUserErrorMessage
  ]);

  const handleRemoveWatchlistItem = useCallback(
    async (symbol: string) => {
      if (!window.mytrader) return;
      const key = symbol.trim();
      if (!key) return;
      options.setError(null);
      options.setNotice(null);
      try {
        await window.mytrader.market.removeWatchlistItem(key);
        await options.refreshMarketWatchlist();
        options.setNotice("已从自选列表移除。");
      } catch (err) {
        options.setError(options.toUserErrorMessage(err));
      }
    },
    [
      options.refreshMarketWatchlist,
      options.setError,
      options.setNotice,
      options.toUserErrorMessage
    ]
  );

  return {
    handleSyncInstrumentCatalog,
    handleSelectInstrument,
    handleSelectTag,
    handleSeedMarketDemoData,
    handleAddUserTag,
    handleRemoveUserTag,
    handleAddManualTheme,
    handleAddSelectedToWatchlist,
    handleRemoveWatchlistItem
  };
}
