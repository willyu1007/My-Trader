# 05 Pitfalls

## Do-not-repeat summary
- 不要在未设置批次开关与回滚开关时直接放开新资产模块。
- 不要绕过 SSOT 直接在 Target 层调用 provider 直拉替代主路径。
- 不要在宏观模块中使用 `period_end` 直接生效，必须经过 `available_date` 规则。

## Record template (append-only)
- Date:
- Symptom:
- Root cause:
- What was tried:
- Fix/workaround:
- Prevention note:

## Records
- Date: 2026-02-21
- Symptom: 启动补跑反复出现 `managed ingest job failed`，先后出现 DuckDB OOM / wasm `memory access out of bounds` / internal assertion；并伴随 `ingest_runs` 长期残留 `status='running'`。
- Root cause: Universe 单次 run 处理窗口过大 + DuckDB wasm 运行时未配置落盘临时目录与保守资源参数；同时 Tushare 分页在部分接口上出现重复页，导致 offset 安全阈值阻断；异常退出后 run 状态缺少自动收敛。
- What was tried: 先后尝试仅增加 `temp_directory`、仅缩小 batch、仅替换单点接口，均未完全消除阻断。
- Fix/workaround: 组合修复生效：DuckDB 运行时参数（temp/memory/threads）、orchestrator 启动收敛 stale running、Universe 按 mode 分片、分页重复页降级、`instrument_meta` 批量 upsert、Universe 暂停高风险全市场接口（`daily_basic/moneyflow/index_daily`）。
- Prevention note: 对 wasm-DuckDB 场景，新增资产链路时必须先做“小窗口 + 可中断 + 可收敛”的灰度回归；全市场接口必须先验证分页语义，未验证前不得作为阻断主路径。

- Date: 2026-02-21
- Symptom: Wave-1/2/3 连续 run 中模块 cursor 不推进（始终回到相同 `symbolOffset`），导致恢复任务无法收敛。
- Root cause: cursor 存在 DuckDB `analysis_meta`，在当前运行形态下跨进程重启后不稳定，读到空值后回退到起始游标。
- What was tried: 先尝试通过 DuckDB 文件落盘/回载修复 `analysis_meta` 持久化，运行态验证仍不稳定。
- Fix/workaround: 将 Universe 主游标与模块游标统一迁移到 `market-cache.sqlite.market_meta`（`universe_last_trade_date` + `universe_*_cursor_v1`）。
- Prevention note: 对“调度状态/游标”这类控制平面数据，优先放在稳定持久化的 sqlite 元数据层，不依赖分析库作为唯一状态源。
