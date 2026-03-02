# 04-verification

## Planned checks
- `pnpm -C apps/frontend typecheck`
- `pnpm -C apps/backend typecheck`
- `pnpm typecheck`

## Results
- `pnpm -C apps/backend typecheck` -> pass
- `pnpm -C apps/frontend typecheck` -> pass
- `pnpm typecheck` -> pass（含 `packages/shared build` 与 `apps/frontend verify:theme`）
- `pnpm run dev:run-action:stop` -> pass（停止既有后台 dev 进程）
- `pnpm run dev:run-action` -> pass（后台拉起新 dev 进程，pid 写入 `.mytrader-dev.pid`）
- `pnpm run dev:run-action:status` -> pass（确认进程存活）
- `rg -n "preload 已注入 window\\.mytrader" .mytrader-dev.log` -> pass（最新日志出现 preload 注入记录）
- `pnpm -C apps/backend typecheck` -> pass（新增 `MARKET_TEST_DATA_STATUS_GET` 与状态聚合实现后复验）
- `pnpm -C apps/frontend typecheck` -> pass（列表化 UI + 右侧状态展示改造后复验）
- `pnpm typecheck` -> pass（全仓复验）

## Notes
- Browser MCP 连接的是普通浏览器页（`http://localhost:5174`），不会注入 Electron preload；因此无法直接在 MCP 页面调用 `window.mytrader.*`。
- 针对该限制，已按 fallback 使用 run-action 启停 + 日志探针完成本轮验证。
