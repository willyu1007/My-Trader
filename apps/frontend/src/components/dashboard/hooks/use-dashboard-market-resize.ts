import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";

export interface UseDashboardMarketResizeOptions {
  clampNumber: (value: number, min: number, max: number) => number;
  marketExplorerWidth: number;
  marketExplorerMinWidth: number;
  marketExplorerMaxWidth: number;
  targetsEditorLeftPct: number;
  targetsEditorSplitMin: number;
  targetsEditorSplitMax: number;
  setMarketExplorerWidth: Dispatch<SetStateAction<number>>;
  setTargetsEditorLeftPct: Dispatch<SetStateAction<number>>;
}

export function useDashboardMarketResize(
  options: UseDashboardMarketResizeOptions
) {
  const marketExplorerResizeRef = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
  } | null>(null);

  const targetsEditorGridRef = useRef<HTMLDivElement | null>(null);
  const targetsEditorResizeRef = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
    startPct: number;
  } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleMove = (event: PointerEvent) => {
      const state = marketExplorerResizeRef.current;
      if (!state) return;
      const delta = event.clientX - state.startX;
      const nextWidth = options.clampNumber(
        state.startWidth + delta,
        options.marketExplorerMinWidth,
        options.marketExplorerMaxWidth
      );
      options.setMarketExplorerWidth(nextWidth);
    };

    const stop = () => {
      if (!marketExplorerResizeRef.current) return;
      marketExplorerResizeRef.current = null;
      document.body.style.userSelect = "";
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      document.body.style.userSelect = "";
    };
  }, [
    options.clampNumber,
    options.marketExplorerMaxWidth,
    options.marketExplorerMinWidth,
    options.setMarketExplorerWidth
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleMove = (event: PointerEvent) => {
      const state = targetsEditorResizeRef.current;
      if (!state) return;
      if (state.startWidth <= 0) return;
      const delta = event.clientX - state.startX;
      const deltaPct = (delta / state.startWidth) * 100;
      const next = options.clampNumber(
        state.startPct + deltaPct,
        options.targetsEditorSplitMin,
        options.targetsEditorSplitMax
      );
      options.setTargetsEditorLeftPct(next);
    };

    const stop = () => {
      if (!targetsEditorResizeRef.current) return;
      targetsEditorResizeRef.current = null;
      document.body.style.userSelect = "";
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      document.body.style.userSelect = "";
    };
  }, [
    options.clampNumber,
    options.setTargetsEditorLeftPct,
    options.targetsEditorSplitMax,
    options.targetsEditorSplitMin
  ]);

  const handleMarketExplorerResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      marketExplorerResizeRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startWidth: options.marketExplorerWidth
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      document.body.style.userSelect = "none";
    },
    [options.marketExplorerWidth]
  );

  const handleMarketExplorerResizeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? 32 : 16;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        options.setMarketExplorerWidth((prev) =>
          options.clampNumber(
            prev - step,
            options.marketExplorerMinWidth,
            options.marketExplorerMaxWidth
          )
        );
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        options.setMarketExplorerWidth((prev) =>
          options.clampNumber(
            prev + step,
            options.marketExplorerMinWidth,
            options.marketExplorerMaxWidth
          )
        );
      }
    },
    [
      options.clampNumber,
      options.marketExplorerMaxWidth,
      options.marketExplorerMinWidth,
      options.setMarketExplorerWidth
    ]
  );

  const handleTargetsEditorResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const width = targetsEditorGridRef.current?.getBoundingClientRect().width ?? 0;
      if (width <= 0) return;
      event.preventDefault();
      targetsEditorResizeRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startWidth: width,
        startPct: options.targetsEditorLeftPct
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      document.body.style.userSelect = "none";
    },
    [options.targetsEditorLeftPct]
  );

  const handleTargetsEditorResizeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? 6 : 3;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        options.setTargetsEditorLeftPct((prev) =>
          options.clampNumber(
            prev - step,
            options.targetsEditorSplitMin,
            options.targetsEditorSplitMax
          )
        );
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        options.setTargetsEditorLeftPct((prev) =>
          options.clampNumber(
            prev + step,
            options.targetsEditorSplitMin,
            options.targetsEditorSplitMax
          )
        );
      }
    },
    [
      options.clampNumber,
      options.setTargetsEditorLeftPct,
      options.targetsEditorSplitMax,
      options.targetsEditorSplitMin
    ]
  );

  return {
    targetsEditorGridRef,
    handleMarketExplorerResizePointerDown,
    handleMarketExplorerResizeKeyDown,
    handleTargetsEditorResizePointerDown,
    handleTargetsEditorResizeKeyDown
  };
}
