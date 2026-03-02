import { useCallback, useEffect, useMemo, useState } from "react";
import { BlockMath, InlineMath } from "react-katex";
import "katex/dist/katex.min.css";

import type {
  ValuationMethodInputField,
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
  | "stock"
  | "etf"
  | "futures"
  | "spot"
  | "forex"
  | "bond"
  | "volatility"
  | "generic";

type GraphLayer = "top" | "first_order" | "second_order" | "output" | "risk";
type UnifiedInputKindFilter = "all" | "objective" | "subjective" | "derived";
type UnifiedLayerFilter = "all" | GraphLayer;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ASSET_GROUPS: Array<{ key: AssetGroupKey; label: string }> = [
  { key: "all", label: "全部" },
  { key: "stock", label: "股票/指数" },
  { key: "etf", label: "ETF/基金" },
  { key: "futures", label: "期货" },
  { key: "spot", label: "现货/贵金属" },
  { key: "forex", label: "外汇" },
  { key: "bond", label: "债券/利率" },
  { key: "volatility", label: "波动率" },
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

const INPUT_KIND_LABELS: Record<"objective" | "subjective" | "derived", string> = {
  objective: "客观输入",
  subjective: "主观输入",
  derived: "派生输出"
};

const INPUT_KIND_TRAIT_PREFIX_LABELS: Record<"objective" | "subjective" | "derived", string> = {
  objective: "客观",
  subjective: "主观",
  derived: "输出"
};

const INPUT_KIND_ORDER: Record<"objective" | "subjective" | "derived", number> = {
  objective: 0,
  subjective: 1,
  derived: 2
};

const FORMULA_GUIDES: Record<
  string,
  {
    summary: string;
    steps: string[];
    stepsLatex: string[];
  }
> = {
  equity_factor_v1: {
    summary: "先按趋势强弱上调价格，再按波动风险下调，得到风险调整后的公允值。",
    steps: [
      "fair_value = price * (1 + momentum) * (1 - volatility * 0.2)",
      "return_gap = fair_value / price - 1"
    ],
    stepsLatex: [
      "FV = P(1 + m)(1 - 0.2\\sigma)",
      "RG = \\frac{FV}{P} - 1"
    ]
  },
  futures_basis_v1: {
    summary: "将现货价格与基差直接相加，得到期货的理论公允值。",
    steps: ["fair_value = price + basis", "return_gap = fair_value / price - 1"],
    stepsLatex: ["FV = P + b", "RG = \\frac{FV}{P} - 1"]
  },
  futures_trend_vol_v1: {
    summary: "趋势因子正向抬升估值，波动风险负向压低估值，二者合并后得到结果。",
    steps: [
      "fair_value = price * (1 + momentum_weight * momentum - vol_penalty * volatility)",
      "return_gap = fair_value / price - 1"
    ],
    stepsLatex: ["FV = P(1 + w_m m - w_{\\sigma}\\sigma)", "RG = \\frac{FV}{P} - 1"]
  },
  futures_term_structure_v1: {
    summary: "以预期基差和展期收益的合计比例修正当前价格。",
    steps: [
      "fair_value = price * (1 + expected_basis_pct + roll_yield_pct)",
      "return_gap = fair_value / price - 1"
    ],
    stepsLatex: ["FV = P(1 + b_e + y_r)", "RG = \\frac{FV}{P} - 1"]
  },
  volatility_discount_v1: {
    summary: "以实现波动率作为风险折价项，直接修正当前价格。",
    steps: [
      "fair_value = price * (1 - volatility_discount_weight * volatility_20d)",
      "return_gap = fair_value / price - 1"
    ],
    stepsLatex: ["FV = P(1 - \\lambda_{vol}\\sigma_{20d})", "RG = \\frac{FV}{P} - 1"]
  },
  volatility_risk_premium_v1: {
    summary: "用隐含与实现波动率之差衡量风险溢价，并映射到价格修正。",
    steps: [
      "fair_value = price * (1 + vrp_beta * (implied_volatility - realized_volatility))",
      "return_gap = fair_value / price - 1"
    ],
    stepsLatex: [
      "FV = P(1 + \\beta_{vrp}(\\sigma_{iv} - \\sigma_{rv}))",
      "RG = \\frac{FV}{P} - 1"
    ]
  },
  volatility_percentile_band_v1: {
    summary: "以波动率历史分位相对锚点的偏离，生成区间化风险调整估值。",
    steps: [
      "fair_value = price * (1 - percentile_sensitivity * (volatility_percentile - percentile_anchor))",
      "return_gap = fair_value / price - 1"
    ],
    stepsLatex: ["FV = P\\left(1 - k_q(q_{\\sigma} - q_0)\\right)", "RG = \\frac{FV}{P} - 1"]
  },
  spot_carry_v1: {
    summary: "按持有收益因子对现货价格进行比例修正。",
    steps: ["fair_value = price * (1 + carry)", "return_gap = fair_value / price - 1"],
    stepsLatex: ["FV = P(1 + c)", "RG = \\frac{FV}{P} - 1"]
  },
  spot_mean_reversion_v1: {
    summary: "当短期动量偏离均值时，按回归强度反向修正当前价格。",
    steps: [
      "fair_value = price * (1 - reversion_strength * momentum)",
      "return_gap = fair_value / price - 1"
    ],
    stepsLatex: ["FV = P(1 - \\lambda m)", "RG = \\frac{FV}{P} - 1"]
  },
  spot_inventory_risk_v1: {
    summary: "库存溢价提升估值，波动风险压低估值，两部分共同决定最终结果。",
    steps: [
      "fair_value = price * (1 + inventory_premium - volatility_penalty * volatility)",
      "return_gap = fair_value / price - 1"
    ],
    stepsLatex: ["FV = P(1 + \\pi_{inv} - \\lambda_{\\sigma}\\sigma)", "RG = \\frac{FV}{P} - 1"]
  },
  forex_ppp_v1: {
    summary: "依据购买力平价偏离比例，对即期汇率做结构性修正。",
    steps: ["fair_value = price * (1 + ppp_gap)", "return_gap = fair_value / price - 1"],
    stepsLatex: ["FV = P(1 + g_{ppp})", "RG = \\frac{FV}{P} - 1"]
  },
  forex_rate_differential_v1: {
    summary: "按照利差和持有期限估算汇率的 carry 驱动偏移。",
    steps: [
      "fair_value = price * (1 + carry_differential * horizon_years)",
      "return_gap = fair_value / price - 1"
    ],
    stepsLatex: ["FV = P(1 + d_{carry} h)", "RG = \\frac{FV}{P} - 1"]
  },
  forex_reer_reversion_v1: {
    summary: "以实际有效汇率偏离为锚，并用动量回归项抑制短期过冲。",
    steps: [
      "fair_value = price * (1 + reer_gap - reversion_speed * momentum)",
      "return_gap = fair_value / price - 1"
    ],
    stepsLatex: ["FV = P(1 + g_{reer} - \\lambda m)", "RG = \\frac{FV}{P} - 1"]
  },
  bond_yield_v1: {
    summary: "使用久期近似把收益率冲击映射为债券价格变动。",
    steps: [
      "fair_value = price * (1 - duration * yield_shift)",
      "return_gap = fair_value / price - 1"
    ],
    stepsLatex: ["FV = P(1 - D\\Delta y)", "RG = \\frac{FV}{P} - 1"]
  },
  bond_spread_duration_v1: {
    summary: "在久期一阶项基础上加入凸性二阶修正，估计利差冲击后的债券价格。",
    steps: [
      "fair_value = price * (1 - duration * spread_change + convexity * spread_change^2)",
      "return_gap = fair_value / price - 1"
    ],
    stepsLatex: ["FV = P(1 - D\\Delta s + C(\\Delta s)^2)", "RG = \\frac{FV}{P} - 1"]
  },
  bond_real_rate_v1: {
    summary: "用实际利率偏离及其敏感度估算价格的方向和幅度。",
    steps: [
      "fair_value = price * (1 - sensitivity * real_rate_gap)",
      "return_gap = fair_value / price - 1"
    ],
    stepsLatex: ["FV = P(1 - \\beta\\Delta r)", "RG = \\frac{FV}{P} - 1"]
  },
  stock_pe_relative_v1: {
    summary: "先给出目标市盈率，再与当前盈利能力对应的估值水平做对比映射价格。",
    steps: ["fair_value = price * target_pe / pe_ttm", "return_gap = fair_value / price - 1"],
    stepsLatex: ["FV = P \\cdot \\frac{PE^*}{\\frac{P}{EPS_{ttm}}}", "RG = \\frac{FV}{P} - 1"]
  },
  stock_pb_relative_v1: {
    summary: "以目标市净率和每股净资产为锚，映射当前价格到目标估值区间。",
    steps: ["fair_value = price * target_pb / pb", "return_gap = fair_value / price - 1"],
    stepsLatex: ["FV = P \\cdot \\frac{PB^*}{\\frac{P}{BPS}}", "RG = \\frac{FV}{P} - 1"]
  },
  stock_ps_relative_v1: {
    summary: "以目标市销率和滚动营收能力为核心，得到对应的公允价格。",
    steps: ["fair_value = price * target_ps / ps_ttm", "return_gap = fair_value / price - 1"],
    stepsLatex: ["FV = P \\cdot \\frac{PS^*}{\\frac{P}{S_{ttm}}}", "RG = \\frac{FV}{P} - 1"]
  },
  stock_peg_relative_v1: {
    summary: "先由增长假设和目标 PEG 推导目标市盈率，再与当前盈利估值比较。",
    steps: ["target_pe = growth * 100 * target_peg", "fair_value = price * target_pe / pe_ttm"],
    stepsLatex: [
      "PE^* = g \\cdot 100 \\cdot PEG^*",
      "FV = P \\cdot \\frac{PE^*}{\\frac{P}{EPS_{ttm}}}"
    ]
  },
  stock_ev_ebitda_relative_v1: {
    summary: "比较目标与当前企业价值倍数，并按相对比例映射到价格。",
    steps: [
      "fair_value = price * target_ev_ebitda / ev_ebitda_ttm",
      "return_gap = fair_value / price - 1"
    ],
    stepsLatex: [
      "FV = P \\cdot \\frac{\\frac{EV^*}{EBITDA^*}}{\\frac{EV_{ttm}}{EBITDA_{ttm}}}",
      "RG = \\frac{FV}{P} - 1"
    ]
  },
  stock_ev_sales_relative_v1: {
    summary: "将目标企业价值收入倍数与当前收入定价水平对比，得到目标价格。",
    steps: ["fair_value = price * target_ev_sales / ps_ttm", "return_gap = fair_value / price - 1"],
    stepsLatex: [
      "FV = P \\cdot \\frac{\\frac{EV^*}{Sales^*}}{\\frac{P}{S_{ttm}}}",
      "RG = \\frac{FV}{P} - 1"
    ]
  },
  stock_ddm_gordon_v1: {
    summary: "以可持续股息和长期增长假设为核心，通过折现得到内在价值。",
    steps: ["fair_value = price * (dy*(1+g))/(r-g)", "return_gap = fair_value / price - 1"],
    stepsLatex: ["FV = P \\cdot \\frac{d_y(1+g)}{r-g}", "RG = \\frac{FV}{P} - 1"]
  },
  stock_fcff_twostage_v1: {
    summary: "分别估计高增长阶段与稳定阶段的现金流价值，再统一折算回价格。",
    steps: ["fair_value = price * (stage1 + terminal) / normalize_years", "return_gap = fair_value / price - 1"],
    stepsLatex: [
      "FV = P \\cdot \\frac{y_{fcff}(1+g_1)N + \\frac{y_{fcff}(1+g_2)}{\\mathrm{WACC}-g_2}}{\\max(1,N+1)}",
      "RG = \\frac{FV}{P} - 1"
    ]
  },
  generic_factor_v1: {
    summary: "用趋势与波动两个基础因子做保守修正，作为兜底估值。",
    steps: [
      "fair_value = price * (1 + momentum * 0.5) * (1 - volatility * 0.15)",
      "return_gap = fair_value / price - 1"
    ],
    stepsLatex: ["FV = P(1 + 0.5m)(1 - 0.15\\sigma)", "RG = \\frac{FV}{P} - 1"]
  }
};

interface FormulaSymbolHint {
  key: string;
  symbol: string;
  meaning: string;
  relationLatex?: string;
  impactNote?: string;
}

type FormulaSymbolHintValue = Omit<FormulaSymbolHint, "key">;

const FORMULA_SYMBOL_HINT_LIBRARY: Record<string, FormulaSymbolHintValue> = {
  P: { symbol: "P", meaning: "当前市场价格。" },
  FV: { symbol: "FV", meaning: "模型输出的公允价值。" },
  RG: { symbol: "RG", meaning: "相对当前价格的收益偏离。" },
  m: { symbol: "m", meaning: "动量因子，反映趋势方向与强度。" },
  sigma: { symbol: "\\sigma", meaning: "波动率，反映价格不确定性。" },
  sigma_20d: { symbol: "\\sigma_{20d}", meaning: "近20日实现波动率。" },
  lambda_vol: { symbol: "\\lambda_{vol}", meaning: "波动率折价系数。" },
  sigma_iv: { symbol: "\\sigma_{iv}", meaning: "隐含波动率。" },
  sigma_rv: { symbol: "\\sigma_{rv}", meaning: "实现波动率。" },
  beta_vrp: { symbol: "\\beta_{vrp}", meaning: "波动率风险溢价系数。" },
  q_sigma: { symbol: "q_{\\sigma}", meaning: "波动率历史分位数。" },
  "q_0": { symbol: "q_0", meaning: "分位锚点。" },
  k_q: { symbol: "k_q", meaning: "分位敏感度系数。" },
  b: { symbol: "b", meaning: "期货基差，反映现货与期货价差。" },
  w_m: { symbol: "w_m", meaning: "动量项权重。" },
  w_sigma: { symbol: "w_{\\sigma}", meaning: "波动惩罚权重。" },
  b_e: { symbol: "b_e", meaning: "预期基差比例。" },
  y_r: { symbol: "y_r", meaning: "展期收益比例。" },
  c: { symbol: "c", meaning: "Carry 因子。" },
  lambda: { symbol: "\\lambda", meaning: "均值回归速度或强度。" },
  pi_inv: { symbol: "\\pi_{inv}", meaning: "库存溢价因子。" },
  lambda_sigma: { symbol: "\\lambda_{\\sigma}", meaning: "波动惩罚系数。" },
  g_ppp: { symbol: "g_{ppp}", meaning: "购买力平价偏离比例。" },
  d_carry: { symbol: "d_{carry}", meaning: "两币种 carry 利差。" },
  h: { symbol: "h", meaning: "持有期（年）。" },
  g_reer: { symbol: "g_{reer}", meaning: "实际有效汇率偏离比例。" },
  D: { symbol: "D", meaning: "久期。" },
  delta_y: { symbol: "\\Delta y", meaning: "收益率变动幅度。" },
  delta_s: { symbol: "\\Delta s", meaning: "信用利差变动幅度。" },
  C: { symbol: "C", meaning: "凸性。" },
  beta: { symbol: "\\beta", meaning: "对实际利率偏离的敏感度。" },
  delta_r: { symbol: "\\Delta r", meaning: "实际利率偏离幅度。" },
  "PE^*": {
    symbol: "PE^*",
    meaning: "目标市盈率。",
    impactNote: "在盈利能力不变时，目标市盈率上调会抬升公允价值，下调会压低公允价值。"
  },
  "EPS_{ttm}": {
    symbol: "EPS_{ttm}",
    meaning: "过去十二个月每股收益。",
    relationLatex: "PE_{ttm} = \\frac{P}{EPS_{ttm}}",
    impactNote: "在目标估值水平不变时，过去十二个月每股收益越高，公允价值越高。"
  },
  "PB^*": {
    symbol: "PB^*",
    meaning: "目标市净率。",
    impactNote: "在净资产不变时，目标市净率上调会抬升公允价值，下调会压低公允价值。"
  },
  BPS: {
    symbol: "BPS",
    meaning: "每股净资产。",
    relationLatex: "PB = \\frac{P}{BPS}",
    impactNote: "在目标市净率不变时，每股净资产越高，公允价值越高。"
  },
  "PS^*": {
    symbol: "PS^*",
    meaning: "目标市销率。",
    impactNote: "在收入规模不变时，目标市销率上调会抬升公允价值，下调会压低公允价值。"
  },
  "S_{ttm}": {
    symbol: "S_{ttm}",
    meaning: "过去十二个月销售额或每股销售。",
    relationLatex: "PS_{ttm} = \\frac{P}{S_{ttm}}",
    impactNote: "在目标市销率不变时，过去十二个月销售额越高，公允价值越高。"
  },
  g: { symbol: "g", meaning: "长期增长率假设。" },
  "PEG^*": { symbol: "PEG^*", meaning: "目标 PEG 倍数。" },
  "EV^*": {
    symbol: "EV^*",
    meaning: "目标企业价值。",
    relationLatex: "(EV/EBITDA)^* = \\frac{EV^*}{EBITDA^*}",
    impactNote: "在目标盈利能力不变时，目标企业价值上调会抬升公允价值。"
  },
  "EBITDA^*": {
    symbol: "EBITDA^*",
    meaning: "目标 EBITDA。",
    relationLatex: "(EV/EBITDA)^* = \\frac{EV^*}{EBITDA^*}",
    impactNote: "在目标企业价值不变时，目标 EBITDA 上调会压低目标倍数，从而压低公允价值。"
  },
  "EV_{ttm}": {
    symbol: "EV_{ttm}",
    meaning: "过去十二个月口径对应的企业价值。",
    relationLatex: "(EV/EBITDA)_{ttm} = \\frac{EV_{ttm}}{EBITDA_{ttm}}",
    impactNote: "在目标倍数不变时，当前企业价值越高，当前倍数越高，公允价值映射结果越低。"
  },
  "EBITDA_{ttm}": {
    symbol: "EBITDA_{ttm}",
    meaning: "过去十二个月息税折旧摊销前利润。",
    relationLatex: "(EV/EBITDA)_{ttm} = \\frac{EV_{ttm}}{EBITDA_{ttm}}",
    impactNote: "在目标倍数不变时，当前 EBITDA 越高，当前倍数越低，公允价值映射结果越高。"
  },
  "Sales^*": {
    symbol: "Sales^*",
    meaning: "目标营业收入。",
    relationLatex: "(EV/Sales)^* = \\frac{EV^*}{Sales^*}",
    impactNote: "在目标企业价值不变时，目标营业收入上调会压低目标倍数，从而压低公允价值。"
  },
  d_y: {
    symbol: "d_y",
    meaning: "股息率。",
    impactNote: "在贴现率和增长率不变时，股息率上调会抬升公允价值。"
  },
  r: {
    symbol: "r",
    meaning: "折现率。",
    impactNote: "在现金流不变时，折现率上调会压低公允价值，下调会抬升公允价值。"
  },
  "g_1": {
    symbol: "g_1",
    meaning: "高增长阶段增长率。",
    impactNote: "高增长阶段增速上调会抬升第一阶段价值贡献。"
  },
  "g_2": {
    symbol: "g_2",
    meaning: "稳定阶段增长率。",
    impactNote: "稳定阶段增速上调会抬升终值估算；若过高接近折现率会显著放大估值。"
  },
  "y_{fcff}": {
    symbol: "y_{fcff}",
    meaning: "自由现金流收益率假设。",
    impactNote: "现金流收益率上调会同步抬升阶段现金流与终值。"
  },
  N: {
    symbol: "N",
    meaning: "高增长阶段持续年数。",
    impactNote: "高增长阶段持续时间越长，第一阶段贡献越高。"
  },
  WACC: {
    symbol: "\\mathrm{WACC}",
    meaning: "加权平均资本成本。",
    impactNote: "资本成本上调会压低折现后的公允价值，下调会抬升公允价值。"
  }
};

const FORMULA_SYMBOL_HINT_KEYS: Record<string, string[]> = {
  equity_factor_v1: ["P", "m", "sigma", "FV"],
  futures_basis_v1: ["P", "b", "FV"],
  futures_trend_vol_v1: ["P", "w_m", "m", "w_sigma", "sigma", "FV"],
  futures_term_structure_v1: ["P", "b_e", "y_r", "FV"],
  volatility_discount_v1: ["P", "sigma_20d", "lambda_vol", "FV"],
  volatility_risk_premium_v1: ["P", "sigma_iv", "sigma_rv", "beta_vrp", "FV"],
  volatility_percentile_band_v1: ["P", "q_sigma", "q_0", "k_q", "FV"],
  spot_carry_v1: ["P", "c", "FV"],
  spot_mean_reversion_v1: ["P", "lambda", "m", "FV"],
  spot_inventory_risk_v1: ["P", "pi_inv", "lambda_sigma", "sigma", "FV"],
  forex_ppp_v1: ["P", "g_ppp", "FV"],
  forex_rate_differential_v1: ["P", "d_carry", "h", "FV"],
  forex_reer_reversion_v1: ["P", "g_reer", "lambda", "m", "FV"],
  bond_yield_v1: ["P", "D", "delta_y", "FV"],
  bond_spread_duration_v1: ["P", "D", "delta_s", "C", "FV"],
  bond_real_rate_v1: ["P", "beta", "delta_r", "FV"],
  stock_pe_relative_v1: ["P", "PE^*", "EPS_{ttm}", "FV"],
  stock_pb_relative_v1: ["P", "PB^*", "BPS", "FV"],
  stock_ps_relative_v1: ["P", "PS^*", "S_{ttm}", "FV"],
  stock_peg_relative_v1: ["g", "PEG^*", "PE^*", "P", "EPS_{ttm}", "FV"],
  stock_ev_ebitda_relative_v1: ["P", "EV^*", "EBITDA^*", "EV_{ttm}", "EBITDA_{ttm}", "FV"],
  stock_ev_sales_relative_v1: ["P", "EV^*", "Sales^*", "S_{ttm}", "FV"],
  stock_ddm_gordon_v1: ["P", "d_y", "g", "r", "FV"],
  stock_fcff_twostage_v1: ["P", "y_{fcff}", "N", "g_1", "g_2", "WACC", "FV"],
  generic_factor_v1: ["P", "m", "sigma", "FV"]
};

const FORMULA_SYMBOL_HIGHLIGHT_PATTERNS: Partial<Record<string, RegExp[]>> = {
  P: [/(?<![A-Za-z\\])P(?![A-Za-z_])/g],
  FV: [/(?<![A-Za-z\\])FV(?![A-Za-z_])/g],
  m: [/(?<![A-Za-z\\])m(?![_A-Za-z])/g],
  sigma: [/\\sigma/g],
  sigma_20d: [/\\sigma_\{20d\}/g],
  lambda_vol: [/\\lambda_\{vol\}/g],
  sigma_iv: [/\\sigma_\{iv\}/g],
  sigma_rv: [/\\sigma_\{rv\}/g],
  beta_vrp: [/\\beta_\{vrp\}/g],
  q_sigma: [/q_\{\\sigma\}/g],
  "q_0": [/q_0/g],
  k_q: [/k_q/g],
  b: [/(?<![A-Za-z\\])b(?![_A-Za-z])/g],
  w_m: [/w_m/g],
  w_sigma: [/w_\{\\sigma\}/g],
  b_e: [/b_e/g],
  y_r: [/y_r/g],
  c: [/(?<![A-Za-z\\])c(?![_A-Za-z])/g],
  lambda: [/\\lambda(?![_A-Za-z])/g],
  pi_inv: [/\\pi_\{inv\}/g],
  lambda_sigma: [/\\lambda_\{\\sigma\}/g],
  g_ppp: [/g_\{ppp\}/g],
  d_carry: [/d_\{carry\}/g],
  h: [/(?<![A-Za-z\\])h(?![_A-Za-z])/g],
  g_reer: [/g_\{reer\}/g],
  D: [/(?<![A-Za-z\\])D(?![A-Za-z_])/g],
  delta_y: [/\\Delta y/g],
  delta_s: [/\\Delta s/g],
  C: [/(?<![A-Za-z\\])C(?![A-Za-z_])/g],
  beta: [/\\beta/g],
  delta_r: [/\\Delta r/g],
  "PE^*": [/PE\^\*/g],
  "EPS_{ttm}": [/EPS_\{ttm\}/g],
  "PB^*": [/PB\^\*/g],
  BPS: [/(?<![A-Za-z\\])BPS(?![A-Za-z_])/g],
  "PS^*": [/PS\^\*/g],
  "S_{ttm}": [/S_\{ttm\}/g],
  g: [/(?<![A-Za-z\\])g(?![_A-Za-z])/g],
  "PEG^*": [/PEG\^\*/g],
  "EV^*": [/EV\^\*/g],
  "EBITDA^*": [/EBITDA\^\*/g],
  "EV_{ttm}": [/EV_\{ttm\}/g],
  "EBITDA_{ttm}": [/EBITDA_\{ttm\}/g],
  "Sales^*": [/Sales\^\*/g],
  d_y: [/d_y/g],
  r: [/(?<![A-Za-z\\])r(?![_A-Za-z])/g],
  "g_1": [/g_1/g],
  "g_2": [/g_2/g],
  "y_{fcff}": [/y_\{fcff\}/g],
  N: [/(?<![A-Za-z\\])N(?![A-Za-z_])/g],
  WACC: [/\\mathrm\{WACC\}/g, /(?<![A-Za-z\\])WACC(?![A-Za-z_])/g]
};

const PARAM_TO_SYMBOL_CANDIDATES: Record<string, string[]> = {
  "market.price": ["P"],
  "output.fair_value": ["FV"],
  "output.return_gap": ["RG"],
  "valuation.pe_ttm": ["EPS_{ttm}"],
  "valuation.pb": ["BPS"],
  "valuation.ps_ttm": ["S_{ttm}"],
  "valuation.ev_ebitda_ttm": ["EV_{ttm}", "EBITDA_{ttm}"],
  "valuation.ev_sales_ttm": ["EV_{ttm}", "S_{ttm}"],
  "valuation.dv_ttm": ["d_y"],
  "risk.volatility.20d": ["sigma", "sigma_20d", "sigma_rv"],
  targetPe: ["PE^*"],
  target_pe: ["PE^*"],
  targetPb: ["PB^*"],
  target_pb: ["PB^*"],
  targetPs: ["PS^*"],
  target_ps: ["PS^*"],
  targetPeg: ["PEG^*"],
  target_peg: ["PEG^*"],
  targetEvEbitda: ["EV^*", "EBITDA^*"],
  target_ev_ebitda: ["EV^*", "EBITDA^*"],
  targetEvSales: ["EV^*", "Sales^*"],
  target_ev_sales: ["EV^*", "Sales^*"],
  dividendYield: ["d_y"],
  dividend_yield: ["d_y"],
  growthRate: ["g"],
  growth_rate: ["g"],
  discountRate: ["r"],
  discount_rate: ["r"],
  fcffYield: ["y_{fcff}"],
  fcff_yield: ["y_{fcff}"],
  highGrowthYears: ["N"],
  high_growth_years: ["N"],
  highGrowthRate: ["g_1"],
  high_growth_rate: ["g_1"],
  terminalGrowthRate: ["g_2"],
  terminal_growth_rate: ["g_2"],
  wacc: ["WACC"],
  "factor.momentum.20d": ["m"],
  momentumWeight: ["w_m"],
  volatilityPenalty: ["w_sigma", "lambda_sigma"],
  volatilityDiscountWeight: ["lambda_vol"],
  volatility_discount_weight: ["lambda_vol"],
  impliedVolatility: ["sigma_iv"],
  implied_volatility: ["sigma_iv"],
  vrpBeta: ["beta_vrp"],
  vrp_beta: ["beta_vrp"],
  volatilityPercentile: ["q_sigma"],
  volatility_percentile: ["q_sigma"],
  percentileAnchor: ["q_0"],
  percentile_anchor: ["q_0"],
  percentileSensitivity: ["k_q"],
  percentile_sensitivity: ["k_q"],
  basisWeight: ["b"],
  "factor.basis": ["b"],
  volPenalty: ["w_sigma", "lambda_sigma"],
  "factor.carry.annualized": ["c"],
  expectedBasisPct: ["b_e"],
  rollYieldPct: ["y_r"],
  reversionStrength: ["lambda"],
  inventoryPremium: ["pi_inv"],
  carryDifferential: ["d_carry"],
  horizonYears: ["h"],
  "factor.ppp_gap": ["g_ppp"],
  reerGap: ["g_reer"],
  reversionSpeed: ["lambda"],
  duration: ["D"],
  "risk.duration": ["D"],
  spreadChange: ["delta_s"],
  "risk.yield_shift": ["delta_y"],
  convexity: ["C"],
  realRateGap: ["delta_r"],
  sensitivity: ["beta"]
};

function getFormulaSymbolHints(formulaId: string): FormulaSymbolHint[] {
  const keys = FORMULA_SYMBOL_HINT_KEYS[formulaId] ?? FORMULA_SYMBOL_HINT_KEYS.generic_factor_v1;
  return keys
    .map((key): FormulaSymbolHint | null => {
      const item = FORMULA_SYMBOL_HINT_LIBRARY[key];
      if (!item) return null;
      return {
        key,
        symbol: item.symbol,
        meaning: item.meaning,
        relationLatex: item.relationLatex,
        impactNote: item.impactNote
      };
    })
    .filter((item): item is FormulaSymbolHint => item !== null);
}

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
  volatilityDiscountWeight: {
    label: "波动率折价系数",
    meaning: "将实现波动率映射为价格折价比例的系数。",
    range: "0 ~ 2"
  },
  impliedVolatility: {
    label: "隐含波动率",
    meaning: "来自期权市场或近似估计的前瞻波动率。",
    range: "0 ~ 2"
  },
  vrpBeta: {
    label: "风险溢价系数",
    meaning: "隐含与实现波动率差值对估值的传导系数。",
    range: "0 ~ 2"
  },
  volatilityPercentile: {
    label: "波动率分位数",
    meaning: "当前波动率在历史样本中的分位位置。",
    range: "0 ~ 1"
  },
  percentileAnchor: {
    label: "分位锚点",
    meaning: "分位估值中性点，通常设为 50% 分位。",
    range: "0 ~ 1"
  },
  percentileSensitivity: {
    label: "分位敏感度",
    meaning: "分位偏离锚点时估值调整的强度。",
    range: "0 ~ 2"
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
  },
  expectedBasisPct: {
    label: "预期基差",
    meaning: "期限结构中近月相对现货的预期基差。"
  },
  rollYieldPct: {
    label: "展期收益",
    meaning: "展期操作带来的年化收益估计。"
  },
  reversionStrength: {
    label: "回归强度",
    meaning: "价格偏离均值后回归中枢的速度。"
  },
  inventoryPremium: {
    label: "库存溢价",
    meaning: "库存紧张或供需错配带来的风险溢价。"
  },
  carryDifferential: {
    label: "利差",
    meaning: "两币种年化利率差。"
  },
  horizonYears: {
    label: "持有期",
    meaning: "估值持有期限（年）。"
  },
  reerGap: {
    label: "REER 偏离",
    meaning: "实际有效汇率相对均衡水平的偏离。"
  },
  reversionSpeed: {
    label: "回归速度",
    meaning: "REER 偏离向中枢收敛的速度。"
  },
  duration: {
    label: "久期",
    meaning: "债券组合对利率变化的敏感度。"
  },
  spreadChange: {
    label: "利差变动",
    meaning: "信用/期限利差变化幅度。"
  },
  convexity: {
    label: "凸性",
    meaning: "二阶利率变化修正项。"
  },
  realRateGap: {
    label: "实际利率偏离",
    meaning: "当前实际利率相对中枢的偏离。"
  },
  sensitivity: {
    label: "敏感度",
    meaning: "价格对实际利率偏离的敏感系数。"
  },
  targetPe: {
    label: "目标 PE",
    meaning: "用于相对估值映射公允价值的目标市盈率。",
    range: "5 ~ 60"
  },
  targetPb: {
    label: "目标 PB",
    meaning: "用于相对估值映射公允价值的目标市净率。",
    range: "0.5 ~ 10"
  },
  targetPs: {
    label: "目标 PS",
    meaning: "用于相对估值映射公允价值的目标市销率。",
    range: "0.2 ~ 20"
  },
  targetPeg: {
    label: "目标 PEG",
    meaning: "增长率到目标 PE 的映射系数。",
    range: "0.5 ~ 2"
  },
  targetEvEbitda: {
    label: "目标 EV/EBITDA",
    meaning: "EV/EBITDA 相对估值使用的目标倍数。",
    range: "3 ~ 25"
  },
  targetEvSales: {
    label: "目标 EV/Sales",
    meaning: "EV/Sales 相对估值使用的目标倍数。",
    range: "0.5 ~ 15"
  },
  dividendYield: {
    label: "股息率",
    meaning: "DDM 模型中的股息收益率输入。",
    range: "0 ~ 0.15"
  },
  growthRate: {
    label: "增长率",
    meaning: "盈利/现金流长期增长假设。",
    range: "-0.1 ~ 0.3"
  },
  discountRate: {
    label: "折现率",
    meaning: "未来现金流折现到当前的贴现率。",
    range: "0.03 ~ 0.2"
  },
  fcffYield: {
    label: "FCFF 收益率",
    meaning: "自由现金流收益率假设。",
    range: "0 ~ 0.2"
  },
  highGrowthYears: {
    label: "高增长年限",
    meaning: "FCFF 两阶段模型第一阶段持续年数。",
    range: "1 ~ 15"
  },
  highGrowthRate: {
    label: "高增长率",
    meaning: "FCFF 两阶段模型第一阶段增长率。",
    range: "0 ~ 0.5"
  },
  terminalGrowthRate: {
    label: "终值增长率",
    meaning: "FCFF 两阶段模型终值阶段增长率。",
    range: "0 ~ 0.08"
  },
  wacc: {
    label: "WACC",
    meaning: "加权平均资本成本，用于折现自由现金流。",
    range: "0.03 ~ 0.2"
  },
  target_pe: {
    label: "目标 PE",
    meaning: "用于相对估值映射公允价值的目标市盈率。",
    range: "5 ~ 60"
  },
  target_pb: {
    label: "目标 PB",
    meaning: "用于相对估值映射公允价值的目标市净率。",
    range: "0.5 ~ 10"
  },
  target_ps: {
    label: "目标 PS",
    meaning: "用于相对估值映射公允价值的目标市销率。",
    range: "0.2 ~ 20"
  },
  target_peg: {
    label: "目标 PEG",
    meaning: "增长率到目标 PE 的映射系数。",
    range: "0.5 ~ 2"
  },
  target_ev_ebitda: {
    label: "目标 EV/EBITDA",
    meaning: "EV/EBITDA 相对估值使用的目标倍数。",
    range: "3 ~ 25"
  },
  target_ev_sales: {
    label: "目标 EV/Sales",
    meaning: "EV/Sales 相对估值使用的目标倍数。",
    range: "0.5 ~ 15"
  },
  dividend_yield: {
    label: "股息率",
    meaning: "DDM 模型中的股息收益率输入。",
    range: "0 ~ 0.15"
  },
  growth_rate: {
    label: "增长率",
    meaning: "盈利/现金流长期增长假设。",
    range: "-0.1 ~ 0.3"
  },
  discount_rate: {
    label: "折现率",
    meaning: "未来现金流折现到当前的贴现率。",
    range: "0.03 ~ 0.2"
  },
  fcff_yield: {
    label: "FCFF 收益率",
    meaning: "自由现金流收益率假设。",
    range: "0 ~ 0.2"
  },
  high_growth_years: {
    label: "高增长年限",
    meaning: "FCFF 两阶段模型第一阶段持续年数。",
    range: "1 ~ 15"
  },
  high_growth_rate: {
    label: "高增长率",
    meaning: "FCFF 两阶段模型第一阶段增长率。",
    range: "0 ~ 0.5"
  },
  terminal_growth_rate: {
    label: "终值增长率",
    meaning: "FCFF 两阶段模型终值阶段增长率。",
    range: "0 ~ 0.08"
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
  "valuation.pe_ttm": "PE(TTM) 输入",
  "valuation.pb": "PB 输入",
  "valuation.ps_ttm": "PS(TTM) 输入",
  "valuation.ev_ebitda_ttm": "EV/EBITDA(TTM) 输入",
  "valuation.ev_sales_ttm": "EV/Sales(TTM) 输入",
  "valuation.dv_ttm": "股息率输入",
  "valuation.turnover_rate": "换手率输入",
  "output.fair_value": "估值输出：公允值",
  "output.return_gap": "估值输出：收益偏离"
};

const DEFAULT_POLICY_LABELS: Record<ValuationMethodInputField["defaultPolicy"], string> = {
  none: "无",
  industry_median: "行业中位数",
  market_median: "市场中位数",
  global_median: "全局中位数",
  constant: "常量"
};

function getFormulaId(version: ValuationMethodVersion | null): string {
  if (!version) return "generic_factor_v1";
  const manifestFormulaId = version.formulaManifest?.formulaId;
  if (typeof manifestFormulaId === "string" && manifestFormulaId.trim()) {
    return manifestFormulaId.trim();
  }
  const graphFormulaId = version.graph.find((node) => Boolean(node.formulaId))?.formulaId;
  return graphFormulaId?.trim() || "generic_factor_v1";
}

function inferAssetGroups(method: ValuationMethod): Array<Exclude<AssetGroupKey, "all">> {
  const key = method.methodKey.toLowerCase();
  const assetClasses = method.assetScope.assetClasses.map((item) => item.toLowerCase());
  const kinds = method.assetScope.kinds.map((item) => item.toLowerCase());
  const domains = method.assetScope.domains.map((item) => String(item).toLowerCase());
  const isVolatility =
    key.includes("volatility") || domains.includes("volatility") || domains.includes("vol");

  if (isVolatility) {
    return ["volatility"];
  }

  const isEtf =
    key.includes(".etf.") ||
    key.includes("etf") ||
    domains.includes("etf") ||
    assetClasses.includes("etf") ||
    (kinds.includes("fund") && !assetClasses.includes("stock"));
  const isStock =
    key.includes("stock") ||
    key.includes("equity") ||
    assetClasses.includes("stock") ||
    kinds.includes("stock") ||
    kinds.includes("index");

  const groups: Array<Exclude<AssetGroupKey, "all">> = [];
  if (isStock) {
    groups.push("stock");
  }
  if (isEtf) {
    groups.push("etf");
  }
  if (groups.length > 0) {
    return groups;
  }
  if (key.includes("futures") || kinds.includes("futures") || assetClasses.includes("futures")) {
    return ["futures"];
  }
  if (key.includes("spot") || kinds.includes("spot") || assetClasses.includes("spot")) {
    return ["spot"];
  }
  if (key.includes("forex") || kinds.includes("forex") || domains.includes("fx")) {
    return ["forex"];
  }
  if (
    key.includes("bond") ||
    kinds.includes("bond") ||
    kinds.includes("rate") ||
    domains.includes("bond") ||
    domains.includes("macro")
  ) {
    return ["bond"];
  }
  return ["generic"];
}

function formatDateOnly(value: number): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "--";
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
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

function normalizeMathExpression(expression: string): string {
  return expression.replace(/\s+/g, "").toLowerCase();
}

function isCommonReturnGapExpression(expression: string): boolean {
  const normalized = normalizeMathExpression(expression);
  return (
    normalized === "rg=\\frac{fv}{p}-1" ||
    normalized === "return_gap=fair_value/price-1" ||
    normalized === "\\text{return_gap=fair_value/price-1}"
  );
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "--";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "--";
  }
  if (typeof value === "string") return value.trim() || "--";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function fallbackLayerByKind(kind: ValuationMethodInputField["kind"]): GraphLayer {
  if (kind === "objective") return "top";
  if (kind === "subjective") return "first_order";
  return "output";
}

function highlightFormulaExpressionBySymbolKey(
  expression: string,
  symbolKey: string | null
): string {
  if (!symbolKey) return expression;
  const patterns = FORMULA_SYMBOL_HIGHLIGHT_PATTERNS[symbolKey] ?? [];
  if (patterns.length === 0) return expression;
  let highlighted = expression;
  for (const pattern of patterns) {
    highlighted = highlighted.replace(pattern, (match) => `\\textcolor{red}{${match}}`);
  }
  return highlighted;
}

const SEMANTIC_STOPWORDS = new Set([
  "估值",
  "模型",
  "方法",
  "策略",
  "逻辑",
  "版本",
  "计算",
  "说明",
  "相关",
  "当前",
  "内置",
  "基于",
  "相对",
  "估算",
  "股票",
  "指数",
  "基金",
  "etf",
  "stock",
  "bond",
  "forex",
  "futures",
  "spot",
  "volatility",
  "rate"
]);

const SEMANTIC_ALIASES: Record<string, string[]> = {
  ddm: ["股利折现"],
  pe: ["市盈率"],
  pb: ["市净率"],
  ps: ["市销率"],
  fcff: ["自由现金流"]
};

function semanticTokensOf(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[()（）[\]【】{}]/g, " ")
    .match(/[a-z0-9\u4e00-\u9fa5]+/g);
  if (!tokens) return new Set();
  const out = new Set<string>();
  for (const token of tokens) {
    if (!token || SEMANTIC_STOPWORDS.has(token)) continue;
    out.add(token);
    const aliases = SEMANTIC_ALIASES[token] ?? [];
    for (const alias of aliases) {
      if (!SEMANTIC_STOPWORDS.has(alias)) {
        out.add(alias);
      }
    }
  }
  return out;
}

function isTextSemanticallyDuplicate(left: string, right: string): boolean {
  const leftTokens = semanticTokensOf(left);
  const rightTokens = semanticTokensOf(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) return false;

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }
  if (overlap === 0) return false;

  const minSize = Math.min(leftTokens.size, rightTokens.size);
  const maxSize = Math.max(leftTokens.size, rightTokens.size);
  return overlap >= 2 && (overlap / minSize >= 0.8 || overlap / maxSize >= 0.6);
}

