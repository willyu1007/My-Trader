# 04 Verification

## Automated checks
- `pnpm -C /Volumes/DataDisk/Project/MyTrader/apps/frontend typecheck`
- `pnpm -C /Volumes/DataDisk/Project/MyTrader/apps/frontend build`
- `pnpm -C /Volumes/DataDisk/Project/MyTrader/apps/frontend verify:theme`

## Baseline metrics (before implementation)
- `dark:` markers in `App.tsx` + `Dashboard.tsx`: 943
- color literal matches (`#hex` / `rgba(` / `hsl(`) across key frontend files: 154

## Manual checklist
- [ ] Theme mode supports `system/light/dark`
- [ ] System theme changes update UI when mode is `system`
- [ ] Light mode readability and hierarchy align with target palette
- [ ] Dark mode remains stable and legible
- [ ] Scheduler settings panel remains functionally identical
- [ ] Chart colors render correctly in both themes
- [ ] No primitive-level style divergence (single semantic contract)

## Runs (recorded)
- 2026-02-09: `pnpm -C /Volumes/DataDisk/Project/MyTrader/apps/frontend verify:theme` -> ✅
- 2026-02-09: `pnpm -C /Volumes/DataDisk/Project/MyTrader/apps/frontend typecheck` -> ✅
- 2026-02-09: `pnpm -C /Volumes/DataDisk/Project/MyTrader/apps/frontend build` -> ✅
- 2026-02-09: `pnpm typecheck` (cwd=`/Volumes/DataDisk/Project/MyTrader`) -> ✅ (includes `apps/frontend verify:theme`)
