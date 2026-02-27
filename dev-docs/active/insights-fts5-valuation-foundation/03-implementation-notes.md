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

## 2026-02-27 (insights 生成/管理双 tab 调整)
- `InsightsView` 从“单页混合”改为两个显式 tab：
  - `生成`：事实文本录入（纯文本、暂不建模）、资讯搜索预留 UI（无后端实现）、草稿生成与创建。
  - `管理`：观点列表 + 详情编辑 + scope/channel/point/materialize/估值预览/FTS5 检索。
- 将 `生成/管理` 切换提升到顶部工作区 tab（原“概览”占位被替换），`InsightsView` 改为受外部 `insightsTab` 状态驱动，不再在页面内重复绘制子 tab 头。
- 管理列表新增关键维度展示：生成时间、影响面、影响标的数量、作用方式、当前算子、有效时间。
- “强度指标”口径统一替换为“当前算子”，并按当前日期对 effect point 做线性插值展示。
- 事实生成草稿逻辑增加去重保护：重复点击“生成观点草稿”不会无限追加事实块，而是替换既有“事实记录（手动）”段。
- 继续遵守“界面不重复模块/子 tab 标题”约束：页面内不再出现与 tab 同名的冗余大标题。

## 2026-02-27 (事实持久化 + 生成页列表管理)
- 后端新增事实持久化链路：
  - business schema 升级到 `v8`，新增表 `insight_facts(id, content, created_at, updated_at)` 与索引。
  - `insightService` 新增 `listInsightFacts/createInsightFact/removeInsightFact`。
  - shared IPC 新增 `InsightFact` 类型与 `INSIGHTS_FACT_LIST/CREATE/DELETE` 通道。
  - preload 与 ipcMain 完成 facts API 暴露与处理。
- 前端生成页改造：
  - 事实改为“新增 + 列表 + 删除”的持久化管理，不再使用页面临时文本。
  - “生成观点草稿”基于已持久化事实列表生成事实区块。
- UI 清理：
  - 移除观点页顶部“全生命周期+...”说明文案与右侧“刷新”按钮（按用户截图要求）。
- 验证补充：
  - 尝试执行 `verify:insights-e2e` 时命中既有 `tsup.config.ts` 语法错误（构建阶段失败），本轮功能实现通过 typecheck，但未在该脚本上形成新的通过记录。

## 2026-02-27 (insights UI 去卡片化重排)
- 按“生成/管理工作台”思路重排 `InsightsView`：
  - `生成`：改为左右分栏，左侧事实表格（新增/删除/时间），右侧草稿编辑区（含资讯搜索预留工具条）。
  - `管理`：改为左右分栏，左侧观点列表表格，右侧详情工作区（`基本信息/作用域/算子与时间轴/预览与检索` 四个二级 tab）。
- 视觉上移除“多卡片堆叠”结构，保留单层容器 + 表格 + 分隔线 + 紧凑工具条，减少样式噪声与扫描成本。
- 保持原有核心能力不变：scope/channel/point/materialize、valuation preview、FTS5 检索均保留。

## 2026-02-27 (insights 提示淡出 + 分栏断点修正)
- 提示信息改为非常驻：
  - `error/notice` 出现后保持可见 3 秒，再触发透明度淡出，随后自动清除内容。
  - 使用 `transition-opacity` 实现渐隐，避免突然消失。
- 分栏断点从 `lg` 下调到 `md`：
  - `生成` 与 `管理` 两个视图均在中等窗口宽度下启用左右分栏。
  - 同步调整左栏分隔线规则（`md:border-r`），避免 Electron 侧栏占宽后仍错误堆叠为上下结构。

## 2026-02-27 (生成页三分区 + 事实批量删除)
- `生成` 页改为三个“标题 + 区域”结构，提升信息分区清晰度：
  - `事实录入`：输入事实 + 资讯搜索预留入口。
  - `事实列表`：列表化展示，标题栏集中放置统计与操作。
  - `观点草稿`：草稿编辑与创建动作独立为全宽区域。
- 事实列表支持多选与批量删除：
  - 新增行级勾选与表头全选。
  - 新增“删除选中”动作，批量调用删除接口并在完成后刷新列表。
  - 列表变动时自动清理失效选中项，避免选择状态残留。

## 2026-02-27 (观点草稿区去卡片外框)
- 按交互要求移除 `生成` 页“观点草稿”区域外层卡片容器样式：
  - 去掉外层 `border/rounded/bg`，保留标题+区域结构；
  - 按无外框样式微调内边距，保持与上方两区一致的阅读节奏。

## 2026-02-27 (事实录入与资讯搜索上下分区)
- `生成` 页左侧输入区改为上下分段：
  - 上段：`事实输入`（输入框 + 新增事实按钮）；
  - 下段：`资讯搜索（预留）`（关键词 + 来源 + 独立按钮行）。
- 修复原三列并排导致的控件挤压问题：搜索按钮从网格列中抽离为独立操作行，避免窄宽度下文案被截断。

## 2026-02-27 (文本输入框高度与可调节性收敛)
- `InsightsView` 中所有 `textarea` 统一改为不可手动拖拽调节高度（`resize-none`）。
- `生成` 页“观点描述（观点论述）”输入框高度从 `min-h-[220px]` 下调到 `min-h-[140px]`，减少无效留白并改善首屏编辑密度。

## 2026-02-27 (资讯搜索标题行操作收敛)
- `生成` 页“资讯搜索”区将操作按钮提升到标题行：
  - 按钮与标题同一行展示；
  - 按钮文案从“资讯搜索(预留)”改为“搜索”。

## 2026-02-27 (观点草稿标签与日期输入重构)
- `生成` 页“观点草稿”表单结构调整为“标题 + 日期区间 + 标签”同一行：
  - 日期输入改为与“交易流水”一致的 `type=date` 双输入样式（`开始 至 结束`）。
  - 标签输入由自由文本改为内置下拉多选（支持全选/清空）。
- 创建观点时标签改为直接提交已选内置标签数组，避免逗号文本解析歧义。

## 2026-02-27 (观点草稿头部对齐修正)
- 根据交互反馈，`日期区间 + 标签多选` 从“标题输入行”迁移到“观点草稿”标题行右侧（与“观点草稿”同一行）。
- 正文首行收敛为“观点标题 + 状态”，避免头部筛选项与正文字段语义混用。

## 2026-02-27 (头部控件简约化)
- `观点草稿` 标题行右侧的“日期区间 + 标签”去除外框强调样式：
  - 日期区间移除外层边框容器，仅保留简洁的 `开始 至 结束` 输入；
  - 标签触发器改为无边框轻量按钮样式，保留下拉多选交互。

## 2026-02-27 (观点默认有效期)
- `生成` 页观点草稿新增默认有效期：
  - `valid_from` 默认当前日期；
  - `valid_to` 默认当前日期 + 1 年。
- 创建成功后重置表单时，日期恢复到同一默认窗口（而非清空）。
