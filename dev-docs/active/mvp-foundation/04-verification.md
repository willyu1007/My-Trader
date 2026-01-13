# 04 Verification

## Automated checks
- `pnpm typecheck` -> expect exit 0 once scaffolding and TS config are in place
- `pnpm test` -> expect exit 0 once unit tests are added
- `pnpm build` -> MUST produce `apps/backend/dist/sql-wasm.wasm` for sql.js

## Runs (recorded)
- 2026-01-12: `pnpm typecheck` -> exit 0
- 2026-01-12: `pnpm build` -> exit 0
- 2026-01-12: `pnpm typecheck && pnpm build` -> exit 0 (登录 UI/目录选择交互调整)
- 2026-01-12: `pnpm typecheck && pnpm build` -> exit 0 (主题样式与全中文文案)
- 2026-01-12: `pnpm typecheck && pnpm build` -> exit 0（目录选择修复 + 跟随系统主题）
- 2026-01-12: `pnpm start` -> 可正常拉起 Electron（手动退出）
- 2026-01-12: `pnpm typecheck` -> exit 0（登录页重构 + `window.mytrader` 缺失降级）
- 2026-01-12: `pnpm build` -> exit 0（登录页重构 + `window.mytrader` 缺失降级）
- 2026-01-12: `pnpm typecheck` -> exit 0（目录选择弹窗聚焦增强 + 前端交互提示优化）
- 2026-01-12: `pnpm build` -> exit 0（目录选择弹窗聚焦增强 + 前端交互提示优化）
- 2026-01-12: `pnpm typecheck` -> exit 0（顶部栏品牌标识样式对齐）
- 2026-01-12: `pnpm build` -> exit 0（顶部栏品牌标识样式对齐）
- 2026-01-12: `pnpm typecheck` -> exit 0（目录选择 IPC 增加 dev 日志）
- 2026-01-12: `pnpm build` -> exit 0（目录选择 IPC 增加 dev 日志）
- 2026-01-13: `pnpm -C apps/backend start` -> preload 注入日志出现（验证 preload 已加载）
- 2026-01-13: `pnpm typecheck && pnpm build` -> exit 0（preload 打包 `@mytrader/shared` 修复注入）
- 2026-01-13: `pnpm typecheck && pnpm build` -> exit 0（登录页样式对齐 + 新增 `ui_login.md` 规范）
- 2026-01-13: `pnpm typecheck && pnpm build` -> exit 0（登录页排版/字体比例优化）
- 2026-01-14: (skipped) rerun `pnpm typecheck && pnpm build` after sql.js migration; no fresh output recorded yet

## Manual functional test checklist (Milestones 1-3)
### Milestone 1 - Account & storage
- [ ] Create account with custom data directory -> expect account entry stored + per-account directory created with `business.sqlite` and `analysis.duckdb`
- [ ] Lock account -> expect active account cleared and DB connections closed
- [ ] Unlock account -> expect account restored and per-account DBs opened
- [ ] Switch between two accounts -> expect isolated data directories and no cross-account reads

### Milestone 2 - Portfolio/position/risk
- [ ] Create portfolio -> expect portfolio listed and selectable
- [ ] Rename portfolio -> expect list and snapshot updated
- [ ] Delete portfolio -> expect portfolio removed and positions/limits cleaned up
- [ ] Add position -> expect valuation row and exposure weight visible
- [ ] Edit/delete position -> expect snapshot updates and totals recomputed
- [ ] Add risk limit (position weight / asset class weight) -> expect warning when threshold breached

### Milestone 3 - Market data ingestion
- [ ] Import holdings CSV -> expect positions created/updated and warnings reported for invalid rows
- [ ] Import prices CSV -> expect latest prices applied in valuation snapshot
- [ ] Ingest Tushare daily data (token set) -> expect latest prices and `priceAsOf` updated

CSV columns (MVP):
- Holdings: `symbol`, `name`, `asset_class`, `market`, `currency`, `quantity`, `cost`, `open_date`
- Prices: `symbol`, `trade_date`, `open`, `high`, `low`, `close`, `volume`

## Manual functional test runs (recorded)
- 2026-01-14: Milestone 1-3 UI tests -> pending rerun after sql.js migration

## Rollout / Backout (if applicable)
- Rollout: local desktop app update only; no server deploy
- Backout: remove account data directories and shared cache if corruption occurs
