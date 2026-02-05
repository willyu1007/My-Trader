import type { MarketDataSource } from "@mytrader/shared";

import { all, run } from "../storage/sqlite";
import type { SqliteDatabase } from "../storage/sqlite";

export type InstrumentDataDomain =
  | "daily_prices"
  | "daily_basics"
  | "daily_moneyflows";

const DOMAIN_TABLE: Record<InstrumentDataDomain, string> = {
  daily_prices: "daily_prices",
  daily_basics: "daily_basics",
  daily_moneyflows: "daily_moneyflows"
};

export async function ensureInstrumentDomainSources(
  db: SqliteDatabase,
  domain: InstrumentDataDomain,
  entries: { symbol: string; source: MarketDataSource }[],
  now = Date.now()
): Promise<{ switched: string[] }> {
  if (entries.length === 0) return { switched: [] };

  const sources = new Map<string, MarketDataSource>();
  for (const entry of entries) {
    const symbol = entry.symbol.trim();
    if (!symbol) continue;
    const existing = sources.get(symbol);
    if (existing && existing !== entry.source) {
      throw new Error(`symbol ${symbol} has multiple data sources in one batch.`);
    }
    sources.set(symbol, entry.source);
  }

  const symbols = Array.from(sources.keys());
  if (symbols.length === 0) return { switched: [] };

  const placeholders = symbols.map(() => "?").join(", ");
  const rows = await all<{ symbol: string; source: MarketDataSource }>(
    db,
    `
      select symbol, source
      from instrument_data_sources
      where domain = ?
        and symbol in (${placeholders})
    `,
    [domain, ...symbols]
  );

  const existing = new Map<string, MarketDataSource>();
  rows.forEach((row) => existing.set(row.symbol, row.source));

  const switched = symbols.filter(
    (symbol) => existing.has(symbol) && existing.get(symbol) !== sources.get(symbol)
  );

  if (switched.length > 0) {
    const table = DOMAIN_TABLE[domain];
    const switchPlaceholders = switched.map(() => "?").join(", ");
    await run(
      db,
      `
        delete from ${table}
        where symbol in (${switchPlaceholders})
      `,
      switched
    );
  }

  for (const [symbol, source] of sources.entries()) {
    await run(
      db,
      `
        insert into instrument_data_sources (symbol, domain, source, updated_at)
        values (?, ?, ?, ?)
        on conflict(symbol, domain) do update set
          source = excluded.source,
          updated_at = excluded.updated_at
      `,
      [symbol, domain, source, now]
    );
  }

  return { switched };
}
