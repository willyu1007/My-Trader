import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  ValuationMethod,
  ValuationMethodDetail,
  ValuationMethodVersion
} from "@mytrader/shared";

export interface OtherValuationMethodsTabProps {
  Button: typeof import("../../shared").Button;
  formatDateTime: typeof import("../../shared").formatDateTime;
}

type AssetGroupKey =
  | "all"
  | "equity"
  | "futures"
  | "spot"
  | "forex"
  | "bond"
  | "generic";

type GraphLayer = "top" | "first_order" | "second_order" | "output" | "risk";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ASSET_GROUPS: Array<{ key: AssetGroupKey; label: string }> = [
  { key: "all", label: "全部" },
  { key: "equity", label: "股票/ETF" },
  { key: "futures", label: "期货" },
  { key: "spot", label: "现货/贵金属" },
  { key: "forex", label: "外汇" },
  { key: "bond", label: "债券/利率" },
  { key: "generic", label: "通用" }
];

const GRAPH_LAYER_ORDER: GraphLayer[] = [
  "top",
  "first_order",
  "second_order",
  "output",
  "risk"
];

const GRAPH_LAYER_LABELS: Record<GraphLayer, string> = {
  top: "顶层输入",
  first_order: "一阶参数",
  second_order: "二阶参数",
  output: "输出指标",
  risk: "风险指标"
};

const FORMULA_GUIDES: Record<
  string,
  {
    summary: string;
    steps: string[];
  }
> = {
  equity_factor_v1: {
    summary: "以市场价格为基准，结合动量与波动率惩罚得到公允值。",
    steps: [
      "fair_value = price * (1 + momentum) * (1 - volatility * 0.2)",
      "return_gap = fair_value / price - 1"
    ]
  },
  futures_basis_v1: {
    summary: "以基差修正现价，得到期货公允值估计。",
    steps: ["fair_value = price + basis", "return_gap = fair_value / price - 1"]
  },
  spot_carry_v1: {
    summary: "用 carry 年化因子修正现价。",
    steps: ["fair_value = price * (1 + carry)", "return_gap = fair_value / price - 1"]
  },
  forex_ppp_v1: {
    summary: "基于 PPP 偏离与市场价得到汇率估值。",
    steps: ["fair_value = price * (1 + ppp_gap)", "return_gap = fair_value / price - 1"]
  },
  bond_yield_v1: {
    summary: "基于久期与收益率冲击修正债券价格。",
    steps: [
      "fair_value = price * (1 - duration * yield_shift)",
      "return_gap = fair_value / price - 1"
    ]
  },
  generic_factor_v1: {
    summary: "通用多因子兜底方法，使用动量与波动率做基础修正。",
    steps: [
      "fair_value = price * (1 + momentum * 0.5) * (1 - volatility * 0.15)",
      "return_gap = fair_value / price - 1"
    ]
  }
};

const PARAM_GUIDES: Record<
  string,
  {
    label: string;
    meaning: string;
    range?: string;
  }
> = {
  alphaWeight: {
    label: "Alpha 权重",
    meaning: "主动收益因子在估值中的权重。",
    range: "0 ~ 1"
  },
  momentumWeight: {
    label: "动量权重",
    meaning: "趋势延续对估值结果的影响强度。",
    range: "0 ~ 1"
  },
  volatilityPenalty: {
    label: "波动率惩罚",
    meaning: "波动率上升时对估值的下修强度。",
    range: "0 ~ 1"
  },
  basisWeight: {
    label: "基差权重",
    meaning: "期货基差对公允值修正的权重。"
  },
  volPenalty: {
    label: "波动惩罚",
    meaning: "期货方法中波动率惩罚项。"
  },
  carryWeight: {
    label: "Carry 权重",
    meaning: "现货 carry 因子对公允值修正强度。"
  },
  pppWeight: {
    label: "PPP 权重",
    meaning: "购买力平价偏离项权重。"
  },
  durationWeight: {
    label: "久期权重",
    meaning: "收益率冲击传导到价格的权重。"
  }
};

