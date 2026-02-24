import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  CompletenessScopeId,
  CompletenessStatus,
  ListCompletenessStatusResult,
  MarketCompletenessConfig,
  PreviewCompletenessCoverageResult
} from "@mytrader/shared";

import type { OtherViewProps } from "../../OtherView";

type ScopeFilter = "all" | CompletenessScopeId;
type StatusFilter = "all" | CompletenessStatus;
type CheckFilter = "all" | string;

const STATUS_ORDER: CompletenessStatus[] = [
  "complete",
  "partial",
  "missing",
  "not_started",
  "not_applicable"
];

const COMPLETENESS_DEFINITION_TOOLTIP =
  "完备性用于评估目标消费与数据源供给覆盖，不直接改变目标池抓取范围。";

const STATUS_FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "全部状态" },
  { value: "complete", label: "完整" },
  { value: "partial", label: "部分缺失" },
  { value: "missing", label: "缺失" },
  { value: "not_started", label: "未启动" },
  { value: "not_applicable", label: "不适用" }
];

export type OtherDataManagementTargetTaskPanelProps = Pick<
  OtherViewProps,
  "Button" | "Input" | "PopoverSelect" | "formatCnDate"
>;

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || "未知错误。";
  if (typeof error === "string") return error;
  return "未知错误。";
}

function formatScopeLabel(scopeId: CompletenessScopeId): string {
  return scopeId === "target_pool" ? "目标消费完备性" : "数据源供给完备性";
}

function formatBucketLabel(bucketId: string): string {
  if (bucketId === "stock") return "股票";
  if (bucketId === "etf") return "ETF";
  if (bucketId === "futures") return "期货";
  if (bucketId === "spot") return "现货";
  if (bucketId === "index") return "指数";
  if (bucketId === "fx") return "外汇";
  if (bucketId === "macro") return "宏观";
  if (bucketId === "global") return "全局";
  return bucketId;
}

function formatStatusLabel(status: CompletenessStatus): string {
  if (status === "complete") return "完整";
  if (status === "partial") return "部分缺失";
  if (status === "missing") return "缺失";
  if (status === "not_started") return "未启动";
  return "不适用";
}

function statusToneClass(status: CompletenessStatus): string {
  if (status === "complete") return "border-emerald-300 text-emerald-700 dark:text-emerald-300";
  if (status === "partial") return "border-amber-300 text-amber-700 dark:text-amber-300";
  if (status === "missing") return "border-rose-300 text-rose-700 dark:text-rose-300";
  if (status === "not_started") return "border-blue-300 text-blue-700 dark:text-blue-300";
  return "border-slate-300 text-slate-600 dark:border-border-dark dark:text-slate-300";
}

function resolveStatusCountFromCoverage(
  coverage: PreviewCompletenessCoverageResult | null,
  status: CompletenessStatus
): number {
  if (!coverage) return 0;
  if (status === "complete") return coverage.totals.complete;
  if (status === "partial") return coverage.totals.partial;
  if (status === "missing") return coverage.totals.missing;
  if (status === "not_started") return coverage.totals.notStarted;
  return coverage.totals.notApplicable;
}

function resolveStatusCountFromBucket(
  bucket: PreviewCompletenessCoverageResult["byBucket"][number] | null,
  status: CompletenessStatus
): number {
  if (!bucket) return 0;
  if (status === "complete") return bucket.complete;
  if (status === "partial") return bucket.partial;
  if (status === "missing") return bucket.missing;
  if (status === "not_started") return bucket.notStarted;
  return bucket.notApplicable;
}

function resolveApplicableCountFromCoverage(
  coverage: PreviewCompletenessCoverageResult | null
): number {
  if (!coverage) return 0;
  return (
    coverage.totals.complete +
    coverage.totals.partial +
    coverage.totals.missing +
    coverage.totals.notStarted
  );
}

