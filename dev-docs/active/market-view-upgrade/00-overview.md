# 00 Overview

## Status
- State: in_progress
- Next step: 用 demo/真实数据手工验收 Market（集合整体走势/筛选/区间切换/图表交互）；确认“目标价”长期存储口径（目前用 tag 解析）并补齐编辑入口（如需要）

## Goal
按参考图把「市场行情」升级为双栏浏览工作台（左列表/右详情），补齐集合（板块/主题）与时间轴交互，并将 Targets 配置迁移到弹层入口。

## Non-goals
- 实时行情/分钟线/盘口
- 小走势图与复杂指标
- Token 安全存储与 ingest_runs（在 `real-data-auto-fetch` 任务推进）

## Scope（v1）
- 自动折叠全局导航（Market 进入时 icon-only）
- 离开 Market 恢复进入前状态（已对齐）
- 左侧列表：搜索 + scope（自选/持仓/集合/搜索结果）+ 最新价/涨跌
- 右侧详情：单标的详情 + 集合详情两种模式
- 集合概览：支持“Tag 聚合项”（整体涨跌/整体走势，口径=市值加权）
- 时间轴：悬停浮出范围 pills + 区间加载（需要后端区间查询 IPC）
- Targets：迁移到弹层（入口按钮）

## Dependencies
- 复用现有：instrument catalog、watchlist、Targets、daily_prices（来自 `real-data-auto-fetch` 已落地部分）
- 可能新增：批量报价 IPC、日线区间查询 IPC
