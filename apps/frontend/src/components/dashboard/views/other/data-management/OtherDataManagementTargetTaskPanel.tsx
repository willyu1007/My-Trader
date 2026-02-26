import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type {
  CompletenessScopeId,
  CompletenessStatus,
  ListCompletenessStatusResult,
  MarketCompletenessConfig,
  PreviewCompletenessCoverageResult
} from "@mytrader/shared";

import type { OtherViewProps } from "../../OtherView";

type StatusFilter = "all" | CompletenessStatus;
type CheckFilter = "all" | string;
type MultiSelectOption = { value: string; label: string };
const CHECK_TAG_SLOT_COUNT = 3;
const STATUS_PAGE_SIZE = 50;
const STATUS_KEYWORD_DEBOUNCE_MS = 250;

const STATUS_ORDER: CompletenessStatus[] = [
  "complete",
  "partial",
  "missing",
  "not_applicable"
];

const STATUS_FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "全部状态" },
  { value: "complete", label: "完整" },
  { value: "partial", label: "部分缺失" },
  { value: "missing", label: "缺失" },
  { value: "not_applicable", label: "不适用" }
];

export type OtherDataManagementTargetTaskPanelProps = Pick<
  OtherViewProps,
  "Button" | "Input" | "Modal" | "PopoverSelect" | "formatCnDate"
> & {
  mode?: "management" | "status";
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || "未知错误。";
  if (typeof error === "string") return error;
  return "未知错误。";
}

function formatScopeLabel(scopeId: CompletenessScopeId): string {
  return scopeId === "target_pool" ? "目标池数据完备性" : "数据源供给完备性";
}

function formatBucketLabel(bucketId: string): string {
  if (bucketId === "stock") return "股票";
  if (bucketId === "etf") return "ETF";
  if (bucketId === "futures") return "期货";
  if (bucketId === "spot") return "现货";
  if (bucketId === "index") return "指数";
  if (bucketId === "fx") return "外汇";
  if (bucketId === "macro") return "宏观";
  if (bucketId === "global") return "跨资产/其他";
  return bucketId;
}

function formatStatusLabel(status: CompletenessStatus): string {
  if (status === "complete") return "完整";
  if (status === "partial") return "部分缺失";
  if (status === "missing") return "缺失";
  if (status === "not_started") return "缺失";
  return "不适用";
}

function statusToneClass(status: CompletenessStatus): string {
  if (status === "complete") return "border-emerald-300 text-emerald-700 dark:text-emerald-300";
  if (status === "partial") return "border-amber-300 text-amber-700 dark:text-amber-300";
  if (status === "missing") return "border-rose-300 text-rose-700 dark:text-rose-300";
  if (status === "not_started") return "border-rose-300 text-rose-700 dark:text-rose-300";
  return "border-slate-300 text-slate-600 dark:border-border-dark dark:text-slate-300";
}

function resolveStatusCountFromCoverage(
  coverage: PreviewCompletenessCoverageResult | null,
  status: CompletenessStatus
): number {
  if (!coverage) return 0;
  if (status === "complete") return coverage.totals.complete;
  if (status === "partial") return coverage.totals.partial;
  if (status === "missing") return coverage.totals.missing + coverage.totals.notStarted;
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
  if (status === "missing") return bucket.missing + bucket.notStarted;
  if (status === "not_started") return bucket.notStarted;
  return bucket.notApplicable;
}

function resolveTotalCountFromCoverage(
  coverage: PreviewCompletenessCoverageResult | null
): number {
  if (!coverage) return 0;
  return (
    coverage.totals.complete +
    coverage.totals.partial +
    coverage.totals.missing +
    coverage.totals.notStarted +
    coverage.totals.notApplicable
  );
}

