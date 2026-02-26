import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  PreviewCompletenessCoverageResult
} from "@mytrader/shared";

import type { OtherViewProps } from "../OtherView";
import { OtherDataManagementTargetTaskPanel } from "./data-management/OtherDataManagementTargetTaskPanel";

export type OtherDataStatusTabProps = Pick<
  OtherViewProps,
  | "Button"
  | "Input"
  | "Modal"
  | "PopoverSelect"
  | "formatCnDate"
  | "formatDateTime"
  | "formatDurationMs"
  | "formatIngestRunModeLabel"
  | "formatIngestRunScopeLabel"
  | "formatIngestRunStatusLabel"
  | "formatIngestRunTone"
  | "marketIngestRuns"
  | "marketIngestRunsLoading"
  | "marketSelectedIngestRun"
  | "marketSelectedIngestRunId"
  | "marketSelectedIngestRunLoading"
  | "refreshMarketIngestRunDetail"
  | "refreshMarketIngestRuns"
>;

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDelayDays(asOfTradeDate: string | null): string {
  if (!asOfTradeDate) return "--";
  const asOfEpoch = Date.parse(`${asOfTradeDate}T00:00:00Z`);
  if (!Number.isFinite(asOfEpoch)) return "--";
  const diffDays = Math.floor((Date.now() - asOfEpoch) / (24 * 60 * 60 * 1000));
  return `${Math.max(0, diffDays)} 天`;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || "未知错误。";
  if (typeof error === "string") return error;
  return "未知错误。";
}