function resolveApplicableCountFromBucket(
  bucket: PreviewCompletenessCoverageResult["byBucket"][number] | null
): number {
  if (!bucket) return 0;
  return bucket.complete + bucket.partial + bucket.missing + bucket.notStarted;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function completeRateToneClass(rate: number | null): string {
  if (rate === null) return "text-slate-500 dark:text-slate-400";
  if (rate >= 0.8) return "text-emerald-700 dark:text-emerald-300";
  if (rate >= 0.6) return "text-lime-700 dark:text-lime-300";
  if (rate >= 0.4) return "text-amber-700 dark:text-amber-300";
  if (rate >= 0.2) return "text-orange-700 dark:text-orange-300";
  return "text-rose-700 dark:text-rose-300";
}

function resolveDelayDays(asOfTradeDate: string | null): number | null {
  if (!asOfTradeDate) return null;
  const asOfEpoch = Date.parse(`${asOfTradeDate}T00:00:00Z`);
  if (!Number.isFinite(asOfEpoch)) return null;
  const nowEpoch = Date.now();
  const diffDays = Math.floor((nowEpoch - asOfEpoch) / (24 * 60 * 60 * 1000));
  return Math.max(0, diffDays);
}

export function OtherDataManagementTargetTaskPanel(
  props: OtherDataManagementTargetTaskPanelProps
) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [materializing, setMaterializing] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [config, setConfig] = useState<MarketCompletenessConfig | null>(null);
  const [savedConfig, setSavedConfig] = useState<MarketCompletenessConfig | null>(null);
  const [targetCoverage, setTargetCoverage] =
    useState<PreviewCompletenessCoverageResult | null>(null);
  const [sourceCoverage, setSourceCoverage] =
    useState<PreviewCompletenessCoverageResult | null>(null);
  const [coverageLoaded, setCoverageLoaded] = useState(false);
  const [statusRows, setStatusRows] = useState<ListCompletenessStatusResult | null>(null);

  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [checkFilter, setCheckFilter] = useState<CheckFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [statusPanelExpanded, setStatusPanelExpanded] = useState(false);

  const refreshConfig = useCallback(async () => {
    if (!window.mytrader) return;
    const nextConfig = await window.mytrader.market.getCompletenessConfig();
    setConfig(nextConfig);
    setSavedConfig(nextConfig);
  }, []);

  const refreshCoverage = useCallback(async () => {
    if (!window.mytrader) return;
    const [target, source] = await Promise.all([
      window.mytrader.market.previewCompletenessCoverage({
        scopeId: "target_pool"
      }),
      window.mytrader.market.previewCompletenessCoverage({
        scopeId: "source_pool"
      })
    ]);
    setTargetCoverage(target);
    setSourceCoverage(source);
    setCoverageLoaded(true);
  }, []);

  const refreshOverview = useCallback(async () => {
    if (!window.mytrader) return;
    setLoading(true);
    try {
      await Promise.all([refreshConfig(), refreshCoverage()]);
      setError(null);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [refreshConfig, refreshCoverage]);

  const refreshStatusRows = useCallback(async () => {
    if (!window.mytrader) return;
    setStatusLoading(true);
    try {
      const rows = await window.mytrader.market.listCompletenessStatus({
        scopeId: scopeFilter === "all" ? null : scopeFilter,
        checkId: checkFilter === "all" ? null : checkFilter,
        status: statusFilter === "all" ? null : statusFilter,
        limit: 200,
        offset: 0
      });
      setStatusRows(rows);
      setError(null);
    } catch (err) {
      setStatusRows(null);
      setError(toErrorMessage(err));
    } finally {
      setStatusLoading(false);
    }
  }, [checkFilter, scopeFilter, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true);
      refreshConfig()
        .then(() => {
          setError(null);
        })
        .catch((err) => {
          setError(toErrorMessage(err));
        })
        .finally(() => {
          setLoading(false);
        });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [refreshConfig]);

  useEffect(() => {
    if (!statusPanelExpanded) return;
    void refreshStatusRows();
  }, [refreshStatusRows, statusPanelExpanded]);

  const targetChecks = useMemo(() => {
    if (!config) return [];
    return config.checks
      .filter((check) => check.scopeId === "target_pool")
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [config]);

  const sourceChecks = useMemo(() => {
    if (!config) return [];
    return config.checks
      .filter((check) => check.scopeId === "source_pool")
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [config]);

  const targetEnabledCheckIdSet = useMemo(
    () => new Set(config?.targetEnabledCheckIds ?? []),
    [config?.targetEnabledCheckIds]
  );

  const checkFilterOptions = useMemo(() => {
    const allChecks = config?.checks ?? [];
    return [
      { value: "all", label: "全部检查项" },
      ...allChecks.map((check) => ({
        value: check.id,
        label: `${formatScopeLabel(check.scopeId)} · ${check.label}`
      }))
    ];
  }, [config?.checks]);

  const matrixDirty = useMemo(() => {
    if (!config || !savedConfig) return false;
    return JSON.stringify(config.targetEnabledCheckIds) !== JSON.stringify(savedConfig.targetEnabledCheckIds);
  }, [config, savedConfig]);

  const topStatusSummary = useMemo(() => {
    const totals = targetCoverage?.totals;
    const missing = totals?.missing ?? 0;
    const pending = (totals?.partial ?? 0) + (totals?.notStarted ?? 0);
    const delayDays = resolveDelayDays(targetCoverage?.asOfTradeDate ?? null);
    const asOfLabel = targetCoverage?.asOfTradeDate
      ? props.formatCnDate(targetCoverage.asOfTradeDate)
      : "--";

    if (!coverageLoaded) {
      return {
        label: "待加载",
        labelTone: "text-slate-600 dark:text-slate-300",
        message: "点击“刷新”加载完备性状态",
        asOfLabel,
        delayLabel: "--",
        scaleLabel: "--"
      };
    }

    if (missing > 0) {
      return {
        label: "高风险",
        labelTone: "text-rose-700 dark:text-rose-300",
        message: `存在 ${missing.toLocaleString()} 项缺失`,
        asOfLabel,
        delayLabel: delayDays === null ? "--" : `${delayDays} 天`,
        scaleLabel: `${(totals?.entities ?? 0).toLocaleString()} 实体 / ${(totals?.checks ?? 0).toLocaleString()} 检查`
      };
    }

    if (pending > 0) {
      return {
        label: "需关注",
        labelTone: "text-amber-700 dark:text-amber-300",
        message: `存在 ${pending.toLocaleString()} 项待收敛`,
        asOfLabel,
        delayLabel: delayDays === null ? "--" : `${delayDays} 天`,
        scaleLabel: `${(totals?.entities ?? 0).toLocaleString()} 实体 / ${(totals?.checks ?? 0).toLocaleString()} 检查`
      };
    }

    return {
      label: "健康",
      labelTone: "text-emerald-700 dark:text-emerald-300",
      message: "当前无缺失与待收敛项",
      asOfLabel,
      delayLabel: delayDays === null ? "--" : `${delayDays} 天`,
      scaleLabel: `${(totals?.entities ?? 0).toLocaleString()} 实体 / ${(totals?.checks ?? 0).toLocaleString()} 检查`
    };
  }, [coverageLoaded, props, targetCoverage]);

  const handleToggleTargetCheck = useCallback((checkId: string) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const enabled = new Set(prev.targetEnabledCheckIds);
      if (enabled.has(checkId)) {
        if (enabled.size <= 1) return prev;
        enabled.delete(checkId);
      } else {
        enabled.add(checkId);
      }
      return {
        ...prev,
        targetEnabledCheckIds: targetChecks
          .map((check) => check.id)
          .filter((id) => enabled.has(id))
      };
    });
  }, [targetChecks]);

  const handleSaveConfig = useCallback(async () => {
    if (!window.mytrader || !config) return;
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      if (config.targetEnabledCheckIds.length === 0) {
        throw new Error("Target checks 至少启用一个。");
      }
      const saved = await window.mytrader.market.setCompletenessConfig({
        defaultLookbackDays: config.defaultLookbackDays,
        targetEnabledCheckIds: config.targetEnabledCheckIds
      });
      setConfig(saved);
      setSavedConfig(saved);
      setNotice("完备性配置已保存。");
      await refreshConfig();
      if (coverageLoaded) {
        await refreshCoverage();
      }
      if (statusPanelExpanded) {
        await refreshStatusRows();
      }
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }, [
    config,
    coverageLoaded,
    refreshConfig,
    refreshCoverage,
    refreshStatusRows,
    statusPanelExpanded
  ]);

  const handleRunMaterialization = useCallback(async () => {
    if (!window.mytrader) return;
    setMaterializing(true);
    setError(null);
    setNotice(null);
    try {
      await window.mytrader.market.runCompletenessMaterialization({
        scopeId: "target_pool"
      });
      await window.mytrader.market.runCompletenessMaterialization({
        scopeId: "source_pool"
      });
      await refreshCoverage();
      if (statusPanelExpanded) {
        await refreshStatusRows();
      }
      setNotice("完备性物化已触发，target/source 状态已刷新。");
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setMaterializing(false);
    }
  }, [refreshCoverage, refreshStatusRows, statusPanelExpanded]);

  const renderCoverageSection = useCallback(
    (scopeId: CompletenessScopeId, coverage: PreviewCompletenessCoverageResult | null) => {
      const checks = (config?.checks ?? [])
        .filter((check) => check.scopeId === scopeId)
        .filter((check) =>
          scopeId === "target_pool"
            ? targetEnabledCheckIdSet.has(check.id)
            : true
        )
        .sort((a, b) => a.sortOrder - b.sortOrder);

      const enabledBuckets = Array.from(
        new Set(checks.map((check) => check.bucketId))
      ).sort((a, b) => {
        const aOrder = checks.find((check) => check.bucketId === a)?.sortOrder ?? Number.MAX_SAFE_INTEGER;
        const bOrder = checks.find((check) => check.bucketId === b)?.sortOrder ?? Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.localeCompare(b);
      });

      const byBucketMap = new Map(
        (coverage?.byBucket ?? []).map((item) => [item.bucketId, item])
      );

      const columns: Array<{
        key: string;
        label: string;
        bucketId: PreviewCompletenessCoverageResult["byBucket"][number]["bucketId"] | null;
      }> = [
        { key: `${scopeId}-overall`, label: "整体", bucketId: null },
        ...enabledBuckets.map((bucketId) => ({
          key: `${scopeId}-${bucketId}`,
          label: formatBucketLabel(bucketId),
          bucketId
        }))
      ];

      return (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            {formatScopeLabel(scopeId)}
          </div>

          {enabledBuckets.length > 0 ? (
            <div className="max-h-[260px] overflow-auto pb-1">
              <table className="min-w-[860px] w-full text-xs">
                <thead className="sticky top-0 bg-white dark:bg-background-dark">
                  <tr className="border-b border-slate-200/70 dark:border-border-dark/70 text-slate-500 dark:text-slate-400">
                    <th className="w-20 min-w-[80px] px-2 py-1.5 text-left font-semibold">
                      状态
                    </th>
                    {columns.map((column) => (
                      <th key={column.key} className="px-2 py-1.5 text-right font-semibold">
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {STATUS_ORDER.map((status) => (
                    <tr
                      key={`${scopeId}-matrix-${status}`}
                      className="border-b border-slate-200/70 dark:border-border-dark/70 last:border-b-0"
                    >
                      <td className="w-20 min-w-[80px] px-2 py-1.5 text-slate-700 dark:text-slate-200">
                        {formatStatusLabel(status)}
                      </td>
                      {columns.map((column) => {
                        const bucket = column.bucketId ? byBucketMap.get(column.bucketId) ?? null : null;
                        const value = column.bucketId
                          ? resolveStatusCountFromBucket(bucket, status)
                          : resolveStatusCountFromCoverage(coverage, status);
                        const applicable = column.bucketId
                          ? resolveApplicableCountFromBucket(bucket)
                          : resolveApplicableCountFromCoverage(coverage);
                        const completeRate =
                          status === "complete" && applicable > 0
                            ? value / applicable
                            : null;
                        return (
                          <td
                            key={`${scopeId}-matrix-${status}-${column.key}`}
                            className="px-2 py-1.5 text-right font-mono text-slate-700 dark:text-slate-200"
                          >
                            {status === "complete" ? (
                              <span>
                                {value.toLocaleString()} /{" "}
                                <span className={completeRateToneClass(completeRate)}>
                                  {completeRate === null ? "--" : formatPercent(completeRate)}
                                </span>
                              </span>
                            ) : (
                              value.toLocaleString()
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              当前无已配置 bucket。
            </div>
          )}
        </div>
      );
    },
    [config?.checks, props, targetEnabledCheckIdSet]
  );

  const sourceModuleRows = useMemo(() => {
    return sourceChecks.map((check) => ({
      id: check.id,
      label: check.label,
      bucket: formatBucketLabel(check.bucketId),
      domain: check.domainId ?? "--",
      module: check.moduleId ?? "--"
    }));
  }, [sourceChecks]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-slate-900 dark:text-white inline-flex items-center gap-2">
          <span>目标池数据完备性</span>
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[11px] font-semibold text-slate-500 dark:border-border-dark dark:text-slate-300 cursor-help"
            title={COMPLETENESS_DEFINITION_TOOLTIP}
            aria-label={COMPLETENESS_DEFINITION_TOOLTIP}
          >
            ?
          </span>
        </h3>
        <div className="flex items-center gap-2">
          <props.Button
            variant="secondary"
            size="sm"
            icon="refresh"
            onClick={() => {
              void refreshOverview();
              if (statusPanelExpanded) {
                void refreshStatusRows();
              }
            }}
            disabled={loading || statusLoading || materializing}
          >
            刷新
          </props.Button>
          <props.Button
            variant="primary"
            size="sm"
            icon="play_arrow"
            onClick={handleRunMaterialization}
            disabled={materializing}
          >
            执行物化
          </props.Button>
        </div>
      </div>

      <div className="rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark p-3">
        <div className="overflow-x-auto pb-1">
          <div className="min-w-max flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span className={`font-semibold ${topStatusSummary.labelTone}`}>
              健康状态：{topStatusSummary.label}
            </span>
            <span>提示：{topStatusSummary.message}</span>
            <span className="text-slate-400 dark:text-slate-500">|</span>
            <span>统计日期：{topStatusSummary.asOfLabel}</span>
            <span className="text-slate-400 dark:text-slate-500">|</span>
            <span>延迟：{topStatusSummary.delayLabel}</span>
            <span className="text-slate-400 dark:text-slate-500">|</span>
            <span>规模：{topStatusSummary.scaleLabel}</span>
          </div>
        </div>

        <div className="mt-3 border-t border-slate-200/70 dark:border-border-dark/70 pt-3">
          {renderCoverageSection("target_pool", targetCoverage)}
        </div>

        <div className="mt-3 border-t border-slate-200/70 dark:border-border-dark/70 pt-3">
          {renderCoverageSection("source_pool", sourceCoverage)}
        </div>

        <div className="mt-3 border-t border-slate-200/70 dark:border-border-dark/70 pt-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                Target checks（可编辑）
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 ${
                  matrixDirty
                    ? "border-amber-300 text-amber-700 dark:text-amber-300"
                    : "border-emerald-300 text-emerald-700 dark:text-emerald-300"
                }`}
              >
                {matrixDirty ? "草稿未保存" : "已同步"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <props.Button
                variant="secondary"
                size="sm"
                icon="restart_alt"
                onClick={() => setConfig(savedConfig)}
                disabled={!matrixDirty || saving || !savedConfig}
              >
                重置
              </props.Button>
              <props.Button
                variant="primary"
                size="sm"
                icon="save"
                onClick={handleSaveConfig}
                disabled={!matrixDirty || saving || !config}
              >
                保存
              </props.Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {targetChecks.map((check) => {
              const enabled = targetEnabledCheckIdSet.has(check.id);
              return (
                <button
                  key={`target-check-${check.id}`}
                  type="button"
                  onClick={() => handleToggleTargetCheck(check.id)}
                  className={`rounded-md border px-2.5 py-2 text-left text-xs ${
                    enabled
                      ? "border-primary/40 bg-primary/12 text-slate-800 dark:text-slate-100"
                      : "border-slate-200/80 dark:border-border-dark/70 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  <div className="font-semibold">{check.label}</div>
                  <div className="mt-0.5 text-[11px] opacity-75">
                    {formatBucketLabel(check.bucketId)} · {check.moduleId ?? "--"}
                  </div>
                  <div className="mt-0.5 font-mono opacity-75">{check.id}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 border-t border-slate-200/70 dark:border-border-dark/70 pt-3 space-y-2">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            Source checks（只读，来源于 Source Center 配置）
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {sourceModuleRows.map((row) => (
              <div
                key={`source-check-${row.id}`}
                className="rounded-md border border-slate-200/80 dark:border-border-dark/70 px-2.5 py-2 text-xs"
              >
                <div className="font-semibold text-slate-700 dark:text-slate-200">{row.label}</div>
                <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {row.bucket} · {row.domain} · {row.module}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  {row.id}
                </div>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Source checks 在本面板只读，配置入口在 Source Center。
          </div>
        </div>

        <div className="mt-3 border-t border-slate-200/70 dark:border-border-dark/70 pt-3 space-y-2">
          <button
            type="button"
            onClick={() => setStatusPanelExpanded((prev) => !prev)}
            className="w-full flex items-center justify-between text-left"
            aria-label={statusPanelExpanded ? "收起状态明细" : "展开状态明细"}
            title={statusPanelExpanded ? "收起状态明细" : "展开状态明细"}
          >
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              状态明细
            </span>
            <span className="material-icons-outlined text-sm text-slate-500 dark:text-slate-400">
              {statusPanelExpanded ? "expand_less" : "expand_more"}
            </span>
          </button>

          {statusPanelExpanded ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <props.PopoverSelect
                  value={scopeFilter}
                  onChangeValue={(value: string) => setScopeFilter(value as ScopeFilter)}
                  options={[
                    { value: "all", label: "全部范围" },
                    { value: "target_pool", label: "目标消费" },
                    { value: "source_pool", label: "数据源供给" }
                  ]}
                  className="w-[180px]"
                  buttonClassName="h-8 text-xs"
                />
                <props.PopoverSelect
                  value={checkFilter}
                  onChangeValue={(value: string) => setCheckFilter(value as CheckFilter)}
                  options={checkFilterOptions}
                  className="w-[300px]"
                  buttonClassName="h-8 text-xs"
                />
                <props.PopoverSelect
                  value={statusFilter}
                  onChangeValue={(value: string) => setStatusFilter(value as StatusFilter)}
                  options={STATUS_FILTER_OPTIONS}
                  className="w-[200px]"
                  buttonClassName="h-8 text-xs"
                />
                <props.Button
                  variant="secondary"
                  size="sm"
                  icon="refresh"
                  onClick={() => void refreshStatusRows()}
                  disabled={statusLoading}
                >
                  刷新状态
                </props.Button>
              </div>

              {statusLoading && (
                <div className="text-xs text-slate-500 dark:text-slate-400">加载中...</div>
              )}
              {!statusLoading && (
                <div className="max-h-[360px] overflow-auto rounded-md border border-slate-200/70 dark:border-border-dark/70">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-white dark:bg-background-dark">
                      <tr className="border-b border-slate-200/70 dark:border-border-dark/70 text-slate-500 dark:text-slate-400">
                        <th className="px-2 py-1.5 text-left font-semibold">Scope</th>
                        <th className="px-2 py-1.5 text-left font-semibold">Check</th>
                        <th className="px-2 py-1.5 text-left font-semibold">Entity</th>
                        <th className="px-2 py-1.5 text-left font-semibold">Bucket</th>
                        <th className="px-2 py-1.5 text-left font-semibold">Status</th>
                        <th className="px-2 py-1.5 text-right font-semibold">Coverage</th>
                        <th className="px-2 py-1.5 text-left font-semibold">As Of</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(statusRows?.items ?? []).map((item) => (
                        <tr
                          key={`${item.scopeId}-${item.checkId}-${item.entityType}-${item.entityId}`}
                          className="border-b border-slate-200/70 dark:border-border-dark/70 last:border-b-0"
                        >
                          <td className="px-2 py-1.5 text-slate-700 dark:text-slate-200">
                            {formatScopeLabel(item.scopeId)}
                          </td>
                          <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300">
                            {item.checkId}
                          </td>
                          <td className="px-2 py-1.5 font-mono text-slate-700 dark:text-slate-200">
                            {item.entityId}
                          </td>
                          <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300">
                            {formatBucketLabel(item.bucketId)}
                          </td>
                          <td className="px-2 py-1.5">
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 ${statusToneClass(
                                item.status
                              )}`}
                            >
                              {formatStatusLabel(item.status)}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-right font-mono text-slate-700 dark:text-slate-200">
                            {item.coverageRatio === null
                              ? "--"
                              : `${(item.coverageRatio * 100).toFixed(1)}%`}
                          </td>
                          <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300">
                            {item.asOfTradeDate ? props.formatCnDate(item.asOfTradeDate) : "--"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!statusRows || statusRows.items.length === 0 ? (
                    <div className="px-3 py-6 text-xs text-slate-500 dark:text-slate-400">
                      暂无状态数据。
                    </div>
                  ) : null}
                </div>
              )}

              {!statusLoading && statusRows ? (
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  展示 {statusRows.items.length} / {statusRows.total}
                </div>
              ) : null}
            </>
          ) : (
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              默认收起，展开后可按 scope/check/status 排查缺口。
            </div>
          )}
        </div>

        {(error || notice) && (
          <div
            className={`mt-3 border-t pt-2 text-xs ${
              error
                ? "border-rose-200 text-rose-700 dark:border-rose-900/60 dark:text-rose-300"
                : "border-emerald-200 text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-300"
            }`}
          >
            {error ?? notice}
          </div>
        )}

        {loading && (
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            完备性面板加载中...
          </div>
        )}
      </div>
    </section>
  );
}
