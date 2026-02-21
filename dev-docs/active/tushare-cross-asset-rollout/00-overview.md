# 00 Overview

## Status
- State: in_progress
- Last updated: 2026-02-21
- Upstream planning task: `dev-docs/archive/tushare-cross-asset-coverage-planning/`
- Related implementation base: `dev-docs/active/real-data-auto-fetch/`
- Next step: 持续执行 Wave-1/2/3 soak（验证 `index_daily/daily_basic/moneyflow` cursor 单调推进、主链路无阻断、并按门禁判定是否放量）。

## Goal
承接 `tushare-cross-asset-coverage-planning` 的规划定稿，完成 P0/P1/P2 三个批次的分阶段实施与门禁验收，形成可持续运行的多资产数据池（Universe + Target，SSOT-first）。

## Non-goals
- 不在本任务中重做 `real-data-auto-fetch` 已落地的基础能力（调度器、ingest orchestrator、Targets 基础交互）
- 不把专项未授权接口（如 `stk_premarket`）强行纳入主链路
- 不在缺少门禁与回滚开关的情况下一次性放开所有增强模块

## Scope
- P0（高优资产）：股票、ETF、指数（上下文）、期货、现货（SGE）
- P1（扩展资产）：外汇、宏观（国内 + 美国）
- P2（增强模块）：权限型/专题型接口（分钟/实时与扩展专题）
- 通用要求：
  - 统一表与分层模型按规划落地
  - Target 严格 SSOT-first
  - 每批次有独立准入/退出门禁与回滚开关

## Batch Completion Criteria
- P0:
  - [ ] 必选核心模块 `complete + partial >= 95%`
  - [ ] 指数上下文模块当日可用率 >= 95%
- P1:
  - [ ] 外汇白名单 `task.momentum` 的 `complete + partial >= 95%`
  - [ ] 宏观 4 模块在最近 20 个交易日内 `missing` 占比 <= 5%
  - [ ] 无 `available_date > as_of_trade_date` 的回测穿越记录
- P2:
  - [ ] 专项权限接口先探测通过再灰度放开
  - [ ] 上线后不降低 P0/P1 已达成门禁阈值

## Global Exit Criteria
- [ ] 连续 3 个交易日无阻断错误 run
- [ ] `inserted/updated/errors` 与目标表行变化可对账
- [ ] 关键字段空值率 <= 0.5%，主键冲突 = 0
- [ ] 手动/定时/启动补跑/暂停/恢复/取消回归通过
