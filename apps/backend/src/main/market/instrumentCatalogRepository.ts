import { buildTagFacets, type AssetClass, type TagFacets } from "@mytrader/shared";

import { all, get, run, transaction } from "../storage/sqlite";
import type { SqliteDatabase } from "../storage/sqlite";
import type { ProviderInstrumentProfile } from "./providers/types";

export type InstrumentProfileSummary = {
  provider: string;
  kind: string;
  symbol: string;
  name: string | null;
  assetClass: AssetClass | null;
  market: string | null;
  currency: string | null;
  tags: string[];
  tagFacets?: TagFacets;
};

export type InstrumentProfile = InstrumentProfileSummary & {
  providerData: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
};

export async function upsertInstrumentProfiles(
  db: SqliteDatabase,
  inputs: ProviderInstrumentProfile[]
): Promise<{ inserted: number; updated: number }> {
  if (inputs.length === 0) return { inserted: 0, updated: 0 };
  const now = Date.now();

  const existing = new Map<string, { provider: string; market: string | null }>();
  const chunkSize = 500;
  for (let idx = 0; idx < inputs.length; idx += chunkSize) {
    const chunk = inputs.slice(idx, idx + chunkSize);
    const symbols = chunk.map((item) => item.symbol);
    const rows = await all<{ symbol: string; provider: string; market: string | null }>(
      db,
      `select symbol, provider, market from instrument_profiles where symbol in (${symbols
        .map(() => "?")
        .join(",")})`,
      symbols
    );
    rows.forEach((row) =>
      existing.set(row.symbol, {
        provider: row.provider,
        market: row.market ?? null
      })
    );
  }

  let inserted = 0;
  let updated = 0;

  await transaction(db, async () => {
    for (const item of inputs) {
      const known = existing.get(item.symbol);
      if (known) {
        const sameProvider =
          normalizeKey(known.provider) === normalizeKey(item.provider);
        const sameMarket =
          normalizeKey(known.market) === normalizeKey(item.market ?? null);
        if (!sameProvider || !sameMarket) {
          throw new Error(
            `symbol collision blocked: ${item.symbol} existing(${known.provider}/${known.market ?? "-"}) incoming(${item.provider}/${item.market ?? "-"})`
          );
        }
      }

      const tagsJson = JSON.stringify(item.tags ?? []);
      const providerDataJson = JSON.stringify(item.providerData ?? {});
      await run(
        db,
        `
          insert into instrument_profiles (
            symbol, provider, kind, name, asset_class, market, currency,
            tags_json, provider_data_json, created_at, updated_at
          )
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          on conflict(symbol) do update set
            provider = excluded.provider,
            kind = excluded.kind,
            name = excluded.name,
            asset_class = excluded.asset_class,
            market = excluded.market,
            currency = excluded.currency,
            tags_json = excluded.tags_json,
            provider_data_json = excluded.provider_data_json,
            updated_at = excluded.updated_at
        `,
        [
          item.symbol,
          item.provider,
          item.kind,
          item.name ?? null,
          item.assetClass ?? null,
          item.market ?? null,
          item.currency ?? null,
          tagsJson,
          providerDataJson,
          now,
          now
        ]
      );

      await run(
        db,
        `delete from instrument_profile_tags where symbol = ?`,
        [item.symbol]
      );
      for (const rawTag of item.tags ?? []) {
        const tag = rawTag.trim();
        if (!tag) continue;
        await run(
          db,
          `
            insert into instrument_profile_tags (tag, symbol)
            values (?, ?)
            on conflict(tag, symbol) do nothing
          `,
          [tag, item.symbol]
        );
      }
      if (existing.has(item.symbol)) {
        updated += 1;
      } else {
        inserted += 1;
      }
    }
  });

  return { inserted, updated };
}

export async function searchInstrumentProfiles(
  db: SqliteDatabase,
  query: string,
  limit: number
): Promise<InstrumentProfileSummary[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const like = `%${escapeLike(trimmed)}%`;
  const rows = await all<{
    provider: string;
    kind: string;
    symbol: string;
    name: string | null;
    asset_class: string | null;
    market: string | null;
    currency: string | null;
    tags_json: string;
  }>(
    db,
    `
      select provider, kind, symbol, name, asset_class, market, currency, tags_json
      from instrument_profiles
      where symbol like ? escape '\\'
         or name like ? escape '\\'
      order by
        case when symbol = ? then 0 else 1 end,
        case when symbol like ? escape '\\' then 0 else 1 end,
        symbol asc
      limit ?
    `,
    [like, like, trimmed, `${escapeLike(trimmed)}%`, limit]
  );

  return rows.map((row) => {
    const tags = parseJsonArray(row.tags_json);
    return {
      provider: row.provider,
      kind: row.kind,
      symbol: row.symbol,
      name: row.name ?? null,
      assetClass: row.asset_class ? (row.asset_class as AssetClass) : null,
      market: row.market ?? null,
      currency: row.currency ?? null,
      tags,
      tagFacets: buildTagFacets(tags)
    };
  });
}

