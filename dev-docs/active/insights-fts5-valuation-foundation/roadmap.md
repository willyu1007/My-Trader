# Roadmap

## Objective
- 先完成 FTS5 能力升级，再固化“观点影响估值参数”的可扩展契约，给后续观点模块实现打底。

## Milestones
1. FTS5 runtime upgrade
2. Build/typecheck verification
3. Valuation-component contract alignment

## Rollback strategy
- 若 FTS5 方案引入不兼容，回退到现有 sqlite runtime，并保留契约文档不回退。
