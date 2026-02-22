# 03 Implementation Notes

## Status
- Current status: `in-progress`
- Last updated: 2026-02-22

## What changed
- 新建任务包并完成宏观 roadmap 与分批合并策略。
- 明确禁止整分支直合，采用“main 基线 + pr1 能力移植”的分批并集方案。
- 根据用户确认更新策略：不走 Dashboard 双轨、全部迁移合并、观察窗为 1 个交易日。
- 根据用户确认关闭 open questions：DuckDB 保持 `main` 基线；文档迁移采用“状态不回退”规则。
- Phase 0 已落地：
  - 新增基线守卫脚本：`scripts/verify-pr1-integration-guardrails.mjs`
  - 根脚本入口：`package.json` 增加 `verify:pr1-guardrails`
- Phase 1（低风险协议追加）已启动并落地第一批：
  - `packages/shared/src/ipc.ts` 追加 Source Center V2 / token matrix / readiness / preflight / universe pool / target task matrix 类型与 IPC channels（保留 rollout 兼容接口）
  - `apps/backend/src/preload/index.ts` 追加对应 market API 暴露（仅追加，不删除旧接口）
- Phase 2 已落地（backend Source Center V2）：
  - 新增文件：
    - `apps/backend/src/main/market/dataSourceCatalog.ts`
    - `apps/backend/src/main/market/connectivityTestService.ts`
    - `apps/backend/src/main/market/dataSourceReadinessService.ts`
    - `apps/backend/src/main/market/ingestPreflightService.ts`
    - `apps/backend/src/main/storage/marketDataSourceRepository.ts`
  - `apps/backend/src/main/storage/marketTokenRepository.ts` 升级为 main/domain token 矩阵，并保留 `getResolvedTushareToken/setTushareToken` 兼容入口
  - `apps/backend/src/main/ipc/registerIpcHandlers.ts` 新增 Source Center V2 handlers（catalog/config/token matrix/connectivity/preflight/readiness），并保留 rollout handlers
- Phase 3（low-risk 子步）已落地：
  - 新增文件：
    - `apps/backend/src/main/market/universePoolBuckets.ts`
    - `apps/backend/src/main/market/targetTaskMatrixService.ts`
    - `apps/backend/src/main/market/targetTaskRepository.ts`
    - `apps/backend/src/main/market/targetMaterializationService.ts`
  - 增量 schema：
    - `apps/backend/src/main/market/marketCache.ts` 新增 `target_task_status` / `target_materialization_runs`（保留 `main` 的 fx/macro/ingest_runs 结构）
  - settings 并集：
    - `apps/backend/src/main/storage/marketSettingsRepository.ts` 追加 target-task matrix 配置与 universe pool 运行状态（不移除 rollout flags）
  - IPC 并集：
    - `apps/backend/src/main/ipc/registerIpcHandlers.ts` 追加 universe pool / target-task matrix / materialization handlers，并使用 data-source 配置桥接 legacy universe API
  - DuckDB 基线兼容：
    - `apps/backend/src/main/storage/analysisDuckdb.ts` 仅追加 `AnalysisDuckdbConnection` 类型别名导出（运行时保持 `main` 的 `@duckdb/duckdb-wasm`）
    - `targetMaterializationService.ts` 通过 `information_schema` 探测可选扩展表，避免要求 `main` 基线必须存在 `futures_daily_ext` / `spot_sge_daily_ext`
  - shared/frontend 兼容补丁：
    - `packages/shared/src/ipc.ts` 扩展 `AssetClass` 到 `stock|etf|futures|spot|cash`
    - `apps/frontend/src/components/Dashboard.tsx` 补全 `assetClassLabels` 映射
- Phase 3（high-risk 子步）已落地第一批（runner/provider 并集）：
  - `apps/backend/src/main/market/providers/tushareProvider.ts`
    - futures/spot 产出 `assetClass`
    - 自动追加 universe pool tags（`pool:cn_a|etf|metal_futures|metal_spot`）
  - `apps/backend/src/main/market/marketIngestRunner.ts`
    - Universe ingest 接入 data source config -> legacy buckets
    - 按 selected buckets + profile tags 过滤 stock/etf/futures/spot universe
    - ingest run meta 增加 `selectedBuckets` / `bucketCounts`
    - 执行后回写 `updateMarketUniversePoolBucketStates`
  - 兼容策略：
    - 保留 `main` 的 index/forex/macro/recovery/stale-run 稳定路径，只在 bucket 相关路径做增量并集
