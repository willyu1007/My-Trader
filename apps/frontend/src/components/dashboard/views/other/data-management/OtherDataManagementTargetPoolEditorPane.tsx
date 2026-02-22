import type { ChangeEvent } from "react";

import type { MarketTargetsConfig } from "@mytrader/shared";

import type { OtherViewProps } from "../../OtherView";

export type OtherDataManagementTargetPoolEditorPaneProps = Pick<
  OtherViewProps,
  | "handleApplyManualTargetSymbols"
  | "handlePreviewManualTargetSymbols"
  | "handleRemoveManualPreviewSymbol"
  | "handleToggleTargetsSection"
  | "marketManualSymbolPreview"
  | "marketRegistryEntryEnabled"
  | "marketTargetsConfig"
  | "marketTargetsSectionOpen"
  | "marketTargetsSymbolDraft"
  | "setMarketManualSymbolPreview"
  | "setMarketTargetsConfig"
  | "setMarketTargetsSymbolDraft"
>;

export function OtherDataManagementTargetPoolEditorPane(
  props: OtherDataManagementTargetPoolEditorPaneProps
) {
  return (
    <div className="space-y-3 min-w-0">
      <div className="rounded-md bg-slate-50/45 dark:bg-background-dark/25">
        <button
          type="button"
          onClick={() => props.handleToggleTargetsSection("scope")}
          className="w-full flex items-center justify-between px-3 py-2 text-left"
        >
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            数据同步范围
          </span>
          <span className="material-icons-outlined text-sm text-slate-500 dark:text-slate-400">
            {props.marketTargetsSectionOpen.scope
              ? "expand_less"
              : "expand_more"}
          </span>
        </button>
        {props.marketTargetsSectionOpen.scope && (
          <div className="px-3 pb-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-slate-700 dark:text-slate-200">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="marketTargetsIncludeHoldings"
                  checked={props.marketTargetsConfig.includeHoldings}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    props.setMarketTargetsConfig((prev: MarketTargetsConfig) => ({
                      ...prev,
                      includeHoldings: event.target.checked
                    }))
                  }
                />
                <span>包含持仓</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="marketTargetsIncludeWatchlist"
                  checked={props.marketTargetsConfig.includeWatchlist}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    props.setMarketTargetsConfig((prev: MarketTargetsConfig) => ({
                      ...prev,
                      includeWatchlist: event.target.checked
                    }))
                  }
                />
                <span>包含自选</span>
              </label>
              {props.marketRegistryEntryEnabled && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="marketTargetsIncludeRegistryAutoIngest"
                    checked={
                      props.marketTargetsConfig.includeRegistryAutoIngest
                    }
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      props.setMarketTargetsConfig((prev: MarketTargetsConfig) => ({
                        ...prev,
                        includeRegistryAutoIngest: event.target.checked
                      }))
                    }
                  />
                  <span>包含注册标的</span>
                </label>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-md bg-slate-50/45 dark:bg-background-dark/25">
        <button
          type="button"
          onClick={() => props.handleToggleTargetsSection("symbols")}
          className="w-full flex items-center justify-between px-3 py-2 text-left"
        >
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            手动添加标的
          </span>
          <span className="material-icons-outlined text-sm text-slate-500 dark:text-slate-400">
            {props.marketTargetsSectionOpen.symbols
              ? "expand_less"
              : "expand_more"}
          </span>
        </button>
        {props.marketTargetsSectionOpen.symbols && (
          <div className="px-3 pb-3 space-y-3">
            <div className="relative">
              <textarea
                name="marketTargetsSymbolDraft"
                value={props.marketTargetsSymbolDraft}
                onChange={(event) => {
                  props.setMarketTargetsSymbolDraft(event.target.value);
                  props.setMarketManualSymbolPreview({
                    addable: [],
                    existing: [],
                    invalid: [],
                    duplicates: 0
                  });
                }}
                placeholder="输入标的代码，支持逗号/空格/换行/分号分隔"
                rows={4}
                className="block w-full rounded-md border-slate-300 dark:border-border-dark bg-white dark:bg-field-dark py-1.5 pl-2 pr-16 pb-9 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-primary text-xs font-mono"
              />
              <button
                type="button"
                onClick={props.handlePreviewManualTargetSymbols}
                disabled={!props.marketTargetsSymbolDraft.trim()}
                className="ui-btn ui-btn-primary absolute right-2 bottom-2 h-7 px-3 rounded-[4px] text-[11px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                解析
              </button>
            </div>

            <div className="rounded-md border border-slate-200 dark:border-border-dark bg-slate-100/70 dark:bg-background-dark/35 p-2 space-y-2">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                预览
              </div>
              <div className="max-h-28 overflow-auto space-y-1">
                {props.marketManualSymbolPreview.addable.map((symbol: string) => (
                  <div
                    key={`preview-addable-${symbol}`}
                    className="flex items-center justify-between gap-2 rounded bg-emerald-50/70 dark:bg-emerald-900/15 px-2 py-1"
                  >
                    <span className="font-mono text-xs text-slate-700 dark:text-slate-200">
                      {symbol}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                        有效
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          props.handleRemoveManualPreviewSymbol(
                            symbol,
                            "addable"
                          )
                        }
                        className="text-slate-400 hover:text-red-500"
                        aria-label={`移除预览 symbol ${symbol}`}
                        title="移除"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
                {props.marketManualSymbolPreview.existing.map((symbol: string) => (
                  <div
                    key={`preview-existing-${symbol}`}
                    className="flex items-center justify-between gap-2 rounded bg-amber-50/70 dark:bg-amber-900/15 px-2 py-1"
                  >
                    <span className="font-mono text-xs text-slate-700 dark:text-slate-200">
                      {symbol}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-amber-700 dark:text-amber-300">
                        已存在
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          props.handleRemoveManualPreviewSymbol(
                            symbol,
                            "existing"
                          )
                        }
                        className="text-slate-400 hover:text-red-500"
                        aria-label={`移除已存在 symbol ${symbol}`}
                        title="移除"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
                {props.marketManualSymbolPreview.invalid.map((symbol: string) => (
                  <div
                    key={`preview-invalid-${symbol}`}
                    className="flex items-center justify-between gap-2 rounded bg-rose-50/70 dark:bg-rose-900/15 px-2 py-1"
                  >
                    <span className="font-mono text-xs text-slate-700 dark:text-slate-200">
                      {symbol}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-rose-700 dark:text-rose-300">
                        无效
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          props.handleRemoveManualPreviewSymbol(
                            symbol,
                            "invalid"
                          )
                        }
                        className="text-slate-400 hover:text-red-500"
                        aria-label={`移除无效 symbol ${symbol}`}
                        title="移除"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
                {props.marketManualSymbolPreview.addable.length === 0 &&
                  props.marketManualSymbolPreview.existing.length === 0 &&
                  props.marketManualSymbolPreview.invalid.length === 0 &&
                  props.marketManualSymbolPreview.duplicates === 0 && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      --
                    </div>
                  )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  <span>有效 {props.marketManualSymbolPreview.addable.length}</span>
                  <span>/ 已存在 {props.marketManualSymbolPreview.existing.length}</span>
                  <span>/ 无效 {props.marketManualSymbolPreview.invalid.length}</span>
                  <span>/ 重复 {props.marketManualSymbolPreview.duplicates}</span>
                </span>
                <button
                  type="button"
                  onClick={props.handleApplyManualTargetSymbols}
                  disabled={props.marketManualSymbolPreview.addable.length === 0}
                  className="ui-btn ui-btn-primary h-7 px-3 rounded-[4px] text-[11px] font-semibold whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  加入目标池（{props.marketManualSymbolPreview.addable.length}）
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
