import type { ChangeEvent } from "react";

import type { InstrumentProfileSummary, TagSummary } from "@mytrader/shared";

import type { MarketViewProps } from "../MarketView";

export type MarketSidebarProps = Pick<
  MarketViewProps,
  | "Button"
  | "IconButton"
  | "Input"
  | "PopoverSelect"
  | "formatNumber"
  | "formatSignedPctNullable"
  | "getCnChangeTone"
  | "getCnToneTextClass"
  | "handleRemoveWatchlistItem"
  | "handleSelectInstrument"
  | "handleSelectTag"
  | "handleSyncInstrumentCatalog"
  | "marketCatalogSyncSummary"
  | "marketCatalogSyncing"
  | "marketCollectionSelectValue"
  | "marketEffectiveScope"
  | "marketExplorerWidth"
  | "marketFilteredListSymbols"
  | "marketFiltersActiveCount"
  | "marketHoldingsSymbols"
  | "marketHoldingsSymbolsFiltered"
  | "marketNameBySymbol"
  | "marketQuotesBySymbol"
  | "marketQuotesLoading"
  | "marketSearchLoading"
  | "marketSearchQuery"
  | "marketSearchResults"
  | "marketSearchResultsFiltered"
  | "marketSelectedSymbol"
  | "marketSelectedTag"
  | "marketSelectedTagAggregate"
  | "marketTagMembersLoading"
  | "marketTags"
  | "marketWatchlistLoading"
  | "setMarketFiltersOpen"
  | "setMarketScope"
  | "setMarketSearchQuery"
  | "setMarketSelectedSymbol"
  | "setMarketSelectedTag"
  | "snapshot"
>;

