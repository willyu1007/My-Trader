export type DatasetStorageLayer = "sqlite" | "duckdb";

export interface CompletenessDatasetContract {
  id: string;
  storage: DatasetStorageLayer;
  table: string;
  keyColumns: string[];
  tradeDateColumn: string | null;
  description: string;
}

const DATASET_REGISTRY: CompletenessDatasetContract[] = [
  {
    id: "sqlite.instruments",
    storage: "sqlite",
    table: "instruments",
    keyColumns: ["symbol"],
    tradeDateColumn: null,
    description: "Instrument registry in market cache."
  },
  {
    id: "sqlite.daily_prices",
    storage: "sqlite",
    table: "daily_prices",
    keyColumns: ["symbol", "trade_date"],
    tradeDateColumn: "trade_date",
    description: "Daily OHLCV prices in market cache."
  },
  {
    id: "sqlite.daily_basics",
    storage: "sqlite",
    table: "daily_basics",
    keyColumns: ["symbol", "trade_date"],
    tradeDateColumn: "trade_date",
    description: "Daily basic metrics for stocks."
  },
  {
    id: "sqlite.daily_moneyflows",
    storage: "sqlite",
    table: "daily_moneyflows",
    keyColumns: ["symbol", "trade_date"],
    tradeDateColumn: "trade_date",
    description: "Daily moneyflow metrics for stocks."
  },
  {
    id: "sqlite.instrument_profiles",
    storage: "sqlite",
    table: "instrument_profiles",
    keyColumns: ["symbol"],
    tradeDateColumn: null,
    description: "Provider-level instrument profile cache."
  },
  {
    id: "sqlite.fx_pair_meta",
    storage: "sqlite",
    table: "fx_pair_meta",
    keyColumns: ["symbol"],
    tradeDateColumn: null,
    description: "FX pair metadata cache."
  },
  {
    id: "sqlite.macro_module_snapshot",
    storage: "sqlite",
    table: "macro_module_snapshot",
    keyColumns: ["as_of_trade_date", "module_id"],
    tradeDateColumn: "as_of_trade_date",
    description: "Macro module snapshot coverage cache."
  },
  {
    id: "duckdb.futures_daily_ext",
    storage: "duckdb",
    table: "futures_daily_ext",
    keyColumns: ["symbol", "trade_date"],
    tradeDateColumn: "trade_date",
    description: "Optional futures settlement/OI extension in analysis duckdb."
  },
  {
    id: "duckdb.spot_sge_daily_ext",
    storage: "duckdb",
    table: "spot_sge_daily_ext",
    keyColumns: ["symbol", "trade_date"],
    tradeDateColumn: "trade_date",
    description: "Optional spot extension in analysis duckdb."
  }
];

export function listCompletenessDatasets(): CompletenessDatasetContract[] {
  return DATASET_REGISTRY.map((dataset) => ({
    ...dataset,
    keyColumns: [...dataset.keyColumns]
  }));
}

export function getCompletenessDataset(
  datasetId: string
): CompletenessDatasetContract | null {
  const item = DATASET_REGISTRY.find((dataset) => dataset.id === datasetId);
  if (!item) return null;
  return {
    ...item,
    keyColumns: [...item.keyColumns]
  };
}