- Phase 3（high-risk 子步）已落地第二批（orchestrator -> targets materialization 主流程）：
  - `apps/backend/src/main/market/ingestOrchestrator.ts`
    - targets 任务执行时传入 `analysisDbPath`
  - `apps/backend/src/main/market/marketIngestRunner.ts`
    - targets ingest 完成后自动执行 `materializeTargetsFromSsot`
    - materialization 结果写入 ingest run meta（`targetMaterialization`）
    - materialization 失败按非致命处理并记录错误（run 状态会反映为 partial）
- Phase 5 已落地（Dashboard 模块化直接切换，非双轨）：
  - `apps/frontend/src/components/Dashboard.tsx` 切换为模块入口转发（不再使用单体文件）
  - 新增模块化目录 `apps/frontend/src/components/dashboard/*`（views/hooks/primitives/components）
  - `apps/frontend/scripts/verify-theme-contract.mjs` 兼容模块化入口校验
  - `apps/frontend/src/components/dashboard/views/other/data-management/OtherDataManagementSourceSection.tsx` 清理颜色字面量以满足主题契约
- Phase 6（今日收口）已落地：
  - `scripts/verify-pr1-integration-guardrails.mjs` 增强为“今日闭环门禁”，新增检查：
    - Dashboard 模块化单路径（非双轨）入口与关键目录存在
    - targets materialization 已接入托管 ingest 主流程
    - dual-pool 过滤链路（provider 标签 + runner bucket 执行 + pool 状态回写）完整
  - 说明：用户于 2026-02-22 明确接受“可使用历史数据完成工程闭环”；据此执行历史窗口 gate snapshot 验收并完成任务收口。
  - 历史验收证据：
    - `dev-docs/active/dashboard-pr1-main-integration/evidence/2026-02-22-history-gate-snapshot.json`

## Files/modules touched (high level)
- `dev-docs/active/dashboard-pr1-main-integration/*`
- `scripts/verify-pr1-integration-guardrails.mjs`
- `package.json`
- `packages/shared/src/ipc.ts`
- `apps/backend/src/preload/index.ts`
- `apps/backend/src/main/ipc/registerIpcHandlers.ts`
- `apps/backend/src/main/storage/marketTokenRepository.ts`
- `apps/backend/src/main/storage/marketDataSourceRepository.ts`
- `apps/backend/src/main/market/dataSourceCatalog.ts`
- `apps/backend/src/main/market/connectivityTestService.ts`
- `apps/backend/src/main/market/dataSourceReadinessService.ts`
- `apps/backend/src/main/market/ingestPreflightService.ts`
- `apps/backend/src/main/market/universePoolBuckets.ts`
- `apps/backend/src/main/market/targetTaskMatrixService.ts`
- `apps/backend/src/main/market/targetTaskRepository.ts`
- `apps/backend/src/main/market/targetMaterializationService.ts`
- `apps/backend/src/main/market/marketCache.ts`
- `apps/backend/src/main/market/marketIngestRunner.ts`
- `apps/backend/src/main/market/ingestOrchestrator.ts`
- `apps/backend/src/main/market/providers/tushareProvider.ts`
- `apps/backend/src/main/storage/analysisDuckdb.ts`
- `apps/backend/src/main/storage/marketSettingsRepository.ts`
- `apps/frontend/src/components/Dashboard.tsx`
- `apps/frontend/src/components/dashboard/*`
- `apps/frontend/scripts/verify-theme-contract.mjs`

## Decisions & tradeoffs
- Decision: 先迁移业务能力，后切 Dashboard 结构。
  - Rationale: 将功能风险与结构风险解耦，减少单批次爆炸半径。
  - Alternatives considered: 直接 merge `pr1`（放弃，风险过高）。

