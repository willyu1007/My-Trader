# 01 Plan

## Phase 1 - Shared 契约
- 新增 V2 数据来源类型、目录、测试、readiness DTO
- 新增 IPC 通道与 `MyTraderApi.market` 方法
- 保留旧 token/universe pool 接口兼容

## Phase 2 - Backend 能力层
- 新增 `dataSourceCatalog.ts` 作为目录 SSOT
- 新增配置/测试/readiness 服务
- 升级 token 存储与解析优先级
- 增加 v1 -> v2 迁移逻辑

## Phase 3 - IPC & Orchestration
- 注册新 IPC handlers
- 手动拉取/调度前增加 readiness 校验
- 运行元信息增加 selectedDomains/selectedModules 等

## Phase 4 - Frontend 数据来源中心
- 数据来源页三栏重构
- 一级域与二级模块全量展示
- 域/模块测试与纳入同步门禁
- 保存/执行前阻断提示

## Phase 5 - 验证
- `pnpm -C packages/shared build`
- `pnpm -C apps/backend typecheck`
- `pnpm -C apps/frontend typecheck`
- 关键兼容与迁移场景验证
