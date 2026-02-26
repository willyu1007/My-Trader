# 02 Architecture

## Scope boundaries
- In scope
  - insights/valuation business schema
  - 观点 CRUD + FTS5 搜索 + 作用域展开 + symbol materialization
  - valuation methods 管理（内置只读、可克隆、自定义版本）
  - valuation preview（base vs adjusted）与 applied effects 展示接口
- Out of scope
  - instrument_id 全链路主键迁移
  - 全域行情数据链路补齐

## Runtime design
- DB：
  - business DB 保存 insights 与 valuation methods。
  - market cache DB 提供 symbol/kind/asset_class/market/tag 数据用于 scope resolver 与 preview。
- 键策略：
  - 首版以 `symbol` 落地，不引入 instrument_id 迁移。
  - instrument catalog 写入执行冲突保护：同 provider+market+symbol 可覆盖；跨市场同 symbol 阻断。

## Data contracts
- Core tables
  - `insights`
  - `insight_scope_rules`
  - `insight_target_exclusions`
  - `insight_effect_channels`
  - `insight_effect_points`
  - `insight_materialized_targets`
  - `insight_fts`（FTS5）
- Valuation tables
  - `valuation_methods`
  - `valuation_method_versions`
  - `valuation_adjustment_snapshots`

## Key rule alignments
- Scope resolver:
  - 支持 `symbol/tag/kind/asset_class/market/domain/watchlist`。
  - 所有作用先展开后收敛到 symbol。
- 时间规则：
  - effect points 按自然日线性插值。
  - 区间外无影响。
- 冲突规则：
  - 阶段固定：`base -> first_order -> second_order -> output -> risk`
  - 阶段内排序：`priority asc -> created_at asc -> insight_id asc`
  - 算子：`set/add/mul/min/max`
- 生命周期规则：
  - 标的侧解绑写 `insight_target_exclusions`。
  - 方法新版本仅影响未来日期，不回溯历史快照。
