import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent
} from "react";

import type {
  ManualTagSummary,
  TagSummary,
  TempTargetSymbol
} from "@mytrader/shared";

import type { OtherViewProps } from "../OtherView";

export type OtherInstrumentManagementTabProps = Pick<
  OtherViewProps,
  | "Button"
  | "Input"
  | "Modal"
  | "formatTagSourceLabel"
  | "formatDateTime"
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

const HEX_PREFIX = String.fromCharCode(35);
const DEFAULT_MANUAL_TAG_COLOR = `${HEX_PREFIX}94A3B8`;
const MANUAL_TAG_COLOR_CARDS = [
  "94A3B8",
  "64748B",
  "0EA5E9",
  "22C55E",
  "F59E0B",
  "EF4444",
  "8B5CF6",
  "EC4899"
].map((code) => `${HEX_PREFIX}${code}`);

const SOURCE_INFO_NAMESPACE_SET = new Set([
  "publisher",
  "provider",
  "source",
  "vendor",
  "data_source",
  "datasource"
]);

function splitTagLabel(tag: string): { namespace: string | null; value: string } {
  const normalized = tag.trim();
  if (!normalized.includes(":")) {
    return { namespace: null, value: normalized };
  }
  const [namespace, ...rest] = normalized.split(":");
  const value = rest.join(":").trim();
  return {
    namespace: namespace.trim() || null,
    value: value || normalized
  };
}

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function normalizeManualTagName(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.includes(":")) return null;
  return value;
}

function normalizeColor(value: string, fallback = DEFAULT_MANUAL_TAG_COLOR): string {
  const normalized = value.trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(normalized)) return fallback;
  return normalized;
}

function formatRemainingTime(expiresAt: number, now: number): string {
  const diff = expiresAt - now;
  if (!Number.isFinite(diff) || diff <= 0) return "已到期";
  const totalMinutes = Math.floor(diff / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}天${hours}小时`;
  if (hours > 0) return `${hours}小时${minutes}分钟`;
  return `${Math.max(minutes, 1)}分钟`;
}

function ColorCards({
  value,
  onChange,
  disabled = false
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const active = normalizeColor(value);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {MANUAL_TAG_COLOR_CARDS.map((card) => {
        const checked = normalizeColor(card) === active;
        return (
          <button
            key={card}
            type="button"
            className={`h-6 w-6 rounded border transition ${
              checked
                ? "border-slate-700 ring-2 ring-slate-400 dark:border-slate-200 dark:ring-slate-500"
                : "border-slate-300 dark:border-border-dark"
            } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
            style={{ backgroundColor: card }}
            onClick={() => {
              if (disabled) return;
              onChange(card);
            }}
            disabled={disabled}
            title={card}
            aria-label={card}
          />
        );
      })}
    </div>
  );
}

