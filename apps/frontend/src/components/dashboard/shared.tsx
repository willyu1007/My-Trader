import {
  Component,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from "react";
import type React from "react";

import type {
  AssetClass,
  CorporateActionKind,
  CorporateActionMeta,
  ContributionEntry,
  DataQualityLevel,
  LedgerEntry,
  LedgerEntryMeta,
  LedgerEventType,
  LedgerSide,
  LedgerSource,
  MarketTargetsConfig,
  MarketQuote,
  MarketDailyBar,
  MarketDataQuality,
  MarketIngestControlStatus,
  MarketIngestRun,
  MarketIngestSchedulerConfig,
  MarketUniversePoolBucketStatus,
  MarketUniversePoolConfig,
  MarketTokenStatus,
  PerformanceMethod,
  PortfolioPerformanceSeries,
  RiskSeriesMetrics,
  RiskLimitType,
  TagSummary,
  TagFacetTheme
} from "@mytrader/shared";

type CorporateActionKindUi = CorporateActionKind | "dividend";
type MarketChartRangeKey =
  | "1D"
  | "1W"
  | "1M"
  | "3M"
  | "6M"
  | "YTD"
  | "1Y"
  | "2Y"
  | "5Y"
  | "10Y";
type UniversePoolBucketId = MarketUniversePoolBucketStatus["bucket"];

interface LedgerFormState {
  id?: string;
  eventType: LedgerEventType;
  tradeDate: string;
  eventTime: string;
  sequence: string;
  accountKey: string;
  instrumentId: string;
  symbol: string;
  side: LedgerSide | "";
  quantity: string;
  price: string;
  priceCurrency: string;
  cashAmount: string;
  cashCurrency: string;
  fee: string;
  tax: string;
  feeRate: string;
  taxRate: string;
  cashAmountAuto: boolean;
  note: string;
  source: LedgerSource;
  externalId: string;
  corporateKind: CorporateActionKindUi;
  corporateAfterShares: string;
}

interface TargetPoolCategoryDetail {
  key: string;
  label: string;
  symbols: string[];
}

interface TargetPoolStructureStats {
  totalSymbols: number;
  industryL1Count: number;
  industryL2Count: number;
  conceptCount: number;
  unclassifiedCount: number;
  classificationCoverage: number | null;
  allSymbols: string[];
  classifiedSymbols: string[];
  industryL1Details: TargetPoolCategoryDetail[];
  industryL2Details: TargetPoolCategoryDetail[];
  conceptDetails: TargetPoolCategoryDetail[];
  unclassifiedSymbols: string[];
  symbolNames: Record<string, string | null>;
  loading: boolean;
  error: string | null;
}

const assetClassLabels: Record<AssetClass, string> = {
  stock: "股票",
  etf: "ETF",
  cash: "现金"
};

const riskLimitTypeLabels: Record<RiskLimitType, string> = {
  position_weight: "持仓权重",
  asset_class_weight: "资产类别权重"
};

const ledgerEventTypeLabels: Record<LedgerEventType, string> = {
  trade: "交易",
  cash: "现金流",
  fee: "费用（历史）",
  tax: "税费（历史）",
  dividend: "公司行为·分红",
  adjustment: "调整（历史）",
  corporate_action: "公司行为"
};

const ledgerEventTypeOptions: { value: LedgerEventType; label: string }[] = [
  { value: "trade", label: ledgerEventTypeLabels.trade },
  { value: "cash", label: ledgerEventTypeLabels.cash },
  { value: "corporate_action", label: ledgerEventTypeLabels.corporate_action }
];

const ledgerSideLabels: Record<LedgerSide, string> = {
  buy: "买入",
  sell: "卖出"
};

const ledgerSourceLabels: Record<LedgerSource, string> = {
  manual: "手动",
  csv: "文件导入",
  broker_import: "券商导入",
  system: "系统"
};

const corporateActionKindLabels: Record<CorporateActionKindUi, string> = {
  split: "拆股",
  reverse_split: "合股",
  info: "信息",
  dividend: "分红"
};

const corporateActionCategoryLabels: Record<string, string> = {
  decision: "关键决策",
  org_change: "组织调整",
  policy_support: "政策支持",
  other: "其他"
};
// --- UI Components ---

export function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-transparent mb-4 last:mb-0">
      <div className="px-4 py-3">
        {children}
      </div>
    </div>
  );
}

export function PlaceholderPanel({ title, description }: { title: string, description: string }) {
   return (
      <Panel>
         <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <span className="material-icons-outlined text-5xl mb-4 opacity-30">construction</span>
            <h3 className="text-lg font-medium text-slate-600 dark:text-slate-300 mb-2">{title}</h3>
            <p className="text-sm opacity-80">{description}</p>
            <p className="text-xs mt-4 opacity-50">该模块为占位视图，将在后续版本逐步实现。</p>
         </div>
      </Panel>
   )
}

export function Modal({
  open,
  title,
  onClose,
  children
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined") return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 ui-modal-backdrop"
        aria-label="关闭弹层"
        onClick={onClose}
      />
      <div className="ui-modal-panel relative w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-xl shadow-2xl">
        <div className="ui-modal-header flex items-center justify-between px-4 py-3 backdrop-blur">
          <div className="text-sm font-semibold text-[color:var(--mt-text)]">
            {title}
          </div>
          <IconButton icon="close" label="关闭" onClick={onClose} />
        </div>
        <div className="p-4 overflow-auto max-h-[calc(85vh-52px)]">
          {children}
        </div>
      </div>
    </div>
  );
}

export function FormGroup({ label, children }: { label: React.ReactNode, children: React.ReactNode }) {
  return (
    <fieldset className="space-y-1.5 border-0 m-0 p-0 min-w-0">
      <legend className="ui-form-label block w-full px-0 text-sm font-medium">
        {label}
      </legend>
      {children}
    </fieldset>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}
export function Input({ className, id, name, ...props }: InputProps) {
  const generatedId = useId();
  const resolvedId = id ?? `mt-input-${generatedId.replace(/:/g, "")}`;
  const resolvedName = name ?? resolvedId;
  const isDateInput =
    props.type === "date" || props.type === "datetime-local";
  const isEmpty =
    props.value === "" || props.value === undefined || props.value === null;
  const dateHintClass =
    isDateInput && isEmpty ? "ui-tone-neutral" : "";

  return (
    <input
      className={`ui-input block w-full rounded-md py-1.5 focus:ring-2 focus:ring-primary sm:text-sm sm:leading-6 disabled:opacity-50 ${dateHintClass} ${className}`}
      id={resolvedId}
      name={resolvedName}
      {...props}
    />
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string, label: string, disabled?: boolean }[];
}
export function Select({ className, options, id, name, ...props }: SelectProps) {
  const generatedId = useId();
  const resolvedId = id ?? `mt-select-${generatedId.replace(/:/g, "")}`;
  const resolvedName = name ?? resolvedId;

  return (
    <select
      className={`ui-select block w-full rounded-md py-1.5 pl-3 pr-10 focus:ring-2 focus:ring-primary sm:text-sm sm:leading-6 ${className}`}
      id={resolvedId}
      name={resolvedName}
      {...props}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</option>
      ))}
    </select>
  );
}

export interface PopoverSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export function PopoverSelect({
  value,
  options,
  onChangeValue,
  disabled,
  className,
  buttonClassName,
  rightAccessory
}: {
  value: string;
  options: PopoverSelectOption[];
  onChangeValue: (value: string) => void;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  rightAccessory?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => options.find((opt) => opt.value === value) ?? null,
    [options, value]
  );
  const hasRightAccessory = Boolean(rightAccessory);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current && rootRef.current.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={`ui-popover-button relative h-6 w-full rounded-md border pl-2 text-left text-xs transition-colors disabled:opacity-60 ${
          hasRightAccessory ? "pr-14" : "pr-8"
        } ${buttonClassName ?? ""}`}
      >
        <span className={`block truncate ${hasRightAccessory ? "pr-10" : "pr-6"}`}>
          {selected?.label ?? "--"}
        </span>
        <span
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 material-icons-outlined text-[18px] text-slate-400 ${
            hasRightAccessory ? "right-8" : "right-3"
          }`}
        >
          expand_more
        </span>
        {hasRightAccessory && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
            {rightAccessory}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50">
          <div
            role="listbox"
            className="ui-popover-menu max-h-72 overflow-auto rounded-md border p-1"
          >
            {options.map((opt) => {
              const isActive = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  disabled={opt.disabled}
                  onClick={() => {
                    if (opt.disabled) return;
                    setOpen(false);
                    onChangeValue(opt.value);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-left text-xs transition-colors ${
                    opt.disabled
                      ? "opacity-50 cursor-not-allowed"
                      : isActive
                        ? "ui-popover-option isActive"
                        : "ui-popover-option"
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isActive && (
                    <span className="material-icons-outlined text-base text-primary">
                      check
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md';
  icon?: string;
}
export function Button({ children, variant = 'secondary', size = 'md', icon, className, ...props }: ButtonProps) {
  const baseClass = "ui-btn inline-flex items-center justify-center rounded-[4px] border font-medium whitespace-nowrap break-keep shrink-0 transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:brightness-90 disabled:saturate-80 disabled:shadow-none";
  
  const variants = {
    primary: "ui-btn-primary focus:ring-primary/45",
    secondary: "ui-btn-secondary focus:ring-primary/35",
    danger: "ui-btn-danger focus:ring-primary/35"
  };
  
  const sizes = {
    sm: "px-2.5 py-1.5 text-xs",
    md: "px-4 py-2 text-sm"
  };
  const hasChildren = children !== undefined && children !== null && children !== false;

  return (
    <button 
      className={`${baseClass} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {icon && (
        <span
          className={`material-icons-outlined ${
            size === "sm" ? "text-sm" : "text-base"
          } ${hasChildren ? (size === "sm" ? "mr-1.5" : "mr-2") : ""}`}
        >
          {icon}
        </span>
      )}
      {children}
    </button>
  );
}

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  label: string;
  size?: "sm" | "md";
}

