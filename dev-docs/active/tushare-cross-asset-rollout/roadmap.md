# Roadmap

## Task Name
Tushare 多资产覆盖实施（P0/P1/P2）

## Objective
将规划阶段已定稿的资产覆盖、统一模型、批次门禁与回滚策略落地为可运行实现，完成从 P0 到 P2 的分阶段上线与稳定化验收。

## Scope and batches
1. P0（高优资产）
- 股票、ETF、指数（上下文）、期货、现货（SGE）
- 统一表一次建齐并完成首轮回填

2. P1（扩展资产）
- 外汇（币对白名单）
- 宏观（国内 + 美国，`available_date` 治理）

3. P2（增强模块）
- 权限型/专题型增强接口（分钟/实时与扩展专题）
- 灰度放开，不影响核心链路

## Out of scope
- 强制纳入未授权专项接口（例如 `stk_premarket`）
- 无门禁直接全量开放增强模块
- 重做 `real-data-auto-fetch` 已落地基础设施

## Workstreams
1. Schema and migration
- 统一表 + 扩展表迁移
- 主键、索引、幂等约束校验

2. Ingestion and orchestration
- 分资产采集与标准化入库
- run 统计统一、失败重试与 checkpoint

3. Target and status
- SSOT-first 消费
- 模块状态矩阵与 explain payload

4. Control and observability
- 批次开关、回滚开关、告警阈值
- 调度回归与运行报告

## Responsibility boundaries (alignment with real-data-auto-fetch)
| Area | Primary owner | Secondary owner | Notes |
|---|---|---|---|
| Ingest runtime（orchestrator/queue/cancel/pause-resume） | `real-data-auto-fetch` | `tushare-cross-asset-rollout` | rollout 只在需要多资产能力时做最小扩展，避免重构已有 runtime。 |
| Scheduler config & control state (`ingest_scheduler_config_v1` / `ingest_control_state_v1`) | `real-data-auto-fetch` | `tushare-cross-asset-rollout` | rollout 可新增批次级 flag，但不改变既有调度语义。 |
| Targets 解析与 UI 草稿编辑 | `real-data-auto-fetch` | `tushare-cross-asset-rollout` | rollout 仅补多资产标签/分类映射，不接管交互主流程。 |
| Cross-asset schema（统一表 + 资产扩展表） | `tushare-cross-asset-rollout` | `real-data-auto-fetch` | rollout 为唯一 owner，负责迁移顺序、双写/切读和回滚。 |
| Cross-asset ingestion adapters（P0/P1/P2） | `tushare-cross-asset-rollout` | `real-data-auto-fetch` | rollout 为唯一 owner，按批次接入并维护门禁。 |
| Target 状态矩阵（complete/partial/missing/not_applicable） | `tushare-cross-asset-rollout` | `real-data-auto-fetch` | rollout 为唯一 owner，必须 SSOT-first。 |
| Run observability（ingest_runs 可视化与摘要） | `real-data-auto-fetch` | `tushare-cross-asset-rollout` | rollout 可补字段，但不重写现有 run 展示链路。 |

## Ownership hard rule
- 涉及以上边界“主责 owner 变更”的需求，MUST 先在 `03-implementation-notes.md` 写清变更原因、影响范围和回滚方案，再实施。

## Phases
1. Phase A: Baseline
- 完成 schema 基线、开关基线、回滚基线。

2. Phase B: P0 delivery
- 打通交易相关核心资产并完成门禁验收。

3. Phase C: P1 delivery
- 外汇 + 宏观入链并完成时间语义验收。

4. Phase D: P2 delivery
- 增强模块按权限探测结果灰度上线。

5. Phase E: Stabilization
- 三批次整体验收、异常演练、handoff 文档闭环。

## Phase transition hard rules (MUST)
1. 不允许并行推进多个批次；必须按 A -> B(P0) -> C(P1) -> D(P2) -> E 顺序推进。
2. 未完成当前阶段退出门禁，不得进入下一阶段开发。
3. 任一阶段门禁回归失败，MUST 冻结后续阶段并执行当前阶段回滚策略。
4. 进入 P2 前，MUST 确认 P0/P1 门禁稳定（至少连续 3 个交易日无阻断错误）。