interface AtomicParamRow {
  rowId: string;
  key: string;
  kind: "objective" | "subjective" | "derived";
  kindLabel: string;
  layer: GraphLayer;
  layerLabel: string;
  traitLabel: string;
  name: string;
  symbolKey: string | null;
  symbolMath: string | null;
  currentValue: string;
  baselineValue: string;
  range: string;
  description: string;
  relationLatex: string | null;
  impactNote: string | null;
  sourceOrDefault: string;
  defaultPolicyText: string;
  statusLabel: string;
  statusDetail: string;
  editable: boolean;
  displayOrder: number;
  hasValue: boolean;
}

interface ControlParameterItem {
  id: string;
  key: string;
  symbolLatexList: string[];
  displaySymbolLatex: string | null;
  preferWide: boolean;
  value: string;
  statusLabel: string;
  statusDetail: string;
  editable: boolean;
}

function toKeyVariants(key: string): string[] {
  const snake = key.replace(/[A-Z]/g, (ch) => `_${ch.toLowerCase()}`);
  const camel = key.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase());
  return Array.from(new Set([key, snake, camel]));
}

const SYMBOL_DISPLAY_META: Record<string, { name: string }> = {
  P: { name: "市场价格" },
  FV: { name: "公允价值" },
  RG: { name: "收益偏离（相对市场价）" },
  m: { name: "动量因子" },
  sigma: { name: "波动率" },
  b: { name: "基差" },
  w_m: { name: "动量权重" },
  w_sigma: { name: "波动惩罚权重" },
  b_e: { name: "预期基差比例" },
  y_r: { name: "展期收益比例" },
  c: { name: "持有收益因子" },
  sigma_20d: { name: "20日实现波动率" },
  lambda_vol: { name: "波动率折价系数" },
  sigma_iv: { name: "隐含波动率" },
  sigma_rv: { name: "实现波动率" },
  beta_vrp: { name: "波动率风险溢价系数" },
  q_sigma: { name: "波动率分位数" },
  "q_0": { name: "分位锚点" },
  k_q: { name: "分位敏感度" },
  lambda: { name: "均值回归强度" },
  pi_inv: { name: "库存溢价" },
  lambda_sigma: { name: "波动惩罚系数" },
  g_ppp: { name: "购买力平价偏离比例" },
  d_carry: { name: "两币种年化利差" },
  h: { name: "持有期（年）" },
  g_reer: { name: "实际有效汇率偏离比例" },
  D: { name: "久期" },
  delta_y: { name: "收益率变动" },
  delta_s: { name: "信用利差变动" },
  C: { name: "凸性" },
  beta: { name: "敏感度系数" },
  delta_r: { name: "实际利率偏离" },
  "PE^*": { name: "目标市盈率" },
  "EPS_{ttm}": { name: "过去十二个月每股收益" },
  "PB^*": { name: "目标市净率" },
  BPS: { name: "每股净资产" },
  "PS^*": { name: "目标市销率" },
  "S_{ttm}": { name: "过去十二个月销售额" },
  g: { name: "长期增长率" },
  "PEG^*": { name: "目标市盈增长比" },
  "EV^*": { name: "目标企业价值" },
  "EBITDA^*": { name: "目标息税折旧摊销前利润" },
  "EV_{ttm}": { name: "过去十二个月企业价值" },
  "EBITDA_{ttm}": { name: "过去十二个月息税折旧摊销前利润" },
  "Sales^*": { name: "目标营业收入" },
  d_y: { name: "股息率" },
  r: { name: "折现率" },
  "g_1": { name: "高增长阶段增长率" },
  "g_2": { name: "稳定阶段增长率" },
  "y_{fcff}": { name: "自由现金流收益率" },
  N: { name: "高增长阶段年数" },
  WACC: { name: "加权平均资本成本" }
};

