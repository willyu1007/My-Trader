import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";

import type {
  MarketTargetsConfig,
  PreviewTargetsDiffResult,
  PreviewTargetsResult,
  TempTargetSymbol
} from "@mytrader/shared";

import {
  buildManualTargetsPreview,
  normalizeMarketSymbol,
  splitSymbolInputTokens
} from "../shared";

interface ManualSymbolPreview {
  addable: string[];
  existing: string[];
  invalid: string[];
  duplicates: number;
}

export interface UseDashboardMarketTargetActionsOptions {
  marketTargetsConfig: MarketTargetsConfig;
  marketTargetsSavedConfig: MarketTargetsConfig | null;
  marketTargetsSymbolDraft: string;
  marketManualSymbolPreview: ManualSymbolPreview;
  marketSelectedTempTargetSymbols: string[];
  marketTempTargets: TempTargetSymbol[];
  toUserErrorMessage: (err: unknown) => string;
  refreshMarketTargets: () => Promise<void>;
  refreshMarketTargetsDiff: () => Promise<void>;
  setError: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setMarketTargetsConfig: Dispatch<SetStateAction<MarketTargetsConfig>>;
  setMarketTargetsSavedConfig: Dispatch<SetStateAction<MarketTargetsConfig | null>>;
  setMarketTargetsSymbolDraft: Dispatch<SetStateAction<string>>;
  setMarketManualSymbolPreview: Dispatch<SetStateAction<ManualSymbolPreview>>;
  setMarketTargetsDiffPreview: Dispatch<
    SetStateAction<PreviewTargetsDiffResult | null>
  >;
  setMarketTargetsPreview: Dispatch<SetStateAction<PreviewTargetsResult | null>>;
  setMarketTargetsSaving: Dispatch<SetStateAction<boolean>>;
  setMarketTempTargets: Dispatch<SetStateAction<TempTargetSymbol[]>>;
  setMarketTempTargetsLoading: Dispatch<SetStateAction<boolean>>;
  setMarketSelectedTempTargetSymbols: Dispatch<SetStateAction<string[]>>;
}

function normalizeSavedTargetsConfig(config: MarketTargetsConfig): MarketTargetsConfig {
  return {
    ...config,
    includeRegistryAutoIngest: false,
    tagFilters: []
  };
}

const EMPTY_MANUAL_SYMBOL_PREVIEW: ManualSymbolPreview = {
  addable: [],
  existing: [],
  invalid: [],
  duplicates: 0
};

