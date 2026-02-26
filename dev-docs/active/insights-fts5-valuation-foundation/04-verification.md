# 04 Verification

## Automated checks
- `2026-02-26` `node -e "... create virtual table ... using fts5 ..."` (workdir=`apps/backend`)
  - Result: fail
  - Notes: `no such module: fts5`，确认当前运行时不支持 FTS5。
- `2026-02-26` `node -e "... using fts4/fts3 ..."` (workdir=`apps/backend`)
  - Result: pass
  - Notes: FTS4/FTS3 可用，验证问题仅在 FTS5 缺失。
- `2026-02-26` `pnpm -C apps/backend build`
  - Result: pass
  - Notes: backend 构建成功；`copy-sql-wasm` 已复制 wasm 到 `apps/backend/dist/sql-wasm.wasm`。
- `2026-02-26` `pnpm -C apps/backend typecheck`
  - Result: pass
  - Notes: backend 类型检查通过。
- `2026-02-26` `pnpm typecheck`
  - Result: pass
  - Notes: shared/backend/frontend 类型检查与 theme contract 均通过。
- `2026-02-26` `shasum -a 256 apps/backend/vendor/sql-wasm-fts5.wasm apps/backend/dist/sql-wasm.wasm`
  - Result: pass
  - Notes: hash 一致，确认构建产物来自 FTS5 vendor wasm。
- `2026-02-26` `node -e "... init sql.js with dist/sql-wasm.wasm ... create virtual table t using fts5 ..."` (workdir=`apps/backend`)
  - Result: pass
  - Notes: 输出 `fts5_runtime_rows 1`，确认运行时 FTS5 生效。
- `2026-02-26` `pnpm -C apps/backend verify:position-engine`
  - Result: pass
  - Notes: 业务路径冒烟通过（100 runs），未引入回归。
- `2026-02-26` `pnpm -C apps/backend verify:fts5`
  - Result: pass
  - Notes: 输出 `[verify-fts5] ok`，后续可作为回归验证入口。

## Manual checks
- [x] backend 运行时可创建 FTS5 virtual table
- [x] 关键词检索最小示例正常
- [ ] 关键词高亮/排序（snippet/bm25）待观点模块落地时补充端到端检查
