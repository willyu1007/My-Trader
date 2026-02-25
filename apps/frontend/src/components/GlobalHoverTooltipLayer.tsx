import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const GLOBAL_TOOLTIP_DELAY_MS = 200;
const TOOLTIP_GUTTER = 8;
const TOOLTIP_OFFSET = 8;
const TOOLTIP_MAX_WIDTH = 360;
const TOOLTIP_ESTIMATED_HEIGHT = 56;

type TooltipLayout = {
  top: number;
  left: number;
  width: number;
  placement: "top" | "bottom";
};

function resolveTooltipHost(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>("[title],[data-mt-tooltip]");
}

function resolveTooltipText(element: HTMLElement | null): string | null {
  if (!element) return null;
  const custom = element.getAttribute("data-mt-tooltip")?.trim();
  if (custom) return custom;
  const native = element.getAttribute("title")?.trim();
  if (native) return native;
  return null;
}

function suppressNativeTitle(element: HTMLElement): void {
  if (!element.hasAttribute("title")) return;
  const current = element.getAttribute("title");
  if (!current) return;
  element.setAttribute("data-mt-title-backup", current);
  element.removeAttribute("title");
}

function restoreNativeTitle(element: HTMLElement | null): void {
  if (!element) return;
  const backup = element.getAttribute("data-mt-title-backup");
  if (!backup) return;
  element.setAttribute("title", backup);
  element.removeAttribute("data-mt-title-backup");
}

function computeLayout(element: HTMLElement): TooltipLayout {
  const rect = element.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const width = Math.min(
    TOOLTIP_MAX_WIDTH,
    Math.max(140, viewportWidth - TOOLTIP_GUTTER * 2)
  );
  const left = Math.min(
    Math.max(TOOLTIP_GUTTER, rect.left + rect.width / 2 - width / 2),
    viewportWidth - width - TOOLTIP_GUTTER
  );
  const spaceBelow = viewportHeight - rect.bottom - TOOLTIP_GUTTER;
  const openUpward = spaceBelow < TOOLTIP_ESTIMATED_HEIGHT && rect.top > spaceBelow;
  const top = openUpward ? rect.top - TOOLTIP_OFFSET : rect.bottom + TOOLTIP_OFFSET;
  return {
    top,
    left,
    width,
    placement: openUpward ? "top" : "bottom"
  };
}

export function GlobalHoverTooltipLayer() {
  const [text, setText] = useState<string | null>(null);
  const [layout, setLayout] = useState<TooltipLayout | null>(null);
  const [visible, setVisible] = useState(false);
  const activeElementRef = useRef<HTMLElement | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const hideTooltip = useCallback(() => {
    clearTimer();
    setVisible(false);
    setLayout(null);
    setText(null);
  }, [clearTimer]);

  const releaseActiveElement = useCallback(() => {
    restoreNativeTitle(activeElementRef.current);
    activeElementRef.current = null;
    hideTooltip();
  }, [hideTooltip]);

  const activateTooltip = useCallback(
    (element: HTMLElement, tooltipText: string) => {
      if (activeElementRef.current && activeElementRef.current !== element) {
        restoreNativeTitle(activeElementRef.current);
      }
      activeElementRef.current = element;
      suppressNativeTitle(element);
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        if (activeElementRef.current !== element) return;
        setText(tooltipText);
        setLayout(computeLayout(element));
        setVisible(true);
      }, GLOBAL_TOOLTIP_DELAY_MS);
    },
    [clearTimer]
  );

  useEffect(() => {
    const onPointerOver = (event: Event) => {
      const host = resolveTooltipHost(event.target);
      const tooltipText = resolveTooltipText(host);
      if (!host || !tooltipText) {
        releaseActiveElement();
        return;
      }
      if (activeElementRef.current === host) return;
      activateTooltip(host, tooltipText);
    };

    const onPointerOut = (event: Event) => {
      const active = activeElementRef.current;
      if (!active) return;
      const related = (event as MouseEvent).relatedTarget as Node | null;
      if (related && active.contains(related)) return;
      const nextHost =
        related instanceof Element
          ? related.closest<HTMLElement>("[title],[data-mt-tooltip]")
          : null;
      if (nextHost === active) return;
      if (nextHost) {
        const nextText = resolveTooltipText(nextHost);
        if (nextText) {
          activateTooltip(nextHost, nextText);
          return;
        }
      }
      releaseActiveElement();
    };

    const onFocusIn = (event: Event) => {
      const host = resolveTooltipHost(event.target);
      const tooltipText = resolveTooltipText(host);
      if (!host || !tooltipText) return;
      activateTooltip(host, tooltipText);
    };

    const onFocusOut = (event: Event) => {
      const active = activeElementRef.current;
      if (!active) return;
      const related = (event as FocusEvent).relatedTarget as Node | null;
      if (related && active.contains(related)) return;
      releaseActiveElement();
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        releaseActiveElement();
      }
    };

    const onViewportChange = () => {
      const active = activeElementRef.current;
      if (!active || !visible) return;
      setLayout(computeLayout(active));
    };

    document.addEventListener("mouseover", onPointerOver, true);
    document.addEventListener("mouseout", onPointerOut, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);
    document.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mouseover", onPointerOver, true);
      document.removeEventListener("mouseout", onPointerOut, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", onFocusOut, true);
      document.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("keydown", onEscape);
      releaseActiveElement();
    };
  }, [activateTooltip, releaseActiveElement, visible]);

  if (!visible || !layout || !text) return null;

  return createPortal(
    <div
      role="tooltip"
      className="pointer-events-none z-[120]"
      style={{
        position: "fixed",
        top: `${layout.top}px`,
        left: `${layout.left}px`,
        width: `${layout.width}px`,
        transform: layout.placement === "top" ? "translateY(-100%)" : undefined
      }}
    >
      <div className="rounded-md border border-slate-200/90 bg-white px-2 py-1.5 text-[11px] leading-4 text-slate-700 shadow-lg whitespace-pre-line dark:border-border-dark dark:bg-surface-dark dark:text-slate-200">
        {text}
      </div>
    </div>,
    document.body
  );
}
