# 02 Architecture

## UI Component Tree（拟）
- `MarketWorkspace`
  - `ExplorerSidebar`
    - `SearchBar`
    - `ScopeSwitcher`（Tags/Holdings/Search）
    - `InstrumentList`（含报价）
  - `DetailPane`
    - `InstrumentDetail`（header + chart + info）
    - `CollectionDetail`（header + constituents table + overall summary）
  - `TargetsModal`（配置 + 预览）

## Data Dependencies（拟）
- Explorer 列表数据源
  - watchlist：`market.listWatchlist()`
  - holdings：复用 portfolio snapshot 或新增专用 IPC（后续）
  - collections：tag/group -> symbols（需要 IPC 支持；或复用现有 tag->symbols 能力并补齐“列出 tags”）
  - search：`market.searchInstruments({ query, limit })` + 筛选条件（需要扩展）
- 批量报价（需新增）
  - 输入：symbols[]
  - 输出：latest close/trade_date + prev close -> change/pct
- Tag 聚合（建议 v1 派生计算）
  - 输入：tagId（或 tag 字符串）+ rangeKey（或 start/end）
  - 输出：
    - overallChange（基于 constituents 的市值加权涨跌幅）
    - overallSeries（base=100 市值加权序列；口径标注“派生指数（非真实指数）”）
  - 额外依赖：成分股日线市值（建议用上一交易日市值做权重）
    - 数据源候选：Tushare `daily_basic`（`circ_mv` / `total_mv`）
  - 缺失策略（已对齐部分）：
    - 缺价格：剔除并重归一化权重 + 输出覆盖率/缺失名单
    - 缺市值：待确认（建议同上）
- 图表区间（需新增）
  - 输入：symbol + rangeKey 或 start/end
  - 输出：OHLCV（或 close-only）

## Notes
- 本任务不引入实时行情；“涨跌”基于日线 close 的相邻交易日差值。
- 颜色策略需考虑市场习惯（CN vs US），v1 可先固定。
