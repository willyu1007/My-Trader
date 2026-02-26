# 00 Overview

## Status
- State: implementation-complete-awaiting-manual-smoke
- Last updated: 2026-02-26
- Next step: 完成产品侧手工 smoke（8 Tab + per-tab 记忆 + 债券/利率空态）

## Goal
把 Market 从“股票中心”升级为“单层顶部穷举分类 Tab（类似投资组合）”，让用户按资产类型一键切换，并保持 `marketScope`（数据来源）语义独立。

## Non-goals
- 不在本任务内扩展新的行情数据源（继续以 Tushare 为主）
- 不在本任务内引入实时/分钟级行情
- 不重构 ingest scheduler / target pool 核心流程
- 不修改 Portfolio/Risk/Other 的交互模型
- 不在本任务内实现独立“行业跟踪”功能页（仅做侧栏文案迁移）
- 不在本任务内为债券/利率接入真实行情链路（v1 仅建设中空态）

## Context
- 现状：Market 的 `marketScope` 主要表达数据来源（holdings/tags/search），筛选模型与文案明显偏股票。
- 决策：不做一级分类入口，直接穷举顶部 Tab。
- 约束：已有 Market 功能较多（搜索、自选、标签集合、详情图表、筛选弹层），改造必须避免回归。

## Final product contract
- 侧栏：保留 key `index-tracking`，文案改为“行业跟踪”。
- Market 顶部 Tab：
  - `股票 / ETF / 指数 / 现货 / 汇率 / 期货 / 债券 / 利率`
- `债券 / 利率`：
  - 可点击
  - 进入统一建设中空态
  - 不进入常规列表/详情流程
- 手动筛选：
  - 保留入口
  - 按 Tab 记忆
- `scope`：
  - 按 Tab 记忆
  - 首次进入某 Tab 使用 preset 默认值

## Acceptance criteria (high level)
- [x] Market 新增单层顶部 Tab，且不出现一级分类入口
- [x] Market 顶部改为 8 Tab，且不包含“行业”
- [x] 侧栏入口文案改为“行业跟踪”，key 保持 `index-tracking`
- [x] `marketScope` 与 tab 保持正交，支持按 Tab 记忆
- [x] 手动筛选入口保留，且按 Tab 记忆
- [x] 债券/利率进入建设中空态，不伪造数据
- [x] 类型检查与构建通过
- [ ] 完成产品侧手工 smoke 验收
