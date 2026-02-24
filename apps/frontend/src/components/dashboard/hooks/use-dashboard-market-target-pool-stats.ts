import { useCallback, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";

import {
  addSymbolToCategoryMap,
  buildCategoryDetailsFromCategoryMap,
  buildCategoryDetailsFromTagSummaries,
  buildTargetPoolStructureStats,
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

const MAX_INDUSTRY_L1_TAGS = 24;
const MAX_INDUSTRY_L2_TAGS = 48;
const MAX_CONCEPT_TAGS = 72;
const TAG_MEMBER_LIMIT = 8000;
const TAG_LIST_LIMIT = 1200;
const TAG_MEMBER_CACHE_TTL_MS = 90_000;
const REQUEST_SIGNATURE_TTL_MS = 45_000;

interface CachedTagMembers {
  symbols: string[];
  cachedAt: number;
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
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);
  const tagMembersCacheRef = useRef<Map<string, CachedTagMembers>>(new Map());
  const lastSignatureRef = useRef<string | null>(null);
  const lastCompletedAtRef = useRef(0);
  const lastResultRef = useRef<
    Record<"universe" | "focus", TargetPoolStructureStats> | null
  >(null);

  return useCallback(async function refreshTargetPoolStats() {
    if (!window.mytrader) return;
    const marketApi = window.mytrader.market;
    const enabledBuckets = normalizeBucketIds(
      options.marketUniversePoolEnabledBuckets?.length
        ? options.marketUniversePoolEnabledBuckets
        : options.universePoolBucketOrder
    );
    const focusAllSymbolsList = normalizeSymbolList(options.marketFocusTargetSymbols);
    const signature = buildRequestSignature(enabledBuckets, focusAllSymbolsList);
    const now = Date.now();

    if (
      lastSignatureRef.current === signature &&
      lastResultRef.current &&
      now - lastCompletedAtRef.current < REQUEST_SIGNATURE_TTL_MS
    ) {
      options.setMarketTargetPoolStatsByScope(lastResultRef.current);
      return;
    }

    if (inFlightRef.current) {
      queuedRef.current = true;
      return;
    }
    inFlightRef.current = true;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    options.setMarketTargetPoolStatsByScope((prev) => ({
      universe: { ...prev.universe, loading: true, error: null },
      focus: { ...prev.focus, loading: true, error: null }
    }));

    try {
      const allTags = await marketApi.listTags({ limit: TAG_LIST_LIMIT });

      if (requestIdRef.current !== requestId) return;

      const providerIndustryL1Tags = filterUniqueTagSummariesByPrefix(
        allTags,
        "ind:sw:l1:",
        "provider"
      ).slice(0, MAX_INDUSTRY_L1_TAGS);
      const providerIndustryLegacyTags = filterUniqueTagSummariesByPrefix(
        allTags,
        "industry:",
        "provider"
      ).slice(0, MAX_INDUSTRY_L1_TAGS);
      const providerIndustryL2Tags = filterUniqueTagSummariesByPrefix(
        allTags,
        "ind:sw:l2:",
        "provider"
      ).slice(0, MAX_INDUSTRY_L2_TAGS);
      const providerThemeTags = filterUniqueTagSummariesByPrefix(
        allTags,
        "theme:",
        "provider"
      ).slice(0, MAX_CONCEPT_TAGS);
      const providerConceptRawTags = filterUniqueTagSummariesByPrefix(
        allTags,
        "concept:",
        "provider"
      ).slice(0, MAX_CONCEPT_TAGS);
      const providerConceptTags = dedupeTagSummaries([
        ...providerThemeTags,
        ...providerConceptRawTags
      ]).slice(0, MAX_CONCEPT_TAGS);

      const industryL1TagsForUniverse =
        providerIndustryL1Tags.length > 0
          ? providerIndustryL1Tags
          : providerIndustryLegacyTags;
      const universeMembersByTag = new Map<string, string[]>();
      const universeAllSymbols = new Set<string>();
      const enabledPoolTags = enabledBuckets.map((bucket) => `pool:${bucket}`);
      const readTagMembers = async (tag: string): Promise<string[]> => {
        const normalizedTag = tag.trim();
        if (!normalizedTag) return [];
        const cached = tagMembersCacheRef.current.get(normalizedTag);
        const ts = Date.now();
        if (cached && ts - cached.cachedAt <= TAG_MEMBER_CACHE_TTL_MS) {
          return cached.symbols;
        }
        const members = await marketApi.getTagMembers({
          tag: normalizedTag,
          limit: TAG_MEMBER_LIMIT
        });
        const normalized = normalizeSymbolList(members);
        tagMembersCacheRef.current.set(normalizedTag, {
          symbols: normalized,
          cachedAt: ts
        });
        return normalized;
      };

      await mapWithConcurrency(enabledPoolTags, 3, async (tag) => {
        const normalized = await readTagMembers(tag);
        if (requestIdRef.current !== requestId) return;
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
      await mapWithConcurrency(universeClassificationTags, 2, async (tag) => {
        const normalized = await readTagMembers(tag);
        if (requestIdRef.current !== requestId) return;
        universeMembersByTag.set(tag, normalized);
        normalized.forEach((symbol) => {
          if (universeAllSymbolSet.has(symbol)) {
            universeClassifiedSymbols.add(symbol);
          }
        });
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

      const focusAllSymbolSet = new Set(focusAllSymbolsList);
      const focusIndustryL1Map = new Map<string, Set<string>>();
      const focusIndustryL2Map = new Map<string, Set<string>>();
      const focusConceptMap = new Map<string, Set<string>>();
      const focusClassifiedSymbols = new Set<string>();

      const collectFocusCategory = (
        tags: Array<{ tag: string }>,
        target: Map<string, Set<string>>
      ) => {
        for (const tagInfo of tags) {
          const symbols = universeMembersByTag.get(tagInfo.tag) ?? [];
          for (const symbol of symbols) {
            if (!focusAllSymbolSet.has(symbol)) continue;
            addSymbolToCategoryMap(target, tagInfo.tag, symbol);
            focusClassifiedSymbols.add(symbol);
          }
        }
      };

      collectFocusCategory(industryL1TagsForUniverse, focusIndustryL1Map);
      collectFocusCategory(providerIndustryL2Tags, focusIndustryL2Map);
      collectFocusCategory(providerConceptTags, focusConceptMap);

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
        classifiedCount: focusClassifiedSymbolsList.length,
        allSymbols: focusAllSymbolsList,
        classifiedSymbols: focusClassifiedSymbolsList,
        industryL1Details: buildCategoryDetailsFromCategoryMap(focusIndustryL1Map),
        industryL2Details: buildCategoryDetailsFromCategoryMap(focusIndustryL2Map),
        conceptDetails: buildCategoryDetailsFromCategoryMap(focusConceptMap),
        unclassifiedSymbols: focusUnclassifiedSymbolsList,
        symbolNames: {}
      });

      const nextStats = {
        universe: { ...universeStats, loading: false, error: null },
        focus: { ...focusStats, loading: false, error: null }
      } satisfies Record<"universe" | "focus", TargetPoolStructureStats>;
      lastSignatureRef.current = signature;
      lastCompletedAtRef.current = Date.now();
      lastResultRef.current = nextStats;
      options.setMarketTargetPoolStatsByScope(nextStats);
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      const message = options.toUserErrorMessage(err);
      options.setMarketTargetPoolStatsByScope((prev) => ({
        universe: { ...prev.universe, loading: false, error: message },
        focus: { ...prev.focus, loading: false, error: message }
      }));
    } finally {
      inFlightRef.current = false;
      if (queuedRef.current) {
        queuedRef.current = false;
        void refreshTargetPoolStats();
      }
    }
  }, [
    options.marketFocusTargetSymbols,
    options.marketUniversePoolEnabledBuckets,
    options.setMarketTargetPoolStatsByScope,
    options.toUserErrorMessage,
    options.universePoolBucketOrder
  ]);
}

function normalizeBucketIds(bucketIds: string[]): string[] {
  return Array.from(
    new Set(
      bucketIds
        .map((bucket) => bucket.trim())
        .filter(Boolean)
    )
  );
}

function buildRequestSignature(
  enabledBuckets: string[],
  focusSymbols: string[]
): string {
  const bucketPart = enabledBuckets.join(",");
  const symbolPart = buildSymbolFingerprint(focusSymbols);
  return `${bucketPart}@@${symbolPart}`;
}

function buildSymbolFingerprint(symbols: string[]): string {
  let hash = 0x811c9dc5;
  for (const symbol of symbols) {
    for (let index = 0; index < symbol.length; index += 1) {
      hash ^= symbol.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    hash ^= 0x7c;
    hash = Math.imul(hash, 0x01000193);
  }
  return `${symbols.length}:${(hash >>> 0).toString(16)}`;
}
