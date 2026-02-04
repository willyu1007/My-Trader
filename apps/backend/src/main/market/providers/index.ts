import type { MarketProvider, MarketProviderId } from "./types";
import { tushareProvider } from "./tushareProvider";

export function getMarketProvider(id: MarketProviderId): MarketProvider {
  switch (id) {
    case "tushare":
      return tushareProvider;
    default: {
      const exhaustive: never = id;
      throw new Error(`Unknown market provider: ${String(exhaustive)}`);
    }
  }
}