export function useDashboardMarketTargetActions(
  options: UseDashboardMarketTargetActionsOptions
) {
  const handlePreviewManualTargetSymbols = useCallback(() => {
    const preview = buildManualTargetsPreview(
      options.marketTargetsSymbolDraft,
      options.marketTargetsConfig.explicitSymbols
    );
    options.setMarketManualSymbolPreview(preview);
    options.setError(null);
  }, [
    options.marketTargetsConfig.explicitSymbols,
    options.marketTargetsSymbolDraft,
    options.setError,
    options.setMarketManualSymbolPreview
  ]);

  const handleApplyManualTargetSymbols = useCallback(() => {
    options.setError(null);
    const hasPreview =
      options.marketManualSymbolPreview.addable.length +
        options.marketManualSymbolPreview.existing.length +
        options.marketManualSymbolPreview.invalid.length +
        options.marketManualSymbolPreview.duplicates >
      0;

    if (!hasPreview) {
      options.setNotice("请先解析输入内容。");
      return;
    }

    if (options.marketManualSymbolPreview.addable.length === 0) {
      options.setNotice(
        `没有可新增标的。已存在 ${options.marketManualSymbolPreview.existing.length} 个，无效 ${options.marketManualSymbolPreview.invalid.length} 个。`
      );
      return;
    }

    const nextExplicitSymbols = Array.from(
      new Set([
        ...options.marketTargetsConfig.explicitSymbols,
        ...options.marketManualSymbolPreview.addable
      ])
    ).sort((left, right) => left.localeCompare(right));

    options.setMarketTargetsConfig((prev) => ({
      ...prev,
      explicitSymbols: nextExplicitSymbols
    }));

    const nextPreview = buildManualTargetsPreview(
      options.marketTargetsSymbolDraft,
      nextExplicitSymbols
    );
    options.setMarketManualSymbolPreview(nextPreview);

    options.setNotice(
      `已应用 ${options.marketManualSymbolPreview.addable.length} 个有效标的；无效 ${options.marketManualSymbolPreview.invalid.length} 个。${
        options.marketManualSymbolPreview.existing.length > 0
          ? `已存在 ${options.marketManualSymbolPreview.existing.length} 个。`
          : ""
      }`
    );
  }, [
    options.marketManualSymbolPreview,
    options.marketTargetsConfig.explicitSymbols,
    options.marketTargetsSymbolDraft,
    options.setError,
    options.setMarketManualSymbolPreview,
    options.setMarketTargetsConfig,
    options.setNotice
  ]);

  const handleRemoveManualPreviewSymbol = useCallback(
    (token: string, mode: "addable" | "existing" | "invalid") => {
      const nextTokens = splitSymbolInputTokens(options.marketTargetsSymbolDraft).filter(
        (item) => {
          if (mode === "addable" || mode === "existing") {
            return normalizeMarketSymbol(item) !== token;
          }
          return item.trim().toUpperCase() !== token.trim().toUpperCase();
        }
      );
      const nextInput = nextTokens.join("\n");
      options.setMarketTargetsSymbolDraft(nextInput);
      options.setMarketManualSymbolPreview(
        buildManualTargetsPreview(nextInput, options.marketTargetsConfig.explicitSymbols)
      );
    },
    [
      options.marketTargetsConfig.explicitSymbols,
      options.marketTargetsSymbolDraft,
      options.setMarketManualSymbolPreview,
      options.setMarketTargetsSymbolDraft
    ]
  );

  const handleRemoveTempTarget = useCallback(
    async (symbol: string) => {
      if (!window.mytrader) return;
      const key = symbol.trim();
      if (!key) return;
      options.setError(null);
      options.setNotice(null);
      options.setMarketTempTargetsLoading(true);
      try {
        const next = await window.mytrader.market.removeTempTarget({ symbol: key });
        options.setMarketTempTargets(next);
        const diff = await window.mytrader.market.previewTargetsDraft({
          config: options.marketTargetsConfig
        });
        options.setMarketTargetsDiffPreview(diff);
        options.setMarketTargetsPreview(diff.draft);
        options.setNotice(`已移除临时标的：${key}`);
      } catch (err) {
        options.setError(options.toUserErrorMessage(err));
      } finally {
        options.setMarketTempTargetsLoading(false);
      }
    },
    [
      options.marketTargetsConfig,
      options.setError,
      options.setMarketTargetsDiffPreview,
      options.setMarketTargetsPreview,
      options.setMarketTempTargets,
      options.setMarketTempTargetsLoading,
      options.setNotice,
      options.toUserErrorMessage
    ]
  );

  const handlePromoteTempTarget = useCallback(
    async (symbol: string) => {
      if (!window.mytrader) return;
      const key = symbol.trim();
      if (!key) return;
      options.setError(null);
      options.setNotice(null);
      options.setMarketTempTargetsLoading(true);
      options.setMarketTargetsSaving(true);
      try {
        const savedRaw = await window.mytrader.market.promoteTempTarget({
          symbol: key
        });
        const saved = normalizeSavedTargetsConfig(savedRaw);
        options.setMarketTargetsSavedConfig(saved);
        options.setMarketTargetsConfig(saved);
        const diff = await window.mytrader.market.previewTargetsDraft({
          config: saved
        });
        options.setMarketTargetsDiffPreview(diff);
        options.setMarketTargetsPreview(diff.draft);
        const temp = await window.mytrader.market.listTempTargets();
        options.setMarketTempTargets(temp);
        options.setNotice(`已转为长期目标：${key}`);
      } catch (err) {
        options.setError(options.toUserErrorMessage(err));
      } finally {
        options.setMarketTargetsSaving(false);
        options.setMarketTempTargetsLoading(false);
      }
    },
    [
      options.setError,
      options.setMarketTargetsConfig,
      options.setMarketTargetsDiffPreview,
      options.setMarketTargetsPreview,
      options.setMarketTargetsSavedConfig,
      options.setMarketTargetsSaving,
      options.setMarketTempTargets,
      options.setMarketTempTargetsLoading,
      options.setNotice,
      options.toUserErrorMessage
    ]
  );

  const handleSaveTargets = useCallback(async () => {
    if (!window.mytrader) return;
    options.setError(null);
    options.setNotice(null);
    options.setMarketTargetsSaving(true);
    try {
      const payload = normalizeSavedTargetsConfig(options.marketTargetsConfig);
      const savedRaw = await window.mytrader.market.setTargets(payload);
      const saved = normalizeSavedTargetsConfig(savedRaw);
      options.setMarketTargetsSavedConfig(saved);
      options.setMarketTargetsConfig(saved);
      const diff = await window.mytrader.market.previewTargetsDraft({
        config: saved
      });
      options.setMarketTargetsDiffPreview(diff);
      options.setMarketTargetsPreview(diff.draft);
      options.setNotice("目标池已保存。");
    } catch (err) {
      options.setError(options.toUserErrorMessage(err));
    } finally {
      options.setMarketTargetsSaving(false);
    }
  }, [
    options.marketTargetsConfig,
    options.setError,
    options.setMarketTargetsConfig,
    options.setMarketTargetsDiffPreview,
    options.setMarketTargetsPreview,
    options.setMarketTargetsSavedConfig,
    options.setMarketTargetsSaving,
    options.setNotice,
    options.toUserErrorMessage
  ]);

  const handleResetTargetsDraft = useCallback(() => {
    if (!options.marketTargetsSavedConfig) return;
    options.setMarketTargetsConfig(options.marketTargetsSavedConfig);
    options.setMarketTargetsSymbolDraft("");
    options.setMarketManualSymbolPreview({ ...EMPTY_MANUAL_SYMBOL_PREVIEW });
    options.setNotice("已重置为最近一次已保存配置。");
  }, [
    options.marketTargetsSavedConfig,
    options.setMarketManualSymbolPreview,
    options.setMarketTargetsConfig,
    options.setMarketTargetsSymbolDraft,
    options.setNotice
  ]);

  const handleToggleTempTargetSelection = useCallback(
    (symbol: string) => {
      const key = symbol.trim();
      if (!key) return;
      options.setMarketSelectedTempTargetSymbols((prev) =>
        prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
      );
    },
    [options.setMarketSelectedTempTargetSymbols]
  );

  const handleSelectAllTempTargets = useCallback(() => {
    if (options.marketTempTargets.length === 0) {
      options.setMarketSelectedTempTargetSymbols([]);
      return;
    }
    const all = options.marketTempTargets.map((item) => item.symbol);
    options.setMarketSelectedTempTargetSymbols((prev) =>
      prev.length === all.length ? [] : all
    );
  }, [options.marketTempTargets, options.setMarketSelectedTempTargetSymbols]);

  const handleBatchPromoteTempTargets = useCallback(async () => {
    if (!window.mytrader) return;
    if (options.marketSelectedTempTargetSymbols.length === 0) return;
    options.setMarketTargetsSaving(true);
    options.setMarketTempTargetsLoading(true);
    options.setError(null);
    try {
      let promoted = 0;
      for (const symbol of options.marketSelectedTempTargetSymbols) {
        await window.mytrader.market.promoteTempTarget({ symbol });
        promoted += 1;
      }
      options.setNotice(`已批量转长期：${promoted} 个标的。`);
      await options.refreshMarketTargets();
      await options.refreshMarketTargetsDiff();
    } catch (err) {
      options.setError(options.toUserErrorMessage(err));
    } finally {
      options.setMarketTargetsSaving(false);
      options.setMarketTempTargetsLoading(false);
      options.setMarketSelectedTempTargetSymbols([]);
    }
  }, [
    options.marketSelectedTempTargetSymbols,
    options.refreshMarketTargets,
    options.refreshMarketTargetsDiff,
    options.setError,
    options.setMarketSelectedTempTargetSymbols,
    options.setMarketTargetsSaving,
    options.setMarketTempTargetsLoading,
    options.setNotice,
    options.toUserErrorMessage
  ]);

  const handleBatchRemoveTempTargets = useCallback(async () => {
    if (!window.mytrader) return;
    if (options.marketSelectedTempTargetSymbols.length === 0) return;
    options.setMarketTempTargetsLoading(true);
    options.setError(null);
    try {
      let removed = 0;
      for (const symbol of options.marketSelectedTempTargetSymbols) {
        await window.mytrader.market.removeTempTarget({ symbol });
        removed += 1;
      }
      options.setNotice(`已批量移除：${removed} 个临时标的。`);
      await options.refreshMarketTargets();
      await options.refreshMarketTargetsDiff();
    } catch (err) {
      options.setError(options.toUserErrorMessage(err));
    } finally {
      options.setMarketTempTargetsLoading(false);
      options.setMarketSelectedTempTargetSymbols([]);
    }
  }, [
    options.marketSelectedTempTargetSymbols,
    options.refreshMarketTargets,
    options.refreshMarketTargetsDiff,
    options.setError,
    options.setMarketSelectedTempTargetSymbols,
    options.setMarketTempTargetsLoading,
    options.setNotice,
    options.toUserErrorMessage
  ]);

  const handleBatchExtendTempTargets = useCallback(async () => {
    if (!window.mytrader) return;
    if (options.marketSelectedTempTargetSymbols.length === 0) return;
    options.setMarketTempTargetsLoading(true);
    options.setError(null);
    try {
      for (const symbol of options.marketSelectedTempTargetSymbols) {
        await window.mytrader.market.touchTempTarget({ symbol, ttlDays: 7 });
      }
      options.setNotice(
        `已续期 ${options.marketSelectedTempTargetSymbols.length} 个临时标的（7天）。`
      );
      await options.refreshMarketTargets();
      await options.refreshMarketTargetsDiff();
    } catch (err) {
      options.setError(options.toUserErrorMessage(err));
    } finally {
      options.setMarketTempTargetsLoading(false);
    }
  }, [
    options.marketSelectedTempTargetSymbols,
    options.refreshMarketTargets,
    options.refreshMarketTargetsDiff,
    options.setError,
    options.setMarketTempTargetsLoading,
    options.setNotice,
    options.toUserErrorMessage
  ]);

  return {
    handlePreviewManualTargetSymbols,
    handleApplyManualTargetSymbols,
    handleRemoveManualPreviewSymbol,
    handleRemoveTempTarget,
    handlePromoteTempTarget,
    handleSaveTargets,
    handleResetTargetsDraft,
    handleToggleTempTargetSelection,
    handleSelectAllTempTargets,
    handleBatchPromoteTempTargets,
    handleBatchRemoveTempTargets,
    handleBatchExtendTempTargets
  };
}