export async function getInstrumentProfile(
  db: SqliteDatabase,
  symbol: string
): Promise<InstrumentProfile | null> {
  const key = symbol.trim();
  if (!key) return null;

  const row = await get<{
    provider: string;
    kind: string;
    symbol: string;
    name: string | null;
    asset_class: string | null;
    market: string | null;
    currency: string | null;
    tags_json: string;
    provider_data_json: string;
    created_at: number;
    updated_at: number;
  }>(
    db,
    `
      select provider, kind, symbol, name, asset_class, market, currency,
             tags_json, provider_data_json, created_at, updated_at
      from instrument_profiles
      where symbol = ?
      limit 1
    `,
    [key]
  );

  if (!row) return null;

  const tags = parseJsonArray(row.tags_json);
  return {
    provider: row.provider,
    kind: row.kind,
    symbol: row.symbol,
    name: row.name ?? null,
    assetClass: row.asset_class ? (row.asset_class as AssetClass) : null,
    market: row.market ?? null,
    currency: row.currency ?? null,
    tags,
    tagFacets: buildTagFacets(tags),
    providerData: parseJsonObject(row.provider_data_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function listInstrumentProfileBasicsBySymbols(
  db: SqliteDatabase,
  symbols: string[]
): Promise<Record<string, { name: string | null; kind: string | null }>> {
  const uniqueSymbols = Array.from(
    new Set(symbols.map((item) => item.trim()).filter(Boolean))
  );
  if (uniqueSymbols.length === 0) return {};

  const rows: Array<{ symbol: string; name: string | null; kind: string | null }> = [];
  const chunkSize = 500;
  for (let idx = 0; idx < uniqueSymbols.length; idx += chunkSize) {
    const chunk = uniqueSymbols.slice(idx, idx + chunkSize);
    const placeholders = chunk.map(() => "?").join(", ");
    const chunkRows = await all<{
      symbol: string;
      name: string | null;
      kind: string | null;
    }>(
      db,
      `
        select symbol, name, kind
        from instrument_profiles
        where symbol in (${placeholders})
      `,
      chunk
    );
    rows.push(...chunkRows);
  }

  return rows.reduce<Record<string, { name: string | null; kind: string | null }>>(
    (acc, row) => {
      acc[row.symbol] = {
        name: row.name ?? null,
        kind: row.kind ?? null
      };
      return acc;
    },
    {}
  );
}

export async function listInstrumentSymbolsByTag(
  db: SqliteDatabase,
  tag: string,
  limit = 50000
): Promise<string[]> {
  await ensureInstrumentProfileTagsBackfilled(db);

  const key = tag.trim();
  if (!key) return [];
  const rows = await all<{ symbol: string }>(
    db,
    `
      select symbol
      from instrument_profile_tags
      where tag = ?
      order by symbol asc
      limit ?
    `,
    [key, limit]
  );

  if (rows.length > 0) return rows.map((row) => row.symbol);

  const like = `%\"${escapeLike(key)}\"%`;
  const fallback = await all<{ symbol: string }>(
    db,
    `
      select symbol
      from instrument_profiles
      where tags_json like ? escape '\\'
      order by symbol asc
      limit ?
    `,
    [like, limit]
  );
  return fallback.map((row) => row.symbol);
}

export async function ensureInstrumentProfileTagsBackfilled(
  db: SqliteDatabase
): Promise<void> {
  const anyRow = await get<{ ok: number }>(
    db,
    `select 1 as ok from instrument_profile_tags limit 1`
  );
  if (anyRow) return;

  const rows = await all<{ symbol: string; tags_json: string }>(
    db,
    `select symbol, tags_json from instrument_profiles`
  );
  if (rows.length === 0) return;

  await transaction(db, async () => {
    for (const row of rows) {
      const symbol = row.symbol.trim();
      if (!symbol) continue;
      const tags = parseJsonArray(row.tags_json)
        .map((raw) => raw.trim())
        .filter(Boolean);
      for (const tag of tags) {
        await run(
          db,
          `
            insert into instrument_profile_tags (tag, symbol)
            values (?, ?)
            on conflict(tag, symbol) do nothing
          `,
          [tag, symbol]
        );
      }
    }
  });
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item));
  } catch {
    return [];
  }
}

function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function normalizeKey(value: string | null): string {
  return (value ?? "").trim().toUpperCase();
}