export function MarketSidebar(props: MarketSidebarProps) {
  return (
    <aside
      className="flex-shrink-0 min-h-0 flex flex-col border-r border-border-light dark:border-border-dark bg-white/70 dark:bg-background-dark/65 backdrop-blur-lg"
      style={{ width: props.marketExplorerWidth }}
    >
      <div className="pt-0 pb-0 border-b border-border-light dark:border-border-dark space-y-0">
        <div className="w-full rounded-none border border-slate-200 dark:border-border-dark bg-white/75 dark:bg-panel-dark/80 backdrop-blur shadow-sm focus-within:border-primary/60">
          <div className="flex items-center px-0 bg-transparent dark:bg-white/5">
            <div className="flex-1 relative">
              <span className="material-icons-outlined absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                search
              </span>
              <props.Input
                value={props.marketSearchQuery}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  props.setMarketSearchQuery(event.target.value)
                }
                placeholder="搜索标的（代码/名称）"
                className="pl-9 pr-2 !rounded-none !border-0 !bg-transparent dark:!bg-transparent shadow-none focus:ring-0 focus:border-transparent dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="relative border-t border-slate-200/70 dark:border-border-dark/70">
            <props.PopoverSelect
              value={props.marketCollectionSelectValue}
              onChangeValue={(value: string) => {
                props.setMarketSearchQuery("");
                props.setMarketSelectedSymbol(null);

                if (value === "builtin:holdings") {
                  props.setMarketScope("holdings");
                  props.setMarketSelectedTag(null);
                  return;
                }

                if (value === "builtin:watchlist") {
                  props.setMarketScope("tags");
                  void props.handleSelectTag("watchlist:all");
                  return;
                }

                if (value.startsWith("tag:")) {
                  props.setMarketScope("tags");
                  void props.handleSelectTag(value.slice("tag:".length));
                }
              }}
              options={[
                { value: "builtin:holdings", label: "持仓" },
                { value: "builtin:watchlist", label: "自选" },
                ...props.marketTags
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

            <props.IconButton
              icon="filter_alt"
              label={
                props.marketFiltersActiveCount > 0
                  ? `筛选（${props.marketFiltersActiveCount}）`
                  : "筛选"
              }
              onClick={() => props.setMarketFiltersOpen(true)}
              size="sm"
              className="absolute right-0 top-0 z-10 h-6 w-6 rounded-none border-0 border-l border-slate-200/70 dark:border-border-dark/70"
            />
          </div>
        </div>

        {props.marketCatalogSyncSummary && props.marketSearchQuery.trim() && (
          <div className="px-3 text-[11px] text-slate-500 dark:text-slate-400">
            {props.marketCatalogSyncSummary}
          </div>
        )}

        {(props.marketWatchlistLoading || props.marketQuotesLoading) && (
          <div className="px-3 flex items-center justify-end text-[10px] leading-4 text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-2">
              {props.marketWatchlistLoading && <span>自选更新中…</span>}
              {props.marketQuotesLoading && <span>报价加载中…</span>}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {props.marketEffectiveScope === "search" && (
          <div className="py-2">
            {props.marketSearchLoading && (
              <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                搜索中...
              </div>
            )}
            {!props.marketSearchLoading && props.marketSearchQuery.trim() === "" && (
              <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                输入关键词开始搜索（如 600519 / 贵州茅台 / 510300）。
              </div>
            )}
            {!props.marketSearchLoading &&
              props.marketSearchQuery.trim() !== "" &&
              props.marketSearchResults.length === 0 && (
                <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center justify-between gap-2">
                    <span>未找到匹配标的（需先同步标的库）。</span>
                    <props.Button
                      variant="secondary"
                      size="sm"
                      icon="download"
                      onClick={props.handleSyncInstrumentCatalog}
                      disabled={props.marketCatalogSyncing}
                    >
                      {props.marketCatalogSyncing ? "同步中" : "同步"}
                    </props.Button>
                  </div>
                </div>
              )}

            {!props.marketSearchLoading &&
              props.marketSearchQuery.trim() !== "" &&
              props.marketSearchResults.length > 0 &&
              props.marketSearchResultsFiltered.length === 0 && (
                <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                  筛选后无结果。
                </div>
              )}

            {props.marketSearchResultsFiltered.map((item: InstrumentProfileSummary) => {
              const isActive = item.symbol === props.marketSelectedSymbol;
              const quote = props.marketQuotesBySymbol[item.symbol] ?? null;
              const tone = props.getCnChangeTone(quote?.changePct ?? null);
              return (
                <button
                  key={item.symbol}
                  type="button"
                  onClick={() => props.handleSelectInstrument(item.symbol)}
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
                        {props.formatNumber(quote?.close ?? null, 2)}
                      </div>
                      <div
                        className={`font-mono text-[11px] ${props.getCnToneTextClass(tone)}`}
                      >
                        {props.formatSignedPctNullable(quote?.changePct ?? null)}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {props.marketEffectiveScope === "holdings" && (
          <div className="py-2">
            {!props.snapshot && (
              <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                暂无组合数据。
              </div>
            )}
            {props.snapshot && props.marketHoldingsSymbols.length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                当前组合没有股票/ETF 持仓。
              </div>
            )}
            {props.snapshot &&
              props.marketHoldingsSymbols.length > 0 &&
              props.marketHoldingsSymbolsFiltered.length === 0 && (
                <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                  筛选后无结果。
                </div>
              )}
            {props.marketFilteredListSymbols.map((symbol: string) => {
              const isActive = symbol === props.marketSelectedSymbol;
              const quote = props.marketQuotesBySymbol[symbol] ?? null;
              const tone = props.getCnChangeTone(quote?.changePct ?? null);
              const name = props.marketNameBySymbol.get(symbol) ?? symbol;
              return (
                <button
                  key={symbol}
                  type="button"
                  onClick={() => props.handleSelectInstrument(symbol)}
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
                        {props.formatNumber(quote?.close ?? null, 2)}
                      </div>
                      <div
                        className={`font-mono text-[11px] ${props.getCnToneTextClass(tone)}`}
                      >
                        {props.formatSignedPctNullable(quote?.changePct ?? null)}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {props.marketEffectiveScope === "tags" && (
          <div className="py-2">
            {!props.marketSelectedTag && (
              <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                请选择一个集合（如 watchlist:all、industry:白酒）。
              </div>
            )}

            {props.marketSelectedTag && (
              <>
                <button
                  type="button"
                  onClick={() => props.setMarketSelectedSymbol(null)}
                  className={`w-full text-left px-3 py-2 border-b border-slate-200/70 dark:border-border-dark/70 transition-colors ${
                    props.marketSelectedSymbol === null
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
                        {props.marketSelectedTagAggregate
                          ? `覆盖 ${props.marketSelectedTagAggregate.includedCount}/${props.marketSelectedTagAggregate.totalCount}`
                          : "--"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`font-mono text-sm ${props.getCnToneTextClass(
                          props.getCnChangeTone(
                            props.marketSelectedTagAggregate?.weightedChangePct ??
                              null
                          )
                        )}`}
                      >
                        {props.formatSignedPctNullable(
                          props.marketSelectedTagAggregate?.weightedChangePct ?? null
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        流通市值权重
                      </div>
                    </div>
                  </div>
                </button>

                {props.marketTagMembersLoading && (
                  <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                    加载集合成分中...
                  </div>
                )}

                {!props.marketTagMembersLoading &&
                  props.marketFilteredListSymbols.map((symbol: string) => {
                    const isActive = symbol === props.marketSelectedSymbol;
                    const quote = props.marketQuotesBySymbol[symbol] ?? null;
                    const tone = props.getCnChangeTone(quote?.changePct ?? null);
                    const name = props.marketNameBySymbol.get(symbol) ?? symbol;
                    const canRemove =
                      props.marketSelectedTag?.startsWith("watchlist:") ?? false;
                    return (
                      <button
                        key={symbol}
                        type="button"
                        onClick={() => props.handleSelectInstrument(symbol)}
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
                                {props.formatNumber(quote?.close ?? null, 2)}
                              </div>
                              <div
                                className={`font-mono text-[11px] ${props.getCnToneTextClass(tone)}`}
                              >
                                {props.formatSignedPctNullable(
                                  quote?.changePct ?? null
                                )}
                              </div>
                            </div>
                            {canRemove && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void props.handleRemoveWatchlistItem(symbol);
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
  );
}
