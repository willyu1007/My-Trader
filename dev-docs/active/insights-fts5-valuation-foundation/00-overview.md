# 00 Overview

## Status
- State: fts5-implementation-complete
- Last updated: 2026-02-26
- Next step: 输出观点×估值组件的可扩展模型草案并完成语义对齐

## Goal
- 升级本地 SQLite 全文检索能力到 FTS5。
- 为“观点作用到估值参数”建立可扩展的数据模型，避免后续频繁改通道定义。

## Non-goals
- 本任务不实现完整观点 UI 与全量业务流程。
- 本任务不实现完整估值计算引擎（仅定义组件化与数据契约）。
- 本任务不做云端同步与多用户协作。

## Context
- 当前仓库使用 `sql.js`（WASM）作为业务库运行时。
- 现状验证：`FTS4` 可用，`FTS5` 不可用。
- 观点模块目前为占位页面，后端无观点实体与索引模型。

## Acceptance criteria (high level)
- [x] 运行时支持 `create virtual table ... using fts5(...)`。
- [x] 构建与 typecheck 通过。
- [ ] 形成“估值方法尽可能全面 + 观点算子可扩展 + 最终落到具体标的”的设计契约。
- [ ] 时间衰减机制对齐为“时间点数值 + 线性插值 + 区间外无影响”。
