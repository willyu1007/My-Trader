# 03 Implementation Notes

## Status
- Current status: `in-progress`
- Last updated: 2026-02-10

## What changed
- 初始化 `dashboard-modularization` task bundle。
- 写入 roadmap 与执行计划、架构边界、验证矩阵。
- 记录 baseline（`typecheck/build` 已通过）。
- Phase 1 落地：将原 `apps/frontend/src/components/Dashboard.tsx` 迁移为兼容壳，
  主实现移动到 `apps/frontend/src/components/dashboard/DashboardContainer.tsx`。
- 新增 `apps/frontend/src/components/dashboard/` 目录结构（`types/constants/hooks/views/components/primitives/utils`）。
- 为原语/展示组件/工具函数提供模块出口（当前通过 `DashboardContainer` 导出复用，行为不变）。
- 更新 `apps/frontend/scripts/verify-theme-contract.mjs`：
  - 允许在 `DashboardContainer.tsx` 校验原语。
  - 修复 `export function` 场景下函数块提取逻辑。
- Phase 2 实拆分落地：
  - 新增 `apps/frontend/src/components/dashboard/shared.tsx`，承载原语组件、展示组件与工具函数真实实现。
  - `DashboardContainer.tsx` 删除尾部定义，改为从 `shared.tsx` 导入并使用。
  - `primitives/components/utils` 模块出口从 `DashboardContainer` re-export 改为 `shared.tsx` re-export。
  - `verify-theme-contract` 增加 `shared.tsx` 候选扫描，保证主题契约校验覆盖拆分后主定义位置。
- Phase 2.5 结构收敛：
  - `DashboardContainer.tsx` 改为从 `constants.ts` 与 `types.ts` 引入导航/范围/存储 key 与主视图类型。
  - `views/SidebarNav.tsx`、`views/TopToolbar.tsx`、`views/AccountView.tsx` 实现并接入容器，替换内联 JSX。
- Phase 3 视图实拆分（继续）：
  - `views/RiskView.tsx` 完成真实实现迁移并接线。
  - `views/DataAnalysisView.tsx` 完成真实实现迁移并接线（保持行为不变，容器仅透传）。
  - `views/OtherView.tsx` 完成真实实现迁移并接线（保持行为不变，容器仅透传）。
  - `views/MarketView.tsx` 完成真实实现迁移并接线（保持行为不变，容器仅透传）。
  - `views/PortfolioView.tsx` 完成真实实现迁移并接线（保持行为不变，容器仅透传）。
  - `views/DashboardOverlays.tsx` 抽离容器尾部 overlay（目标池弹窗/详情弹窗/删除确认/全局通知）。
  - `DashboardContainer.tsx` 行数从 `9897` 进一步下降到 `4811`。
