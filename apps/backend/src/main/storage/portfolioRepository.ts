import crypto from "node:crypto";

import type { Portfolio, PortfolioId } from "@mytrader/shared";

import { all, get, run, transaction } from "./sqlite";
import type { SqliteDatabase } from "./sqlite";

interface CreatePortfolioArgs {
  name: string;
  baseCurrency: string;
}

interface UpdatePortfolioArgs extends CreatePortfolioArgs {
  id: PortfolioId;
}

export async function getPortfolio(
  db: SqliteDatabase,
  portfolioId: PortfolioId
): Promise<Portfolio | null> {
  const row = await get<{
    id: string;
    name: string;
    base_currency: string;
    created_at: number;
    updated_at: number;
  }>(
    db,
    `select id, name, base_currency, created_at, updated_at from portfolios where id = ?`,
    [portfolioId]
  );

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    baseCurrency: row.base_currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function listPortfolios(db: SqliteDatabase): Promise<Portfolio[]> {
  const rows = await all<{
    id: string;
    name: string;
    base_currency: string;
    created_at: number;
    updated_at: number;
  }>(
    db,
    `select id, name, base_currency, created_at, updated_at from portfolios order by created_at asc`
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    baseCurrency: row.base_currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

export async function createPortfolio(
  db: SqliteDatabase,
  args: CreatePortfolioArgs
): Promise<Portfolio> {
  const now = Date.now();
  const id = crypto.randomUUID();

  await run(
    db,
    `
      insert into portfolios (id, name, base_currency, created_at, updated_at)
      values (?, ?, ?, ?, ?)
    `,
    [id, args.name, args.baseCurrency, now, now]
  );

  return {
    id,
    name: args.name,
    baseCurrency: args.baseCurrency,
    createdAt: now,
    updatedAt: now
  };
}

export async function updatePortfolio(
  db: SqliteDatabase,
  args: UpdatePortfolioArgs
): Promise<Portfolio> {
  const now = Date.now();
  await run(
    db,
    `
      update portfolios
      set name = ?, base_currency = ?, updated_at = ?
      where id = ?
    `,
    [args.name, args.baseCurrency, now, args.id]
  );

  const row = await get<{
    id: string;
    name: string;
    base_currency: string;
    created_at: number;
    updated_at: number;
  }>(
    db,
    `select id, name, base_currency, created_at, updated_at from portfolios where id = ?`,
    [args.id]
  );

  if (!row) throw new Error("未找到组合。");

  return {
    id: row.id,
    name: row.name,
    baseCurrency: row.base_currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function deletePortfolio(
  db: SqliteDatabase,
  portfolioId: PortfolioId
): Promise<void> {
  await transaction(db, async () => {
    await run(db, `delete from positions where portfolio_id = ?`, [portfolioId]);
    await run(db, `delete from risk_limits where portfolio_id = ?`, [
      portfolioId
    ]);
    await run(db, `delete from portfolios where id = ?`, [portfolioId]);
  });
}
