import type {
  MarketTargetsConfig,
  PreviewTargetsDiffResult,
  PreviewTargetsDraftInput,
  ResolvedTargetSymbol as SharedResolvedTargetSymbol,
  TushareIngestItem
} from "@mytrader/shared";

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
import {
  getInstrumentsBySymbols,
  listAutoIngestSymbols
} from "./marketRepository";

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
  return await previewTargetsByConfig({
    businessDb,
    marketDb,
    config
  });
}

export async function previewTargetsDraft(input: {
  businessDb: SqliteDatabase;
  marketDb: SqliteDatabase;
  draftInput: PreviewTargetsDraftInput;
}): Promise<PreviewTargetsDiffResult> {
  const { businessDb, marketDb, draftInput } = input;
  const baselineConfig = await getMarketTargetsConfig(businessDb);
  const baseline = await previewTargetsByConfig({
    businessDb,
    marketDb,
    config: baselineConfig
  });
  const draft = await previewTargetsByConfig({
    businessDb,
    marketDb,
    config: draftInput.config
  });
  const diff = buildTargetsDiff({
    baseline,
    draft
  });
  const query = draftInput.query?.trim().toLowerCase() ?? "";
  const limit = normalizePreviewLimit(draftInput.limit);
  if (!query && !limit) return diff;

  return {
    baseline: {
      ...diff.baseline,
      symbols: filterAndSliceSymbols(diff.baseline.symbols, query, limit)
    },
    draft: {
      ...diff.draft,
      symbols: filterAndSliceSymbols(diff.draft.symbols, query, limit)
    },
    addedSymbols: filterAndSliceSymbols(diff.addedSymbols, query, limit),
    removedSymbols: filterAndSliceSymbols(diff.removedSymbols, query, limit),
    reasonChangedSymbols: diff.reasonChangedSymbols
      .filter((item) => !query || item.symbol.toLowerCase().includes(query))
      .slice(0, limit ?? undefined)
  };
}

async function previewTargetsByConfig(input: {
  businessDb: SqliteDatabase;
  marketDb: SqliteDatabase;
  config: MarketTargetsConfig;
}): Promise<PreviewTargetsResult> {
  const { businessDb, marketDb, config } = input;
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
    const symbols = await listAutoIngestSymbols(marketDb);
    symbols.forEach((rawSymbol) => {
      const symbol = rawSymbol.trim();
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

function buildTargetsDiff(input: {
  baseline: PreviewTargetsResult;
  draft: PreviewTargetsResult;
}): PreviewTargetsDiffResult {
  const baselineMap = new Map<string, SharedResolvedTargetSymbol>();
  input.baseline.symbols.forEach((row) => baselineMap.set(row.symbol, row));
  const draftMap = new Map<string, SharedResolvedTargetSymbol>();
  input.draft.symbols.forEach((row) => draftMap.set(row.symbol, row));

  const addedSymbols: SharedResolvedTargetSymbol[] = [];
  const removedSymbols: SharedResolvedTargetSymbol[] = [];
  const reasonChangedSymbols: PreviewTargetsDiffResult["reasonChangedSymbols"] = [];

  draftMap.forEach((draftRow, symbol) => {
    const baselineRow = baselineMap.get(symbol);
    if (!baselineRow) {
      addedSymbols.push(draftRow);
      return;
    }
    if (!sameReasonSet(baselineRow.reasons, draftRow.reasons)) {
      reasonChangedSymbols.push({
        symbol,
        baselineReasons: baselineRow.reasons,
        draftReasons: draftRow.reasons
      });
    }
  });

  baselineMap.forEach((baselineRow, symbol) => {
    if (!draftMap.has(symbol)) removedSymbols.push(baselineRow);
  });

  addedSymbols.sort((a, b) => a.symbol.localeCompare(b.symbol));
  removedSymbols.sort((a, b) => a.symbol.localeCompare(b.symbol));
  reasonChangedSymbols.sort((a, b) => a.symbol.localeCompare(b.symbol));

  return {
    baseline: input.baseline,
    draft: input.draft,
    addedSymbols,
    removedSymbols,
    reasonChangedSymbols
  };
}

export async function resolveAutoIngestItems(input: {
  businessDb: SqliteDatabase;
  marketDb: SqliteDatabase;
}): Promise<TushareIngestItem[]> {
  const preview = await previewTargets(input);
  const symbols = preview.symbols.map((item) => item.symbol);
  const metadata = await getInstrumentsBySymbols(input.marketDb, symbols);
  const items: TushareIngestItem[] = [];

  for (const symbol of symbols) {
    const assetClass = metadata.get(symbol)?.assetClass;
    if (assetClass !== "stock" && assetClass !== "etf") continue;
    items.push({ symbol, assetClass });
  }

  return items;
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

function sameReasonSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function filterAndSliceSymbols(
  symbols: SharedResolvedTargetSymbol[],
  query: string,
  limit: number | null
): SharedResolvedTargetSymbol[] {
  const filtered = query
    ? symbols.filter((row) => row.symbol.toLowerCase().includes(query))
    : symbols;
  if (!limit) return filtered;
  return filtered.slice(0, limit);
}

function normalizePreviewLimit(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.floor(value);
  if (n <= 0) return null;
  return Math.min(5000, n);
}
