import type { ChangeEvent } from "react";

import type {
  InstrumentProfileSummary,
  PortfolioSnapshot,
  TagSummary
} from "@mytrader/shared";
import type {
  MarketChartRangeKey,
  MarketFilterMarket,
  MarketScope,
  TargetPoolStatsScope,
  TargetPoolStructureStats
} from "../types";

type DashboardMarketState = ReturnType<
  typeof import("../hooks/use-dashboard-market").useDashboardMarket<
    MarketScope,
    MarketFilterMarket,
    MarketChartRangeKey,
    TargetPoolStatsScope,
    TargetPoolStructureStats
  >
>;
type DashboardMarketAdminDerived = ReturnType<
  typeof import("../hooks/use-dashboard-market-admin-derived").useDashboardMarketAdminDerived<TargetPoolStatsScope>
>;
type DashboardMarketDerived = ReturnType<
  typeof import("../hooks/use-dashboard-market-derived").useDashboardMarketDerived
>;
type DashboardMarketOrchestration = ReturnType<
  typeof import("../hooks/use-dashboard-market-orchestration").useDashboardMarketOrchestration
>;
type DashboardMarketResizeResult = ReturnType<
  typeof import("../hooks/use-dashboard-market-resize").useDashboardMarketResize
>;

interface MarketViewExternalProps {
  Button: typeof import("../shared").Button;
  ChartErrorBoundary: typeof import("../shared").ChartErrorBoundary;
  FormGroup: typeof import("../shared").FormGroup;
  IconButton: typeof import("../shared").IconButton;
  Input: typeof import("../shared").Input;
  MarketAreaChart: typeof import("../shared").MarketAreaChart;
  MarketQuoteHeader: typeof import("../shared").MarketQuoteHeader;
  MarketVolumeMiniChart: typeof import("../shared").MarketVolumeMiniChart;
  Modal: typeof import("../shared").Modal;
  PopoverSelect: typeof import("../shared").PopoverSelect;
  formatCnDate: typeof import("../shared").formatCnDate;
  formatCnWanYiNullable: typeof import("../shared").formatCnWanYiNullable;
  formatNumber: typeof import("../shared").formatNumber;
  formatSignedCnWanYiNullable: typeof import("../shared").formatSignedCnWanYiNullable;
  formatSignedPctNullable: typeof import("../shared").formatSignedPctNullable;
  formatThemeLabel: typeof import("../shared").formatThemeLabel;
  getCnChangeTone: typeof import("../shared").getCnChangeTone;
  getCnToneTextClass: typeof import("../shared").getCnToneTextClass;
  marketChartRanges: ReadonlyArray<MarketRangeOption>;
  snapshot: PortfolioSnapshot | null;
  sortTagMembersByChangePct: typeof import("../shared").sortTagMembersByChangePct;
}

export type MarketViewProps = DashboardMarketState &
  DashboardMarketAdminDerived &
  DashboardMarketDerived &
  DashboardMarketOrchestration &
  Pick<
    DashboardMarketResizeResult,
    | "handleMarketExplorerResizePointerDown"
    | "handleMarketExplorerResizeKeyDown"
  > &
  MarketViewExternalProps;

interface MarketTagFacetItem {
  tag: string;
  level: string;
  name: string;
}

interface MarketRangeOption {
  key: MarketChartRangeKey;
  label: string;
}

interface MarketChartHoverDatum {
  date: string;
  close: number;
}

