import type {
  ResolvedTargetSymbol,
  TargetReasonsDiff
} from "@mytrader/shared";

import type { OtherViewProps } from "../../OtherView";

interface TargetPoolMetricCard {
  key: string;
  label: string;
  value: string | number;
}

export type OtherDataManagementTargetPoolDiffPaneProps = Pick<
  OtherViewProps,
  | "formatTargetsReasons"
  | "handleToggleDiffSection"
  | "marketActiveTargetPoolStats"
  | "marketDiffSectionOpen"
  | "marketFilteredAddedSymbols"
  | "marketFilteredReasonChangedSymbols"
  | "marketFilteredRemovedSymbols"
  | "marketTargetPoolMetricCards"
  | "marketTargetPoolStatsScope"
  | "marketTargetsDiffPreview"
  | "marketTargetsPreview"
  | "refreshMarketTargetPoolStats"
  | "refreshMarketTargetsDiff"
  | "setMarketCurrentTargetsModalOpen"
  | "setMarketTargetPoolDetailMetric"
  | "setMarketTargetPoolStatsScope"
>;

export function OtherDataManagementTargetPoolDiffPane(
  props: OtherDataManagementTargetPoolDiffPaneProps
) {
  return (
    <div className="min-w-0 rounded-md bg-slate-50/70 dark:bg-background-dark/45 p-3 space-y-3 lg:sticky lg:top-3">
      <div className="rounded-md bg-white/65 dark:bg-background-dark/55 p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            标的结构看板
          </div>
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={() => void props.refreshMarketTargetPoolStats()}
              className="h-7 px-2.5 rounded-[5px] text-xs border border-slate-200/80 dark:border-border-dark/70 text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-background-dark/80 transition-colors"
            >
              刷新统计
            </button>
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
  );
}
