import type { ChangeEvent } from "react";

import type { TagSummary, TempTargetSymbol } from "@mytrader/shared";

import type { OtherViewProps } from "../OtherView";

export type OtherInstrumentManagementTabProps = Pick<
  OtherViewProps,
  | "Button"
  | "Input"
  | "formatDateTime"
  | "formatTagSourceLabel"
  | "handleBatchExtendTempTargets"
  | "handleBatchPromoteTempTargets"
  | "handleBatchRemoveTempTargets"
  | "handlePromoteTempTarget"
  | "handleRemoveTempTarget"
  | "handleSelectAllTempTargets"
  | "handleToggleTempTargetSelection"
  | "marketSelectedTempTargetSymbols"
  | "marketTagManagementQuery"
  | "marketTags"
  | "marketTagsLoading"
  | "marketTargetsSaving"
  | "marketTempTargets"
  | "marketTempTargetsLoading"
  | "refreshMarketTags"
  | "setMarketTagManagementQuery"
>;

export function OtherInstrumentManagementTab(props: OtherInstrumentManagementTabProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-slate-900 dark:text-white">
          标的管理
        </h3>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-3 items-start">
        <section className="space-y-2">
          <div className="rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark p-2.5 space-y-2.5 h-full flex flex-col">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                标签管理
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {props.marketTags.length} 个
                </span>
                <props.Button
                  variant="secondary"
                  size="sm"
                  className="h-8 px-2.5"
                  icon="refresh"
                  onClick={() => {
                    void props.refreshMarketTags(props.marketTagManagementQuery);
                  }}
                  disabled={props.marketTagsLoading}
                >
                  刷新
                </props.Button>
              </div>
            </div>
            <props.Input
              value={props.marketTagManagementQuery}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                props.setMarketTagManagementQuery(event.target.value)
              }
              placeholder="搜索标签（例如 industry: / theme: / watchlist:）"
              className="h-8 text-xs font-mono"
            />
            <div className="flex-1 min-h-[340px] max-h-[520px] overflow-auto rounded-md border border-slate-200 dark:border-border-dark">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white dark:bg-background-dark">
                  <tr className="border-b border-slate-200 dark:border-border-dark text-slate-500 dark:text-slate-400">
                    <th className="px-2 py-1.5 text-left">标签</th>
                    <th className="px-2 py-1.5 text-left">来源</th>
                    <th className="px-2 py-1.5 text-left">成员数</th>
                  </tr>
                </thead>
                <tbody>
                  {props.marketTags.map((tag: TagSummary) => (
                    <tr
                      key={tag.tag}
                      className="border-b border-slate-200/70 dark:border-border-dark/70 last:border-b-0"
                    >
                      <td className="px-2 py-1.5 font-mono">{tag.tag}</td>
                      <td className="px-2 py-1.5">
                        {props.formatTagSourceLabel(tag.source)}
                      </td>
                      <td className="px-2 py-1.5">{tag.memberCount}</td>
                    </tr>
                  ))}
                  {!props.marketTagsLoading && props.marketTags.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-2 py-6 text-center text-slate-500 dark:text-slate-400"
                      >
                        暂无标签
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <div className="rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark p-2.5 space-y-2.5 h-full flex flex-col">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                临时标的状态
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                共 {props.marketTempTargets.length} 个，已选{" "}
                {props.marketSelectedTempTargetSymbols.length} 个
              </div>
            </div>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-1.5">
              <props.Button
                variant="secondary"
                size="sm"
                className="w-full h-8 px-2"
                icon="select_all"
                onClick={props.handleSelectAllTempTargets}
              >
                {props.marketSelectedTempTargetSymbols.length ===
                props.marketTempTargets.length
                  ? "取消全选"
                  : "全选"}
              </props.Button>
              <props.Button
                variant="secondary"
                size="sm"
                className="w-full h-8 px-2"
                icon="history"
                onClick={props.handleBatchExtendTempTargets}
                disabled={props.marketSelectedTempTargetSymbols.length === 0}
              >
                续期 7 天
              </props.Button>
              <props.Button
                variant="secondary"
                size="sm"
                className="w-full h-8 px-2"
                icon="push_pin"
                onClick={props.handleBatchPromoteTempTargets}
                disabled={props.marketSelectedTempTargetSymbols.length === 0}
              >
                转长期
              </props.Button>
              <props.Button
                variant="danger"
                size="sm"
                className="w-full h-8 px-2"
                icon="delete"
                onClick={props.handleBatchRemoveTempTargets}
                disabled={props.marketSelectedTempTargetSymbols.length === 0}
              >
                移除
              </props.Button>
            </div>
            <div className="flex-1 min-h-[340px] max-h-[520px] overflow-auto space-y-1 rounded-md border border-slate-200 dark:border-border-dark p-1.5">
              {props.marketTempTargetsLoading && (
                <div className="text-xs text-slate-500 dark:text-slate-400 px-1 py-1">
                  加载中...
                </div>
              )}
              {!props.marketTempTargetsLoading &&
                props.marketTempTargets.map((item: TempTargetSymbol) => (
                  <div
                    key={item.symbol}
                    className="flex items-center justify-between gap-3 rounded-md border border-slate-200 dark:border-border-dark px-2 py-1.5"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <input
                        type="checkbox"
                        name={`marketSelectedTempTargetSymbol-${item.symbol}`}
                        checked={props.marketSelectedTempTargetSymbols.includes(
                          item.symbol
                        )}
                        onChange={() =>
                          props.handleToggleTempTargetSelection(item.symbol)
                        }
                      />
                      <div className="font-mono text-xs text-slate-700 dark:text-slate-200">
                        {item.symbol}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        到期 {props.formatDateTime(item.expiresAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <props.Button
                        variant="secondary"
                        size="sm"
                        className="h-7 px-2"
                        icon="push_pin"
                        onClick={() => props.handlePromoteTempTarget(item.symbol)}
                        disabled={props.marketTargetsSaving}
                      >
                        转长期
                      </props.Button>
                      <props.Button
                        variant="danger"
                        size="sm"
                        className="h-7 px-2"
                        icon="delete"
                        onClick={() => props.handleRemoveTempTarget(item.symbol)}
                      >
                        移除
                      </props.Button>
                    </div>
                  </div>
                ))}
              {!props.marketTempTargetsLoading && props.marketTempTargets.length === 0 && (
                <div className="text-xs text-slate-500 dark:text-slate-400 px-1 py-1">
                  暂无临时标的
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
