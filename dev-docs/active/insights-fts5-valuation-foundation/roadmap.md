# Roadmap

## Objective
- 将“观点”从占位页升级为可运行模块：支持观点全生命周期、作用到所有可估值标的（不限个股）、并通过可扩展算子影响估值参数与展示结果。

## Milestones
1. Phase 0 - FTS5 验收与任务包就绪
   - 验证 FTS5 runtime 持续可用。
   - 将本任务目录升级为可实施文档包（overview/plan/architecture/verification/pitfalls）。
2. Phase 1 - 数据契约与 Schema 落地
   - 新增 insights / scope / channel / points / exclusions / materialized targets 表。
   - 新增 valuation methods / versions / snapshots 表。
   - 在 shared IPC 中补齐观点与估值方法契约。
3. Phase 2 - 后端服务能力
   - 落地观点 CRUD、FTS 搜索、scope 展开 materialization、时间插值与算子合并。
   - 落地 valuation method 管理（内置只读、克隆、自定义版本发布）。
   - 落地 valuation preview（当前值 vs 调整后值）与 symbol 侧 exclusion。
4. Phase 3 - 前端管理台与观点页
   - 替换 insights 占位页，提供观点创建/编辑/作用域/算子/时间点管理。
   - 在 other 新增“估值方法”管理 tab，支持方法查看、克隆、版本管理。
5. Phase 4 - 展示与验收
   - 在标的详情展示“当前值 vs 调整后值 + 已应用观点链路”。
   - 完成 typecheck/build 与关键场景验收清单。

## Scope and impact
- Backend:
  - `apps/backend/src/main/storage/businessSchema.ts`
  - `apps/backend/src/main/services/*`（新增 insight/valuation 服务）
  - `apps/backend/src/main/ipc/registerIpcHandlers.ts`
  - `apps/backend/src/preload/index.ts`
- Shared:
  - `packages/shared/src/ipc.ts`
- Frontend:
  - `apps/frontend/src/components/dashboard/views/*`
  - `apps/frontend/src/components/dashboard/constants.ts`
  - `apps/frontend/src/components/dashboard/types.ts`

## Rollback strategy
- 若观点模块改造引入回归：
  1. 保留 FTS5 runtime 变更不回退。
  2. 通过 feature 入口降级到 placeholder（insights/valuation-methods UI 可临时隐藏）。
  3. 新增业务表为独立增量，不改现有核心持仓/行情主表语义，可安全停用新 IPC handler。
