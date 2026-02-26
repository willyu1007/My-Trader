import { useCallback, useEffect, useMemo, useState } from "react";

import type { ValuationAdjustmentPreview } from "@mytrader/shared";

import type {
  MarketChartHoverDatum,
  MarketRangeOption,
  MarketViewProps
} from "../MarketView";

export type MarketDetailWorkspaceProps = Pick<
  MarketViewProps,
  | "Button"
  | "ChartErrorBoundary"
  | "IconButton"
  | "MarketAreaChart"
  | "MarketQuoteHeader"
  | "MarketVolumeMiniChart"
  | "formatCnDate"
  | "formatCnWanYiNullable"
  | "formatNumber"
  | "formatSignedCnWanYiNullable"
  | "formatSignedPctNullable"
  | "getCnChangeTone"
  | "getCnToneTextClass"
  | "handleAddSelectedToWatchlist"
  | "handleSelectInstrument"
  | "marketActiveMoneyflowRatio"
  | "marketActiveMoneyflowVol"
  | "marketActiveVolume"
  | "marketChartBars"
  | "marketChartHasEnoughData"
  | "marketChartHoverDate"
  | "marketChartHoverPrice"
  | "marketChartLoading"
  | "marketChartRange"
  | "marketChartRanges"
  | "marketEffectiveScope"
  | "marketHoldingUnitCost"
  | "marketLatestBar"
  | "marketQuotesBySymbol"
  | "marketRangeSummary"
  | "marketSelectedProfile"
  | "marketSelectedQuote"
  | "marketSelectedSymbol"
  | "marketSelectedTag"
  | "marketSelectedTagAggregate"
  | "marketSelectedTagSeriesReturnPct"
  | "marketSelectedTagSeriesTone"
  | "marketTagChartHoverDate"
  | "marketTagChartHoverPrice"
  | "marketTagMembers"
  | "marketTagMembersLoading"
  | "marketTagSeriesBars"
  | "marketTagSeriesError"
  | "marketTagSeriesLatestCoverageLabel"
  | "marketTagSeriesLoading"
  | "marketTagSeriesResult"
  | "marketTargetPrice"
  | "marketVolumeMode"
  | "setMarketChartHoverDate"
  | "setMarketChartHoverPrice"
  | "setMarketChartRange"
  | "setMarketInstrumentDetailsOpen"
  | "setMarketSelectedSymbol"
  | "setMarketTagChartHoverDate"
  | "setMarketTagChartHoverPrice"
  | "setMarketTagMembersModalOpen"
  | "setMarketTagPickerOpen"
  | "setMarketVolumeMode"
  | "sortTagMembersByChangePct"
>;

