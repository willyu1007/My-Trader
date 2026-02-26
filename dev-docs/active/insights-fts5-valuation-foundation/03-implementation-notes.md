# 03 Implementation Notes

## 2026-02-26
- 创建任务包 `insights-fts5-valuation-foundation`。
- 确认当前现状：`sql.js` 默认构建不支持 FTS5（本地验证失败），支持 FTS4。
- 确认 `sql.js` 官方文档支持通过编译参数 `-DSQLITE_ENABLE_FTS5` 启用。
- 采用“保留现有 sql.js 运行时 API + 替换为自编译 FTS5 wasm”策略，避免大范围重构。
- 基于 `sql.js v1.13.0` 源码本地编译 FTS5 版本 wasm，并落库为 `apps/backend/vendor/sql-wasm-fts5.wasm`。
- 调整 `apps/backend/scripts/copy-sql-wasm.mjs`：优先复制 vendor 的 FTS5 wasm，缺失时回退 node_modules 默认 wasm。
- 在 `apps/backend/src/main/storage/sqlite.ts` 增加 FTS5 启动探测（首次打开 DB 执行 probe），无 FTS5 时显式报错并阻断运行。
- 新增 `apps/backend/scripts/verify-fts5.mjs` 与 npm script `verify:fts5`，用于一键回归验证 FTS5 能力。

## Pending milestones
- 完成观点×估值组件契约的细化（方法注册、算子合并、作用域展开、时间插值）。