export function IconButton({
  icon,
  label,
  size = "md",
  className,
  ...props
}: IconButtonProps) {
  const sizeClass = size === "sm" ? "p-1.5" : "p-2";
  const iconClass = size === "sm" ? "text-sm" : "text-base";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`ui-icon-btn inline-flex items-center justify-center rounded-[4px] border ${sizeClass} transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      <span className={`material-icons-outlined ${iconClass}`}>{icon}</span>
    </button>
  );
}

export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="ui-badge inline-flex items-center rounded-md px-2 py-1 text-xs font-medium">
      {children}
    </span>
  );
}

export function MarketQuoteHeader({ quote }: { quote: MarketQuote | null }) {
  const tone = getCnChangeTone(quote?.changePct ?? null);
  return (
    <div className="text-right">
      <div className="text-3xl font-mono font-semibold text-[color:var(--mt-text)]">
        {formatNumber(quote?.close ?? null, 2)}
      </div>
      <div className={`mt-1 font-mono text-sm ${getCnToneTextClass(tone)}`}>
        {formatSignedNumberNullable(quote?.change ?? null, 2)}（
        {formatSignedPctNullable(quote?.changePct ?? null)}）
      </div>
    </div>
  );
}

export class ChartErrorBoundary extends Component<
  { children: React.ReactNode; resetKey?: string | number },
  { error: string | null; lastResetKey?: string | number }
> {
  constructor(props: { children: React.ReactNode; resetKey?: string | number }) {
    super(props);
    this.state = { error: null, lastResetKey: props.resetKey };
  }

  static getDerivedStateFromProps(
    props: { resetKey?: string | number },
    state: { error: string | null; lastResetKey?: string | number }
  ): { error: string | null; lastResetKey?: string | number } | null {
    if (props.resetKey !== state.lastResetKey) {
      return { error: null, lastResetKey: props.resetKey };
    }
    return null;
  }

  static getDerivedStateFromError(error: unknown): { error: string } {
    return { error: toUserErrorMessage(error) };
  }

  componentDidCatch(error: unknown) {
    console.error("[mytrader] MarketAreaChart crashed", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="ui-tone-neutral h-full flex items-center justify-center text-sm">
          图表渲染失败：{this.state.error}
        </div>
      );
    }
    return this.props.children;
  }
}

export function MarketAreaChart({
  bars,
  tone,
  onHoverDatumChange
}: {
  bars: MarketDailyBar[];
  tone: ChangeTone;
  onHoverDatumChange?: (datum: { date: string; close: number } | null) => void;
}) {
  const colors = getCnToneColors(tone);
  const gradientId = useId();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const hoverDatumRef = useRef<{ date: string; close: number } | null>(null);
  const hoverIndexRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const latestClientXRef = useRef<number | null>(null);
  const series = useMemo(
    () =>
      bars
        .map((bar) => ({ date: bar.date, close: bar.close ?? null }))
        .filter(
          (bar): bar is { date: string; close: number } =>
            bar.close !== null && Number.isFinite(bar.close)
        ),
    [bars]
  );

  if (series.length < 2) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-slate-300">
        暂无足够数据绘制图表。
      </div>
    );
  }

  const width = 800;
  const height = 360;
  const paddingLeft = 18;
  const paddingRight = 72;
  const paddingTop = 12;
  const paddingBottom = 18;

  const values = series.map((point) => point.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const geometry = useMemo(() => {
    const points = series.map((point, idx) => {
      const x = paddingLeft + (idx / (series.length - 1)) * chartWidth;
      const y = paddingTop + (1 - (point.close - min) / span) * chartHeight;
      return { x, y };
    });
    const path = points
      .map((point, idx) => `${idx === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");
    const area = `${path} L ${points[points.length - 1].x} ${
      height - paddingBottom
    } L ${points[0].x} ${height - paddingBottom} Z`;
    return { points, path, area };
  }, [
    chartHeight,
    chartWidth,
    height,
    min,
    paddingBottom,
    paddingLeft,
    paddingTop,
    series,
    span
  ]);

  const hoverPoint =
    hoverIndex === null ? null : geometry.points[hoverIndex] ?? null;
  const hoverDatum = hoverIndex === null ? null : series[hoverIndex] ?? null;

  useEffect(() => {
    const datum = hoverDatum ? { date: hoverDatum.date, close: hoverDatum.close } : null;
    if (
      hoverDatumRef.current?.date === datum?.date &&
      hoverDatumRef.current?.close === datum?.close
    ) {
      return;
    }
    hoverDatumRef.current = datum;
    onHoverDatumChange?.(datum);
  }, [hoverDatum, onHoverDatumChange]);

  const path = geometry.path;
  const area = geometry.area;
  const yTicks = [max, (max + min) / 2, min];
  const gridLines = 5;
  const hoverStroke = "var(--mt-chart-hover)";

  const flushHoverIndex = useCallback(() => {
    rafIdRef.current = null;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (!rect.width) return;
    const clientX = latestClientXRef.current;
    if (clientX === null) return;

    const ratioX = (clientX - rect.left) / rect.width;
    const x = ratioX * width;
    const idxFloat = ((x - paddingLeft) / chartWidth) * (series.length - 1);
    const idx = Math.min(series.length - 1, Math.max(0, Math.round(idxFloat)));

    if (idx === hoverIndexRef.current) return;
    hoverIndexRef.current = idx;
    setHoverIndex(idx);
  }, [chartWidth, paddingLeft, series.length]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="w-full h-full"
      onPointerMove={(event) => {
        latestClientXRef.current = event.clientX;
        if (rafIdRef.current === null) {
          rafIdRef.current = requestAnimationFrame(flushHoverIndex);
        }
      }}
      onPointerLeave={() => {
        setHoverIndex(null);
        hoverIndexRef.current = null;
        hoverDatumRef.current = null;
        latestClientXRef.current = null;
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        onHoverDatumChange?.(null);
      }}
    >
      <defs>
        <linearGradient
          id={`market-area-fill-${gradientId}`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0%" stopColor={colors.fill} stopOpacity="0.28" />
          <stop offset="100%" stopColor={colors.fill} stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect
        x={paddingLeft}
        y={paddingTop}
        width={chartWidth}
        height={chartHeight}
        fill="transparent"
        pointerEvents="none"
      />

      {Array.from({ length: gridLines }, (_, idx) => {
        const y = paddingTop + (idx / (gridLines - 1)) * chartHeight;
        return (
          <line
            key={`grid-${idx}`}
            x1={paddingLeft}
            x2={width - paddingRight}
            y1={y}
            y2={y}
            stroke="var(--mt-chart-grid)"
            strokeWidth="1"
          />
        );
      })}

      <path d={area} fill={`url(#market-area-fill-${gradientId})`} />
      <path d={path} fill="none" stroke={colors.line} strokeWidth="2.2" />

      {hoverPoint && hoverDatum && (
        <>
          <line
            x1={hoverPoint.x}
            x2={hoverPoint.x}
            y1={paddingTop}
            y2={height - paddingBottom}
            stroke={hoverStroke}
            strokeWidth="1"
          />
          <circle
            cx={hoverPoint.x}
            cy={hoverPoint.y}
            r={3.5}
            fill={colors.line}
            stroke="var(--mt-chart-axis)"
            strokeWidth="1"
          />

        </>
      )}

      {yTicks.map((tick, idx) => {
        const y = paddingTop + (idx / (yTicks.length - 1)) * chartHeight;
        return (
          <text
            key={`y-${idx}`}
            x={width - 12}
            y={y + 4}
            textAnchor="end"
            fontSize="12"
            fill="var(--mt-chart-label)"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
          >
            {formatNumber(tick, 2)}
          </text>
        );
      })}
    </svg>
  );
}

export function MarketVolumeMiniChart({
  bars,
  mode,
  activeDate,
}: {
  bars: MarketDailyBar[];
  mode: "volume" | "moneyflow";
  activeDate: string | null;
}) {
  const series = useMemo(() => {
    return bars
      .map((bar) => ({
        date: bar.date,
        volume: bar.volume,
        netMfVol: bar.netMfVol ?? null
      }))
      .filter(
        (row): row is { date: string; volume: number; netMfVol: number | null } =>
          row.volume !== null && Number.isFinite(row.volume)
      );
  }, [bars]);

  if (series.length < 2) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
        --
      </div>
    );
  }

  const width = 800;
  const height = 80;
  const paddingTop = 6;
  const paddingBottom = 6;

  const values = series.map((row) => {
    if (mode === "volume") return row.volume;
    return row.netMfVol ?? 0;
  });

  const maxAbs =
    mode === "moneyflow"
      ? Math.max(1, ...values.map((value) => Math.abs(value)))
      : Math.max(1, ...values);

  const chartHeight = height - paddingTop - paddingBottom;
  const barWidth = width / series.length;
  const baselineY = mode === "moneyflow" ? paddingTop + chartHeight / 2 : height - paddingBottom;
  const scale = mode === "moneyflow" ? chartHeight / 2 / maxAbs : chartHeight / maxAbs;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-full">
      {mode === "moneyflow" && (
        <line
          x1={0}
          x2={width}
          y1={baselineY}
          y2={baselineY}
          stroke="var(--mt-chart-grid)"
          strokeWidth="1"
        />
      )}
      {series.map((row, idx) => {
        const value = values[idx] ?? 0;
        const isActive = activeDate !== null && row.date === activeDate;
        const x = idx * barWidth;
        const w = Math.max(1, barWidth - 1);

        let y = baselineY;
        let h = 0;
        if (mode === "moneyflow") {
          const scaled = value * scale;
          if (scaled >= 0) {
            y = baselineY - scaled;
            h = scaled;
          } else {
            y = baselineY;
            h = Math.abs(scaled);
          }
        } else {
          h = value * scale;
          y = baselineY - h;
        }

        const fill =
          mode === "moneyflow"
            ? value >= 0
              ? "var(--mt-chart-moneyflow-pos)"
              : "var(--mt-chart-moneyflow-neg)"
            : "var(--mt-chart-volume)";

        return (
          <rect
            key={row.date}
            x={x}
            y={y}
            width={w}
            height={h <= 0 ? 0 : Math.max(1, h)}
            fill={fill}
            stroke={isActive ? "var(--mt-chart-hover)" : "transparent"}
            strokeWidth={isActive ? 1 : 0}
            opacity={isActive ? 1 : 0.85}
          />
        );
      })}
    </svg>
  );
}

