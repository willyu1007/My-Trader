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

## 2026-02-26 (implementation kickoff)
- 将任务包从“FTS5 升级收尾”切换到“观点模块 + 估值方法体系实施”。
- 关键实现决策锁定：
  - 作用对象采用开放集合，最终统一 materialize 到 symbol。
  - 估值方法采用 `MethodRegistry + MetricGraph`，通道算子固定 `set/add/mul/min/max`。
  - 冲突合并执行固定阶段 + priority 排序。
  - 时间衰减采用自然日线性插值，区间外无影响。
  - symbol 仍为主键；跨市场同 symbol 执行阻断策略，避免静默覆盖。
  - 前端新增“其他 -> 估值方法”管理台；insights 页面替换 placeholder。

## Active milestones
- [completed] Phase 1: schema + IPC + preload + ipcMain 契约落地
- [completed] Phase 2: backend service（scope/materialize/interpolate/merge/preview）
- [in progress] Phase 3: frontend insights + valuation methods + symbol valuation展示（代码落地完成，待手工验收）

## 2026-02-26 (implementation progress)
- shared: 在 `packages/shared/src/ipc.ts` 增加 insights/valuation 全量类型、IPC channel 常量与 `window.mytrader.insights` API 合约。
- backend schema:
  - `businessSchema` 升级到 v6，新增 insights 相关 6 张业务表 + `insight_fts`（FTS5）+ 触发器。
  - 新增 valuation 方法表、版本表、snapshot 表与索引，并注入 builtin methods seed。
- backend service:
  - 新增 `insightService.ts`，实现观点 CRUD、scope/channel/point 管理、materialization、symbol exclusion、FTS 搜索。
  - 实现 valuation method 管理（list/get/create custom/update/clone/publish/set active）。
  - 实现 `previewValuationBySymbol`（阶段合并、priority 排序、日级线性插值、区间外无影响）。
- backend IPC/preload:
  - `registerIpcHandlers.ts` 增加全部 INSIGHTS/VALUATION handlers。
  - 在解锁账户、tag/watchlist/catalog 变化路径触发 materialization refresh。
  - `preload/index.ts` 暴露完整 `insights` API。
- backend guardrail:
  - `instrumentCatalogRepository.ts` 增加 symbol 冲突守卫：仅同 provider+market+symbol 可覆盖，跨市场冲突抛错阻断。
- frontend:
  - 新增 `InsightsView.tsx` 并接入主导航，替换 `insights` placeholder。
  - 在观点页落地：生命周期编辑、scope/channel/point 管理、materialize 预览、FTS5 搜索、symbol 侧解绑（写 exclusion）。
  - 补充“估值预览链路”：观点页支持直接输入 symbol/asOf/methodKey 调 `previewValuationBySymbol`，展示当前值/调整后值与 effect 链路，并支持从该链路直接解绑当前观点。
  - 新增 `Other -> 估值方法` 页签并接入 `OtherValuationMethodsTab.tsx`。
  - 估值方法页按“资产类型 -> 方法清单”组织，详情区聚焦方法解释、关键参数含义、输入/输出指标、指标层级图（顶层/一阶/二阶/输出/风险）。
  - 版本差异视图简化为“仅展示发生变化的参数项（current vs previous）”；自定义方法默认隐藏（可切换显示），避免偏离“方法认知/调参”为主的目标。
  - 在 `MarketDetailWorkspace` 增加“当前值 vs 调整后值”价值判断卡片，展示应用链路并支持按观点从标的侧解除影响。
  - 统一移除信息界面中与当前模块/子 tab 重复的页面标题文案（如“观点管理”“估值方法管理”“标的管理”“数据分析”），避免与顶部导航/子 tab 重复。
- tooling:
  - 修复 Codex `Run action` 卡住问题：原动作为长驻 `pnpm dev`，执行器会持续等待。
  - 新增后台启动脚本 `scripts/dev-run-action-start.mjs`，支持 PID 文件幂等保护与日志落盘（`.mytrader-dev.log`）。
  - 新增 `status/stop` 脚本（`scripts/dev-run-action-status.mjs`、`scripts/dev-run-action-stop.mjs`）。
  - 更新根脚本与 `.codex/environments/environment.toml`，将 Run 动作改为 `pnpm run dev:run-action`（快速返回，不阻塞动作执行）。
  - 修复 dev 启动期窗口抖动（反复弹窗）：
    - 在 `apps/backend/scripts/dev.mjs` 中将 watcher 首轮输出视为预热，先等待预热完成再启动 Electron；
    - 将热重启能力延后到启动稳定窗口之后再开启；
    - 增加重启冷却时间，避免连续触发重启。
  - 修复 `pnpm exec` 参数传递错误：去掉多余 `--`，确保 `vite --port` 与 `tsup --watch --no-clean` 真实生效。
  - 热重启改为“内容哈希门控”：仅当 `dist/main.js|preload.js|shared dist(index/ipc)` 内容发生变化时才触发重启，避免无效抖动，同时保留“改代码自动生效”。
  - 清理 run-action 过渡逻辑：移除已废弃的环境变量分支（禁用重启模式），统一为“哈希门控 + 自动热重启”单一路径。
- smoke:
  - 新增 `apps/backend/src/main/verifyInsightsE2E.ts` 端到端冒烟脚本，覆盖：
    - 观点生命周期（create/update）
    - scope 多类型展开（symbol/tag/kind/asset_class/market/domain/watchlist + exclude）
    - 通道+时间点线性插值
    - 估值预览（stock/spot/bond）
    - symbol 侧 exclusion / unexclude
    - FTS5 中文关键词命中
  - 新增 `pnpm -C apps/backend verify:insights-e2e` 脚本，并接入 tsup entry。
