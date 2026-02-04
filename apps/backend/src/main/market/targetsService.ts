import type { AssetClass, MarketTargetsConfig, TushareIngestItem } from "@mytrader/shared";

import { derivePositionsFromLedger } from "../services/positionEngine";
import { listLedgerEntriesByPortfolio } from "../storage/ledgerRepository";
import {
  getMarketTargetsConfig,
  listTempTargetSymbols
} from "../storage/marketSettingsRepository";
import { listPortfolios } from "../storage/portfolioRepository";
import { listInstrumentSymbolsByUserTag } from "../storage/instrumentTagRepository";
import { listWatchlistItems } from "../storage/watchlistRepository";
import type { SqliteDatabase } from "../storage/sqlite";
import { listInstrumentSymbolsByTag } from "./instrumentCatalogRepository";
import { getInstrumentsBySymbols, listAutoIngestItems } from "./marketRepository";

export type ResolvedTargetSymbol = {
  symbol: string;
  reasons: string[];
};

export type PreviewTargetsResult = {
  config: MarketTargetsConfig;
  symbols: ResolvedTargetSymbol[];
};

export async function previewTargets(input: {
  businessDb: SqliteDatabase;
  marketDb: SqliteDatabase;
}): Promise<PreviewTargetsResult> {
  const { businessDb, marketDb } = input;
  const config = await getMarketTargetsConfig(businessDb);
  const reasonsBySymbol = new Map<string, Set<string>>();

  const tempSymbols = await listTempTargetSymbols(businessDb);
  tempSymbols.forEach((item) => addReason(reasonsBySymbol, item.symbol, "temp:search"));

  if (config.includeHoldings) {
    const holdings = await resolveHoldingsSymbols({
      businessDb,
      portfolioIds: config.portfolioIds
    });
    holdings.forEach((reasonSet, symbol) => {
      reasonSet.forEach((reason) => addReason(reasonsBySymbol, symbol, reason));
    });
  }

  if (config.includeWatchlist) {
    const items = await listWatchlistItems(businessDb);
    items.forEach((item) => {
      const symbol = item.symbol.trim();
      if (!symbol) return;
      const suffix = item.groupName ? `:${item.groupName}` : "";
      addReason(reasonsBySymbol, symbol, `watchlist${suffix}`);
    });
  }

  if (config.includeRegistryAutoIngest) {
    const items = await listAutoIngestItems(marketDb);
    items.forEach((item) => {
      const symbol = item.symbol.trim();
      if (!symbol) return;
      addReason(reasonsBySymbol, symbol, "registry:auto_ingest");
    });
  }

  config.explicitSymbols.forEach((raw) => {
    const symbol = raw.trim();
    if (!symbol) return;
    addReason(reasonsBySymbol, symbol, "explicit");
  });

  for (const tag of config.tagFilters) {
    const key = tag.trim();
    if (!key) continue;

    const [providerSymbols, userSymbols] = await Promise.all([
      listInstrumentSymbolsByTag(marketDb, key),
      listInstrumentSymbolsByUserTag(businessDb, key)
    ]);

    providerSymbols.forEach((symbol) =>
      addReason(reasonsBySymbol, symbol, `tag:${key}`)
    );
    userSymbols.forEach((symbol) =>
      addReason(reasonsBySymbol, symbol, `tag:${key}`)
    );
  }

  const symbols: ResolvedTargetSymbol[] = Array.from(reasonsBySymbol.entries())
    .map(([symbol, set]) => ({
      symbol,
      reasons: Array.from(set.values()).sort()
    }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  return { config, symbols };
}

export async function resolveAutoIngestItems(input: {
  businessDb: SqliteDatabase;
  marketDb: SqliteDatabase;
}): Promise<TushareIngestItem[]> {
  const preview = await previewTargets(input);
  const symbols = preview.symbols.map((item) => item.symbol);
  const metadata = await getInstrumentsBySymbols(input.marketDb, symbols);

  return symbols
    .map((symbol) => {
      const meta = metadata.get(symbol);
      const assetClass = (meta?.assetClass ?? "stock") as AssetClass;
      return { symbol, assetClass } satisfies TushareIngestItem;
    })
    .filter((item) => item.assetClass !== "cash");
}

async function resolveHoldingsSymbols(input: {
  businessDb: SqliteDatabase;
  portfolioIds: string[] | null;
}): Promise<Map<string, Set<string>>> {
  const portfolios = await listPortfolios(input.businessDb);
  const selected = input.portfolioIds?.length
    ? portfolios.filter((portfolio) => input.portfolioIds?.includes(portfolio.id))
    : portfolios;

  const result = new Map<string, Set<string>>();
  for (const portfolio of selected) {
    const entries = await listLedgerEntriesByPortfolio(
      input.businessDb,
      portfolio.id
    );
    if (entries.length === 0) continue;
    const derived = derivePositionsFromLedger({
      portfolioId: portfolio.id,
      entries,
      metadataBySymbol: new Map(),
      baseCurrency: portfolio.baseCurrency
    });
    derived.positions
      .filter((position) => position.assetClass !== "cash" && position.quantity > 0)
      .forEach((position) => {
        const symbol = position.symbol.trim();
        if (!symbol) return;
        const reason = `holdings:${portfolio.id}`;
        addReason(result, symbol, reason);
      });
  }
  return result;
}

function addReason(
  map: Map<string, Set<string>>,
  symbol: string,
  reason: string
): void {
  const key = symbol.trim();
  if (!key) return;
  const set = map.get(key) ?? new Set<string>();
  set.add(reason);
  map.set(key, set);
}
