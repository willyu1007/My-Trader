import crypto from "node:crypto";

import type {
  PortfolioId,
  RiskLimit,
  RiskLimitId,
  RiskLimitType
} from "@mytrader/shared";

import { all, get, run } from "./sqlite";
import type { SqliteDatabase } from "./sqlite";

interface CreateRiskLimitArgs {
  portfolioId: PortfolioId;
  limitType: RiskLimitType;
  target: string;
  threshold: number;
}

interface UpdateRiskLimitArgs extends CreateRiskLimitArgs {
  id: RiskLimitId;
}

export async function listRiskLimits(
  db: SqliteDatabase,
  portfolioId: PortfolioId
): Promise<RiskLimit[]> {
  const rows = await all<{
    id: string;
    portfolio_id: string;
    limit_type: string;
    target: string;
    threshold: number;
    created_at: number;
    updated_at: number;
  }>(
    db,
    `
      select id, portfolio_id, limit_type, target, threshold, created_at, updated_at
      from risk_limits
      where portfolio_id = ?
      order by created_at asc
    `,
    [portfolioId]
  );

  return rows.map((row) => ({
    id: row.id,
    portfolioId: row.portfolio_id,
    limitType: row.limit_type as RiskLimitType,
    target: row.target,
    threshold: row.threshold,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

export async function createRiskLimit(
  db: SqliteDatabase,
  args: CreateRiskLimitArgs
): Promise<RiskLimit> {
  const now = Date.now();
  const id = crypto.randomUUID();
  await run(
    db,
    `
      insert into risk_limits (
        id, portfolio_id, limit_type, target, threshold, created_at, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      args.portfolioId,
      args.limitType,
      args.target,
      args.threshold,
      now,
      now
    ]
  );

  return {
    id,
    portfolioId: args.portfolioId,
    limitType: args.limitType,
    target: args.target,
    threshold: args.threshold,
    createdAt: now,
    updatedAt: now
  };
}

export async function updateRiskLimit(
  db: SqliteDatabase,
  args: UpdateRiskLimitArgs
): Promise<RiskLimit> {
  const now = Date.now();
  await run(
    db,
    `
      update risk_limits
      set portfolio_id = ?, limit_type = ?, target = ?, threshold = ?, updated_at = ?
      where id = ?
    `,
    [
      args.portfolioId,
      args.limitType,
      args.target,
      args.threshold,
      now,
      args.id
    ]
  );

  const row = await get<{
    id: string;
    portfolio_id: string;
    limit_type: string;
    target: string;
    threshold: number;
    created_at: number;
    updated_at: number;
  }>(
    db,
    `
      select id, portfolio_id, limit_type, target, threshold, created_at, updated_at
      from risk_limits
      where id = ?
    `,
    [args.id]
  );

  if (!row) throw new Error("未找到风险限额。");

  return {
    id: row.id,
    portfolioId: row.portfolio_id,
    limitType: row.limit_type as RiskLimitType,
    target: row.target,
    threshold: row.threshold,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function deleteRiskLimit(
  db: SqliteDatabase,
  riskLimitId: RiskLimitId
): Promise<void> {
  await run(db, `delete from risk_limits where id = ?`, [riskLimitId]);
}
