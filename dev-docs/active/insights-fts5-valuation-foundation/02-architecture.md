# 02 Architecture

## Scope boundaries
- In scope
  - SQLite FTS5 能力升级与运行时接入
  - 观点影响估值的数据契约（非完整业务实现）
- Out of scope
  - 观点完整 CRUD/UI 开发
  - 完整估值计算引擎

## Runtime design
- 目标：保持现有 `storage/sqlite.ts` API 稳定（`open/get/all/run/transaction/close`）。
- 约束：FTS5 必须在运行时可检测；若不可用，应阻止进入“观点检索”功能并抛出可诊断错误。

## Valuation component contract (draft)
- `MethodRegistry`: 注册估值方法与依赖参数（可扩展到 PE/PB/DCF/多因子/波动率等）。
- `MetricGraph`: 参数依赖图（顶层指标 -> 一阶参数 -> 二阶参数）。
- `InsightOperatorLayer`: `set/add/mul/min/max` 对任意 metric 施加算子。
- `ScopeResolver`: 行业/概念/领域展开为 symbol 集合；最终 materialize 到 symbol。
- `TimeSeriesEffect`: 观点在时间轴上以离散点定义，区间内线性插值，区间外不生效。

## Key rule alignments
- 冲突规则：不以“行业优先级”做最终裁决，先展开为 symbol，再按 symbol 维度合并。
- 时间规则：`[(t0,v0),(t1,v1),...]` 线性插值；`t < t0` 或 `t > tn` 时无影响（effect=0/none）。