export function SummaryCard({ label, value, trend }: { label: string, value: string, trend?: 'up' | 'down' }) {
  return (
    <div className="bg-slate-50 dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark rounded-lg p-4 border border-slate-200 dark:border-border-dark">
       <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</div>
       <div className={`text-xl font-bold font-mono ${
          trend === 'up' ? 'text-green-600 dark:text-green-500' : 
          trend === 'down' ? 'text-red-600 dark:text-red-500' : 
          'text-slate-900 dark:text-white'
       }`}>
          {value}
       </div>
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-slate-400 bg-slate-50/50 dark:bg-background-dark rounded-lg border border-dashed border-slate-200 dark:border-border-dark">
      <span className="material-icons-outlined text-3xl mb-2 opacity-50">inbox</span>
      <p className="text-sm">{message}</p>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-4 px-4 text-sm text-rose-600 bg-rose-50 dark:bg-rose-900/20 rounded-lg border border-rose-200 dark:border-rose-900/40">
      <div className="flex items-center gap-2">
        <span className="material-icons-outlined text-base">error_outline</span>
        <span>{message}</span>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          重试
        </Button>
      )}
    </div>
  );
}

export function HelpHint({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleOpen = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => setOpen(true), 500);
  };

  const closeHint = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setOpen(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={scheduleOpen}
      onMouseLeave={closeHint}
      onFocus={scheduleOpen}
      onBlur={closeHint}
    >
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded-none border border-slate-300 dark:border-border-dark text-[10px] text-slate-500 dark:text-slate-300 cursor-help"
        aria-label={text}
      >
        ?
      </span>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-full z-20 mt-1 w-max max-w-xs -translate-x-1/2 whitespace-pre-line rounded-none border border-border-dark bg-surface-dark px-2 py-1 text-[11px] leading-snug text-white shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "确认",
  cancelLabel = "取消",
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-lg shadow-xl w-full max-w-md mx-4 p-5"
      >
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">
          {title}
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-300">
          {message}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface LedgerTableProps {
  entries: LedgerEntry[];
  onEdit: (entry: LedgerEntry) => void;
  onDelete: (entry: LedgerEntry) => void;
}

export function LedgerTable({ entries, onEdit, onDelete }: LedgerTableProps) {
  return (
    <div className="overflow-x-auto border border-slate-200 dark:border-border-dark mb-4">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-border-dark">
        <thead className="bg-slate-50 dark:bg-background-dark">
          <tr>
            {[
              "日期",
              "类型",
              "标的",
              "方向",
              "数量/价格",
              "现金腿",
              "费用/税费",
              "来源",
              "备注",
              "操作"
            ].map((h) => (
              <th
                key={h}
                className="px-4 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-surface-dark/70 divide-y divide-slate-200 dark:divide-border-dark">
          {entries.map((entry) => {
            const isReadonly = entry.source === "system";
            const cashClass =
              entry.cashAmount === null
                ? "text-slate-500 dark:text-slate-400"
                : entry.cashAmount < 0
                  ? "text-red-500"
                  : "text-emerald-600";
            return (
              <tr
                key={entry.id}
                className="hover:bg-slate-50 dark:hover:bg-background-dark/70 transition-colors group"
              >
                <td className="px-4 py-2">
                  <div className="text-sm font-mono text-slate-700 dark:text-slate-300">
                    {entry.tradeDate}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {entry.eventTs ? formatDateTime(entry.eventTs) : "无时间"}
                    {entry.sequence !== null ? ` / seq ${entry.sequence}` : ""}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {formatLedgerEventType(entry.eventType)}
                  </div>
                  {entry.eventType === "corporate_action" && (
                    <div className="text-[10px] text-slate-400">
                      {formatCorporateActionMeta(entry.meta)}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2">
                  <div className="text-sm font-mono text-slate-700 dark:text-slate-200">
                    {entry.symbol ?? entry.instrumentId ?? "--"}
                  </div>
                  {entry.symbol && entry.instrumentId && (
                    <div className="text-[10px] text-slate-400">
                      {entry.instrumentId}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300">
                  {formatLedgerSide(entry.side)}
                </td>
                <td className="px-4 py-2">
                  <div className="text-sm font-mono text-right text-slate-700 dark:text-slate-200">
                    {formatNumber(entry.quantity)}
                  </div>
                  <div className="text-[10px] text-slate-400 text-right">
                    {entry.price !== null ? formatCurrency(entry.price) : "--"}
                    {entry.priceCurrency ? ` ${entry.priceCurrency}` : ""}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <div className={`text-sm font-mono text-right ${cashClass}`}>
                    {formatCurrency(entry.cashAmount)}
                  </div>
                  <div className="text-[10px] text-slate-400 text-right">
                    {entry.cashCurrency ?? "--"}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <div className="text-[11px] font-mono text-right text-slate-600 dark:text-slate-300">
                    {entry.fee !== null ? formatCurrency(entry.fee) : "--"}
                  </div>
                  <div className="text-[11px] font-mono text-right text-slate-600 dark:text-slate-300">
                    {entry.tax !== null ? formatCurrency(entry.tax) : "--"}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    {formatLedgerSource(entry.source)}
                  </div>
                  {entry.externalId && (
                    <div className="text-[10px] text-slate-400">
                      {entry.externalId}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                  {entry.note ?? "--"}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEdit(entry)}
                      className={`p-1 transition-colors ${
                        isReadonly
                          ? "text-slate-300 cursor-not-allowed"
                          : "text-slate-400 hover:text-primary"
                      }`}
                      title={isReadonly ? "系统流水不可编辑" : "编辑"}
                      disabled={isReadonly}
                    >
                      <span className="material-icons-outlined text-base">edit</span>
                    </button>
                    <button
                      onClick={() => onDelete(entry)}
                      className={`p-1 transition-colors ${
                        isReadonly
                          ? "text-slate-300 cursor-not-allowed"
                          : "text-slate-400 hover:text-red-500"
                      }`}
                      title={isReadonly ? "系统流水不可删除" : "删除"}
                      disabled={isReadonly}
                    >
                      <span className="material-icons-outlined text-base">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface LedgerFormProps {
  form: LedgerFormState;
  baseCurrency: string;
  onChange: (patch: Partial<LedgerFormState>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function LedgerForm({ form, baseCurrency, onChange, onSubmit, onCancel }: LedgerFormProps) {
  const isEditing = Boolean(form.id);
  const isCorporateDividend =
    form.eventType === "corporate_action" && form.corporateKind === "dividend";
  const effectiveEventType: LedgerEventType = isCorporateDividend
    ? "dividend"
    : form.eventType;
  const usesInstrument = [
    "trade",
    "dividend",
    "adjustment",
    "corporate_action"
  ].includes(effectiveEventType);
  const usesSide = ["trade", "adjustment"].includes(effectiveEventType);
  const usesQuantity = ["trade", "adjustment"].includes(effectiveEventType);
  const usesPrice = ["trade", "adjustment"].includes(effectiveEventType);
  const usesCash = ["trade", "cash", "fee", "tax", "dividend"].includes(
    effectiveEventType
  );
  const usesFeeTax = form.eventType === "trade";
  const tradeDateMissing = form.tradeDate.trim() === "";
  const instrumentMissing =
    usesInstrument &&
    form.symbol.trim() === "" &&
    form.instrumentId.trim() === "";
  const sideMissing = usesSide && !form.side;
  const quantityMissing = usesQuantity && form.quantity.trim() === "";
  const priceMissing = usesPrice && form.price.trim() === "";
  const cashAmountMissing = usesCash && form.cashAmount.trim() === "";
  const corporateAfterSharesMissing =
    form.eventType === "corporate_action" &&
    form.corporateKind !== "info" &&
    form.corporateKind !== "dividend" &&
    form.corporateAfterShares.trim() === "";
  const missingHintClass =
    "text-rose-600 dark:text-rose-400 placeholder:text-rose-500 dark:placeholder:text-rose-400";
  const compactInputClass = "h-8 py-1 text-xs sm:text-xs rounded-none";
  const compactSelectClass = "h-8 py-1 text-xs sm:text-xs rounded-none";
  const isDeprecatedEventType =
    form.eventType === "fee" ||
    form.eventType === "tax" ||
    form.eventType === "adjustment";
  const showCorporateControls = form.eventType === "corporate_action";
  const corporateKindOptions =
    form.corporateKind === "info"
      ? [
          { value: "split", label: corporateActionKindLabels.split },
          { value: "reverse_split", label: corporateActionKindLabels.reverse_split },
          { value: "info", label: "信息（历史）", disabled: true }
        ]
      : [
          { value: "split", label: corporateActionKindLabels.split },
          { value: "reverse_split", label: corporateActionKindLabels.reverse_split },
          { value: "dividend", label: corporateActionKindLabels.dividend }
        ];
  const eventTypeOptions = isDeprecatedEventType
    ? [
        ...ledgerEventTypeOptions,
        {
          value: form.eventType,
          label: ledgerEventTypeLabels[form.eventType],
          disabled: true
        }
      ]
    : ledgerEventTypeOptions;
  const showPrimaryInstrumentRow =
    usesInstrument || usesSide || usesQuantity || usesPrice;
  const shouldAutoFeeTax = form.eventType === "trade";
  const shouldAutoCashAmount = form.eventType === "trade" && form.cashAmountAuto;

  useEffect(() => {
    if (!shouldAutoFeeTax) return;
    const quantity = Number(form.quantity);
    const price = Number(form.price);
    if (!Number.isFinite(quantity) || !Number.isFinite(price) || quantity <= 0 || price < 0) {
      return;
    }
    const feeRateRaw =
      form.feeRate.trim() === "" ? null : Number(form.feeRate);
    const taxRateRaw =
      form.taxRate.trim() === "" ? null : Number(form.taxRate);
    const updates: Partial<LedgerFormState> = {};

    if (feeRateRaw !== null && Number.isFinite(feeRateRaw) && feeRateRaw >= 0) {
      const feeValue = (quantity * price * (feeRateRaw / 100)).toFixed(2);
      if (feeValue !== form.fee) {
        updates.fee = feeValue;
      }
    }
    if (taxRateRaw !== null && Number.isFinite(taxRateRaw) && taxRateRaw >= 0) {
      const taxValue = (quantity * price * (taxRateRaw / 100)).toFixed(2);
      if (taxValue !== form.tax) {
        updates.tax = taxValue;
      }
    }

    if (Object.keys(updates).length > 0) {
      onChange(updates);
    }
  }, [
    shouldAutoFeeTax,
    form.quantity,
    form.price,
    form.feeRate,
    form.taxRate,
    form.fee,
    form.tax,
    onChange
  ]);

  useEffect(() => {
    if (!shouldAutoCashAmount) return;
    if (!form.side) return;
    const quantity = Number(form.quantity);
    const price = Number(form.price);
    if (!Number.isFinite(quantity) || !Number.isFinite(price) || quantity <= 0 || price < 0) {
      return;
    }
    const feeRaw = Number(form.fee);
    const taxRaw = Number(form.tax);
    const feeValue = Number.isFinite(feeRaw) ? feeRaw : 0;
    const taxValue = Number.isFinite(taxRaw) ? taxRaw : 0;
    const baseAmount = quantity * price;
    const signedAmount = form.side === "buy" ? -baseAmount : baseAmount;
    const nextCashAmount = (signedAmount - feeValue - taxValue).toFixed(2);
    if (nextCashAmount !== form.cashAmount) {
      onChange({ cashAmount: nextCashAmount });
    }
  }, [
    shouldAutoCashAmount,
    form.side,
    form.quantity,
    form.price,
    form.fee,
    form.tax,
    form.cashAmount,
    onChange
  ]);

  useEffect(() => {
    if (form.eventType !== "trade") return;
    if (form.feeRate.trim() || form.taxRate.trim()) return;
    const storedRates = loadStoredRates(form.eventType);
    if (storedRates.feeRate || storedRates.taxRate) {
      onChange({
        feeRate: storedRates.feeRate,
        taxRate: storedRates.taxRate
      });
    }
  }, [form.eventType, form.feeRate, form.taxRate, onChange]);

  useEffect(() => {
    if (form.eventType !== "trade") return;
    const feeRateValue =
      form.feeRate.trim() === "" ? null : Number(form.feeRate);
    const taxRateValue =
      form.taxRate.trim() === "" ? null : Number(form.taxRate);
    if (
      feeRateValue === null ||
      taxRateValue === null ||
      !Number.isFinite(feeRateValue) ||
      !Number.isFinite(taxRateValue) ||
      feeRateValue < 0 ||
      taxRateValue < 0
    ) {
      return;
    }
    saveStoredRates(form.eventType, form.feeRate.trim(), form.taxRate.trim());
  }, [form.eventType, form.feeRate, form.taxRate]);

  useEffect(() => {
    if (form.eventType !== "trade") return;
    if (!form.priceCurrency) return;
    if (form.cashCurrency !== form.priceCurrency) {
      onChange({ cashCurrency: form.priceCurrency });
    }
  }, [form.eventType, form.priceCurrency, form.cashCurrency, onChange]);

  const corporateKindField = showCorporateControls ? (
    <FormGroup label="事件类型">
      <Select
        value={form.corporateKind}
        onChange={(e) =>
          onChange({ corporateKind: e.target.value as CorporateActionKindUi })
        }
        options={corporateKindOptions}
        className={compactSelectClass}
      />
    </FormGroup>
  ) : null;

  const cashLegField = usesCash ? (
    <FormGroup
      label={
        <span className="inline-flex items-center gap-1">
          现金腿
          <HelpHint text="买入为负，卖出为正；费用/税费为负；分红为正。" />
        </span>
      }
    >
      <Input
        type="number"
        value={form.cashAmount}
        onChange={(e) => {
          const nextValue = e.target.value;
          onChange({
            cashAmount: nextValue,
            cashAmountAuto: nextValue.trim() === ""
          });
        }}
        placeholder="0.00"
        className={`${cashAmountMissing ? missingHintClass : ""} ${compactInputClass}`}
      />
    </FormGroup>
  ) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
            <span
              className="material-icons-outlined text-primary text-base"
              aria-label={isEditing ? "编辑流水" : "新增流水"}
            >
              edit_note
            </span>
            <span className="sr-only">
              {isEditing ? "编辑流水" : "新增流水"}
            </span>
          </h3>
          <Select
            value={form.eventType}
            onChange={(e) =>
              {
                const nextCurrency =
                  form.priceCurrency || form.cashCurrency || baseCurrency;
                const nextEventType = e.target.value as LedgerEventType;
                onChange({
                  eventType: nextEventType,
                  cashCurrency: nextCurrency,
                  priceCurrency: nextCurrency,
                  cashAmountAuto: true
                });
              }
            }
            options={eventTypeOptions}
            className="h-6 w-32 rounded-none border-0 !bg-transparent dark:!bg-transparent py-0 pl-2 pr-6 text-[11px] focus:ring-0 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            className="rounded-none px-2 py-1 text-[11px]"
            onClick={onSubmit}
          >
            保存
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="rounded-none px-2 py-1 text-[11px]"
            onClick={onCancel}
          >
            取消
          </Button>
        </div>
      </div>
      <div className="border-t border-slate-200 dark:border-border-dark" />

      <div className="space-y-2">
        {showPrimaryInstrumentRow && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
            {usesInstrument && (
              <FormGroup label="代码">
                <Input
                  value={form.symbol}
                  onChange={(e) => onChange({ symbol: e.target.value })}
                  placeholder="例如: 600519.SH"
                  className={`${instrumentMissing ? missingHintClass : ""} ${compactInputClass}`}
                />
              </FormGroup>
            )}
              {usesSide && (
                <FormGroup label="方向">
                  <div
                    role="group"
                    aria-label="方向"
                    className={`grid grid-cols-2 overflow-hidden rounded-none border ${
                      sideMissing
                        ? "border-rose-500"
                        : "border-slate-300 dark:border-border-dark"
                    }`}
                  >
                    <button
                      type="button"
                      aria-pressed={form.side === "buy"}
                      onClick={() => onChange({ side: "buy" })}
                      className={`h-8 px-2 text-xs ${
                        form.side === "buy"
                          ? "bg-primary text-white"
                          : "bg-transparent text-slate-500 dark:text-slate-400"
                      } border-r border-slate-300 dark:border-border-dark`}
                    >
                      买入
                    </button>
                    <button
                      type="button"
                      aria-pressed={form.side === "sell"}
                      onClick={() => onChange({ side: "sell" })}
                      className={`h-8 px-2 text-xs ${
                        form.side === "sell"
                          ? "bg-primary text-white"
                          : "bg-transparent text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      卖出
                    </button>
                  </div>
                </FormGroup>
              )}
              {usesQuantity && (
                <FormGroup label="数量">
                  <Input
                    type="number"
                    value={form.quantity}
                    onChange={(e) => onChange({ quantity: e.target.value })}
                    placeholder="0"
                    className={`${quantityMissing ? missingHintClass : ""} ${compactInputClass}`}
                  />
                </FormGroup>
              )}
              {usesPrice && (
                <FormGroup label="价格">
                  <Input
                    type="number"
                    value={form.price}
                    onChange={(e) => onChange({ price: e.target.value })}
                    placeholder="0.00"
                    className={`${priceMissing ? missingHintClass : ""} ${compactInputClass}`}
                  />
                </FormGroup>
              )}
              {usesPrice && (
                <FormGroup label="价格币种">
                  <Input
                    value={form.priceCurrency}
                    onChange={(e) => {
                      const nextCurrency = e.target.value;
                      onChange({ priceCurrency: nextCurrency, cashCurrency: nextCurrency });
                    }}
                    placeholder={baseCurrency}
                    className={compactInputClass}
                  />
                </FormGroup>
              )}
              {usesInstrument && (
                <FormGroup
                  label={
                    <span className="inline-flex items-center gap-1">
                      标的标识
                      <HelpHint text="用于绑定稳定标的编号；可选，留空时使用代码。"/>
                    </span>
                  }
                >
                  <Input
                    value={form.instrumentId}
                    onChange={(e) => onChange({ instrumentId: e.target.value })}
                    placeholder="可选"
                    className={compactInputClass}
                  />
              </FormGroup>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          {isCorporateDividend ? (
            <>
              {corporateKindField}
              {cashLegField}
            </>
          ) : (
            <>
              {cashLegField}
              {corporateKindField}
            </>
          )}
          {showCorporateControls &&
            !isCorporateDividend &&
            form.corporateKind !== "info" && (
            <FormGroup
              label={
                <span className="inline-flex items-center gap-1">
                  调整后股数
                  <HelpHint text="当前 1 股调整后变为多少股。" />
                </span>
              }
            >
              <Input
                type="number"
                value={form.corporateAfterShares}
                onChange={(e) => onChange({ corporateAfterShares: e.target.value })}
                placeholder="例如: 2 或 0.5"
                className={`${corporateAfterSharesMissing ? missingHintClass : ""} ${compactInputClass}`}
              />
            </FormGroup>
          )}
          {usesFeeTax && (
            <FormGroup label="费率 %">
              <Input
                type="number"
                value={form.feeRate}
                onChange={(e) => onChange({ feeRate: e.target.value })}
                placeholder="0.03"
                className={compactInputClass}
              />
            </FormGroup>
          )}
          {usesFeeTax && (
            <FormGroup label="税率 %">
              <Input
                type="number"
                value={form.taxRate}
                onChange={(e) => onChange({ taxRate: e.target.value })}
                placeholder="0.1"
                className={compactInputClass}
              />
            </FormGroup>
          )}
          {usesFeeTax && (
            <FormGroup
              label={
                <span className="inline-flex items-center gap-1">
                  费用
                  <HelpHint text="交易手续费或佣金，通常为正数。"/>
                </span>
              }
            >
              <Input
                type="number"
                value={form.fee}
                onChange={(e) => onChange({ fee: e.target.value })}
                placeholder="0.00"
                disabled
                className={compactInputClass}
              />
            </FormGroup>
          )}
          {usesFeeTax && (
            <FormGroup
              label={
                <span className="inline-flex items-center gap-1">
                  税费
                  <HelpHint text="交易相关税费，通常为正数。"/>
                </span>
              }
            >
              <Input
                type="number"
                value={form.tax}
                onChange={(e) => onChange({ tax: e.target.value })}
                placeholder="0.00"
                disabled
                className={compactInputClass}
              />
            </FormGroup>
          )}
          <FormGroup
            label={
              <span className="inline-flex items-center gap-1">
                外部标识
                <HelpHint text="用于导入对账或去重的外部流水编号，可选。"/>
              </span>
            }
          >
            <Input
              value={form.externalId}
              onChange={(e) => onChange({ externalId: e.target.value })}
              placeholder="可选"
              className={compactInputClass}
            />
          </FormGroup>
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-border-dark" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <FormGroup label="交易日期">
          <Input
            type="date"
            value={form.tradeDate}
            onChange={(e) => onChange({ tradeDate: e.target.value })}
            className={`${tradeDateMissing ? missingHintClass : ""} ${compactInputClass}`}
          />
        </FormGroup>
        <FormGroup label="事件时间">
          <Input
            type="datetime-local"
            value={form.eventTime}
            onChange={(e) => onChange({ eventTime: e.target.value })}
            className={compactInputClass}
          />
        </FormGroup>
        <FormGroup label="排序序号">
          <Input
            type="number"
            value={form.sequence}
            onChange={(e) => onChange({ sequence: e.target.value })}
            placeholder="同日顺序"
            className={compactInputClass}
          />
        </FormGroup>
        <FormGroup
          label={
            <span className="inline-flex items-center gap-1">
              账户标识
              <HelpHint text="多账户预留字段，当前可留空。"/>
            </span>
          }
        >
          <Input
            value={form.accountKey}
            onChange={(e) => onChange({ accountKey: e.target.value })}
            placeholder="可选"
            className={compactInputClass}
          />
        </FormGroup>
        <FormGroup label="备注">
          <Input
            value={form.note}
            onChange={(e) => onChange({ note: e.target.value })}
            placeholder="可选"
            className={compactInputClass}
          />
        </FormGroup>
      </div>

    </div>
  );
}

export function DataQualityCard({
  quality,
  onOpenMarketDataStatus
}: {
  quality: MarketDataQuality;
  onOpenMarketDataStatus?: () => void;
}) {
  const overall = describeDataQuality(quality.overallLevel);
  const coverage = describeDataQuality(quality.coverageLevel);
  const freshness = describeDataQuality(quality.freshnessLevel);
  const freshnessLabel =
    quality.freshnessDays === null ? "--" : `${quality.freshnessDays} 天`;

  return (
    <div className="bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark border border-slate-200 dark:border-border-dark rounded-lg p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${overall.badgeClass}`}>
            {overall.label}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">数据质量</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 dark:text-slate-500">
            截至 {quality.asOfDate ?? "--"}
          </span>
          {onOpenMarketDataStatus && (
            <button
              type="button"
              onClick={onOpenMarketDataStatus}
              className="text-xs text-primary hover:text-primary/80 transition-colors"
            >
              数据状态
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div className="bg-slate-50 dark:bg-background-dark rounded-md p-3">
          <div className="text-xs text-slate-500 mb-1">覆盖率</div>
          <div className="font-mono text-slate-800 dark:text-slate-200">
            {formatPctNullable(quality.coverageRatio ?? null)}
          </div>
          <div className={`text-[11px] font-semibold ${coverage.textClass}`}>
            {coverage.label}
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-background-dark rounded-md p-3">
          <div className="text-xs text-slate-500 mb-1">新鲜度</div>
          <div className="font-mono text-slate-800 dark:text-slate-200">
            {freshnessLabel}
          </div>
          <div className={`text-[11px] font-semibold ${freshness.textClass}`}>
            {freshness.label}
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-background-dark rounded-md p-3">
          <div className="text-xs text-slate-500 mb-1">缺失标的</div>
          <div className="font-mono text-slate-800 dark:text-slate-200">
            {quality.missingSymbols.length}
          </div>
          <div className="text-[11px] text-slate-400">
            {quality.missingSymbols.length ? "需要补齐行情" : "覆盖完整"}
          </div>
        </div>
      </div>
      {quality.notes.length > 0 && (
        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          {quality.notes.join("；")}
        </div>
      )}
    </div>
  );
}

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (min > max) return value;
  return Math.min(Math.max(value, min), max);
}

export function formatNumber(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "--";
  return value.toFixed(digits);
}

export function formatCnWanYiNullable(
  value: number | null | undefined,
  digits = 2,
  smallDigits = 0
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  const abs = Math.abs(value);
  if (abs >= 1e8) return `${(value / 1e8).toFixed(digits)}亿`;
  if (abs >= 1e4) return `${(value / 1e4).toFixed(digits)}万`;
  return value.toFixed(smallDigits);
}

export function formatSignedCnWanYiNullable(
  value: number | null | undefined,
  digits = 2,
  smallDigits = 0
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(digits)}亿`;
  if (abs >= 1e4) return `${sign}${(abs / 1e4).toFixed(digits)}万`;
  return `${sign}${abs.toFixed(smallDigits)}`;
}

export function formatCurrency(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "--";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function formatPct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function formatPctNullable(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return formatPct(value);
}

type ChangeTone = "up" | "down" | "flat" | "unknown";

export function formatSignedNumberNullable(
  value: number | null | undefined,
  digits = 2
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}`;
}

export function formatSignedPctNullable(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  const pct = value * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

export function getCnChangeTone(changePct: number | null | undefined): ChangeTone {
  if (changePct === null || changePct === undefined || Number.isNaN(changePct)) {
    return "unknown";
  }
  if (changePct > 0) return "up";
  if (changePct < 0) return "down";
  return "flat";
}

export function getCnToneTextClass(tone: ChangeTone): string {
  switch (tone) {
    case "up":
      return "ui-tone-up";
    case "down":
      return "ui-tone-down";
    default:
      return "ui-tone-neutral";
  }
}

export function getCnToneColors(tone: ChangeTone): { line: string; fill: string } {
  switch (tone) {
    case "up":
      return { line: "var(--mt-chart-up)", fill: "var(--mt-chart-up)" };
    case "down":
      return { line: "var(--mt-chart-down)", fill: "var(--mt-chart-down)" };
    default:
      return { line: "var(--mt-chart-neutral)", fill: "var(--mt-chart-neutral)" };
  }
}

export function formatPerformanceMethod(value: PerformanceMethod): string {
  switch (value) {
    case "twr":
      return "TWR";
    case "mwr":
      return "MWR";
    default:
      return "--";
  }
}

export function formatDateRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return "--";
  return `${start} ~ ${end}`;
}

export function sortContributionEntries(entries: ContributionEntry[]): ContributionEntry[] {
  return [...entries].sort((a, b) => {
    const aScore = a.contribution === null ? -Infinity : Math.abs(a.contribution);
    const bScore = b.contribution === null ? -Infinity : Math.abs(b.contribution);
    if (aScore !== bScore) return bScore - aScore;
    return b.marketValue - a.marketValue;
  });
}

type TagAggregateResult = {
  totalCount: number;
  includedCount: number;
  excludedCount: number;
  weightedChangePct: number | null;
  totalWeight: number;
};

export function computeTagAggregate(
  symbols: string[],
  quotesBySymbol: Record<string, MarketQuote>
): TagAggregateResult {
  let totalWeight = 0;
  let weightedChangeSum = 0;
  let includedCount = 0;

  symbols.forEach((symbol) => {
    const quote = quotesBySymbol[symbol];
    const changePct = quote?.changePct ?? null;
    const circMv = quote?.circMv ?? null;
    if (
      changePct === null ||
      circMv === null ||
      !Number.isFinite(changePct) ||
      !Number.isFinite(circMv) ||
      circMv <= 0
    ) {
      return;
    }
    includedCount += 1;
    totalWeight += circMv;
    weightedChangeSum += changePct * circMv;
  });

  return {
    totalCount: symbols.length,
    includedCount,
    excludedCount: Math.max(0, symbols.length - includedCount),
    weightedChangePct: totalWeight > 0 ? weightedChangeSum / totalWeight : null,
    totalWeight
  };
}

export function sortTagMembersByChangePct(
  symbols: string[],
  quotesBySymbol: Record<string, MarketQuote>
): string[] {
  return [...symbols].sort((a, b) => {
    const aValue = quotesBySymbol[a]?.changePct;
    const bValue = quotesBySymbol[b]?.changePct;
    const aScore =
      aValue === null || aValue === undefined || Number.isNaN(aValue)
        ? -Infinity
        : aValue;
    const bScore =
      bValue === null || bValue === undefined || Number.isNaN(bValue)
        ? -Infinity
        : bValue;
    if (aScore !== bScore) return bScore - aScore;
    return a.localeCompare(b);
  });
}

export function formatAssetClassLabel(value: string): string {
  if (value in assetClassLabels) {
    return assetClassLabels[value as AssetClass];
  }
  return value;
}

export function formatRiskLimitTypeLabel(value: RiskLimitType): string {
  return riskLimitTypeLabels[value] ?? value;
}

export function formatLedgerEventType(value: LedgerEventType): string {
  return ledgerEventTypeLabels[value] ?? value;
}

export function formatLedgerSide(value: LedgerSide | null): string {
  if (!value) return "--";
  return ledgerSideLabels[value] ?? value;
}

export function formatLedgerSource(value: LedgerSource): string {
  return ledgerSourceLabels[value] ?? value;
}

export function isCorporateActionMeta(
  meta: LedgerEntryMeta | null
): meta is CorporateActionMeta {
  if (!meta || typeof meta !== "object") return false;
  const kind = (meta as CorporateActionMeta).kind;
  return kind === "split" || kind === "reverse_split" || kind === "info";
}

export function formatCorporateActionMeta(meta: LedgerEntryMeta | null): string {
  if (!isCorporateActionMeta(meta)) return "--";
  if (meta.kind === "info") {
    const category = corporateActionCategoryLabels[meta.category] ?? meta.category;
    return `${category} · ${meta.title}`;
  }
  const kindLabel = corporateActionKindLabels[meta.kind] ?? meta.kind;
  return `${kindLabel} ${meta.numerator}:${meta.denominator}`;
}

export function formatDateTime(value: number | null): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("zh-CN");
}

export function formatDurationMs(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return "0s";
  const totalSeconds = Math.floor(durationMs / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  if (hours > 0) return `${hours}h${minutes}m`;
  if (minutes > 0) return `${minutes}m${seconds}s`;
  return `${seconds}s`;
}

export function formatMarketTokenSource(source: MarketTokenStatus["source"]): string {
  switch (source) {
    case "env":
      return "环境变量";
    case "local":
      return "本地";
    case "none":
      return "无";
    default:
      return source;
  }
}

export function formatTagSourceLabel(source: TagSummary["source"]): string {
  switch (source) {
    case "provider":
      return "Provider";
    case "user":
      return "用户";
    case "watchlist":
      return "自选";
    default:
      return source;
  }
}

export function formatIngestRunStatusLabel(status: MarketIngestRun["status"]): string {
  switch (status) {
    case "running":
      return "进行中";
    case "success":
      return "成功";
    case "partial":
      return "部分成功";
    case "failed":
      return "失败";
    case "canceled":
      return "已取消";
    default:
      return String(status);
  }
}

export function formatIngestRunScopeLabel(scope: MarketIngestRun["scope"]): string {
  switch (scope) {
    case "targets":
      return "目标池";
    case "universe":
      return "全市场";
    default:
      return String(scope);
  }
}

export function formatIngestRunModeLabel(mode: MarketIngestRun["mode"]): string {
  switch (mode) {
    case "daily":
      return "定时";
    case "bootstrap":
      return "初始化";
    case "manual":
      return "手动";
    case "on_demand":
      return "按需";
    default:
      return String(mode);
  }
}

export function formatTargetsReasonLabel(reason: string): string {
  const normalized = reason.trim().toLowerCase();
  if (normalized === "holdings") return "持仓";
  if (normalized === "watchlist") return "自选";
  if (normalized === "registry" || normalized === "registry_auto_ingest") return "注册标的";
  if (normalized === "explicit") return "手动添加";
  if (normalized.startsWith("tag:")) return `标签：${reason.slice(4)}`;
  return reason;
}

export function formatTargetsReasons(reasons: string[]): string {
  return reasons.map(formatTargetsReasonLabel).join("，");
}

export function formatIngestRunTone(status: MarketIngestRun["status"]): string {
  switch (status) {
    case "success":
      return "ui-tone-down";
    case "partial":
      return "ui-tone-warning";
    case "failed":
      return "ui-tone-up";
    case "canceled":
      return "ui-tone-neutral";
    case "running":
      return "ui-tone-info";
    default:
      return "text-[color:var(--mt-text)]";
  }
}

export function formatIngestControlStateLabel(
  state: MarketIngestControlStatus["state"]
): string {
  switch (state) {
    case "idle":
      return "空闲";
    case "running":
      return "运行中";
    case "paused":
      return "已暂停";
    case "canceling":
      return "取消中";
    default:
      return state;
  }
}

export function getIngestControlStateDotClass(
  state: MarketIngestControlStatus["state"] | null
): string {
  switch (state) {
    case "idle":
      return "ui-dot-idle";
    case "running":
      return "ui-dot-running";
    case "paused":
      return "ui-dot-paused";
    case "canceling":
      return "ui-dot-canceling";
    default:
      return "ui-dot-unknown";
  }
}

export function getUniversePoolBucketLabel(bucket: UniversePoolBucketId): string {
  switch (bucket) {
    case "cn_a":
      return "A股";
    case "etf":
      return "ETF";
    case "precious_metal":
      return "贵金属";
    default:
      return bucket;
  }
}

export function isSameSchedulerConfig(
  left: MarketIngestSchedulerConfig,
  right: MarketIngestSchedulerConfig
): boolean {
  return (
    left.enabled === right.enabled &&
    left.runAt === right.runAt &&
    left.timezone === right.timezone &&
    left.scope === right.scope &&
    left.runOnStartup === right.runOnStartup &&
    left.catchUpMissed === right.catchUpMissed
  );
}

export function isSameUniversePoolConfig(
  left: MarketUniversePoolConfig,
  right: MarketUniversePoolConfig
): boolean {
  const leftBuckets = normalizeStringArray(left.enabledBuckets);
  const rightBuckets = normalizeStringArray(right.enabledBuckets);
  if (leftBuckets.length !== rightBuckets.length) return false;
  for (let i = 0; i < leftBuckets.length; i += 1) {
    if (leftBuckets[i] !== rightBuckets[i]) return false;
  }
  return true;
}

export function isSameTargetsConfig(
  left: MarketTargetsConfig,
  right: MarketTargetsConfig
): boolean {
  if (left.includeHoldings !== right.includeHoldings) return false;
  if (left.includeWatchlist !== right.includeWatchlist) return false;
  if (left.includeRegistryAutoIngest !== right.includeRegistryAutoIngest) return false;

  const leftPortfolios = normalizeStringArray(left.portfolioIds ?? []);
  const rightPortfolios = normalizeStringArray(right.portfolioIds ?? []);
  if (leftPortfolios.length !== rightPortfolios.length) return false;
  for (let i = 0; i < leftPortfolios.length; i += 1) {
    if (leftPortfolios[i] !== rightPortfolios[i]) return false;
  }

  const leftSymbols = normalizeStringArray(left.explicitSymbols);
  const rightSymbols = normalizeStringArray(right.explicitSymbols);
  if (leftSymbols.length !== rightSymbols.length) return false;
  for (let i = 0; i < leftSymbols.length; i += 1) {
    if (leftSymbols[i] !== rightSymbols[i]) return false;
  }

  const leftTags = normalizeStringArray(left.tagFilters);
  const rightTags = normalizeStringArray(right.tagFilters);
  if (leftTags.length !== rightTags.length) return false;
  for (let i = 0; i < leftTags.length; i += 1) {
    if (leftTags[i] !== rightTags[i]) return false;
  }

  return true;
}

export function normalizeStringArray(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
}

export function dedupeTagSummaries(rows: TagSummary[]): TagSummary[] {
  const map = new Map<string, TagSummary>();
  rows.forEach((row) => {
    const key = row.tag.trim();
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, { ...row, tag: key });
    }
  });
  return Array.from(map.values()).sort((a, b) => a.tag.localeCompare(b.tag));
}

export function filterUniqueTagSummariesByPrefix(
  rows: TagSummary[],
  prefix: string,
  source?: TagSummary["source"]
): TagSummary[] {
  const lowered = prefix.toLowerCase();
  return dedupeTagSummaries(
    rows.filter((row) => {
      if (source && row.source !== source) return false;
      return row.tag.trim().toLowerCase().startsWith(lowered);
    })
  );
}

export function formatTargetPoolClassificationLabel(rawTag: string): string {
  const tag = rawTag.trim();
  if (!tag) return "";

  const starts = (prefix: string) => tag.toLowerCase().startsWith(prefix);
  if (starts("ind:sw:l1:")) return tag.slice("ind:sw:l1:".length).trim();
  if (starts("ind:sw:l2:")) return tag.slice("ind:sw:l2:".length).trim();
  if (starts("industry:")) return tag.slice("industry:".length).trim();
  if (starts("theme:ths:")) return tag.slice("theme:ths:".length).trim();
  if (starts("theme:manual:")) return tag.slice("theme:manual:".length).trim();
  if (starts("theme:")) return tag.slice("theme:".length).trim();
  if (starts("concept:")) return tag.slice("concept:".length).trim();
  return tag;
}

export function buildTargetPoolStructureStats(input: {
  totalSymbols: number;
  industryL1Count: number;
  industryL2Count: number;
  conceptCount: number;
  classifiedCount: number;
  allSymbols?: string[];
  classifiedSymbols?: string[];
  industryL1Details?: TargetPoolCategoryDetail[];
  industryL2Details?: TargetPoolCategoryDetail[];
  conceptDetails?: TargetPoolCategoryDetail[];
  unclassifiedSymbols?: string[];
  symbolNames?: Record<string, string | null>;
}): Omit<TargetPoolStructureStats, "loading" | "error"> {
  const allSymbols = normalizeSymbolList(input.allSymbols ?? []);
  const classifiedSymbols = normalizeSymbolList(input.classifiedSymbols ?? []);
  const totalSymbols = Math.max(0, Math.floor(input.totalSymbols || allSymbols.length));
  const industryL1Count = Math.max(0, Math.floor(input.industryL1Count));
  const industryL2Count = Math.max(0, Math.floor(input.industryL2Count));
  const conceptCount = Math.max(0, Math.floor(input.conceptCount));
  const classifiedCount = Math.max(0, Math.min(totalSymbols, Math.floor(input.classifiedCount)));
  const unclassifiedCount = Math.max(0, totalSymbols - classifiedCount);
  const normalizedUnclassified = normalizeSymbolList(input.unclassifiedSymbols ?? []);
  const symbolNames = Object.fromEntries(
    Object.entries(input.symbolNames ?? {}).map(([symbol, name]) => [
      symbol.trim().toUpperCase(),
      typeof name === "string" ? name : null
    ])
  );
  return {
    totalSymbols,
    industryL1Count,
    industryL2Count,
    conceptCount,
    unclassifiedCount,
    classificationCoverage:
      totalSymbols > 0 ? (totalSymbols - unclassifiedCount) / totalSymbols : null,
    allSymbols,
    classifiedSymbols,
    industryL1Details: dedupeCategoryDetails(input.industryL1Details ?? []),
    industryL2Details: dedupeCategoryDetails(input.industryL2Details ?? []),
    conceptDetails: dedupeCategoryDetails(input.conceptDetails ?? []),
    unclassifiedSymbols: normalizedUnclassified,
    symbolNames
  };
}

export function collectClassificationFromTags(tags: string[]): {
  industryL1: Set<string>;
  industryL2: Set<string>;
  concepts: Set<string>;
  hasClassification: boolean;
} {
  const industryL1 = new Set<string>();
  const industryL2 = new Set<string>();
  const concepts = new Set<string>();

  tags.forEach((rawTag) => {
    const tag = rawTag.trim();
    if (!tag) return;
    const lowered = tag.toLowerCase();
    if (lowered.startsWith("ind:sw:l1:") || lowered.startsWith("industry:")) {
      industryL1.add(tag);
      return;
    }
    if (lowered.startsWith("ind:sw:l2:")) {
      industryL2.add(tag);
      return;
    }
    if (lowered.startsWith("theme:") || lowered.startsWith("concept:")) {
      concepts.add(tag);
    }
  });

  return {
    industryL1,
    industryL2,
    concepts,
    hasClassification: industryL1.size > 0 || industryL2.size > 0 || concepts.size > 0
  };
}

export function normalizeSymbolList(symbols: string[]): string[] {
  return Array.from(
    new Set(symbols.map((value) => value.trim().toUpperCase()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
}

export function addSymbolToCategoryMap(
  target: Map<string, Set<string>>,
  tag: string,
  symbol: string
) {
  const key = tag.trim();
  const normalizedSymbol = symbol.trim().toUpperCase();
  if (!key || !normalizedSymbol) return;
  if (!target.has(key)) {
    target.set(key, new Set<string>());
  }
  target.get(key)?.add(normalizedSymbol);
}

export function buildCategoryDetailsFromTagSummaries(
  tags: TagSummary[],
  membersByTag: Map<string, string[]>
): TargetPoolCategoryDetail[] {
  return dedupeCategoryDetails(
    tags.map((row) => ({
      key: row.tag,
      label: formatTargetPoolClassificationLabel(row.tag),
      symbols: normalizeSymbolList(membersByTag.get(row.tag) ?? [])
    }))
  );
}

export function buildCategoryDetailsFromCategoryMap(
  map: Map<string, Set<string>>
): TargetPoolCategoryDetail[] {
  return dedupeCategoryDetails(
    Array.from(map.entries()).map(([tag, symbols]) => ({
      key: tag,
      label: formatTargetPoolClassificationLabel(tag),
      symbols: normalizeSymbolList(Array.from(symbols))
    }))
  );
}

export function dedupeCategoryDetails(rows: TargetPoolCategoryDetail[]): TargetPoolCategoryDetail[] {
  const map = new Map<string, TargetPoolCategoryDetail>();
  rows.forEach((row) => {
    const key = row.key.trim();
    if (!key) return;
    const symbols = normalizeSymbolList(row.symbols);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        label: row.label.trim() || formatTargetPoolClassificationLabel(key),
        symbols
      });
      return;
    }
    map.set(key, {
      key,
      label: existing.label,
      symbols: normalizeSymbolList([...existing.symbols, ...symbols])
    });
  });
  return Array.from(map.values()).sort((a, b) => {
    if (b.symbols.length !== a.symbols.length) {
      return b.symbols.length - a.symbols.length;
    }
    return a.label.localeCompare(b.label);
  });
}

export async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  let cursor = 0;

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        await task(items[index], index);
      }
    })
  );
}

export function parseBatchSymbols(input: string): {
  valid: string[];
  invalid: string[];
  duplicates: number;
} {
  const raw = splitSymbolInputTokens(input);
  const validSet = new Set<string>();
  const invalidSet = new Set<string>();
  let duplicates = 0;
  raw.forEach((token) => {
    const normalized = normalizeMarketSymbol(token);
    if (!normalized) {
      invalidSet.add(token);
      return;
    }
    if (validSet.has(normalized)) {
      duplicates += 1;
      return;
    }
    validSet.add(normalized);
  });
  return {
    valid: Array.from(validSet.values()).sort((a, b) => a.localeCompare(b)),
    invalid: Array.from(invalidSet.values()),
    duplicates
  };
}

export function buildManualTargetsPreview(
  input: string,
  existingSymbols: string[]
): {
  addable: string[];
  existing: string[];
  invalid: string[];
  duplicates: number;
} {
  const parsed = parseBatchSymbols(input);
  const existingSet = new Set(
    existingSymbols
      .map((value) => normalizeMarketSymbol(value))
      .filter((value): value is string => Boolean(value))
  );

  const addable: string[] = [];
  const existing: string[] = [];

  parsed.valid.forEach((symbol) => {
    if (existingSet.has(symbol)) {
      existing.push(symbol);
      return;
    }
    addable.push(symbol);
  });

  return {
    addable,
    existing,
    invalid: parsed.invalid,
    duplicates: parsed.duplicates
  };
}

export function splitSymbolInputTokens(input: string): string[] {
  return input
    .split(/[\s,;，；]+/g)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function normalizeMarketSymbol(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  if (!/^[A-Z0-9._-]+$/.test(normalized)) return null;
  return normalized;
}

export function formatDateTimeInput(value: number | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export function sanitizeToastMessage(message: string): string {
  if (!message) return message;
  const trimmed = message.trim();

  const redacted = trimmed.replace(/[A-Za-z0-9_-]{32,}/g, "[REDACTED]");

  if (/(^|\n)\s*at\s+/i.test(redacted)) {
    return "操作失败，请检查输入后重试。";
  }
  if (
    redacted.includes("node:") ||
    redacted.includes("file:") ||
    redacted.includes("/Volumes/") ||
    redacted.includes("/Users/")
  ) {
    return "操作失败，请检查输入后重试。";
  }

  const lower = redacted.toLowerCase();
  if (lower.includes("failed to fetch") || lower.includes("fetch failed")) {
    return "网络请求失败：无法访问数据源接口（请检查网络/代理/防火墙/DNS）。";
  }
  if (lower.includes("enotfound") || lower.includes("eai_again")) {
    return "DNS 解析失败：请检查网络或代理设置。";
  }
  if (lower.includes("etimedout") || lower.includes("timeout")) {
    return "请求超时：请检查网络或稍后重试。";
  }
  if (lower.includes("econnreset")) {
    return "连接被重置：请检查网络或稍后重试。";
  }

  return redacted || "操作失败，请检查输入后重试。";
}

export function describeDataQuality(level: DataQualityLevel): {
  label: string;
  badgeClass: string;
  textClass: string;
} {
  switch (level) {
    case "ok":
      return {
        label: "可用",
        badgeClass: "ui-quality-badge ui-quality-ok",
        textClass: "ui-tone-down"
      };
    case "partial":
      return {
        label: "有缺口",
        badgeClass: "ui-quality-badge ui-quality-partial",
        textClass: "ui-tone-warning"
      };
    default:
      return {
        label: "不可用",
        badgeClass: "ui-quality-badge ui-quality-unavailable",
        textClass: "ui-tone-up"
      };
  }
}

export function toUserErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const raw = String(error.message ?? "").trim();
    if (!raw) return "未知错误。";

    const firstLine = raw.split("\n")[0]?.trim() ?? "";

    const handlerMatch =
      /^Error occurred in handler for '([^']+)': Error: (.+)$/.exec(firstLine);
    if (handlerMatch?.[2]) return handlerMatch[2].trim();

    const invokeMatch =
      /^Error invoking remote method '([^']+)': Error: (.+)$/.exec(firstLine);
    if (invokeMatch?.[2]) return invokeMatch[2].trim();

    const remoteMatch = /^Error: (.+)$/.exec(firstLine);
    if (remoteMatch?.[1]) return remoteMatch[1].trim();

    return firstLine || raw;
  }
  if (typeof error === "string") {
    const raw = error.trim();
    if (!raw) return "未知错误。";
    const firstLine = raw.split("\n")[0]?.trim() ?? "";

    const handlerMatch =
      /^Error occurred in handler for '([^']+)': Error: (.+)$/.exec(firstLine);
    if (handlerMatch?.[2]) return handlerMatch[2].trim();

    const invokeMatch =
      /^Error invoking remote method '([^']+)': Error: (.+)$/.exec(firstLine);
    if (invokeMatch?.[2]) return invokeMatch[2].trim();

    const remoteMatch = /^Error: (.+)$/.exec(firstLine);
    if (remoteMatch?.[1]) return remoteMatch[1].trim();

    return firstLine || raw;
  }
  return "未知错误。";
}

export function formatInputDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function parseInputDate(value: string): Date | null {
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  const date = new Date();
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function formatCnDate(value: string | null | undefined): string {
  if (!value) return "--";
  const date = parseInputDate(value);
  if (!date) return value;
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function parseTargetPriceFromTags(tags: string[]): number | null {
  for (const raw of tags) {
    const tag = raw.trim();
    if (!tag) continue;
    const idx = tag.indexOf(":");
    if (idx <= 0) continue;
    const ns = tag.slice(0, idx).trim().toLowerCase();
    if (ns !== "target" && ns !== "tp" && ns !== "目标价") continue;
    const payload = tag.slice(idx + 1).trim();
    const value = Number(payload);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

export function buildManualThemeOptions(tags: TagSummary[]): PopoverSelectOption[] {
  const options: PopoverSelectOption[] = [];
  const seen = new Set<string>();
  tags.forEach((item) => {
    const raw = item.tag.trim();
    if (!raw.startsWith("theme:ths:")) return;
    const name = raw.slice("theme:ths:".length).trim();
    if (!name) return;
    const value = `theme:manual:${name}`;
    if (seen.has(value)) return;
    seen.add(value);
    options.push({ value, label: name });
  });
  options.sort((a, b) => a.label.localeCompare(b.label));
  return options;
}

export function formatThemeLabel(theme: TagFacetTheme): string {
  if (theme.provider) {
    return `${theme.provider}:${theme.name}`;
  }
  return theme.name || theme.tag;
}

export function computeFifoUnitCost(entries: LedgerEntry[], symbol: string): number | null {
  const key = symbol.trim();
  if (!key) return null;

  const candidates = entries
    .filter((entry) => {
      if (entry.symbol !== key) return false;
      if (entry.side !== "buy" && entry.side !== "sell") return false;
      if (entry.eventType !== "trade" && entry.eventType !== "adjustment") {
        return false;
      }
      const qty = entry.quantity;
      if (qty === null || !Number.isFinite(qty) || qty <= 0) return false;
      if (entry.side === "buy") {
        const price = entry.price;
        return price !== null && Number.isFinite(price) && price > 0;
      }
      return true;
    })
    .slice()
    .sort((a, b) => {
      if (a.tradeDate !== b.tradeDate) return a.tradeDate < b.tradeDate ? -1 : 1;
      const tsA = a.eventTs ?? 0;
      const tsB = b.eventTs ?? 0;
      if (tsA !== tsB) return tsA - tsB;
      const seqA = a.sequence ?? 0;
      const seqB = b.sequence ?? 0;
      if (seqA !== seqB) return seqA - seqB;
      return a.createdAt - b.createdAt;
    });

  if (candidates.length === 0) return null;

  const lots: Array<{ qty: number; price: number }> = [];
  for (const entry of candidates) {
    const qty = entry.quantity ?? 0;
    if (entry.side === "buy") {
      const price = entry.price ?? 0;
      lots.push({ qty, price });
      continue;
    }

    let remaining = qty;
    while (remaining > 0 && lots.length > 0) {
      const head = lots[0];
      const take = Math.min(head.qty, remaining);
      head.qty -= take;
      remaining -= take;
      if (head.qty <= 1e-12) lots.shift();
    }
  }

  let totalQty = 0;
  let totalCost = 0;
  for (const lot of lots) {
    totalQty += lot.qty;
    totalCost += lot.qty * lot.price;
  }
  if (totalQty <= 0) return null;
  return totalCost / totalQty;
}

export function resolveMarketChartDateRange(
  range: MarketChartRangeKey,
  endDate: string
): { startDate: string; endDate: string } {
  const end = parseInputDate(endDate) ?? new Date();
  const start = new Date(end);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  switch (range) {
    case "1D":
      start.setDate(start.getDate() - 7);
      break;
    case "1W":
      start.setDate(start.getDate() - 7);
      break;
    case "1M":
      start.setMonth(start.getMonth() - 1);
      break;
    case "3M":
      start.setMonth(start.getMonth() - 3);
      break;
    case "6M":
      start.setMonth(start.getMonth() - 6);
      break;
    case "YTD":
      start.setMonth(0, 1);
      break;
    case "1Y":
      start.setFullYear(start.getFullYear() - 1);
      break;
    case "2Y":
      start.setFullYear(start.getFullYear() - 2);
      break;
    case "5Y":
      start.setFullYear(start.getFullYear() - 5);
      break;
    case "10Y":
      start.setFullYear(start.getFullYear() - 10);
      break;
    default:
      break;
  }

  return { startDate: formatInputDate(start), endDate: formatInputDate(end) };
}

const LEDGER_RATE_STORAGE_PREFIX = "mytrader:ledger:rates:";

export function loadStoredRates(eventType: LedgerEventType): { feeRate: string; taxRate: string } {
  if (typeof window === "undefined" || !window.localStorage) {
    return { feeRate: "", taxRate: "" };
  }
  try {
    const raw = window.localStorage.getItem(`${LEDGER_RATE_STORAGE_PREFIX}${eventType}`);
    if (!raw) return { feeRate: "", taxRate: "" };
    const parsed = JSON.parse(raw) as { feeRate?: string; taxRate?: string };
    return {
      feeRate: typeof parsed.feeRate === "string" ? parsed.feeRate : "",
      taxRate: typeof parsed.taxRate === "string" ? parsed.taxRate : ""
    };
  } catch {
    return { feeRate: "", taxRate: "" };
  }
}

export function saveStoredRates(eventType: LedgerEventType, feeRate: string, taxRate: string) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      `${LEDGER_RATE_STORAGE_PREFIX}${eventType}`,
      JSON.stringify({ feeRate, taxRate })
    );
  } catch {
    // ignore storage failures
  }
}

export function deriveRateValue(
  amount: number | null | undefined,
  quantity: number | null | undefined,
  price: number | null | undefined
): string {
  if (amount === null || amount === undefined) return "";
  if (quantity === null || quantity === undefined) return "";
  if (price === null || price === undefined) return "";
  const base = quantity * price;
  if (!Number.isFinite(base) || base === 0) return "";
  const rate = (amount / base) * 100;
  if (!Number.isFinite(rate)) return "";
  return rate
    .toFixed(4)
    .replace(/\.?0+$/, "");
}

export function parseOptionalNumberInput(value: string, field: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num)) {
    throw new Error(`${field}必须是数字。`);
  }
  return num;
}

export function parseOptionalIntegerInput(value: string, field: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    throw new Error(`${field}必须是整数。`);
  }
  return num;
}

export function formatCorporateAfterShares(numerator: number, denominator: number): string {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return "";
  }
  const value = numerator / denominator;
  if (!Number.isFinite(value) || value <= 0) return "";
  return value.toFixed(4).replace(/\.?0+$/, "");
}

export function parseCorporateAfterShares(value: string): { numerator: number; denominator: number } {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("调整后股数不能为空。");
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("调整后股数必须为正数。");
  }
  const scale = 10000;
  const scaled = Math.round(parsed * scale);
  if (!Number.isFinite(scaled) || scaled <= 0) {
    throw new Error("调整后股数必须为正数。");
  }
  const divisor = greatestCommonDivisor(scaled, scale);
  return {
    numerator: scaled / divisor,
    denominator: scale / divisor
  };
}

