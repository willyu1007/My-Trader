import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { AnalysisTab, OtherTab, WorkspaceView } from "../types";

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
  isNavCollapsed: boolean;
  setIsNavCollapsed: Dispatch<SetStateAction<boolean>>;
}

export function useDashboardUi(): UseDashboardUiResult {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<WorkspaceView>("portfolio");
  const [otherTab, setOtherTab] = useState<OtherTab>("data-management");
  const [analysisTab, setAnalysisTab] = useState<AnalysisTab>("portfolio");
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);

  const navCollapsedBeforeMarketRef = useRef<boolean | null>(null);
  const navAutoCollapsedActiveRef = useRef(false);

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
  }, [activeView]);

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
    isNavCollapsed,
    setIsNavCollapsed
  };
}