const METRIC_GUIDES: Record<string, string> = {
  "market.price": "市场价格输入",
  "factor.momentum.20d": "20日动量输入",
  "risk.volatility.20d": "20日波动率输入",
  "factor.basis": "期货基差输入",
  "factor.carry.annualized": "现货 carry 年化输入",
  "factor.ppp_gap": "PPP 偏离输入",
  "risk.duration": "债券久期输入",
  "risk.yield_shift": "收益率冲击输入",
  "output.fair_value": "估值输出：公允值",
  "output.return_gap": "估值输出：收益偏离"
};

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function getFormulaId(version: ValuationMethodVersion | null): string {
  if (!version) return "generic_factor_v1";
  const manifestFormulaId = version.formulaManifest?.formulaId;
  if (typeof manifestFormulaId === "string" && manifestFormulaId.trim()) {
    return manifestFormulaId.trim();
  }
  const graphFormulaId = version.graph.find((node) => Boolean(node.formulaId))?.formulaId;
  return graphFormulaId?.trim() || "generic_factor_v1";
}

function inferAssetGroup(method: ValuationMethod): Exclude<AssetGroupKey, "all"> {
  const key = method.methodKey.toLowerCase();
  const assetClasses = method.assetScope.assetClasses.map((item) => item.toLowerCase());
  const kinds = method.assetScope.kinds.map((item) => item.toLowerCase());
  const domains = method.assetScope.domains.map((item) => String(item).toLowerCase());

  if (
    key.includes("equity") ||
    assetClasses.includes("stock") ||
    assetClasses.includes("etf") ||
    kinds.includes("stock") ||
    kinds.includes("fund") ||
    kinds.includes("index")
  ) {
    return "equity";
  }
  if (key.includes("futures") || kinds.includes("futures") || assetClasses.includes("futures")) {
    return "futures";
  }
  if (key.includes("spot") || kinds.includes("spot") || assetClasses.includes("spot")) {
    return "spot";
  }
  if (key.includes("forex") || kinds.includes("forex") || domains.includes("fx")) {
    return "forex";
  }
  if (
    key.includes("bond") ||
    kinds.includes("bond") ||
    kinds.includes("rate") ||
    domains.includes("bond") ||
    domains.includes("macro")
  ) {
    return "bond";
  }
  return "generic";
}

function formatScopeList(items: string[]): string {
  if (items.length === 0) return "--";
  return items.join(", ");
}

function areValuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

function toDraftString(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function parseDraftValue(raw: string): unknown {
  const value = raw.trim();
  if (!value) return "";
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return raw;
  }
}

