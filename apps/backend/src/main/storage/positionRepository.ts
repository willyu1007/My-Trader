import crypto from "node:crypto";

import type {
  AssetClass,
  CreatePositionInput,
  Position,
  PositionId,
  PortfolioId
} from "@mytrader/shared";

import { all, get, run, transaction } from "./sqlite";
import type { SqliteDatabase } from "./sqlite";

interface DbPositionRow {
  id: string;
  portfolio_id: string;
  symbol: string;
  name: string | null;
  asset_class: string;
  market: string;
  currency: string;
  quantity: number;
  cost: number | null;
  open_date: string | null;
  created_at: number;
  updated_at: number;
}

export async function listPositionsByPortfolio(
  db: SqliteDatabase,
  portfolioId: PortfolioId
): Promise<Position[]> {
  const rows = await all<DbPositionRow>(
    db,
    `
      select id, portfolio_id, symbol, name, asset_class, market, currency, quantity,
             cost, open_date, created_at, updated_at
      from positions
      where portfolio_id = ?
      order by created_at asc
    `,
    [portfolioId]
  );

  return rows.map(toPosition);
}

export async function createPosition(
  db: SqliteDatabase,
  input: CreatePositionInput
): Promise<Position> {
  const now = Date.now();
  const id = crypto.randomUUID();

  await run(
    db,
    `
      insert into positions (
        id, portfolio_id, symbol, name, asset_class, market, currency, quantity,
        cost, open_date, created_at, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      input.portfolioId,
      input.symbol,
      input.name ?? null,
      input.assetClass,
      input.market,
      input.currency,
      input.quantity,
      input.cost ?? null,
      input.openDate ?? null,
      now,
      now
    ]
  );

  return {
    id,
    portfolioId: input.portfolioId,
    symbol: input.symbol,
    name: input.name ?? null,
    assetClass: input.assetClass,
    market: input.market,
    currency: input.currency,
    quantity: input.quantity,
    cost: input.cost ?? null,
    openDate: input.openDate ?? null,
    createdAt: now,
    updatedAt: now
  };
}

export async function updatePosition(
  db: SqliteDatabase,
  positionId: PositionId,
  input: CreatePositionInput
): Promise<Position> {
  const now = Date.now();
  await run(
    db,
    `
      update positions
      set portfolio_id = ?, symbol = ?, name = ?, asset_class = ?, market = ?,
          currency = ?, quantity = ?, cost = ?, open_date = ?, updated_at = ?
      where id = ?
    `,
    [
      input.portfolioId,
      input.symbol,
      input.name ?? null,
      input.assetClass,
      input.market,
      input.currency,
      input.quantity,
      input.cost ?? null,
      input.openDate ?? null,
      now,
      positionId
    ]
  );

  const row = await get<DbPositionRow>(
    db,
    `
      select id, portfolio_id, symbol, name, asset_class, market, currency, quantity,
             cost, open_date, created_at, updated_at
      from positions
      where id = ?
    `,
    [positionId]
  );

  if (!row) throw new Error("未找到持仓。");

  return toPosition(row);
}

export async function deletePosition(
  db: SqliteDatabase,
  positionId: PositionId
): Promise<void> {
  await run(db, `delete from positions where id = ?`, [positionId]);
}

export interface UpsertPositionInput
  extends Omit<CreatePositionInput, "assetClass"> {
  assetClass: AssetClass;
}

export async function upsertPositions(
  db: SqliteDatabase,
  portfolioId: PortfolioId,
  inputs: UpsertPositionInput[]
): Promise<{ inserted: number; updated: number }> {
  if (inputs.length === 0) return { inserted: 0, updated: 0 };

  const symbols = inputs.map((input) => input.symbol);
  const placeholders = symbols.map(() => "?").join(", ");
  const existingRows = await all<{ symbol: string }>(
    db,
    `select symbol from positions where portfolio_id = ? and symbol in (${placeholders})`,
    [portfolioId, ...symbols]
  );
  const existing = new Set(existingRows.map((row) => row.symbol));

  const now = Date.now();
  await transaction(db, async () => {
    for (const input of inputs) {
      await run(
        db,
        `
          insert into positions (
            id, portfolio_id, symbol, name, asset_class, market, currency, quantity,
            cost, open_date, created_at, updated_at
          )
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          on conflict(portfolio_id, symbol) do update set
            name = excluded.name,
            asset_class = excluded.asset_class,
            market = excluded.market,
            currency = excluded.currency,
            quantity = excluded.quantity,
            cost = excluded.cost,
            open_date = excluded.open_date,
            updated_at = excluded.updated_at
        `,
        [
          crypto.randomUUID(),
          portfolioId,
          input.symbol,
          input.name ?? null,
          input.assetClass,
          input.market,
          input.currency,
          input.quantity,
          input.cost ?? null,
          input.openDate ?? null,
          now,
          now
        ]
      );
    }
  });

  const updated = inputs.filter((input) => existing.has(input.symbol)).length;
  const inserted = inputs.length - updated;
  return { inserted, updated };
}

function toPosition(row: DbPositionRow): Position {
  return {
    id: row.id,
    portfolioId: row.portfolio_id,
    symbol: row.symbol,
    name: row.name,
    assetClass: row.asset_class as AssetClass,
    market: row.market,
    currency: row.currency,
    quantity: row.quantity,
    cost: row.cost,
    openDate: row.open_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
