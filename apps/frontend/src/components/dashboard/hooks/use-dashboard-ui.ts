import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { AnalysisTab, InsightsTab, OtherTab, WorkspaceView } from "../types";

export interface UseDashboardUiResult {
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  notice: string | null;
  setNotice: Dispatch<SetStateAction<string | null>>;
  activeView: WorkspaceView;
  setActiveView: Dispatch<SetStateAction<WorkspaceView>>;
  otherTab: OtherTab;
  setOtherTab: Dispatch<SetStateAction<OtherTab>>;
  analysisTab: AnalysisTab;
  setAnalysisTab: Dispatch<SetStateAction<AnalysisTab>>;
  insightsTab: InsightsTab;
  setInsightsTab: Dispatch<SetStateAction<InsightsTab>>;
  isNavCollapsed: boolean;
  setIsNavCollapsed: Dispatch<SetStateAction<boolean>>;
}

interface UseDashboardUiOptions {
  navCollapsed?: boolean;
  onNavCollapsedChange?: (collapsed: boolean) => void;
}

function resolveNextState(
  value: SetStateAction<boolean>,
  previous: boolean
): boolean {
  if (typeof value === "function") {
    return (value as (prevState: boolean) => boolean)(previous);
  }
  return value;
}

export function useDashboardUi(options?: UseDashboardUiOptions): UseDashboardUiResult {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<WorkspaceView>("portfolio");
  const [otherTab, setOtherTab] = useState<OtherTab>("data-management");
  const [analysisTab, setAnalysisTab] = useState<AnalysisTab>("portfolio");
  const [insightsTab, setInsightsTab] = useState<InsightsTab>("generate");
  const [isNavCollapsedState, setIsNavCollapsedState] = useState(false);
  const isNavCollapsedControlled = typeof options?.navCollapsed === "boolean";
  const isNavCollapsed = isNavCollapsedControlled
    ? Boolean(options?.navCollapsed)
    : isNavCollapsedState;

  const navCollapsedBeforeMarketRef = useRef<boolean | null>(null);
  const navAutoCollapsedActiveRef = useRef(false);
  const onNavCollapsedChange = options?.onNavCollapsedChange;

  const setIsNavCollapsed = useCallback<Dispatch<SetStateAction<boolean>>>(
    (value) => {
      const next = resolveNextState(value, isNavCollapsed);
      const normalized = activeView === "market" ? true : next;
      if (normalized === isNavCollapsed) return;

      if (!isNavCollapsedControlled) {
        setIsNavCollapsedState(normalized);
      }
      onNavCollapsedChange?.(normalized);
    },
    [activeView, isNavCollapsed, isNavCollapsedControlled, onNavCollapsedChange]
  );

  useEffect(() => {
    if (activeView === "market") {
      if (!navAutoCollapsedActiveRef.current) {
        navCollapsedBeforeMarketRef.current = isNavCollapsed;
        navAutoCollapsedActiveRef.current = true;
      }
      setIsNavCollapsed(true);
      return;
    }

    if (navAutoCollapsedActiveRef.current) {
      navAutoCollapsedActiveRef.current = false;
      const previous = navCollapsedBeforeMarketRef.current;
      navCollapsedBeforeMarketRef.current = null;
      if (previous !== null) setIsNavCollapsed(previous);
    }
  }, [activeView, isNavCollapsed, setIsNavCollapsed]);

  return {
    error,
    setError,
    notice,
    setNotice,
    activeView,
    setActiveView,
    otherTab,
    setOtherTab,
    analysisTab,
    setAnalysisTab,
    insightsTab,
    setInsightsTab,
    isNavCollapsed,
    setIsNavCollapsed
  };
}