- Decision: 保留 rollout flags 兼容接口。
  - Rationale: `main` 收口与门禁仍依赖该链路进行稳定性保障。
  - Alternatives considered: 立即删除兼容（放弃，存在回退风险）。

## Deviations from plan
- None.

## Known issues / follow-ups
- 需要在实施阶段把 42 个提交映射到最终 PR 批次（可能不是原 commit 粒度）。
- 进入 Phase 6 后需补齐 1 个交易日观察记录（稳定性验收 evidence）。

## Pitfalls / dead ends (do not repeat)
- 详见 `05-pitfalls.md`。

## 2026-02-22 Reopen: 全量池基线回收（按 tushare-rollout-closure）
- 触发背景：线上观察到 `targets ingest` 持续长跑并反复出现 futures 标的失败日志（示例：`CS1903.DCE`），用户明确要求“全量池的数据类型/表格/抓取对象以 `tushare-rollout-closure` 为准”。
- 本次回收动作（最小集）：
  - `apps/backend/src/main/market/marketIngestRunner.ts`
    - 恢复为 closure 语义：
      - 去除 Universe ingest 的 `selectedBuckets` 过滤链路与 bucket state 回写。
      - 去除 targets ingest 自动 materialization 绑定（回到 closure 的纯 targets 抓取语义）。
  - `apps/backend/src/main/market/providers/tushareProvider.ts`
    - futures/spot `assetClass` 回归 `null`（不再作为 targets 自动抓取资产类型）。
    - 去除 universe pool tag 自动注入（回归 closure provider 行为）。
  - `apps/backend/src/main/market/ingestOrchestrator.ts`
    - 移除 targets 任务对 `analysisDbPath` 的传递（与 closure targets 路径对齐）。
  - `apps/backend/src/main/market/marketRepository.ts`
    - `listAutoIngestItems` 收紧为 `asset_class in ('stock','etf')`，防止历史脏数据进入 targets 抓取对象。
  - `apps/backend/src/main/market/targetsService.ts`
    - `resolveAutoIngestItems` 仅输出 `stock/etf` 抓取对象（未知/其他资产类型不再默认降级为 stock）。
  - `apps/backend/src/main/market/marketCache.ts`
    - 增加兼容迁移：启动时将 `instruments.asset_class in ('futures','spot')` 归一化为 `null`。
    - 移除 `target_task_status` / `target_materialization_runs` 的 schema 创建步骤（回归 closure 的 market cache 表结构基线）。
- 运行态纠偏（本地账户数据）：
  - 执行一次性 SQL：`update instruments set asset_class = null where asset_class in ('futures','spot')`。
  - 纠偏后核对：`auto_ingest=1` 且 `asset_class in ('stock','etf')` = `5491`，`futures/spot` = `0`。
- 稳定性补丁（防止 ingest 长时间 running）：
  - `apps/backend/src/main/market/tushareClient.ts`
  - `apps/backend/src/main/market/providers/tushareProvider.ts`
  - 为 TuShare HTTP 调用增加 20s abort 超时；超时统一抛出明确错误，避免单请求无响应导致队列长期占用。
- UI/运行口径解耦修正（回应“目标池编辑应为 2 万+ 标的”）：
  - `apps/backend/src/main/market/targetsService.ts` 改为在“目标池编辑预览”阶段读取全量 `auto_ingest` symbols（不再受抓取资产类型过滤）。
  - `apps/backend/src/main/market/marketRepository.ts` 新增 `listAutoIngestSymbols`。
  - 结果：编辑口径恢复全量；执行口径仍由 `resolveAutoIngestItems` 限制为 `stock/etf`，避免 futures/spot 抓取报错风暴。
- 标的结构看板修复（2026-02-22）：
  - `apps/frontend/src/components/dashboard/hooks/use-dashboard-market-target-pool-stats.ts`
  - 当 `pool:*` 标签成员汇总为 0 时，自动回退到 `market.previewTargets()` 作为 universe symbols 口径，避免“全量标的=0”的空板问题。
  - 分类统计仍沿用分类标签成员并与 universe symbol 集求交，保证指标语义一致。
