import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import type {
  InstrumentProfile,
  InstrumentProfileSummary,
  MarketDailyBar,
  MarketQuote
} from "@mytrader/shared";

export interface UseDashboardAnalysisOptions<TRange extends string> {
  defaultInstrumentRange: TRange;
}

export interface UseDashboardAnalysisResult<TRange extends string> {
  analysisInstrumentQuery: string;
  setAnalysisInstrumentQuery: Dispatch<SetStateAction<string>>;
  analysisInstrumentSearchResults: InstrumentProfileSummary[];
  setAnalysisInstrumentSearchResults: Dispatch<
    SetStateAction<InstrumentProfileSummary[]>
  >;
  analysisInstrumentSearchLoading: boolean;
  setAnalysisInstrumentSearchLoading: Dispatch<SetStateAction<boolean>>;
  analysisInstrumentSymbol: string | null;
  setAnalysisInstrumentSymbol: Dispatch<SetStateAction<string | null>>;
  analysisInstrumentRange: TRange;
  setAnalysisInstrumentRange: Dispatch<SetStateAction<TRange>>;
  analysisInstrumentProfile: InstrumentProfile | null;
  setAnalysisInstrumentProfile: Dispatch<
    SetStateAction<InstrumentProfile | null>
  >;
  analysisInstrumentUserTags: string[];
  setAnalysisInstrumentUserTags: Dispatch<SetStateAction<string[]>>;
  analysisInstrumentQuote: MarketQuote | null;
  setAnalysisInstrumentQuote: Dispatch<SetStateAction<MarketQuote | null>>;
  analysisInstrumentBars: MarketDailyBar[];
  setAnalysisInstrumentBars: Dispatch<SetStateAction<MarketDailyBar[]>>;
  analysisInstrumentLoading: boolean;
  setAnalysisInstrumentLoading: Dispatch<SetStateAction<boolean>>;
  analysisInstrumentError: string | null;
  setAnalysisInstrumentError: Dispatch<SetStateAction<string | null>>;
}

export function useDashboardAnalysis<TRange extends string>(
  options: UseDashboardAnalysisOptions<TRange>
): UseDashboardAnalysisResult<TRange> {
  const [analysisInstrumentQuery, setAnalysisInstrumentQuery] = useState("");
  const [analysisInstrumentSearchResults, setAnalysisInstrumentSearchResults] =
    useState<InstrumentProfileSummary[]>([]);
  const [analysisInstrumentSearchLoading, setAnalysisInstrumentSearchLoading] =
    useState(false);
  const [analysisInstrumentSymbol, setAnalysisInstrumentSymbol] = useState<
    string | null
  >(null);
  const [analysisInstrumentRange, setAnalysisInstrumentRange] = useState<TRange>(
    options.defaultInstrumentRange
  );
  const [analysisInstrumentProfile, setAnalysisInstrumentProfile] =
    useState<InstrumentProfile | null>(null);
  const [analysisInstrumentUserTags, setAnalysisInstrumentUserTags] = useState<
    string[]
  >([]);
  const [analysisInstrumentQuote, setAnalysisInstrumentQuote] =
    useState<MarketQuote | null>(null);
  const [analysisInstrumentBars, setAnalysisInstrumentBars] = useState<
    MarketDailyBar[]
  >([]);
  const [analysisInstrumentLoading, setAnalysisInstrumentLoading] =
    useState(false);
  const [analysisInstrumentError, setAnalysisInstrumentError] = useState<
    string | null
  >(null);

  return {
    analysisInstrumentQuery,
    setAnalysisInstrumentQuery,
    analysisInstrumentSearchResults,
    setAnalysisInstrumentSearchResults,
    analysisInstrumentSearchLoading,
    setAnalysisInstrumentSearchLoading,
    analysisInstrumentSymbol,
    setAnalysisInstrumentSymbol,
    analysisInstrumentRange,
    setAnalysisInstrumentRange,
    analysisInstrumentProfile,
    setAnalysisInstrumentProfile,
    analysisInstrumentUserTags,
    setAnalysisInstrumentUserTags,
    analysisInstrumentQuote,
    setAnalysisInstrumentQuote,
    analysisInstrumentBars,
    setAnalysisInstrumentBars,
    analysisInstrumentLoading,
    setAnalysisInstrumentLoading,
    analysisInstrumentError,
    setAnalysisInstrumentError
  };
}
