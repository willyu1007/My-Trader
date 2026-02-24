# 07 Completeness V2 Design

## Scope
- 将 `target-task` 升级为通用 completeness 框架，覆盖 `target_pool` 与 `source_pool`。
- 保持旧 API 可用，新增 completeness v2 API 并行输出。
- 本轮不强切 targets 执行口径，仍以 `stock/etf` 为主；`index/fx/macro` 先纳入供给完备性与可配置执行计划。

## Core Contracts
- Scope：
  - `target_pool`
  - `source_pool`
- Bucket：
  - `stock/etf/futures/spot/index/fx/macro/global`
- Entity：
  - `instrument/fx_pair/macro_module/global`
- Status：
  - `complete/partial/missing/not_applicable/not_started`

## Registry-Driven Architecture
- `datasetRegistry.ts`
  - 定义 dataset 粒度与可用信号来源（sqlite/duckdb）。
- `checkRegistry.ts`
  - 定义 check -> bucket/domain/module/entity 映射。
  - target/source 均由 registry 输出，避免前后端写死资产维度。
- `entityResolver.ts`
  - 按 scope + check 解析实体集合（target symbols / index symbols / fx pairs / macro modules）。
- `statusEvaluator.ts`
  - 统一硬规则状态判定。
  - freshness 本轮不作为阻断条件，仅留在 detail 可观测字段。

## Persistence Model
- `completeness_status_v2`
  - 主键：`(scope_id, check_id, entity_type, entity_id)`
  - 保存状态、覆盖率、as-of、来源 run、detail json。
- `completeness_runs_v2`
  - 记录 materialization 运行摘要与状态统计。
- `ingest_step_runs_v1`
  - 记录 ingest 标准 stage（`extract/normalize/upsert/evaluate`）观测数据。

## Execution Plan
- 统一解析器：`executionPlanResolver.ts`
- 规则：
  - `enabled(module) = DataSourceConfig.enabled(module) ∩ RolloutFlags.allowed(module)`
- 应用点：
  - managed orchestrator
  - targets/universe ingest runner
  - completeness source materialization detail（记录 rollout 是否放行）

## Compatibility Strategy
- 旧 API 保留：
  - `getTargetTaskMatrixConfig / setTargetTaskMatrixConfig`
  - `previewTargetTaskCoverage / listTargetTaskStatus / runTargetMaterialization`
- 兼容层实现：
  - 旧接口内部读写 completeness v2（adapter），返回 legacy 结构语义。
  - `targetTaskRepository` 双写 `target_task_*` 与 `completeness_*_v2`，保证迁移窗口稳定。

## Migration Strategy
- 启动时执行幂等 backfill：
  - `target_task_status -> completeness_status_v2`
  - `target_materialization_runs -> completeness_runs_v2`
- 写入 marker：
  - `market_meta.completeness_v2_backfill_v1 = 1`
- 不删除旧表，支持回滚与历史对账。

## UI Strategy
- 面板双区块：
  - A: `target_pool`（可编辑）
  - B: `source_pool`（只读，来源 Source Center）
- 资产列按配置展示：
  - source checks 根据 Source Center 开关过滤；
  - 启用但无数据显示 `not_started`。

## Out of Scope (This Iteration)
- 不做复杂阈值优化与动态权重评分。
- 不重写全部抓取逻辑，仅建立标准 stage 观测骨架与注册表挂载点。