const PARAM_KEY_CONTAINS_SYMBOL_CANDIDATES: Array<{
  includes: string[];
  symbols: string[];
}> = [
  { includes: ["ev_ebitda_ttm"], symbols: ["EV_{ttm}", "EBITDA_{ttm}"] },
  { includes: ["ev_sales_ttm"], symbols: ["EV_{ttm}", "S_{ttm}"] },
  { includes: ["target_ev_ebitda", "targetevebitda"], symbols: ["EV^*", "EBITDA^*"] },
  { includes: ["target_ev_sales", "targetevsales"], symbols: ["EV^*", "Sales^*"] }
];

function normalizeKeyForContainsMatch(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9_]/g, "");
}

function resolveSymbolKeysForFieldKey(key: string): string[] {
  const variants = toKeyVariants(key);
  for (const variant of variants) {
    const candidates = PARAM_TO_SYMBOL_CANDIDATES[variant];
    if (candidates && candidates.length > 0) {
      return candidates;
    }
  }
  const normalizedVariants = variants.map(normalizeKeyForContainsMatch);
  for (const rule of PARAM_KEY_CONTAINS_SYMBOL_CANDIDATES) {
    const matched = rule.includes.some((token) =>
      normalizedVariants.some((variant) => variant.includes(token))
    );
    if (matched) {
      return rule.symbols;
    }
  }
  return [];
}

