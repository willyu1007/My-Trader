# 02 Architecture

## Context & current state
- `main` 已收口 rollout，并修复 ingest 稳定性问题（DuckDB 运行时、stale running 收敛、分页/批处理降级策略）。
- `pr1` 包含两类核心改动：
  - 业务能力增量：Source Center V2、token matrix、target/universe task matrix。
  - 结构性重构：Dashboard 模块化拆分。
- 两类改动耦合在部分重叠文件中，必须解耦迁移。

## Proposed design

### Components / modules
- Baseline Guard Layer
  - 固化不可回退行为与静态守卫命令。
- Contract Layer
  - `packages/shared` 与 preload 的新旧 API 共存。
- Backend Capability Layer
  - Source Center V2 + target/universe 双池能力。
- Frontend Feature Layer
  - 先迁移 Source Center V2 交互，再迁移 Dashboard 模块化结构。

### Interfaces & contracts
- API endpoints:
  - IPC market channels：新增 V2 channel，保留 rollout flags/旧 token channel。
- Data models / schemas:
  - `market_settings` 新 key 追加，不删除既有 key。
  - `market-cache` 新表追加，不删除 fx/macro 既有结构。
- Events / jobs (if any):
  - orchestrator 维持现有 run 收敛与控制流语义；新增 readiness/preflight 元信息。

### Boundaries & dependency rules
- Allowed dependencies:
  - 新增能力可依赖现有 orchestrator/ingest 基础设施。
- Forbidden dependencies:
  - 不允许新能力通过删除 `main` 现有稳定逻辑来“换取简化”。
  - 不允许 Dashboard 模块化成为 Source Center V2 上线前置。

## Data migration (if applicable)
- Migration steps:
  - 按 PR 批次追加 schema/key，避免破坏式迁移。
- Backward compatibility strategy:
  - 迁移期维持新旧 IPC/API 并存。
- Rollout plan:
  - 功能增量先于结构重构；结构重构完成直接切换并进行 1 个交易日观察。

## Non-functional considerations
- Security/auth/permissions:
  - token 仅走既有安全存储链路，日志不输出明文。
- Performance:
  - 保持 main 现有批处理与降级策略，不扩大单 run 内存压力。
- Observability (logs/metrics/traces):
  - `ingest_runs` 与 phase gate snapshot 持续作为主观测面。

## Open questions
- None.
