# Frontend app

React + TypeScript UI (Vite).

## Dev

- `pnpm -C apps/frontend dev`

## Theme

- Theme mode:
  - `system`: follow OS appearance
  - `light`: force light theme
  - `dark`: force dark theme
- Storage key: `mytrader:ui:theme-mode`
- Legacy migration: `localStorage.theme` is auto-migrated to `mytrader:ui:theme-mode`

## Styling contract

- Use semantic theme tokens from `src/theme.css` (`--mt-*`).
- Prefer shared semantic classes (`ui-*`) for common controls and status styles.
- Do not hardcode color literals in `src/**` except `src/theme.css`.
- Do not add `@media (prefers-color-scheme: ...)` in CSS; use runtime theme mode + `data-theme`.
- Do not add `dark:` variants in Dashboard primitive components (Modal/FormGroup/Input/Select/PopoverSelect/Button/IconButton/Badge).

## Verification

- `pnpm -C apps/frontend typecheck`
- `pnpm -C apps/frontend build`
- `pnpm -C apps/frontend verify:theme`