export function greatestCommonDivisor(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x || 1;
}

export function parseOptionalDateTimeInput(value: string, field: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const ts = Date.parse(trimmed);
  if (Number.isNaN(ts)) {
    throw new Error(`${field}格式不正确。`);
  }
  return ts;
}

export function createEmptyLedgerForm(baseCurrency: string): LedgerFormState {
  const storedRates = loadStoredRates("trade");
  return {
    eventType: "trade",
    tradeDate: formatInputDate(new Date()),
    eventTime: "",
    sequence: "",
    accountKey: "",
    instrumentId: "",
    symbol: "",
    side: "",
    quantity: "",
    price: "",
    priceCurrency: baseCurrency,
    cashAmount: "",
    cashCurrency: baseCurrency,
    fee: "",
    tax: "",
    feeRate: storedRates.feeRate,
    taxRate: storedRates.taxRate,
    cashAmountAuto: true,
    note: "",
    source: "manual",
    externalId: "",
    corporateKind: "split",
    corporateAfterShares: ""
  };
}

export function DescriptionItem({ label, value }: { label: string, value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-2 border-b border-slate-50 dark:border-border-dark last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900 dark:text-slate-200">{value}</span>
    </div>
  )
}

export function PerformanceChart({ series }: { series: PortfolioPerformanceSeries }) {
  if (series.points.length < 2) {
    return <EmptyState message={series.reason ?? "暂无收益曲线。"} />;
  }

  const width = 640;
  const height = 200;
  const returns = series.points.map((point) => point.returnPct);
  const min = Math.min(...returns, 0);
  const max = Math.max(...returns, 0);
  const range = max - min || 1;

  const toX = (index: number) =>
    (index / (series.points.length - 1)) * width;
  const toY = (value: number) => height - ((value - min) / range) * height;

  const path = series.points
    .map((point, index) => `${index === 0 ? "M" : "L"}${toX(index)},${toY(point.returnPct)}`)
    .join(" ");
  const baselineY = toY(0);
  const areaPath = `${path} L${width},${baselineY} L0,${baselineY} Z`;
  const endPoint = series.points[series.points.length - 1];

  return (
    <div className="bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark border border-slate-200 dark:border-border-dark rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wider text-slate-500">收益曲线</div>
        <Badge>{formatPerformanceMethod(series.method)}</Badge>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-40"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="performanceFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--mt-chart-accent)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--mt-chart-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#performanceFill)" />
        <path d={path} fill="none" stroke="var(--mt-chart-accent)" strokeWidth="2" />
        <line
          x1="0"
          y1={baselineY}
          x2={width}
          y2={baselineY}
          stroke="var(--mt-chart-baseline)"
          strokeDasharray="4 4"
        />
      </svg>
      <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
        <span>{series.startDate}</span>
        <span className="font-mono">{formatPctNullable(endPoint?.returnPct)}</span>
        <span>{series.endDate}</span>
      </div>
      {series.reason && (
        <p className="text-xs text-slate-400 mt-2">{series.reason}</p>
      )}
    </div>
  );
}