export function OtherInstrumentManagementTab(props: OtherInstrumentManagementTabProps) {
  const [manualTags, setManualTags] = useState<ManualTagSummary[]>([]);
  const [manualTagsLoading, setManualTagsLoading] = useState(false);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualNotice, setManualNotice] = useState<string | null>(null);

  const [manualDeleteMode, setManualDeleteMode] = useState(false);
  const [manualSelectedTags, setManualSelectedTags] = useState<string[]>([]);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createNameDraft, setCreateNameDraft] = useState("");
  const [createDescriptionDraft, setCreateDescriptionDraft] = useState("");
  const [createColorDraft, setCreateColorDraft] = useState(DEFAULT_MANUAL_TAG_COLOR);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailTag, setDetailTag] = useState<ManualTagSummary | null>(null);
  const [detailDescriptionDraft, setDetailDescriptionDraft] = useState("");
  const [detailColorDraft, setDetailColorDraft] = useState(DEFAULT_MANUAL_TAG_COLOR);

  const [providerTypeFilterOpen, setProviderTypeFilterOpen] = useState(false);
  const [selectedProviderTypes, setSelectedProviderTypes] = useState<string[]>([]);
  const providerTypeFilterRef = useRef<HTMLDivElement | null>(null);

  const [nowTs, setNowTs] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const providerTags = useMemo(
    () => props.marketTags.filter((tag) => tag.source === "provider"),
    [props.marketTags]
  );

  const providerTypeOptions = useMemo(() => {
    const values = new Set<string>();
    for (const tag of providerTags) {
      const parsed = splitTagLabel(tag.tag);
      values.add(parsed.namespace ?? "未分类");
    }
    return Array.from(values.values()).sort((left, right) =>
      left.localeCompare(right, "zh-Hans-CN")
    );
  }, [providerTags]);

  useEffect(() => {
    setSelectedProviderTypes((prev) =>
      prev.filter((item) => providerTypeOptions.includes(item))
    );
  }, [providerTypeOptions]);

  useEffect(() => {
    if (!providerTypeFilterOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (providerTypeFilterRef.current?.contains(target)) return;
      setProviderTypeFilterOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProviderTypeFilterOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [providerTypeFilterOpen]);

  const providerTagGroups = useMemo(() => {
    const selectedTypeSet = new Set(selectedProviderTypes);
    const hasTypeFilter = selectedTypeSet.size > 0;
    const attributeRows: Array<{
      tag: TagSummary;
      namespaceLabel: string;
      valueLabel: string;
    }> = [];
    const sourceRows: Array<{
      tag: TagSummary;
      namespaceLabel: string;
      valueLabel: string;
    }> = [];

    for (const tag of providerTags) {
      const parsed = splitTagLabel(tag.tag);
      const namespaceLabel = parsed.namespace ?? "未分类";
      const valueLabel = parsed.value;
      if (hasTypeFilter && !selectedTypeSet.has(namespaceLabel)) {
        continue;
      }
      const namespaceKey = namespaceLabel.toLowerCase();
      const row = { tag, namespaceLabel, valueLabel };
      if (SOURCE_INFO_NAMESPACE_SET.has(namespaceKey)) {
        sourceRows.push(row);
      } else {
        attributeRows.push(row);
      }
    }

    const sorter = (
      left: { namespaceLabel: string; valueLabel: string; tag: TagSummary },
      right: { namespaceLabel: string; valueLabel: string; tag: TagSummary }
    ) => {
      const byType = left.namespaceLabel.localeCompare(right.namespaceLabel, "zh-Hans-CN");
      if (byType !== 0) return byType;
      const byValue = left.valueLabel.localeCompare(right.valueLabel, "zh-Hans-CN");
      if (byValue !== 0) return byValue;
      return (right.tag.memberCount ?? 0) - (left.tag.memberCount ?? 0);
    };

    attributeRows.sort(sorter);
    sourceRows.sort(sorter);

    return [
      { key: "attributes", label: "标的属性", rows: attributeRows },
      { key: "source", label: "来源信息", rows: sourceRows }
    ].filter((group) => group.rows.length > 0);
  }, [providerTags, selectedProviderTypes]);

  const providerVisibleCount = useMemo(
    () =>
      providerTagGroups.reduce((sum, group) => sum + group.rows.length, 0),
    [providerTagGroups]
  );

  const manualTagRows = useMemo(
    () =>
      manualTags.map((item) => {
        const parsed = splitTagLabel(item.tag);
        return {
          item,
          namespaceLabel: parsed.namespace ?? "user",
          valueLabel: item.name?.trim() || parsed.value
        };
      }),
    [manualTags]
  );

  const manualTagMap = useMemo(() => {
    const map = new Map<string, ManualTagSummary>();
    for (const item of manualTags) {
      map.set(item.tag, item);
    }
    return map;
  }, [manualTags]);

  const refreshManualTags = useCallback(async () => {
    const marketApi = window.mytrader?.market;
    if (!marketApi) return;
    try {
      setManualTagsLoading(true);
      const tags = await marketApi.listManualTags({ limit: 500 });
      setManualTags(tags);
    } catch (err) {
      setManualError(toErrorMessage(err));
      setManualTags([]);
    } finally {
      setManualTagsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshManualTags();
  }, [refreshManualTags]);

  useEffect(() => {
    setManualSelectedTags((prev) =>
      prev.filter((tag) => {
        const item = manualTagMap.get(tag);
        return Boolean(item?.editable);
      })
    );
  }, [manualTagMap]);

  const allTempTargetsSelected =
    props.marketTempTargets.length > 0 &&
    props.marketSelectedTempTargetSymbols.length === props.marketTempTargets.length;

  const handleCreateManualTag = useCallback(async () => {
    const marketApi = window.mytrader?.market;
    if (!marketApi) return;
    const name = normalizeManualTagName(createNameDraft);
    if (!name) {
      setManualError("请输入标签名称，且名称中不能包含 ':'。");
      return;
    }

    setManualSubmitting(true);
    setManualError(null);
    setManualNotice(null);
    try {
      await marketApi.createManualTag({
        name,
        description: createDescriptionDraft.trim() || null,
        color: normalizeColor(createColorDraft)
      });
      await Promise.all([
        refreshManualTags(),
        props.refreshMarketTags(props.marketTagManagementQuery)
      ]);
      setManualNotice(`已新增手动标签：user:${name}`);
      setCreateModalOpen(false);
      setCreateNameDraft("");
      setCreateDescriptionDraft("");
      setCreateColorDraft(DEFAULT_MANUAL_TAG_COLOR);
    } catch (err) {
      setManualError(toErrorMessage(err));
    } finally {
      setManualSubmitting(false);
    }
  }, [
    createColorDraft,
    createDescriptionDraft,
    createNameDraft,
    props,
    refreshManualTags
  ]);

  const toggleManualDeleteSelection = useCallback((tag: string) => {
    setManualSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  }, []);

  const handleDeleteSelectedManualTags = useCallback(async () => {
    const marketApi = window.mytrader?.market;
    if (!marketApi) return;
    if (manualSelectedTags.length === 0) return;

    setManualSubmitting(true);
    setManualError(null);
    setManualNotice(null);
    try {
      const result = await marketApi.deleteManualTags({ tags: manualSelectedTags });
      await Promise.all([
        refreshManualTags(),
        props.refreshMarketTags(props.marketTagManagementQuery)
      ]);
      const notices = [`已删除 ${result.deletedTags} 个手动标签`];
      if (result.removedBindings > 0) {
        notices.push(`移除绑定 ${result.removedBindings} 条`);
      }
      if (result.skippedTags.length > 0) {
        notices.push(`跳过保留标签 ${result.skippedTags.length} 个`);
      }
      setManualNotice(`${notices.join("，")}。`);
      setManualDeleteMode(false);
      setManualSelectedTags([]);
    } catch (err) {
      setManualError(toErrorMessage(err));
    } finally {
      setManualSubmitting(false);
    }
  }, [manualSelectedTags, props, refreshManualTags]);

  const openManualDetail = useCallback((item: ManualTagSummary) => {
    setDetailTag(item);
    setDetailDescriptionDraft(item.description ?? "");
    setDetailColorDraft(normalizeColor(item.color));
    setDetailModalOpen(true);
  }, []);

  const handleSaveManualDetail = useCallback(async () => {
    const marketApi = window.mytrader?.market;
    if (!marketApi || !detailTag || !detailTag.editable) return;

    setManualSubmitting(true);
    setManualError(null);
    setManualNotice(null);
    try {
      await marketApi.updateManualTag({
        tag: detailTag.tag,
        description: detailDescriptionDraft.trim() || null,
        color: normalizeColor(detailColorDraft)
      });
      await Promise.all([
        refreshManualTags(),
        props.refreshMarketTags(props.marketTagManagementQuery)
      ]);
      setManualNotice(`已更新手动标签：${detailTag.tag}`);
      setDetailModalOpen(false);
    } catch (err) {
      setManualError(toErrorMessage(err));
    } finally {
      setManualSubmitting(false);
    }
  }, [
    detailColorDraft,
    detailDescriptionDraft,
    detailTag,
    props,
    refreshManualTags
  ]);

  return (
    <div className="space-y-4">
      <section className="space-y-2.5 border-b border-slate-200 dark:border-border-dark pb-3">
        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          标签管理
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-3">
          <div className="min-h-0 rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                数据源标签
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                共 {providerVisibleCount}
                {selectedProviderTypes.length > 0 ? ` / ${providerTags.length}` : ""} 个
              </span>
              <props.Input
                value={props.marketTagManagementQuery}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  props.setMarketTagManagementQuery(event.target.value)
                }
                placeholder="搜索数据源标签"
                className="ml-auto h-6 max-w-[150px] text-[10px] font-mono"
              />
            </div>

            <div className="min-h-[360px] max-h-[560px] overflow-auto rounded-md border border-slate-200 dark:border-border-dark">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white dark:bg-background-dark">
                  <tr className="border-b border-slate-200 dark:border-border-dark text-slate-500 dark:text-slate-400">
                    <th className="px-2 py-1.5 text-left">
                      <div className="relative inline-flex items-center gap-1" ref={providerTypeFilterRef}>
                        <span>标签类型</span>
                        <button
                          type="button"
                          className={`inline-flex h-5 w-5 items-center justify-center rounded border text-[11px] ${
                            selectedProviderTypes.length > 0
                              ? "border-primary text-primary"
                              : "border-slate-200 text-slate-500 dark:border-border-dark dark:text-slate-400"
                          }`}
                          onClick={() => setProviderTypeFilterOpen((prev) => !prev)}
                          aria-label="筛选标签类型"
                          title="筛选标签类型"
                        >
                          <span className="material-icons-outlined text-[13px]">filter_list</span>
                        </button>
                        {providerTypeFilterOpen && (
                          <div className="absolute left-0 top-full z-30 mt-1 w-52 rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark shadow-lg p-2 space-y-2">
                            <div className="flex items-center justify-between">
                              <button
                                type="button"
                                className="text-[11px] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
                                onClick={() => setSelectedProviderTypes(providerTypeOptions)}
                              >
                                全选
                              </button>
                              <button
                                type="button"
                                className="text-[11px] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
                                onClick={() => setSelectedProviderTypes([])}
                              >
                                清空
                              </button>
                            </div>
                            <div className="max-h-56 overflow-auto space-y-1">
                              {providerTypeOptions.map((namespace) => {
                                const checked = selectedProviderTypes.includes(namespace);
                                return (
                                  <label
                                    key={`provider-type-${namespace}`}
                                    className="flex items-center gap-2 text-[11px] text-slate-700 dark:text-slate-200"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() =>
                                        setSelectedProviderTypes((prev) =>
                                          checked
                                            ? prev.filter((item) => item !== namespace)
                                            : [...prev, namespace]
                                        )
                                      }
                                    />
                                    <span className="font-mono truncate">{namespace}</span>
                                  </label>
                                );
                              })}
                              {providerTypeOptions.length === 0 && (
                                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                  暂无可筛选类型
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </th>
                    <th className="px-2 py-1.5 text-left">标签值</th>
                    <th className="px-2 py-1.5 text-left">成员数</th>
                  </tr>
                </thead>
                <tbody>
                  {providerTagGroups.map((group) => (
                    <Fragment key={group.key}>
                      <tr className="border-b border-slate-200 dark:border-border-dark bg-slate-50/70 dark:bg-background-dark/50">
                        <td
                          colSpan={3}
                          className="px-2 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300"
                        >
                          {group.label} · {group.rows.length} 项
                        </td>
                      </tr>
                      {group.rows.map((row) => (
                        <tr
                          key={`provider-${row.tag.tag}`}
                          className="border-b border-slate-200/70 dark:border-border-dark/70 last:border-b-0"
                        >
                          <td className="px-2 py-1.5">
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-slate-200 dark:border-border-dark text-slate-500 dark:text-slate-300">
                              {row.namespaceLabel}
                            </span>
                          </td>
                          <td className="px-2 py-1.5">
                            <span className="font-mono text-slate-800 dark:text-slate-100 truncate block">
                              {row.valueLabel}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 font-mono tabular-nums">
                            {row.tag.memberCount.toLocaleString("zh-CN")}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                  {!props.marketTagsLoading && providerVisibleCount === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-2 py-6 text-center text-slate-500 dark:text-slate-400"
                      >
                        {providerTags.length > 0 && selectedProviderTypes.length > 0
                          ? "当前标签类型筛选下暂无数据"
                          : "暂无数据源标签"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="min-h-0 rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                手动标签
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                共 {manualTags.length} 个
              </span>

              <div className="ml-auto flex items-center gap-1.5">
                <props.Button
                  variant="secondary"
                  size="sm"
                  className="h-6 px-1.5 text-[10px]"
                  icon="add"
                  onClick={() => {
                    setManualError(null);
                    setManualNotice(null);
                    setCreateModalOpen(true);
                  }}
                  disabled={manualSubmitting}
                >
                  新增
                </props.Button>

                {!manualDeleteMode && (
                  <props.Button
                    variant="danger"
                    size="sm"
                    className="h-6 px-1.5 text-[10px]"
                    icon="delete"
                    onClick={() => {
                      setManualDeleteMode(true);
                      setManualSelectedTags([]);
                    }}
                    disabled={manualSubmitting || manualTagsLoading}
                  >
                    删除
                  </props.Button>
                )}

                {manualDeleteMode && (
                  <>
                    <props.Button
                      variant="secondary"
                      size="sm"
                      className="h-6 px-1.5 text-[10px]"
                      onClick={() => {
                        setManualDeleteMode(false);
                        setManualSelectedTags([]);
                      }}
                    >
                      取消
                    </props.Button>
                    <props.Button
                      variant="danger"
                      size="sm"
                      className="h-6 px-1.5 text-[10px]"
                      icon="delete"
                      onClick={() => {
                        void handleDeleteSelectedManualTags();
                      }}
                      disabled={manualSubmitting || manualSelectedTags.length === 0}
                    >
                      删除选中
                    </props.Button>
                  </>
                )}
              </div>
            </div>

            <div className="min-h-[360px] max-h-[560px] overflow-auto rounded-md border border-slate-200 dark:border-border-dark">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white dark:bg-background-dark">
                  <tr className="border-b border-slate-200 dark:border-border-dark text-slate-500 dark:text-slate-400">
                    {manualDeleteMode && <th className="w-8 px-2 py-1.5 text-left">选中</th>}
                    <th className="px-2 py-1.5 text-left">标签类型</th>
                    <th className="px-2 py-1.5 text-left">标签值</th>
                    <th className="px-2 py-1.5 text-left">成员数</th>
                  </tr>
                </thead>
                <tbody>
                  {manualTagRows.map((row) => {
                    const selected = manualSelectedTags.includes(row.item.tag);
                    return (
                      <tr
                        key={`manual-${row.item.tag}`}
                        className={`border-b border-slate-200/70 dark:border-border-dark/70 last:border-b-0 ${
                          row.item.editable || !manualDeleteMode
                            ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-background-dark/60"
                            : ""
                        }`}
                        onClick={() => {
                          if (manualDeleteMode) {
                            if (!row.item.editable) return;
                            toggleManualDeleteSelection(row.item.tag);
                            return;
                          }
                          openManualDetail(row.item);
                        }}
                      >
                        {manualDeleteMode && (
                          <td className="px-2 py-1.5 align-middle">
                            <input
                              type="checkbox"
                              checked={selected}
                              disabled={!row.item.editable}
                              onClick={(event) => event.stopPropagation()}
                              onChange={() => toggleManualDeleteSelection(row.item.tag)}
                            />
                          </td>
                        )}

                        <td className="px-2 py-1.5">
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-slate-200 dark:border-border-dark text-slate-500 dark:text-slate-300">
                            {row.namespaceLabel}
                          </span>
                        </td>

                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="h-2.5 w-2.5 rounded-full border border-slate-300 dark:border-border-dark"
                              style={{ backgroundColor: row.item.color }}
                              aria-hidden="true"
                            />
                            <span className="font-mono text-slate-800 dark:text-slate-100 truncate">
                              {row.valueLabel}
                            </span>
                          </div>
                        </td>

                        <td className="px-2 py-1.5 font-mono tabular-nums">
                          {row.item.memberCount.toLocaleString("zh-CN")}
                        </td>
                      </tr>
                    );
                  })}

                  {!manualTagsLoading && manualTags.length === 0 && (
                    <tr>
                      <td
                        colSpan={manualDeleteMode ? 4 : 3}
                        className="px-2 py-6 text-center text-slate-500 dark:text-slate-400"
                      >
                        暂无手动标签
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {manualError && (
              <div className="text-[11px] text-rose-600 dark:text-rose-400">
                {manualError}
              </div>
            )}
            {manualNotice && (
              <div className="text-[11px] text-emerald-700 dark:text-emerald-300">
                {manualNotice}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-2.5 border-b border-slate-200 dark:border-border-dark pb-3">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            临时标的管理
          </div>
          <div className="ml-auto text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
            共 {props.marketTempTargets.length} 个，已选{" "}
            {props.marketSelectedTempTargetSymbols.length} 个
          </div>
        </div>

        <div className="rounded-md border border-slate-200 dark:border-border-dark p-2.5">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="min-w-0 flex-1 overflow-auto rounded-md border border-slate-200 dark:border-border-dark">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white dark:bg-background-dark">
                  <tr className="border-b border-slate-200 dark:border-border-dark text-slate-500 dark:text-slate-400">
                    <th className="w-8 px-2 py-1.5 text-left">
                      <input
                        type="checkbox"
                        checked={allTempTargetsSelected}
                        onChange={props.handleSelectAllTempTargets}
                        aria-label={allTempTargetsSelected ? "取消全选" : "全选"}
                      />
                    </th>
                    <th className="px-2 py-1.5 text-left">标的代码</th>
                    <th className="px-2 py-1.5 text-left">标的名称</th>
                    <th className="px-2 py-1.5 text-left">标的类型</th>
                    <th className="px-2 py-1.5 text-left">添加时间</th>
                    <th className="px-2 py-1.5 text-left">剩余时间</th>
                  </tr>
                </thead>
                <tbody>
                  {props.marketTempTargetsLoading && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-2 py-6 text-center text-slate-500 dark:text-slate-400"
                      >
                        加载中...
                      </td>
                    </tr>
                  )}

                  {!props.marketTempTargetsLoading &&
                    props.marketTempTargets.map((item: TempTargetSymbol) => (
                      <tr
                        key={item.symbol}
                        className="border-b border-slate-200/70 dark:border-border-dark/70 last:border-b-0"
                      >
                        <td className="px-2 py-1.5">
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
                        </td>
                        <td className="px-2 py-1.5 font-mono text-slate-700 dark:text-slate-200">
                          {item.symbol}
                        </td>
                        <td className="px-2 py-1.5 text-slate-700 dark:text-slate-200">
                          {item.name?.trim() || "--"}
                        </td>
                        <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300">
                          {item.kind?.trim() || "--"}
                        </td>
                        <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300">
                          {props.formatDateTime(item.createdAt)}
                        </td>
                        <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300">
                          {formatRemainingTime(item.expiresAt, nowTs)}
                        </td>
                      </tr>
                    ))}

                  {!props.marketTempTargetsLoading &&
                    props.marketTempTargets.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-2 py-6 text-center text-slate-500 dark:text-slate-400"
                        >
                          暂无临时标的
                        </td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>

            <div className="w-full lg:w-[170px] shrink-0 grid grid-cols-2 lg:grid-cols-1 gap-1.5">
              <props.Button
                variant="secondary"
                size="sm"
                className="h-8 px-2.5"
                icon="select_all"
                onClick={props.handleSelectAllTempTargets}
              >
                {allTempTargetsSelected ? "取消全选" : "全选"}
              </props.Button>

              <props.Button
                variant="secondary"
                size="sm"
                className="h-8 px-2.5"
                icon="history"
                onClick={props.handleBatchExtendTempTargets}
                disabled={
                  props.marketSelectedTempTargetSymbols.length === 0 ||
                  props.marketTempTargetsLoading
                }
              >
                续期 7 天
              </props.Button>

              <props.Button
                variant="secondary"
                size="sm"
                className="h-8 px-2.5"
                icon="push_pin"
                onClick={props.handleBatchPromoteTempTargets}
                disabled={
                  props.marketSelectedTempTargetSymbols.length === 0 ||
                  props.marketTargetsSaving
                }
              >
                转长期
              </props.Button>

              <props.Button
                variant="danger"
                size="sm"
                className="h-8 px-2.5"
                icon="delete"
                onClick={props.handleBatchRemoveTempTargets}
                disabled={
                  props.marketSelectedTempTargetSymbols.length === 0 ||
                  props.marketTempTargetsLoading
                }
              >
                移除
              </props.Button>
            </div>
          </div>
        </div>
      </section>

      <props.Modal
        open={createModalOpen}
        title="新增手动标签"
        onClose={() => setCreateModalOpen(false)}
        sizeClassName="max-w-lg"
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
              名称
            </div>
            <props.Input
              value={createNameDraft}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setCreateNameDraft(event.target.value)
              }
              placeholder="例如：高股息（自动前缀 user:）"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
              描述
            </div>
            <textarea
              value={createDescriptionDraft}
              onChange={(event) => setCreateDescriptionDraft(event.target.value)}
              placeholder="可选"
              className="ui-input w-full min-h-[88px] rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
              颜色
            </div>
            <ColorCards
              value={createColorDraft}
              onChange={(next) => setCreateColorDraft(normalizeColor(next))}
              disabled={manualSubmitting}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <props.Button
              variant="secondary"
              size="sm"
              className="h-8 px-3"
              onClick={() => setCreateModalOpen(false)}
            >
              取消
            </props.Button>
            <props.Button
              variant="primary"
              size="sm"
              className="h-8 px-3"
              icon="check"
              onClick={() => {
                void handleCreateManualTag();
              }}
              disabled={manualSubmitting}
            >
              新增
            </props.Button>
          </div>
        </div>
      </props.Modal>

      <props.Modal
        open={detailModalOpen}
        title={detailTag ? `标签详情 · ${detailTag.name}` : "标签详情"}
        onClose={() => setDetailModalOpen(false)}
        sizeClassName="max-w-lg"
      >
        {detailTag && (
          <div className="space-y-3">
            <div className="grid grid-cols-[80px_1fr] gap-2 text-xs">
              <div className="text-slate-500 dark:text-slate-400">标签键</div>
              <div className="font-mono text-slate-700 dark:text-slate-200">
                {detailTag.tag}
              </div>
              <div className="text-slate-500 dark:text-slate-400">成员数</div>
              <div className="font-mono text-slate-700 dark:text-slate-200">
                {detailTag.memberCount.toLocaleString("zh-CN")}
              </div>
              <div className="text-slate-500 dark:text-slate-400">类型</div>
              <div className="text-slate-700 dark:text-slate-200">
                {detailTag.reserved ? "系统保留标签" : "手动标签"}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                描述
              </div>
              <textarea
                value={detailDescriptionDraft}
                onChange={(event) => setDetailDescriptionDraft(event.target.value)}
                className="ui-input w-full min-h-[88px] rounded-md px-3 py-2 text-sm"
                placeholder="暂无描述"
                disabled={!detailTag.editable || manualSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                颜色
              </div>
              <ColorCards
                value={detailColorDraft}
                onChange={(next) => setDetailColorDraft(normalizeColor(next))}
                disabled={!detailTag.editable || manualSubmitting}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <props.Button
                variant="secondary"
                size="sm"
                className="h-8 px-3"
                onClick={() => setDetailModalOpen(false)}
              >
                关闭
              </props.Button>
              <props.Button
                variant="primary"
                size="sm"
                className="h-8 px-3"
                icon="save"
                onClick={() => {
                  void handleSaveManualDetail();
                }}
                disabled={!detailTag.editable || manualSubmitting}
              >
                保存
              </props.Button>
            </div>
          </div>
        )}
      </props.Modal>
    </div>
  );
}
