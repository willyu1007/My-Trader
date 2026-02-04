import type { MarketDataSource } from "@mytrader/shared";

import { all, run, transaction } from "../storage/sqlite";
import type { SqliteDatabase } from "../storage/sqlite";

export interface DailyMoneyflowInput {
  symbol: string;
  tradeDate: string; // YYYY-MM-DD
  netMfVol: number | null;
  netMfAmount: number | null;
  source: MarketDataSource;
}

export interface DailyMoneyflowRow {
  symbol: string;
  trade_date: string;
  net_mf_vol: number | null;
  net_mf_amount: number | null;
  source: MarketDataSource;
  ingested_at: number;
}

export async function upsertDailyMoneyflows(
  db: SqliteDatabase,
  inputs: DailyMoneyflowInput[]
): Promise<void> {
  if (inputs.length === 0) return;
  const now = Date.now();

  await transaction(db, async () => {
    for (const input of inputs) {
      await run(
        db,
        `
          insert into daily_moneyflows (
            symbol, trade_date, net_mf_vol, net_mf_amount, source, ingested_at
          )
          values (?, ?, ?, ?, ?, ?)
          on conflict(symbol, trade_date) do update set
            net_mf_vol = excluded.net_mf_vol,
            net_mf_amount = excluded.net_mf_amount,
            source = excluded.source,
            ingested_at = excluded.ingested_at
        `,
        [
          input.symbol,
          input.tradeDate,
          input.netMfVol,
          input.netMfAmount,
          input.source,
          now
        ]
      );
    }
  });
}

export async function listDailyMoneyflows(
  db: SqliteDatabase,
  input: { symbol: string; startDate: string; endDate: string }
): Promise<DailyMoneyflowRow[]> {
  const symbol = input.symbol.trim();
  const startDate = input.startDate.trim();
  const endDate = input.endDate.trim();
  if (!symbol || !startDate || !endDate) return [];

  return await all<DailyMoneyflowRow>(
    db,
    `
      select symbol, trade_date, net_mf_vol, net_mf_amount, source, ingested_at
      from daily_moneyflows
      where symbol = ?
        and trade_date >= ?
        and trade_date <= ?
      order by trade_date asc
    `,
    [symbol, startDate, endDate]
  );
}

export async function getDailyMoneyflowCoverage(
  db: SqliteDatabase,
  input: { symbol: string; startDate: string; endDate: string }
): Promise<{ count: number; minDate: string | null; maxDate: string | null }> {
  const symbol = input.symbol.trim();
  const startDate = input.startDate.trim();
  const endDate = input.endDate.trim();
  if (!symbol || !startDate || !endDate) {
    return { count: 0, minDate: null, maxDate: null };
  }

  const rows = await all<{ count: number; min_date: string | null; max_date: string | null }>(
    db,
    `
      select count(*) as count,
             min(trade_date) as min_date,
             max(trade_date) as max_date
      from daily_moneyflows
      where symbol = ?
        and trade_date >= ?
        and trade_date <= ?
    `,
    [symbol, startDate, endDate]
  );

  const row = rows[0];
  return {
    count: row?.count ?? 0,
    minDate: row?.min_date ?? null,
    maxDate: row?.max_date ?? null
  };
}