interface ContributionTableProps {
  title: string;
  entries: ContributionEntry[];
  labelHeader?: string;
  showAll: boolean;
  topCount: number;
  showMarketValue: boolean;
  onToggle: () => void;
}

export function ContributionTable({
  title,
  entries,
  labelHeader,
  showAll,
  topCount,
  showMarketValue,
  onToggle
}: ContributionTableProps) {
  const sorted = sortContributionEntries(entries);
  const visible = showAll ? sorted : sorted.slice(0, topCount);
  const canToggle = entries.length > topCount;

  return (
    <div className="bg-slate-50 dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark border border-slate-200/80 dark:border-border-dark rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wider text-slate-500">{title}</div>
        {canToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="text-xs text-primary hover:text-primary/80"
          >
            {showAll ? "收起" : "展开全部"}
          </button>
        )}
      </div>
      {visible.length === 0 ? (
        <div className="text-xs text-slate-400">暂无数据</div>
      ) : (
        <div className="overflow-hidden border border-slate-200 dark:border-border-dark">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-border-dark">
            <thead className="bg-slate-50 dark:bg-background-dark">
              <tr>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase">
                  {labelHeader ?? "标的"}
                </th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-500 uppercase">
                  权重
                </th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-500 uppercase">
                  区间涨跌
                </th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-500 uppercase">
                  贡献
                </th>
                {showMarketValue && (
                  <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-500 uppercase">
                    市值
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-surface-dark/70 divide-y divide-slate-200 dark:divide-border-dark">
              {visible.map((entry) => (
                <tr key={entry.key}>
                  <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-200">
                    {entry.label}
                  </td>
                  <td className="px-3 py-2 text-xs text-right font-mono text-slate-600 dark:text-slate-300">
                    {formatPct(entry.weight)}
                  </td>
                  <td className="px-3 py-2 text-xs text-right font-mono text-slate-600 dark:text-slate-300">
                    {formatPctNullable(entry.returnPct)}
                  </td>
                  <td className="px-3 py-2 text-xs text-right font-mono text-slate-700 dark:text-slate-100">
                    {formatPctNullable(entry.contribution)}
                  </td>
                  {showMarketValue && (
                    <td className="px-3 py-2 text-xs text-right font-mono text-slate-600 dark:text-slate-300">
                      {formatCurrency(entry.marketValue)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface RiskMetricCardProps {
  title: string;
  metrics: RiskSeriesMetrics;
  annualized: boolean;
}

export function RiskMetricCard({ title, metrics, annualized }: RiskMetricCardProps) {
  const volatility = annualized ? metrics.volatilityAnnualized : metrics.volatility;
  return (
    <div className="bg-slate-50 dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark border border-slate-200/80 dark:border-border-dark rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wider text-slate-500">{title}</div>
        <div className="text-[11px] text-slate-400">{metrics.points} 点</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[11px] text-slate-500">
            波动率{annualized ? "（年化）" : ""}
          </div>
          <div className="text-lg font-mono text-slate-800 dark:text-slate-100">
            {formatPctNullable(volatility)}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-slate-500">最大回撤</div>
          <div className="text-lg font-mono text-slate-800 dark:text-slate-100">
            {formatPctNullable(metrics.maxDrawdown)}
          </div>
        </div>
      </div>
      <div className="text-[11px] text-slate-400 mt-2">
        区间 {formatDateRange(metrics.startDate, metrics.endDate)}
      </div>
      {metrics.reason && (
        <div className="text-[11px] text-slate-400 mt-1">{metrics.reason}</div>
      )}
    </div>
  );
}