function resolveTotalCountFromBucket(
  bucket: PreviewCompletenessCoverageResult["byBucket"][number] | null
): number {
  if (!bucket) return 0;
  return bucket.complete + bucket.partial + bucket.missing + bucket.notStarted + bucket.notApplicable;
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

type CoverageSummary = {
  label: string;
  labelTone: string;
  metricTone: string;
  summary: string;
  scaleLabel: string;
  dateLabel: string;
};

function buildCoverageSummary(
  coverageLoaded: boolean,
  coverage: PreviewCompletenessCoverageResult | null,
  formatCnDate: (date: string) => string
): CoverageSummary {
  const totals = coverage?.totals;
  const missing = totals?.missing ?? 0;
  const pending = (totals?.partial ?? 0) + (totals?.notStarted ?? 0);
  const applicable =
    (totals?.complete ?? 0) +
    (totals?.partial ?? 0) +
    (totals?.missing ?? 0) +
    (totals?.notStarted ?? 0);
  const delayDays = resolveDelayDays(coverage?.asOfTradeDate ?? null);
  const asOfLabel = coverage?.asOfTradeDate ? formatCnDate(coverage.asOfTradeDate) : "--";
  const delayLabel = delayDays === null ? "--" : `${delayDays} 天`;

  if (!coverageLoaded) {
    return {
      label: "待加载",
      labelTone: "text-slate-600 dark:text-slate-300",
      metricTone: "text-slate-600 dark:text-slate-300",
      summary: "点击“刷新”加载完备性状态",
      scaleLabel: "--",
      dateLabel: "截至 --（延迟 --）"
    };
  }

  if (missing > 0) {
    const missingRatio = applicable > 0 ? missing / applicable : 0;
    return {
      label: "高风险",
      labelTone: "text-rose-700 dark:text-rose-300",
      metricTone: "text-rose-700 dark:text-rose-300",
      summary: `缺失 ${missing.toLocaleString()} 项（${formatPercent(missingRatio)}）`,
      scaleLabel: `${(totals?.entities ?? 0).toLocaleString()} 实体 × ${(totals?.checks ?? 0).toLocaleString()} 检查`,
      dateLabel: `截至 ${asOfLabel}（延迟 ${delayLabel}）`
    };
  }

  if (pending > 0) {
    const pendingRatio = applicable > 0 ? pending / applicable : 0;
    return {
      label: "需关注",
      labelTone: "text-amber-700 dark:text-amber-300",
      metricTone: "text-amber-700 dark:text-amber-300",
      summary: `待收敛 ${pending.toLocaleString()} 项（${formatPercent(pendingRatio)}）`,
      scaleLabel: `${(totals?.entities ?? 0).toLocaleString()} 实体 × ${(totals?.checks ?? 0).toLocaleString()} 检查`,
      dateLabel: `截至 ${asOfLabel}（延迟 ${delayLabel}）`
    };
  }

  return {
    label: "健康",
    labelTone: "text-emerald-700 dark:text-emerald-300",
    metricTone: "text-emerald-700 dark:text-emerald-300",
    summary: "无缺失与待收敛项（100.0%）",
    scaleLabel: `${(totals?.entities ?? 0).toLocaleString()} 实体 × ${(totals?.checks ?? 0).toLocaleString()} 检查`,
    dateLabel: `截至 ${asOfLabel}（延迟 ${delayLabel}）`
  };
}

function resolveDelayDays(asOfTradeDate: string | null): number | null {
  if (!asOfTradeDate) return null;
  const asOfEpoch = Date.parse(`${asOfTradeDate}T00:00:00Z`);
  if (!Number.isFinite(asOfEpoch)) return null;
  const nowEpoch = Date.now();
  const diffDays = Math.floor((nowEpoch - asOfEpoch) / (24 * 60 * 60 * 1000));
  return Math.max(0, diffDays);
}

type UiApplicationTag = {
  label: string;
  domain: string;
  feature: string;
};

function resolveUsageContexts(
  check: MarketCompletenessConfig["checks"][number]
): string[] {
  const explicit = Array.isArray(check.usageContexts)
    ? check.usageContexts
        .map((item) => String(item).trim())
        .filter(Boolean)
    : [];
  return explicit.length > 0
    ? Array.from(new Set(explicit))
    : ["目标池完备性评估"];
}

function parseUiApplicationTag(value: string): UiApplicationTag {
  const normalized = String(value).trim();
  if (!normalized) {
    return {
      label: "数据分析-通用消费",
      domain: "数据分析",
      feature: "通用消费"
    };
  }
  const separatorIndex = normalized.indexOf("-");
  if (separatorIndex <= 0 || separatorIndex >= normalized.length - 1) {
    return {
      label: normalized,
      domain: normalized,
      feature: "通用消费"
    };
  }
  return {
    label: normalized,
    domain: normalized.slice(0, separatorIndex).trim(),
    feature: normalized.slice(separatorIndex + 1).trim()
  };
}

function resolveUiApplications(
  check: MarketCompletenessConfig["checks"][number]
): UiApplicationTag[] {
  const values = Array.isArray(check.uiApplications)
    ? check.uiApplications
        .map((item) => String(item).trim())
        .filter(Boolean)
    : [];
  const deduped = values.length > 0 ? Array.from(new Set(values)) : ["数据分析-通用消费"];
  return deduped.map((item) => parseUiApplicationTag(item));
}

function resolveUsageContextDescription(
  tooltips: Record<string, string> | undefined,
  usage: string
): string {
  const value = tooltips?.[usage];
  if (typeof value === "string" && value.trim()) return value;
  return `${usage}：用于目标池完备性评估与下游任务消费。`;
}

function resolveUiApplicationDescription(
  tooltips: Record<string, string> | undefined,
  tag: UiApplicationTag
): string {
  const value = tooltips?.[tag.label];
  if (typeof value === "string" && value.trim()) return value;
  return `${tag.domain}：用于${tag.feature}场景消费该检查项数据。`;
}

function splitToTagSlots<T>(items: T[], maxSlots: number): {
  visibleItems: T[];
  overflowItems: T[];
  overflowCount: number;
} {
  if (maxSlots <= 0) {
    return {
      visibleItems: [],
      overflowItems: [...items],
      overflowCount: items.length
    };
  }
  if (items.length <= maxSlots) {
    return {
      visibleItems: [...items],
      overflowItems: [],
      overflowCount: 0
    };
  }
  const visibleCount = Math.max(1, maxSlots - 1);
  const visibleItems = items.slice(0, visibleCount);
  const overflowItems = items.slice(visibleCount);
  return {
    visibleItems,
    overflowItems,
    overflowCount: overflowItems.length
  };
}

function hasTargetCheckConfigChanged(
  left: MarketCompletenessConfig | null,
  right: MarketCompletenessConfig | null
): boolean {
  if (!left || !right) return false;
  if (left.defaultLookbackDays !== right.defaultLookbackDays) return true;
  if (left.targetEnabledCheckIds.length !== right.targetEnabledCheckIds.length) return true;
  return left.targetEnabledCheckIds.some((item, index) => item !== right.targetEnabledCheckIds[index]);
}

function MultiSelectFilter({
  label,
  options,
  selectedValues,
  onChangeValues,
  disabled,
  className,
  buttonClassName,
  showLabelPrefix = true
}: {
  label: string;
  options: MultiSelectOption[];
  selectedValues: string[];
  onChangeValues: (values: string[]) => void;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  showLabelPrefix?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);
  const [menuLayout, setMenuLayout] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const buttonLabel = useMemo(() => {
    if (selectedValues.length === 0) {
      return showLabelPrefix ? `${label}：全部` : "全部";
    }
    if (selectedValues.length === 1) {
      const one = options.find((item) => item.value === selectedValues[0]);
      const single = one?.label ?? selectedValues[0];
      return showLabelPrefix ? `${label}：${single}` : single;
    }
    const multi = `已选 ${selectedValues.length} 项`;
    return showLabelPrefix ? `${label}：${multi}` : multi;
  }, [label, options, selectedValues, showLabelPrefix]);

  const selectAll = useCallback(() => {
    onChangeValues(options.map((item) => item.value));
  }, [onChangeValues, options]);

  const clearAll = useCallback(() => {
    onChangeValues([]);
  }, [onChangeValues]);

  const toggleValue = useCallback(
    (value: string) => {
      const next = new Set(selectedSet);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      const ordered = options
        .map((item) => item.value)
        .filter((item) => next.has(item));
      onChangeValues(ordered);
    },
    [onChangeValues, options, selectedSet]
  );

  useEffect(() => {
    if (!open) return;
    const updateLayout = () => {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const desiredHeight = 288;
      const gutter = 8;
      const offset = 6;
      const spaceBelow = viewportHeight - rect.bottom - gutter;
      const spaceAbove = rect.top - gutter;
      const openUpward =
        spaceBelow < 220 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(
        140,
        Math.min(desiredHeight, openUpward ? spaceAbove - offset : spaceBelow - offset)
      );
      const top = openUpward
        ? Math.max(gutter, rect.top - maxHeight - offset)
        : Math.min(viewportHeight - maxHeight - gutter, rect.bottom + offset);
      const left = Math.min(
        Math.max(gutter, rect.left),
        Math.max(gutter, viewportWidth - rect.width - gutter)
      );
      const width = Math.min(rect.width, viewportWidth - left - gutter);
      setMenuLayout({
        top,
        left,
        width,
        maxHeight
      });
    };
    updateLayout();
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onScrollOrResize = () => updateLayout();
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled || options.length === 0}
        onClick={() => setOpen((prev) => !prev)}
        className={`ui-popover-button relative h-8 w-full rounded-md border pl-2 pr-8 text-left text-xs transition-colors disabled:opacity-60 ${
          buttonClassName ?? ""
        }`}
      >
        <span className="block truncate">{buttonLabel}</span>
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 material-icons-outlined text-[18px] text-slate-400">
          expand_more
        </span>
      </button>

      {open && menuLayout
        ? createPortal(
            <div
              ref={menuRef}
              className="z-[80]"
              style={{
                position: "fixed",
                top: `${menuLayout.top}px`,
                left: `${menuLayout.left}px`,
                width: `${menuLayout.width}px`
              }}
            >
              <div
                className="ui-popover-menu rounded-md border p-1 overflow-auto shadow-lg"
                style={{ maxHeight: `${menuLayout.maxHeight}px` }}
              >
                <div className="px-1 pb-1 mb-1 border-b border-slate-200/70 dark:border-border-dark/70 inline-flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                  >
                    全选
                  </button>
                  <span className="text-slate-400 dark:text-slate-500">|</span>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                  >
                    清空
                  </button>
                </div>
                {options.map((option) => (
                  <label
                    key={option.value}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-slate-100/70 dark:hover:bg-surface-dark cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSet.has(option.value)}
                      onChange={() => toggleValue(option.value)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary/50"
                    />
                    <span className="truncate text-slate-700 dark:text-slate-200">
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

export function OtherDataManagementTargetTaskPanel(
  props: OtherDataManagementTargetTaskPanelProps
) {
  const panelMode = props.mode ?? "management";
  const isStatusPanel = panelMode === "status";
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

  const [checkFilter, setCheckFilter] = useState<CheckFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [detailScopeId, setDetailScopeId] = useState<CompletenessScopeId | null>(null);
  const [statusKeywordInput, setStatusKeywordInput] = useState("");
  const [statusKeyword, setStatusKeyword] = useState("");
  const [statusOnlyExceptions, setStatusOnlyExceptions] = useState(false);
  const [statusPage, setStatusPage] = useState(0);
  const [targetBucketFilters, setTargetBucketFilters] = useState<string[]>([]);
  const [targetApplicationDomainFilters, setTargetApplicationDomainFilters] = useState<string[]>([]);

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

  const refreshStatusRows = useCallback(async (scopeId: CompletenessScopeId | null = detailScopeId) => {
    if (!window.mytrader || !scopeId) return;
    setStatusLoading(true);
    try {
      const rows = await window.mytrader.market.listCompletenessStatus({
        scopeId,
        checkId: checkFilter === "all" ? null : checkFilter,
        status: statusFilter === "all" ? null : statusFilter,
        keyword: statusKeyword.trim() ? statusKeyword.trim() : null,
        keywordFields: ["entity", "check", "module"],
        onlyExceptions: statusOnlyExceptions,
        sortBy: "updatedAt",
        sortOrder: "desc",
        limit: STATUS_PAGE_SIZE,
        offset: statusPage * STATUS_PAGE_SIZE
      });
      setStatusRows(rows);
      setError(null);
    } catch (err) {
      setStatusRows(null);
      setError(toErrorMessage(err));
    } finally {
      setStatusLoading(false);
    }
  }, [
    checkFilter,
    detailScopeId,
    statusFilter,
    statusKeyword,
    statusOnlyExceptions,
    statusPage
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = statusKeywordInput.trim();
      setStatusKeyword((prev) => {
        if (prev === next) return prev;
        setStatusPage(0);
        return next;
      });
    }, STATUS_KEYWORD_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [statusKeywordInput]);

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
    if (!detailScopeId) return;
    void refreshStatusRows(detailScopeId);
  }, [detailScopeId, refreshStatusRows]);

  const targetChecks = useMemo(() => {
    if (!config) return [];
    return config.checks
      .filter((check) => check.scopeId === "target_pool")
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [config]);

  const targetEnabledCheckIdSet = useMemo(
    () => new Set(config?.targetEnabledCheckIds ?? []),
    [config?.targetEnabledCheckIds]
  );

  const detailCheckFilterOptions = useMemo(() => {
    const allChecks = (config?.checks ?? []).filter((check) =>
      detailScopeId ? check.scopeId === detailScopeId : true
    );
    return [
      { value: "all", label: "全部检查项" },
      ...allChecks.map((check) => ({
        value: check.id,
        label: check.label
      }))
    ];
  }, [config?.checks, detailScopeId]);

  const targetBucketFilterOptions = useMemo<MultiSelectOption[]>(() => {
    const unique = Array.from(new Set(targetChecks.map((check) => check.bucketId)));
    return unique
      .sort((a, b) => formatBucketLabel(a).localeCompare(formatBucketLabel(b)))
      .map((bucketId) => ({
        value: bucketId,
        label: formatBucketLabel(bucketId)
      }));
  }, [targetChecks]);

  const targetApplicationDomainFilterOptions = useMemo<MultiSelectOption[]>(() => {
    const domainSet = new Set<string>();
    targetChecks.forEach((check) => {
      resolveUiApplications(check).forEach((application) => domainSet.add(application.domain));
    });
    return Array.from(domainSet.values())
      .sort((a, b) => a.localeCompare(b))
      .map((domain) => ({ value: domain, label: domain }));
  }, [targetChecks]);

  const targetCheckRows = useMemo(() => {
    const bucketFilterSet =
      targetBucketFilters.length > 0 ? new Set(targetBucketFilters) : null;
    const applicationDomainFilterSet =
      targetApplicationDomainFilters.length > 0 ? new Set(targetApplicationDomainFilters) : null;
    return targetChecks
      .map((check) => ({
        check,
        usageContexts: resolveUsageContexts(check),
        uiApplications: resolveUiApplications(check),
        usageContextTooltips: check.usageContextTooltips,
        uiApplicationTooltips: check.uiApplicationTooltips
      }))
      .filter((row) => {
        if (bucketFilterSet && !bucketFilterSet.has(row.check.bucketId)) return false;
        if (
          applicationDomainFilterSet &&
          !row.uiApplications.some((application) => applicationDomainFilterSet.has(application.domain))
        ) {
          return false;
        }
        return true;
      });
  }, [targetApplicationDomainFilters, targetBucketFilters, targetChecks]);

  useEffect(() => {
    if (!window.mytrader || !config || !savedConfig || saving) return;
    if (!hasTargetCheckConfigChanged(config, savedConfig)) return;
    const timer = window.setTimeout(() => {
      if (!window.mytrader) return;
      const draft = config;
      const rollback = savedConfig;
      setSaving(true);
      setError(null);
      setNotice(null);
      window.mytrader.market
        .setCompletenessConfig({
          defaultLookbackDays: draft.defaultLookbackDays,
          targetEnabledCheckIds: draft.targetEnabledCheckIds
        })
        .then(async (saved) => {
          setConfig(saved);
          setSavedConfig(saved);
          setNotice("配置已更新。");
          if (coverageLoaded) {
            await refreshCoverage();
          }
          if (detailScopeId) {
            await refreshStatusRows(detailScopeId);
          }
        })
        .catch((err) => {
          setError(toErrorMessage(err));
          setConfig(rollback);
        })
        .finally(() => {
          setSaving(false);
        });
    }, 280);
    return () => window.clearTimeout(timer);
  }, [
    config,
    coverageLoaded,
    refreshCoverage,
    refreshStatusRows,
    savedConfig,
    saving,
    detailScopeId
  ]);

  const targetStatusSummary = useMemo(
    () => buildCoverageSummary(coverageLoaded, targetCoverage, props.formatCnDate),
    [coverageLoaded, props.formatCnDate, targetCoverage]
  );

  const sourceStatusSummary = useMemo(
    () => buildCoverageSummary(coverageLoaded, sourceCoverage, props.formatCnDate),
    [coverageLoaded, props.formatCnDate, sourceCoverage]
  );

  const handleToggleTargetCheck = useCallback((checkId: string) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const enabled = new Set(prev.targetEnabledCheckIds);
      if (enabled.has(checkId)) {
        if (enabled.size <= 1) {
          setError("目标检查项至少启用一项。");
          return prev;
        }
        enabled.delete(checkId);
      } else {
        enabled.add(checkId);
      }
      setError(null);
      setNotice(null);
      return {
        ...prev,
        targetEnabledCheckIds: targetChecks
          .map((check) => check.id)
          .filter((id) => enabled.has(id))
      };
    });
  }, [targetChecks]);

  const handleRunMaterialization = useCallback(async () => {
    if (!window.mytrader) return;
    setMaterializing(true);
    setError(null);
    setNotice(null);
    try {
      await window.mytrader.market.runCompletenessMaterialization({
        scopeId: "target_pool"
      });
      await refreshCoverage();
      if (detailScopeId === "target_pool") {
        await refreshStatusRows("target_pool");
      }
      setNotice("目标池完备性已写入并刷新。");
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setMaterializing(false);
    }
  }, [detailScopeId, refreshCoverage, refreshStatusRows]);

  const openStatusDetailModal = useCallback(async (scopeId: CompletenessScopeId) => {
    const mytrader = window.mytrader;
    if (!mytrader) return;
    setDetailScopeId(scopeId);
    setCheckFilter("all");
    setStatusFilter("all");
    setStatusOnlyExceptions(false);
    setStatusKeywordInput("");
    setStatusKeyword("");
    setStatusPage(0);
    setStatusRows(null);
    setStatusLoading(true);
    setError(null);
    try {
      if (scopeId === "source_pool") {
        const probe = await mytrader.market.listCompletenessStatus({
          scopeId: "source_pool",
          checkId: null,
          status: null,
          keyword: null,
          keywordFields: ["entity", "check", "module"],
          onlyExceptions: false,
          sortBy: "updatedAt",
          sortOrder: "desc",
          limit: 1,
          offset: 0
        });
        if (probe.total <= 0) {
          setNotice("供给状态首次写入中，请稍候…");
          await mytrader.market.runCompletenessMaterialization({
            scopeId: "source_pool"
          });
          await refreshCoverage();
        }
      }
      const rows = await mytrader.market.listCompletenessStatus({
        scopeId,
        checkId: null,
        status: null,
        keyword: null,
        keywordFields: ["entity", "check", "module"],
        onlyExceptions: false,
        sortBy: "updatedAt",
        sortOrder: "desc",
        limit: STATUS_PAGE_SIZE,
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
  }, [refreshCoverage]);

  const renderCoverageSection = useCallback(
    (
      scopeId: CompletenessScopeId,
      coverage: PreviewCompletenessCoverageResult | null,
      options?: { showTitle?: boolean }
    ) => {
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
        if (a === "global" && b !== "global") return 1;
        if (b === "global" && a !== "global") return -1;
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
          {options?.showTitle === false ? null : (
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {formatScopeLabel(scopeId)}
            </div>
          )}

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
                        const total = column.bucketId
                          ? resolveTotalCountFromBucket(bucket)
                          : resolveTotalCountFromCoverage(coverage);
                        const statusRate = total > 0 ? value / total : null;
                        return (
                          <td
                            key={`${scopeId}-matrix-${status}-${column.key}`}
                            className="px-2 py-1.5 text-right font-mono text-slate-700 dark:text-slate-200"
                          >
                            <span>
                              {value.toLocaleString()} /{" "}
                              <span
                                className={
                                  status === "complete"
                                    ? completeRateToneClass(statusRate)
                                    : "text-slate-500 dark:text-slate-400"
                                }
                              >
                                {statusRate === null ? "--" : formatPercent(statusRate)}
                              </span>
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="border-t border-slate-300/70 dark:border-border-dark/80">
                    <td className="w-20 min-w-[80px] px-2 py-1.5 font-semibold text-slate-700 dark:text-slate-200">
                      总数
                    </td>
	                    {columns.map((column) => {
	                      const bucket = column.bucketId ? byBucketMap.get(column.bucketId) ?? null : null;
	                      const total = column.bucketId
	                        ? resolveTotalCountFromBucket(bucket)
	                        : resolveTotalCountFromCoverage(coverage);
	                      return (
	                        <td
	                          key={`${scopeId}-matrix-total-${column.key}`}
	                          className="px-2 py-1.5 text-right font-mono font-semibold text-slate-700 dark:text-slate-200"
	                        >
	                          {total.toLocaleString()}
	                        </td>
	                      );
	                    })}
	                  </tr>
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

  const statusTotalPages = useMemo(() => {
    const total = statusRows?.total ?? 0;
    return Math.max(1, Math.ceil(total / STATUS_PAGE_SIZE));
  }, [statusRows?.total]);

  const statusPageStart = useMemo(() => {
    if (!statusRows || statusRows.total <= 0) return 0;
    return statusRows.offset + 1;
  }, [statusRows]);

  const statusPageEnd = useMemo(() => {
    if (!statusRows || statusRows.total <= 0) return 0;
    return statusRows.offset + statusRows.items.length;
  }, [statusRows]);

  return (
    <section className="space-y-3">
      {isStatusPanel ? (
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900 dark:text-white">完备性状态</h3>
          <div className="flex items-center gap-2">
            <props.Button
              variant="secondary"
              size="sm"
              icon="refresh"
              onClick={() => {
                void refreshOverview();
                if (detailScopeId) {
                  void refreshStatusRows(detailScopeId);
                }
              }}
              disabled={loading || statusLoading || materializing}
            >
              刷新
            </props.Button>
	            <props.Button
	              variant="primary"
	              size="sm"
	              icon="save"
	              onClick={handleRunMaterialization}
	              disabled={materializing}
	            >
	              写入
	            </props.Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900 dark:text-white">目标检查项</h3>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            展示 {targetCheckRows.length} / {targetChecks.length}
          </div>
        </div>
      )}

      {isStatusPanel ? (
        <div className="space-y-3">
          <section className="rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                数据源供给完备性
              </span>
              <props.Button
                variant="secondary"
                size="sm"
                onClick={() => void openStatusDetailModal("source_pool")}
                disabled={statusLoading}
                className="!px-2 !py-1 !text-[11px] !font-normal !bg-transparent !border-slate-200/70 !text-slate-700 hover:!bg-slate-50 dark:!border-border-dark/70 dark:!text-slate-200 dark:hover:!bg-surface-dark"
              >
                查看供给详情
              </props.Button>
            </div>
            <div className="overflow-x-auto pb-1">
              <div className="min-w-max flex flex-nowrap items-center gap-3 whitespace-nowrap text-xs leading-5 text-slate-600 dark:text-slate-300">
                <span className={`whitespace-nowrap font-semibold ${sourceStatusSummary.labelTone}`}>
                  [{sourceStatusSummary.label}]
                </span>
                <span className={`whitespace-nowrap tabular-nums ${sourceStatusSummary.metricTone}`}>
                  {sourceStatusSummary.summary}
                </span>
                <span className="text-slate-400 dark:text-slate-500">|</span>
                <span className="tabular-nums text-slate-600 dark:text-slate-300">
                  {sourceStatusSummary.scaleLabel}
                </span>
                <span className="text-slate-400 dark:text-slate-500">|</span>
                <span className="tabular-nums text-slate-500 dark:text-slate-400">
                  {sourceStatusSummary.dateLabel}
                </span>
              </div>
            </div>
            {renderCoverageSection("source_pool", sourceCoverage, { showTitle: false })}
          </section>

          <section className="rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                目标池数据完备性
              </span>
              <props.Button
                variant="secondary"
                size="sm"
                onClick={() => void openStatusDetailModal("target_pool")}
                disabled={statusLoading}
                className="!px-2 !py-1 !text-[11px] !font-normal !bg-transparent !border-slate-200/70 !text-slate-700 hover:!bg-slate-50 dark:!border-border-dark/70 dark:!text-slate-200 dark:hover:!bg-surface-dark"
              >
                查看目标详情
              </props.Button>
            </div>
            <div className="overflow-x-auto pb-1">
              <div className="min-w-max flex flex-nowrap items-center gap-3 whitespace-nowrap text-xs leading-5 text-slate-600 dark:text-slate-300">
                <span className={`whitespace-nowrap font-semibold ${targetStatusSummary.labelTone}`}>
                  [{targetStatusSummary.label}]
                </span>
                <span className={`whitespace-nowrap tabular-nums ${targetStatusSummary.metricTone}`}>
                  {targetStatusSummary.summary}
                </span>
                <span className="text-slate-400 dark:text-slate-500">|</span>
                <span className="tabular-nums text-slate-600 dark:text-slate-300">
                  {targetStatusSummary.scaleLabel}
                </span>
                <span className="text-slate-400 dark:text-slate-500">|</span>
                <span className="tabular-nums text-slate-500 dark:text-slate-400">
                  {targetStatusSummary.dateLabel}
                </span>
              </div>
            </div>
            {renderCoverageSection("target_pool", targetCoverage, { showTitle: false })}
          </section>

          <props.Modal
            open={detailScopeId !== null}
            title={detailScopeId === "source_pool" ? "供给状态明细" : "目标状态明细"}
            onClose={() => setDetailScopeId(null)}
            sizeClassName="max-w-[1100px]"
          >
            {detailScopeId ? (
              <div className="space-y-3 min-h-[66vh]">
                <div className="flex w-full items-center gap-2">
                  <props.PopoverSelect
                    value={checkFilter}
                    onChangeValue={(value: string) => {
                      setCheckFilter(value as CheckFilter);
                      setStatusPage(0);
                    }}
                    options={detailCheckFilterOptions}
                    className="w-[220px] shrink-0"
                    buttonClassName="h-8 text-xs"
                  />
                  <props.PopoverSelect
                    value={statusFilter}
                    onChangeValue={(value: string) => {
                      setStatusFilter(value as StatusFilter);
                      setStatusPage(0);
                    }}
                    options={STATUS_FILTER_OPTIONS}
                    className="w-[160px] shrink-0"
                    buttonClassName="h-8 text-xs"
                  />
                  <span
                    aria-hidden="true"
                    className="mx-1 h-5 w-px shrink-0 bg-slate-300 dark:bg-border-dark/80"
                  />
                  <div className="min-w-[220px] flex-1">
                    <props.Input
                      value={statusKeywordInput}
                      onChange={(event) => setStatusKeywordInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        const next = statusKeywordInput.trim();
                        setStatusKeyword(next);
                        setStatusPage(0);
                      }}
                      placeholder="搜索 Entity / Check / Module"
                      className="h-8 w-full text-xs font-mono"
                    />
                  </div>
                  <div className="inline-flex shrink-0 items-center gap-1.5 pl-1 text-xs text-slate-600 dark:text-slate-300">
                    <span>仅异常</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={statusOnlyExceptions}
                        onChange={(event) => {
                          setStatusOnlyExceptions(event.target.checked);
                          setStatusPage(0);
                        }}
                        className="peer sr-only"
                        aria-label={statusOnlyExceptions ? "仅异常已开启" : "仅异常已关闭"}
                      />
                      <span className="h-5 w-10 rounded-full bg-slate-300 transition-colors peer-checked:bg-primary dark:bg-slate-600 dark:peer-checked:bg-primary/80" />
                      <span className="pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                    </label>
                  </div>
                  <props.Button
                    variant="secondary"
                    size="sm"
                    className="!px-2.5 shrink-0"
                    onClick={() => {
                      setStatusKeywordInput("");
                      setStatusKeyword("");
                      setStatusOnlyExceptions(false);
                      setStatusPage(0);
                    }}
                    disabled={statusLoading}
                  >
                    清空
                  </props.Button>
                  <props.Button
                    variant="secondary"
                    size="sm"
                    icon="refresh"
                    className="!px-2.5 shrink-0"
                    onClick={() => void refreshStatusRows(detailScopeId)}
                    disabled={statusLoading}
                  >
                    刷新
                  </props.Button>
                </div>

                <div className="relative max-h-[58vh] overflow-auto rounded-md border border-slate-200/70 dark:border-border-dark/70">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-white dark:bg-background-dark">
                      <tr className="border-b border-slate-200/70 dark:border-border-dark/70 text-slate-500 dark:text-slate-400">
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
                  {!statusLoading && (!statusRows || statusRows.items.length === 0) ? (
                    <div className="px-3 py-6 text-xs text-slate-500 dark:text-slate-400">
                      {statusOnlyExceptions
                        ? "当前仅展示异常记录；若暂无异常，可关闭“仅异常”查看全量状态。"
                        : "暂无状态数据。"}
                    </div>
                  ) : null}
                  {statusLoading ? (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/55 text-xs text-slate-500 backdrop-blur-[1px] dark:bg-surface-dark/45 dark:text-slate-300">
                      加载中...
                    </div>
                  ) : null}
                </div>

                {statusRows ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>
                      展示 {statusPageStart} - {statusPageEnd} / {statusRows.total}
                    </span>
                    <div className="inline-flex items-center gap-2">
                      <span>
                        第 {statusPage + 1} / {statusTotalPages} 页
                      </span>
                      <props.Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setStatusPage((prev) => Math.max(0, prev - 1))}
                        disabled={statusLoading || statusPage <= 0}
                      >
                        上一页
                      </props.Button>
                      <props.Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setStatusPage((prev) =>
                            Math.min(statusTotalPages - 1, prev + 1)
                          )
                        }
                        disabled={statusLoading || statusPage >= statusTotalPages - 1}
                      >
                        下一页
                      </props.Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </props.Modal>

          {(error || notice) && (
            <div
              className={`text-xs ${
                error
                  ? "text-rose-700 dark:text-rose-300"
                  : "text-emerald-700 dark:text-emerald-300"
              }`}
            >
              {error ?? notice}
            </div>
          )}

          {loading && (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              完备性面板加载中...
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="space-y-0">
            <div className="overflow-hidden">
              <div
                className="min-h-[180px] max-h-[330px] overflow-y-auto overflow-x-hidden overscroll-contain"
                style={{ scrollbarGutter: "stable both-edges" }}
              >
                <table className="w-full table-fixed text-xs">
                  <thead className="sticky top-0 bg-white dark:bg-background-dark z-10">
                    <tr className="border-b border-slate-200/70 dark:border-border-dark/70 text-slate-500 dark:text-slate-400">
                      <th className="w-[14%] px-2 py-1.5 text-left font-semibold">
                        目标名称
                      </th>
                      <th className="w-[20%] px-2 pr-4 py-1.5 text-left font-semibold">
                        <div className="inline-flex items-center justify-start gap-1.5">
                          <span>所属分类</span>
                          <MultiSelectFilter
                            label="分类"
                            options={targetBucketFilterOptions}
                            selectedValues={targetBucketFilters}
                            onChangeValues={setTargetBucketFilters}
                            disabled={saving}
                            className="w-[116px]"
                            buttonClassName="!h-7 !text-[11px]"
                            showLabelPrefix={false}
                          />
                        </div>
                      </th>
                      <th className="w-[34%] pl-1 pr-2 py-1.5 text-left font-semibold">
                        <div className="inline-flex items-center gap-1.5">
                          <span>数据应用</span>
                          <MultiSelectFilter
                            label="应用域"
                            options={targetApplicationDomainFilterOptions}
                            selectedValues={targetApplicationDomainFilters}
                            onChangeValues={setTargetApplicationDomainFilters}
                            disabled={saving}
                            className="w-[130px]"
                            buttonClassName="!h-7 !text-[11px]"
                            showLabelPrefix={false}
                          />
                        </div>
                      </th>
                      <th className="w-[23%] px-2 py-1.5 text-left font-semibold">
                        功能
                      </th>
                      <th className="w-[9%] pl-2 pr-4 py-1.5 text-left font-semibold">
                        开关
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {targetCheckRows.map((row) => {
                      const check = row.check;
                      const enabled = targetEnabledCheckIdSet.has(check.id);
                      const uiApplicationSlots = splitToTagSlots(
                        row.uiApplications,
                        CHECK_TAG_SLOT_COUNT
                      );
                      const usageContextSlots = splitToTagSlots(
                        row.usageContexts,
                        CHECK_TAG_SLOT_COUNT
                      );
                      return (
                        <tr
                          key={`target-check-row-${check.id}`}
                          className="border-b border-slate-200/70 dark:border-border-dark/70 last:border-b-0"
                        >
                          <td className="px-2 py-1.5">
                            <div className="font-semibold text-slate-700 dark:text-slate-200">
                              {check.label}
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-slate-700 dark:text-slate-200">
                            {formatBucketLabel(check.bucketId)}
                          </td>
                          <td className="pl-1 pr-2 py-1.5">
                            <div className="flex flex-wrap items-start gap-0.5">
                              {uiApplicationSlots.visibleItems.map((application) => (
                                <span
                                  key={`${check.id}-${application.label}`}
                                  data-mt-tooltip={resolveUiApplicationDescription(
                                    row.uiApplicationTooltips,
                                    application
                                  )}
                                >
                                  <span className="inline-flex w-fit max-w-full min-w-0 rounded border border-slate-200/80 dark:border-border-dark/70 px-1 py-0.5 text-[10px] leading-4 text-slate-600 dark:text-slate-300 cursor-help">
                                    <span className="block max-w-full whitespace-normal break-words">
                                      {application.label}
                                    </span>
                                  </span>
                                </span>
                              ))}
                              {uiApplicationSlots.overflowCount > 0 ? (
                                <span
                                  data-mt-tooltip={`其余 ${uiApplicationSlots.overflowCount} 项：${uiApplicationSlots.overflowItems
                                    .map((item) => item.label)
                                    .join("、")}`}
                                >
                                  <span className="inline-flex max-w-[88%] min-w-0 items-center justify-center rounded border border-slate-200/80 dark:border-border-dark/70 px-1 py-0.5 text-[10px] text-slate-500 dark:text-slate-400 cursor-help">
                                    +{uiApplicationSlots.overflowCount}
                                  </span>
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex flex-wrap items-start gap-0.5">
                              {usageContextSlots.visibleItems.map((usage) => (
                                <span
                                  key={`${check.id}-${usage}`}
                                  data-mt-tooltip={resolveUsageContextDescription(
                                    row.usageContextTooltips,
                                    usage
                                  )}
                                >
                                  <span className="inline-flex w-fit max-w-full min-w-0 rounded border border-slate-200/80 dark:border-border-dark/70 px-1 py-0.5 text-[10px] leading-4 text-slate-600 dark:text-slate-300 cursor-help">
                                    <span className="whitespace-normal break-words">{usage}</span>
                                  </span>
                                </span>
                              ))}
                              {usageContextSlots.overflowCount > 0 ? (
                                <span
                                  data-mt-tooltip={`其余 ${usageContextSlots.overflowCount} 项：${usageContextSlots.overflowItems.join(
                                    "、"
                                  )}`}
                                >
                                  <span className="inline-flex w-full min-w-0 items-center justify-center rounded border border-slate-200/80 dark:border-border-dark/70 px-1 py-0.5 text-[10px] text-slate-500 dark:text-slate-400 cursor-help">
                                    +{usageContextSlots.overflowCount}
                                  </span>
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="pl-2 pr-4 py-1.5">
                            <div className="flex items-center justify-start gap-2">
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={enabled}
                                  onChange={() => handleToggleTargetCheck(check.id)}
                                  disabled={saving}
                                  className="peer sr-only"
                                  aria-label={`${check.label}${enabled ? "：已启用" : "：已停用"}`}
                                />
                                <span className="h-5 w-10 rounded-full bg-slate-300 transition-colors peer-checked:bg-primary dark:bg-slate-600 dark:peer-checked:bg-primary/80 peer-disabled:opacity-60" />
                                <span className="pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                              </label>
                              <span
                                className={`text-[11px] ${
                                  enabled
                                    ? "text-primary"
                                    : "text-slate-500 dark:text-slate-400"
                                }`}
                              >
                                {enabled ? "启用" : "停用"}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {targetCheckRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400"
                        >
                          当前筛选条件下无匹配检查项。
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {(error || notice) && (
            <div
              className={`mt-2 text-xs ${
                error
                  ? "text-rose-700 dark:text-rose-300"
                  : "text-emerald-700 dark:text-emerald-300"
              }`}
            >
              {error ?? notice}
            </div>
          )}

          {loading && (
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              目标检查项加载中...
            </div>
          )}
        </div>
      )}
    </section>
  );
}
