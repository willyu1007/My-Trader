# 03 Implementation Notes

## Status
- Current status: in_progress
- Last updated: 2026-02-20

## Notes (append-only)
- 2026-02-20：创建承接任务包 `dev-docs/active/tushare-cross-asset-rollout/`，范围覆盖 P0/P1/P2 全批次。
- 2026-02-20：将旧承接包 `dev-docs/active/tushare-cross-asset-p0-implementation/` 迁移至 `dev-docs/archive/tushare-cross-asset-p0-implementation/`，作为 superseded 历史记录。
- 2026-02-20：确认本任务复用 `real-data-auto-fetch` 的 orchestrator/scheduler/run 可观测能力，不重复建设基础设施。
- 2026-02-20：确认沿用规划任务定稿门禁阈值（P0/P1/P2 + 通用准入/退出门禁）。
- 2026-02-20：按评审意见补充 roadmap 对齐项：职责边界矩阵（rollout vs real-data-auto-fetch）、阶段硬门禁（phase transition MUST）、P2 首批灰度清单与建议开关命名、可执行验证命令清单、以及数据模型切换策略（shadow write -> dual-read -> progressive cutover -> fallback window）。
- 2026-02-20：启动 Phase A 实施（开关基线）：新增 `rollout_flags_v1` 配置链路（shared 类型 + IPC channel + preload API + backend `market_settings` 读写仓储 + IPC handlers），用于批次总开关与 P2 子模块灰度开关管理。
- 2026-02-20：将开关接入执行入口：`ingestOrchestrator.runJob` 在执行前读取 `rollout_flags_v1`，当 `p0Enabled=false` 时跳过非手动任务并阻断手动任务（当前链路均视作 P0 批次能力）。
- 2026-02-20：前端「其他/数据管理」新增“批次开关（Rollout）”面板：支持读取/编辑/保存 `rollout_flags_v1`（P0/P1/P2 总开关 + P2 子模块开关），展示 `updatedAt` 与未保存提示。
- 2026-02-20：前端触发门禁联动：当 `p0Enabled=false` 时，“执行拉取”与“手动拉取”按钮禁用；即使绕过禁用直接触发，`handleTriggerMarketIngest` 也会前置阻断并给出错误提示。
- 2026-02-20：按评审决议补充“收口硬规则”：P0/P1/P2 全部门禁通过后，rollout 切换为默认全开态；删除面向业务用户的 rollout UI/UX；专项权限开关 `p2SpecialPermissionStkPremarketV1` 继续保留权限实测门禁。
- 2026-02-20：完成批次开关仓储级冒烟（真实账号库）：`rollout_flags_v1` 的 get/set/get/restore 全链路通过，`updatedAt` 正常推进且最终恢复原值。
- 2026-02-20：完成 P0 门禁 orchestrator 级冒烟（真实账号库）：`p0Enabled=false` 时 manual enqueue 被阻断报错、schedule enqueue 被跳过；两者均未新增 `ingest_runs` 记录，测试后已恢复开关原值。
- 2026-02-20：进入 Phase B（P0 rollout）首段实现：扩展 `InstrumentKind/MarketInstrumentKind` 支持 `index/futures/spot`，并将 `tushareProvider.fetchInstrumentCatalog` 扩展为股票/ETF + 指数主档 + 期货主档 + SGE 现货主档（后 3 类按 optional catalog 处理，权限不足时降级为空集合）。
- 2026-02-20：扩展 Universe ingest（日线）到 P0 资产集：在 `ingestUniverseTradeDate` 增加 `index_daily/fut_daily/sge_daily` 拉取并写入 DuckDB `daily_prices`；同时在 run `meta.universeCounts` 增加 `indexes/futures/spots` 计数，`symbolCount` 覆盖 stock/etf/index/futures/spot 总量。
- 2026-02-20：为 P0 扩展数据源增加容错：新增 `fetchTusharePagedWithFallback`，当可选数据源接口不可用时记录告警并继续 run，避免影响 stock/etf 核心链路。

## Pending decisions / TODO
- P2 增强模块首批灰度名单（接口级）需要在权限探测后锁定。
- P1 宏观模块默认 `fallback_lag_days` 参数是否按资产组细化到配置中心。
