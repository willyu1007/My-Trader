import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  Insight,
  InsightDetail,
  InsightEffectOperator,
  InsightEffectStage,
  InsightScopeMode,
  InsightScopeType,
  InsightStatus,
  MaterializeInsightTargetsResult,
  SearchInsightsResult,
  ValuationAdjustmentPreview
} from "@mytrader/shared";

interface InsightsViewProps {
  Button: typeof import("../shared").Button;
  Panel: typeof import("../shared").Panel;
  formatDateTime: typeof import("../shared").formatDateTime;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATUS_OPTIONS: InsightStatus[] = ["draft", "active", "archived", "deleted"];
const SCOPE_TYPE_OPTIONS: InsightScopeType[] = [
  "symbol",
  "tag",
  "kind",
  "asset_class",
  "market",
  "domain",
  "watchlist"
];
const SCOPE_MODE_OPTIONS: InsightScopeMode[] = ["include", "exclude"];
const STAGE_OPTIONS: InsightEffectStage[] = [
  "base",
  "first_order",
  "second_order",
  "output",
  "risk"
];
const OPERATOR_OPTIONS: InsightEffectOperator[] = ["set", "add", "mul", "min", "max"];

function normalizeTagInput(raw: string): string[] {
  return raw
    .split(/[\s,，;；\n]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function InsightsView(props: InsightsViewProps) {
  const api = window.mytrader?.insights;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<InsightStatus | "all">("all");
  const [insights, setInsights] = useState<Insight[]>([]);
  const [insightIds, setInsightIds] = useState<string[]>([]);
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InsightDetail | null>(null);

  const [createTitle, setCreateTitle] = useState("");
  const [createThesis, setCreateThesis] = useState("");
  const [createStatus, setCreateStatus] = useState<InsightStatus>("draft");
  const [createValidFrom, setCreateValidFrom] = useState("");
  const [createValidTo, setCreateValidTo] = useState("");
  const [createTags, setCreateTags] = useState("");

  const [editTitle, setEditTitle] = useState("");
  const [editThesis, setEditThesis] = useState("");
  const [editStatus, setEditStatus] = useState<InsightStatus>("draft");
  const [editValidFrom, setEditValidFrom] = useState("");
  const [editValidTo, setEditValidTo] = useState("");
  const [editTags, setEditTags] = useState("");

  const [scopeType, setScopeType] = useState<InsightScopeType>("symbol");
  const [scopeKey, setScopeKey] = useState("");
  const [scopeMode, setScopeMode] = useState<InsightScopeMode>("include");

  const [channelMethodKey, setChannelMethodKey] = useState("*");
  const [channelMetricKey, setChannelMetricKey] = useState("output.fair_value");
  const [channelStage, setChannelStage] = useState<InsightEffectStage>("output");
  const [channelOperator, setChannelOperator] = useState<InsightEffectOperator>("add");
  const [channelPriority, setChannelPriority] = useState("100");

  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [pointDate, setPointDate] = useState("");
  const [pointValue, setPointValue] = useState("");

  const [excludeSymbol, setExcludeSymbol] = useState("");
  const [excludeReason, setExcludeReason] = useState("");
  const [materializedPreview, setMaterializedPreview] =
    useState<MaterializeInsightTargetsResult | null>(null);

  const [ftsQuery, setFtsQuery] = useState("");
  const [ftsResult, setFtsResult] = useState<SearchInsightsResult | null>(null);
  const [valuationPreviewSymbol, setValuationPreviewSymbol] = useState("");
  const [valuationPreviewAsOfDate, setValuationPreviewAsOfDate] = useState("");
  const [valuationPreviewMethodKey, setValuationPreviewMethodKey] = useState("");
  const [valuationPreviewLoading, setValuationPreviewLoading] = useState(false);
  const [valuationPreviewResult, setValuationPreviewResult] =
    useState<ValuationAdjustmentPreview | null>(null);

  const selectedChannel = useMemo(() => {
    if (!detail || !selectedChannelId) return null;
    return detail.effectChannels.find((channel) => channel.id === selectedChannelId) ?? null;
  }, [detail, selectedChannelId]);

  const selectedChannelPoints = useMemo(() => {
    if (!detail || !selectedChannelId) return [];
    return detail.effectPoints
      .filter((point) => point.channelId === selectedChannelId)
      .sort((left, right) => left.effectDate.localeCompare(right.effectDate));
  }, [detail, selectedChannelId]);

  const syncEditorFromDetail = useCallback((nextDetail: InsightDetail | null) => {
    if (!nextDetail) {
      setEditTitle("");
      setEditThesis("");
      setEditStatus("draft");
      setEditValidFrom("");
      setEditValidTo("");
      setEditTags("");
      setSelectedChannelId(null);
      setMaterializedPreview(null);
      setValuationPreviewSymbol("");
      setValuationPreviewAsOfDate("");
      setValuationPreviewMethodKey("");
      setValuationPreviewResult(null);
      return;
    }
    setEditTitle(nextDetail.title);
    setEditThesis(nextDetail.thesis ?? "");
    setEditStatus(nextDetail.status);
    setEditValidFrom(nextDetail.validFrom ?? "");
    setEditValidTo(nextDetail.validTo ?? "");
    setEditTags(nextDetail.tags.join(", "));
    const firstChannel = nextDetail.effectChannels[0]?.id ?? null;
    setSelectedChannelId(firstChannel);
    setMaterializedPreview({
      insightId: nextDetail.id,
      total: nextDetail.materializedTargets.length,
      symbols: nextDetail.materializedTargets.slice(0, 200).map((item) => item.symbol),
      truncated: nextDetail.materializedTargets.length > 200,
      rulesApplied: nextDetail.scopeRules.length,
      updatedAt:
        nextDetail.materializedTargets[0]?.materializedAt ?? nextDetail.updatedAt
    });
    setValuationPreviewSymbol((current) =>
      current || nextDetail.materializedTargets[0]?.symbol || ""
    );
  }, []);

  const loadInsights = useCallback(
    async (preferredId?: string | null) => {
      if (!api) return;
      setLoading(true);
      setError(null);
      try {
        const result = await api.list({
          query: query.trim() || null,
          status: statusFilter,
          limit: 300,
          offset: 0
        });
        const ids = result.items.map((item) => item.id);
        setInsightIds(ids);
        setInsights(result.items);
        const nextId = preferredId ?? selectedInsightId ?? ids[0] ?? null;
        setSelectedInsightId(nextId);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [api, query, selectedInsightId, statusFilter]
  );

  const loadInsightDetail = useCallback(
    async (id: string | null) => {
      if (!api || !id) {
        setDetail(null);
        syncEditorFromDetail(null);
        return;
      }
      try {
        const next = await api.get({ id });
        setDetail(next);
        syncEditorFromDetail(next);
      } catch (err) {
        setDetail(null);
        syncEditorFromDetail(null);
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [api, syncEditorFromDetail]
  );

  const resolveInsightTitle = useCallback(
    (id: string): string => {
      if (detail?.id === id) return detail.title;
      const found = insights.find((item) => item.id === id);
      return found?.title ?? id;
    },
    [detail, insights]
  );

  useEffect(() => {
    void loadInsights();
  }, [loadInsights]);

  useEffect(() => {
    void loadInsightDetail(selectedInsightId);
  }, [loadInsightDetail, selectedInsightId]);

  const refreshSelectedInsight = useCallback(async () => {
    if (!selectedInsightId) return;
    await loadInsightDetail(selectedInsightId);
    await loadInsights(selectedInsightId);
  }, [loadInsightDetail, loadInsights, selectedInsightId]);

  const handleCreateInsight = useCallback(async () => {
    if (!api) return;
    if (!createTitle.trim()) {
      setError("请输入观点标题。");
      return;
    }
    if (createValidFrom && !DATE_RE.test(createValidFrom)) {
      setError("valid_from 格式必须为 YYYY-MM-DD。");
      return;
    }
    if (createValidTo && !DATE_RE.test(createValidTo)) {
      setError("valid_to 格式必须为 YYYY-MM-DD。");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const created = await api.create({
        title: createTitle.trim(),
        thesis: createThesis.trim() || null,
        status: createStatus,
        validFrom: createValidFrom || null,
        validTo: createValidTo || null,
        tags: normalizeTagInput(createTags)
      });
      setCreateTitle("");
      setCreateThesis("");
      setCreateStatus("draft");
      setCreateValidFrom("");
      setCreateValidTo("");
      setCreateTags("");
      setNotice(`观点已创建：${created.title}`);
      await loadInsights(created.id);
      await loadInsightDetail(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [
    api,
    createStatus,
    createTags,
    createThesis,
    createTitle,
    createValidFrom,
    createValidTo,
    loadInsightDetail,
    loadInsights
  ]);

  const handleSaveInsight = useCallback(async () => {
    if (!api || !detail) return;
    if (!editTitle.trim()) {
      setError("观点标题不能为空。");
      return;
    }
    if (editValidFrom && !DATE_RE.test(editValidFrom)) {
      setError("valid_from 格式必须为 YYYY-MM-DD。");
      return;
    }
    if (editValidTo && !DATE_RE.test(editValidTo)) {
      setError("valid_to 格式必须为 YYYY-MM-DD。");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await api.update({
        id: detail.id,
        title: editTitle.trim(),
        thesis: editThesis.trim() || null,
        status: editStatus,
        validFrom: editValidFrom || null,
        validTo: editValidTo || null,
        tags: normalizeTagInput(editTags)
      });
      setDetail(updated);
      syncEditorFromDetail(updated);
      setNotice("观点已保存。");
      await loadInsights(updated.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [
    api,
    detail,
    editStatus,
    editTags,
    editThesis,
    editTitle,
    editValidFrom,
    editValidTo,
    loadInsights,
    syncEditorFromDetail
  ]);

  const handleDeleteInsight = useCallback(async () => {
    if (!api || !detail) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await api.remove({ id: detail.id });
      setNotice(`观点已删除（软删）：${detail.title}`);
      setDetail(null);
      await loadInsights();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [api, detail, loadInsights]);

  const handleAddScopeRule = useCallback(async () => {
    if (!api || !detail) return;
    if (!scopeKey.trim()) {
      setError("scope_key 不能为空。");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.upsertScopeRule({
        insightId: detail.id,
        scopeType,
        scopeKey: scopeKey.trim(),
        mode: scopeMode,
        enabled: true
      });
      setScopeKey("");
      await refreshSelectedInsight();
      setNotice("作用域规则已更新。");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [api, detail, refreshSelectedInsight, scopeKey, scopeMode, scopeType]);

  const handleAddChannel = useCallback(async () => {
    if (!api || !detail) return;
    if (!channelMethodKey.trim() || !channelMetricKey.trim()) {
      setError("method_key 与 metric_key 不能为空。");
      return;
    }
    const priority = Number(channelPriority);
    if (!Number.isFinite(priority)) {
      setError("priority 必须是数字。");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const channel = await api.upsertEffectChannel({
        insightId: detail.id,
        methodKey: channelMethodKey.trim(),
        metricKey: channelMetricKey.trim(),
        stage: channelStage,
        operator: channelOperator,
        priority
      });
      setSelectedChannelId(channel.id);
      await refreshSelectedInsight();
      setNotice("作用通道已更新。");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [
    api,
    channelMethodKey,
    channelMetricKey,
    channelOperator,
    channelPriority,
    channelStage,
    detail,
    refreshSelectedInsight
  ]);

  const handleAddPoint = useCallback(async () => {
    if (!api || !selectedChannelId) return;
    if (!DATE_RE.test(pointDate)) {
      setError("effect_date 格式必须是 YYYY-MM-DD。");
      return;
    }
    const value = Number(pointValue);
    if (!Number.isFinite(value)) {
      setError("effect_value 必须是数字。");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.upsertEffectPoint({
        channelId: selectedChannelId,
        effectDate: pointDate,
        effectValue: value
      });
      setPointDate("");
      setPointValue("");
      await refreshSelectedInsight();
      setNotice("时间点已更新。");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [api, pointDate, pointValue, refreshSelectedInsight, selectedChannelId]);

  const handleMaterializePreview = useCallback(async () => {
    if (!api || !detail) return;
    setSaving(true);
    setError(null);
    try {
      const preview = await api.previewMaterializedTargets({
        insightId: detail.id,
        previewLimit: 200,
        persist: true
      });
      setMaterializedPreview(preview);
      setNotice(`已展开 ${preview.total} 个标的。`);
      await refreshSelectedInsight();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [api, detail, refreshSelectedInsight]);

  const handleExcludeTarget = useCallback(async () => {
    if (!api || !detail) return;
    if (!excludeSymbol.trim()) {
      setError("请输入需要排除的 symbol。");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.excludeTarget({
        insightId: detail.id,
        symbol: excludeSymbol.trim(),
        reason: excludeReason.trim() || null
      });
      setExcludeSymbol("");
      setExcludeReason("");
      await refreshSelectedInsight();
      setNotice("已排除该标的。");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [api, detail, excludeReason, excludeSymbol, refreshSelectedInsight]);

  const handleSearchFts = useCallback(async () => {
    if (!api) return;
    const keyword = ftsQuery.trim();
    if (!keyword) {
      setFtsResult(null);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await api.search({ query: keyword, limit: 20, offset: 0 });
      setFtsResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [api, ftsQuery]);

  const handlePreviewValuation = useCallback(async () => {
    if (!api) return;
    const symbol = valuationPreviewSymbol.trim();
    if (!symbol) {
      setError("请输入需要预览的 symbol。");
      return;
    }
    if (valuationPreviewAsOfDate && !DATE_RE.test(valuationPreviewAsOfDate)) {
      setError("as_of_date 格式必须是 YYYY-MM-DD。");
      return;
    }
    setValuationPreviewLoading(true);
    setError(null);
    try {
      const preview = await api.previewValuationBySymbol({
        symbol,
        asOfDate: valuationPreviewAsOfDate || null,
        methodKey: valuationPreviewMethodKey.trim() || null
      });
      setValuationPreviewResult(preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setValuationPreviewLoading(false);
    }
  }, [api, valuationPreviewAsOfDate, valuationPreviewMethodKey, valuationPreviewSymbol]);

  const handleUnlinkCurrentInsightFromPreviewSymbol = useCallback(async () => {
    if (!api || !detail) return;
    const symbol = valuationPreviewSymbol.trim();
    if (!symbol) {
      setError("symbol 不能为空。");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.excludeTarget({
        insightId: detail.id,
        symbol,
        reason: "removed from insight valuation preview"
      });
      await refreshSelectedInsight();
      await handlePreviewValuation();
      setNotice(`已从 ${symbol} 解绑当前观点影响。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [api, detail, handlePreviewValuation, refreshSelectedInsight, valuationPreviewSymbol]);

  const currentInsightEffects = useMemo(() => {
    if (!detail || !valuationPreviewResult) return [];
    return valuationPreviewResult.appliedEffects.filter(
      (effect) => effect.insightId === detail.id
    );
  }, [detail, valuationPreviewResult]);

  return (
    <props.Panel>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            全生命周期 + 作用域收敛到 symbol + 时间轴插值
          </div>
          <props.Button
            variant="secondary"
            size="sm"
            icon="refresh"
            onClick={() => void loadInsights(selectedInsightId)}
            disabled={loading || saving}
          >
            刷新
          </props.Button>
        </div>

        {!api && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            当前环境未注入 desktop API，无法使用观点模块。
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {notice}
          </div>
        )}

        <div className="rounded-md border border-slate-200 dark:border-border-dark p-3 bg-white/70 dark:bg-panel-dark/70 space-y-3">
          <div className="text-sm font-medium text-slate-800 dark:text-slate-100">创建观点</div>
          <div className="grid grid-cols-2 gap-3">
            <input
              className="ui-input rounded-md px-2 py-1.5 text-sm"
              placeholder="观点标题"
              value={createTitle}
              onChange={(event) => setCreateTitle(event.target.value)}
            />
            <select
              className="ui-select rounded-md px-2 py-1.5 text-sm"
              value={createStatus}
              onChange={(event) => setCreateStatus(event.target.value as InsightStatus)}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <textarea
            className="ui-input w-full rounded-md px-2 py-1.5 text-sm min-h-[80px]"
            placeholder="观点论述"
            value={createThesis}
            onChange={(event) => setCreateThesis(event.target.value)}
          />
          <div className="grid grid-cols-3 gap-3">
            <input
              className="ui-input rounded-md px-2 py-1.5 text-sm"
              placeholder="valid_from (YYYY-MM-DD)"
              value={createValidFrom}
              onChange={(event) => setCreateValidFrom(event.target.value)}
            />
            <input
              className="ui-input rounded-md px-2 py-1.5 text-sm"
              placeholder="valid_to (YYYY-MM-DD)"
              value={createValidTo}
              onChange={(event) => setCreateValidTo(event.target.value)}
            />
            <input
              className="ui-input rounded-md px-2 py-1.5 text-sm"
              placeholder="tags：逗号分隔"
              value={createTags}
              onChange={(event) => setCreateTags(event.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <props.Button
              variant="primary"
              size="sm"
              icon="add"
              onClick={() => void handleCreateInsight()}
              disabled={saving}
            >
              创建
            </props.Button>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-border-dark bg-white/70 dark:bg-panel-dark/70">
          <div className="grid grid-cols-12 gap-0">
            <aside className="col-span-3 border-r border-slate-200 dark:border-border-dark">
              <div className="p-3 border-b border-slate-200 dark:border-border-dark space-y-2">
                <input
                  className="ui-input w-full rounded-md px-2 py-1.5 text-sm"
                  placeholder="按标题/论述过滤"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void loadInsights(selectedInsightId);
                    }
                  }}
                />
                <select
                  className="ui-select w-full rounded-md px-2 py-1.5 text-sm"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as InsightStatus | "all")
                  }
                >
                  <option value="all">all</option>
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div className="max-h-[780px] overflow-y-auto">
                {loading && (
                  <div className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">
                    加载中...
                  </div>
                )}
                {!loading && insightIds.length === 0 && (
                  <div className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">
                    暂无观点。
                  </div>
                )}
                {!loading &&
                  insightIds.map((id) => {
                    const active = id === selectedInsightId;
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`w-full text-left px-3 py-2 border-b border-slate-100 dark:border-border-dark/60 transition-colors ${
                          active
                            ? "bg-slate-100 dark:bg-background-dark/80"
                            : "hover:bg-slate-50 dark:hover:bg-background-dark/60"
                        }`}
                        onClick={() => setSelectedInsightId(id)}
                      >
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                          {resolveInsightTitle(id)}
                        </div>
                        <div className="mt-1 font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {id}
                        </div>
                      </button>
                    );
                  })}
              </div>
            </aside>

            <section className="col-span-9 p-4 space-y-4">
              {!detail && (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  请选择左侧观点查看详情。
                </div>
              )}

              {detail && (
                <>
                  <div className="rounded-md border border-slate-200 dark:border-border-dark p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        className="ui-input rounded-md px-2 py-1.5 text-sm"
                        value={editTitle}
                        onChange={(event) => setEditTitle(event.target.value)}
                        placeholder="标题"
                      />
                      <select
                        className="ui-select rounded-md px-2 py-1.5 text-sm"
                        value={editStatus}
                        onChange={(event) => setEditStatus(event.target.value as InsightStatus)}
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      className="ui-input w-full rounded-md px-2 py-1.5 text-sm min-h-[80px]"
                      value={editThesis}
                      onChange={(event) => setEditThesis(event.target.value)}
                      placeholder="观点论述"
                    />
                    <div className="grid grid-cols-3 gap-3">
                      <input
                        className="ui-input rounded-md px-2 py-1.5 text-sm"
                        value={editValidFrom}
                        onChange={(event) => setEditValidFrom(event.target.value)}
                        placeholder="valid_from (YYYY-MM-DD)"
                      />
                      <input
                        className="ui-input rounded-md px-2 py-1.5 text-sm"
                        value={editValidTo}
                        onChange={(event) => setEditValidTo(event.target.value)}
                        placeholder="valid_to (YYYY-MM-DD)"
                      />
                      <input
                        className="ui-input rounded-md px-2 py-1.5 text-sm"
                        value={editTags}
                        onChange={(event) => setEditTags(event.target.value)}
                        placeholder="tags：逗号分隔"
                      />
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      created: {props.formatDateTime(detail.createdAt)} · updated:{" "}
                      {props.formatDateTime(detail.updatedAt)}
                    </div>
                    <div className="flex items-center gap-2">
                      <props.Button
                        variant="primary"
                        size="sm"
                        icon="save"
                        onClick={() => void handleSaveInsight()}
                        disabled={saving}
                      >
                        保存观点
                      </props.Button>
                      <props.Button
                        variant="danger"
                        size="sm"
                        icon="delete"
                        onClick={() => void handleDeleteInsight()}
                        disabled={saving}
                      >
                        删除观点
                      </props.Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-md border border-slate-200 dark:border-border-dark p-3 space-y-2">
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        作用域规则
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <select
                          className="ui-select rounded-md px-2 py-1.5 text-sm"
                          value={scopeType}
                          onChange={(event) =>
                            setScopeType(event.target.value as InsightScopeType)
                          }
                        >
                          {SCOPE_TYPE_OPTIONS.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                        <select
                          className="ui-select rounded-md px-2 py-1.5 text-sm"
                          value={scopeMode}
                          onChange={(event) =>
                            setScopeMode(event.target.value as InsightScopeMode)
                          }
                        >
                          {SCOPE_MODE_OPTIONS.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                        <input
                          className="ui-input rounded-md px-2 py-1.5 text-sm"
                          placeholder="scope_key"
                          value={scopeKey}
                          onChange={(event) => setScopeKey(event.target.value)}
                        />
                      </div>
                      <props.Button
                        variant="secondary"
                        size="sm"
                        icon="add"
                        onClick={() => void handleAddScopeRule()}
                        disabled={saving}
                      >
                        添加规则
                      </props.Button>
                      <div className="max-h-40 overflow-auto rounded border border-slate-200 dark:border-border-dark">
                        {detail.scopeRules.map((rule) => (
                          <div
                            key={rule.id}
                            className="px-3 py-2 border-b border-slate-100 dark:border-border-dark/60 last:border-b-0 flex items-center justify-between gap-2"
                          >
                            <div className="text-xs">
                              <span className="font-mono">{rule.scopeType}</span> ·{" "}
                              <span className="font-mono">{rule.mode}</span> ·{" "}
                              <span className="font-mono">{rule.scopeKey}</span>
                            </div>
                            <props.Button
                              variant="danger"
                              size="sm"
                              icon="delete"
                              onClick={() =>
                                void (async () => {
                                  setSaving(true);
                                  setError(null);
                                  try {
                                    await api?.removeScopeRule({ id: rule.id });
                                    await refreshSelectedInsight();
                                  } catch (err) {
                                    setError(err instanceof Error ? err.message : String(err));
                                  } finally {
                                    setSaving(false);
                                  }
                                })()
                              }
                              disabled={saving}
                            >
                              删除
                            </props.Button>
                          </div>
                        ))}
                        {detail.scopeRules.length === 0 && (
                          <div className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">
                            暂无作用域规则
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-md border border-slate-200 dark:border-border-dark p-3 space-y-2">
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        展开结果 / 标的排除
                      </div>
                      <div className="flex items-center gap-2">
                        <props.Button
                          variant="secondary"
                          size="sm"
                          icon="hub"
                          onClick={() => void handleMaterializePreview()}
                          disabled={saving}
                        >
                          重新展开
                        </props.Button>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {materializedPreview
                            ? `总数 ${materializedPreview.total} / 规则 ${materializedPreview.rulesApplied}`
                            : `总数 ${detail.materializedTargets.length}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          className="ui-input rounded-md px-2 py-1.5 text-sm font-mono"
                          placeholder="排除 symbol"
                          value={excludeSymbol}
                          onChange={(event) => setExcludeSymbol(event.target.value)}
                        />
                        <input
                          className="ui-input rounded-md px-2 py-1.5 text-sm"
                          placeholder="原因（可选）"
                          value={excludeReason}
                          onChange={(event) => setExcludeReason(event.target.value)}
                        />
                        <props.Button
                          variant="secondary"
                          size="sm"
                          icon="remove_circle"
                          onClick={() => void handleExcludeTarget()}
                          disabled={saving}
                        >
                          排除
                        </props.Button>
                      </div>
                      <div className="max-h-40 overflow-auto rounded border border-slate-200 dark:border-border-dark">
                        {(materializedPreview?.symbols ?? detail.materializedTargets.map((item) => item.symbol))
                          .slice(0, 200)
                          .map((symbol) => (
                            <div
                              key={symbol}
                              className="px-3 py-2 border-b border-slate-100 dark:border-border-dark/60 last:border-b-0 flex items-center justify-between gap-2"
                            >
                              <span className="font-mono text-xs">{symbol}</span>
                              <props.Button
                                variant="danger"
                                size="sm"
                                icon="link_off"
                                onClick={() =>
                                  void (async () => {
                                    setSaving(true);
                                    setError(null);
                                    try {
                                      await api?.excludeTarget({
                                        insightId: detail.id,
                                        symbol,
                                        reason: "symbol-side unlink"
                                      });
                                      await refreshSelectedInsight();
                                    } catch (err) {
                                      setError(err instanceof Error ? err.message : String(err));
                                    } finally {
                                      setSaving(false);
                                    }
                                  })()
                                }
                                disabled={saving}
                              >
                                解绑
                              </props.Button>
                            </div>
                          ))}
                        {(materializedPreview?.symbols ?? detail.materializedTargets).length === 0 && (
                          <div className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">
                            暂无展开结果
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-md border border-slate-200 dark:border-border-dark p-3 space-y-2">
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        作用通道
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        <input
                          className="ui-input rounded-md px-2 py-1.5 text-xs font-mono"
                          value={channelMethodKey}
                          onChange={(event) => setChannelMethodKey(event.target.value)}
                          placeholder="method_key"
                        />
                        <input
                          className="ui-input rounded-md px-2 py-1.5 text-xs font-mono"
                          value={channelMetricKey}
                          onChange={(event) => setChannelMetricKey(event.target.value)}
                          placeholder="metric_key"
                        />
                        <select
                          className="ui-select rounded-md px-2 py-1.5 text-xs"
                          value={channelStage}
                          onChange={(event) =>
                            setChannelStage(event.target.value as InsightEffectStage)
                          }
                        >
                          {STAGE_OPTIONS.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                        <select
                          className="ui-select rounded-md px-2 py-1.5 text-xs"
                          value={channelOperator}
                          onChange={(event) =>
                            setChannelOperator(event.target.value as InsightEffectOperator)
                          }
                        >
                          {OPERATOR_OPTIONS.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                        <input
                          className="ui-input rounded-md px-2 py-1.5 text-xs"
                          value={channelPriority}
                          onChange={(event) => setChannelPriority(event.target.value)}
                          placeholder="priority"
                        />
                      </div>
                      <props.Button
                        variant="secondary"
                        size="sm"
                        icon="add"
                        onClick={() => void handleAddChannel()}
                        disabled={saving}
                      >
                        添加通道
                      </props.Button>
                      <div className="max-h-44 overflow-auto rounded border border-slate-200 dark:border-border-dark">
                        {detail.effectChannels.map((channel) => (
                          <div
                            key={channel.id}
                            className={`px-3 py-2 border-b border-slate-100 dark:border-border-dark/60 last:border-b-0 flex items-center justify-between gap-2 ${
                              channel.id === selectedChannelId ? "bg-slate-100/60 dark:bg-black/10" : ""
                            }`}
                          >
                            <button
                              type="button"
                              className="text-left min-w-0 flex-1"
                              onClick={() => setSelectedChannelId(channel.id)}
                            >
                              <div className="text-xs font-mono truncate">
                                {channel.methodKey} · {channel.metricKey}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                {channel.stage} / {channel.operator} / p={channel.priority}
                              </div>
                            </button>
                            <props.Button
                              variant="danger"
                              size="sm"
                              icon="delete"
                              onClick={() =>
                                void (async () => {
                                  setSaving(true);
                                  setError(null);
                                  try {
                                    await api?.removeEffectChannel({ id: channel.id });
                                    await refreshSelectedInsight();
                                  } catch (err) {
                                    setError(err instanceof Error ? err.message : String(err));
                                  } finally {
                                    setSaving(false);
                                  }
                                })()
                              }
                              disabled={saving}
                            >
                              删除
                            </props.Button>
                          </div>
                        ))}
                        {detail.effectChannels.length === 0 && (
                          <div className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">
                            暂无作用通道
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-md border border-slate-200 dark:border-border-dark p-3 space-y-2">
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        时间点数值（线性插值）
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        当前通道：
                        {selectedChannel ? (
                          <span className="font-mono">{selectedChannel.metricKey}</span>
                        ) : (
                          "未选择"
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          className="ui-input rounded-md px-2 py-1.5 text-xs"
                          placeholder="effect_date"
                          value={pointDate}
                          onChange={(event) => setPointDate(event.target.value)}
                        />
                        <input
                          className="ui-input rounded-md px-2 py-1.5 text-xs"
                          placeholder="effect_value"
                          value={pointValue}
                          onChange={(event) => setPointValue(event.target.value)}
                        />
                        <props.Button
                          variant="secondary"
                          size="sm"
                          icon="add"
                          onClick={() => void handleAddPoint()}
                          disabled={!selectedChannelId || saving}
                        >
                          添加
                        </props.Button>
                      </div>
                      <div className="max-h-44 overflow-auto rounded border border-slate-200 dark:border-border-dark">
                        {selectedChannelPoints.map((point) => (
                          <div
                            key={point.id}
                            className="px-3 py-2 border-b border-slate-100 dark:border-border-dark/60 last:border-b-0 flex items-center justify-between gap-2"
                          >
                            <div className="text-xs font-mono">
                              {point.effectDate} · {point.effectValue}
                            </div>
                            <props.Button
                              variant="danger"
                              size="sm"
                              icon="delete"
                              onClick={() =>
                                void (async () => {
                                  setSaving(true);
                                  setError(null);
                                  try {
                                    await api?.removeEffectPoint({ id: point.id });
                                    await refreshSelectedInsight();
                                  } catch (err) {
                                    setError(err instanceof Error ? err.message : String(err));
                                  } finally {
                                    setSaving(false);
                                  }
                                })()
                              }
                              disabled={saving}
                            >
                              删除
                            </props.Button>
                          </div>
                        ))}
                        {selectedChannelPoints.length === 0 && (
                          <div className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">
                            暂无时间点
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        </div>

        <div className="rounded-md border border-slate-200 dark:border-border-dark p-3 bg-white/70 dark:bg-panel-dark/70 space-y-3">
          <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
            估值预览链路
          </div>
          <div className="grid grid-cols-4 gap-2">
            <input
              className="ui-input rounded-md px-2 py-1.5 text-sm font-mono"
              placeholder="symbol"
              value={valuationPreviewSymbol}
              onChange={(event) => setValuationPreviewSymbol(event.target.value)}
            />
            <input
              className="ui-input rounded-md px-2 py-1.5 text-sm"
              placeholder="asOfDate (YYYY-MM-DD，可选)"
              value={valuationPreviewAsOfDate}
              onChange={(event) => setValuationPreviewAsOfDate(event.target.value)}
            />
            <input
              className="ui-input rounded-md px-2 py-1.5 text-sm font-mono"
              placeholder="methodKey (可选)"
              value={valuationPreviewMethodKey}
              onChange={(event) => setValuationPreviewMethodKey(event.target.value)}
            />
            <div className="flex items-center justify-end gap-2">
              <props.Button
                variant="secondary"
                size="sm"
                icon="analytics"
                onClick={() => void handlePreviewValuation()}
                disabled={valuationPreviewLoading}
              >
                预览
              </props.Button>
              <props.Button
                variant="danger"
                size="sm"
                icon="link_off"
                onClick={() => void handleUnlinkCurrentInsightFromPreviewSymbol()}
                disabled={!detail || saving}
              >
                解绑当前观点
              </props.Button>
            </div>
          </div>
          {valuationPreviewLoading && (
            <div className="text-xs text-slate-500 dark:text-slate-400">估值预览中...</div>
          )}
          {valuationPreviewResult && (
            <>
              <div className="grid grid-cols-5 gap-2 text-xs">
                <div className="rounded-md border border-slate-200 dark:border-border-dark px-2 py-1.5">
                  <div className="text-slate-500 dark:text-slate-400">symbol</div>
                  <div className="font-mono text-slate-900 dark:text-slate-100">
                    {valuationPreviewResult.symbol}
                  </div>
                </div>
                <div className="rounded-md border border-slate-200 dark:border-border-dark px-2 py-1.5">
                  <div className="text-slate-500 dark:text-slate-400">method</div>
                  <div className="font-mono text-slate-900 dark:text-slate-100 truncate">
                    {valuationPreviewResult.methodKey ?? "not_applicable"}
                  </div>
                </div>
                <div className="rounded-md border border-slate-200 dark:border-border-dark px-2 py-1.5">
                  <div className="text-slate-500 dark:text-slate-400">当前值</div>
                  <div className="font-mono text-slate-900 dark:text-slate-100">
                    {valuationPreviewResult.baseValue ?? "--"}
                  </div>
                </div>
                <div className="rounded-md border border-slate-200 dark:border-border-dark px-2 py-1.5">
                  <div className="text-slate-500 dark:text-slate-400">调整后值</div>
                  <div className="font-mono text-slate-900 dark:text-slate-100">
                    {valuationPreviewResult.adjustedValue ?? "--"}
                  </div>
                </div>
                <div className="rounded-md border border-slate-200 dark:border-border-dark px-2 py-1.5">
                  <div className="text-slate-500 dark:text-slate-400">应用 effect 数</div>
                  <div className="font-mono text-slate-900 dark:text-slate-100">
                    {valuationPreviewResult.appliedEffects.length}
                  </div>
                </div>
              </div>
              {valuationPreviewResult.notApplicable && (
                <div className="text-xs text-amber-700 dark:text-amber-400">
                  not_applicable: {valuationPreviewResult.reason ?? "无可用估值方法"}
                </div>
              )}
              <div className="text-xs text-slate-500 dark:text-slate-400">
                当前观点命中 effect 数：{currentInsightEffects.length}
              </div>
              <div className="max-h-40 overflow-auto rounded border border-slate-200 dark:border-border-dark">
                {valuationPreviewResult.appliedEffects.map((effect) => (
                  <div
                    key={`${effect.channelId}:${effect.metricKey}:${effect.stage}`}
                    className={`px-2 py-1.5 border-b border-slate-100 dark:border-border-dark/60 last:border-b-0 text-[11px] font-mono ${
                      detail && effect.insightId === detail.id
                        ? "bg-emerald-50 dark:bg-emerald-900/20"
                        : ""
                    }`}
                  >
                    {effect.insightTitle} · {effect.metricKey} · {effect.stage} ·{" "}
                    {effect.operator} {effect.value} · p={effect.priority}
                  </div>
                ))}
                {valuationPreviewResult.appliedEffects.length === 0 && (
                  <div className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">
                    暂无 effect 命中。
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="rounded-md border border-slate-200 dark:border-border-dark p-3 bg-white/70 dark:bg-panel-dark/70 space-y-3">
          <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
            FTS5 检索
          </div>
          <div className="flex items-center gap-2">
            <input
              className="ui-input flex-1 rounded-md px-2 py-1.5 text-sm"
              placeholder="输入关键词（title / thesis / tags）"
              value={ftsQuery}
              onChange={(event) => setFtsQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleSearchFts();
                }
              }}
            />
            <props.Button
              variant="secondary"
              size="sm"
              icon="search"
              onClick={() => void handleSearchFts()}
              disabled={saving}
            >
              搜索
            </props.Button>
          </div>
          <div className="max-h-52 overflow-auto rounded border border-slate-200 dark:border-border-dark">
            {ftsResult?.items.map((hit) => (
              <button
                key={hit.insight.id}
                type="button"
                className="w-full text-left px-3 py-2 border-b border-slate-100 dark:border-border-dark/60 last:border-b-0 hover:bg-slate-50 dark:hover:bg-background-dark/60"
                onClick={() => setSelectedInsightId(hit.insight.id)}
              >
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {hit.insight.title}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {hit.snippet ?? "无摘要"}
                </div>
              </button>
            ))}
            {!ftsResult?.items?.length && (
              <div className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">
                暂无检索结果
              </div>
            )}
          </div>
        </div>
      </div>
    </props.Panel>
  );
}