export function MarketView(props: MarketViewProps) {
  const {
    Button,
    ChartErrorBoundary,
    FormGroup,
    IconButton,
    Input,
    MarketAreaChart,
    MarketQuoteHeader,
    MarketVolumeMiniChart,
    Modal,
    PopoverSelect,
    formatCnDate,
    formatCnWanYiNullable,
    formatNumber,
    formatSignedCnWanYiNullable,
    formatSignedPctNullable,
    formatThemeLabel,
    getCnChangeTone,
    getCnToneTextClass,
    handleAddManualTheme,
    handleAddSelectedToWatchlist,
    handleAddTargetTag,
    handleAddUserTag,
    handleMarketExplorerResizeKeyDown,
    handleMarketExplorerResizePointerDown,
    handleRemoveUserTag,
    handleRemoveWatchlistItem,
    handleSelectInstrument,
    handleSelectTag,
    handleSyncInstrumentCatalog,
    marketActiveMoneyflowRatio,
    marketActiveMoneyflowVol,
    marketActiveVolume,
    marketCatalogSyncSummary,
    marketCatalogSyncing,
    marketChartBars,
    marketChartHasEnoughData,
    marketChartHoverDate,
    marketChartHoverPrice,
    marketChartLoading,
    marketChartRange,
    marketChartRanges,
    marketCollectionSelectValue,
    marketEffectiveScope,
    marketExplorerWidth,
    marketFilterAssetClasses,
    marketFilterKinds,
    marketFilterMarket,
    marketFilteredListSymbols,
    marketFiltersActiveCount,
    marketFiltersOpen,
    marketHoldingUnitCost,
    marketHoldingsSymbols,
    marketHoldingsSymbolsFiltered,
    marketInstrumentDetailsOpen,
    marketLatestBar,
    marketManualThemeDraft,
    marketManualThemeLoading,
    marketManualThemeOptions,
    marketNameBySymbol,
    marketQuotesBySymbol,
    marketQuotesLoading,
    marketRangeSummary,
    marketSearchLoading,
    marketSearchQuery,
    marketSearchResults,
    marketSearchResultsFiltered,
    marketSelectedIndustry,
    marketSelectedManualThemes,
    marketSelectedPlainUserTags,
    marketSelectedProfile,
    marketSelectedQuote,
    marketSelectedSymbol,
    marketSelectedTag,
    marketSelectedTagAggregate,
    marketSelectedTagSeriesReturnPct,
    marketSelectedTagSeriesTone,
    marketSelectedThemes,
    marketShowProviderData,
    marketTagChartHoverDate,
    marketTagChartHoverPrice,
    marketTagMembers,
    marketTagMembersLoading,
    marketTagMembersModalOpen,
    marketTagPickerOpen,
    marketTagPickerQuery,
    marketTagSeriesBars,
    marketTagSeriesError,
    marketTagSeriesLatestCoverageLabel,
    marketTagSeriesLoading,
    marketTagSeriesResult,
    marketTags,
    marketTagsLoading,
    marketTargetPrice,
    marketUserTagDraft,
    marketVolumeMode,
    marketWatchlistGroupDraft,
    marketWatchlistLoading,
    refreshMarketTags,
    resetMarketFilters,
    setMarketChartHoverDate,
    setMarketChartHoverPrice,
    setMarketChartRange,
    setMarketFilterAssetClasses,
    setMarketFilterKinds,
    setMarketFilterMarket,
    setMarketFiltersOpen,
    setMarketInstrumentDetailsOpen,
    setMarketManualThemeDraft,
    setMarketScope,
    setMarketSearchQuery,
    setMarketSelectedSymbol,
    setMarketSelectedTag,
    setMarketShowProviderData,
    setMarketTagChartHoverDate,
    setMarketTagChartHoverPrice,
    setMarketTagMembersModalOpen,
    setMarketTagPickerOpen,
    setMarketTagPickerQuery,
    setMarketUserTagDraft,
    setMarketVolumeMode,
    setMarketWatchlistGroupDraft,
    snapshot,
    sortTagMembersByChangePct,
  } = props;

  return (
            <>
              <div className="h-full min-h-0 flex">
                {/* Explorer Sidebar */}
                <aside
                  className="flex-shrink-0 min-h-0 flex flex-col border-r border-border-light dark:border-border-dark bg-white/70 dark:bg-background-dark/65 backdrop-blur-lg"
                  style={{ width: marketExplorerWidth }}
                >
                  <div className="pt-0 pb-0 border-b border-border-light dark:border-border-dark space-y-0">
                    <div className="w-full rounded-none border border-slate-200 dark:border-border-dark bg-white/75 dark:bg-panel-dark/80 backdrop-blur shadow-sm focus-within:border-primary/60">
                      <div className="flex items-center px-0 bg-transparent dark:bg-white/5">
                        <div className="flex-1 relative">
                          <span className="material-icons-outlined absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                            search
                          </span>
                          <Input
                            value={marketSearchQuery}
                            onChange={(event: ChangeEvent<HTMLInputElement>) =>
                              setMarketSearchQuery(event.target.value)
                            }
                            placeholder="搜索标的（代码/名称）"
                            className="pl-9 pr-2 !rounded-none !border-0 !bg-transparent dark:!bg-transparent shadow-none focus:ring-0 focus:border-transparent dark:placeholder:text-slate-500"
                          />
                        </div>
                      </div>

                      <div className="relative border-t border-slate-200/70 dark:border-border-dark/70">
                        <PopoverSelect
                          value={marketCollectionSelectValue}
                          onChangeValue={(value: string) => {
                            setMarketSearchQuery("");
                            setMarketSelectedSymbol(null);

                            if (value === "builtin:holdings") {
                              setMarketScope("holdings");
                              setMarketSelectedTag(null);
                              return;
                            }

                            if (value === "builtin:watchlist") {
                              setMarketScope("tags");
                              void handleSelectTag("watchlist:all");
                              return;
                            }

                            if (value.startsWith("tag:")) {
                              setMarketScope("tags");
                              void handleSelectTag(value.slice("tag:".length));
                            }
                          }}
                          options={[
                            { value: "builtin:holdings", label: "持仓" },
                            { value: "builtin:watchlist", label: "自选" },
                            ...marketTags
                              .filter(
                                (tag: TagSummary) =>
                                  !(
                                    tag.source === "watchlist" &&
                                    tag.tag === "watchlist:all"
                                  )
                              )
                              .map((tag: TagSummary) => {
                                const sourceLabel =
                                  tag.source === "provider"
                                    ? "提供方"
                                    : tag.source === "user"
                                      ? "用户"
                                      : "自选";
                                return {
                                  value: `tag:${tag.tag}`,
                                  label: `${sourceLabel}：${tag.tag}`
                                };
                              })
                          ]}
                          className="w-full"
                          buttonClassName="!rounded-none !border-0 !bg-transparent dark:!bg-transparent !shadow-none hover:!bg-transparent dark:hover:!bg-transparent pl-9 pr-8"
                        />

                        <IconButton
                          icon="filter_alt"
                          label={
                            marketFiltersActiveCount > 0
                              ? `筛选（${marketFiltersActiveCount}）`
                              : "筛选"
                          }
                          onClick={() => setMarketFiltersOpen(true)}
                          size="sm"
                          className="absolute right-0 top-0 z-10 h-6 w-6 rounded-none border-0 border-l border-slate-200/70 dark:border-border-dark/70"
                        />
                      </div>
                    </div>

                    {marketCatalogSyncSummary && marketSearchQuery.trim() && (
                      <div className="px-3 text-[11px] text-slate-500 dark:text-slate-400">
                        {marketCatalogSyncSummary}
                      </div>
                    )}

                    {(marketWatchlistLoading || marketQuotesLoading) && (
                      <div className="px-3 flex items-center justify-end text-[10px] leading-4 text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-2">
                          {marketWatchlistLoading && <span>自选更新中…</span>}
                          {marketQuotesLoading && <span>报价加载中…</span>}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto">
                    {marketEffectiveScope === "search" && (
                      <div className="py-2">
                        {marketSearchLoading && (
                          <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                            搜索中...
                          </div>
                        )}
                        {!marketSearchLoading && marketSearchQuery.trim() === "" && (
                          <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                            输入关键词开始搜索（如 600519 / 贵州茅台 / 510300）。
                          </div>
                        )}
                        {!marketSearchLoading &&
                          marketSearchQuery.trim() !== "" &&
                          marketSearchResults.length === 0 && (
                            <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                              <div className="flex items-center justify-between gap-2">
                                <span>未找到匹配标的（需先同步标的库）。</span>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  icon="download"
                                  onClick={handleSyncInstrumentCatalog}
                                  disabled={marketCatalogSyncing}
                                >
                                  {marketCatalogSyncing ? "同步中" : "同步"}
                                </Button>
                              </div>
                            </div>
                          )}

                        {!marketSearchLoading &&
                          marketSearchQuery.trim() !== "" &&
                          marketSearchResults.length > 0 &&
                          marketSearchResultsFiltered.length === 0 && (
                            <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                              筛选后无结果。
                            </div>
                          )}

                        {marketSearchResultsFiltered.map((item: InstrumentProfileSummary) => {
                          const isActive = item.symbol === marketSelectedSymbol;
                          const quote = marketQuotesBySymbol[item.symbol] ?? null;
                          const tone = getCnChangeTone(quote?.changePct ?? null);
                          return (
                            <button
                              key={item.symbol}
                              type="button"
                              onClick={() => handleSelectInstrument(item.symbol)}
                              className={`w-full text-left px-3 py-2 border-b border-slate-200/70 dark:border-border-dark/70 last:border-b-0 transition-colors ${
                                isActive
                                  ? "bg-primary/10"
                                  : "hover:bg-slate-50 dark:hover:bg-background-dark/70"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                    {item.name ?? item.symbol}
                                  </div>
                                  <div className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                    {item.symbol}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-mono text-sm text-slate-900 dark:text-white">
                                    {formatNumber(quote?.close ?? null, 2)}
                                  </div>
                                  <div
                                    className={`font-mono text-[11px] ${getCnToneTextClass(tone)}`}
                                  >
                                    {formatSignedPctNullable(quote?.changePct ?? null)}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {marketEffectiveScope === "holdings" && (
                      <div className="py-2">
                        {!snapshot && (
                          <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                            暂无组合数据。
                          </div>
                        )}
                        {snapshot && marketHoldingsSymbols.length === 0 && (
                          <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                            当前组合没有股票/ETF 持仓。
                          </div>
                        )}
                        {snapshot &&
                          marketHoldingsSymbols.length > 0 &&
                          marketHoldingsSymbolsFiltered.length === 0 && (
                            <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                              筛选后无结果。
                            </div>
                          )}
                        {marketFilteredListSymbols.map((symbol: string) => {
                          const isActive = symbol === marketSelectedSymbol;
                          const quote = marketQuotesBySymbol[symbol] ?? null;
                          const tone = getCnChangeTone(quote?.changePct ?? null);
                          const name = marketNameBySymbol.get(symbol) ?? symbol;
                          return (
                            <button
                              key={symbol}
                              type="button"
                              onClick={() => handleSelectInstrument(symbol)}
                              className={`w-full text-left px-3 py-2 border-b border-slate-200/70 dark:border-border-dark/70 last:border-b-0 transition-colors ${
                                isActive
                                  ? "bg-primary/10"
                                  : "hover:bg-slate-50 dark:hover:bg-background-dark/70"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                    {name}
                                  </div>
                                  <div className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                    {symbol}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-mono text-sm text-slate-900 dark:text-white">
                                    {formatNumber(quote?.close ?? null, 2)}
                                  </div>
                                  <div
                                    className={`font-mono text-[11px] ${getCnToneTextClass(tone)}`}
                                  >
                                    {formatSignedPctNullable(quote?.changePct ?? null)}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {marketEffectiveScope === "tags" && (
                      <div className="py-2">
                        {!marketSelectedTag && (
                          <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                            请选择一个集合（如 watchlist:all、industry:白酒）。
                          </div>
                        )}

                        {marketSelectedTag && (
                          <>
                            <button
                              type="button"
                              onClick={() => setMarketSelectedSymbol(null)}
                              className={`w-full text-left px-3 py-2 border-b border-slate-200/70 dark:border-border-dark/70 transition-colors ${
                                marketSelectedSymbol === null
                                  ? "bg-primary/10"
                                  : "hover:bg-slate-50 dark:hover:bg-background-dark/70"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                    整体（市值加权）
                                  </div>
                                  <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                    {marketSelectedTagAggregate
                                      ? `覆盖 ${marketSelectedTagAggregate.includedCount}/${marketSelectedTagAggregate.totalCount}`
                                      : "--"}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div
                                    className={`font-mono text-sm ${getCnToneTextClass(
                                      getCnChangeTone(
                                        marketSelectedTagAggregate?.weightedChangePct ??
                                          null
                                      )
                                    )}`}
                                  >
                                    {formatSignedPctNullable(
                                      marketSelectedTagAggregate?.weightedChangePct ?? null
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                    流通市值权重
                                  </div>
                                </div>
                              </div>
                            </button>

                            {marketTagMembersLoading && (
                              <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                                加载集合成分中...
                              </div>
                            )}

                            {!marketTagMembersLoading &&
                              marketFilteredListSymbols.map((symbol: string) => {
                                const isActive = symbol === marketSelectedSymbol;
                                const quote = marketQuotesBySymbol[symbol] ?? null;
                                const tone = getCnChangeTone(quote?.changePct ?? null);
                                const name = marketNameBySymbol.get(symbol) ?? symbol;
                                const canRemove =
                                  marketSelectedTag.startsWith("watchlist:");
                                return (
                                  <button
                                    key={symbol}
                                    type="button"
                                    onClick={() => handleSelectInstrument(symbol)}
                                    className={`w-full text-left px-3 py-2 border-b border-slate-200/70 dark:border-border-dark/70 last:border-b-0 transition-colors ${
                                      isActive
                                        ? "bg-primary/10"
                                        : "hover:bg-slate-50 dark:hover:bg-background-dark/70"
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0 flex-1">
                                        <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                          {name}
                                        </div>
                                        <div className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                          {symbol}
                                        </div>
                                      </div>
                                      <div className="flex items-start gap-2">
                                        <div className="text-right">
                                          <div className="font-mono text-sm text-slate-900 dark:text-white">
                                            {formatNumber(quote?.close ?? null, 2)}
                                          </div>
                                          <div
                                            className={`font-mono text-[11px] ${getCnToneTextClass(tone)}`}
                                          >
                                            {formatSignedPctNullable(
                                              quote?.changePct ?? null
                                            )}
                                          </div>
                                        </div>
                                        {canRemove && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              void handleRemoveWatchlistItem(symbol);
                                            }}
                                            className="mt-0.5 text-slate-400 hover:text-red-500"
                                            aria-label={`从自选移除 ${symbol}`}
                                            title="从自选移除"
                                          >
                                            <span className="material-icons-outlined text-base">
                                              close
                                            </span>
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </aside>

                <div
                  role="separator"
                  aria-orientation="vertical"
                  tabIndex={0}
                  onPointerDown={handleMarketExplorerResizePointerDown}
                  onKeyDown={handleMarketExplorerResizeKeyDown}
                  className="w-1 flex-shrink-0 cursor-col-resize bg-transparent hover:bg-primary/20 focus:bg-primary/25 focus:outline-none"
                  title="拖拽调节宽度（←/→ 可微调）"
                />

                {/* Detail Workspace */}
                <main className="flex-1 min-w-0 min-h-0 overflow-hidden bg-white/40 dark:bg-background-dark/40">
                  {!marketSelectedSymbol &&
                    !(marketEffectiveScope === "tags" && marketSelectedTag) && (
                    <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400">
                      请选择左侧列表中的标的或集合。
                    </div>
                  )}

                  {marketEffectiveScope === "tags" && marketSelectedTag && !marketSelectedSymbol && (
                    <div className="h-full min-h-0 flex flex-col">
                      <div className="flex-shrink-0 border-b border-border-light dark:border-border-dark bg-white/70 dark:bg-background-dark/70 backdrop-blur-lg px-6 py-5">
                        <div className="flex items-start justify-between gap-6">
                          <div>
                            <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
                              {marketSelectedTag}
                            </div>
                            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                              市值加权口径：流通市值（circ_mv）；缺价格/缺市值成分会被剔除并重归一化权重。
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div
                              className={`text-2xl font-mono font-semibold ${getCnToneTextClass(
                                getCnChangeTone(
                                  marketSelectedTagAggregate?.weightedChangePct ?? null
                                )
                              )}`}
                            >
                              {formatSignedPctNullable(
                                marketSelectedTagAggregate?.weightedChangePct ?? null
                              )}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {marketSelectedTagAggregate
                                ? `覆盖 ${marketSelectedTagAggregate.includedCount}/${marketSelectedTagAggregate.totalCount}（剔除 ${marketSelectedTagAggregate.excludedCount}）`
                                : "--"}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                icon="format_list_bulleted"
                                onClick={() => setMarketTagMembersModalOpen(true)}
                                disabled={marketTagMembersLoading || marketTagMembers.length === 0}
                              >
                                查看成分
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                icon="folder_open"
                                onClick={() => setMarketTagPickerOpen(true)}
                              >
                                切换集合
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 min-h-0 px-6 py-4 space-y-4">
                        <div className="rounded-xl border border-slate-200 dark:border-border-dark bg-white/70 dark:bg-panel-dark/80 backdrop-blur p-4">
                          <div className="flex items-start justify-between gap-6">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                整体走势（派生指数，base=100）
                              </div>
                              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                权重口径：优先使用上一交易日 `circ_mv`，缺失时回退当日 `circ_mv`；缺价格/缺市值成分会被剔除并重归一化权重。
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <div
                                className={`font-mono text-sm font-semibold ${getCnToneTextClass(
                                  marketSelectedTagSeriesTone
                                )}`}
                              >
                                {formatSignedPctNullable(marketSelectedTagSeriesReturnPct)}
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 relative group h-10 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-0.5 group-hover:opacity-0 transition-opacity">
                              <div className="text-[13px] font-semibold text-slate-900 dark:text-white">
                                {formatCnDate(
                                  marketTagChartHoverDate ??
                                    marketTagSeriesResult?.endDate ??
                                    null
                                )}
                              </div>
                              {marketTagChartHoverPrice !== null && (
                                <div className="text-[14px] font-mono font-semibold text-primary">
                                  {formatNumber(marketTagChartHoverPrice, 2)}
                                </div>
                              )}
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="flex items-center gap-1 rounded-full bg-slate-100/80 dark:bg-black/40 backdrop-blur px-2 py-1">
                                {marketChartRanges.map((item: MarketRangeOption) => {
                                  const isActive = marketChartRange === item.key;
                                  return (
                                    <button
                                      key={item.key}
                                      type="button"
                                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors ${
                                        isActive
                                          ? "bg-primary/20 text-primary dark:bg-white/20 dark:text-white"
                                          : "text-slate-600 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-white/10"
                                      }`}
                                      onClick={() =>
                                        setMarketChartRange(item.key)
                                      }
                                    >
                                      {item.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          <div className="h-52 overflow-hidden">
                            {marketTagSeriesLoading && (
                              <div className="h-full flex items-center justify-center text-sm text-slate-500 dark:text-slate-300">
                                加载中...
                              </div>
                            )}
                            {!marketTagSeriesLoading && marketTagSeriesError && (
                              <div className="h-full flex items-center justify-center text-sm text-slate-500 dark:text-slate-300">
                                {marketTagSeriesError}
                              </div>
                            )}
                            {!marketTagSeriesLoading &&
                              !marketTagSeriesError &&
                              marketTagSeriesBars.length === 0 && (
                                <div className="h-full flex items-center justify-center text-sm text-slate-500 dark:text-slate-300">
                                  暂无区间数据（需要 daily_prices + daily_basics/circ_mv）。
                                </div>
                              )}
                            {!marketTagSeriesLoading &&
                              !marketTagSeriesError &&
                              marketTagSeriesBars.length > 0 && (
                                <ChartErrorBoundary
                                  resetKey={`tag-series:${marketSelectedTag}:${marketChartRange}`}
                                >
                                  <MarketAreaChart
                                    bars={marketTagSeriesBars}
                                    tone={marketSelectedTagSeriesTone}
                                    onHoverDatumChange={(
                                      datum: MarketChartHoverDatum | null
                                    ) => {
                                      setMarketTagChartHoverDate(datum?.date ?? null);
                                      setMarketTagChartHoverPrice(datum?.close ?? null);
                                    }}
                                  />
                                </ChartErrorBoundary>
                              )}
                          </div>

                          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                            <span>{marketTagSeriesLatestCoverageLabel}</span>
                            {marketTagSeriesResult &&
                              marketTagSeriesResult.usedMemberCount <
                                marketTagSeriesResult.memberCount && (
                                <span>
                                  仅使用前 {marketTagSeriesResult.usedMemberCount}/
                                  {marketTagSeriesResult.memberCount}
                                  {marketTagSeriesResult.truncated ? "（总数已截断）" : ""}
                                </span>
                              )}
                          </div>
                        </div>

                        {marketTagMembersLoading && (
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            加载中...
                          </div>
                        )}

                        {!marketTagMembersLoading && marketTagMembers.length === 0 && (
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            暂无成分。
                          </div>
                        )}

                        {!marketTagMembersLoading && marketTagMembers.length > 0 && (
                          <div className="rounded-xl border border-slate-200 dark:border-border-dark overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-white/80 dark:bg-background-dark/80 backdrop-blur">
                                <tr className="text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-border-dark">
                                  <th className="text-left font-semibold px-4 py-2">
                                    Symbol
                                  </th>
                                  <th className="text-right font-semibold px-4 py-2">
                                    Price
                                  </th>
                                  <th className="text-right font-semibold px-4 py-2">
                                    Change%
                                  </th>
                                  <th className="text-right font-semibold px-4 py-2">
                                    circ_mv
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {sortTagMembersByChangePct(
                                  marketTagMembers,
                                  marketQuotesBySymbol
                                )
                                  .slice(0, 20)
                                  .map((symbol: string) => {
                                    const quote = marketQuotesBySymbol[symbol] ?? null;
                                    const tone = getCnChangeTone(quote?.changePct ?? null);
                                    return (
                                      <tr
                                        key={symbol}
                                        className="border-b border-slate-200/70 dark:border-border-dark/70 last:border-b-0 hover:bg-slate-50 dark:hover:bg-background-dark/70 cursor-pointer"
                                        onClick={() => handleSelectInstrument(symbol)}
                                      >
                                        <td className="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-200">
                                          {symbol}
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono text-xs text-slate-900 dark:text-white">
                                          {formatNumber(quote?.close ?? null, 2)}
                                        </td>
                                        <td
                                          className={`px-4 py-2 text-right font-mono text-xs ${getCnToneTextClass(
                                            tone
                                          )}`}
                                        >
                                          {formatSignedPctNullable(quote?.changePct ?? null)}
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono text-xs text-slate-500 dark:text-slate-400">
                                          {formatNumber(quote?.circMv ?? null, 2)}
                                        </td>
                                      </tr>
                                    );
                                  })}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {!marketTagMembersLoading && marketTagMembers.length > 20 && (
                          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            仅展示前 20 个标的（共 {marketTagMembers.length}）。点击“查看成分”查看完整列表。
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {marketSelectedSymbol && (
                    <div className="h-full min-h-0 grid grid-rows-[1.3fr_5.7fr_3fr]">
                      <div className="min-h-0 border-b border-border-light dark:border-border-dark bg-white/70 dark:bg-background-dark/70 backdrop-blur-lg px-6 py-4">
                        <div className="flex items-start justify-between gap-6">
                          <div className="min-w-0">
                            <div className="flex items-baseline gap-3 flex-wrap">
                              <div className="text-4xl font-extrabold text-slate-900 dark:text-white">
                                {marketSelectedProfile?.symbol ?? marketSelectedSymbol}
                              </div>
                              <div className="text-lg font-semibold text-slate-700 dark:text-slate-200 truncate">
                                {marketSelectedProfile?.name ?? "--"}
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                              {marketSelectedProfile?.market ?? "--"} ·{" "}
                              {marketSelectedProfile?.currency ?? "--"} ·{" "}
                              {marketSelectedProfile?.assetClass ?? "--"}
                            </div>
                          </div>

                          <div className="flex items-start gap-4">
                            <div className="flex flex-col items-end gap-1">
                              <MarketQuoteHeader quote={marketSelectedQuote} />
                            </div>
                            <div className="flex flex-col items-end gap-2 pt-1">
                              <div className="flex items-center gap-2">
                                {marketEffectiveScope === "tags" && marketSelectedTag && (
                                  <IconButton
                                    icon="arrow_back"
                                    label="返回集合"
                                    onClick={() => setMarketSelectedSymbol(null)}
                                  />
                                )}
                                <IconButton
                                  icon="star"
                                  label="加入自选"
                                  onClick={handleAddSelectedToWatchlist}
                                  disabled={!marketSelectedProfile}
                                />
                                <IconButton
                                  icon="info"
                                  label="标的详情"
                                  onClick={() => setMarketInstrumentDetailsOpen(true)}
                                  disabled={!marketSelectedProfile}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="min-h-0 px-6 pt-3 pb-3 flex flex-col">
                        <div className="flex-shrink-0 pb-1">
                          <div className="relative group h-9">
                            <div className="absolute inset-0 z-0 flex items-center justify-center">
                              <div className="flex flex-col items-center gap-0.5 group-hover:opacity-0 transition-opacity">
                                <div className="text-[13px] font-semibold text-slate-900 dark:text-white">
                                  {formatCnDate(
                                    marketChartHoverDate ??
                                      marketSelectedQuote?.tradeDate ??
                                      marketLatestBar?.date ??
                                      null
                                  )}
                                </div>
                                {marketChartHoverPrice !== null && (
                                  <div className="text-[14px] font-mono font-semibold text-primary">
                                    {formatNumber(marketChartHoverPrice, 2)}
                                  </div>
                                )}
                              </div>
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="flex items-center gap-1 rounded-full bg-slate-100/80 dark:bg-black/40 backdrop-blur px-2 py-1">
                                  {marketChartRanges.map((item: MarketRangeOption) => {
                                    const isActive = marketChartRange === item.key;
                                    return (
                                      <button
                                        key={item.key}
                                        type="button"
                                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors ${
                                          isActive
                                            ? "bg-primary/20 text-primary dark:bg-white/20 dark:text-white"
                                            : "text-slate-600 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-white/10"
                                        }`}
                                        onClick={() =>
                                          setMarketChartRange(item.key)
                                        }
                                      >
                                        {item.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                            <div className="relative z-10 h-full flex items-center justify-between gap-3">
                              <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
                                <div className="flex items-baseline gap-1">
                                  <span>持仓价</span>
                                  <span className="font-mono text-xs text-slate-900 dark:text-white">
                                    {marketHoldingUnitCost === null
                                      ? "-"
                                      : formatNumber(marketHoldingUnitCost, 2)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-baseline gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                                <span>目标价</span>
                                <span
                                  className="font-mono text-xs text-slate-900 dark:text-white"
                                  title="可用用户标签 target:xx.xx 设置"
                                >
                                  {marketTargetPrice === null
                                    ? "-"
                                    : formatNumber(marketTargetPrice, 2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex-1 min-h-0 overflow-hidden relative">
                          {!marketChartHasEnoughData && (
                            <div className="h-full flex items-center justify-center text-sm text-slate-500 dark:text-slate-300">
                              {marketChartLoading ? "加载中..." : "暂无足够数据绘制图表。"}
                            </div>
                          )}

                          {marketChartHasEnoughData && (
                            <ChartErrorBoundary
                              resetKey={`symbol:${marketSelectedSymbol}:${marketChartRange}:${marketVolumeMode}`}
                            >
                              <MarketAreaChart
                                bars={marketChartBars}
                                tone={getCnChangeTone(
                                  marketSelectedQuote?.changePct ?? null
                                )}
                                onHoverDatumChange={(datum: MarketChartHoverDatum | null) => {
                                  setMarketChartHoverDate(datum?.date ?? null);
                                  setMarketChartHoverPrice(datum?.close ?? null);
                                }}
                              />
                            </ChartErrorBoundary>
                          )}

                          {marketChartLoading && marketChartHasEnoughData && (
                            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500 dark:text-slate-300 bg-white/40 dark:bg-black/20 backdrop-blur-sm">
                              加载中...
                            </div>
                          )}
                        </div>

                        <div className="flex-shrink-0 pt-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {marketVolumeMode === "volume" ? "每日成交量" : "势能（moneyflow）"}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-xs font-mono text-slate-700 dark:text-slate-200">
                                {marketVolumeMode === "volume" ? (
                                  formatCnWanYiNullable(marketActiveVolume, 2, 0)
                                ) : (
                                  <>
                                    {formatSignedCnWanYiNullable(marketActiveMoneyflowVol, 2, 0)}
                                    {marketActiveMoneyflowRatio !== null && (
                                      <span className="text-slate-400 dark:text-slate-500">
                                        {" "}
                                        · {(marketActiveMoneyflowRatio * 100).toFixed(1)}%
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                              <div className="flex items-center gap-1 rounded-full bg-slate-100/80 dark:bg-black/40 backdrop-blur px-1 py-1">
                                <button
                                  type="button"
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors ${
                                    marketVolumeMode === "volume"
                                      ? "bg-primary/20 text-primary dark:bg-white/20 dark:text-white"
                                      : "text-slate-600 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-white/10"
                                  }`}
                                  onClick={() => setMarketVolumeMode("volume")}
                                >
                                  总成交量
                                </button>
                                <button
                                  type="button"
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors ${
                                    marketVolumeMode === "moneyflow"
                                      ? "bg-primary/20 text-primary dark:bg-white/20 dark:text-white"
                                      : "text-slate-600 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-white/10"
                                  }`}
                                  onClick={() => setMarketVolumeMode("moneyflow")}
                                  title="势能来自行情数据源（Tushare moneyflow）。占比=|势能|/总成交量。"
                                >
                                  势能
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="mt-1 h-12 overflow-hidden">
                            <MarketVolumeMiniChart
                              bars={marketChartBars}
                              mode={marketVolumeMode}
                              activeDate={marketChartHoverDate}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="min-h-0 px-6 pb-6">
                        <div className="h-full border-t border-slate-200 dark:border-border-dark">
                          <table className="w-full text-sm">
                            <tbody className="divide-y divide-slate-200 dark:divide-border-dark">
                              <tr>
                                <td className="py-2 text-xs text-slate-500 dark:text-slate-400">
                                  今日开盘价
                                </td>
                                <td className="py-2 text-right font-mono text-sm text-slate-900 dark:text-white">
                                  {formatNumber(marketLatestBar?.open ?? null, 2)}
                                </td>
                                <td className="py-2 pl-6 text-xs text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-border-dark">
                                  区间最高价
                                </td>
                                <td className="py-2 text-right font-mono text-sm text-slate-900 dark:text-white">
                                  {formatNumber(marketRangeSummary.rangeHigh, 2)}
                                </td>
                              </tr>
                              <tr>
                                <td className="py-2 text-xs text-slate-500 dark:text-slate-400">
                                  今日最高价
                                </td>
                                <td className="py-2 text-right font-mono text-sm text-slate-900 dark:text-white">
                                  {formatNumber(marketLatestBar?.high ?? null, 2)}
                                </td>
                                <td className="py-2 pl-6 text-xs text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-border-dark">
                                  区间最低价
                                </td>
                                <td className="py-2 text-right font-mono text-sm text-slate-900 dark:text-white">
                                  {formatNumber(marketRangeSummary.rangeLow, 2)}
                                </td>
                              </tr>
                              <tr>
                                <td className="py-2 text-xs text-slate-500 dark:text-slate-400">
                                  今日最低价
                                </td>
                                <td className="py-2 text-right font-mono text-sm text-slate-900 dark:text-white">
                                  {formatNumber(marketLatestBar?.low ?? null, 2)}
                                </td>
                                <td className="py-2 pl-6 text-xs text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-border-dark">
                                  平均成交量
                                </td>
                                <td className="py-2 text-right font-mono text-sm text-slate-900 dark:text-white">
                                  {formatCnWanYiNullable(marketRangeSummary.avgVolume, 2, 0)}
                                </td>
                              </tr>
                              <tr>
                                <td className="py-2 text-xs text-slate-500 dark:text-slate-400">
                                  成交量
                                </td>
                                <td className="py-2 text-right font-mono text-sm text-slate-900 dark:text-white">
                                  {formatCnWanYiNullable(marketLatestBar?.volume ?? null, 2, 0)}
                                </td>
                                <td className="py-2 pl-6 text-xs text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-border-dark">
                                  区间收益率
                                </td>
                                <td className="py-2 text-right font-mono text-sm text-slate-900 dark:text-white">
                                  {formatSignedPctNullable(marketRangeSummary.rangeReturn)}
                                </td>
                              </tr>
                              <tr>
                                <td className="py-2 text-xs text-slate-500 dark:text-slate-400">
                                  前收
                                </td>
                                <td className="py-2 text-right font-mono text-sm text-slate-900 dark:text-white">
                                  {formatNumber(marketSelectedQuote?.prevClose ?? null, 2)}
                                </td>
                                <td className="py-2 pl-6 text-xs text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-border-dark">
                                  流通市值
                                </td>
                                <td className="py-2 text-right font-mono text-sm text-slate-900 dark:text-white">
                                  {formatCnWanYiNullable(marketSelectedQuote?.circMv ?? null, 2, 0)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </main>
              </div>

              <Modal
                open={marketFiltersOpen}
                title="筛选"
                onClose={() => setMarketFiltersOpen(false)}
              >
                <div className="space-y-4">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    当前筛选对「搜索 / 持仓」生效；集合成分（Tags）暂不做元数据筛选。
                  </div>

                  <FormGroup label="市场（market）">
                    <div className="flex items-center gap-2">
                      {([
                        { key: "all", label: "全部" },
                        { key: "CN", label: "CN" }
                      ] as const).map((item) => {
                        const isActive = marketFilterMarket === item.key;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                              isActive
                                ? "bg-primary/20 text-primary dark:bg-white/20 dark:text-white"
                                : "bg-slate-100 dark:bg-background-dark/80 text-slate-600 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-white/10"
                            }`}
                            onClick={() => setMarketFilterMarket(item.key)}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </FormGroup>

                  <FormGroup label="资产类别（assetClass）">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-slate-700 dark:text-slate-200">
                      {([
                        { key: "stock", label: "stock" },
                        { key: "etf", label: "etf" }
                      ] as const).map((item) => (
                        <label key={item.key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={marketFilterAssetClasses.includes(item.key)}
                            onChange={() =>
                              setMarketFilterAssetClasses((prev) =>
                                prev.includes(item.key)
                                  ? prev.filter((value) => value !== item.key)
                                  : [...prev, item.key]
                              )
                            }
                          />
                          <span className="font-mono text-xs">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </FormGroup>

                  <FormGroup label="标的类型（kind，仅搜索结果）">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-slate-700 dark:text-slate-200">
                      {([
                        { key: "stock", label: "stock" },
                        { key: "fund", label: "fund" }
                      ] as const).map((item) => (
                        <label key={item.key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={marketFilterKinds.includes(item.key)}
                            onChange={() =>
                              setMarketFilterKinds((prev) =>
                                prev.includes(item.key)
                                  ? prev.filter((value) => value !== item.key)
                                  : [...prev, item.key]
                              )
                            }
                          />
                          <span className="font-mono text-xs">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </FormGroup>

                  <div className="flex items-center justify-between gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="restart_alt"
                      onClick={resetMarketFilters}
                      disabled={marketFiltersActiveCount === 0}
                    >
                      重置
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      icon="done"
                      onClick={() => setMarketFiltersOpen(false)}
                    >
                      完成
                    </Button>
                  </div>
                </div>
              </Modal>

              <Modal
                open={marketInstrumentDetailsOpen}
                title="标的详情"
                onClose={() => setMarketInstrumentDetailsOpen(false)}
              >
                {!marketSelectedSymbol && (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    暂无选中标的。
                  </div>
                )}

                {marketSelectedSymbol && marketSelectedProfile === null && (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    载入中或该标的暂无详情：{" "}
                    <span className="font-mono">{marketSelectedSymbol}</span>
                  </div>
                )}

                {marketSelectedProfile && (
                  <div className="space-y-5">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-lg font-semibold text-slate-900 dark:text-white">
                          {marketSelectedProfile.name ?? "--"}
                        </span>
                        <span className="font-mono text-sm text-slate-600 dark:text-slate-300">
                          {marketSelectedProfile.symbol}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        提供方：{marketSelectedProfile.provider} · 类型：{" "}
                        {marketSelectedProfile.kind} · 资产类别：{" "}
                        {marketSelectedProfile.assetClass ?? "--"} · 市场：{" "}
                        {marketSelectedProfile.market ?? "--"} · 币种：{" "}
                        {marketSelectedProfile.currency ?? "--"}
                      </div>
                    </div>

                    <FormGroup label="自选">
                      <div className="flex gap-2">
                        <Input
                          value={marketWatchlistGroupDraft}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            setMarketWatchlistGroupDraft(event.target.value)
                          }
                          placeholder="自选分组（可选）"
                          className="text-xs"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          icon="star"
                          onClick={handleAddSelectedToWatchlist}
                        >
                          加入自选
                        </Button>
                      </div>
                    </FormGroup>

                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        提供方标签（可加入自动拉取筛选）
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {marketSelectedProfile.tags.length === 0 && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            --
                          </span>
                        )}
                        {marketSelectedProfile.tags.map((tag: string) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => handleAddTargetTag(tag)}
                            className="px-2 py-0.5 rounded-full text-[11px] border border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-background-dark/70"
                            title="加入标签筛选"
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        行业（SW 口径）
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {marketSelectedIndustry.length === 0 && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            --
                          </span>
                        )}
                        {marketSelectedIndustry.map((item: MarketTagFacetItem) => (
                          <button
                            key={item.tag}
                            type="button"
                            onClick={() => handleAddTargetTag(item.tag)}
                            className="px-2 py-0.5 rounded-full text-[11px] border border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-background-dark/70"
                            title="加入标签筛选"
                          >
                            {`L${item.level.slice(1)}:${item.name}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        主题
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {marketSelectedThemes.length === 0 && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            --
                          </span>
                        )}
                        {marketSelectedThemes.map((theme) => (
                          <button
                            key={theme.tag}
                            type="button"
                            onClick={() => handleAddTargetTag(theme.tag)}
                            className="px-2 py-0.5 rounded-full text-[11px] border border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-background-dark/70"
                            title="加入标签筛选"
                          >
                            {formatThemeLabel(theme)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <FormGroup label="手动主题（THS 选择）">
                      <div className="flex gap-2">
                        <PopoverSelect
                          value={marketManualThemeDraft}
                          onChangeValue={setMarketManualThemeDraft}
                          options={marketManualThemeOptions}
                          className="flex-1"
                          disabled={marketManualThemeLoading}
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          icon="add"
                          onClick={handleAddManualTheme}
                          disabled={!marketManualThemeDraft || marketManualThemeLoading}
                        >
                          添加
                        </Button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {marketSelectedManualThemes.length === 0 && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            --
                          </span>
                        )}
                        {marketSelectedManualThemes.map((tag: string) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-200"
                          >
                            <button
                              type="button"
                              onClick={() => handleAddTargetTag(tag)}
                              className="hover:underline"
                              title="加入标签筛选"
                            >
                              {tag.replace(/^theme:manual:/, "")}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveUserTag(tag)}
                              className="text-slate-400 hover:text-red-500"
                              aria-label={`移除主题 ${tag}`}
                              title="移除主题"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                      {marketManualThemeOptions.length === 0 && (
                        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          暂无 THS 主题可选（需先同步或导入相关主题标签）。
                        </div>
                      )}
                    </FormGroup>

                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        用户标签
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {marketSelectedPlainUserTags.length === 0 && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            --
                          </span>
                        )}
                        {marketSelectedPlainUserTags.map((tag: string) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-200"
                          >
                            <button
                              type="button"
                              onClick={() => handleAddTargetTag(tag)}
                              className="hover:underline"
                              title="加入标签筛选"
                            >
                              {tag}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveUserTag(tag)}
                              className="text-slate-400 hover:text-red-500"
                              aria-label={`移除标签 ${tag}`}
                              title="移除标签"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={marketUserTagDraft}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            setMarketUserTagDraft(event.target.value)
                          }
                          placeholder="例如：user:核心 / theme:AI"
                          className="text-xs"
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          icon="add"
                          onClick={handleAddUserTag}
                          disabled={!marketUserTagDraft.trim()}
                        >
                          添加
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          原始字段
                        </div>
                        <button
                          type="button"
                          className="text-xs text-slate-600 dark:text-slate-300 hover:underline"
                          onClick={() =>
                            setMarketShowProviderData((prev: boolean) => !prev)
                          }
                        >
                          {marketShowProviderData ? "隐藏" : "显示"}
                        </button>
                      </div>
                      {marketShowProviderData && (
                        <pre className="max-h-96 overflow-auto rounded-md bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark p-3 text-xs font-mono text-slate-700 dark:text-slate-200">
                          {JSON.stringify(marketSelectedProfile.providerData, null, 2)}
                        </pre>
                      )}
                      {!marketShowProviderData && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          用于调试与字段映射。
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Modal>

              <Modal
                open={marketTagPickerOpen}
                title="选择集合（Tags）"
                onClose={() => setMarketTagPickerOpen(false)}
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Input
                      value={marketTagPickerQuery}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setMarketTagPickerQuery(event.target.value)
                      }
                      placeholder="搜索 tag（例如 watchlist / industry / 白酒）"
                      className="text-sm"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="refresh"
                      onClick={() => refreshMarketTags(marketTagPickerQuery)}
                      disabled={marketTagsLoading}
                    >
                      刷新
                    </Button>
                  </div>

                  {marketTagsLoading && (
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      加载中...
                    </div>
                  )}

                  {!marketTagsLoading && marketTags.length === 0 && (
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      暂无可用集合。请先同步标的库或添加自选/用户标签。
                    </div>
                  )}

                  {!marketTagsLoading && marketTags.length > 0 && (
                    <div className="max-h-[520px] overflow-auto rounded-md border border-slate-200 dark:border-border-dark">
                      {marketTags.map((tag: TagSummary) => {
                        const isActive = marketSelectedTag === tag.tag;
                        return (
                          <button
                            key={`${tag.source}:${tag.tag}`}
                            type="button"
                            onClick={() => {
                              setMarketTagPickerOpen(false);
                              setMarketScope("tags");
                              void handleSelectTag(tag.tag);
                            }}
                            className={`w-full text-left px-3 py-2 border-b border-slate-200 dark:border-border-dark last:border-b-0 transition-colors ${
                              isActive
                                ? "bg-primary/10"
                                : "hover:bg-slate-50 dark:hover:bg-background-dark/70"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                  {tag.tag}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {tag.source}
                                </div>
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {tag.memberCount}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Modal>

              <Modal
                open={marketTagMembersModalOpen}
                title={`成分股 · ${marketSelectedTag ?? "--"}`}
                onClose={() => setMarketTagMembersModalOpen(false)}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-mono">
                      {marketTagMembers.length} symbols
                    </span>
                    <span>
                      {marketSelectedTagAggregate
                        ? `覆盖 ${marketSelectedTagAggregate.includedCount}/${marketSelectedTagAggregate.totalCount}（剔除 ${marketSelectedTagAggregate.excludedCount}）`
                        : "--"}
                    </span>
                  </div>

                  {marketTagMembersLoading && (
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      加载中...
                    </div>
                  )}

                  {!marketTagMembersLoading && marketTagMembers.length === 0 && (
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      暂无成分。
                    </div>
                  )}

                  {!marketTagMembersLoading && marketTagMembers.length > 0 && (
                    <div className="rounded-md border border-slate-200 dark:border-border-dark overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-white dark:bg-background-dark">
                          <tr className="text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-border-dark">
                            <th className="text-left font-semibold px-4 py-2">
                              Symbol
                            </th>
                            <th className="text-right font-semibold px-4 py-2">
                              Price
                            </th>
                            <th className="text-right font-semibold px-4 py-2">
                              Change%
                            </th>
                            <th className="text-right font-semibold px-4 py-2">
                              circ_mv
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortTagMembersByChangePct(
                            marketTagMembers,
                            marketQuotesBySymbol
                          )
                            .slice(0, 2000)
                            .map((symbol: string) => {
                              const quote = marketQuotesBySymbol[symbol] ?? null;
                              const tone = getCnChangeTone(quote?.changePct ?? null);
                              return (
                                <tr
                                  key={symbol}
                                  className="border-b border-slate-200/70 dark:border-border-dark/70 last:border-b-0 hover:bg-slate-50 dark:hover:bg-background-dark/70 cursor-pointer"
                                  onClick={() => {
                                    setMarketTagMembersModalOpen(false);
                                    void handleSelectInstrument(symbol);
                                  }}
                                >
                                  <td className="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-200">
                                    {symbol}
                                  </td>
                                  <td className="px-4 py-2 text-right font-mono text-xs text-slate-900 dark:text-white">
                                    {formatNumber(quote?.close ?? null, 2)}
                                  </td>
                                  <td
                                    className={`px-4 py-2 text-right font-mono text-xs ${getCnToneTextClass(
                                      tone
                                    )}`}
                                  >
                                    {formatSignedPctNullable(quote?.changePct ?? null)}
                                  </td>
                                  <td className="px-4 py-2 text-right font-mono text-xs text-slate-500 dark:text-slate-400">
                                    {formatCnWanYiNullable(quote?.circMv ?? null, 2, 0)}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {!marketTagMembersLoading && marketTagMembers.length > 2000 && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      仅展示前 2000 个标的（共 {marketTagMembers.length}）。
                    </div>
                  )}
                </div>
              </Modal>

              {/*
              <div className="space-y-8 max-w-6xl">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-slate-700 dark:text-slate-200">
                    最新行情日期：
                    <span className="ml-2 font-mono font-medium">
                      {snapshot?.priceAsOf ?? "--"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="refresh"
                      onClick={refreshMarketTargets}
                      disabled={marketTargetsLoading}
                    >
                      刷新 Targets
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="sync"
                      onClick={refreshMarketWatchlist}
                      disabled={marketWatchlistLoading}
                    >
                      刷新自选
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-bold text-slate-900 dark:text-white">
                        标的库（Tushare）
                      </h3>
                      <Button
                        variant="primary"
                        size="sm"
                        icon="download"
                        onClick={handleSyncInstrumentCatalog}
                        disabled={marketCatalogSyncing}
                      >
                        {marketCatalogSyncing ? "同步中..." : "同步"}
                      </Button>
                    </div>
                    {marketCatalogSyncSummary && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {marketCatalogSyncSummary}
                      </div>
                    )}
                    <FormGroup label="搜索（代码 / 名称）">
                      <Input
                        value={marketSearchQuery}
                        onChange={(e) => setMarketSearchQuery(e.target.value)}
                        placeholder="例如：600519 / 贵州茅台 / 510300"
                      />
                    </FormGroup>
                    <div className="border border-slate-200 dark:border-border-dark rounded-md overflow-hidden">
                      <div className="max-h-72 overflow-auto">
                        {marketSearchLoading && (
                          <div className="p-3 text-xs text-slate-500 dark:text-slate-400">
                            搜索中...
                          </div>
                        )}
                        {!marketSearchLoading &&
                          marketSearchQuery.trim() === "" && (
                            <div className="p-3 text-xs text-slate-500 dark:text-slate-400">
                              输入关键词开始搜索（需先同步标的库）。
                            </div>
                          )}
                        {!marketSearchLoading &&
                          marketSearchQuery.trim() !== "" &&
                          marketSearchResults.length === 0 && (
                            <div className="p-3 text-xs text-slate-500 dark:text-slate-400">
                              未找到匹配标的。
                            </div>
                          )}
                        {!marketSearchLoading &&
                          marketSearchResults.map((item) => {
                            const isActive = item.symbol === marketSelectedSymbol;
                            const tagsPreview = item.tags.slice(0, 3);
                            return (
                              <button
                                key={item.symbol}
                                type="button"
                                onClick={() => handleSelectInstrument(item.symbol)}
                                className={`w-full text-left px-3 py-2 border-b border-slate-200 dark:border-border-dark last:border-b-0 transition-colors ${
                                  isActive
                                    ? "bg-primary/10"
                                    : "hover:bg-slate-50 dark:hover:bg-background-dark/70"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">
                                    {item.symbol}
                                  </span>
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                    {item.kind}
                                  </span>
                                </div>
                                <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                  {item.name ?? "--"}
                                </div>
                                {tagsPreview.length > 0 && (
                                  <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                    {tagsPreview.join(" · ")}
                                    {item.tags.length > tagsPreview.length
                                      ? " · …"
                                      : ""}
                                  </div>
                                )}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-bold text-slate-900 dark:text-white">
                        标的详情
                      </h3>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon="star"
                          onClick={handleAddSelectedToWatchlist}
                          disabled={!marketSelectedProfile}
                        >
                          加入自选
                        </Button>
                      </div>
                    </div>

                    {!marketSelectedSymbol && (
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        从左侧搜索结果中选择一个标的查看详情。
                      </div>
                    )}

                    {marketSelectedSymbol && marketSelectedProfile === null && (
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        载入中或该标的暂无详情：{" "}
                        <span className="font-mono">{marketSelectedSymbol}</span>
                      </div>
                    )}

                    {marketSelectedProfile && (
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <span className="text-lg font-semibold text-slate-900 dark:text-white">
                              {marketSelectedProfile.name ?? "--"}
                            </span>
                            <span className="font-mono text-sm text-slate-600 dark:text-slate-300">
                              {marketSelectedProfile.symbol}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            provider: {marketSelectedProfile.provider} · kind:{" "}
                            {marketSelectedProfile.kind} · assetClass:{" "}
                            {marketSelectedProfile.assetClass ?? "--"} · market:{" "}
                            {marketSelectedProfile.market ?? "--"} · currency:{" "}
                            {marketSelectedProfile.currency ?? "--"}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                            Provider 标签（点击可加入 Targets 过滤）
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {marketSelectedProfile.tags.length === 0 && (
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                --
                              </span>
                            )}
                            {marketSelectedProfile.tags.map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => handleAddTargetTag(tag)}
                                className="px-2 py-0.5 rounded-full text-[11px] border border-slate-200 dark:border-border-dark text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-background-dark/70"
                                title="加入 Targets.tagFilters"
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                            用户标签
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {marketSelectedUserTags.length === 0 && (
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                --
                              </span>
                            )}
                            {marketSelectedUserTags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-200"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleAddTargetTag(tag)}
                                  className="hover:underline"
                                  title="加入 Targets.tagFilters"
                                >
                                  {tag}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveUserTag(tag)}
                                  className="text-slate-400 hover:text-red-500"
                                  aria-label={`移除标签 ${tag}`}
                                  title="移除标签"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Input
                              value={marketUserTagDraft}
                              onChange={(e) => setMarketUserTagDraft(e.target.value)}
                              placeholder="例如：my:watch / sector:新能源"
                              className="text-xs"
                            />
                            <Button
                              variant="primary"
                              size="sm"
                              icon="add"
                              onClick={handleAddUserTag}
                              disabled={
                                !marketSelectedSymbol || !marketUserTagDraft.trim()
                              }
                            >
                              添加
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <button
                            type="button"
                            className="text-xs text-slate-600 dark:text-slate-300 hover:underline"
                            onClick={() =>
                              setMarketShowProviderData((prev) => !prev)
                            }
                          >
                            {marketShowProviderData ? "隐藏" : "显示"} 原始字段
                          </button>
                          {marketShowProviderData && (
                            <pre className="max-h-72 overflow-auto rounded-md bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark p-3 text-xs font-mono text-slate-700 dark:text-slate-200">
                              {JSON.stringify(
                                marketSelectedProfile.providerData,
                                null,
                                2
                              )}
                            </pre>
                          )}
                        </div>
                      </div>
                    )}
                  </section>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-bold text-slate-900 dark:text-white">
                        自选列表
                      </h3>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon="refresh"
                        onClick={refreshMarketWatchlist}
                        disabled={marketWatchlistLoading}
                      >
                        刷新
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <Input
                        value={marketWatchlistSymbolDraft}
                        onChange={(e) =>
                          setMarketWatchlistSymbolDraft(e.target.value)
                        }
                        placeholder="代码（如 600519.SH）"
                        className="font-mono text-xs"
                      />
                      <Input
                        value={marketWatchlistGroupDraft}
                        onChange={(e) =>
                          setMarketWatchlistGroupDraft(e.target.value)
                        }
                        placeholder="分组（可选）"
                        className="text-xs"
                      />
                      <Button
                        variant="primary"
                        size="sm"
                        icon="add"
                        onClick={handleAddWatchlistItem}
                        disabled={!marketWatchlistSymbolDraft.trim()}
                      >
                        加入
                      </Button>
                    </div>

                    <div className="border border-slate-200 dark:border-border-dark rounded-md overflow-hidden">
                      <div className="max-h-72 overflow-auto">
                        {marketWatchlistLoading && (
                          <div className="p-3 text-xs text-slate-500 dark:text-slate-400">
                            加载中...
                          </div>
                        )}
                        {!marketWatchlistLoading && marketWatchlistItems.length === 0 && (
                          <div className="p-3 text-xs text-slate-500 dark:text-slate-400">
                            暂无自选标的。
                          </div>
                        )}
                        {!marketWatchlistLoading &&
                          marketWatchlistItems.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-3 px-3 py-2 border-b border-slate-200 dark:border-border-dark last:border-b-0"
                            >
                              <div className="min-w-0">
                                <div className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">
                                  {item.symbol}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                  {item.name ?? item.groupName ?? "--"}
                                </div>
                              </div>
                              <Button
                                variant="danger"
                                size="sm"
                                icon="delete"
                                onClick={() => handleRemoveWatchlistItem(item.symbol)}
                              >
                                移除
                              </Button>
                            </div>
                          ))}
                      </div>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-bold text-slate-900 dark:text-white">
                        目标池编辑
                      </h3>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon="refresh"
                          onClick={refreshMarketTargets}
                          disabled={marketTargetsLoading}
                        >
                          刷新
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          icon="save"
                          onClick={handleSaveTargets}
                          disabled={marketTargetsSaving}
                        >
                          保存
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={marketTargetsConfig.includeHoldings}
                          onChange={(e) =>
                            setMarketTargetsConfig((prev) => ({
                              ...prev,
                              includeHoldings: e.target.checked
                            }))
                          }
                        />
                        <span>包含持仓</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={marketTargetsConfig.includeWatchlist}
                          onChange={(e) =>
                            setMarketTargetsConfig((prev) => ({
                              ...prev,
                              includeWatchlist: e.target.checked
                            }))
                          }
                        />
                        <span>包含自选</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={marketTargetsConfig.includeRegistryAutoIngest}
                          onChange={(e) =>
                            setMarketTargetsConfig((prev) => ({
                              ...prev,
                              includeRegistryAutoIngest: e.target.checked
                            }))
                          }
                        />
                        <span>包含注册标的</span>
                      </label>
                    </div>

                    <FormGroup label="手动添加标的">
                      <div className="flex flex-wrap gap-2">
                        <Input
                          value={marketTargetsSymbolDraft}
                          onChange={(e) =>
                            setMarketTargetsSymbolDraft(e.target.value)
                          }
                          placeholder="600519.SH"
                          className="font-mono text-xs flex-1 min-w-[220px]"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          icon="add"
                          onClick={handleAddTargetSymbol}
                          disabled={!marketTargetsSymbolDraft.trim()}
                        >
                          添加
                        </Button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {marketTargetsConfig.explicitSymbols.length === 0 && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            --
                          </span>
                        )}
                        {marketTargetsConfig.explicitSymbols.map((symbol) => (
                          <span
                            key={symbol}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-200"
                          >
                            <span className="font-mono">{symbol}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTargetSymbol(symbol)}
                              className="text-slate-400 hover:text-red-500"
                              aria-label={`移除 symbol ${symbol}`}
                              title="移除"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </FormGroup>

                    <FormGroup label="标签筛选">
                      <div className="flex flex-wrap gap-2">
                        <Input
                          value={marketTargetsTagDraft}
                          onChange={(e) => setMarketTargetsTagDraft(e.target.value)}
                          placeholder="例如：industry:白酒 / fund_type:股票型"
                          className="text-xs flex-1 min-w-[220px]"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          icon="add"
                          onClick={() => handleAddTargetTag()}
                          disabled={!marketTargetsTagDraft.trim()}
                        >
                          添加
                        </Button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {marketTargetsConfig.tagFilters.length === 0 && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            --
                          </span>
                        )}
                        {marketTargetsConfig.tagFilters.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-200"
                          >
                            <span>{tag}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTargetTag(tag)}
                              className="text-slate-400 hover:text-red-500"
                              aria-label={`移除过滤器 ${tag}`}
                              title="移除"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </FormGroup>

                    <div className="rounded-md border border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-background-dark p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                        <span>预览（基于已保存配置）</span>
                        <span className="font-mono">
                          {marketTargetsPreview
                            ? `${marketTargetsPreview.symbols.length} symbols`
                            : "--"}
                        </span>
                      </div>
                      <div className="max-h-56 overflow-auto">
                        {!marketTargetsPreview && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            点击“刷新”加载预览。
                          </div>
                        )}
                        {marketTargetsPreview &&
                          marketTargetsPreview.symbols.slice(0, 200).map((row) => (
                            <div
                              key={row.symbol}
                              className="flex items-start justify-between gap-3 py-1 border-b border-slate-200/60 dark:border-border-dark/60 last:border-b-0"
                            >
                              <span className="font-mono text-xs text-slate-700 dark:text-slate-200">
                                {row.symbol}
                              </span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 text-right">
                                {formatTargetsReasons(row.reasons)}
                              </span>
                            </div>
                          ))}
                        {marketTargetsPreview &&
                          marketTargetsPreview.symbols.length > 200 && (
                            <div className="pt-2 text-[11px] text-slate-500 dark:text-slate-400">
                              仅展示前 200 个标的（共{" "}
                              {marketTargetsPreview.symbols.length}）。
                            </div>
                          )}
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </Panel>
              */}
            </>
  );
}