- Phase 3 hooks 下沉（本轮）：
  - `hooks/use-dashboard-ui.ts` 接管 `error/notice/activeView/otherTab/analysisTab/isNavCollapsed` 状态。
  - 导航自动折叠副作用（进入/离开 market 视图）从 `DashboardContainer.tsx` 下沉到 `use-dashboard-ui.ts`。
  - `hooks/use-dashboard-portfolio.ts` 接管 portfolio/position/risk/ledger/csv path 相关状态及重置副作用。
  - `hooks/use-dashboard-analysis.ts` 从骨架升级为真实状态 hook，接管 instrument analysis 状态域（查询、结果、选中标的、区间、画像、标签、行情、K 线、加载与错误）。
  - `hooks/use-dashboard-market.ts` 从骨架升级为真实状态 hook，接管 market 主状态域（搜索/筛选/标签/行情/图表/watchlist/token/ingest/详情面板等）。
  - `hooks/use-dashboard-market.ts` 继续下沉 market 高级状态（targets/target-pool/scheduler/universe-pool/registry/ingest-run 选择与 loading flags）。
  - `hooks/use-dashboard-market.ts` 下沉一批 market 副作用：本地持久化（explorer 宽度 / targets split）、hover 重置、临时标的选择集同步。
  - `hooks/use-dashboard-market.ts` 下沉异步请求副作用：`marketSearch` 防抖查询与 `tagSeries` 加载（含 requestId 并发保护）。
  - `hooks/use-dashboard-market.ts` 继续下沉副作用：tag picker 标签拉取、主图 `daily bars` 加载。
  - 新增 `useDashboardMarketRuntimeEffects`（同文件导出）承接容器中的 market 运行时 effect，已接管：按 scope 拉取 quotes（holdings/search）与默认 scope 回退（含 watchlist:all 自动选择）。
  - `useDashboardMarketRuntimeEffects` 继续接管初始化/联动 effect：进入 market 时刷新 watchlist+tags、analysis-instrument 模式下 watchlist 兜底加载、详情面板打开时刷新 manual theme options。
  - `useDashboardMarketRuntimeEffects` 继续接管 ingest run 联动 effect：选中 run 失效自动清理、data-status 下自动刷新选中 run 详情。
  - `useDashboardMarketRuntimeEffects` 继续接管 `other/data-management` 运行时编排：
    - 进入 `other` 子 tab 的初始化刷新（token/targets/ingest/scheduler/universe-pool/registry）。
    - `targets diff` / `target-pool stats` / tag 管理 / registry 的防抖刷新。
    - `data-management` / `data-status` 下 ingest 轮询刷新。
    - 离开 `data-management` 且存在未保存目标池草稿时的导航确认保护。
  - 为避免 `Dispatch<SetStateAction<...>>` 泛型不兼容导致的类型阻断，将 hook 参数收敛为 `restoreDataManagementView()` 单一回调，保持行为不变并修复 typecheck 错误。
  - 新增 `useDashboardMarketManagementActions`（同文件导出），承接容器中的 ingest/scheduler/registry handlers：
    - `handlePause/Resume/CancelMarketIngest`
    - `updateMarketSchedulerConfig` / `handleSaveMarketSchedulerConfig` / `handleRunMarketIngestNow`
    - `handleToggleRegistrySymbol` / `handleToggleSelectAllRegistry`
    - `handleSetRegistryAutoIngest` / `handleBatchSetRegistryAutoIngest`
  - `DashboardContainer.tsx` 删除对应重复 `useState/useEffect`，改为消费 hook 返回值。
  - 新增 `hooks/use-dashboard-market-target-actions.ts`，承接 targets/temp-target 处理器（手动标的预览与应用、临时标的单项/批量操作、目标池保存与重置）。
  - 新增 `hooks/use-dashboard-market-instrument-actions.ts`，承接 instrument/tag/watchlist/demo-seed 处理器（选股/选标签、标签增删、手动主题、自选增删、标的库同步、示例数据注入）。
  - 新增 `hooks/use-dashboard-market-admin-refresh.ts`，承接 token/ingest/scheduler/universe/registry/ingest-detail 刷新函数。
  - 新增 `hooks/use-dashboard-market-target-pool-stats.ts`，承接 `refreshMarketTargetPoolStats` 超长计算逻辑（并发拉取标签成员、分类聚合、focus/universe 结构统计）。
  - 新增 `hooks/use-dashboard-market-data-loaders.ts`，承接 market 数据加载函数（watchlist/tags/manual-themes/quotes/targets/targets-diff）。
  - 新增 `hooks/use-dashboard-market-admin-actions.ts`，承接 token/provider/universe-pool/ingest-trigger 操作函数（含一次类型阻断修复：bucket 参数改为 `MarketUniversePoolConfig["enabledBuckets"][number]`）。
  - 新增 `hooks/use-dashboard-portfolio-actions.ts`，承接 portfolio/position/risk 管理动作函数（创建/重命名/删除组合、持仓 CRUD、风险限额 CRUD）。
  - 新增 `hooks/use-dashboard-ledger-actions.ts`，承接 ledger/csv import 动作函数（编辑、提交、删除确认、持仓与行情 CSV 导入）。
  - `DashboardContainer.tsx` 进一步下降到 `2867` 行；`use-dashboard-market.ts` `1360` 行，`use-dashboard-market-target-actions.ts` `420` 行，`use-dashboard-market-instrument-actions.ts` `397` 行，`use-dashboard-market-admin-refresh.ts` `227` 行，`use-dashboard-market-target-pool-stats.ts` `271` 行，`use-dashboard-market-data-loaders.ts` `235` 行，`use-dashboard-market-admin-actions.ts` `230` 行，`use-dashboard-portfolio-actions.ts` `287` 行，`use-dashboard-ledger-actions.ts` `482` 行。
  - 新增 `hooks/use-dashboard-portfolio-runtime.ts`，承接 `loadPortfolios/loadSnapshot/loadLedgerEntries/loadPerformance` 与其相关 lifecycle effects。
  - 新增 `hooks/use-dashboard-analysis-runtime.ts`，承接 `loadAnalysisInstrument`、instrument 搜索防抖、副作用自动选中逻辑（requestId 并发保护保持不变）。
  - `DashboardContainer.tsx` 继续下降到 `2670` 行；新增 runtime hooks 行数：`use-dashboard-portfolio-runtime.ts` `213` 行、`use-dashboard-analysis-runtime.ts` `199` 行。
  - 新增 `hooks/use-dashboard-market-resize.ts`，承接 market explorer/targets editor 的 resize refs、pointer/keyboard handlers 与拖拽生命周期副作用。
  - 新增 `hooks/use-dashboard-ui-effects.ts`，承接容器通用 UI 副作用（market 详情面板收敛、portfolio tab 重置、contribution 展开状态重置、toast 自动消失）。
  - `DashboardContainer.tsx` 继续下降到 `2522` 行；新增 hooks 行数：`use-dashboard-market-resize.ts` `211` 行、`use-dashboard-ui-effects.ts` `63` 行。
  - 新增 `hooks/use-dashboard-market-target-pool-detail.ts`，承接 target-pool detail 计算与交互（metric cards、detail rows、member filter、category 同步、副作用与 section toggle）。
  - `DashboardContainer.tsx` 继续下降到 `2324` 行；新增 hook 行数：`use-dashboard-market-target-pool-detail.ts` `312` 行。
  - 新增 `hooks/use-dashboard-market-derived.ts`，承接 market 视图衍生计算（symbol/meta 过滤、scope/symbol 集合、tag series 统计、主图 range summary、持仓成本与目标价）。
  - 新增 `hooks/use-dashboard-analysis-derived.ts`，承接 analysis instrument 衍生计算（symbol-name map、quick symbols、range summary、持仓成本、目标价、tone）。
  - `DashboardContainer.tsx` 继续下降到 `1995` 行；新增 hooks 行数：`use-dashboard-market-derived.ts` `381` 行、`use-dashboard-analysis-derived.ts` `172` 行。
  - 新增 `hooks/use-dashboard-portfolio-derived.ts`，承接 portfolio/ledger/toast/performance 派生计算（`cashTotal`、`filteredLedgerEntries`、`cashFlowTotals`、`selectedPerformance` 等）。
  - `DashboardContainer.tsx` 继续下降到 `1939` 行；新增 hook 行数：`use-dashboard-portfolio-derived.ts` `135` 行。
  - 顶部本地类型/常量收敛：将 `PositionFormState` 等领域类型迁入 `types.ts`，将 `UNIVERSE_POOL_BUCKET_ORDER`、`TARGET_POOL_STRUCTURE_EMPTY`、`assetClassLabels`、`ledgerEventTypeOptions` 等迁入 `constants.ts`。
  - `DashboardContainer.tsx` 继续下降到 `1793` 行。
  - 继续进行容器 props 收敛：`analysisState`、`marketState`、`portfolioState` 统一保留为状态对象，并在 `PortfolioView`/`DataAnalysisView`/`MarketView`/`OtherView`/`DashboardOverlays` 透传处改为优先使用 `...state`，删除大段重复枚举。
  - 修复本轮阻断：清理 `portfolioState` 解构中的未使用字段（`ledgerLoading`、`ledgerError`、`setLedgerFilter`、`setLedgerStartDate`、`setLedgerEndDate`、`isLedgerFormOpen`），恢复 `typecheck` 通过。
  - `DashboardContainer.tsx` 继续下降到 `1563` 行。
  - 新增 `hooks/use-dashboard-market-admin-derived.ts`，将 market 管理区块派生状态从容器下沉（ingest/scheduler/targets diff/universe pool 衍生计算与布尔门控）。
  - `DashboardContainer.tsx` 继续下降到 `1492` 行。
  - 新增 `hooks/use-dashboard-portfolio-state.ts`，将 active portfolio 解析、`useDashboardPortfolio` 初始化与 `onActivePortfolioChange` 副作用从容器下沉。
  - `DashboardContainer.tsx` 继续下降到 `1475` 行。
  - 新增 `hooks/use-dashboard-market-orchestration.ts`，将 market 编排层（data loaders/admin refresh/admin actions/instrument actions/target actions/management actions/runtime effects）从容器下沉为单一组合 hook。
  - `DashboardContainer.tsx` 继续下降到 `1146` 行。
  - 新增 `views/DashboardContainerLayout.tsx`，将 `DashboardContainer` 内部主渲染壳（导航/toolbar/tabs/各视图条件渲染/overlays）整体迁出，容器仅负责状态编排与数据装配。
  - 将容器内多段 `derived/actions/orchestration` 调用从大解构改为对象持有，减少中间变量噪音并降低容器体积。
  - `DashboardContainer.tsx` 继续下降到 `547` 行，达成本阶段 `<= 800` 目标。
