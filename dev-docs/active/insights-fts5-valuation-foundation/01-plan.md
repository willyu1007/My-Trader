# 01 Plan

## Milestones
### Milestone 1: Phase 0 - FTS5 验收与任务包就绪（completed）
- Acceptance
  - `verify:fts5` 通过
  - 任务包更新为可实施状态

### Milestone 2: Phase 1 - Schema + IPC 契约（in progress）
- Acceptance
  - 新增 insights/valuation 业务表、索引、FTS 触发器
  - 新增 shared IPC 类型与 channel
  - preload + ipcMain 注册新能力

### Milestone 3: Phase 2 - Backend service（pending）
- Acceptance
  - 观点 CRUD / 搜索 / scope/channel/point 管理
  - scope 展开并收敛到 symbol materialization
  - 时间插值 + 阶段冲突合并 + exclusion 生效
  - valuation methods 管理与 preview by symbol

### Milestone 4: Phase 3 - Frontend 落位（pending）
- Acceptance
  - insights 页面替换 placeholder
  - other 新增“估值方法”tab
  - 标的详情展示 base vs adjusted 与 applied effects

### Milestone 5: Phase 4 - 联调验收（pending）
- Acceptance
  - `pnpm typecheck` / `pnpm build` 通过
  - 关键场景手工验收通过（CRUD/搜索/materialization/插值/冲突/展示）

## Risks & mitigations
- Risk: scope 展开规则与现有标签体系不完全一致。
  - Mitigation: 先支持 `symbol/tag/kind/asset_class/market/domain/watchlist`，其余类型返回空集合并记录 reason。
- Risk: symbol 维度主键在跨市场同码下出现冲突。
  - Mitigation: 执行“同 provider+market 可覆盖；跨市场同 symbol 阻断并报错”的保护。
- Risk: 估值 preview 引擎早期不具备完整因子数据。
  - Mitigation: 采用“已接入域完整公式 + 未接入域模板占位 + not_applicable”策略，保持协议稳定。