## P2 wave-1 graylist (proposed)
1. Realtime index:
- `rt_idx_k`
- `rt_idx_min`
- `index_min`

2. Realtime equity/ETF:
- `rt_etf_k`
- `rt_min`
- `stk_mins`

3. Futures microstructure (gray):
- 分钟行情
- 仓单日报
- 席位持仓细分

## P2 wave-1 rollout flags (proposed)
- `p2_realtime_index_v1`
- `p2_realtime_equity_etf_v1`
- `p2_futures_microstructure_v1`
- `p2_special_permission_stk_premarket_v1`（默认关闭，需专项权限实测通过后才允许开启）

## `rollout_flags_v1` schema (post-convergence baseline)
```json
{
  "p0Enabled": true,
  "p1Enabled": true,
  "p2Enabled": true,
  "universeIndexDailyEnabled": false,
  "universeDailyBasicEnabled": false,
  "universeMoneyflowEnabled": false,
  "p2RealtimeIndexV1": true,
  "p2RealtimeEquityEtfV1": true,
  "p2FuturesMicrostructureV1": true,
  "p2SpecialPermissionStkPremarketV1": false,
  "updatedAt": 0
}
```

## Stability-to-Recovery Plan (new baseline)
目标：先稳定产出，再恢复临时降级接口到正常使用，且全程可回滚。

### Phase R0: Stable production baseline (MUST)
1. 主链路仅保留稳定接口（价格主链路 + FX + Macro），保证 Universe 可持续成功。
2. 高风险接口（`index_daily` / `daily_basic` / `moneyflow`）默认不阻断主链路。
3. DuckDB 运行参数、stale running 收敛、分片执行作为默认基线能力。

### Phase R1: Recovery framework (MUST)
1. 为恢复接口增加模块级开关：
- `universeIndexDailyEnabled`
- `universeDailyBasicEnabled`
- `universeMoneyflowEnabled`
2. 建立模块级游标（与主游标解耦）：
- `universe_index_daily_cursor_v1`
- `universe_daily_basic_cursor_v1`
- `universe_moneyflow_cursor_v1`
3. 模块失败只标记模块级结果，不得把主链路直接升级为 `failed`。

### Phase R2: Wave recovery (ordered)
1. Wave-1: `index_daily`（按 `ts_code` 分片）
2. Wave-2: `daily_basic`（按 symbol 池分片）
3. Wave-3: `moneyflow`（按 symbol 池分片）

### Recovery gate per wave (MUST)
1. 连续 3 个交易日无阻断失败 run。
2. 模块自身覆盖率与质量达标（口径后续由测试定义）。
3. `running` 残留计数为 0。
4. 主链路指标不回退（P0/P1 核心门禁保持稳定）。

### Rollback rule per wave (MUST)
1. 任一 wave 失败，立即关闭对应模块开关。
2. 主链路继续运行，禁止扩大回滚影响面。
3. 修复后在同一 wave 重试，不允许跳级。

## Post-verification target state (MUST)
在 P0/P1/P2 全部门禁通过并完成稳定性验收后，rollout 从“灰度控制态”切换到“默认全开态”。

### Final-state rules
1. 默认开启全部批次总开关：
- `p0Enabled=true`
- `p1Enabled=true`
- `p2Enabled=true`

2. 已验收的 P2 子模块默认开启：
- `p2RealtimeIndexV1=true`
- `p2RealtimeEquityEtfV1=true`
- `p2FuturesMicrostructureV1=true`

3. 专项权限开关仍保留硬门禁：
- `p2SpecialPermissionStkPremarketV1` 仅在权限探测实测通过后才允许置为 `true`，否则保持 `false`。

4. 完成稳定化验收后，删除面向业务用户的 rollout UI/UX（不再暴露批次开关操作入口）。

