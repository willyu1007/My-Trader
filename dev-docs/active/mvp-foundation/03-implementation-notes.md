# 03 Implementation Notes

## Status
- Current status: in_progress
- Last updated: 2026-01-14

## What changed
- Added Electron + React (Vite) scaffold for MVP foundation.
- Implemented account index store + account create/lock/unlock flow via IPC.
- Implemented per-account data directory layout and DB file initialization (SQLite business DB + placeholder DuckDB file).
- Updated MVP UI copy to Chinese-only (no i18n in MVP).
- Adjusted login UX: account input (with suggestions), login button label, and data-dir picker behavior.
- 按参考截图重做登录/创建账号界面（双分区、带图标输入框、分隔线与告警条），并在 `window.mytrader` 不可用时提供提示与安全降级。
- Added a dark, cyan-accent UI theme token set based on the reference dashboard screenshots.
- Fixed “选择数据目录”交互：对话框绑定到触发窗口并强制聚焦；按钮样式升级，并支持跟随系统浅色/深色主题自动切换。
- 进一步增强 macOS 下目录选择弹窗可见性：激活应用并将窗口置顶后再弹出系统对话框；前端在浏览器模式也会对点击给出明确提示，避免“看起来没反应”。
- 修复 `window.mytrader` 在 Electron 中缺失：preload 运行在 sandbox 环境时无法 `require("@mytrader/shared")`，改为通过 `tsup noExternal` 将 `@mytrader/shared` 打包进 preload/main，保证 preload 可正常注入。
- 新增 `ui_login.md` 作为登录/创建账号界面的 UI 规范，并对主题色/按钮样式/光晕效果做了进一步对齐。
- 对登录页排版做二次打磨：统一全局字体尺度，登录按钮/输入高度对齐，表单动作区按参考图右对齐到输入列，卡片宽度更接近 `max-w-3xl`。
- 增加 `pnpm start`：修复环境变量 `ELECTRON_RUN_AS_NODE=1` 导致 Electron 以 Node 模式启动的问题，并为 `@mytrader/shared` 统一为 CommonJS 输出以兼容 main/preload 的 `require`。
- Added business DB schema migration for portfolios, positions, and risk limits.
- Added market cache DB with daily price storage and ingestion helpers.
- Implemented portfolio snapshot (valuation, exposures, risk warnings) over latest market prices.
- Implemented CSV import for holdings and daily prices, plus Tushare daily ingestion.
- Added IPC APIs + frontend dashboard for portfolio/positions/risk/market workflows.
- Switched SQLite driver to `sql.js` (WASM) and added a build-time copy step for `sql-wasm.wasm`.

## Files/modules touched (high level)
- apps/backend/*
- apps/frontend/*
- packages/shared/*
- dev-docs/active/mvp-foundation/*
- package.json / tsconfig.json / pnpm-workspace.yaml

## Decisions & tradeoffs
- Decision: MVP UI is Chinese-only
  - Rationale: target users and workflow are Chinese-first; reduce i18n complexity in MVP.
  - Alternatives considered: add i18n framework and multi-language support.
- Decision: use `sql.js` as the SQLite driver in Electron main process
  - Rationale: avoid native build friction on Windows; keep the main process dependency pure JS with a predictable WASM asset.
  - Alternatives considered: `@vscode/sqlite3` (native binding), `better-sqlite3` (+ electron-rebuild), Node `node:sqlite` (runtime/version constraints).
- Decision: account-scoped business DBs + shared market cache
  - Rationale: strong isolation with minimal data duplication
  - Alternatives considered: single shared DB with account_id partitioning
- Decision: no DB encryption in MVP
  - Rationale: reduce complexity; password unlock only
  - Alternatives considered: SQLCipher or filesystem encryption
- Decision: curated ETF whitelist based on official list; include bond and precious-metals ETFs
  - Rationale: deterministic scope and easier coverage validation
  - Alternatives considered: fully automatic ETF discovery from providers
- Decision: CSV import includes holdings + daily prices + volume; no trade ledger in MVP
  - Rationale: supports valuation and risk without trade-level reconstruction
  - Alternatives considered: full trade-ledger import
- Decision: CSV columns are explicit and minimal
  - Holdings CSV: `symbol`, `name`, `asset_class`, `market`, `currency`, `quantity`, `cost`, `open_date`
  - Prices CSV: `symbol`, `trade_date`, `open`, `high`, `low`, `close`, `volume`
- Decision: risk exposure is derived from latest close prices
  - Rationale: deterministic valuation source and reproducible risk snapshots
  - Limit types: `position_weight`, `asset_class_weight`
- Decision: Tushare token loaded from `MYTRADER_TUSHARE_TOKEN` env var
  - Rationale: avoids storing secrets in repo; easy local override

## Deviations from plan
- None.

## Known issues / follow-ups
- Define the initial ETF whitelist (names/tickers) and map to official source fields.
- Add CSV templates/examples in docs for user onboarding.
- Manual smoke checks for portfolio/risk/market flows still pending.
- Confirm `sql-wasm.wasm` is copied to `apps/backend/dist/` and bundled with the Electron app.

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in `05-pitfalls.md` (append-only).
