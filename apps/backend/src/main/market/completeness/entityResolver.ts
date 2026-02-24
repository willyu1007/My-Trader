import type {
  AssetClass,
  CompletenessBucketId,
  CompletenessEntityType,
  CompletenessScopeId
} from "@mytrader/shared";

import { all } from "../../storage/sqlite";
import type { SqliteDatabase } from "../../storage/sqlite";
import { resolveAutoIngestItems } from "../targetsService";
import type { CompletenessCheckDefinition } from "./checkRegistry";

export interface CompletenessEntity {
  entityType: CompletenessEntityType;
  entityId: string;
  assetClass: AssetClass | "unknown" | null;
}

export async function resolveCompletenessEntities(input: {
  scopeId: CompletenessScopeId;
  check: CompletenessCheckDefinition;
  businessDb: SqliteDatabase;
  marketDb: SqliteDatabase;
  symbols?: string[] | null;
}): Promise<CompletenessEntity[]> {
  if (input.scopeId === "target_pool") {
    return await resolveTargetPoolEntities(input);
  }
  return await resolveSourcePoolEntities(input.marketDb, input.check);
}

async function resolveTargetPoolEntities(input: {
  businessDb: SqliteDatabase;
  marketDb: SqliteDatabase;
  symbols?: string[] | null;
}): Promise<CompletenessEntity[]> {
  const filter = new Set(
    (input.symbols ?? []).map((item) => item.trim()).filter(Boolean)
  );

  const items = await resolveAutoIngestItems({
    businessDb: input.businessDb,
    marketDb: input.marketDb
  });

  return items
    .filter((item) => filter.size === 0 || filter.has(item.symbol))
    .map((item) => ({
      entityType: "instrument" as const,
      entityId: item.symbol,
      assetClass: item.assetClass
    }));
}

async function resolveSourcePoolEntities(
  marketDb: SqliteDatabase,
  check: CompletenessCheckDefinition
): Promise<CompletenessEntity[]> {
  if (check.entityType === "instrument") {
    return await resolveInstrumentEntities(marketDb, check.bucketId);
  }
  if (check.entityType === "fx_pair") {
    const rows = await all<{ symbol: string }>(
      marketDb,
      `
        select symbol
        from fx_pair_meta
        where is_active = 1
        order by symbol asc
      `
    );
    if (rows.length === 0) {
      return [{ entityType: "fx_pair", entityId: "fx:all", assetClass: "unknown" }];
    }
    return rows.map((row) => ({
      entityType: "fx_pair" as const,
      entityId: row.symbol,
      assetClass: "unknown" as const
    }));
  }
  if (check.entityType === "macro_module") {
    const rows = await all<{ module_id: string }>(
      marketDb,
      `
        select distinct module_id
        from macro_module_snapshot
        order by module_id asc
      `
    );
    if (rows.length === 0) {
      return [
        {
          entityType: "macro_module",
          entityId: "macro:all",
          assetClass: "unknown"
        }
      ];
    }
    return rows.map((row) => ({
      entityType: "macro_module" as const,
      entityId: row.module_id,
      assetClass: "unknown" as const
    }));
  }
  return [{ entityType: "global", entityId: "global", assetClass: null }];
}

async function resolveInstrumentEntities(
  marketDb: SqliteDatabase,
  bucketId: CompletenessBucketId
): Promise<CompletenessEntity[]> {
  const byAssetClass = resolveBucketAssetClass(bucketId);
  if (byAssetClass) {
    const rows = await all<{ symbol: string; asset_class: string | null }>(
      marketDb,
      `
        select symbol, asset_class
        from instruments
        where asset_class = ?
        order by symbol asc
      `,
      [byAssetClass]
    );
    if (rows.length === 0) {
      return [
        {
          entityType: "instrument",
          entityId: `${bucketId}:all`,
          assetClass: byAssetClass
        }
      ];
    }
    return rows.map((row) => ({
      entityType: "instrument" as const,
      entityId: row.symbol,
      assetClass: (row.asset_class as AssetClass | null) ?? byAssetClass
    }));
  }

  if (bucketId === "index") {
    const rows = await all<{ symbol: string }>(
      marketDb,
      `
        select symbol
        from instrument_profiles
        where kind = 'index'
        order by symbol asc
      `
    );
    if (rows.length === 0) {
      return [
        {
          entityType: "instrument",
          entityId: "index:all",
          assetClass: "unknown"
        }
      ];
    }
    return rows.map((row) => ({
      entityType: "instrument" as const,
      entityId: row.symbol,
      assetClass: "unknown" as const
    }));
  }

  return [{ entityType: "instrument", entityId: `${bucketId}:all`, assetClass: "unknown" }];
}

function resolveBucketAssetClass(bucketId: CompletenessBucketId): AssetClass | null {
  if (bucketId === "stock") return "stock";
  if (bucketId === "etf") return "etf";
  if (bucketId === "futures") return "futures";
  if (bucketId === "spot") return "spot";
  return null;
}
