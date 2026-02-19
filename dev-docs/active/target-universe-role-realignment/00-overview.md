# 00 Overview

## Status
- State: in_progress
- Progress: M1-M4 首轮代码已落地：新 bucket、target task matrix IPC、SSOT-first 物化、Universe futures/spot 扩展表与抓取逻辑已接入，三端 typecheck 通过。
- Next step: 补充端到端 smoke（真实 token 下跑一轮 universe+targets），并完善前端 target task 覆盖展示与告警指标。

## Goal
落地 Target/Universe 双池重构：Universe 作为 SSOT+分析层，Target 作为按资产类型区分的任务执行层，并移除旧 `precious_metal` 兼容。

## Non-goals
- 分钟级/实时数据
- 自动交易执行
- 多 provider 真正联动（v1 仍以 tushare 主导）

## Scope
- packages/shared IPC 契约与类型
- apps/backend ingest + storage + data source catalog
- apps/frontend 数据管理与全量池配置 UI
- dev-docs 任务文档与验证记录

## DoD
- [x] `precious_metal` 从类型与配置路径移除
- [x] 新增 target task matrix 配置/状态/预览/触发 IPC
- [x] Target ingest 改为 SSOT-first 主路径
- [x] 新增 DuckDB 与 market-cache 所需表结构
- [x] 三端 typecheck 通过
