import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  Insight,
  InsightDetail,
  InsightEffectOperator,
  InsightEffectPoint,
  InsightEffectStage,
  InsightFact,
  InsightScopeMode,
  InsightScopeType,
  InsightStatus,
  MaterializeInsightTargetsResult,
  SearchInsightsResult,
  ValuationAdjustmentPreview
} from "@mytrader/shared";
import type { InsightsTab } from "../types";

interface InsightsViewProps {
  Button: typeof import("../shared").Button;
  Panel: typeof import("../shared").Panel;
  formatDateTime: typeof import("../shared").formatDateTime;
  insightsTab: InsightsTab;
  setInsightsTab: (next: InsightsTab) => void;
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
const INSIGHT_BUILTIN_TAG_OPTIONS = [
  "政策",
  "宏观",
  "环境变化",
  "公司行为",
  "行业",
  "概念主题",
  "估值",
  "盈利预期",
  "动量",
  "波动率",
  "beta/alpha",
  "流动性"
] as const;

interface InsightManageSummary {
  impactSurface: string;
  affectedTargetCount: number;
  effectMode: string;
  currentOperator: string;
}

const DEFAULT_INSIGHT_MANAGE_SUMMARY: InsightManageSummary = {
  impactSurface: "--",
  affectedTargetCount: 0,
  effectMode: "--",
  currentOperator: "--"
};

function normalizeTagInput(raw: string): string[] {
  return raw
    .split(/[\s,，;；\n]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function deriveTitleFromFacts(facts: string[]): string {
  const firstLine = facts.map((line) => line.trim()).find(Boolean);
  if (!firstLine) return "";
  if (firstLine.length <= 40) return firstLine;
  return `${firstLine.slice(0, 40)}...`;
}

function buildFactsBlock(facts: string[]): string {
  const lines = facts.map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return "";
  const numberedFacts = lines.map((line, index) => `${index + 1}. ${line}`).join("\n");
  return `事实记录（手动）\n${numberedFacts}`;
}

function toLocalIsoDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultInsightValidityWindow(): { validFrom: string; validTo: string } {
  const start = new Date();
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 1);
  return {
    validFrom: toLocalIsoDate(start),
    validTo: toLocalIsoDate(end)
  };
}

function toEpochDay(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map((item) => Number(item));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return Number.NaN;
  }
  return Date.UTC(year, month - 1, day);
}

function interpolateEffectValue(points: InsightEffectPoint[], asOfDate: string): number | null {
  if (points.length === 0) return null;
  const sorted = [...points].sort((left, right) =>
    left.effectDate.localeCompare(right.effectDate)
  );
  if (asOfDate < sorted[0].effectDate || asOfDate > sorted[sorted.length - 1].effectDate) {
    return null;
  }
  for (let index = 0; index < sorted.length; index += 1) {
    const current = sorted[index];
    if (current.effectDate === asOfDate) return current.effectValue;
    if (index + 1 >= sorted.length) break;
    const next = sorted[index + 1];
    if (asOfDate < current.effectDate || asOfDate > next.effectDate) continue;
    const leftDay = toEpochDay(current.effectDate);
    const rightDay = toEpochDay(next.effectDate);
    const targetDay = toEpochDay(asOfDate);
    if (!Number.isFinite(leftDay) || !Number.isFinite(rightDay) || !Number.isFinite(targetDay)) {
      return null;
    }
    const span = rightDay - leftDay;
    if (span <= 0) return current.effectValue;
    const ratio = (targetDay - leftDay) / span;
    return current.effectValue + (next.effectValue - current.effectValue) * ratio;
  }
  return null;
}

function formatOperatorValue(operator: InsightEffectOperator, value: number): string {
  const normalized = Number(value.toFixed(6));
  const signed = normalized >= 0 ? `+${normalized}` : `${normalized}`;
  if (operator === "mul") return `*${normalized}`;
  if (operator === "set") return `${normalized}`;
  return signed;
}

function formatValidityWindow(validFrom: string | null, validTo: string | null): string {
  return `${validFrom ?? "--"} ~ ${validTo ?? "--"}`;
}

function buildInsightManageSummary(detail: InsightDetail, asOfDate: string): InsightManageSummary {
  const scopeCount = new Map<string, number>();
  detail.scopeRules
    .filter((rule) => rule.enabled)
    .forEach((rule) => {
      scopeCount.set(rule.scopeType, (scopeCount.get(rule.scopeType) ?? 0) + 1);
    });
  const impactSurface =
    scopeCount.size === 0
      ? "--"
      : Array.from(scopeCount.entries())
          .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
          .slice(0, 3)
          .map(([scopeType, count]) => `${scopeType}×${count}`)
          .join(" / ");

  const affectedTargetCount = new Set(detail.materializedTargets.map((item) => item.symbol)).size;

  const modeCount = new Map<string, number>();
  detail.effectChannels
    .filter((channel) => channel.enabled)
    .forEach((channel) => {
      const key = `${channel.stage}/${channel.operator}`;
      modeCount.set(key, (modeCount.get(key) ?? 0) + 1);
    });
  const effectMode =
    modeCount.size === 0
      ? "--"
      : Array.from(modeCount.entries())
          .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
          .slice(0, 3)
          .map(([mode, count]) => `${mode}×${count}`)
          .join(" / ");

  const pointsByChannel = new Map<string, InsightEffectPoint[]>();
  detail.effectPoints.forEach((point) => {
    const list = pointsByChannel.get(point.channelId) ?? [];
    list.push(point);
    pointsByChannel.set(point.channelId, list);
  });
  const currentOperatorItems = detail.effectChannels
    .filter((channel) => channel.enabled)
    .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id))
    .map((channel) => {
      const value = interpolateEffectValue(pointsByChannel.get(channel.id) ?? [], asOfDate);
      if (value === null) return null;
      return `${channel.operator} ${formatOperatorValue(channel.operator, value)} @${channel.metricKey}`;
    })
    .filter((item): item is string => Boolean(item))
    .slice(0, 2);
  const currentOperator = currentOperatorItems.length > 0 ? currentOperatorItems.join("; ") : "--";

  return {
    impactSurface,
    affectedTargetCount,
    effectMode,
    currentOperator
  };
}