### Field rules
1. `p0Enabled/p1Enabled/p2Enabled`
- 批次总开关，控制对应批次能力是否允许进入执行路径。

2. `p2RealtimeIndexV1/p2RealtimeEquityEtfV1/p2FuturesMicrostructureV1`
- P2 子模块开关；`p2Enabled=false` 时这些字段即使为 `true` 也不得生效。

3. `p2SpecialPermissionStkPremarketV1`
- 专项权限开关；默认 `false`，且必须通过权限探测记录后才可置为 `true`。

4. `updatedAt`
- 毫秒时间戳；每次 flags 变更时必须更新，用于审计与回滚追踪。

## Exit criteria
1. 通用门禁全部通过（稳定性/对账/质量/调度）
2. P0、P1、P2 批次门禁全部通过
3. 完成 post-verification 收口：默认全开批次 + 删除 rollout UI/UX + 专项权限门禁仍生效
4. 文档齐全可归档（overview/plan/architecture/notes/verification/pitfalls/roadmap）

## Current progress (2026-02-21)
1. 承接任务包已建立，且职责边界/硬门禁/灰度清单已对齐（P0/P1/P2 全批次范围）。
2. Phase A 与 Phase B 首段已落地：rollout flags、P0 资产扩展（index/futures/spot）与容错路径已接入。
3. 收口项已执行：`rollout_flags_v1` 默认收敛为全开，Dashboard rollout 配置 UI/UX 已移除，专项权限开关仍保留硬门禁。
4. 稳定化阻断已修复（DuckDB 运行参数 + stale running 收敛 + 分片 + 分页防护），实网已恢复可成功补跑。
5. 恢复计划已启动：Phase R1 完成（模块开关与模块游标框架）；Phase R2 已完成 Wave-1/2/3 执行器接入，并通过自动化 smoke 验证 `index_daily/daily_basic/moneyflow` 的独立开关 + 独立 cursor + 主链路不阻断。
6. 已修复 cursor 持久化阻断：Universe 主/模块游标存储切换到 `market-cache.sqlite.market_meta`，复测确认三模块 cursor 可单调推进。
7. 已完成追加轻量回归（`manual-soak3`）：三模块再次单调推进且主 run 全部成功；测试 run 与临时目录已清理，当前进入“连续 3 交易日稳定性门禁”验证阶段。
8. 已完成连续交易日门禁 Day-1 快照：以稳定修复后的基线 run 为边界，当前 `3 runs / 0 blocking`，质量与编译回归通过；待完成 Day-2/Day-3。
9. 已落地标准化门禁快照命令（`phase-r2:gate-snapshot`）；当前日期为 `2026-02-21`（周六），Day-2/Day-3 需在后续交易日（最早 `2026-02-23`）继续执行。
10. 门禁快照命令已增强为自动计算连续稳定进度；当前 `cleanDayProgress=1/3`，尚未达到恢复门禁退出条件。
11. 已完成 Day-1 日内复验：新增 `startup` 成功 run 后 `postBaseline=4 runs/0 blocking`，`index_daily` cursor 持续推进（`160 -> 200`），稳定性结论不变。
12. 已完成 Day-1 日内加压（额外 2 轮 startup 补跑）：`postBaseline=6 runs/0 blocking`，`index_daily` cursor 继续推进（`200 -> 280`），无新阻断与残留。
13. 已完成 Day-1 追加补跑（+1）：`postBaseline=7 runs/0 blocking`，`index_daily` cursor 进一步推进（`280 -> 320`），质量与残留指标维持稳定。
14. 已完成 Day-1 追加补跑（+1，round-4）：`postBaseline=8 runs/0 blocking`，`index_daily` cursor 继续推进（`320 -> 360`），同日稳定性进一步增强。
15. 已完成“历史交易日回放”加速门禁：`as_of_trade_date=2026-02-11/12/13` 三次回放均成功，`cleanAsOfTradeDateProgress=3/3`；自然日口径仍为 `1/3`。
