# 01 Plan

## Milestones
### Milestone 1: FTS5 升级路径落地（completed）
- Acceptance
  - 识别当前 `sql.js` 构建不含 FTS5 的根因
  - 引入可复现的 FTS5-enabled 运行时产物
  - 在 backend 启动路径增加能力自检（失败即显式报错）

### Milestone 2: 工程接入与构建验证（completed）
- Acceptance
  - dev/build/start 路径使用新产物
  - `pnpm typecheck`、`pnpm build` 通过
  - 增加最小验证命令记录（FTS5 建表 + 查询）

### Milestone 3: 观点×估值组件契约（in progress）
- Acceptance
  - 方法注册、参数图、算子层、作用域解析、时间插值规则形成书面契约
  - 冲突语义明确为“所有作用最终作用到 symbol，行业/概念只是展开方式”

## Detailed execution checklist
1. 落地 `dev-docs` 任务包并持续记录。
2. 调整 sqlite runtime 依赖或构建方式，确保 FTS5 可用。
3. 增加 FTS5 能力探测与清晰错误提示。
4. 跑通 typecheck/build 与最小运行时验证。
5. 输出观点估值组件的数据契约与合并规则。

## Risks & mitigations
- Risk: 直接替换 SQLite 运行时导致现有仓库 API 行为回归。
  - Mitigation: 保持 `storage/sqlite.ts` 对外函数签名不变。
- Risk: FTS5 编译链依赖复杂导致不可复现。
  - Mitigation: 优先采用可安装的稳定发行包；若需自编译，固定脚本与版本。
- Risk: 估值通道定义后续频繁变更。
  - Mitigation: 使用“metric registry + operator DSL + symbol-level materialization”抽象。
