# 00 Overview

## Status
- State: in_progress
- Progress: Milestone 3 进行中：在「数据来源」并入“全量池配置”（A股/ETF/贵金属），Universe 拉取与全量统计按配置过滤；新增每分类最后更新日期展示（停更不删）。
- Next step: 在桌面端做有 token 的端到端验收：切换全量池分类后执行 Universe 拉取，确认 run meta `selectedBuckets/bucketCounts` 与 UI 口径一致；验证停更分类日期保持不前进但历史仍可查询。

## Goal
把“真实数据自动获取”做成可日常使用的闭环：可配置、可观测、可追溯、可控，并与现有组合估值/收益/风险/数据质量提示形成闭环。

## Non-goals
- 自动交易/券商直连/下单执行
- 云端同步、多设备共享、多用户协作
- 分钟级/实时行情（tick/level2）
- 在仓库内保存 Token/密钥，或在日志中打印明文 Token
- v1 内实现“公司行为自动入账并参与复算”（仅获取+展示+未处理标识）

## Scope（v1）
- 数据范围：方案 B（已确认）—— **日线价格 + 标的元数据 + 交易日历**
- 数据源：外部 provider 暂以 **Tushare 作为单一来源**（已接入），但保留 provider 扩展接口；同时保留 CSV 导入作为补充来源（仍保留 `source` 标注）
- 自动化：定时 + 手动刷新 + ledger 变更触发（debounce/互斥）
- 拉取对象：
  - 目标池（Targets）：用于 Market/UI/缺口修复，覆盖：持仓、watchlist、registry(auto_ingest)、显式标的、tagFilters
  - Universe 全量：CN A 股股票 + 交易所 ETF（不含退市/不含场外基金），每日定时增量维护近 3 年数据池
- 可观测：每次拉取必须落 `ingest_runs`（或等价结构）并可在 UI 查看
- 存储：SQLite（业务与 UI 快读缓存）+ DuckDB（analysis 全量数据池，近 3 年）
- 图表：日 K（OHLCV）以 `daily_prices` 为数据源，补齐“范围查询 + 按需回补 + 缺口提示 + 未复权提示”
- 公司行为：仅获取并展示；对拆股/分红等“影响计算但未入账”提供明确未处理标识与处理入口
- 标的库：同步并缓存 Tushare 基础数据（名称/分类/代码等），即使不拉行情也可查询与搜索

## Context（repo 现状）
- `market-cache.sqlite` 已有：
  - `instruments`（含 `auto_ingest`）
  - `daily_prices`（OHLCV，含 `source/ingested_at`）
- 自动拉取已存在：`apps/backend/src/main/market/autoIngest.ts`
- Tushare 日线拉取已存在：`apps/backend/src/main/market/tushareClient.ts`
- 组合快照已计算 `dataQuality(coverage/freshness)`：`apps/backend/src/main/services/portfolioService.ts`
- 前端已有 `DataQualityCard`，但“市场”Tab 仍是占位；导入/拉取入口目前在「Other / Data Import」：`apps/frontend/src/components/Dashboard.tsx`

## Acceptance criteria（高层）
- [ ] Token 可在应用内配置并加密存储（env 覆盖优先），并提供“连接测试/错误解释”，无 Token 时不再静默失败
- [ ] 标的基础库可用：可按代码/名称查询，并能看到 provider 分类字段；用户可添加自定义标签
- [ ] 自动/手动拉取均有可查询的 run 记录（成功/失败、耗时、symbol 数、写入行数、错误摘要）
- [ ] symbol 选择与 ledger-first 对齐：只录入流水新增标的也能自动补齐行情
- [ ] 支持配置“拉取对象（Targets）”，避免全量拉取；UI 可预览当前拉取范围
- [ ] 数据状态入口可解释：覆盖率/新鲜度/缺失标的清单 + 一键刷新/回补入口
- [ ] 日 K 图表可用：范围查询稳定、数据不足可按需回补、未复权/未处理事件有明确提示
- [ ] 公司行为/分红“获取+展示”落地，且对未入账事件提供 `unhandled` 标识与处理入口
