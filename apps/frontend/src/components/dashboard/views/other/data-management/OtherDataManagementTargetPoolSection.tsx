import type * as React from "react";
import type { ChangeEvent } from "react";

import type {
  MarketTargetsConfig,
  ResolvedTargetSymbol,
  TargetReasonsDiff
} from "@mytrader/shared";

import type { OtherViewProps } from "../../OtherView";

interface TargetPoolMetricCard {
  key: string;
  label: string;
  value: string | number;
}

export function OtherDataManagementTargetPoolSection(props: OtherViewProps) {
  return (
    <>
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900 dark:text-white">
            目标池编辑
          </h3>
        </div>

        <div className="rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark overflow-hidden">
          <div className="border-b border-slate-200 dark:border-border-dark bg-slate-50/70 dark:bg-background-dark/45 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 ${
                    props.marketTargetsDirty
                      ? "border-amber-300 text-amber-700 dark:text-amber-300"
                      : "border-emerald-300 text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  {props.marketTargetsDirty ? "草稿未保存" : "草稿已同步"}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  预览标的：
                  <span className="ml-1 font-mono text-slate-700 dark:text-slate-200">
                    {props.marketTargetsDiffPreview
                      ? props.marketTargetsDiffPreview.draft.symbols.length
                      : props.marketTargetsPreview
                        ? props.marketTargetsPreview.symbols.length
                        : "--"}
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <props.Button
                  variant="secondary"
                  size="sm"
                  icon="restart_alt"
                  onClick={props.handleResetTargetsDraft}
                  disabled={!props.marketTargetsDirty}
                >
                  重置草稿
                </props.Button>
                <props.Button
                  variant="secondary"
                  size="sm"
                  icon="refresh"
                  onClick={() => {
                    void props.refreshMarketTargets();
                    void props.refreshMarketTargetsDiff();
                  }}
                  disabled={props.marketTargetsLoading}
                >
                  刷新基线
                </props.Button>
                <props.Button
                  variant="primary"
                  size="sm"
                  icon="save"
                  onClick={props.handleSaveTargets}
                  disabled={props.marketTargetsSaving || !props.marketTargetsDirty}
                >
                  保存
                </props.Button>
              </div>
            </div>
          </div>

          <div
            ref={props.targetsEditorGridRef}
            className="grid grid-cols-1 lg:grid-cols-[minmax(0,var(--targets-left-pct))_8px_minmax(0,var(--targets-right-pct))] gap-3 p-3 items-start"
            style={
              {
                "--targets-left-pct": `${props.targetsEditorLeftPct}%`,
                "--targets-right-pct": `calc(${100 - props.targetsEditorLeftPct}% - 8px)`
              } as React.CSSProperties
            }
          >
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

            <div
              role="separator"
              aria-orientation="vertical"
              tabIndex={0}
              onPointerDown={props.handleTargetsEditorResizePointerDown}
              onKeyDown={props.handleTargetsEditorResizeKeyDown}
              className="hidden lg:flex w-[8px] h-full cursor-col-resize items-center justify-center rounded-[3px] hover:bg-primary/12 focus:bg-primary/16 focus:outline-none transition-colors"
              title="拖拽调节左右宽度（←/→ 可微调）"
            >
              <span className="h-full w-px bg-slate-300/95 dark:bg-border-dark pointer-events-none" />
            </div>

            <div className="min-w-0 rounded-md bg-slate-50/70 dark:bg-background-dark/45 p-3 space-y-3 lg:sticky lg:top-3">
              <div className="rounded-md bg-white/65 dark:bg-background-dark/55 p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    标的结构看板
                  </div>
                  <div className="inline-flex items-center rounded-md bg-slate-100/80 dark:bg-background-dark/70 p-1">
                    <button
                      type="button"
                      onClick={() => props.setMarketTargetPoolStatsScope("universe")}
                      className={`h-7 px-3 rounded-[5px] text-xs transition-colors ${
                        props.marketTargetPoolStatsScope === "universe"
                          ? "bg-primary/20 text-slate-900 dark:text-slate-100"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      }`}
                    >
                      全量标的
                    </button>
                    <button
                      type="button"
                      onClick={() => props.setMarketTargetPoolStatsScope("focus")}
                      className={`h-7 px-3 rounded-[5px] text-xs transition-colors ${
                        props.marketTargetPoolStatsScope === "focus"
                          ? "bg-primary/20 text-slate-900 dark:text-slate-100"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      }`}
                    >
                      强相关标的
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                  {props.marketTargetPoolMetricCards.map((card: TargetPoolMetricCard) => (
                    <button
                      key={card.key}
                      type="button"
                      onClick={() => props.setMarketTargetPoolDetailMetric(card.key)}
                      className="rounded-md border border-slate-200/60 dark:border-border-dark/70 bg-slate-100/65 dark:bg-background-dark/70 px-2.5 py-2 min-h-[54px] flex flex-col justify-between text-left hover:bg-slate-200/60 dark:hover:bg-background-dark/82 transition-colors"
                    >
                      <div className="text-slate-500 dark:text-slate-400">
                        {card.label}
                      </div>
                      <div className="font-mono text-sm text-slate-800 dark:text-slate-100">
                        {card.value}
                      </div>
                    </button>
                  ))}
                </div>

                {(props.marketActiveTargetPoolStats.loading ||
                  props.marketActiveTargetPoolStats.error) && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {props.marketActiveTargetPoolStats.loading
                      ? "统计中..."
                      : `统计失败：${props.marketActiveTargetPoolStats.error}`}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="h-8 rounded-md border border-primary/40 bg-primary/18 text-slate-900 dark:text-white text-xs font-medium flex items-center justify-center">
                  差异预览
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!props.marketTargetsDiffPreview && !props.marketTargetsPreview) {
                      void props.refreshMarketTargetsDiff();
                    }
                    props.setMarketCurrentTargetsModalOpen(true);
                  }}
                  className="h-8 rounded-md bg-slate-100/75 dark:bg-background-dark/55 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-background-dark/75 transition-colors"
                >
                  当前目标池
                </button>
              </div>

              <div className="max-h-[520px] overflow-auto space-y-2">
                <div className="rounded-md bg-white/70 dark:bg-background-dark/55">
                  <button
                    type="button"
                    onClick={() => props.handleToggleDiffSection("added")}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-left border-b border-slate-200/70 dark:border-border-dark/60"
                  >
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      新增
                    </span>
                    <span className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-mono">
                        {props.marketFilteredAddedSymbols.length}
                      </span>
                      <span className="material-icons-outlined text-sm">
                        {props.marketDiffSectionOpen.added
                          ? "expand_less"
                          : "expand_more"}
                      </span>
                    </span>
                  </button>
                  {props.marketDiffSectionOpen.added && (
                    <div className="px-2 pb-2 space-y-1">
                      {props.marketFilteredAddedSymbols.length === 0 ? (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          --
                        </div>
                      ) : (
                        props.marketFilteredAddedSymbols
                          .slice(0, 100)
                          .map((row: ResolvedTargetSymbol) => (
                          <div
                            key={`added-${row.symbol}`}
                            className="flex items-start justify-between gap-3 py-1 border-b border-slate-200/60 dark:border-border-dark/60 last:border-b-0"
                          >
                            <span className="font-mono text-xs text-slate-700 dark:text-slate-200">
                              {row.symbol}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 text-right">
                              {props.formatTargetsReasons(row.reasons)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-md bg-white/70 dark:bg-background-dark/55">
                  <button
                    type="button"
                    onClick={() => props.handleToggleDiffSection("removed")}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-left border-b border-slate-200/70 dark:border-border-dark/60"
                  >
                    <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                      移除
                    </span>
                    <span className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-mono">
                        {props.marketFilteredRemovedSymbols.length}
                      </span>
                      <span className="material-icons-outlined text-sm">
                        {props.marketDiffSectionOpen.removed
                          ? "expand_less"
                          : "expand_more"}
                      </span>
                    </span>
                  </button>
                  {props.marketDiffSectionOpen.removed && (
                    <div className="px-2 pb-2 space-y-1">
                      {props.marketFilteredRemovedSymbols.length === 0 ? (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          --
                        </div>
                      ) : (
                        props.marketFilteredRemovedSymbols
                          .slice(0, 100)
                          .map((row: ResolvedTargetSymbol) => (
                            <div
                              key={`removed-${row.symbol}`}
                              className="flex items-start justify-between gap-3 py-1 border-b border-slate-200/60 dark:border-border-dark/60 last:border-b-0"
                            >
                              <span className="font-mono text-xs text-slate-700 dark:text-slate-200">
                                {row.symbol}
                              </span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 text-right">
                                {props.formatTargetsReasons(row.reasons)}
                              </span>
                            </div>
                          ))
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-md bg-white/70 dark:bg-background-dark/55">
                  <button
                    type="button"
                    onClick={() => props.handleToggleDiffSection("reasonChanged")}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-left border-b border-slate-200/70 dark:border-border-dark/60"
                  >
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                      变化来源
                    </span>
                    <span className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-mono">
                        {props.marketFilteredReasonChangedSymbols.length}
                      </span>
                      <span className="material-icons-outlined text-sm">
                        {props.marketDiffSectionOpen.reasonChanged
                          ? "expand_less"
                          : "expand_more"}
                      </span>
                    </span>
                  </button>
                  {props.marketDiffSectionOpen.reasonChanged && (
                    <div className="px-2 pb-2 space-y-1">
                      {props.marketFilteredReasonChangedSymbols.length === 0 ? (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          --
                        </div>
                      ) : (
                        props.marketFilteredReasonChangedSymbols
                          .slice(0, 100)
                          .map((row: TargetReasonsDiff) => (
                            <div
                              key={`changed-${row.symbol}`}
                              className="py-1 border-b border-slate-200/60 dark:border-border-dark/60 last:border-b-0"
                            >
                              <div className="font-mono text-xs text-slate-700 dark:text-slate-200">
                                {row.symbol}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                旧：{props.formatTargetsReasons(row.baselineReasons)}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                新：{props.formatTargetsReasons(row.draftReasons)}
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