export function InsightsView(props: InsightsViewProps) {
  const api = window.mytrader?.insights;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorVisible, setErrorVisible] = useState(false);
  const [noticeVisible, setNoticeVisible] = useState(false);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<InsightStatus | "all">("all");
  const [insights, setInsights] = useState<Insight[]>([]);
  const [insightIds, setInsightIds] = useState<string[]>([]);
  const [insightManageSummaryMap, setInsightManageSummaryMap] = useState<
    Record<string, InsightManageSummary>
  >({});
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null);
  const [manageDetailTab, setManageDetailTab] = useState<"basic" | "scope" | "effects" | "preview">("basic");
  const [detail, setDetail] = useState<InsightDetail | null>(null);

  const [facts, setFacts] = useState<InsightFact[]>([]);
  const [factsLoading, setFactsLoading] = useState(false);
  const [selectedFactIds, setSelectedFactIds] = useState<string[]>([]);
  const [generationFactInput, setGenerationFactInput] = useState("");
  const [generationNewsQuery, setGenerationNewsQuery] = useState("");
  const [generationNewsSource, setGenerationNewsSource] = useState("all");

  const [createTitle, setCreateTitle] = useState("");
  const [createThesis, setCreateThesis] = useState("");
  const [createStatus, setCreateStatus] = useState<InsightStatus>("draft");
  const [createValidFrom, setCreateValidFrom] = useState(
    () => getDefaultInsightValidityWindow().validFrom
  );
  const [createValidTo, setCreateValidTo] = useState(
    () => getDefaultInsightValidityWindow().validTo
  );
  const [createTags, setCreateTags] = useState<string[]>([]);
  const [createTagsOpen, setCreateTagsOpen] = useState(false);
  const createTagsRef = useRef<HTMLDivElement | null>(null);

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

  const selectedFactIdSet = useMemo(() => new Set(selectedFactIds), [selectedFactIds]);

  const allFactsSelected = useMemo(
    () => facts.length > 0 && selectedFactIds.length === facts.length,
    [facts.length, selectedFactIds.length]
  );

  const createTagButtonLabel = useMemo(() => {
    if (createTags.length === 0) return "标签：未选择";
    if (createTags.length <= 2) return `标签：${createTags.join(" / ")}`;
    return `标签：已选 ${createTags.length} 项`;
  }, [createTags]);

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
        if (!next) {
          setDetail(null);
          syncEditorFromDetail(null);
          setInsightManageSummaryMap((current) => ({
            ...current,
            [id]: DEFAULT_INSIGHT_MANAGE_SUMMARY
          }));
          return;
        }
        setDetail(next);
        syncEditorFromDetail(next);
        setInsightManageSummaryMap((current) => ({
          ...current,
          [next.id]: buildInsightManageSummary(next, toLocalIsoDate())
        }));
      } catch (err) {
        setDetail(null);
        syncEditorFromDetail(null);
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [api, syncEditorFromDetail]
  );

  const loadFacts = useCallback(async () => {
    if (!api) {
      setFacts([]);
      return;
    }
    setFactsLoading(true);
    try {
      const result = await api.listFacts({ limit: 300, offset: 0 });
      setFacts(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setFactsLoading(false);
    }
  }, [api]);

  const resolveInsightTitle = useCallback(
    (id: string): string => {
      if (detail?.id === id) return detail.title;
      const found = insights.find((item) => item.id === id);
      return found?.title ?? id;
    },
    [detail, insights]
  );

  const insightById = useMemo(
    () => new Map(insights.map((item) => [item.id, item])),
    [insights]
  );

  useEffect(() => {
    void loadInsights();
  }, [loadInsights]);

  useEffect(() => {
    void loadFacts();
  }, [loadFacts]);

  useEffect(() => {
    setSelectedFactIds((current) =>
      current.filter((id) => facts.some((fact) => fact.id === id))
    );
  }, [facts]);

  useEffect(() => {
    void loadInsightDetail(selectedInsightId);
  }, [loadInsightDetail, selectedInsightId]);

  useEffect(() => {
    if (!error) {
      setErrorVisible(false);
      return;
    }
    setErrorVisible(true);
    const fadeTimer = setTimeout(() => setErrorVisible(false), 3000);
    const clearTimer = setTimeout(() => setError(null), 3400);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(clearTimer);
    };
  }, [error]);

  useEffect(() => {
    if (!notice) {
      setNoticeVisible(false);
      return;
    }
    setNoticeVisible(true);
    const fadeTimer = setTimeout(() => setNoticeVisible(false), 3000);
    const clearTimer = setTimeout(() => setNotice(null), 3400);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(clearTimer);
    };
  }, [notice]);

  useEffect(() => {
    if (!createTagsOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (createTagsRef.current?.contains(target)) return;
      setCreateTagsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCreateTagsOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [createTagsOpen]);

  useEffect(() => {
    if (!api || insights.length === 0) {
      setInsightManageSummaryMap({});
      return;
    }
    let cancelled = false;
    const asOfDate = toLocalIsoDate();
    const loadSummaries = async () => {
      const entries: Array<[string, InsightManageSummary]> = [];
      const chunkSize = 20;
      for (let index = 0; index < insights.length; index += chunkSize) {
        const chunk = insights.slice(index, index + chunkSize);
        const chunkResults = await Promise.all(
          chunk.map(async (item): Promise<[string, InsightManageSummary]> => {
            try {
              const nextDetail = await api.get({ id: item.id });
              if (!nextDetail) return [item.id, DEFAULT_INSIGHT_MANAGE_SUMMARY];
              return [item.id, buildInsightManageSummary(nextDetail, asOfDate)];
            } catch (_error) {
              return [item.id, DEFAULT_INSIGHT_MANAGE_SUMMARY];
            }
          })
        );
        entries.push(...chunkResults);
      }
      if (!cancelled) {
        setInsightManageSummaryMap(Object.fromEntries(entries));
      }
    };
    void loadSummaries();
    return () => {
      cancelled = true;
    };
  }, [api, insights]);

  const refreshSelectedInsight = useCallback(async () => {
    if (!selectedInsightId) return;
    await loadInsightDetail(selectedInsightId);
    await loadInsights(selectedInsightId);
  }, [loadInsightDetail, loadInsights, selectedInsightId]);

  const handleCreateFact = useCallback(async () => {
    if (!api) return;
    const content = generationFactInput.trim();
    if (!content) {
      setError("请输入事实内容。");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.createFact({ content });
      setGenerationFactInput("");
      await loadFacts();
      setNotice("事实已新增。");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [api, generationFactInput, loadFacts]);

  const handleToggleFactSelection = useCallback((factId: string, checked: boolean) => {
    setSelectedFactIds((current) => {
      if (checked) {
        if (current.includes(factId)) return current;
        return [...current, factId];
      }
      return current.filter((id) => id !== factId);
    });
  }, []);

  const handleToggleAllFactsSelection = useCallback(
    (checked: boolean) => {
      if (!checked) {
        setSelectedFactIds([]);
        return;
      }
      setSelectedFactIds(facts.map((fact) => fact.id));
    },
    [facts]
  );

  const handleRemoveFact = useCallback(
    async (factId: string) => {
      if (!api) return;
      setSaving(true);
      setError(null);
      try {
        await api.removeFact({ id: factId });
        setSelectedFactIds((current) => current.filter((id) => id !== factId));
        await loadFacts();
        setNotice("事实已删除。");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setSaving(false);
      }
    },
    [api, loadFacts]
  );

  const handleRemoveSelectedFacts = useCallback(async () => {
    if (!api) return;
    if (selectedFactIds.length === 0) {
      setError("请先选择要删除的事实。");
      return;
    }
    const ids = [...selectedFactIds];
    setSaving(true);
    setError(null);
    try {
      await Promise.all(ids.map((id) => api.removeFact({ id })));
      setSelectedFactIds([]);
      await loadFacts();
      setNotice(`已删除 ${ids.length} 条事实。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [api, loadFacts, selectedFactIds]);

  const handleGenerateDraftFromFacts = useCallback(() => {
    const factContents = facts.map((fact) => fact.content);
    const factsBlock = buildFactsBlock(factContents);
    if (!factsBlock) {
      setError("请先新增事实，再生成观点草稿。");
      return;
    }
    const marker = "事实记录（手动）";
    setError(null);
    setNotice("已根据事实生成草稿，请补充作用参数后创建观点。");
    setCreateTitle((current) => current.trim() || deriveTitleFromFacts(factContents));
    setCreateThesis((current) => {
      const trimmed = current.trim();
      if (!trimmed) return factsBlock;
      const markerIndex = trimmed.indexOf(marker);
      if (markerIndex < 0) return `${trimmed}\n\n${factsBlock}`;
      const prefix = trimmed.slice(0, markerIndex).trim();
      return prefix ? `${prefix}\n\n${factsBlock}` : factsBlock;
    });
    setCreateValidFrom((current) => current || toLocalIsoDate());
  }, [facts]);

  const handleReservedNewsSearch = useCallback(() => {
    if (!generationNewsQuery.trim()) {
      setError("请输入关键词后再执行资讯搜索。");
      return;
    }
    setError(null);
    setNotice(
      `资讯搜索接口已预留（来源=${generationNewsSource}，关键词=${generationNewsQuery.trim()}），当前版本未接入。`
    );
  }, [generationNewsQuery, generationNewsSource]);

  const handleToggleCreateTag = useCallback((tag: string) => {
    setCreateTags((current) => {
      if (current.includes(tag)) {
        return current.filter((item) => item !== tag);
      }
      return [...current, tag];
    });
  }, []);

  const handleSelectAllCreateTags = useCallback(() => {
    setCreateTags([...INSIGHT_BUILTIN_TAG_OPTIONS]);
  }, []);

  const handleClearCreateTags = useCallback(() => {
    setCreateTags([]);
  }, []);

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
        tags: createTags
      });
      setCreateTitle("");
      setCreateThesis("");
      setCreateStatus("draft");
      const defaultValidity = getDefaultInsightValidityWindow();
      setCreateValidFrom(defaultValidity.validFrom);
      setCreateValidTo(defaultValidity.validTo);
      setCreateTags([]);
      setCreateTagsOpen(false);
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
        {!api && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            当前环境未注入 desktop API，无法使用观点模块。
          </div>
        )}

        {error && (
          <div
            className={`rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 transition-opacity duration-300 ${
              errorVisible ? "opacity-100" : "opacity-0"
            }`}
          >
            {error}
          </div>
        )}
        {notice && (
          <div
            className={`rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 transition-opacity duration-300 ${
              noticeVisible ? "opacity-100" : "opacity-0"
            }`}
          >
            {notice}
          </div>
        )}

        {props.insightsTab === "generate" && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 xl:grid-cols-[38%_62%] gap-3">
              <section className="rounded-md border border-slate-200 dark:border-border-dark bg-white/70 dark:bg-panel-dark/70 overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-200 dark:border-border-dark flex items-center justify-between gap-2">
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-100">事实录入</div>
                </div>
                <div className="px-3 py-3 space-y-3">
                  <div className="space-y-2 pb-3 border-b border-slate-200 dark:border-border-dark">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        事实输入
                      </div>
                      <props.Button
                        variant="secondary"
                        size="sm"
                        icon="add"
                        onClick={() => void handleCreateFact()}
                        disabled={saving || !generationFactInput.trim()}
                      >
                        新增事实
                      </props.Button>
                    </div>
                    <textarea
                      className="ui-input w-full rounded-md px-2 py-1.5 text-sm min-h-[132px] resize-none"
                      placeholder="输入一条事实，例如：央行降准 50bp、公司发布回购计划。"
                      value={generationFactInput}
                      onChange={(event) => setGenerationFactInput(event.target.value)}
                    />
                  </div>

                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        资讯搜索
                      </div>
                      <props.Button
                        variant="secondary"
                        size="sm"
                        icon="search"
                        onClick={handleReservedNewsSearch}
                        disabled={saving}
                      >
                        搜索
                      </props.Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-[1fr,140px] gap-2">
                      <input
                        className="ui-input rounded-md px-2 py-1.5 text-sm"
                        placeholder="资讯关键词"
                        value={generationNewsQuery}
                        onChange={(event) => setGenerationNewsQuery(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            handleReservedNewsSearch();
                          }
                        }}
                      />
                      <select
                        className="ui-select rounded-md px-2 py-1.5 text-sm"
                        value={generationNewsSource}
                        onChange={(event) => setGenerationNewsSource(event.target.value)}
                      >
                        <option value="all">all</option>
                        <option value="policy">policy</option>
                        <option value="company">company</option>
                        <option value="macro">macro</option>
                      </select>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    当前版本仅预留资讯搜索调用位，未接入外部数据源。
                  </div>
                </div>
              </section>

              <section className="rounded-md border border-slate-200 dark:border-border-dark bg-white/70 dark:bg-panel-dark/70 overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-200 dark:border-border-dark flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-slate-800 dark:text-slate-100">事实列表</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">共 {facts.length} 条</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      已选 {selectedFactIds.length} 条
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <props.Button
                      variant="danger"
                      size="sm"
                      icon="delete"
                      onClick={() => void handleRemoveSelectedFacts()}
                      disabled={saving || selectedFactIds.length === 0}
                    >
                      删除选中
                    </props.Button>
                    <props.Button
                      variant="primary"
                      size="sm"
                      icon="auto_awesome"
                      onClick={handleGenerateDraftFromFacts}
                      disabled={saving || facts.length === 0}
                    >
                      生成观点草稿
                    </props.Button>
                  </div>
                </div>
                <div className="min-h-[320px] max-h-[460px] overflow-auto">
                  <table className="w-full text-xs table-fixed">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-background-dark/80">
                      <tr className="border-b border-slate-200 dark:border-border-dark">
                        <th className="px-2 py-2 text-center w-[8%]">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-sky-600"
                            checked={allFactsSelected}
                            onChange={(event) => handleToggleAllFactsSelection(event.target.checked)}
                            disabled={facts.length === 0 || saving}
                            aria-label="全选事实"
                          />
                        </th>
                        <th className="px-2 py-2 text-left font-medium text-slate-600 dark:text-slate-300 w-[56%]">
                          事实内容
                        </th>
                        <th className="px-2 py-2 text-left font-medium text-slate-600 dark:text-slate-300 w-[24%]">
                          创建时间
                        </th>
                        <th className="px-2 py-2 text-right font-medium text-slate-600 dark:text-slate-300 w-[12%]">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {factsLoading && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-3 py-3 text-slate-500 dark:text-slate-400"
                          >
                            加载事实中...
                          </td>
                        </tr>
                      )}
                      {!factsLoading &&
                        facts.map((fact) => (
                          <tr
                            key={fact.id}
                            className="border-b border-slate-100 dark:border-border-dark/60"
                          >
                            <td className="px-2 py-2 align-top text-center">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-sky-600"
                                checked={selectedFactIdSet.has(fact.id)}
                                onChange={(event) =>
                                  handleToggleFactSelection(fact.id, event.target.checked)
                                }
                                disabled={saving}
                                aria-label={`选择事实 ${fact.id}`}
                              />
                            </td>
                            <td className="px-2 py-2 align-top text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words">
                              {fact.content}
                            </td>
                            <td className="px-2 py-2 align-top text-slate-500 dark:text-slate-400">
                              {props.formatDateTime(fact.createdAt)}
                            </td>
                            <td className="px-2 py-2 align-top text-right">
                              <props.Button
                                variant="danger"
                                size="sm"
                                icon="delete"
                                onClick={() => void handleRemoveFact(fact.id)}
                                disabled={saving}
                              >
                                删除
                              </props.Button>
                            </td>
                          </tr>
                        ))}
                      {!factsLoading && facts.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-3 py-3 text-slate-500 dark:text-slate-400"
                          >
                            暂无事实，请先新增。
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <div className="border-t border-slate-200 dark:border-border-dark" />

            <section className="space-y-2 px-1">
              <div className="px-2 py-1 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium text-slate-800 dark:text-slate-100">观点草稿</div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <div className="flex items-center gap-1 px-1">
                    <input
                      type="date"
                      className="ui-input text-xs w-32 border-0 bg-transparent dark:bg-transparent focus:ring-0 focus:border-transparent rounded-none"
                      value={createValidFrom}
                      onChange={(event) => setCreateValidFrom(event.target.value)}
                    />
                    <span className="text-xs text-slate-400">至</span>
                    <input
                      type="date"
                      className="ui-input text-xs w-32 border-0 bg-transparent dark:bg-transparent focus:ring-0 focus:border-transparent rounded-none"
                      value={createValidTo}
                      onChange={(event) => setCreateValidTo(event.target.value)}
                    />
                  </div>
                  <span className="h-4 w-px bg-slate-200 dark:bg-border-dark" />
                  <div ref={createTagsRef} className="relative w-full sm:w-44">
                    <button
                      type="button"
                      className="relative h-7 w-full rounded px-2 text-left text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => setCreateTagsOpen((current) => !current)}
                      disabled={saving}
                    >
                      <span className="block truncate pr-6">{createTagButtonLabel}</span>
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 material-icons-outlined text-[18px] text-slate-400">
                        expand_more
                      </span>
                    </button>
                    {createTagsOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-50">
                        <div className="ui-popover-menu max-h-64 overflow-auto rounded-md border p-2 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              className="text-xs text-primary hover:underline"
                              onClick={handleSelectAllCreateTags}
                            >
                              全选
                            </button>
                            <button
                              type="button"
                              className="text-xs text-slate-500 hover:underline"
                              onClick={handleClearCreateTags}
                            >
                              清空
                            </button>
                          </div>
                          <div className="space-y-1">
                            {INSIGHT_BUILTIN_TAG_OPTIONS.map((tag) => {
                              const selected = createTags.includes(tag);
                              return (
                                <button
                                  key={tag}
                                  type="button"
                                  className={`w-full text-left rounded px-2 py-1 text-xs transition-colors ${
                                    selected
                                      ? "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300"
                                      : "hover:bg-slate-100 dark:hover:bg-slate-800"
                                  }`}
                                  onClick={() => handleToggleCreateTag(tag)}
                                >
                                  <span className="inline-flex items-center gap-1.5">
                                    <span
                                      className={`h-3 w-3 rounded-sm border ${
                                        selected
                                          ? "bg-sky-500 border-sky-500"
                                          : "border-slate-300 dark:border-slate-600"
                                      }`}
                                    />
                                    {tag}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="h-4 w-px bg-slate-200 dark:bg-border-dark" />
                  <props.Button
                    variant="secondary"
                    size="sm"
                    className="w-[104px] justify-center"
                    onClick={() => props.setInsightsTab("manage")}
                    disabled={saving}
                  >
                    去管理
                  </props.Button>
                  <props.Button
                    variant="primary"
                    size="sm"
                    icon="add"
                    className="w-[104px] justify-center"
                    onClick={() => void handleCreateInsight()}
                    disabled={saving}
                  >
                    创建观点
                  </props.Button>
                </div>
              </div>
              <div className="px-2 py-1 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-[1fr,190px] gap-2">
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
                  className="ui-input w-full rounded-md px-2 py-1.5 text-sm min-h-[140px] resize-none"
                  placeholder="观点论述（草稿生成后可继续编辑）"
                  value={createThesis}
                  onChange={(event) => setCreateThesis(event.target.value)}
                />
              </div>
            </section>
          </div>
        )}

        {props.insightsTab === "manage" && (
          <div className="border border-slate-200 dark:border-border-dark bg-white/70 dark:bg-panel-dark/70">
            <div className="grid grid-cols-1 md:grid-cols-[42%_58%] min-h-[760px]">
              <aside className="min-h-0 border-b md:border-b-0 md:border-r border-slate-200 dark:border-border-dark flex flex-col">
                <div className="px-3 py-2 border-b border-slate-200 dark:border-border-dark grid grid-cols-1 md:grid-cols-[1fr,120px,auto] gap-2">
                  <input
                    className="ui-input rounded-md px-2 py-1.5 text-sm"
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
                    className="ui-select rounded-md px-2 py-1.5 text-sm"
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

                <div className="flex-1 min-h-0 overflow-auto">
                  <table className="w-full text-xs table-fixed">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-background-dark/80">
                      <tr className="border-b border-slate-200 dark:border-border-dark">
                        <th className="px-2 py-2 text-left font-medium text-slate-600 dark:text-slate-300 w-[28%]">
                          标题 / 生成时间
                        </th>
                        <th className="px-2 py-2 text-left font-medium text-slate-600 dark:text-slate-300 w-[24%]">
                          影响面 / 作用方式
                        </th>
                        <th className="px-2 py-2 text-left font-medium text-slate-600 dark:text-slate-300 w-[28%]">
                          当前算子
                        </th>
                        <th className="px-2 py-2 text-left font-medium text-slate-600 dark:text-slate-300 w-[20%]">
                          有效时间
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-3 py-3 text-slate-500 dark:text-slate-400"
                          >
                            加载中...
                          </td>
                        </tr>
                      )}
                      {!loading &&
                        insightIds.map((id) => {
                          const summary =
                            insightManageSummaryMap[id] ?? DEFAULT_INSIGHT_MANAGE_SUMMARY;
                          const item = insightById.get(id);
                          const active = id === selectedInsightId;
                          return (
                            <tr
                              key={id}
                              className={`border-b border-slate-100 dark:border-border-dark/60 cursor-pointer ${
                                active
                                  ? "bg-slate-100 dark:bg-background-dark/80"
                                  : "hover:bg-slate-50 dark:hover:bg-background-dark/60"
                              }`}
                              onClick={() => setSelectedInsightId(id)}
                            >
                              <td className="px-2 py-2 align-top">
                                <div className="text-slate-900 dark:text-slate-100 font-medium truncate">
                                  {resolveInsightTitle(id)}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {item ? props.formatDateTime(item.createdAt) : "--"}
                                </div>
                              </td>
                              <td className="px-2 py-2 align-top text-slate-600 dark:text-slate-300">
                                <div className="truncate">{summary.impactSurface}</div>
                                <div className="truncate">{summary.effectMode}</div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                  影响标的数: {summary.affectedTargetCount}
                                </div>
                              </td>
                              <td className="px-2 py-2 align-top text-slate-700 dark:text-slate-200 break-words">
                                {summary.currentOperator}
                              </td>
                              <td className="px-2 py-2 align-top text-slate-500 dark:text-slate-400">
                                {formatValidityWindow(item?.validFrom ?? null, item?.validTo ?? null)}
                              </td>
                            </tr>
                          );
                        })}
                      {!loading && insightIds.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-3 py-3 text-slate-500 dark:text-slate-400"
                          >
                            暂无观点。
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </aside>

              <section className="min-h-0 flex flex-col">
                {!detail && (
                  <div className="h-full flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                    请选择左侧观点查看详情。
                  </div>
                )}

                {detail && (
                  <>
                    <div className="px-3 py-2 border-b border-slate-200 dark:border-border-dark flex items-center gap-2">
                      {[
                        { key: "basic", label: "基本信息" },
                        { key: "scope", label: "作用域" },
                        { key: "effects", label: "算子与时间轴" },
                        { key: "preview", label: "预览与检索" }
                      ].map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          role="tab"
                          aria-selected={manageDetailTab === tab.key}
                          className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                            manageDetailTab === tab.key
                              ? "bg-slate-100 dark:bg-surface-dark text-slate-900 dark:text-white"
                              : "text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-background-dark/70"
                          }`}
                          onClick={() =>
                            setManageDetailTab(
                              tab.key as "basic" | "scope" | "effects" | "preview"
                            )
                          }
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex-1 min-h-0 overflow-auto px-3 py-3">
                      {manageDetailTab === "basic" && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input
                              className="ui-input rounded-md px-2 py-1.5 text-sm"
                              value={editTitle}
                              onChange={(event) => setEditTitle(event.target.value)}
                              placeholder="标题"
                            />
                            <select
                              className="ui-select rounded-md px-2 py-1.5 text-sm"
                              value={editStatus}
                              onChange={(event) =>
                                setEditStatus(event.target.value as InsightStatus)
                              }
                            >
                              {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </div>
                          <textarea
                            className="ui-input w-full rounded-md px-2 py-1.5 text-sm min-h-[120px] resize-none"
                            value={editThesis}
                            onChange={(event) => setEditThesis(event.target.value)}
                            placeholder="观点论述"
                          />
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
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
                              保存
                            </props.Button>
                            <props.Button
                              variant="danger"
                              size="sm"
                              icon="delete"
                              onClick={() => void handleDeleteInsight()}
                              disabled={saving}
                            >
                              删除
                            </props.Button>
                          </div>
                        </div>
                      )}

                      {manageDetailTab === "scope" && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 md:grid-cols-[120px,120px,1fr,auto] gap-2">
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
                              <props.Button
                                variant="secondary"
                                size="sm"
                                icon="add"
                                onClick={() => void handleAddScopeRule()}
                                disabled={saving}
                              >
                                添加
                              </props.Button>
                            </div>
                            <div className="max-h-40 overflow-auto border border-slate-200 dark:border-border-dark">
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

                          <div className="space-y-2">
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
                            <div className="grid grid-cols-1 md:grid-cols-[1fr,1fr,auto] gap-2">
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
                            <div className="max-h-40 overflow-auto border border-slate-200 dark:border-border-dark">
                              {(materializedPreview?.symbols ??
                                detail.materializedTargets.map((item) => item.symbol))
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
                              {(materializedPreview?.symbols ?? detail.materializedTargets).length ===
                                0 && (
                                <div className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">
                                  暂无展开结果
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {manageDetailTab === "effects" && (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
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
                            <div className="max-h-48 overflow-auto border border-slate-200 dark:border-border-dark">
                              {detail.effectChannels.map((channel) => (
                                <div
                                  key={channel.id}
                                  className={`px-3 py-2 border-b border-slate-100 dark:border-border-dark/60 last:border-b-0 flex items-center justify-between gap-2 ${
                                    channel.id === selectedChannelId
                                      ? "bg-slate-100/60 dark:bg-black/10"
                                      : ""
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

                          <div className="space-y-2">
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              当前通道：
                              {selectedChannel ? (
                                <span className="font-mono">{selectedChannel.metricKey}</span>
                              ) : (
                                "未选择"
                              )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
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
                            <div className="max-h-48 overflow-auto border border-slate-200 dark:border-border-dark">
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
                      )}

                      {manageDetailTab === "preview" && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 md:grid-cols-[1fr,1fr,1fr,auto] gap-2">
                              <input
                                className="ui-input rounded-md px-2 py-1.5 text-sm font-mono"
                                placeholder="symbol"
                                value={valuationPreviewSymbol}
                                onChange={(event) =>
                                  setValuationPreviewSymbol(event.target.value)
                                }
                              />
                              <input
                                className="ui-input rounded-md px-2 py-1.5 text-sm"
                                placeholder="asOfDate (YYYY-MM-DD，可选)"
                                value={valuationPreviewAsOfDate}
                                onChange={(event) =>
                                  setValuationPreviewAsOfDate(event.target.value)
                                }
                              />
                              <input
                                className="ui-input rounded-md px-2 py-1.5 text-sm font-mono"
                                placeholder="methodKey (可选)"
                                value={valuationPreviewMethodKey}
                                onChange={(event) =>
                                  setValuationPreviewMethodKey(event.target.value)
                                }
                              />
                              <div className="flex items-center gap-2">
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
                                  onClick={() =>
                                    void handleUnlinkCurrentInsightFromPreviewSymbol()
                                  }
                                  disabled={!detail || saving}
                                >
                                  解绑当前观点
                                </props.Button>
                              </div>
                            </div>
                            {valuationPreviewLoading && (
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                估值预览中...
                              </div>
                            )}
                            {valuationPreviewResult && (
                              <>
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-xs">
                                  <div className="border border-slate-200 dark:border-border-dark px-2 py-1.5">
                                    <div className="text-slate-500 dark:text-slate-400">symbol</div>
                                    <div className="font-mono text-slate-900 dark:text-slate-100">
                                      {valuationPreviewResult.symbol}
                                    </div>
                                  </div>
                                  <div className="border border-slate-200 dark:border-border-dark px-2 py-1.5">
                                    <div className="text-slate-500 dark:text-slate-400">method</div>
                                    <div className="font-mono text-slate-900 dark:text-slate-100 truncate">
                                      {valuationPreviewResult.methodKey ?? "not_applicable"}
                                    </div>
                                  </div>
                                  <div className="border border-slate-200 dark:border-border-dark px-2 py-1.5">
                                    <div className="text-slate-500 dark:text-slate-400">当前值</div>
                                    <div className="font-mono text-slate-900 dark:text-slate-100">
                                      {valuationPreviewResult.baseValue ?? "--"}
                                    </div>
                                  </div>
                                  <div className="border border-slate-200 dark:border-border-dark px-2 py-1.5">
                                    <div className="text-slate-500 dark:text-slate-400">调整后值</div>
                                    <div className="font-mono text-slate-900 dark:text-slate-100">
                                      {valuationPreviewResult.adjustedValue ?? "--"}
                                    </div>
                                  </div>
                                  <div className="border border-slate-200 dark:border-border-dark px-2 py-1.5">
                                    <div className="text-slate-500 dark:text-slate-400">
                                      应用 effect 数
                                    </div>
                                    <div className="font-mono text-slate-900 dark:text-slate-100">
                                      {valuationPreviewResult.appliedEffects.length}
                                    </div>
                                  </div>
                                </div>
                                {valuationPreviewResult.notApplicable && (
                                  <div className="text-xs text-amber-700 dark:text-amber-400">
                                    not_applicable:{" "}
                                    {valuationPreviewResult.reason ?? "无可用估值方法"}
                                  </div>
                                )}
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  当前观点命中 effect 数：{currentInsightEffects.length}
                                </div>
                                <div className="max-h-44 overflow-auto border border-slate-200 dark:border-border-dark">
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

                          <div className="space-y-2">
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
                            <div className="max-h-52 overflow-auto border border-slate-200 dark:border-border-dark">
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
                      )}
                    </div>
                  </>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </props.Panel>
  );
}
