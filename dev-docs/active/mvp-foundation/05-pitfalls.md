# 05 Pitfalls (do not repeat)

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)
- Never store API tokens or secrets in the repo; use local config or OS keychain.
- Always close previous account DB connections before opening another account.

## Pitfall log (append-only)

### 2026-01-12 - Native SQLite driver install/rebuild friction
- Symptom: `pnpm install` failed during `better-sqlite3` install with node-gyp fetching headers (`ECONNRESET`), and the setup would also require careful Node/Electron ABI alignment for Electron runtime.
- Root cause: `better-sqlite3` is a native addon; under some Node versions it may lack prebuilt binaries and needs node headers + build toolchain; Electron adds an additional ABI dimension.
- What was tried: installing with Node 24.x (triggered node-gyp + header download).
- Fix/workaround: switched to `@vscode/sqlite3` and wrapped the callback API with small Promise helpers for consistent async usage in IPC handlers.
- Prevention: prefer Electron-friendly SQLite drivers early (or pin Node/Electron toolchain and document `electron-rebuild`), and verify with `pnpm typecheck` + `pnpm build` from a clean tree.

### 2026-01-12 - `pnpm start` 下 Electron 运行成 Node 模式
- Symptom: `pnpm start` 运行后报错 `require("electron").app` 为 `undefined`（`whenReady` 读取失败），导致应用无法启动。
- Root cause: 环境变量 `ELECTRON_RUN_AS_NODE=1` 使 Electron 以 Node 模式启动，`require("electron")` 解析为 npm 包（返回 Electron 可执行文件路径字符串）而不是 Electron 内置 API。
- What was tried: 直接 `pnpm exec electron .` / `electron dist/main.js`（仍然失败）。
- Fix/workaround: 启动脚本显式移除 `ELECTRON_RUN_AS_NODE` 后再 spawn Electron（`apps/backend/scripts/start.mjs`、`apps/backend/scripts/dev.mjs`）。
- Prevention: 启动 Electron App 时确保未携带 `ELECTRON_RUN_AS_NODE`；遇到 `require('electron')` 返回路径字符串时优先检查该环境变量。

### 2026-01-12 - 浏览器运行前端导致 `window.mytrader` 缺失
- Symptom: 登录/创建账号/数据目录选择无响应，页面出现报错 `Cannot read properties of undefined (reading 'account')`。
- Root cause: `window.mytrader` 由 Electron preload 注入，仅在桌面端渲染进程中存在；在浏览器直接打开 Vite 页面时该 API 不存在。
- What was tried: 在浏览器里重复点击“选择…”和登录相关按钮（均无法触发系统对话框）。
- Fix/workaround: 前端对 `window.mytrader` 缺失做 guard，提供明确提示并禁用相关交互，避免抛出运行时异常。
- Prevention: 需要真实功能时用 `pnpm dev`/`pnpm start` 启动桌面端；如需浏览器预览，确保 UI 具备可解释的降级提示。

### 2026-01-13 - Electron sandbox 下 preload 无法加载 workspace 依赖
- Symptom: 在 Electron 窗口内仍提示“未检测到桌面端后端（preload API）”，并在主进程看到 `preload-error`：`module not found: @mytrader/shared`。
- Root cause: preload 在 sandbox 环境中运行时，`require` 受到限制，无法从 `node_modules` 解析 workspace 依赖（如 `@mytrader/shared`），导致 `contextBridge.exposeInMainWorld` 未执行。
- What was tried: 反复 `pnpm start`，前端始终拿不到 `window.mytrader`。
- Fix/workaround: 在 `apps/backend/tsup.config.ts` 增加 `noExternal: ["@mytrader/shared"]`，将共享常量打包进 preload/main，避免运行时 `require("@mytrader/shared")`。
- Prevention: preload 尽量只依赖 `electron` 内置能力；如必须用共享常量，确保打包进 preload（或在 preload 内内联常量）。

### 2026-01-14 - sql.js WASM asset missing at runtime
- Symptom: sql.js initialization fails because `sql-wasm.wasm` cannot be found.
- Root cause: tsup bundles JS but does not copy the WASM asset into `apps/backend/dist/`.
- What was tried: running the app after `pnpm build` without copying the WASM file.
- Fix/workaround: add `scripts/copy-sql-wasm.mjs` and run it via `tsup` `onSuccess` to copy `sql-wasm.wasm` into `dist/`; configure `locateFile` to point at the copied asset.
- Prevention: verify `apps/backend/dist/sql-wasm.wasm` exists after build and before packaging.