export function MarketDetailWorkspace(props: MarketDetailWorkspaceProps) {
  const [valuationPreview, setValuationPreview] =
    useState<ValuationAdjustmentPreview | null>(null);
  const [valuationLoading, setValuationLoading] = useState(false);
  const [valuationError, setValuationError] = useState<string | null>(null);
  const [excludingInsightId, setExcludingInsightId] = useState<string | null>(null);

  const valuationAsOfDate = useMemo(
    () =>
      props.marketSelectedQuote?.tradeDate ??
      props.marketLatestBar?.date ??
      null,
    [props.marketLatestBar?.date, props.marketSelectedQuote?.tradeDate]
  );

  const loadValuationPreview = useCallback(async () => {
    const symbol = props.marketSelectedSymbol;
    if (!symbol || !window.mytrader?.insights) {
      setValuationPreview(null);
      setValuationError(null);
      return;
    }
    setValuationLoading(true);
    setValuationError(null);
    try {
      const preview = await window.mytrader.insights.previewValuationBySymbol({
        symbol,
        asOfDate: valuationAsOfDate
      });
      setValuationPreview(preview);
    } catch (err) {
      setValuationPreview(null);
      setValuationError(err instanceof Error ? err.message : String(err));
    } finally {
      setValuationLoading(false);
    }
  }, [props.marketSelectedSymbol, valuationAsOfDate]);

  useEffect(() => {
    void loadValuationPreview();
  }, [loadValuationPreview]);

  const appliedInsightRows = useMemo(() => {
    if (!valuationPreview) return [];
    const map = new Map<
      string,
      { insightId: string; insightTitle: string; count: number; scopes: string[] }
    >();
    for (const effect of valuationPreview.appliedEffects) {
      const existing = map.get(effect.insightId);
      if (existing) {
        existing.count += 1;
        effect.scopes.forEach((scope) => {
          if (!existing.scopes.includes(scope)) existing.scopes.push(scope);
        });
        continue;
      }
      map.set(effect.insightId, {
        insightId: effect.insightId,
        insightTitle: effect.insightTitle,
        count: 1,
        scopes: [...effect.scopes]
      });
    }
    return Array.from(map.values());
  }, [valuationPreview]);

  const handleExcludeInsight = useCallback(
    async (insightId: string) => {
      const symbol = props.marketSelectedSymbol;
      if (!symbol || !window.mytrader?.insights) return;
      setExcludingInsightId(insightId);
      setValuationError(null);
      try {
        await window.mytrader.insights.excludeTarget({
          insightId,
          symbol,
          reason: "removed from symbol side"
        });
        await loadValuationPreview();
      } catch (err) {
        setValuationError(err instanceof Error ? err.message : String(err));
      } finally {
        setExcludingInsightId(null);
      }
    },
    [loadValuationPreview, props.marketSelectedSymbol]
  );

  return (
      <main className="flex-1 min-w-0 min-h-0 overflow-hidden bg-white/40 dark:bg-background-dark/40">
        {!props.marketSelectedSymbol &&
          !(props.marketEffectiveScope === "tags" && props.marketSelectedTag) && (
          <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400">
            请选择左侧列表中的标的或集合。
          </div>
        )}

        {props.marketEffectiveScope === "tags" && props.marketSelectedTag && !props.marketSelectedSymbol && (
          <div className="h-full min-h-0 flex flex-col">
            <div className="flex-shrink-0 border-b border-border-light dark:border-border-dark bg-white/70 dark:bg-background-dark/70 backdrop-blur-lg px-6 py-5">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
                    {props.marketSelectedTag}
                  </div>
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    市值加权口径：流通市值（circ_mv）；缺价格/缺市值成分会被剔除并重归一化权重。
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div
                    className={`text-2xl font-mono font-semibold ${props.getCnToneTextClass(
                      props.getCnChangeTone(
                        props.marketSelectedTagAggregate?.weightedChangePct ?? null
                      )
                    )}`}
                  >
                    {props.formatSignedPctNullable(
                      props.marketSelectedTagAggregate?.weightedChangePct ?? null
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {props.marketSelectedTagAggregate
                      ? `覆盖 ${props.marketSelectedTagAggregate.includedCount}/${props.marketSelectedTagAggregate.totalCount}（剔除 ${props.marketSelectedTagAggregate.excludedCount}）`
                      : "--"}
                  </div>
                  <div className="flex items-center gap-2">
                    <props.Button
                      variant="secondary"
                      size="sm"
                      icon="format_list_bulleted"
                      onClick={() => props.setMarketTagMembersModalOpen(true)}
                      disabled={props.marketTagMembersLoading || props.marketTagMembers.length === 0}
                    >
                      查看成分
                    </props.Button>
                    <props.Button
                      variant="secondary"
                      size="sm"
                      icon="folder_open"
                      onClick={() => props.setMarketTagPickerOpen(true)}
                    >
                      切换集合
                    </props.Button>
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
                      className={`font-mono text-sm font-semibold ${props.getCnToneTextClass(
                        props.marketSelectedTagSeriesTone
                      )}`}
                    >
                      {props.formatSignedPctNullable(props.marketSelectedTagSeriesReturnPct)}
                    </div>
                  </div>
                </div>

                <div className="mt-3 relative group h-10 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-0.5 group-hover:opacity-0 transition-opacity">
                    <div className="text-[13px] font-semibold text-slate-900 dark:text-white">
                      {props.formatCnDate(
                        props.marketTagChartHoverDate ??
                          props.marketTagSeriesResult?.endDate ??
                          null
                      )}
                    </div>
                    {props.marketTagChartHoverPrice !== null && (
                      <div className="text-[14px] font-mono font-semibold text-primary">
                        {props.formatNumber(props.marketTagChartHoverPrice, 2)}
                      </div>
                    )}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-1 rounded-full bg-slate-100/80 dark:bg-black/40 backdrop-blur px-2 py-1">
                      {props.marketChartRanges.map((item: MarketRangeOption) => {
                        const isActive = props.marketChartRange === item.key;
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
                              props.setMarketChartRange(item.key)
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
                  {props.marketTagSeriesLoading && (
                    <div className="h-full flex items-center justify-center text-sm text-slate-500 dark:text-slate-300">
                      加载中...
                    </div>
                  )}
                  {!props.marketTagSeriesLoading && props.marketTagSeriesError && (
                    <div className="h-full flex items-center justify-center text-sm text-slate-500 dark:text-slate-300">
                      {props.marketTagSeriesError}
                    </div>
                  )}
                  {!props.marketTagSeriesLoading &&
                    !props.marketTagSeriesError &&
                    props.marketTagSeriesBars.length === 0 && (
                      <div className="h-full flex items-center justify-center text-sm text-slate-500 dark:text-slate-300">
                        暂无区间数据（需要 daily_prices + daily_basics/circ_mv）。
                      </div>
                    )}
                  {!props.marketTagSeriesLoading &&
                    !props.marketTagSeriesError &&
                    props.marketTagSeriesBars.length > 0 && (
                      <props.ChartErrorBoundary
                        resetKey={`tag-series:${props.marketSelectedTag}:${props.marketChartRange}`}
                      >
                        <props.MarketAreaChart
                          bars={props.marketTagSeriesBars}
                          tone={props.marketSelectedTagSeriesTone}
                          onHoverDatumChange={(
                            datum: MarketChartHoverDatum | null
                          ) => {
                            props.setMarketTagChartHoverDate(datum?.date ?? null);
                            props.setMarketTagChartHoverPrice(datum?.close ?? null);
                          }}
                        />
                      </props.ChartErrorBoundary>
                    )}
                </div>

                <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span>{props.marketTagSeriesLatestCoverageLabel}</span>
                  {props.marketTagSeriesResult &&
                    props.marketTagSeriesResult.usedMemberCount <
                      props.marketTagSeriesResult.memberCount && (
                      <span>
                        仅使用前 {props.marketTagSeriesResult.usedMemberCount}/
                        {props.marketTagSeriesResult.memberCount}
                        {props.marketTagSeriesResult.truncated ? "（总数已截断）" : ""}
                      </span>
                    )}
                </div>
              </div>

              {props.marketTagMembersLoading && (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  加载中...
                </div>
              )}

              {!props.marketTagMembersLoading && props.marketTagMembers.length === 0 && (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  暂无成分。
                </div>
              )}

              {!props.marketTagMembersLoading && props.marketTagMembers.length > 0 && (
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
                      {props.sortTagMembersByChangePct(
                        props.marketTagMembers,
                        props.marketQuotesBySymbol
                      )
                        .slice(0, 20)
                        .map((symbol: string) => {
                          const quote = props.marketQuotesBySymbol[symbol] ?? null;
                          const tone = props.getCnChangeTone(quote?.changePct ?? null);
                          return (
                            <tr
                              key={symbol}
                              className="border-b border-slate-200/70 dark:border-border-dark/70 last:border-b-0 hover:bg-slate-50 dark:hover:bg-background-dark/70 cursor-pointer"
                              onClick={() => props.handleSelectInstrument(symbol)}
                            >
                              <td className="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-200">
                                {symbol}
                              </td>
                              <td className="px-4 py-2 text-right font-mono text-xs text-slate-900 dark:text-white">
                                {props.formatNumber(quote?.close ?? null, 2)}
                              </td>
                              <td
                                className={`px-4 py-2 text-right font-mono text-xs ${props.getCnToneTextClass(
                                  tone
                                )}`}
                              >
                                {props.formatSignedPctNullable(quote?.changePct ?? null)}
                              </td>
                              <td className="px-4 py-2 text-right font-mono text-xs text-slate-500 dark:text-slate-400">
                                {props.formatNumber(quote?.circMv ?? null, 2)}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}

              {!props.marketTagMembersLoading && props.marketTagMembers.length > 20 && (
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  仅展示前 20 个标的（共 {props.marketTagMembers.length}）。点击“查看成分”查看完整列表。
                </div>
              )}
            </div>
          </div>
        )}

        {props.marketSelectedSymbol && (
          <div className="h-full min-h-0 grid grid-rows-[1.3fr_5.7fr_3fr]">
            <div className="min-h-0 border-b border-border-light dark:border-border-dark bg-white/70 dark:bg-background-dark/70 backdrop-blur-lg px-6 py-4">
              <div className="flex items-start justify-between gap-6">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <div className="text-4xl font-extrabold text-slate-900 dark:text-white">
                      {props.marketSelectedProfile?.symbol ?? props.marketSelectedSymbol}
                    </div>
                    <div className="text-lg font-semibold text-slate-700 dark:text-slate-200 truncate">
                      {props.marketSelectedProfile?.name ?? "--"}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {props.marketSelectedProfile?.market ?? "--"} ·{" "}
                    {props.marketSelectedProfile?.currency ?? "--"} ·{" "}
                    {props.marketSelectedProfile?.assetClass ?? "--"}
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-end gap-1">
                    <props.MarketQuoteHeader quote={props.marketSelectedQuote} />
                  </div>
                  <div className="flex flex-col items-end gap-2 pt-1">
                    <div className="flex items-center gap-2">
                      {props.marketEffectiveScope === "tags" && props.marketSelectedTag && (
                        <props.IconButton
                          icon="arrow_back"
                          label="返回集合"
                          onClick={() => props.setMarketSelectedSymbol(null)}
                        />
                      )}
                      <props.IconButton
                        icon="star"
                        label="加入自选"
                        onClick={props.handleAddSelectedToWatchlist}
                        disabled={!props.marketSelectedProfile}
                      />
                      <props.IconButton
                        icon="info"
                        label="标的详情"
                        onClick={() => props.setMarketInstrumentDetailsOpen(true)}
                        disabled={!props.marketSelectedProfile}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="min-h-0 px-6 pt-3 pb-3 flex flex-col">
              <div className="flex-shrink-0 pb-2">
                <div className="rounded-lg border border-slate-200 dark:border-border-dark bg-white/70 dark:bg-panel-dark/80 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      价值判断（当前值 vs 调整后值）
                    </div>
                    <props.Button
                      variant="secondary"
                      size="sm"
                      icon="refresh"
                      onClick={() => void loadValuationPreview()}
                      disabled={valuationLoading}
                    >
                      刷新
                    </props.Button>
                  </div>

                  {valuationError && (
                    <div className="text-xs text-rose-600 dark:text-rose-400">
                      {valuationError}
                    </div>
                  )}

                  {valuationLoading && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      估值预览加载中...
                    </div>
                  )}

                  {!valuationLoading && valuationPreview && (
                    <>
                      <div className="grid grid-cols-4 gap-3 text-xs">
                        <div className="rounded-md border border-slate-200 dark:border-border-dark px-2 py-1.5">
                          <div className="text-slate-500 dark:text-slate-400">当前值</div>
                          <div className="font-mono text-sm text-slate-900 dark:text-slate-100">
                            {props.formatNumber(valuationPreview.baseValue, 4)}
                          </div>
                        </div>
                        <div className="rounded-md border border-slate-200 dark:border-border-dark px-2 py-1.5">
                          <div className="text-slate-500 dark:text-slate-400">调整后值</div>
                          <div className="font-mono text-sm text-slate-900 dark:text-slate-100">
                            {props.formatNumber(valuationPreview.adjustedValue, 4)}
                          </div>
                        </div>
                        <div className="rounded-md border border-slate-200 dark:border-border-dark px-2 py-1.5">
                          <div className="text-slate-500 dark:text-slate-400">方法</div>
                          <div className="font-mono text-[11px] text-slate-900 dark:text-slate-100 truncate">
                            {valuationPreview.methodKey ?? "not_applicable"}
                          </div>
                        </div>
                        <div className="rounded-md border border-slate-200 dark:border-border-dark px-2 py-1.5">
                          <div className="text-slate-500 dark:text-slate-400">作用链路数</div>
                          <div className="font-mono text-sm text-slate-900 dark:text-slate-100">
                            {valuationPreview.appliedEffects.length}
                          </div>
                        </div>
                      </div>

                      {valuationPreview.notApplicable && (
                        <div className="text-xs text-amber-700 dark:text-amber-400">
                          not_applicable: {valuationPreview.reason ?? "无可用估值方法"}
                        </div>
                      )}

                      {!valuationPreview.notApplicable &&
                        valuationPreview.appliedEffects.length > 0 && (
                          <div className="max-h-28 overflow-auto rounded border border-slate-200 dark:border-border-dark">
                            {valuationPreview.appliedEffects.slice(0, 12).map((effect) => (
                              <div
                                key={`${effect.channelId}:${effect.metricKey}:${effect.stage}`}
                                className="px-2 py-1.5 border-b border-slate-100 dark:border-border-dark/60 last:border-b-0 text-[11px] font-mono flex items-center justify-between gap-2"
                              >
                                <span className="truncate">
                                  {effect.metricKey} · {effect.operator} {effect.value} ·{" "}
                                  p={effect.priority}
                                </span>
                                <span className="text-slate-500 dark:text-slate-400 truncate">
                                  {effect.insightTitle}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                      {appliedInsightRows.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {appliedInsightRows.map((item) => (
                            <props.Button
                              key={item.insightId}
                              variant="danger"
                              size="sm"
                              icon="link_off"
                              onClick={() => void handleExcludeInsight(item.insightId)}
                              disabled={
                                excludingInsightId !== null &&
                                excludingInsightId !== item.insightId
                              }
                              title={`作用域: ${item.scopes.join(", ") || "--"}`}
                            >
                              解除 {item.insightTitle}（{item.count}）
                            </props.Button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0 pb-1">
                <div className="relative group h-9">
                  <div className="absolute inset-0 z-0 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-0.5 group-hover:opacity-0 transition-opacity">
                      <div className="text-[13px] font-semibold text-slate-900 dark:text-white">
                        {props.formatCnDate(
                          props.marketChartHoverDate ??
                            props.marketSelectedQuote?.tradeDate ??
                            props.marketLatestBar?.date ??
                            null
                        )}
                      </div>
                      {props.marketChartHoverPrice !== null && (
                        <div className="text-[14px] font-mono font-semibold text-primary">
                          {props.formatNumber(props.marketChartHoverPrice, 2)}
                        </div>
                      )}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center gap-1 rounded-full bg-slate-100/80 dark:bg-black/40 backdrop-blur px-2 py-1">
                        {props.marketChartRanges.map((item: MarketRangeOption) => {
                          const isActive = props.marketChartRange === item.key;
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
                                props.setMarketChartRange(item.key)
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
                          {props.marketHoldingUnitCost === null
                            ? "-"
                            : props.formatNumber(props.marketHoldingUnitCost, 2)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>目标价</span>
                      <span
                        className="font-mono text-xs text-slate-900 dark:text-white"
                        title="可用用户标签 target:xx.xx 设置"
                      >
                        {props.marketTargetPrice === null
                          ? "-"
                          : props.formatNumber(props.marketTargetPrice, 2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-hidden relative">
                {!props.marketChartHasEnoughData && (
                  <div className="h-full flex items-center justify-center text-sm text-slate-500 dark:text-slate-300">
                    {props.marketChartLoading ? "加载中..." : "暂无足够数据绘制图表。"}
                  </div>
                )}

                {props.marketChartHasEnoughData && (
                  <props.ChartErrorBoundary
                    resetKey={`symbol:${props.marketSelectedSymbol}:${props.marketChartRange}:${props.marketVolumeMode}`}
                  >
                    <props.MarketAreaChart
                      bars={props.marketChartBars}
                      tone={props.getCnChangeTone(
                        props.marketSelectedQuote?.changePct ?? null
                      )}
                      onHoverDatumChange={(datum: MarketChartHoverDatum | null) => {
                        props.setMarketChartHoverDate(datum?.date ?? null);
                        props.setMarketChartHoverPrice(datum?.close ?? null);
                      }}
                    />
                  </props.ChartErrorBoundary>
                )}

                {props.marketChartLoading && props.marketChartHasEnoughData && (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500 dark:text-slate-300 bg-white/40 dark:bg-black/20 backdrop-blur-sm">
                    加载中...
                  </div>
                )}
              </div>

              <div className="flex-shrink-0 pt-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {props.marketVolumeMode === "volume" ? "每日成交量" : "势能（moneyflow）"}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-mono text-slate-700 dark:text-slate-200">
                      {props.marketVolumeMode === "volume" ? (
                        props.formatCnWanYiNullable(props.marketActiveVolume, 2, 0)
                      ) : (
                        <>
                          {props.formatSignedCnWanYiNullable(props.marketActiveMoneyflowVol, 2, 0)}
                          {props.marketActiveMoneyflowRatio !== null && (
                            <span className="text-slate-400 dark:text-slate-500">
                              {" "}
                              · {(props.marketActiveMoneyflowRatio * 100).toFixed(1)}%
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1 rounded-full bg-slate-100/80 dark:bg-black/40 backdrop-blur px-1 py-1">
                      <button
                        type="button"
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors ${
                          props.marketVolumeMode === "volume"
                            ? "bg-primary/20 text-primary dark:bg-white/20 dark:text-white"
                            : "text-slate-600 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-white/10"
                        }`}
                        onClick={() => props.setMarketVolumeMode("volume")}
                      >
                        总成交量
                      </button>
                      <button
                        type="button"
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors ${
                          props.marketVolumeMode === "moneyflow"
                            ? "bg-primary/20 text-primary dark:bg-white/20 dark:text-white"
                            : "text-slate-600 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-white/10"
                        }`}
                        onClick={() => props.setMarketVolumeMode("moneyflow")}
                        title="势能来自行情数据源（Tushare moneyflow）。占比=|势能|/总成交量。"
                      >
                        势能
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-1 h-12 overflow-hidden">
                  <props.MarketVolumeMiniChart
                    bars={props.marketChartBars}
                    mode={props.marketVolumeMode}
                    activeDate={props.marketChartHoverDate}
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
                        {props.formatNumber(props.marketLatestBar?.open ?? null, 2)}
                      </td>
                      <td className="py-2 pl-6 text-xs text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-border-dark">
                        区间最高价
                      </td>
                      <td className="py-2 text-right font-mono text-sm text-slate-900 dark:text-white">
                        {props.formatNumber(props.marketRangeSummary.rangeHigh, 2)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-xs text-slate-500 dark:text-slate-400">
                        今日最高价
                      </td>
                      <td className="py-2 text-right font-mono text-sm text-slate-900 dark:text-white">
                        {props.formatNumber(props.marketLatestBar?.high ?? null, 2)}
                      </td>
                      <td className="py-2 pl-6 text-xs text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-border-dark">
                        区间最低价
                      </td>
                      <td className="py-2 text-right font-mono text-sm text-slate-900 dark:text-white">
                        {props.formatNumber(props.marketRangeSummary.rangeLow, 2)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-xs text-slate-500 dark:text-slate-400">
                        今日最低价
                      </td>
                      <td className="py-2 text-right font-mono text-sm text-slate-900 dark:text-white">
                        {props.formatNumber(props.marketLatestBar?.low ?? null, 2)}
                      </td>
                      <td className="py-2 pl-6 text-xs text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-border-dark">
                        平均成交量
                      </td>
                      <td className="py-2 text-right font-mono text-sm text-slate-900 dark:text-white">
                        {props.formatCnWanYiNullable(props.marketRangeSummary.avgVolume, 2, 0)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-xs text-slate-500 dark:text-slate-400">
                        成交量
                      </td>
                      <td className="py-2 text-right font-mono text-sm text-slate-900 dark:text-white">
                        {props.formatCnWanYiNullable(props.marketLatestBar?.volume ?? null, 2, 0)}
                      </td>
                      <td className="py-2 pl-6 text-xs text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-border-dark">
                        区间收益率
                      </td>
                      <td className="py-2 text-right font-mono text-sm text-slate-900 dark:text-white">
                        {props.formatSignedPctNullable(props.marketRangeSummary.rangeReturn)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-xs text-slate-500 dark:text-slate-400">
                        前收
                      </td>
                      <td className="py-2 text-right font-mono text-sm text-slate-900 dark:text-white">
                        {props.formatNumber(props.marketSelectedQuote?.prevClose ?? null, 2)}
                      </td>
                      <td className="py-2 pl-6 text-xs text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-border-dark">
                        流通市值
                      </td>
                      <td className="py-2 text-right font-mono text-sm text-slate-900 dark:text-white">
                        {props.formatCnWanYiNullable(props.marketSelectedQuote?.circMv ?? null, 2, 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
  );
}