export function OtherValuationMethodsTab(props: OtherValuationMethodsTabProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [assetGroup, setAssetGroup] = useState<AssetGroupKey>("all");
  const [showCustomMethods, setShowCustomMethods] = useState(false);
  const [methods, setMethods] = useState<ValuationMethod[]>([]);
  const [selectedMethodKey, setSelectedMethodKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<ValuationMethodDetail | null>(null);
  const [publishEffectiveFrom, setPublishEffectiveFrom] = useState("");
  const [publishEffectiveTo, setPublishEffectiveTo] = useState("");
  const [draftParamValues, setDraftParamValues] = useState<Record<string, string>>({});

  const marketApi = window.mytrader?.insights;

  const sortedVersions = useMemo(() => {
    if (!detail) return [];
    return [...detail.versions].sort((a, b) => b.version - a.version);
  }, [detail]);

  const selectedVersion = useMemo(() => {
    if (!detail) return null;
    if (detail.method.activeVersionId) {
      return sortedVersions.find((version) => version.id === detail.method.activeVersionId) ?? null;
    }
    return sortedVersions[0] ?? null;
  }, [detail, sortedVersions]);

  const previousVersion = useMemo(() => {
    if (!selectedVersion) return null;
    return sortedVersions.find((version) => version.version < selectedVersion.version) ?? null;
  }, [selectedVersion, sortedVersions]);

  const formulaId = useMemo(() => getFormulaId(selectedVersion), [selectedVersion]);
  const formulaGuide = FORMULA_GUIDES[formulaId] ?? FORMULA_GUIDES.generic_factor_v1;

  useEffect(() => {
    if (!selectedVersion) {
      setDraftParamValues({});
      return;
    }
    const nextDraft: Record<string, string> = {};
    for (const [key, value] of Object.entries(selectedVersion.paramSchema)) {
      nextDraft[key] = toDraftString(value);
    }
    setDraftParamValues(nextDraft);
  }, [selectedVersion]);

  const loadMethods = useCallback(
    async (methodKeyToKeep?: string | null) => {
      if (!marketApi) return;
      setLoading(true);
      setError(null);
      try {
        const result = await marketApi.listValuationMethods({
          query: query.trim() || null,
          includeArchived: false,
          includeBuiltin: true,
          limit: 500,
          offset: 0
        });
        const sortedMethods = [...result.items].sort((a, b) =>
          a.name.localeCompare(b.name, "zh-Hans-CN")
        );
        setMethods(sortedMethods);
        const preferred = methodKeyToKeep ?? selectedMethodKey ?? sortedMethods[0]?.methodKey ?? null;
        setSelectedMethodKey(preferred);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [marketApi, query, selectedMethodKey]
  );

  const loadDetail = useCallback(
    async (methodKey: string | null) => {
      if (!marketApi || !methodKey) {
        setDetail(null);
        return;
      }
      try {
        const nextDetail = await marketApi.getValuationMethod({ methodKey });
        setDetail(nextDetail);
      } catch (err) {
        setDetail(null);
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [marketApi]
  );

  useEffect(() => {
    void loadMethods();
  }, [loadMethods]);

  useEffect(() => {
    void loadDetail(selectedMethodKey);
  }, [loadDetail, selectedMethodKey]);

  const visibleMethods = useMemo(() => {
    if (showCustomMethods) return methods;
    return methods.filter((method) => method.isBuiltin);
  }, [methods, showCustomMethods]);

  const filteredMethods = useMemo(() => {
    if (assetGroup === "all") return visibleMethods;
    return visibleMethods.filter((method) => inferAssetGroup(method) === assetGroup);
  }, [assetGroup, visibleMethods]);

  useEffect(() => {
    if (!selectedMethodKey) {
      setSelectedMethodKey(filteredMethods[0]?.methodKey ?? null);
      return;
    }
    if (!filteredMethods.some((method) => method.methodKey === selectedMethodKey)) {
      setSelectedMethodKey(filteredMethods[0]?.methodKey ?? null);
    }
  }, [filteredMethods, selectedMethodKey]);

  const groupedMethods = useMemo(() => {
    const map = new Map<Exclude<AssetGroupKey, "all">, ValuationMethod[]>();
    for (const method of filteredMethods) {
      const key = inferAssetGroup(method);
      const list = map.get(key) ?? [];
      list.push(method);
      map.set(key, list);
    }
    return map;
  }, [filteredMethods]);

  const requiredMetrics = useMemo(
    () => normalizeStringArray(selectedVersion?.metricSchema["required"]),
    [selectedVersion]
  );

  const outputMetrics = useMemo(
    () => normalizeStringArray(selectedVersion?.metricSchema["outputs"]),
    [selectedVersion]
  );

  const graphByLayer = useMemo(() => {
    const grouped: Record<GraphLayer, Array<ValuationMethodVersion["graph"][number]>> = {
      top: [],
      first_order: [],
      second_order: [],
      output: [],
      risk: []
    };
    for (const node of selectedVersion?.graph ?? []) {
      const layer = node.layer as GraphLayer;
      if (grouped[layer]) {
        grouped[layer].push(node);
      }
    }
    return grouped;
  }, [selectedVersion]);

  const keyParams = useMemo(() => {
    if (!selectedVersion) return [];
    return Object.entries(selectedVersion.paramSchema)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => {
        const guide = PARAM_GUIDES[key];
        return {
          key,
          value,
          label: guide?.label ?? key,
          meaning: guide?.meaning ?? "参数含义待补充",
          range: guide?.range ?? "--"
        };
      });
  }, [selectedVersion]);

  const versionParamCompareRows = useMemo(() => {
    if (!selectedVersion || !previousVersion) return [];
    const current = selectedVersion.paramSchema;
    const previous = previousVersion.paramSchema;
    const keys = Array.from(new Set([...Object.keys(current), ...Object.keys(previous)])).sort();
    return keys
      .map((key) => ({
        key,
        previous: key in previous ? previous[key] : "--",
        current: key in current ? current[key] : "--"
      }))
      .filter((row) => !areValuesEqual(row.previous, row.current));
  }, [previousVersion, selectedVersion]);

  const handleSetActiveVersion = useCallback(
    async (versionId: string) => {
      if (!marketApi || !detail) return;
      setSaving(true);
      setError(null);
      setNotice(null);
      try {
        const updated = await marketApi.setActiveValuationMethodVersion({
          methodKey: detail.method.methodKey,
          versionId
        });
        setDetail(updated);
        setNotice("当前版本已切换。");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setSaving(false);
      }
    },
    [detail, marketApi]
  );

  const handlePublishVersion = useCallback(async () => {
    if (!marketApi || !detail || !selectedVersion) return;
    if (detail.method.isBuiltin) {
      setError("内置方法只读，当前界面不直接发布内置方法版本。");
      return;
    }
    if (publishEffectiveFrom && !DATE_RE.test(publishEffectiveFrom)) {
      setError("生效开始日期格式必须是 YYYY-MM-DD。");
      return;
    }
    if (publishEffectiveTo && !DATE_RE.test(publishEffectiveTo)) {
      setError("生效结束日期格式必须是 YYYY-MM-DD。");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const paramSchema: Record<string, unknown> = {};
      for (const [key, rawValue] of Object.entries(draftParamValues)) {
        paramSchema[key] = parseDraftValue(rawValue);
      }
      const updated = await marketApi.publishValuationMethodVersion({
        methodKey: detail.method.methodKey,
        effectiveFrom: publishEffectiveFrom || null,
        effectiveTo: publishEffectiveTo || null,
        graph: selectedVersion.graph,
        paramSchema,
        metricSchema: selectedVersion.metricSchema
      });
      setDetail(updated);
      setPublishEffectiveFrom("");
      setPublishEffectiveTo("");
      setNotice("已发布新版本参数快照。");
      await loadMethods(updated.method.methodKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [
    detail,
    draftParamValues,
    loadMethods,
    marketApi,
    publishEffectiveFrom,
    publishEffectiveTo,
    selectedVersion
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {ASSET_GROUPS.map((group) => {
            const active = assetGroup === group.key;
            return (
              <button
                key={group.key}
                type="button"
                className={`px-2.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  active
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "border-slate-200 dark:border-border-dark text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-background-dark/60"
                }`}
                onClick={() => setAssetGroup(group.key)}
              >
                {group.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded border border-slate-200 dark:border-border-dark px-2 py-1 text-xs text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={showCustomMethods}
              onChange={(event) => setShowCustomMethods(event.target.checked)}
            />
            显示自定义
          </label>
          <props.Button
            variant="secondary"
            size="sm"
            icon="refresh"
            onClick={() => void loadMethods(selectedMethodKey)}
            disabled={loading || saving}
          >
            刷新
          </props.Button>
        </div>
      </div>

      {!marketApi && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          当前环境未注入 desktop API，无法加载估值方法。
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

      <div className="rounded-lg border border-slate-200 dark:border-border-dark bg-white/70 dark:bg-panel-dark/70">
        <div className="grid grid-cols-12 gap-0">
          <aside className="col-span-4 border-r border-slate-200 dark:border-border-dark">
            <div className="p-3 border-b border-slate-200 dark:border-border-dark space-y-2">
              <input
                className="ui-input w-full rounded-md px-2 py-1.5 text-sm"
                placeholder="搜索 methodKey / 名称"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void loadMethods(selectedMethodKey);
                  }
                }}
              />
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                重点展示各资产可用方法、关键参数和计算链路。
              </div>
            </div>

            <div className="max-h-[760px] overflow-y-auto">
              {loading && (
                <div className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">加载中...</div>
              )}
              {!loading && filteredMethods.length === 0 && (
                <div className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">
                  当前筛选下暂无方法。
                </div>
              )}
              {!loading &&
                ASSET_GROUPS.filter((group) => group.key !== "all")
                  .filter((group) => assetGroup === "all" || assetGroup === group.key)
                  .map((group) => {
                    const groupMethods =
                      groupedMethods.get(group.key as Exclude<AssetGroupKey, "all">) ?? [];
                    if (groupMethods.length === 0) return null;
                    return (
                      <div key={group.key}>
                        <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-border-dark/60 bg-slate-50/70 dark:bg-background-dark/40">
                          {group.label} · {groupMethods.length}
                        </div>
                        {groupMethods.map((method) => {
                          const active = method.methodKey === selectedMethodKey;
                          return (
                            <button
                              key={method.methodKey}
                              type="button"
                              className={`w-full text-left px-3 py-2 border-b border-slate-100 dark:border-border-dark/60 transition-colors ${
                                active
                                  ? "bg-slate-100 dark:bg-background-dark/80"
                                  : "hover:bg-slate-50 dark:hover:bg-background-dark/60"
                              }`}
                              onClick={() => setSelectedMethodKey(method.methodKey)}
                            >
                              <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                {method.name}
                              </div>
                              <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {method.methodKey}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
            </div>
          </aside>

          <section className="col-span-8 p-4 space-y-4">
            {!detail && (
              <div className="text-sm text-slate-500 dark:text-slate-400">请选择左侧方法查看详情。</div>
            )}

            {detail && (
              <>
                <div className="rounded-md border border-slate-200 dark:border-border-dark p-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {detail.method.name}
                      </div>
                      <div className="font-mono text-xs text-slate-500 dark:text-slate-400 truncate">
                        {detail.method.methodKey}
                      </div>
                    </div>
                    <div className="text-[11px] text-right text-slate-500 dark:text-slate-400">
                      <div>active: v{selectedVersion?.version ?? "--"}</div>
                      <div>formula: {formulaId}</div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    {detail.method.description ?? "暂无说明"}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    适用范围：asset_classes[{formatScopeList(detail.method.assetScope.assetClasses)}] ·
                    kinds[{formatScopeList(detail.method.assetScope.kinds)}] · markets[
                    {formatScopeList(detail.method.assetScope.markets)}] · domains[
                    {formatScopeList(detail.method.assetScope.domains.map(String))}]
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    created: {props.formatDateTime(detail.method.createdAt)} · updated:{" "}
                    {props.formatDateTime(detail.method.updatedAt)}
                  </div>
                </div>

                <div className="rounded-md border border-slate-200 dark:border-border-dark p-3 space-y-2">
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-100">计算逻辑</div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">{formulaGuide.summary}</div>
                  <div className="space-y-1">
                    {formulaGuide.steps.map((step) => (
                      <div key={step} className="font-mono text-[11px] text-slate-700 dark:text-slate-200">
                        {step}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-md border border-slate-200 dark:border-border-dark p-3 space-y-2">
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    关键参数（含义）
                  </div>
                  <div className="max-h-48 overflow-auto rounded border border-slate-200 dark:border-border-dark">
                    {keyParams.map((item) => (
                      <div
                        key={item.key}
                        className="px-3 py-2 border-b border-slate-100 dark:border-border-dark/60 last:border-b-0"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {item.label}
                          </div>
                          <div className="font-mono text-xs text-slate-900 dark:text-slate-100">
                            {String(item.value)}
                          </div>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">{item.key}</div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300">
                          {item.meaning}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          建议范围：{item.range}
                        </div>
                      </div>
                    ))}
                    {keyParams.length === 0 && (
                      <div className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">暂无参数。</div>
                    )}
                  </div>
                </div>

                <div className="rounded-md border border-slate-200 dark:border-border-dark p-3 space-y-2">
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    输入与输出指标
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">输入</div>
                      <div className="space-y-1">
                        {requiredMetrics.map((metric) => (
                          <div key={metric} className="text-[11px]">
                            <span className="font-mono text-slate-900 dark:text-slate-100">{metric}</span>
                            <span className="text-slate-500 dark:text-slate-400">
                              {" "}
                              · {METRIC_GUIDES[metric] ?? "含义待补充"}
                            </span>
                          </div>
                        ))}
                        {requiredMetrics.length === 0 && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">暂无</div>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">输出</div>
                      <div className="space-y-1">
                        {outputMetrics.map((metric) => (
                          <div key={metric} className="text-[11px]">
                            <span className="font-mono text-slate-900 dark:text-slate-100">{metric}</span>
                            <span className="text-slate-500 dark:text-slate-400">
                              {" "}
                              · {METRIC_GUIDES[metric] ?? "含义待补充"}
                            </span>
                          </div>
                        ))}
                        {outputMetrics.length === 0 && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">暂无</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-md border border-slate-200 dark:border-border-dark p-3 space-y-2">
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    指标层级图（顶层/一阶/二阶/风险）
                  </div>
                  <div className="space-y-2">
                    {GRAPH_LAYER_ORDER.map((layer) => {
                      const nodes = graphByLayer[layer];
                      if (nodes.length === 0) return null;
                      return (
                        <div key={layer} className="rounded border border-slate-200 dark:border-border-dark">
                          <div className="px-2 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-border-dark bg-slate-50/70 dark:bg-background-dark/40">
                            {GRAPH_LAYER_LABELS[layer]}
                          </div>
                          <div className="max-h-28 overflow-y-auto">
                            {nodes.map((node) => (
                              <div
                                key={node.key}
                                className="px-2 py-1.5 border-b border-slate-100 dark:border-border-dark/60 last:border-b-0"
                              >
                                <div className="font-mono text-[11px] text-slate-900 dark:text-slate-100">
                                  {node.key}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                  depends: {node.dependsOn.join(", ") || "--"} · unit: {node.unit}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-md border border-slate-200 dark:border-border-dark p-3 space-y-3">
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-100">版本时间轴</div>
                  <div className="max-h-44 overflow-y-auto rounded border border-slate-200 dark:border-border-dark">
                    {sortedVersions.map((version) => {
                      const isActive = version.id === detail.method.activeVersionId;
                      return (
                        <div
                          key={version.id}
                          className="px-3 py-2 border-b border-slate-100 dark:border-border-dark/60 last:border-b-0 flex items-center justify-between gap-3"
                        >
                          <div>
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                              v{version.version} {isActive ? "(当前)" : ""}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {version.effectiveFrom ?? "--"} ~ {version.effectiveTo ?? "--"}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              created: {props.formatDateTime(version.createdAt)}
                            </div>
                          </div>
                          <props.Button
                            variant="secondary"
                            size="sm"
                            icon="check_circle"
                            onClick={() => void handleSetActiveVersion(version.id)}
                            disabled={saving || isActive}
                          >
                            设为当前
                          </props.Button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-md border border-slate-200 dark:border-border-dark p-3 space-y-3">
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    版本差异（简化）
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    当前版本：v{selectedVersion?.version ?? "--"}；对照版本：
                    {previousVersion ? `v${previousVersion.version}` : "无（首个版本）"}
                  </div>
                  {!previousVersion && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      当前方法暂无可对照历史版本。
                    </div>
                  )}
                  {previousVersion && (
                    <div className="max-h-44 overflow-y-auto rounded border border-slate-200 dark:border-border-dark">
                      {versionParamCompareRows.map((row) => (
                        <div
                          key={row.key}
                          className="px-3 py-2 border-b border-slate-100 dark:border-border-dark/60 last:border-b-0 text-[11px]"
                        >
                          <div className="font-mono text-slate-900 dark:text-slate-100">{row.key}</div>
                          <div className="text-slate-500 dark:text-slate-400">
                            prev: {String(row.previous)}
                          </div>
                          <div className="text-slate-700 dark:text-slate-200">
                            curr: {String(row.current)}
                          </div>
                        </div>
                      ))}
                      {versionParamCompareRows.length === 0 && (
                        <div className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">
                          参数无差异。
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-md border border-slate-200 dark:border-border-dark p-3 space-y-3">
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    版本维护（轻量调参）
                  </div>
                  {detail.method.isBuiltin ? (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      内置方法当前保持只读，本页主要用于审阅方法体系与版本差异。
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          className="ui-input rounded-md px-2 py-1.5 text-sm"
                          placeholder="effectiveFrom (YYYY-MM-DD)"
                          value={publishEffectiveFrom}
                          onChange={(event) => setPublishEffectiveFrom(event.target.value)}
                        />
                        <input
                          className="ui-input rounded-md px-2 py-1.5 text-sm"
                          placeholder="effectiveTo (YYYY-MM-DD)"
                          value={publishEffectiveTo}
                          onChange={(event) => setPublishEffectiveTo(event.target.value)}
                        />
                      </div>

                      <div className="max-h-44 overflow-y-auto rounded border border-slate-200 dark:border-border-dark">
                        {Object.entries(draftParamValues).map(([key, value]) => (
                          <div
                            key={key}
                            className="px-3 py-2 border-b border-slate-100 dark:border-border-dark/60 last:border-b-0"
                          >
                            <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                              {key}
                            </div>
                            <input
                              className="ui-input w-full rounded-md px-2 py-1.5 text-sm"
                              value={value}
                              onChange={(event) =>
                                setDraftParamValues((previous) => ({
                                  ...previous,
                                  [key]: event.target.value
                                }))
                              }
                            />
                          </div>
                        ))}
                        {Object.keys(draftParamValues).length === 0 && (
                          <div className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">
                            当前版本暂无可编辑参数。
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          公式代码固定，发版仅提交参数快照。
                        </div>
                        <props.Button
                          variant="primary"
                          size="sm"
                          icon="new_releases"
                          onClick={() => void handlePublishVersion()}
                          disabled={saving}
                        >
                          发布版本
                        </props.Button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
