# 00 Overview

## Status
- State: in_progress
- Progress: shared/backend/frontend 主链路已落地；持续进行 UI 交互细化与可用性优化。
- Next step: 继续 UI 细节验收（折叠交互、按钮文案、运行时兼容提示）并整理 handoff。

## Goal
实现数据来源中心 V2：全量目录配置、主/域令牌、模块测试、统一 readiness 门禁、兼容旧接口。

## Non-goals
- 非 tushare provider 的真实抓取实现
- 未接入模块的数据采集实现
- 主题系统或非数据来源页面的视觉改造

## Scope
- `packages/shared/src/ipc.ts`
- `apps/backend/src/main/**`（storage/market/ipc/preload）
- `apps/frontend/src/components/dashboard/**`（data-management 相关）
