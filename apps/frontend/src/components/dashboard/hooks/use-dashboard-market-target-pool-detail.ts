import { useCallback, useEffect, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";

interface TargetPoolCategoryDetail {
  key: string;
  label: string;
  symbols: string[];
}

interface TargetPoolStructureStatsLike {
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
}

type TargetPoolMetricKey =
  | "totalSymbols"
  | "industryL1Count"
  | "industryL2Count"
  | "conceptCount"
  | "unclassifiedCount"
  | "classificationCoverage";

interface TargetPoolMetricCard {
  key: TargetPoolMetricKey;
  label: string;
  value: string;
}

interface TargetPoolDetailCategoryRow {
  key: string;
  label: string;
  symbols: string[];
  count: number;
  ratio: number | null;
}

export interface UseDashboardMarketTargetPoolDetailOptions {
  marketTargetPoolStatsScope: "universe" | "focus";
  marketActiveTargetPoolStats: TargetPoolStructureStatsLike;
  marketTargetPoolDetailMetric: string | null;
  marketTargetPoolDetailCategoryKey: string | null;
  marketTargetPoolDetailMemberFilter: string;
  formatPct: (value: number) => string;
  setMarketTargetPoolDetailCategoryKey: Dispatch<SetStateAction<string | null>>;
  setMarketTargetPoolDetailMemberFilter: Dispatch<SetStateAction<string>>;
  setMarketTargetsSectionOpen: Dispatch<
    SetStateAction<{ scope: boolean; symbols: boolean }>
  >;
  setMarketDiffSectionOpen: Dispatch<
    SetStateAction<{ added: boolean; removed: boolean; reasonChanged: boolean }>
  >;
}

export function useDashboardMarketTargetPoolDetail(
  options: UseDashboardMarketTargetPoolDetailOptions
) {
  const marketTargetPoolScopeLabel = useMemo(
    () =>
      options.marketTargetPoolStatsScope === "universe" ? "全量标的" : "强相关标的",
    [options.marketTargetPoolStatsScope]
  );

  const marketTargetPoolMetricCards = useMemo<TargetPoolMetricCard[]>(
    () => [
      {
        key: "totalSymbols",
        label: "标的总数",
        value: String(options.marketActiveTargetPoolStats.totalSymbols)
      },
      {
        key: "industryL1Count",
        label: "一级行业分类",
        value: String(options.marketActiveTargetPoolStats.industryL1Count)
      },
      {
        key: "industryL2Count",
        label: "二级行业分类",
        value: String(options.marketActiveTargetPoolStats.industryL2Count)
      },
      {
        key: "conceptCount",
        label: "概念分类数",
        value: String(options.marketActiveTargetPoolStats.conceptCount)
      },
      {
        key: "unclassifiedCount",
        label: "未分类标的",
        value: String(options.marketActiveTargetPoolStats.unclassifiedCount)
      },
      {
        key: "classificationCoverage",
        label: "分类覆盖率",
        value:
          options.marketActiveTargetPoolStats.classificationCoverage === null
            ? "--"
            : options.formatPct(options.marketActiveTargetPoolStats.classificationCoverage)
      }
    ],
    [options.formatPct, options.marketActiveTargetPoolStats]
  );

  const marketTargetPoolDetailTitle = useMemo(() => {
    if (!options.marketTargetPoolDetailMetric) return "";
    const card = marketTargetPoolMetricCards.find(
      (item) => item.key === options.marketTargetPoolDetailMetric
    );
    return `${marketTargetPoolScopeLabel} · ${card?.label ?? "指标详情"}`;
  }, [
    options.marketTargetPoolDetailMetric,
    marketTargetPoolMetricCards,
    marketTargetPoolScopeLabel
  ]);

  const marketTargetPoolDetailValue = useMemo(() => {
    if (!options.marketTargetPoolDetailMetric) return "--";
    const card = marketTargetPoolMetricCards.find(
      (item) => item.key === options.marketTargetPoolDetailMetric
    );
    return card?.value ?? "--";
  }, [options.marketTargetPoolDetailMetric, marketTargetPoolMetricCards]);

  const marketTargetPoolDetailDescription = useMemo(() => {
    if (!options.marketTargetPoolDetailMetric) return "";
    switch (options.marketTargetPoolDetailMetric) {
      case "totalSymbols":
        return "当前口径下参与统计的标的总数。";
      case "industryL1Count":
        return "已命中的一级行业分类标签。";
      case "industryL2Count":
        return "已命中的二级行业分类标签。";
      case "conceptCount":
        return "已命中的概念（主题）分类标签。";
      case "unclassifiedCount":
        return "未命中行业与概念分类的标的数量。";
      case "classificationCoverage":
        return "有任一行业或概念分类的标的占比。";
      default:
        return "";
    }
  }, [options.marketTargetPoolDetailMetric]);

  const marketTargetPoolDetailCategoryRows = useMemo<TargetPoolDetailCategoryRow[]>(() => {
    if (!options.marketTargetPoolDetailMetric) return [];

    const total = Math.max(0, options.marketActiveTargetPoolStats.totalSymbols);
    const toRow = (detail: TargetPoolCategoryDetail) => {
      const count = detail.symbols.length;
      return {
        key: detail.key,
        label: detail.label,
        symbols: detail.symbols,
        count,
        ratio: total > 0 ? count / total : null
      };
    };

    switch (options.marketTargetPoolDetailMetric) {
      case "industryL1Count":
        return options.marketActiveTargetPoolStats.industryL1Details.map(toRow);
      case "industryL2Count":
        return options.marketActiveTargetPoolStats.industryL2Details.map(toRow);
      case "conceptCount":
        return options.marketActiveTargetPoolStats.conceptDetails.map(toRow);
      case "unclassifiedCount":
        return [
          toRow({
            key: "unclassified",
            label: "未分类",
            symbols: options.marketActiveTargetPoolStats.unclassifiedSymbols
          })
        ];
      case "classificationCoverage":
        return [
          toRow({
            key: "classified",
            label: "已分类",
            symbols: options.marketActiveTargetPoolStats.classifiedSymbols
          }),
          toRow({
            key: "unclassified",
            label: "未分类",
            symbols: options.marketActiveTargetPoolStats.unclassifiedSymbols
          })
        ];
      case "totalSymbols":
      default:
        return [
          toRow({
            key: "all",
            label: "全部标的",
            symbols: options.marketActiveTargetPoolStats.allSymbols
          }),
          toRow({
            key: "classified",
            label: "已分类",
            symbols: options.marketActiveTargetPoolStats.classifiedSymbols
          }),
          toRow({
            key: "unclassified",
            label: "未分类",
            symbols: options.marketActiveTargetPoolStats.unclassifiedSymbols
          })
        ];
    }
  }, [options.marketActiveTargetPoolStats, options.marketTargetPoolDetailMetric]);

  const marketTargetPoolActiveCategoryRow = useMemo(() => {
    if (marketTargetPoolDetailCategoryRows.length === 0) return null;
    const selected = marketTargetPoolDetailCategoryRows.find(
      (row) => row.key === options.marketTargetPoolDetailCategoryKey
    );
    return selected ?? marketTargetPoolDetailCategoryRows[0];
  }, [
    marketTargetPoolDetailCategoryRows,
    options.marketTargetPoolDetailCategoryKey
  ]);

  const marketTargetPoolDetailMembers = useMemo(() => {
    const source = marketTargetPoolActiveCategoryRow?.symbols ?? [];
    const keyword = options.marketTargetPoolDetailMemberFilter.trim().toLowerCase();
    if (!keyword) return source;
    return source.filter((symbol) => {
      const normalized = symbol.toLowerCase();
      if (normalized.includes(keyword)) return true;
      const name = options.marketActiveTargetPoolStats.symbolNames[symbol]?.toLowerCase() ?? "";
      return Boolean(name && name.includes(keyword));
    });
  }, [
    marketTargetPoolActiveCategoryRow,
    options.marketActiveTargetPoolStats.symbolNames,
    options.marketTargetPoolDetailMemberFilter
  ]);

  useEffect(() => {
    if (!options.marketTargetPoolDetailMetric) {
      options.setMarketTargetPoolDetailCategoryKey(null);
      options.setMarketTargetPoolDetailMemberFilter("");
      return;
    }
    options.setMarketTargetPoolDetailCategoryKey(null);
    options.setMarketTargetPoolDetailMemberFilter("");
  }, [
    options.marketTargetPoolDetailMetric,
    options.marketTargetPoolStatsScope,
    options.setMarketTargetPoolDetailCategoryKey,
    options.setMarketTargetPoolDetailMemberFilter
  ]);

  useEffect(() => {
    if (!marketTargetPoolDetailCategoryRows.length) {
      options.setMarketTargetPoolDetailCategoryKey(null);
      return;
    }
    if (
      !options.marketTargetPoolDetailCategoryKey ||
      !marketTargetPoolDetailCategoryRows.some(
        (row) => row.key === options.marketTargetPoolDetailCategoryKey
      )
    ) {
      options.setMarketTargetPoolDetailCategoryKey(
        marketTargetPoolDetailCategoryRows[0]?.key ?? null
      );
    }
  }, [
    marketTargetPoolDetailCategoryRows,
    options.marketTargetPoolDetailCategoryKey,
    options.setMarketTargetPoolDetailCategoryKey
  ]);

  const handleToggleTargetsSection = useCallback(
    (section: "scope" | "symbols") => {
      options.setMarketTargetsSectionOpen((prev) => ({
        ...prev,
        [section]: !prev[section]
      }));
    },
    [options.setMarketTargetsSectionOpen]
  );

  const handleToggleDiffSection = useCallback(
    (section: "added" | "removed" | "reasonChanged") => {
      options.setMarketDiffSectionOpen((prev) => ({
        ...prev,
        [section]: !prev[section]
      }));
    },
    [options.setMarketDiffSectionOpen]
  );

  return {
    marketTargetPoolMetricCards,
    marketTargetPoolDetailTitle,
    marketTargetPoolDetailValue,
    marketTargetPoolDetailDescription,
    marketTargetPoolDetailCategoryRows,
    marketTargetPoolActiveCategoryRow,
    marketTargetPoolDetailMembers,
    handleToggleTargetsSection,
    handleToggleDiffSection
  };
}
