import type { PortfolioId, PortfolioSnapshot, PositionValuation } from "@mytrader/shared";

import { getLatestPrices } from "../market/marketRepository";
import { listPositionsByPortfolio } from "../storage/positionRepository";
import { getPortfolio } from "../storage/portfolioRepository";
import { listRiskLimits } from "../storage/riskLimitRepository";
import type { SqliteDatabase } from "../storage/sqlite";

export async function getPortfolioSnapshot(
  businessDb: SqliteDatabase,
  marketDb: SqliteDatabase,
  portfolioId: PortfolioId
): Promise<PortfolioSnapshot> {
  const portfolio = await getPortfolio(businessDb, portfolioId);
  if (!portfolio) throw new Error("未找到组合。");

  const positions = await listPositionsByPortfolio(businessDb, portfolioId);
  const riskLimits = await listRiskLimits(businessDb, portfolioId);
  const symbols = positions.map((position) => position.symbol);
  const latestPrices = await getLatestPrices(marketDb, symbols);

  const valuations: PositionValuation[] = positions.map((position) => {
    const latest = latestPrices.get(position.symbol);
    const latestPrice = latest?.close ?? null;
    const priceDate = latest?.tradeDate ?? null;
    const marketValue =
      latestPrice === null ? null : latestPrice * position.quantity;
    const costValue =
      position.cost === null ? null : position.cost * position.quantity;
    const pnl =
      marketValue === null || costValue === null ? null : marketValue - costValue;
    const pnlPct =
      pnl === null || costValue === null || costValue === 0
        ? null
        : pnl / costValue;

    return {
      position,
      latestPrice,
      priceDate,
      marketValue,
      costValue,
      pnl,
      pnlPct
    };
  });

  const totalMarketValue = valuations.reduce((sum, val) => {
    return sum + (val.marketValue ?? 0);
  }, 0);

  const totalCostValue = valuations.reduce((sum, val) => {
    return sum + (val.costValue ?? 0);
  }, 0);

  const bySymbol = valuations.map((val) => ({
    key: val.position.symbol,
    label: val.position.name ?? val.position.symbol,
    weight: totalMarketValue > 0 ? (val.marketValue ?? 0) / totalMarketValue : 0,
    marketValue: val.marketValue ?? 0
  }));

  const byAssetClassMap = new Map<
    string,
    { label: string; marketValue: number }
  >();
  for (const val of valuations) {
    const key = val.position.assetClass;
    const existing = byAssetClassMap.get(key);
    const marketValue = val.marketValue ?? 0;
    if (existing) {
      existing.marketValue += marketValue;
    } else {
      byAssetClassMap.set(key, {
        label: formatAssetClassLabel(key),
        marketValue
      });
    }
  }

  const byAssetClass = Array.from(byAssetClassMap.entries()).map(
    ([key, entry]) => ({
      key,
      label: entry.label,
      weight: totalMarketValue > 0 ? entry.marketValue / totalMarketValue : 0,
      marketValue: entry.marketValue
    })
  );

  const riskWarnings = riskLimits
    .map((limit) => {
      if (limit.limitType === "position_weight") {
        const exposure = bySymbol.find((entry) => entry.key === limit.target);
        const actual = exposure?.weight ?? 0;
        if (actual <= limit.threshold) return null;
        return {
          limitId: limit.id,
          limitType: limit.limitType,
          target: limit.target,
          threshold: limit.threshold,
          actual,
          message: `持仓 ${limit.target} 权重 ${formatPct(actual)} 超过上限 ${formatPct(limit.threshold)}。`
        };
      }
      if (limit.limitType === "asset_class_weight") {
        const exposure = byAssetClass.find(
          (entry) => entry.key === limit.target
        );
        const actual = exposure?.weight ?? 0;
        if (actual <= limit.threshold) return null;
        const targetLabel = formatAssetClassLabel(limit.target);
        return {
          limitId: limit.id,
          limitType: limit.limitType,
          target: limit.target,
          threshold: limit.threshold,
          actual,
          message: `资产类别 ${targetLabel} 权重 ${formatPct(actual)} 超过上限 ${formatPct(limit.threshold)}。`
        };
      }
      return null;
    })
    .filter((warning): warning is NonNullable<typeof warning> => Boolean(warning));

  const priceAsOf = valuations
    .map((val) => val.priceDate)
    .filter((date): date is string => Boolean(date))
    .sort()
    .pop() ?? null;

  return {
    portfolio,
    positions: valuations,
    totals: {
      marketValue: totalMarketValue,
      costValue: totalCostValue,
      pnl: totalMarketValue - totalCostValue
    },
    exposures: {
      byAssetClass,
      bySymbol
    },
    riskLimits,
    riskWarnings,
    priceAsOf
  };
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatAssetClassLabel(value: string): string {
  switch (value) {
    case "stock":
      return "股票";
    case "etf":
      return "ETF";
    case "cash":
      return "现金";
    default:
      return value;
  }
}
