import { useEffect, useMemo, useState } from "react";

import type {
  ConnectivityTestRecord,
  MarketTokenMatrixStatus
} from "@mytrader/shared";

import type { OtherViewProps } from "../OtherView";

export type OtherDataStatusTabProps = Pick<
  OtherViewProps,
  | "Button"
  | "dataQuality"
  | "formatDateTime"
  | "formatDurationMs"
  | "formatIngestRunModeLabel"
  | "formatIngestRunScopeLabel"
  | "formatIngestRunStatusLabel"
  | "formatIngestRunTone"
  | "formatMarketTokenSource"
  | "formatPctNullable"
  | "handleTriggerMarketIngest"
  | "marketIngestRuns"
  | "marketIngestRunsLoading"
  | "marketIngestTriggering"
  | "marketSelectedIngestRun"
  | "marketSelectedIngestRunId"
  | "marketSelectedIngestRunLoading"
  | "marketTokenStatus"
  | "refreshMarketIngestRunDetail"
  | "refreshMarketIngestRuns"
  | "snapshot"
>;

export function OtherDataStatusTab({
  Button,
  dataQuality,
  formatDateTime,
  formatDurationMs,
  formatIngestRunModeLabel,
  formatIngestRunScopeLabel,
  formatIngestRunStatusLabel,
  formatIngestRunTone,
  formatMarketTokenSource,
  formatPctNullable,
  handleTriggerMarketIngest,
  marketIngestRuns,
  marketIngestRunsLoading,
  marketIngestTriggering,
  marketSelectedIngestRun,
  marketSelectedIngestRunId,
  marketSelectedIngestRunLoading,
  marketTokenStatus,
  refreshMarketIngestRunDetail,
  refreshMarketIngestRuns,
  snapshot
}: OtherDataStatusTabProps) {
  const [tokenMatrix, setTokenMatrix] = useState<MarketTokenMatrixStatus | null>(null);
  const [connectivityTests, setConnectivityTests] = useState<ConnectivityTestRecord[]>([]);

  useEffect(() => {
    const mytrader = window.mytrader;
    if (!mytrader) return;
    void (async () => {
      try {
        const [matrix, tests] = await Promise.all([
          mytrader.market.getTokenMatrixStatus(),
          mytrader.market.listConnectivityTests()
        ]);
        setTokenMatrix(matrix);
        setConnectivityTests(tests);
      } catch {
        setTokenMatrix(null);
        setConnectivityTests([]);
      }
    })();
  }, [marketIngestRuns.length, marketTokenStatus?.configured]);

  const pendingConnectivityCount = useMemo(
    () =>
      connectivityTests.filter(
        (item) =>
          item.scope === "module" &&
          (item.status === "untested" ||
            item.status === "fail" ||
            (item.status === "pass" && item.stale))
      ).length,
    [connectivityTests]
  );

  const domainOverrideCount = useMemo(
    () =>
      tokenMatrix
        ? Object.values(tokenMatrix.domains).filter(
            (item) => item.source === "domain_override"
          ).length
        : 0,
    [tokenMatrix]
  );

  const dedupedIngestRuns = useMemo(() => {
    const seen = new Set<string>();
    return marketIngestRuns.filter((run) => {
      if (seen.has(run.id)) return false;
      seen.add(run.id);
      return true;
    });
  }, [marketIngestRuns]);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-slate-900 dark:text-white">
          数据状态
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-50 dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark border border-slate-200 dark:border-border-dark rounded-lg p-4">
          <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">
            行情更新
          </div>
          <div className="text-sm text-slate-700 dark:text-slate-300">
            {snapshot?.priceAsOf ? (
              <span className="font-mono">{snapshot.priceAsOf}</span>
            ) : (
              "--"
            )}
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark border border-slate-200 dark:border-border-dark rounded-lg p-4">
          <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">
            覆盖率
          </div>
          <div className="text-sm text-slate-700 dark:text-slate-300 font-mono">
            {formatPctNullable(dataQuality?.coverageRatio ?? null)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            缺失标的 {dataQuality?.missingSymbols.length ?? 0}
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark border border-slate-200 dark:border-border-dark rounded-lg p-4">
          <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">
            新鲜度
          </div>
          <div className="text-sm text-slate-700 dark:text-slate-300 font-mono">
            {dataQuality?.freshnessDays === null || dataQuality?.freshnessDays === undefined
              ? "--"
              : `${dataQuality.freshnessDays} 天`}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            截至 {dataQuality?.asOfDate ?? "--"}
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark border border-slate-200 dark:border-border-dark rounded-lg p-4">
          <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">
            Token
          </div>
          <div className="text-sm text-slate-700 dark:text-slate-300 font-mono">
            {tokenMatrix?.mainConfigured ? "主令牌已配置" : "主令牌未配置"}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
            <div>域覆盖 {domainOverrideCount}</div>
            <div>待测试模块 {pendingConnectivityCount}</div>
            <div>
              兼容来源{" "}
              {marketTokenStatus
                ? formatMarketTokenSource(marketTokenStatus.source)
                : "--"}
            </div>
          </div>
        </div>
      </div>

      {dataQuality?.missingSymbols && dataQuality.missingSymbols.length > 0 && (
        <div className="rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark p-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              缺失标的
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon="play_arrow"
              onClick={() => handleTriggerMarketIngest("targets")}
              disabled={
                marketIngestTriggering || !marketTokenStatus?.configured
              }
            >
              拉取目标池
            </Button>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {marketTokenStatus?.configured
              ? "将按 Targets 配置回补缺失行情。"
              : "请先在「数据管理」配置 token。"}
          </div>
          <div className="max-h-32 overflow-auto rounded-md border border-slate-200/70 dark:border-border-dark/70 bg-slate-50/50 dark:bg-background-dark/40">
            <div className="p-2 flex flex-wrap gap-1">
              {dataQuality.missingSymbols.slice(0, 200).map((symbol) => (
                <span
                  key={symbol}
                  className="px-2 py-1 rounded-full bg-white dark:bg-surface-dark border border-slate-200/60 dark:border-border-dark/60 text-[11px] font-mono text-slate-700 dark:text-slate-200"
                >
                  {symbol}
                </span>
              ))}
              {dataQuality.missingSymbols.length > 200 && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400 px-1 py-1">
                  …共 {dataQuality.missingSymbols.length}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark p-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            拉取记录
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {marketIngestRunsLoading
                ? "加载中..."
                : `${dedupedIngestRuns.length} 条记录`}
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon="refresh"
              onClick={refreshMarketIngestRuns}
              disabled={marketIngestRunsLoading}
            >
              刷新
            </Button>
          </div>
        </div>

        {marketIngestRunsLoading && (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            加载中...
          </div>
        )}

        {!marketIngestRunsLoading && dedupedIngestRuns.length === 0 && (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            暂无拉取记录。
          </div>
        )}

        {!marketIngestRunsLoading && dedupedIngestRuns.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-3">
            <div className="max-h-[520px] overflow-auto rounded-md border border-slate-200 dark:border-border-dark">
              <table className="w-full text-sm">
                <thead className="bg-white dark:bg-background-dark sticky top-0">
                  <tr className="text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-border-dark">
                    <th className="text-left font-semibold px-3 py-2">
                      时间
                    </th>
                    <th className="text-left font-semibold px-3 py-2">
                      范围
                    </th>
                    <th className="text-left font-semibold px-3 py-2">
                      状态
                    </th>
                    <th className="text-right font-semibold px-3 py-2">
                      写入
                    </th>
                    <th className="text-right font-semibold px-3 py-2">
                      错误
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dedupedIngestRuns.slice(0, 200).map((run) => {
                    const statusTone = formatIngestRunTone(run.status);
                    const selected = marketSelectedIngestRunId === run.id;
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
                        <td className="px-3 py-2">
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {formatDateTime(run.startedAt)}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {run.finishedAt
                              ? `耗时 ${formatDurationMs(
                                run.finishedAt - run.startedAt
                              )}`
                              : "进行中..."}
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500">
                            截至 {run.asOfTradeDate ?? "--"}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-200">
                          <span className="font-mono">
                            {formatIngestRunScopeLabel(run.scope)}
                          </span>
                          <span className="text-slate-400 dark:text-slate-500">
                            {" "}
                            · {formatIngestRunModeLabel(run.mode)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <span className={statusTone}>
                            {formatIngestRunStatusLabel(run.status)}
                          </span>
                          {run.errorMessage && (
                            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                              {run.errorMessage}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-mono text-slate-700 dark:text-slate-200">
                          {(run.inserted ?? 0) + (run.updated ?? 0)}
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-mono text-slate-700 dark:text-slate-200">
                          {run.errors ?? 0}
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
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  加载中...
                </div>
              )}
              {!marketSelectedIngestRunLoading &&
                !marketSelectedIngestRun && (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    点击左侧记录查看详情。
                  </div>
                )}
              {!marketSelectedIngestRunLoading &&
                marketSelectedIngestRun && (
                  <div className="space-y-1 text-xs">
                    <div>
                      <span className="text-slate-400">ID：</span>
                      <span className="font-mono">
                        {marketSelectedIngestRun.id}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">范围：</span>
                      <span className="font-mono">
                        {formatIngestRunScopeLabel(
                          marketSelectedIngestRun.scope
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">模式：</span>
                      <span className="font-mono">
                        {formatIngestRunModeLabel(
                          marketSelectedIngestRun.mode
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">状态：</span>
                      <span
                        className={formatIngestRunTone(
                          marketSelectedIngestRun.status
                        )}
                      >
                        {formatIngestRunStatusLabel(
                          marketSelectedIngestRun.status
                        )}
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
                      <span className="font-mono">
                        {marketSelectedIngestRun.errors ?? 0}
                      </span>
                    </div>
                    {marketSelectedIngestRun.errorMessage && (
                      <div className="rounded-md bg-slate-50 dark:bg-background-dark/60 p-2 text-[11px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                        {marketSelectedIngestRun.errorMessage}
                      </div>
                    )}
                    {marketSelectedIngestRun.meta && (
                      <pre className="rounded-md bg-slate-50 dark:bg-background-dark/60 p-2 text-[11px] overflow-auto max-h-40">
                        {JSON.stringify(
                          marketSelectedIngestRun.meta,
                          null,
                          2
                        )}
                      </pre>
                    )}
                  </div>
                )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
