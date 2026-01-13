import { readFileSync } from "node:fs";

import type { AssetClass, MarketDataSource } from "@mytrader/shared";

export interface HoldingsCsvRow {
  symbol: string;
  name: string | null;
  assetClass: AssetClass;
  market: string;
  currency: string;
  quantity: number;
  cost: number | null;
  openDate: string | null;
}

export interface PricesCsvRow {
  symbol: string;
  tradeDate: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  source: MarketDataSource;
}

export interface CsvParseResult<T> {
  rows: T[];
  warnings: string[];
  skipped: number;
}

export function parseHoldingsCsv(filePath: string): CsvParseResult<HoldingsCsvRow> {
  const content = readFileSync(filePath, "utf8");
  const records = parseCsvRecords(content);

  const rows: HoldingsCsvRow[] = [];
  const warnings: string[] = [];
  let skipped = 0;

  records.forEach((record, index) => {
    const line = index + 2;
    const symbol = (record.symbol ?? "").trim();
    const assetClassRaw = (record.asset_class ?? "").trim().toLowerCase();
    const quantityRaw = (record.quantity ?? "").trim();

    if (!symbol || !assetClassRaw || !quantityRaw) {
      skipped += 1;
      warnings.push(`持仓第 ${line} 行：缺少必填字段。`);
      return;
    }

    const assetClass = normalizeAssetClass(assetClassRaw);
    if (!assetClass) {
      skipped += 1;
      warnings.push(`持仓第 ${line} 行：asset_class 无效（${assetClassRaw}）。`);
      return;
    }

    const quantity = parseNumber(quantityRaw);
    if (quantity === null) {
      skipped += 1;
      warnings.push(`持仓第 ${line} 行：数量无效（${quantityRaw}）。`);
      return;
    }
    if (quantity <= 0) {
      skipped += 1;
      warnings.push(`持仓第 ${line} 行：数量必须大于 0。`);
      return;
    }

    const cost = parseNumber(record.cost ?? "");
    const openDate = normalizeDate(record.open_date ?? "");
    if (record.open_date && !openDate) {
      warnings.push(`持仓第 ${line} 行：open_date 无效（${record.open_date}）。`);
    }

    rows.push({
      symbol,
      name: (record.name ?? "").trim() || null,
      assetClass,
      market: (record.market ?? "").trim() || "CN",
      currency: (record.currency ?? "").trim() || "CNY",
      quantity,
      cost,
      openDate
    });
  });

  return { rows, warnings, skipped };
}

export function parsePricesCsv(
  filePath: string,
  source: MarketDataSource
): CsvParseResult<PricesCsvRow> {
  const content = readFileSync(filePath, "utf8");
  const records = parseCsvRecords(content);

  const rows: PricesCsvRow[] = [];
  const warnings: string[] = [];
  let skipped = 0;

  records.forEach((record, index) => {
    const line = index + 2;
    const symbol = (record.symbol ?? "").trim();
    const tradeDateRaw = (record.trade_date ?? "").trim();
    const tradeDate = normalizeDate(tradeDateRaw);

    if (!symbol || !tradeDate) {
      skipped += 1;
      warnings.push(`行情第 ${line} 行：缺少 symbol 或 trade_date。`);
      return;
    }

    const close = parseNumber(record.close ?? "");
    if (close === null) {
      skipped += 1;
      warnings.push(`行情第 ${line} 行：close 无效（${record.close}）。`);
      return;
    }

    rows.push({
      symbol,
      tradeDate,
      open: parseNumber(record.open ?? ""),
      high: parseNumber(record.high ?? ""),
      low: parseNumber(record.low ?? ""),
      close,
      volume: parseNumber(record.volume ?? ""),
      source
    });
  });

  return { rows, warnings, skipped };
}

function normalizeAssetClass(value: string): AssetClass | null {
  switch (value) {
    case "stock":
    case "equity":
      return "stock";
    case "etf":
      return "etf";
    case "cash":
      return "cash";
    default:
      return null;
  }
}

function normalizeDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(trimmed)) {
    return trimmed.replace(/\//g, "-");
  }
  return null;
}

function parseNumber(value: string | undefined): number | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

function parseCsvRecords(content: string): Record<string, string>[] {
  const rows = parseCsv(content);
  if (rows.length === 0) return [];

  const headerRow = rows[0]?.map((cell) =>
    cell.trim().replace(/^\uFEFF/, "").toLowerCase()
  );
  if (!headerRow || headerRow.length === 0) return [];

  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    headerRow.forEach((key, idx) => {
      record[key] = row[idx] ?? "";
    });
    return record;
  });
}

function parseCsv(content: string): string[][] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  return lines.map(parseCsvLine);
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i] ?? "";
    if (char === "\"") {
      const next = line[i + 1];
      if (inQuotes && next === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}