- 回归结果：
  - `pnpm -C apps/frontend typecheck` ✅
  - `pnpm -C apps/frontend build` ✅
  - `pnpm -C apps/frontend verify:theme` ✅

## Files/modules touched (high level)
- `dev-docs/active/dashboard-modularization/roadmap.md`
- `dev-docs/active/dashboard-modularization/00-overview.md`
- `dev-docs/active/dashboard-modularization/01-plan.md`
- `dev-docs/active/dashboard-modularization/02-architecture.md`
- `dev-docs/active/dashboard-modularization/03-implementation-notes.md`
- `dev-docs/active/dashboard-modularization/04-verification.md`
- `dev-docs/active/dashboard-modularization/05-pitfalls.md`
- `apps/frontend/src/components/Dashboard.tsx`
- `apps/frontend/src/components/dashboard/index.ts`
- `apps/frontend/src/components/dashboard/DashboardContainer.tsx`
- `apps/frontend/src/components/dashboard/shared.tsx`
- `apps/frontend/src/components/dashboard/types.ts`
- `apps/frontend/src/components/dashboard/constants.ts`
- `apps/frontend/src/components/dashboard/hooks/*`
- `apps/frontend/src/components/dashboard/views/*`
- `apps/frontend/src/components/dashboard/views/portfolio/*`
- `apps/frontend/src/components/dashboard/components/*`
- `apps/frontend/src/components/dashboard/primitives/*`
- `apps/frontend/src/components/dashboard/utils/*`
- `apps/frontend/scripts/verify-theme-contract.mjs`

