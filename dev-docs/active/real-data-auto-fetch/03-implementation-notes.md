# 03 Implementation Notes

## Status
- Current status: in_progress
- Last updated: 2026-02-04

## Notes (append-only)
- 2026-01-28：创建任务包 `dev-docs/active/real-data-auto-fetch/`，并确认 v1 数据范围采用方案 B（日线价格 + 元数据 + 交易日历）。
- 2026-01-28：确认 token 存储策略：env 优先 + Electron `safeStorage` 本地加密存储（不引入 `keytar`，不落库、不明文日志）。
- 2026-01-28：确认自动拉取触发：定时/手动刷新 + ledger 变更触发（debounce/互斥）。
- 2026-01-28：确认公司行为/分红 v1 策略：仅获取并展示，但必须提供“未处理”标识与处理入口（不自动写入 `ledger_entries` 参与复算）。
- 2026-01-28：补充日K图表闭环需求：范围查询 IPC + 按需回补 + 缺口提示 + 未复权/未处理提示。
- 2026-01-28：确认数据源策略：v1 外部 provider 暂以 Tushare 作为单一来源，但必须预留 provider 扩展接口；同时保留 CSV 导入等 source 标注与追溯字段。
- 2026-01-28：新增需求：不拉全量数据，必须提供“拉取对象（Targets）”配置（例如：持仓/自选列表/registry 各自可开关），并可预览当前将拉取的 symbols。
- 2026-01-28：进一步明确 Targets 模块需要覆盖更多“表达方式”：某某板块、某类型 ETF、某具体公司（显式 symbol）、当前持仓、watchlist；建议以 tag/category 为 v1 的统一入口，后续接 provider 自动补全分类。
- 2026-01-28：新增需求：需要可查询的 Tushare 标的基础库（名称、分类、代码等），即使不拉行情也可检索/查看详情；并记录 Tushare 字段映射清单以便维护。
- 2026-01-28：后端落地：provider 接口（v1 Tushare 实现）、标的基础库 `instrument_profiles`（含 provider 分类 tags + 原始字段 raw）、Targets 配置持久化与解析、watchlist/user tags、IPC + preload 暴露；auto-ingest 改为基于 Targets 解析的 symbol 集合。
- 2026-01-28：前端落地：`Dashboard` 的「市场行情」视图实现标的库同步/搜索/详情、用户标签管理、自选列表管理、Targets 配置编辑与预览展示。
- 2026-02-01：新增行情跑批与可观测基础设施：market-cache 增加 `ingest_runs` 与 `trading_calendar`；新增 IPC：token(get/set/test)、ingestRuns(list)、ingest(trigger)。
- 2026-02-01：Token 支持 env > 本地配置：本地 token 通过 Electron `safeStorage` 加密后存入 `business.sqlite.market_settings(tushare_token_v1)`，供自动/手动/按需回补统一使用。
- 2026-02-01：启动定时跑批（默认 19:30，本地时区）：账号解锁后自动启动 scheduler；启动时也会触发一次 catch-up（缺口会按交易日顺序补齐，可分批/断点续跑）。
- 2026-02-01：引入 DuckDB（WASM）分析仓：新增 `analysis.duckdb` 的 DuckDB-WASM 运行时封装与 schema（instrument_meta / trade_calendar / daily_prices / daily_basics / daily_moneyflows / analysis_meta），并实现 Universe（日级，近 3 年窗口）按交易日拉取与写入（含 cursor `universe_last_trade_date`）。
- 2026-02-01：并发保护：新增全局 ingestion mutex（`ingestLock`），auto-ingest 与定时跑批/手动触发共用，避免并发写库与读写冲突。
- 2026-02-01：前端新增“行情数据状态”入口：实现 token(get/set/test)、手动触发 ingest(targets/universe/both)、查看 `ingest_runs`；并在组合收益页 `DataQualityCard` 提供快捷入口。
- 2026-02-01：UI 信息架构调整：将「注入示例数据 / 自动拉取范围（Targets）/ 数据状态」从「市场行情」移至「其他」的子 Tab（数据管理/数据状态/测试），并移除旧的“日期范围 Tushare 拉取”入口。
- 2026-02-03：统一可观测口径：`autoIngest` 迁移为调用 `runTargetsIngest(mode=on_demand)`，并写入 `ingest_runs`；scheduler/手动触发改为按 `mode(daily/manual/on_demand)` + `meta.schedule(startup/schedule/manual/trigger/interval)` 记录。
- 2026-02-03：Universe 跑批补齐分析仓维度：同步 SQLite `trading_calendar` -> DuckDB `trade_calendar`；同时 Universe 同步时自动 upsert `instrument_profiles`（标的基础库不再依赖手工 sync）。
- 2026-02-03：全局数据状态入口：侧边栏新增「数据状态」入口，指向 Other/Data Status，并在数据状态页补齐 Token 状态与缺失标的清单 + 一键拉取目标池入口。
- 2026-02-03：修复标的库批量 upsert 的 SQLite 参数上限问题：`upsertInstrumentProfiles` 对 `symbol in (...)` 查询改为分批（避免 A 股全量 catalog > 999 时失败）。
- 2026-02-03：Targets 增强：增加“临时目标池”机制（搜索选中但不在 Targets 的标的会临时加入，TTL 自动清理，可一键转为长期 explicitSymbols），并将 UI 文案从“自动拉取范围”调整为“目标池编辑”。
- 2026-02-04：按用户确认的方案 B，移除侧边栏「数据状态」入口，仅保留「其他 / 数据状态」。
- 2026-02-04：修复 `pnpm dev` 启动冲突：前端 Vite 不再强制绑定 5173；`apps/backend/scripts/dev.mjs` 直接使用 `pnpm exec vite -- --port <port>` 启动，从而在 5173 被占用时可自动切换端口（例如 5174）。

## Pending decisions / TODO
- trading_calendar 的 market 维度与来源（v1 先 CN；后续预留多市场）。
- 日K UI 放置位置（持仓详情 vs 市场 Tab vs 右侧抽屉），以及默认区间（建议 3M）。
- “未处理公司行为/分红”与 ledger 的关联策略（external_id 优先，近似匹配兜底）。
- Targets 具体配置落点：优先按账号隔离（business.sqlite）保存 watchlist；registry auto_ingest 继续在 market-cache。
- provider 扩展预留：接口命名与返回 DTO（v1 仅实现 Tushare）。
