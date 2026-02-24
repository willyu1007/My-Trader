# Dashboard PR1 -> main Integration — Roadmap

## Goal
- 将 `codex/dashboard-modularization-pr1` 的核心成果（数据来源中心 V2 + 主/子 token 矩阵 + Dashboard 模块化）安全落入 `main`，且不回退 `main` 已完成的 rollout 收口与稳定性修复。

## Non-goals
- 不做一次性“大合并”（禁止直接将 `pr1` 整分支 merge 到 `main`）。
- 不在同一批次同时引入“后端行为变化 + 前端结构重构”。
- 不在未通过门禁前删除兼容接口（rollout flags、旧 token API）。

## Open questions and assumptions
### Open questions (answer before execution)
- None.

### Assumptions (if unanswered)
- A1: 采用“主干优先 + 分批移植”，不做 `main <- pr1` 直接 merge（risk: low）。
- A2: 本次任务完成后 Dashboard 直接完成模块化，不采用双轨切换（risk: medium）。
- A3: `pr1` 中新增内容按“全部迁移合并”执行（risk: low）。
- A4: 稳定观察窗采用 1 个交易日（risk: medium）。
- A5: rollout flags 的后端兼容接口在本轮保留，前端继续不暴露业务入口（risk: low）。
- A6: DuckDB 运行时保持 `main` 基线（`@duckdb/duckdb-wasm`），本轮不切换到 `@duckdb/node-api`（risk: low）。
- A7: 迁移策略采用“代码全部迁移，文档状态不回退”（risk: low）。

## Scope and impact
- Affected areas/modules:
  - `packages/shared/src/ipc.ts`
  - `apps/backend/src/main/market/**`
  - `apps/backend/src/main/storage/**`
  - `apps/backend/src/main/ipc/registerIpcHandlers.ts`
  - `apps/backend/src/preload/index.ts`
  - `apps/frontend/src/components/Dashboard.tsx`
  - `apps/frontend/src/components/dashboard/**`
- External interfaces/APIs:
  - Electron preload `window.mytrader.market.*`
  - IPC channels（market ingest/source center/target task）
- Data/storage impact:
  - `business.sqlite.market_settings` 新键
  - `market-cache.sqlite` 新表/新索引
  - `analysis.duckdb` 读写路径（必须保持 main 当前稳定策略）
- Backward compatibility:
  - 必须保留 rollout flags 读取/写入兼容链路
  - 必须保留旧 token API，新增 V2 API 与其并存

## Milestones
1. **Milestone 1**: 建立合并基线与防回退门禁
   - Deliverable: `main` 稳定性成果被固化为“不可回退清单”并自动检查
   - Acceptance criteria: 能自动发现 DuckDB/runtime/rollout/IPC 回退
2. **Milestone 2**: 合入数据来源中心 V2（后端优先）
   - Deliverable: Source Center V2 与 token matrix 在 backend/shared/preload 生效，旧接口仍可用
   - Acceptance criteria: 新旧 API 均可调用，类型检查和构建通过
3. **Milestone 3**: 合入双池与任务矩阵能力
   - Deliverable: target/universe SSOT-first + task matrix 落地，并与 main 稳定修复共存
   - Acceptance criteria: ingest 控制链路（manual/schedule/startup/pause/resume/cancel）回归通过
4. **Milestone 4**: 合入前端 Source Center V2（不切 Dashboard 架构）
   - Deliverable: Other/Data Management 的新能力可用
   - Acceptance criteria: 业务路径可用且不影响现有 Dashboard 主流程
5. **Milestone 5**: Dashboard 模块化分阶段切换
   - Deliverable: modular 目录接入并直接切换为主实现（无双轨）
   - Acceptance criteria: 关键 smoke 全通过，无稳定性指标回退

## Step-by-step plan (phased)
> 每个阶段单独 PR，单独验证，单独可回滚。

### Phase 0 — Baseline Freeze & Guardrails
- Objective: 固化 `main` 现有稳定成果，避免后续移植时被覆盖。
- Deliverables:
  - 建立“不可回退清单”：
    - `@duckdb/duckdb-wasm` 依赖链与 `paths.ts` 保护逻辑
    - stale running run 收敛逻辑
    - rollout flags IPC + repository 兼容
    - `phase-r2:gate-snapshot` 脚本
    - `providers/types.ts` 中 `index/forex` 能力
    - `marketCache.ts` 中 fx/macro 相关表结构
  - 增加静态守卫命令（PR checklist 固化）
- Verification:
  - `pnpm typecheck`
  - `pnpm build`
  - 静态守卫 `rg` 检查全部命中
- Rollback:
  - 无功能变更，仅回退守卫脚本/文档

### Phase 1 — Shared/Preload Contract (Additive Only)
- Objective: 先扩协议，不改核心运行路径。
- Deliverables:
  - 追加 V2 source/token matrix/target-task IPC 类型与 channel
  - 保留 rollout flags channel 与旧 market token API
  - preload 同时暴露旧 API + 新 API
- Verification:
  - `pnpm -C packages/shared build`
  - `pnpm -C apps/backend typecheck`
  - `pnpm -C apps/frontend typecheck`
- Rollback:
  - 整个 PR revert，不影响 DB 与运行态

### Phase 2 — Backend Source Center V2 Wiring
- Objective: 在 backend 合入 V2 服务与 handlers，不触碰 Dashboard 模块化。
- Deliverables:
  - 合入 `dataSourceCatalog/readiness/connectivity/preflight` 与 repository
  - 注册 IPC handlers（新能力）
  - ingest 前置校验接入，但保持 main 现有稳定修复逻辑
- Verification:
  - backend typecheck + dev smoke
  - 无 token / 错 token / 正常 token 三场景手工验证