## Decisions & tradeoffs
- Decision:
  - 先进行兼容入口迁移，再做内部模块化拆分。
  - Rationale:
    - 先稳定外部接口，可降低后续大规模移动风险。
  - Alternatives considered:
    - 一次性抽 hooks + views（风险更高）。
- Decision:
  - `components/Dashboard.tsx` 只保留 re-export，路径明确写成 `./dashboard/index`。
  - Rationale:
    - 在大小写不敏感文件系统下，`./dashboard` 会与 `Dashboard.tsx` 发生同名解析冲突并自引用。
  - Alternatives considered:
    - 目录改名（会偏离既定目标布局）。

## Deviations from plan
- Change:
  - 目前四个 domain hooks（`ui/portfolio/analysis/market`）均已进入真实接线；其中 market 的副作用与请求编排仍主要保留在容器。
  - Why:
    - 先下沉状态，再逐步下沉高复杂度副作用，降低一次性迁移风险。
  - Impact:
    - hooks 下沉模式已成型；后续重点转向 market 副作用与超大透传对象收敛。

## Known issues / follow-ups
- 后续需重点关注 market 视图拆分时的状态时序一致性。
- `DashboardContainer.tsx` 当前 `547` 行，已低于 `800`；后续重点从“减行”转向“类型收敛与 props/view-model 清晰化”（当前 layout/orchestration 使用了宽类型入口，需逐步收紧）。

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in `05-pitfalls.md` (append-only).
