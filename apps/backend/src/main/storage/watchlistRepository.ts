import crypto from "node:crypto";

import type { WatchlistItem } from "@mytrader/shared";

import { all, get, run } from "./sqlite";
import type { SqliteDatabase } from "./sqlite";

interface DbWatchlistRow {
  id: string;
  symbol: string;
  name: string | null;
  group_name: string | null;
  note: string | null;
  created_at: number;
  updated_at: number;
}

export async function listWatchlistItems(
  db: SqliteDatabase
): Promise<WatchlistItem[]> {
  const rows = await all<DbWatchlistRow>(
    db,
    `
      select id, symbol, name, group_name, note, created_at, updated_at
      from watchlist_items
      order by symbol asc
    `
  );
  return rows.map(toWatchlistItem);
}

export async function upsertWatchlistItem(
  db: SqliteDatabase,
  input: {
    symbol: string;
    name?: string | null;
    groupName?: string | null;
    note?: string | null;
  }
): Promise<WatchlistItem> {
  const symbol = input.symbol.trim();
  if (!symbol) throw new Error("symbol is required.");

  const existing = await get<DbWatchlistRow>(
    db,
    `
      select id, symbol, name, group_name, note, created_at, updated_at
      from watchlist_items
      where symbol = ?
      limit 1
    `,
    [symbol]
  );

  const now = Date.now();
  if (!existing) {
    const id = crypto.randomUUID();
    await run(
      db,
      `
        insert into watchlist_items (
          id, symbol, name, group_name, note, created_at, updated_at
        )
        values (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        symbol,
        input.name ?? null,
        input.groupName ?? null,
        input.note ?? null,
        now,
        now
      ]
    );
    return {
      id,
      symbol,
      name: input.name ?? null,
      groupName: input.groupName ?? null,
      note: input.note ?? null,
      createdAt: now,
      updatedAt: now
    };
  }

  await run(
    db,
    `
      update watchlist_items
      set name = ?, group_name = ?, note = ?, updated_at = ?
      where symbol = ?
    `,
    [
      input.name ?? null,
      input.groupName ?? null,
      input.note ?? null,
      now,
      symbol
    ]
  );

  const updated = await get<DbWatchlistRow>(
    db,
    `
      select id, symbol, name, group_name, note, created_at, updated_at
      from watchlist_items
      where symbol = ?
      limit 1
    `,
    [symbol]
  );
  if (!updated) throw new Error("Failed to read updated watchlist item.");
  return toWatchlistItem(updated);
}

export async function removeWatchlistItem(
  db: SqliteDatabase,
  symbol: string
): Promise<void> {
  const key = symbol.trim();
  if (!key) return;
  await run(db, `delete from watchlist_items where symbol = ?`, [key]);
}

function toWatchlistItem(row: DbWatchlistRow): WatchlistItem {
  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name ?? null,
    groupName: row.group_name ?? null,
    note: row.note ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

