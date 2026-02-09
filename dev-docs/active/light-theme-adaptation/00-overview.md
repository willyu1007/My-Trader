# 00 Overview

## Goal
在不拆分页面与组件的前提下，为 MyTrader 前端建立可切换的浅色/深色主题体系（system/light/dark），并将颜色维护收敛到单一语义 token 契约。

## Non-goals
- 不改后端 IPC、数据库与业务流程
- 不新建第二套页面组件
- 不做设计语言重构（保留现有 warm dark 风格）

## Scope
- `apps/frontend/index.html`
- `apps/frontend/src/theme.css`
- `apps/frontend/src/styles.css`
- `apps/frontend/src/main.tsx`
- `apps/frontend/src/App.tsx`
- `apps/frontend/src/components/Dashboard.tsx`
- `apps/frontend/scripts/verify-theme-contract.mjs`
- `apps/frontend/package.json`
- `package.json`
- `apps/frontend/README.md`

## Status
- Current status: in_progress
- Last updated: 2026-02-09

## Success criteria
- 主题模式支持 `system/light/dark`
- 浅色与深色均可用，且页面结构单套维护
- 图表与状态色改为语义 token
- 增加主题契约校验脚本并通过
- `pnpm -C apps/frontend typecheck` 与 `pnpm -C apps/frontend build` 通过
