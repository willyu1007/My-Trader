# 03 Implementation Notes

## Status
- Current status: in_progress
- Last updated: 2026-01-30

## Notes (append-only)
- 2026-01-28：创建任务包 `dev-docs/active/market-view-upgrade/`，目标是把 Market 视图布局对齐参考图（双栏 + 详情区 + 时间轴交互），并补齐集合（板块/主题）与筛选模型。
- 2026-01-28：对齐：进入 Market 自动折叠全局导航为 icon-only，离开后恢复进入前状态；集合/板块/主题采用 Tag 体系统一表达，并增加“Tag 聚合项”（整体涨跌/整体走势，v1 以派生计算实现）。
- 2026-01-28：对齐：Tag 聚合项需要支持“市值加权”（非等权），因此依赖补齐日线市值数据（例如 Tushare `daily_basic` 的 `circ_mv/total_mv`），并明确缺失数据的降级策略。
- 2026-01-28：对齐：市值加权使用 `circ_mv`（流通市值）；成分股缺价格时统一剔除并重归一化权重，同时在 UI 输出覆盖率与缺失清单。
- 2026-01-29：后端补齐 provider tags 可用性：`ensureInstrumentProfileTagsBackfilled`（从 `instrument_profiles.tags_json` 回填 `instrument_profile_tags`），并在 `listMarketTags/getMarketTagMembers` 中确保回填/查询一致。
- 2026-01-29：前端完成 Market 双栏布局（左列表/右详情）：加入 scope（集合/持仓/搜索）、Targets 弹层、Tags 选择弹层、左侧报价展示（最新价+涨跌幅）、右侧日线图（hover 浮出范围 pills）与集合模式（成分表 + “整体（市值加权）”覆盖率）。
- 2026-01-29：Market 左侧栏支持拖拽调节宽度（localStorage 持久化，默认 240px），并提供键盘 ←/→ 微调（Shift 加速）。
- 2026-01-29：右侧详情区改为单一连续布局（无分块/无滚动）：顶部标题+报价（含区间 label）、中间日期行（hover 显示时间范围 pills）、日线图自适应高度、底部统计表（当日 OHLC/量 + 区间 high/low/avgVol/return 等）。
- 2026-01-29：把“标签/用户标签/原始字段/自选分组”迁移到“标的详情”弹层；集合成分预览仅展示前 20 条，完整成分在弹层中查看（最多展示前 2000 条）。
- 2026-01-29：右侧三段高度按 1.5 : 5.5 : 3 分配（标的信息/绘制区域/关键信息），并去掉绘制区域的强制背景色以贴合整体面板背景。
- 2026-01-30：后端强化 `getMarketQuotes`：对大批量 symbols 的 `IN (...)` 查询做 chunk，避免 sql.js/SQLite 参数上限导致的运行时失败；同时对缺失 `daily_basics` 的自动回补加上上限（每个 trade_date 最多 50 个 symbol），避免 Market 视图加载时触发过量 API 调用。
- 2026-01-30：Milestone 3（集合模式）补齐“整体走势”：新增 IPC `market.getTagSeries`（派生指数 base=100，权重优先用上一交易日 `circ_mv`），前端在集合详情中渲染整体走势图；同时新增“筛选”弹层（market/assetClass/kind），对搜索/持仓列表生效。
- 2026-01-30：为无持仓/无外部数据场景提供演示数据注入：新增 `market.seedDemoData` 一键写入 demo instruments/tags/watchlist + `daily_prices` + `daily_basics(circ_mv)`，用于验证 Milestone 3（集合整体走势/筛选）交互链路。
- 2026-01-30：图表交互增强：`MarketAreaChart` 支持 hover 显示对应日期与价格（十字线 + tooltip），便于手工验收走势数据。
- 2026-01-30：图表 hover UI 对齐参考：顶部显示蓝色价格 + 右上角日期，同时增加 y 轴读数与交易日标记（净买入/卖出）；若标的在当前组合持仓中，叠加“持仓均价”虚线用于对比。
- 2026-01-30：根据反馈移除图表横向辅助线；并在 hover 查看时隐藏顶部（非 hover）日期，避免与右上角 hover 日期重复。
- 2026-01-30：根据反馈将 hover 查看的日期/价格统一放到图表上方中间区域（替换“今日日期”）；图表区域内不再显示价格小框；并对 pointer move 做节流/事件处理优化，避免出现固定区域不响应。
- 2026-01-30：补齐“信息版”大数字显示：成交量/平均成交量/流通市值等采用常见单位（万、亿）缩写展示；集合成分表中的 `circ_mv` 同样按单位缩写显示。
- 2026-01-30：在趋势图与信息版之间增加“每日成交量”迷你图（约趋势图 1/8 高度），支持切换「总成交量 / 净买入（买入-卖出）」。净买入数据仅对持仓标的展示（基于 ledger 汇总的按日净份额变动）。
- 2026-01-30：术语对齐后把“净买入（ledger）”从成交量面板移除，改为“势能（Tushare moneyflow，日级）”；势能口径与成交量一致（量=net_mf_vol），并展示占比=|势能|/成交量；后端新增 `daily_moneyflows` 缓存表与 `includeMoneyflow` 拉取开关（缺失时自动拉取并缓存）。
- 2026-02-01：根据反馈去除“持仓标的”在趋势图里的全部特殊渲染（均价线/交易日标记等），保持单一走势展示逻辑。
- 2026-02-01：在图表上方日期/价格行左侧（对齐标的名称下方）并排展示「持仓价 / 目标价」：持仓价优先取 `Position.cost`，缺失时按 `ledger`（trade/adjustment）做 FIFO 估算；目标价从用户标签 `target:xx.xx`（或 `tp:`/`目标价:`）解析。
