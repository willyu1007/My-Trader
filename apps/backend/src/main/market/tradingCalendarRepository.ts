import type { MarketDataSource } from "@mytrader/shared";

import { all, run, transaction } from "../storage/sqlite";
import type { SqliteDatabase } from "../storage/sqlite";

export interface TradingCalendarDayInput {
  market: string;
  date: string; // YYYY-MM-DD
  isOpen: boolean;
  source: MarketDataSource;
}

export interface TradingCalendarDayRow {
  market: string;
  date: string;
  is_open: number;
  source: MarketDataSource;
  ingested_at: number;
}

export async function upsertTradingCalendarDays(
  db: SqliteDatabase,
  inputs: TradingCalendarDayInput[]
): Promise<void> {
  if (inputs.length === 0) return;
  const now = Date.now();

  await transaction(db, async () => {
    for (const input of inputs) {
      await run(
        db,
        `
          insert into trading_calendar (
            market, date, is_open, source, ingested_at
          )
          values (?, ?, ?, ?, ?)
          on conflict(market, date) do update set
            is_open = excluded.is_open,
            source = excluded.source,
            ingested_at = excluded.ingested_at
        `,
        [input.market, input.date, input.isOpen ? 1 : 0, input.source, now]
      );
    }
  });
}

export async function listOpenTradeDatesBetween(
  db: SqliteDatabase,
  market: string,
  startDate: string,
  endDate: string
): Promise<string[]> {
  const rows = await all<Pick<TradingCalendarDayRow, "date">>(
    db,
    `
      select date
      from trading_calendar
      where market = ?
        and is_open = 1
        and date >= ?
        and date <= ?
      order by date asc
    `,
    [market, startDate, endDate]
  );
  return rows.map((row) => row.date);
}

export async function getLatestOpenTradeDate(
  db: SqliteDatabase,
  market: string,
  onOrBeforeDate: string
): Promise<string | null> {
  const rows = await all<Pick<TradingCalendarDayRow, "date">>(
    db,
    `
      select date
      from trading_calendar
      where market = ?
        and is_open = 1
        and date <= ?
      order by date desc
      limit 1
    `,
    [market, onOrBeforeDate]
  );
  return rows.length ? rows[0].date : null;
}

export async function listTradingCalendarDaysBetween(
  db: SqliteDatabase,
  market: string,
  startDate: string,
  endDate: string
): Promise<TradingCalendarDayRow[]> {
  return await all<TradingCalendarDayRow>(
    db,
    `
      select market, date, is_open, source, ingested_at
      from trading_calendar
      where market = ?
        and date >= ?
        and date <= ?
      order by date asc
    `,
    [market, startDate, endDate]
  );
}
