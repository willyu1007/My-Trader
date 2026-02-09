# 03 Implementation Notes

## Status
- Current status: completed
- Last updated: 2026-02-09

## Notes (append-only)
- 2026-02-09：创建任务包 `dev-docs/active/light-theme-adaptation/`，进入主题运行时统一与 token 收敛实施阶段。
- 2026-02-09：新增 `apps/frontend/src/theme/theme-mode.ts`，统一 `system/light/dark` 主题运行时，支持旧键 `theme` 迁移到 `mytrader:ui:theme-mode`。
- 2026-02-09：`apps/frontend/index.html` 改为最小首屏主题注入（`data-theme` + `dark` class），移除 `body` 固定 `dark` class。
- 2026-02-09：`apps/frontend/src/theme.css` 重构为双主题 token（light/dark），新增图表与状态语义 token（`--mt-chart-*`、`--mt-tone-*`、`--mt-state-*`）。
- 2026-02-09：`apps/frontend/src/styles.css` 移除 `prefers-color-scheme` 媒体查询，改为 `data-theme` 机制，并新增 `ui-*` 语义原语类。
- 2026-02-09：`apps/frontend/src/App.tsx` 顶栏新增三态主题切换（跟随系统/浅色/深色）；登录表单、按钮、告警条改为语义样式类。
- 2026-02-09：`apps/frontend/src/components/Dashboard.tsx` 原语组件（Modal/FormGroup/Input/Select/PopoverSelect/Button/IconButton/Badge）改为语义类；调度高级设置区增加 `scheduler-*` 视觉类；图表和状态色改为 token 语义。
- 2026-02-09：新增 `apps/frontend/scripts/verify-theme-contract.mjs` 并在 `apps/frontend/package.json` 注入 `verify:theme`，根 `package.json` 的 `typecheck` 已串联前端主题契约校验。
- 2026-02-09：更新 `apps/frontend/README.md`，补充主题模式、契约和验证命令。
