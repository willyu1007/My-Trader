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
  /铜/u,
  /铝/u,
  /锌/u,
  /铅/u,
  /镍/u,
  /锡/u,
  /沪金/u,
  /沪银/u,
  /沪铜/u,
  /沪铝/u,
  /沪锌/u,
  /沪铅/u,
  /沪镍/u,
  /沪锡/u,
  /\bau\d*/i,
  /\bag\d*/i,
  /\biau\d*/i,
  /\biag\d*/i,
  /\bcu\d*/i,
  /\bal\d*/i,
  /\bzn\d*/i,
  /\bpb\d*/i,
  /\bni\d*/i,
  /\bsn\d*/i,
  /\bgold\b/i,
  /\bsilver\b/i,
  /\bprecious\b/i,
  /\bmetal\b/i,
  /\bbase\s*metal\b/i
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
