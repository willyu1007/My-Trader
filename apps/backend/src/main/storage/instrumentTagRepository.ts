import crypto from "node:crypto";

import { all, run } from "./sqlite";
import type { SqliteDatabase } from "./sqlite";

export async function listInstrumentTags(
  db: SqliteDatabase,
  symbol: string
): Promise<string[]> {
  const key = symbol.trim();
  if (!key) return [];
  const rows = await all<{ tag: string }>(
    db,
    `
      select tag
      from instrument_tags
      where symbol = ?
      order by tag asc
    `,
    [key]
  );
  return rows.map((row) => row.tag);
}

export async function listInstrumentSymbolsByUserTag(
  db: SqliteDatabase,
  tag: string
): Promise<string[]> {
  const key = tag.trim();
  if (!key) return [];
  const rows = await all<{ symbol: string }>(
    db,
    `
      select distinct symbol
      from instrument_tags
      where tag = ?
      order by symbol asc
    `,
    [key]
  );
  return rows.map((row) => row.symbol);
}

export async function addInstrumentTag(
  db: SqliteDatabase,
  symbol: string,
  tag: string
): Promise<void> {
  const keySymbol = symbol.trim();
  const keyTag = tag.trim();
  if (!keySymbol) throw new Error("symbol is required.");
  if (!keyTag) throw new Error("tag is required.");

  const now = Date.now();
  const id = crypto.randomUUID();
  await run(
    db,
    `
      insert into instrument_tags (id, symbol, tag, created_at, updated_at)
      values (?, ?, ?, ?, ?)
      on conflict(symbol, tag) do update set
        updated_at = excluded.updated_at
    `,
    [id, keySymbol, keyTag, now, now]
  );
}

export async function removeInstrumentTag(
  db: SqliteDatabase,
  symbol: string,
  tag: string
): Promise<void> {
  const keySymbol = symbol.trim();
  const keyTag = tag.trim();
  if (!keySymbol) return;
  if (!keyTag) return;
  await run(
    db,
    `delete from instrument_tags where symbol = ? and tag = ?`,
    [keySymbol, keyTag]
  );
}

