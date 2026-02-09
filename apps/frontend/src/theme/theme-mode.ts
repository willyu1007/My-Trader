export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const THEME_MODE_KEY = "mytrader:ui:theme-mode";
const LEGACY_THEME_KEY = "theme";
const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

function resolveLegacyTheme(value: string | null): ThemeMode | null {
  if (!value) return null;
  if (value === "dark") return "dark";
  if (value === "light") return "light";
  if (value === "system") return "system";
  return null;
}

function getSystemPrefersDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(DARK_MEDIA_QUERY).matches;
}

function persistThemeMode(mode: ThemeMode): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(THEME_MODE_KEY, mode);
  } catch {
    // ignore storage failures
  }
}

function migrateLegacyThemeMode(): ThemeMode | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const legacyRaw = window.localStorage.getItem(LEGACY_THEME_KEY);
    const legacyMode = resolveLegacyTheme(legacyRaw);
    if (!legacyMode) return null;
    window.localStorage.setItem(THEME_MODE_KEY, legacyMode);
    window.localStorage.removeItem(LEGACY_THEME_KEY);
    return legacyMode;
  } catch {
    return null;
  }
}

export function getThemeMode(): ThemeMode {
  if (typeof window === "undefined" || !window.localStorage) return "system";
  try {
    const stored = window.localStorage.getItem(THEME_MODE_KEY);
    if (isThemeMode(stored)) return stored;
    const migrated = migrateLegacyThemeMode();
    if (migrated) return migrated;
  } catch {
    return "system";
  }
  return "system";
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === "light" || mode === "dark") return mode;
  return getSystemPrefersDark() ? "dark" : "light";
}

export function applyResolvedTheme(theme: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle("dark", theme === "dark");
}

export function setThemeMode(
  mode: ThemeMode,
  options?: { persist?: boolean }
): ResolvedTheme {
  const persist = options?.persist ?? true;
  if (persist) persistThemeMode(mode);
  const resolved = resolveTheme(mode);
  applyResolvedTheme(resolved);
  return resolved;
}

export function initThemeMode(): { mode: ThemeMode; resolved: ResolvedTheme } {
  const mode = getThemeMode();
  const resolved = setThemeMode(mode, { persist: true });
  return { mode, resolved };
}

export function subscribeToSystemThemeChange(
  listener: (resolved: ResolvedTheme) => void
): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }

  const mql = window.matchMedia(DARK_MEDIA_QUERY);
  const handler = (event: MediaQueryListEvent) => {
    listener(event.matches ? "dark" : "light");
  };

  if (typeof mql.addEventListener === "function") {
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }

  mql.addListener(handler);
  return () => mql.removeListener(handler);
}
