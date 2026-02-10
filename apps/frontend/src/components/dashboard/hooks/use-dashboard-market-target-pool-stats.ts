import { useCallback, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";

import {
  addSymbolToCategoryMap,
  buildCategoryDetailsFromCategoryMap,
  buildCategoryDetailsFromTagSummaries,
  buildTargetPoolStructureStats,
  collectClassificationFromTags,
  dedupeTagSummaries,
  filterUniqueTagSummariesByPrefix,
  mapWithConcurrency,
  normalizeSymbolList
} from "../shared";

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

export interface UseDashboardMarketTargetPoolStatsOptions {
  marketFocusTargetSymbols: string[];
  marketUniversePoolEnabledBuckets: string[] | null | undefined;
  universePoolBucketOrder: string[];
  toUserErrorMessage: (err: unknown) => string;
  setMarketTargetPoolStatsByScope: Dispatch<
    SetStateAction<Record<"universe" | "focus", TargetPoolStructureStats>>
  >;
}

export function useDashboardMarketTargetPoolStats(
  options: UseDashboardMarketTargetPoolStatsOptions
) {
  const requestIdRef = useRef(0);

  return useCallback(async () => {
    if (!window.mytrader) return;
    const marketApi = window.mytrader.market;
    const enabledBuckets = options.marketUniversePoolEnabledBuckets?.length
      ? options.marketUniversePoolEnabledBuckets
      : options.universePoolBucketOrder;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    options.setMarketTargetPoolStatsByScope((prev) => ({
      universe: { ...prev.universe, loading: true, error: null },
      focus: { ...prev.focus, loading: true, error: null }
    }));

    try {
      const [industryL1Raw, industryL2Raw, industryLegacyRaw, themeConceptRaw, conceptRaw] =
        await Promise.all([
          marketApi.listTags({ query: "ind:sw:l1:", limit: 500 }),
          marketApi.listTags({ query: "ind:sw:l2:", limit: 500 }),
          marketApi.listTags({ query: "industry:", limit: 500 }),
          marketApi.listTags({ query: "theme:", limit: 500 }),
          marketApi.listTags({ query: "concept:", limit: 500 })
        ]);

      if (requestIdRef.current !== requestId) return;

      const providerIndustryL1Tags = filterUniqueTagSummariesByPrefix(
        industryL1Raw,
        "ind:sw:l1:",
        "provider"
      );
      const providerIndustryLegacyTags = filterUniqueTagSummariesByPrefix(
        industryLegacyRaw,
        "industry:",
        "provider"
      );
      const providerIndustryL2Tags = filterUniqueTagSummariesByPrefix(
        industryL2Raw,
        "ind:sw:l2:",
        "provider"
      );
      const providerThemeTags = filterUniqueTagSummariesByPrefix(
        themeConceptRaw,
        "theme:",
        "provider"
      );
      const providerConceptRawTags = filterUniqueTagSummariesByPrefix(
        conceptRaw,
        "concept:",
        "provider"
      );
      const providerConceptTags = dedupeTagSummaries([
        ...providerThemeTags,
        ...providerConceptRawTags
      ]);

      const industryL1TagsForUniverse =
        providerIndustryL1Tags.length > 0
          ? providerIndustryL1Tags
          : providerIndustryLegacyTags;
      const universeMembersByTag = new Map<string, string[]>();
      const universeAllSymbols = new Set<string>();
      const enabledPoolTags = enabledBuckets.map((bucket) => `pool:${bucket}`);

      await mapWithConcurrency(enabledPoolTags, 4, async (tag) => {
        const members = await marketApi.getTagMembers({
          tag,
          limit: 50000
        });
        if (requestIdRef.current !== requestId) return;
        const normalized = normalizeSymbolList(members);
        universeMembersByTag.set(tag, normalized);
        normalized.forEach((symbol) => universeAllSymbols.add(symbol));
      });

      if (requestIdRef.current !== requestId) return;

      const universeAllSymbolsList = Array.from(universeAllSymbols).sort((a, b) =>
        a.localeCompare(b)
      );
      const universeAllSymbolSet = new Set(universeAllSymbolsList);

      const universeClassificationTags = Array.from(
        new Set(
          [
            ...industryL1TagsForUniverse,
            ...providerIndustryL2Tags,
            ...providerConceptTags
          ].map((row) => row.tag)
        )
      );

      const universeClassifiedSymbols = new Set<string>();
      await mapWithConcurrency(universeClassificationTags, 6, async (tag) => {
        const members = await marketApi.getTagMembers({
          tag,
          limit: 50000
        });
        if (requestIdRef.current !== requestId) return;
        const normalized = normalizeSymbolList(members).filter((symbol) =>
          universeAllSymbolSet.has(symbol)
        );
        universeMembersByTag.set(tag, normalized);
        normalized.forEach((symbol) => universeClassifiedSymbols.add(symbol));
      });

      if (requestIdRef.current !== requestId) return;

      const universeIndustryL1Details = buildCategoryDetailsFromTagSummaries(
        industryL1TagsForUniverse,
        universeMembersByTag
      );
      const universeIndustryL2Details = buildCategoryDetailsFromTagSummaries(
        providerIndustryL2Tags,
        universeMembersByTag
      );
      const universeConceptDetails = buildCategoryDetailsFromTagSummaries(
        providerConceptTags,
        universeMembersByTag
      );
      const universeClassifiedSymbolsList = Array.from(universeClassifiedSymbols).sort((a, b) =>
        a.localeCompare(b)
      );
      const universeClassifiedSet = new Set(universeClassifiedSymbolsList);
      const universeUnclassifiedSymbolsList = universeAllSymbolsList.filter(
        (symbol) => !universeClassifiedSet.has(symbol)
      );

      const universeStats = buildTargetPoolStructureStats({
        totalSymbols: universeAllSymbolsList.length,
        industryL1Count: universeIndustryL1Details.length,
        industryL2Count: universeIndustryL2Details.length,
        conceptCount: universeConceptDetails.length,
        classifiedCount: universeClassifiedSymbolsList.length,
        allSymbols: universeAllSymbolsList,
        classifiedSymbols: universeClassifiedSymbolsList,
        industryL1Details: universeIndustryL1Details,
        industryL2Details: universeIndustryL2Details,
        conceptDetails: universeConceptDetails,
        unclassifiedSymbols: universeUnclassifiedSymbolsList,
        symbolNames: {}
      });

      const focusIndustryL1Map = new Map<string, Set<string>>();
      const focusIndustryL2Map = new Map<string, Set<string>>();
      const focusConceptMap = new Map<string, Set<string>>();
      const focusClassifiedSymbols = new Set<string>();
      const focusSymbolNames: Record<string, string | null> = {};
      let focusClassifiedCount = 0;

      await mapWithConcurrency(options.marketFocusTargetSymbols, 8, async (symbol) => {
        const profile = await marketApi.getInstrumentProfile(symbol);
        if (requestIdRef.current !== requestId) return;
        focusSymbolNames[symbol] = profile?.name ?? null;
        const tagStats = collectClassificationFromTags(profile?.tags ?? []);
        if (tagStats.hasClassification) {
          focusClassifiedCount += 1;
          focusClassifiedSymbols.add(symbol);
        }
        tagStats.industryL1.forEach((tag) =>
          addSymbolToCategoryMap(focusIndustryL1Map, tag, symbol)
        );
        tagStats.industryL2.forEach((tag) =>
          addSymbolToCategoryMap(focusIndustryL2Map, tag, symbol)
        );
        tagStats.concepts.forEach((tag) =>
          addSymbolToCategoryMap(focusConceptMap, tag, symbol)
        );
      });

      if (requestIdRef.current !== requestId) return;

      const focusAllSymbolsList = [...options.marketFocusTargetSymbols].sort((a, b) =>
        a.localeCompare(b)
      );
      const focusClassifiedSymbolsList = Array.from(focusClassifiedSymbols).sort((a, b) =>
        a.localeCompare(b)
      );
      const focusUnclassifiedSymbolsList = focusAllSymbolsList.filter(
        (symbol) => !focusClassifiedSymbols.has(symbol)
      );

      const focusStats = buildTargetPoolStructureStats({
        totalSymbols: focusAllSymbolsList.length,
        industryL1Count: focusIndustryL1Map.size,
        industryL2Count: focusIndustryL2Map.size,
        conceptCount: focusConceptMap.size,
        classifiedCount: focusClassifiedCount,
        allSymbols: focusAllSymbolsList,
        classifiedSymbols: focusClassifiedSymbolsList,
        industryL1Details: buildCategoryDetailsFromCategoryMap(focusIndustryL1Map),
        industryL2Details: buildCategoryDetailsFromCategoryMap(focusIndustryL2Map),
        conceptDetails: buildCategoryDetailsFromCategoryMap(focusConceptMap),
        unclassifiedSymbols: focusUnclassifiedSymbolsList,
        symbolNames: focusSymbolNames
      });

      options.setMarketTargetPoolStatsByScope({
        universe: { ...universeStats, loading: false, error: null },
        focus: { ...focusStats, loading: false, error: null }
      });
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      const message = options.toUserErrorMessage(err);
      options.setMarketTargetPoolStatsByScope((prev) => ({
        universe: { ...prev.universe, loading: false, error: message },
        focus: { ...prev.focus, loading: false, error: message }
      }));
    }
  }, [
    options.marketFocusTargetSymbols,
    options.marketUniversePoolEnabledBuckets,
    options.setMarketTargetPoolStatsByScope,
    options.toUserErrorMessage,
    options.universePoolBucketOrder
  ]);
}