function findParamGuideByKey(key: string): { label: string; meaning: string; range?: string } | undefined {
  for (const variant of toKeyVariants(key)) {
    const guide = PARAM_GUIDES[variant];
    if (guide) return guide;
  }
  return undefined;
}

function resolveAtomicRowName(
  symbolKey: string,
  fallbackFieldLabel?: string | null,
  fallbackGuideLabel?: string
): string {
  const symbolMetaName = SYMBOL_DISPLAY_META[symbolKey]?.name;
  if (symbolMetaName) return symbolMetaName;
  const fieldLabel = fallbackFieldLabel?.trim();
  if (fieldLabel) return fieldLabel;
  const guideLabel = fallbackGuideLabel?.trim();
  if (guideLabel) return guideLabel;
  return symbolKey;
}

export function OtherValuationMethodsTab(props: OtherValuationMethodsTabProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [assetGroup, setAssetGroup] = useState<AssetGroupKey>("all");
  const [methods, setMethods] = useState<ValuationMethod[]>([]);
  const [selectedMethodKey, setSelectedMethodKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<ValuationMethodDetail | null>(null);
  const [publishEffectiveFrom, setPublishEffectiveFrom] = useState("");
  const [publishEffectiveTo, setPublishEffectiveTo] = useState("");
  const [draftParamValues, setDraftParamValues] = useState<Record<string, string>>({});
  const [draftInputSchema, setDraftInputSchema] = useState<ValuationMethodInputField[]>([]);
  const [versionDetailOpen, setVersionDetailOpen] = useState(false);
  const [schemaKindFilter, setSchemaKindFilter] =
    useState<UnifiedInputKindFilter>("all");
  const [schemaLayerFilter, setSchemaLayerFilter] =
    useState<UnifiedLayerFilter>("all");
  const [schemaOnlyEditable, setSchemaOnlyEditable] = useState(false);
  const [schemaOnlyHasValue, setSchemaOnlyHasValue] = useState(false);
  const [expandedSchemaRowId, setExpandedSchemaRowId] = useState<string | null>(null);
  const [controlEditDialog, setControlEditDialog] = useState<{
    key: string;
    symbolLatex: string | null;
    value: string;
  } | null>(null);

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
  const formulaSymbolHints = useMemo(() => getFormulaSymbolHints(formulaId), [formulaId]);
  const methodDescriptionToShow = useMemo(() => {
    if (!detail?.method.description?.trim()) return null;
    return isTextSemanticallyDuplicate(detail.method.name, detail.method.description)
      ? null
      : detail.method.description;
  }, [detail]);
  const formulaSummaryToShow = useMemo(() => {
    const summary = formulaGuide.summary?.trim();
    if (!summary) return null;
    if (detail && isTextSemanticallyDuplicate(detail.method.name, summary)) {
      return null;
    }
    if (methodDescriptionToShow && isTextSemanticallyDuplicate(methodDescriptionToShow, summary)) {
      return null;
    }
    return summary;
  }, [detail, formulaGuide.summary, methodDescriptionToShow]);
  const overviewText = useMemo(() => {
    if (methodDescriptionToShow) return methodDescriptionToShow;
    if (formulaSummaryToShow) return formulaSummaryToShow;
    return "该估值方法基于核心输入参数计算公允价值。";
  }, [formulaSummaryToShow, methodDescriptionToShow]);
  const formulaLogicBrief = useMemo(() => {
    if (formulaSummaryToShow) return formulaSummaryToShow;
    const summary = formulaGuide.summary?.trim();
    if (summary) return summary;
    return "根据核心输入参数计算公允价值。";
  }, [formulaGuide.summary, formulaSummaryToShow]);
  const formulaDisplaySteps = useMemo(() => {
    const rawSteps =
      formulaGuide.stepsLatex.length > 0
        ? formulaGuide.stepsLatex
        : formulaGuide.steps.map((step) => `\\text{${step}}`);
    const methodSpecificSteps = rawSteps.filter((step) => !isCommonReturnGapExpression(step));
    return methodSpecificSteps.length > 0 ? methodSpecificSteps : rawSteps;
  }, [formulaGuide]);

  useEffect(() => {
    if (!selectedVersion) {
      setDraftParamValues({});
      setDraftInputSchema([]);
      return;
    }
    const nextDraft: Record<string, string> = {};
    for (const [key, value] of Object.entries(selectedVersion.paramSchema)) {
      nextDraft[key] = toDraftString(value);
    }
    setDraftParamValues(nextDraft);
    setDraftInputSchema(
      selectedVersion.inputSchema.length > 0
        ? selectedVersion.inputSchema
        : []
    );
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

  useEffect(() => {
    setVersionDetailOpen(false);
    setSchemaKindFilter("all");
    setSchemaLayerFilter("all");
    setSchemaOnlyEditable(false);
    setSchemaOnlyHasValue(false);
    setExpandedSchemaRowId(null);
    setControlEditDialog(null);
  }, [selectedMethodKey]);

  useEffect(() => {
    if (!versionDetailOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setVersionDetailOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [versionDetailOpen]);

  const visibleMethods = useMemo(() => {
    return methods.filter((method) => method.isBuiltin);
  }, [methods]);

  const filteredMethods = useMemo(() => {
    if (assetGroup === "all") return visibleMethods;
    return visibleMethods.filter((method) =>
      inferAssetGroups(method).includes(assetGroup as Exclude<AssetGroupKey, "all">)
    );
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
      const groups = inferAssetGroups(method);
      for (const key of groups) {
        const list = map.get(key) ?? [];
        if (!list.some((item) => item.methodKey === method.methodKey)) {
          list.push(method);
        }
        map.set(key, list);
      }
    }
    return map;
  }, [filteredMethods]);

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

  const graphNodeByKey = useMemo(() => {
    const map = new Map<string, ValuationMethodVersion["graph"][number]>();
    for (const node of selectedVersion?.graph ?? []) {
      map.set(node.key, node);
    }
    return map;
  }, [selectedVersion]);

  const formulaSymbolHintByKey = useMemo(() => {
    const map = new Map<string, FormulaSymbolHint>();
    for (const hint of formulaSymbolHints) {
      map.set(hint.key, hint);
    }
    return map;
  }, [formulaSymbolHints]);
  const formulaSymbolKeySet = useMemo(
    () => new Set(formulaSymbolHints.map((hint) => hint.key)),
    [formulaSymbolHints]
  );
  const draftParamKeySet = useMemo(() => new Set(Object.keys(draftParamValues)), [draftParamValues]);
  const resolveDraftParamKey = useCallback(
    (key: string): string | null => {
      const candidates = toKeyVariants(key);
      return candidates.find((candidate) => draftParamKeySet.has(candidate)) ?? null;
    },
    [draftParamKeySet]
  );

  const unifiedSchemaRows = useMemo<AtomicParamRow[]>(() => {
    const isBuiltinMethod = Boolean(detail?.method.isBuiltin);
    const rows: AtomicParamRow[] = [];
    const emittedRowKeys = new Set<string>();
    const schemaFieldKeys = new Set<string>();

    const resolveDraftParamValue = (paramKey: string | null, fallbackValue: unknown): unknown => {
      if (!paramKey) return fallbackValue;
      const raw = draftParamValues[paramKey];
      if (raw === undefined) return fallbackValue;
      return parseDraftValue(raw);
    };

    const appendRow = (row: AtomicParamRow) => {
      const dedupeKey = `${row.kind}:${row.key}:${row.symbolKey ?? row.symbolMath ?? "none"}`;
      if (emittedRowKeys.has(dedupeKey)) return;
      emittedRowKeys.add(dedupeKey);
      rows.push(row);
    };

    const appendFieldRows = (
      field: ValuationMethodInputField,
      rowPrefix: string,
      currentRawValue: unknown,
      baselineRawValue: unknown,
      allowEdit: boolean
    ) => {
      if (field.key === "output.return_gap" || field.key === "valuation.return_gap") return;
      const symbolKeys = resolveSymbolKeysForFieldKey(field.key).filter((key) =>
        formulaSymbolKeySet.has(key)
      );
      if (symbolKeys.length === 0) return;
      const graphNode = graphNodeByKey.get(field.key) ?? null;
      const layer = (graphNode?.layer as GraphLayer | undefined) ?? fallbackLayerByKind(field.kind);
      const guide = findParamGuideByKey(field.key);
      const defaultPolicyText =
        field.kind === "subjective"
          ? `默认策略：${DEFAULT_POLICY_LABELS[field.defaultPolicy]}`
          : "默认策略：--";
      const sourceOrDefault =
        field.kind === "objective"
          ? `来源：${field.objectiveSource ?? "--"}`
          : field.kind === "subjective"
            ? defaultPolicyText
            : "来源：模型计算";
      const statusLabel =
        field.kind === "objective" ? "自动采集" : field.kind === "derived" ? "模型输出" : "主观参数";
      const statusDetail =
        field.kind === "objective"
          ? "客观输入 · 只读"
          : field.kind === "derived"
            ? "派生输出 · 只读"
            : allowEdit
              ? "主观输入 · 可在控制参数中调整"
              : isBuiltinMethod
                ? "主观输入 · 只读（内置）"
                : "主观输入 · 只读";

      symbolKeys.forEach((symbolKey, index) => {
        const symbolHint =
          formulaSymbolHintByKey.get(symbolKey) ?? FORMULA_SYMBOL_HINT_LIBRARY[symbolKey] ?? null;
        if (!symbolHint) return;
        const descriptionSegments = [
          symbolHint.meaning,
          field.description,
          guide?.meaning,
          METRIC_GUIDES[field.key]
        ].filter((item): item is string => Boolean(item && item.trim()));
        const mergedDescription: string[] = [];
        for (const segment of descriptionSegments) {
          if (!mergedDescription.some((existing) => isTextSemanticallyDuplicate(existing, segment))) {
            mergedDescription.push(segment);
          }
        }
        appendRow({
          rowId: `${rowPrefix}:${field.key}:${symbolKey}:${index}`,
          key: field.key,
          kind: field.kind,
          kindLabel: INPUT_KIND_LABELS[field.kind],
          layer,
          layerLabel: GRAPH_LAYER_LABELS[layer],
          traitLabel: `${INPUT_KIND_TRAIT_PREFIX_LABELS[field.kind]} · ${GRAPH_LAYER_LABELS[layer]}`,
          name: resolveAtomicRowName(symbolKey, field.label, guide?.label),
          symbolKey,
          symbolMath: symbolHint.symbol,
          currentValue:
            field.kind === "subjective" ? formatCellValue(currentRawValue) : "--",
          baselineValue:
            field.kind === "subjective" ? formatCellValue(baselineRawValue) : "--",
          range: guide?.range ?? "--",
          description: mergedDescription.join(" "),
          relationLatex: symbolHint.relationLatex ?? null,
          impactNote: symbolHint.impactNote ?? null,
          sourceOrDefault,
          defaultPolicyText,
          statusLabel,
          statusDetail,
          editable: field.kind === "subjective" && allowEdit,
          displayOrder: field.displayOrder + index / 10,
          hasValue:
            (field.kind === "subjective" &&
              (formatCellValue(currentRawValue) !== "--" ||
                formatCellValue(baselineRawValue) !== "--")) ||
            field.kind !== "subjective"
        });
      });
    };

    for (const field of draftInputSchema) {
      schemaFieldKeys.add(field.key);
      const paramDraftKey = field.kind === "subjective" ? resolveDraftParamKey(field.key) : null;
      const currentRawValue =
        field.kind === "subjective"
          ? resolveDraftParamValue(
              paramDraftKey,
              selectedVersion?.paramSchema[field.key] ?? field.defaultValue
            )
          : null;
      const baselineRawValue =
        field.kind === "subjective" ? field.defaultValue : null;
      appendFieldRows(
        field,
        "schema",
        currentRawValue,
        baselineRawValue,
        field.kind === "subjective" && field.editable && Boolean(paramDraftKey) && !isBuiltinMethod
      );
    }

    if (selectedVersion) {
      const parameterKeys = Object.keys(selectedVersion.paramSchema).sort((a, b) =>
        a.localeCompare(b)
      );
      for (const key of parameterKeys) {
        if (key === "output.return_gap" || key === "valuation.return_gap") continue;
        if (schemaFieldKeys.has(key)) continue;
        const paramDraftKey = resolveDraftParamKey(key) ?? key;
        const currentRawValue = resolveDraftParamValue(paramDraftKey, selectedVersion.paramSchema[key]);
        const pseudoField: ValuationMethodInputField = {
          key,
          label: findParamGuideByKey(key)?.label ?? key,
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "none",
          defaultValue: selectedVersion.paramSchema[key] as number | null,
          displayOrder: 9_999,
          description: findParamGuideByKey(key)?.meaning ?? null
        };
        appendFieldRows(
          pseudoField,
          "param",
          currentRawValue,
          selectedVersion.paramSchema[key],
          !isBuiltinMethod && Boolean(paramDraftKey)
        );
      }
    }

    const rowPriority = (row: AtomicParamRow): number => {
      if (row.kind === "subjective") return 0;
      if (row.kind === "objective") return 1;
      return 2;
    };

    const bestRowBySymbol = new Map<string, AtomicParamRow>();
    for (const row of rows) {
      if (!row.symbolKey) continue;
      const previous = bestRowBySymbol.get(row.symbolKey);
      if (!previous) {
        bestRowBySymbol.set(row.symbolKey, row);
        continue;
      }
      const previousPriority = rowPriority(previous);
      const currentPriority = rowPriority(row);
      if (
        currentPriority < previousPriority ||
        (currentPriority === previousPriority && row.displayOrder < previous.displayOrder)
      ) {
        bestRowBySymbol.set(row.symbolKey, row);
      }
    }

    const dedupedRows = rows.filter((row) => {
      if (!row.symbolKey) return true;
      return bestRowBySymbol.get(row.symbolKey)?.rowId === row.rowId;
    });

    const expectedSymbolKeys =
      FORMULA_SYMBOL_HINT_KEYS[formulaId] ?? FORMULA_SYMBOL_HINT_KEYS.generic_factor_v1;
    const presentSymbolKeys = new Set(
      dedupedRows
        .map((row) => row.symbolKey)
        .filter((item): item is string => Boolean(item))
    );
    for (const symbolKey of expectedSymbolKeys) {
      if (symbolKey === "RG" || presentSymbolKeys.has(symbolKey)) continue;
      const hint = formulaSymbolHintByKey.get(symbolKey) ?? FORMULA_SYMBOL_HINT_LIBRARY[symbolKey];
      if (!hint) continue;
      dedupedRows.push({
        rowId: `missing:${formulaId}:${symbolKey}`,
        key: `missing.${symbolKey}`,
        kind: symbolKey === "FV" ? "derived" : "objective",
        kindLabel: symbolKey === "FV" ? INPUT_KIND_LABELS.derived : INPUT_KIND_LABELS.objective,
        layer: symbolKey === "FV" ? "output" : "top",
        layerLabel: symbolKey === "FV" ? GRAPH_LAYER_LABELS.output : GRAPH_LAYER_LABELS.top,
        traitLabel:
          symbolKey === "FV"
            ? `${INPUT_KIND_TRAIT_PREFIX_LABELS.derived} · ${GRAPH_LAYER_LABELS.output}`
            : `${INPUT_KIND_TRAIT_PREFIX_LABELS.objective} · ${GRAPH_LAYER_LABELS.top}`,
        name: resolveAtomicRowName(symbolKey, hint.meaning, hint.meaning),
        symbolKey,
        symbolMath: hint.symbol,
        currentValue: "--",
        baselineValue: "--",
        range: "--",
        description: hint.meaning,
        relationLatex: hint.relationLatex ?? null,
        impactNote: hint.impactNote ?? null,
        sourceOrDefault: "来源：公式符号补齐",
        defaultPolicyText: "默认策略：--",
        statusLabel: "待映射",
        statusDetail: "公式存在该符号，但输入定义未映射到该符号。",
        editable: false,
        displayOrder: 99_999,
        hasValue: false
      });
    }

    return dedupedRows.sort((left, right) => {
      const byKind = INPUT_KIND_ORDER[left.kind] - INPUT_KIND_ORDER[right.kind];
      if (byKind !== 0) return byKind;
      const byLayer =
        GRAPH_LAYER_ORDER.indexOf(left.layer) - GRAPH_LAYER_ORDER.indexOf(right.layer);
      if (byLayer !== 0) return byLayer;
      const byDisplayOrder = left.displayOrder - right.displayOrder;
      if (byDisplayOrder !== 0) return byDisplayOrder;
      return left.key.localeCompare(right.key);
    });
  }, [
    draftInputSchema,
    draftParamValues,
    detail?.method.isBuiltin,
    formulaId,
    formulaSymbolHintByKey,
    formulaSymbolKeySet,
    graphNodeByKey,
    resolveDraftParamKey,
    selectedVersion
  ]);

  const controlParameterItems = useMemo<ControlParameterItem[]>(() => {
    if (!selectedVersion) return [];
    const items: ControlParameterItem[] = [];
    const emittedKeys = new Set<string>();
    const isBuiltinMethod = Boolean(detail?.method.isBuiltin);
    const schemaFieldKeys = new Set(draftInputSchema.map((field) => field.key));

    const resolveControlStatus = (
      schemaEditable: boolean | null
    ): { editable: boolean; statusLabel: string; statusDetail: string } => {
      if (isBuiltinMethod) {
        return { editable: false, statusLabel: "内置", statusDetail: "内置只读" };
      }
      if (schemaEditable === false) {
        return { editable: false, statusLabel: "只读", statusDetail: "规则只读" };
      }
      return { editable: true, statusLabel: "可修改", statusDetail: "可编辑" };
    };

    const appendControlItem = (
      fieldKey: string,
      defaultValue: unknown,
      schemaEditable: boolean | null
    ) => {
      const paramDraftKey = resolveDraftParamKey(fieldKey) ?? fieldKey;
      if (emittedKeys.has(paramDraftKey)) return;
      const symbolKeys = resolveSymbolKeysForFieldKey(fieldKey).filter((key) =>
        formulaSymbolKeySet.has(key)
      );
      if (symbolKeys.length === 0) return;
      emittedKeys.add(paramDraftKey);
      const status = resolveControlStatus(schemaEditable);
      const symbolLatexList = symbolKeys.map(
        (symbolKey) => FORMULA_SYMBOL_HINT_LIBRARY[symbolKey]?.symbol ?? symbolKey
      );
      items.push({
        id: `control:${paramDraftKey}`,
        key: paramDraftKey,
        symbolLatexList,
        displaySymbolLatex:
          symbolLatexList.length === 0
            ? null
            : symbolLatexList.length === 1
              ? symbolLatexList[0]
              : symbolLatexList.join(" / "),
        preferWide:
          symbolLatexList.length > 1 ||
          (symbolLatexList.length === 1 && (symbolLatexList[0]?.length ?? 0) >= 14),
        value: draftParamValues[paramDraftKey] ?? toDraftString(defaultValue),
        editable: status.editable,
        statusLabel: status.statusLabel,
        statusDetail: status.statusDetail
      });
    };

    for (const field of draftInputSchema) {
      if (field.kind !== "subjective") continue;
      appendControlItem(field.key, field.defaultValue, field.editable);
    }

    for (const [key, value] of Object.entries(selectedVersion.paramSchema)) {
      if (schemaFieldKeys.has(key)) continue;
      appendControlItem(key, value, null);
    }

    return items.sort((left, right) => left.key.localeCompare(right.key, "zh-Hans-CN"));
  }, [
    detail?.method.isBuiltin,
    draftInputSchema,
    draftParamValues,
    formulaSymbolKeySet,
    resolveDraftParamKey,
    selectedVersion
  ]);

  const filteredUnifiedSchemaRows = useMemo(() => {
    return unifiedSchemaRows.filter((row) => {
      if (schemaKindFilter !== "all" && row.kind !== schemaKindFilter) return false;
      if (schemaLayerFilter !== "all" && row.layer !== schemaLayerFilter) {
        return false;
      }
      if (schemaOnlyEditable && !row.editable) {
        return false;
      }
      if (schemaOnlyHasValue && !row.hasValue) {
        return false;
      }
      return true;
    });
  }, [
    schemaKindFilter,
    schemaLayerFilter,
    schemaOnlyEditable,
    schemaOnlyHasValue,
    unifiedSchemaRows
  ]);

  useEffect(() => {
    if (
      expandedSchemaRowId &&
      !filteredUnifiedSchemaRows.some((row) => row.rowId === expandedSchemaRowId)
    ) {
      setExpandedSchemaRowId(null);
    }
  }, [expandedSchemaRowId, filteredUnifiedSchemaRows]);

  const activeFormulaSymbolKey = useMemo(() => {
    if (!expandedSchemaRowId) return null;
    const activeRow =
      filteredUnifiedSchemaRows.find((row) => row.rowId === expandedSchemaRowId) ?? null;
    if (!activeRow) return null;
    if (activeRow.kind === "derived") return null;
    return activeRow.symbolKey ?? null;
  }, [expandedSchemaRowId, filteredUnifiedSchemaRows]);

  const highlightedFormulaSteps = useMemo(() => {
    return formulaDisplaySteps.map((step) =>
      highlightFormulaExpressionBySymbolKey(step, activeFormulaSymbolKey)
    );
  }, [activeFormulaSymbolKey, formulaDisplaySteps]);

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
        metricSchema: selectedVersion.metricSchema,
        inputSchema: draftInputSchema
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
    draftInputSchema,
    draftParamValues,
    loadMethods,
    marketApi,
    publishEffectiveFrom,
    publishEffectiveTo,
    selectedVersion
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
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
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-[11px] text-right text-slate-500 dark:text-slate-400">
                        版本 v{selectedVersion?.version ?? "--"} · 创建{" "}
                        {formatDateOnly(detail.method.createdAt)} · 更新{" "}
                        {formatDateOnly(detail.method.updatedAt)}
                      </div>
                      <props.Button
                        variant="secondary"
                        size="sm"
                        icon="info"
                        className="!bg-transparent hover:!bg-transparent dark:!bg-transparent dark:hover:!bg-transparent"
                        onClick={() => setVersionDetailOpen(true)}
                        aria-label="版本详情"
                        title="版本详情"
                      />
                    </div>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    {overviewText}
                  </div>
                </div>

                <div className="rounded-md border border-slate-200 dark:border-border-dark p-3 space-y-3">
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-100">计算逻辑</div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="space-y-1 md:col-span-2">
                      {highlightedFormulaSteps.map((step, index) => (
                        <div
                          key={`${formulaId}.${index}`}
                          className="rounded-md border border-slate-200 dark:border-border-dark px-2 py-1.5 bg-slate-50/70 dark:bg-background-dark/40 text-slate-700 dark:text-slate-200"
                        >
                          <BlockMath math={step} />
                        </div>
                      ))}
                    </div>
                    <div className="md:col-span-1 rounded-md border border-slate-200 dark:border-border-dark px-3 py-2">
                      <div className="text-xs text-slate-600 dark:text-slate-300 leading-5">
                        {formulaLogicBrief}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-md border border-slate-200 dark:border-border-dark p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        参数定义
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        className="ui-input rounded-md px-2 py-1 text-[11px] w-[96px]"
                        value={schemaKindFilter}
                        onChange={(event) =>
                          setSchemaKindFilter(event.target.value as UnifiedInputKindFilter)
                        }
                      >
                        <option value="all">全部类别</option>
                        <option value="objective">客观输入</option>
                        <option value="subjective">主观输入</option>
                        <option value="derived">派生输出</option>
                      </select>
                      <select
                        className="ui-input rounded-md px-2 py-1 text-[11px] w-[96px]"
                        value={schemaLayerFilter}
                        onChange={(event) =>
                          setSchemaLayerFilter(event.target.value as UnifiedLayerFilter)
                        }
                      >
                        <option value="all">全部阶数</option>
                        {GRAPH_LAYER_ORDER.map((layer) => (
                          <option key={layer} value={layer}>
                            {GRAPH_LAYER_LABELS[layer]}
                          </option>
                        ))}
                      </select>
                      <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-border-dark rounded px-2 py-1">
                        <input
                          type="checkbox"
                          checked={schemaOnlyEditable}
                          onChange={(event) => setSchemaOnlyEditable(event.target.checked)}
                        />
                        仅可编辑
                      </label>
                      <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-border-dark rounded px-2 py-1">
                        <input
                          type="checkbox"
                          checked={schemaOnlyHasValue}
                          onChange={(event) => setSchemaOnlyHasValue(event.target.checked)}
                        />
                        仅有值
                      </label>
                    </div>
                  </div>

                  <div className="max-h-[420px] overflow-y-auto overflow-x-hidden rounded border border-slate-200 dark:border-border-dark">
                    <table className="w-full text-[12px] table-fixed">
                      <thead className="bg-slate-50/70 dark:bg-background-dark/40 sticky top-0 z-10">
                        <tr className="text-slate-600 dark:text-slate-300">
                          <th className="text-left font-semibold px-2 py-2 w-[14%]">参数</th>
                          <th className="text-left font-semibold px-2 py-2 w-[28%]">名称</th>
                          <th className="text-left font-semibold px-2 py-2 w-[24%]">属性</th>
                          <th className="text-center font-semibold px-1 py-2 w-[12%]">当前值</th>
                          <th className="text-center font-semibold px-1 py-2 w-[12%]">基准值</th>
                          <th className="text-left font-semibold px-2 py-2 w-[10%]">状态</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUnifiedSchemaRows.map((row) => {
                          const expanded = row.rowId === expandedSchemaRowId;
                          return [
                            <tr
                              key={row.rowId}
                              className="border-t border-slate-100 dark:border-border-dark/60 cursor-pointer"
                              onClick={() =>
                                setExpandedSchemaRowId((previous) =>
                                  previous === row.rowId ? null : row.rowId
                                )
                              }
                            >
                              <td className="px-2 py-1.5 text-slate-800 dark:text-slate-100 whitespace-nowrap overflow-hidden text-ellipsis">
                                {row.symbolMath ? (
                                  <InlineMath math={row.symbolMath} />
                                ) : (
                                  <span className="font-mono">{row.key}</span>
                                )}
                              </td>
                              <td
                                className="px-2 py-1.5 text-slate-700 dark:text-slate-200 whitespace-nowrap overflow-hidden text-ellipsis"
                                title={row.name}
                              >
                                <span className="block truncate">{row.name}</span>
                              </td>
                              <td
                                className="px-2 py-1.5 text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap overflow-hidden text-ellipsis"
                                title={row.traitLabel}
                              >
                                <span className="block truncate">{row.traitLabel}</span>
                              </td>
                              <td className="px-2 py-1.5 text-center font-mono text-slate-800 dark:text-slate-100">
                                {row.currentValue}
                              </td>
                              <td className="px-2 py-1.5 text-center font-mono text-slate-800 dark:text-slate-100">
                                <div className="group relative inline-flex">
                                  <span>{row.baselineValue}</span>
                                  <div className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-[180px] rounded border border-slate-200 dark:border-border-dark bg-white dark:bg-panel-dark px-2 py-1 text-[11px] leading-5 text-slate-600 dark:text-slate-300 shadow-sm whitespace-pre-line group-hover:block">
                                    {`${row.defaultPolicyText}\n建议区间：${row.range}`}
                                  </div>
                                </div>
                              </td>
                              <td className="px-2 py-1.5">
                                <span
                                  className="text-[11px] px-1.5 py-0.5 rounded border border-slate-200 dark:border-border-dark text-slate-600 dark:text-slate-300 whitespace-nowrap"
                                  title={row.statusDetail}
                                >
                                  {row.statusLabel}
                                </span>
                              </td>
                            </tr>,
                            expanded ? (
                              <tr
                                key={`${row.rowId}:detail`}
                                className="border-t border-slate-100 dark:border-border-dark/60"
                              >
                                <td colSpan={6} className="px-3 py-2 text-[11px] text-slate-600 dark:text-slate-300">
                                  <div className="space-y-1">
                                    <div>说明：{row.description}</div>
                                    {row.relationLatex && (
                                      <div className="flex items-center gap-1">
                                        <span>关系：</span>
                                        <InlineMath math={row.relationLatex} />
                                      </div>
                                    )}
                                    {row.impactNote && <div>影响：{row.impactNote}</div>}
                                  </div>
                                </td>
                              </tr>
                            ) : null
                          ];
                        })}
                        {filteredUnifiedSchemaRows.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-2 py-3 text-xs text-slate-500 dark:text-slate-400">
                              当前筛选下暂无字段定义。
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {controlParameterItems.length > 0 && (
                    <div className="rounded border border-slate-200 dark:border-border-dark px-2 py-2 space-y-2">
                      <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        控制参数
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {controlParameterItems.map((item) => (
                          <div
                            key={item.id}
                            className={`rounded border border-slate-200 dark:border-border-dark px-2 py-1.5 ${
                              item.preferWide ? "lg:col-span-2" : ""
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 whitespace-nowrap">
                              <div className="text-sm text-slate-700 dark:text-slate-200">
                                {item.displaySymbolLatex ? (
                                  <InlineMath math={item.displaySymbolLatex} />
                                ) : (
                                  <span className="font-mono">{item.key}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-center">
                                <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300 truncate">
                                  {formatCellValue(parseDraftValue(item.value))}
                                </span>
                                <button
                                  type="button"
                                  className="px-1.5 py-1 rounded border border-slate-200 dark:border-border-dark text-[11px] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-background-dark/60 disabled:opacity-60"
                                  disabled={!item.editable}
                                  onClick={() =>
                                    setControlEditDialog({
                                      key: item.key,
                                      symbolLatex: item.displaySymbolLatex,
                                      value: item.value
                                    })
                                  }
                                >
                                  值设置
                                </button>
                              </div>
                              <div className="flex items-center justify-end">
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap ${
                                    item.editable
                                      ? "border-emerald-200 text-emerald-700"
                                      : "border-slate-200 dark:border-border-dark text-slate-500 dark:text-slate-400"
                                  }`}
                                  title={item.statusDetail}
                                >
                                  {item.statusLabel}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              </>
            )}
          </section>
        </div>
      </div>

      {controlEditDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/35"
            onClick={() => setControlEditDialog(null)}
            aria-label="关闭值设置"
          />
          <div className="relative z-10 w-[min(420px,92vw)] rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-panel-dark shadow-xl">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-border-dark flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                值设置
              </div>
              <button
                type="button"
                className="text-xs px-2 py-1 rounded border border-slate-200 dark:border-border-dark text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-background-dark/60"
                onClick={() => setControlEditDialog(null)}
              >
                关闭
              </button>
            </div>
            <div className="px-4 py-3 space-y-3">
              <div className="text-xs text-slate-600 dark:text-slate-300 inline-flex items-center gap-1">
                {controlEditDialog.symbolLatex ? (
                  <InlineMath math={controlEditDialog.symbolLatex} />
                ) : (
                  <span className="font-mono">{controlEditDialog.key}</span>
                )}
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  ({controlEditDialog.key})
                </span>
              </div>
              <input
                className="ui-input w-full rounded-md px-2 py-1.5 text-sm font-mono"
                value={controlEditDialog.value}
                onChange={(event) =>
                  setControlEditDialog((previous) =>
                    previous ? { ...previous, value: event.target.value } : previous
                  )
                }
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="text-xs px-2.5 py-1.5 rounded border border-slate-200 dark:border-border-dark text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-background-dark/60"
                  onClick={() => setControlEditDialog(null)}
                >
                  取消
                </button>
                <props.Button
                  variant="primary"
                  size="sm"
                  icon="check"
                  onClick={() => {
                    setDraftParamValues((previous) => ({
                      ...previous,
                      [controlEditDialog.key]: controlEditDialog.value
                    }));
                    setControlEditDialog(null);
                  }}
                >
                  确认
                </props.Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {versionDetailOpen && detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/35"
            onClick={() => setVersionDetailOpen(false)}
            aria-label="关闭版本详情"
          />
          <div className="relative z-10 w-[min(1080px,92vw)] max-h-[86vh] rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-panel-dark shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-border-dark flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                  版本详情
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {detail.method.name}
                </div>
              </div>
              <button
                type="button"
                className="text-xs px-2.5 py-1.5 rounded border border-slate-200 dark:border-border-dark text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-background-dark/60"
                onClick={() => setVersionDetailOpen(false)}
              >
                关闭
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto max-h-[calc(86vh-56px)]">
              <div className="rounded-md border border-slate-200 dark:border-border-dark p-3 space-y-3">
                <div className="text-sm font-medium text-slate-800 dark:text-slate-100">版本时间轴</div>
                <div className="max-h-52 overflow-y-auto rounded border border-slate-200 dark:border-border-dark">
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
                            创建：{props.formatDateTime(version.createdAt)}
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
                <div className="text-sm font-medium text-slate-800 dark:text-slate-100">版本差异（参数）</div>
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
                  <div className="max-h-52 overflow-y-auto rounded border border-slate-200 dark:border-border-dark">
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

                    <div className="max-h-52 overflow-y-auto rounded border border-slate-200 dark:border-border-dark">
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
