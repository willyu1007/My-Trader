import type { UniversePoolBucketId } from "@mytrader/shared";

import type { ProviderInstrumentProfile } from "./providers/types";

export const UNIVERSE_POOL_BUCKETS: UniversePoolBucketId[] = [
  "cn_a",
  "etf",
  "metal_futures",
  "metal_spot"
];

const PRECIOUS_METAL_PATTERNS: RegExp[] = [
  /黄金/u,
  /白银/u,
  /贵金属/u,
  /\bgold\b/i,
  /\bsilver\b/i,
  /\bprecious\b/i,
  /\bmetal\b/i
];

export function getUniversePoolTag(bucket: UniversePoolBucketId): string {
  return `pool:${bucket}`;
}

export function matchUniversePoolBuckets(
  profile: Pick<ProviderInstrumentProfile, "assetClass" | "market" | "name" | "tags" | "symbol">
): UniversePoolBucketId[] {
  const result = new Set<UniversePoolBucketId>();
  if (profile.assetClass === "stock" && (profile.market ?? "").toUpperCase() === "CN") {
    result.add("cn_a");
  }

  if (profile.assetClass === "etf") {
    result.add("etf");
  }

  if (profile.assetClass === "futures" && isPreciousMetalProfile(profile)) {
    result.add("metal_futures");
  }

  if (profile.assetClass === "spot" && isPreciousMetalProfile(profile)) {
    result.add("metal_spot");
  }

  return Array.from(result.values());
}

export function hasUniversePoolTag(tags: string[], bucket: UniversePoolBucketId): boolean {
  const tag = getUniversePoolTag(bucket);
  return tags.some((value) => value.trim() === tag);
}

function isPreciousMetalProfile(
  profile: Pick<ProviderInstrumentProfile, "name" | "tags" | "symbol">
): boolean {
  const candidates = [profile.name ?? "", profile.symbol ?? "", ...profile.tags];
  const haystack = candidates.join(" ");
  return PRECIOUS_METAL_PATTERNS.some((pattern) => pattern.test(haystack));
}
