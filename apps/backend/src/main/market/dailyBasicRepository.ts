import type { MarketDataSource } from "@mytrader/shared";

import { all, run, transaction } from "../storage/sqlite";
import type { SqliteDatabase } from "../storage/sqlite";
import { ensureInstrumentDomainSources } from "./instrumentDataSourceRepository";

export interface DailyBasicInput {
  symbol: string;
  tradeDate: string; // YYYY-MM-DD
  circMv: number | null;
  totalMv: number | null;
  source: MarketDataSource;
}

export interface DailyBasicRow {
  symbol: string;
  trade_date: string;
  circ_mv: number | null;
  total_mv: number | null;
  source: MarketDataSource;
  ingested_at: number;
}

export async function upsertDailyBasics(
  db: SqliteDatabase,
  inputs: DailyBasicInput[]
): Promise<void> {
  if (inputs.length === 0) return;
  const now = Date.now();
  const sources = inputs.map((input) => ({
    symbol: input.symbol,
    source: input.source
  }));

  await transaction(db, async () => {
    await ensureInstrumentDomainSources(db, "daily_basics", sources, now);
    for (const input of inputs) {
      await run(
        db,
        `
          insert into daily_basics (
            symbol, trade_date, circ_mv, total_mv, source, ingested_at
          )
          values (?, ?, ?, ?, ?, ?)
          on conflict(symbol, trade_date) do update set
            circ_mv = excluded.circ_mv,
            total_mv = excluded.total_mv,
            source = excluded.source,
            ingested_at = excluded.ingested_at
        `,
        [
          input.symbol,
          input.tradeDate,
          input.circMv,
          input.totalMv,
          input.source,
          now
        ]
      );
    }
  });
}

export async function getDailyBasicsByDate(
  db: SqliteDatabase,
  tradeDate: string,
  symbols: string[]
): Promise<Map<string, { circMv: number | null; totalMv: number | null }>> {
  if (symbols.length === 0) return new Map();
  const placeholders = symbols.map(() => "?").join(", ");
  const rows = await all<DailyBasicRow>(
    db,
    `
      select symbol, trade_date, circ_mv, total_mv, source, ingested_at
      from daily_basics
      where trade_date = ?
        and symbol in (${placeholders})
      order by symbol asc
    `,
    [tradeDate, ...symbols]
  );

  const result = new Map<string, { circMv: number | null; totalMv: number | null }>();
  rows.forEach((row) => {
    result.set(row.symbol, {
      circMv: row.circ_mv ?? null,
      totalMv: row.total_mv ?? null
    });
  });
  return result;
}