- Rollback:
  - revert 本批 PR，恢复旧 ingest 前置行为

### Phase 3 — Target/Universe Dual-Pool Integration
- Objective: 合入 SSOT-first 与 task matrix，同时保留 main 收口成果。
- Deliverables:
  - 合入 target task repository/materialization/matrix
  - schema 变更仅追加，不删除 main 既有表/列
  - orchestrator & ingest runner 做“并集整合”（不是文件覆盖）
- Verification:
  - ingest 控制链路 smoke：manual/schedule/startup/pause/resume/cancel
  - `ingest_runs` 对账 + stale running=0
  - `phase-r2:gate-snapshot` 回归
- Rollback:
  - PR revert + 保留 migration 向后兼容读取

### Phase 4 — Frontend Source Center V2 (On Current Dashboard Runtime)
- Objective: 先把用户功能合入，再处理代码结构重构。
- Deliverables:
  - 迁移 Other/Data Management 的 V2 面板能力
  - 保持现有 Dashboard 入口与主流程稳定
- Verification:
  - `pnpm -C apps/frontend typecheck`
  - `pnpm -C apps/frontend build`
  - 手工 smoke：token matrix/连通性测试/readiness 提示
- Rollback:
  - 前端 PR 可整包 revert

### Phase 5 — Dashboard Modularization Cutover
- Objective: 将结构性重构风险与业务功能风险解耦。
- Deliverables:
  - 引入 `apps/frontend/src/components/dashboard/**`
  - 保持 `Dashboard` 对外 API 不变
  - 直接完成 `Dashboard` 模块化切换（无 legacy/modular 双轨）
- Verification:
  - 构建/类型检查
  - 核心 smoke：导航、Portfolio、Analysis、Market、Other、Lock
  - 对比关键路径行为一致性
- Rollback:
  - 通过 PR 级别快速 revert 回退本阶段改动

### Phase 6 — Post-cutover Stabilization
- Objective: 完成切换后的稳定观察与收尾清理。
- Deliverables:
  - 完成 1 个交易日稳定观察
  - 清理迁移过程中产生的临时桥接/过渡代码
- Verification:
  - 连续稳定观察窗（1 个交易日）
  - 无关键指标回退
- Rollback:
  - 通过 PR 级别 revert 执行回退

## Verification and acceptance criteria
- Build/typecheck:
  - `pnpm -C packages/shared build`
  - `pnpm -C apps/backend typecheck`
  - `pnpm -C apps/frontend typecheck`
  - `pnpm typecheck`
  - `pnpm build`
- Automated/static guards:
  - `rg -n "@duckdb/duckdb-wasm" apps/backend/package.json`
  - `rg -n "MARKET_ROLLOUT_FLAGS_GET|MARKET_ROLLOUT_FLAGS_SET" packages/shared/src/ipc.ts apps/backend/src/preload/index.ts apps/backend/src/main/ipc/registerIpcHandlers.ts`
  - `rg -n "converged stale running ingest runs" apps/backend/src/main/market/ingestOrchestrator.ts`
  - `rg -n "\"index\"|\"forex\"" apps/backend/src/main/market/providers/types.ts`
- Manual checks:
  - 无 token / 错 token / 正常 token ingest 行为符合预期
  - scheduler + startup + manual + pause/resume/cancel 全链路
  - Source Center V2 交互与 readiness 阻断可解释
  - Dashboard 关键路径 smoke 无行为回退
- Acceptance criteria:
  - `main` 现有 rollout 收口与稳定修复关键行为全部保留
  - Source Center V2 与 token matrix 可用
  - Dashboard 模块化完成并稳定通过观察窗

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|---:|---:|---|---|---|
| 直接 merge 导致 main 稳定修复被覆盖 | high | high | 禁止整分支直合；只走分批移植 | overlap 文件 diff 守卫 | 单批 PR revert |
| DuckDB runtime 回退（wasm/node-api 冲突） | high | high | 以 main 为准保留 wasm 链路；仅移植与之兼容代码 | 启动 ingest smoke + 守卫检查 | 回退当批并恢复主干实现 |
| rollout flags 兼容链路被删 | medium | high | IPC/preload/repository 保留旧接口 | 静态 `rg` + 手工 API 调用 | 回退协议/handler PR |
| Dashboard 模块化引发 UI 行为回归 | high | medium | 分阶段提交 + 切换前后全量 smoke + 1 交易日观察 | 核心 smoke + 用户路径抽查 | 回退切换 PR |
| 目标池/全量池语义整合破坏 ingest 对账 | medium | high | 先后端后前端，逐批校验 ingest_runs 对账 | run 对账 SQL + gate snapshot | 回退双池整合 PR |

## Optional detailed documentation layout (convention)
```
dev-docs/active/dashboard-pr1-main-integration/
  roadmap.md
  00-overview.md
  01-plan.md
  02-architecture.md
  03-implementation-notes.md
  04-verification.md
  05-pitfalls.md
```

## To-dos
- [x] 确认不采用双轨切换
- [x] 确认全部迁移合并
- [x] 确认 1 个交易日观察窗口
- [ ] 按 phase 拆分实际 PR 队列

## 2026-02-23 Completeness V2 Expansion
- Phase 1（contracts + IPC channels）: ✅ 完成
- Phase 2（market-cache schema + backfill + repository）: ✅ 完成
- Phase 3（registry + completeness service + target adapter）: ✅ 完成
- Phase 4（execution plan resolver 接入 orchestrator/runner）: ✅ 完成
- Phase 5（前端 completeness 双区块面板）: ✅ 完成
- Phase 6（verify script + 回归 + 文档）: ✅ 完成