export function OtherDataStatusTab({
  Button,
  Input,
  Modal,
  PopoverSelect,
  formatCnDate,
  formatDateTime,
  formatDurationMs,
  formatIngestRunModeLabel,
  formatIngestRunScopeLabel,
  formatIngestRunStatusLabel,
  formatIngestRunTone,
  marketIngestRuns,
  marketIngestRunsLoading,
  marketSelectedIngestRun,
  marketSelectedIngestRunId,
  marketSelectedIngestRunLoading,
  refreshMarketIngestRunDetail,
  refreshMarketIngestRuns
}: OtherDataStatusTabProps) {
  const [sourceCoverage, setSourceCoverage] =
    useState<PreviewCompletenessCoverageResult | null>(null);

  useEffect(() => {
    const mytrader = window.mytrader;
    if (!mytrader) return;
    let cancelled = false;
    void (async () => {
      try {
        const coverage = await mytrader.market.previewCompletenessCoverage({
          scopeId: "source_pool"
        });
        if (!cancelled) {
          setSourceCoverage(coverage);
        }
      } catch {
        if (!cancelled) {
          setSourceCoverage(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [marketIngestRuns.length]);

  const sourceSupplyDashboard = useMemo(() => {
    if (!sourceCoverage) {
      return {
        toneClass: "text-slate-900 dark:text-white",
        completionLabel: "--",
        gapLabel: "缺失 -- · 待收敛 --",
        asOfLabel: "--",
        delayLabel: "--",
        scaleLabel: "--"
      };
    }
    const totals = sourceCoverage.totals;
    const applicable =
      totals.complete + totals.partial + totals.missing + totals.notStarted;
    const pending = totals.partial + totals.notStarted;
    const completionRate = applicable > 0 ? totals.complete / applicable : null;

    let toneClass = "text-emerald-700 dark:text-emerald-300";
    if (totals.missing > 0) {
      toneClass = "text-rose-700 dark:text-rose-300";
    } else if (pending > 0) {
      toneClass = "text-amber-700 dark:text-amber-300";
    }

    return {
      toneClass,
      completionLabel: completionRate === null ? "--" : formatPercent(completionRate),
      gapLabel: `缺失 ${totals.missing.toLocaleString()} · 待收敛 ${pending.toLocaleString()}`,
      asOfLabel: sourceCoverage.asOfTradeDate ?? "--",
      delayLabel: formatDelayDays(sourceCoverage.asOfTradeDate),
      scaleLabel: `${totals.entities.toLocaleString()} 实体 × ${totals.checks.toLocaleString()} 检查`
    };
  }, [sourceCoverage]);

  const dedupedIngestRuns = useMemo(() => {
    const seen = new Set<string>();
    return marketIngestRuns.filter((run) => {
      if (seen.has(run.id)) return false;
      seen.add(run.id);
      return true;
    });
  }, [marketIngestRuns]);

  const [ingestMutating, setIngestMutating] = useState(false);
  const [ingestActionError, setIngestActionError] = useState<string | null>(null);

  const handleDeleteIngestRun = useCallback(
    async (runId: string) => {
      const mytrader = window.mytrader;
      if (!mytrader) return;
      if (!window.confirm("确认删除这条拉取记录？")) return;
      setIngestMutating(true);
      setIngestActionError(null);
      try {
        await mytrader.market.removeIngestRun({ id: runId });
        if (marketSelectedIngestRunId === runId) {
          await refreshMarketIngestRunDetail("");
        }
        await refreshMarketIngestRuns();
      } catch (error) {
        setIngestActionError(toErrorMessage(error));
      } finally {
        setIngestMutating(false);
      }
    },
    [marketSelectedIngestRunId, refreshMarketIngestRunDetail, refreshMarketIngestRuns]
  );

  const handleClearIngestRuns = useCallback(async () => {
    const mytrader = window.mytrader;
    if (!mytrader) return;
    if (!window.confirm("确认清空全部拉取记录？")) return;
    setIngestMutating(true);
    setIngestActionError(null);
    try {
      await mytrader.market.clearIngestRuns();
      await refreshMarketIngestRuns();
      await refreshMarketIngestRunDetail("");
    } catch (error) {
      setIngestActionError(toErrorMessage(error));
    } finally {
      setIngestMutating(false);
    }
  }, [refreshMarketIngestRunDetail, refreshMarketIngestRuns]);

  return (
    <>
      <section className="px-0 -mt-1">
        <div className="border border-slate-200/70 dark:border-border-dark/70">
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200/70 dark:divide-border-dark/70">
            <div className="px-3 py-2">
              <div className="text-sm font-normal text-slate-900 dark:text-slate-100">
                供给完成率
              </div>
              <div
                className={`mt-0.5 font-mono text-xs whitespace-nowrap truncate ${sourceSupplyDashboard.toneClass}`}
                title={`${sourceSupplyDashboard.completionLabel} · ${sourceSupplyDashboard.scaleLabel}`}
              >
                {sourceSupplyDashboard.completionLabel} · {sourceSupplyDashboard.scaleLabel}
              </div>
            </div>
            <div className="px-3 py-2">
              <div className="text-sm font-normal text-slate-900 dark:text-slate-100">
                供给缺口
              </div>
              <div
                className={`mt-0.5 font-mono text-xs whitespace-nowrap truncate ${sourceSupplyDashboard.toneClass}`}
                title={sourceSupplyDashboard.gapLabel}
              >
                {sourceSupplyDashboard.gapLabel}
              </div>
            </div>
            <div className="px-3 py-2">
              <div className="text-sm font-normal text-slate-900 dark:text-slate-100">
                供给截至
              </div>
              <div
                className="mt-0.5 font-mono text-xs text-slate-900 dark:text-white whitespace-nowrap truncate"
                title={`${sourceSupplyDashboard.asOfLabel} · 延迟 ${sourceSupplyDashboard.delayLabel}`}
              >
                {sourceSupplyDashboard.asOfLabel} · 延迟 {sourceSupplyDashboard.delayLabel}
              </div>
            </div>
          </div>
        </div>
      </section>

      <OtherDataManagementTargetTaskPanel
        mode="status"
        Button={Button}
        Input={Input}
        Modal={Modal}
        PopoverSelect={PopoverSelect}
        formatCnDate={formatCnDate}
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900 dark:text-white">拉取记录</h3>
          <div className="flex items-center gap-2">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {marketIngestRunsLoading ? "加载中..." : `${dedupedIngestRuns.length} 条记录`}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleClearIngestRuns()}
              disabled={marketIngestRunsLoading || ingestMutating || dedupedIngestRuns.length === 0}
            >
              清空
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon="refresh"
              onClick={refreshMarketIngestRuns}
              disabled={marketIngestRunsLoading || ingestMutating}
            >
              刷新
            </Button>
          </div>
        </div>

        {ingestActionError && (
          <div className="text-xs text-rose-700 dark:text-rose-300">{ingestActionError}</div>
        )}

        {marketIngestRunsLoading && (
          <div className="text-sm text-slate-500 dark:text-slate-400">加载中...</div>
        )}

        {!marketIngestRunsLoading && dedupedIngestRuns.length === 0 && (
          <div className="text-sm text-slate-500 dark:text-slate-400">暂无拉取记录。</div>
        )}

        {!marketIngestRunsLoading && dedupedIngestRuns.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-[1.65fr_1fr] gap-3">
            <div className="max-h-[520px] overflow-y-auto overflow-x-hidden rounded-md border border-slate-200 dark:border-border-dark">
              <table className="w-full table-fixed text-sm">
                <thead className="bg-white dark:bg-background-dark sticky top-0 z-[1]">
                  <tr className="text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-border-dark">
                    <th className="w-[24%] text-left font-semibold px-3 py-2">拉取时间</th>
                    <th className="w-[12%] text-left font-semibold px-3 py-2">耗时</th>
                    <th className="w-[20%] text-left font-semibold px-3 py-2">范围</th>
                    <th className="w-[14%] text-left font-semibold px-3 py-2">状态</th>
                    <th className="w-[10%] text-right font-semibold px-3 py-2">写入</th>
                    <th className="w-[8%] text-right font-semibold px-3 py-2">错误</th>
                    <th className="w-[12%] text-right font-semibold px-3 py-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {dedupedIngestRuns.slice(0, 200).map((run) => {
                    const statusTone = formatIngestRunTone(run.status);
                    const selected = marketSelectedIngestRunId === run.id;
                    const deletingDisabled = ingestMutating || run.status === "running";
                    return (
                      <tr
                        key={run.id}
                        className={`border-b border-slate-200/70 dark:border-border-dark/70 last:border-b-0 cursor-pointer ${
                          selected
                            ? "bg-primary/10"
                            : "hover:bg-slate-50 dark:hover:bg-background-dark/60"
                        }`}
                        onClick={() => {
                          void refreshMarketIngestRunDetail(run.id);
                        }}
                      >
                        <td className="px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap truncate">
                          {formatDateTime(run.startedAt)}
                        </td>
                        <td className="px-3 py-2 text-[11px] font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {run.finishedAt
                            ? formatDurationMs(run.finishedAt - run.startedAt)
                            : "进行中..."}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-200">
                          <div className="truncate">
                            <span className="font-mono">
                              {formatIngestRunScopeLabel(run.scope)}
                            </span>
                            <span className="text-slate-400 dark:text-slate-500">
                              {" "}
                              · {formatIngestRunModeLabel(run.mode)}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <span className={`${statusTone} whitespace-nowrap`}>
                            {formatIngestRunStatusLabel(run.status)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-mono text-slate-700 dark:text-slate-200">
                          {(run.inserted ?? 0) + (run.updated ?? 0)}
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-mono text-slate-700 dark:text-slate-200">
                          {run.errors ?? 0}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="!h-7 !px-2 !text-[11px]"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleDeleteIngestRun(run.id);
                            }}
                            disabled={deletingDisabled}
                          >
                            删除
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="rounded-md border border-slate-200 dark:border-border-dark p-3 space-y-2">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Run 详情
              </div>
              {marketSelectedIngestRunLoading && (
                <div className="text-xs text-slate-500 dark:text-slate-400">加载中...</div>
              )}
              {!marketSelectedIngestRunLoading && !marketSelectedIngestRun && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  点击左侧记录查看详情。
                </div>
              )}
              {!marketSelectedIngestRunLoading && marketSelectedIngestRun && (
                <div className="space-y-1 text-xs">
                  <div>
                    <span className="text-slate-400">ID：</span>
                    <span className="font-mono">{marketSelectedIngestRun.id}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">范围：</span>
                    <span className="font-mono">
                      {formatIngestRunScopeLabel(marketSelectedIngestRun.scope)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">模式：</span>
                    <span className="font-mono">
                      {formatIngestRunModeLabel(marketSelectedIngestRun.mode)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">状态：</span>
                    <span className={formatIngestRunTone(marketSelectedIngestRun.status)}>
                      {formatIngestRunStatusLabel(marketSelectedIngestRun.status)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">写入：</span>
                    <span className="font-mono">
                      {(marketSelectedIngestRun.inserted ?? 0) +
                        (marketSelectedIngestRun.updated ?? 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">错误：</span>
                    <span className="font-mono">{marketSelectedIngestRun.errors ?? 0}</span>
                  </div>
                  {marketSelectedIngestRun.errorMessage && (
                    <div className="rounded-md bg-slate-50 dark:bg-background-dark/60 p-2 text-[11px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                      {marketSelectedIngestRun.errorMessage}
                    </div>
                  )}
                  {marketSelectedIngestRun.meta && (
                    <pre className="rounded-md bg-slate-50 dark:bg-background-dark/60 p-2 text-[11px] overflow-auto max-h-40">
                      {JSON.stringify(marketSelectedIngestRun.meta, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
