import type { MarketTargetsConfig } from "@mytrader/shared";

import { get, run } from "./sqlite";
import type { SqliteDatabase } from "./sqlite";

const TARGETS_KEY = "targets_config_v1";
const TEMP_TARGETS_KEY = "targets_temp_symbols_v1";

export type TempTargetSymbolRow = {
  symbol: string;
  expiresAt: number;
  updatedAt: number;
};

export async function getMarketTargetsConfig(
  db: SqliteDatabase
): Promise<MarketTargetsConfig> {
  const row = await get<{ value_json: string }>(
    db,
    `select value_json from market_settings where key = ?`,
    [TARGETS_KEY]
  );
  if (!row) {
    const defaults = buildDefaultTargetsConfig();
    await setMarketTargetsConfig(db, defaults);
    return defaults;
  }
  const parsed = safeParseTargetsConfig(row.value_json);
  return parsed ?? buildDefaultTargetsConfig();
}

export async function setMarketTargetsConfig(
  db: SqliteDatabase,
  config: MarketTargetsConfig
): Promise<void> {
  const normalized = normalizeTargetsConfig(config);
  await run(
    db,
    `
      insert into market_settings (key, value_json)
      values (?, ?)
      on conflict(key) do update set
        value_json = excluded.value_json
    `,
    [TARGETS_KEY, JSON.stringify(normalized)]
  );
}

function buildDefaultTargetsConfig(): MarketTargetsConfig {
  return {
    includeHoldings: true,
    includeRegistryAutoIngest: true,
    includeWatchlist: true,
    portfolioIds: null,
    explicitSymbols: [],
    tagFilters: []
  };
}

function safeParseTargetsConfig(value: string): MarketTargetsConfig | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return normalizeTargetsConfig(parsed as Partial<MarketTargetsConfig>);
  } catch {
    return null;
  }
}

function normalizeTargetsConfig(
  input: Partial<MarketTargetsConfig>
): MarketTargetsConfig {
  const explicitSymbols = Array.isArray(input.explicitSymbols)
    ? input.explicitSymbols.map((value) => String(value).trim()).filter(Boolean)
    : [];
  const tagFilters = Array.isArray(input.tagFilters)
    ? input.tagFilters.map((value) => String(value).trim()).filter(Boolean)
    : [];
  const portfolioIds = Array.isArray(input.portfolioIds)
    ? input.portfolioIds.map((value) => String(value).trim()).filter(Boolean)
    : null;

  return {
    includeHoldings: Boolean(input.includeHoldings ?? true),
    includeRegistryAutoIngest: Boolean(input.includeRegistryAutoIngest ?? true),
    includeWatchlist: Boolean(input.includeWatchlist ?? true),
    portfolioIds: portfolioIds && portfolioIds.length > 0 ? portfolioIds : null,
    explicitSymbols,
    tagFilters
  };
}

export async function listTempTargetSymbols(
  db: SqliteDatabase,
  now = Date.now()
): Promise<TempTargetSymbolRow[]> {
  const row = await get<{ value_json: string }>(
    db,
    `select value_json from market_settings where key = ?`,
    [TEMP_TARGETS_KEY]
  );
  if (!row?.value_json) return [];

  const parsed = safeParseTempTargets(row.value_json);
  if (!parsed) return [];

  const kept = parsed.filter((item) => item.expiresAt > now);
  if (kept.length !== parsed.length) {
    await writeTempTargets(db, kept);
  }
  return kept;
}

export async function touchTempTargetSymbol(
  db: SqliteDatabase,
  symbol: string,
  ttlDays = 7,
  now = Date.now()
): Promise<TempTargetSymbolRow[]> {
  const key = symbol.trim();
  if (!key) return await listTempTargetSymbols(db, now);

  const safeTtlDays = Math.min(90, Math.max(1, Math.floor(ttlDays)));
  const expiresAt = now + safeTtlDays * 86_400_000;

  const existing = await listTempTargetSymbols(db, now);
  const next: TempTargetSymbolRow[] = [];
  let updated = false;
  for (const item of existing) {
    if (item.symbol === key) {
      next.push({ symbol: key, expiresAt, updatedAt: now });
      updated = true;
    } else {
      next.push(item);
    }
  }
  if (!updated) {
    next.push({ symbol: key, expiresAt, updatedAt: now });
  }

  next.sort((a, b) => a.symbol.localeCompare(b.symbol));
  await writeTempTargets(db, next);
  return next;
}

export async function removeTempTargetSymbol(
  db: SqliteDatabase,
  symbol: string,
  now = Date.now()
): Promise<TempTargetSymbolRow[]> {
  const key = symbol.trim();
  const existing = await listTempTargetSymbols(db, now);
  const next = existing.filter((item) => item.symbol !== key);
  if (next.length === existing.length) return existing;
  await writeTempTargets(db, next);
  return next;
}

async function writeTempTargets(
  db: SqliteDatabase,
  items: TempTargetSymbolRow[]
): Promise<void> {
  const payload = JSON.stringify({ items });
  await run(
    db,
    `
      insert into market_settings (key, value_json)
      values (?, ?)
      on conflict(key) do update set
        value_json = excluded.value_json
    `,
    [TEMP_TARGETS_KEY, payload]
  );
}

function safeParseTempTargets(value: string): TempTargetSymbolRow[] | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    const items = (parsed as any)?.items;
    if (!Array.isArray(items)) return null;
    return items
      .map((item) => {
        const symbol = typeof item?.symbol === "string" ? item.symbol.trim() : "";
        const expiresAt = Number(item?.expiresAt);
        const updatedAt = Number(item?.updatedAt);
        if (!symbol) return null;
        if (!Number.isFinite(expiresAt) || expiresAt <= 0) return null;
        if (!Number.isFinite(updatedAt) || updatedAt <= 0) return null;
        return { symbol, expiresAt, updatedAt } satisfies TempTargetSymbolRow;
      })
      .filter((item): item is TempTargetSymbolRow => Boolean(item));
  } catch {
    return null;
  }
}
