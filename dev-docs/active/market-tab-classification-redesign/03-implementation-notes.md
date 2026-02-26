# 03 Implementation Notes

## Status
- Current status: implemented (awaiting manual smoke sign-off)
- Last updated: 2026-02-26

## What changed
### 2026-02-25 (planning)
- 创建任务包 `dev-docs/active/market-tab-classification-redesign/`。
- 锁定方向：Market 使用单层顶部 Tab，不引入一级分类入口。
- 锁定原则：`tab=资产分类`，`marketScope=来源维度`，语义正交。

### 2026-02-26 (implementation)
- `types.ts`
  - 新增 `MarketCategoryTab`。
  - 新增 `MarketCategoryPreset`。
  - `MarketFilterMarket` 扩展为 `"all" | "CN" | "FX"`。
- `constants.ts`
  - 新增 `marketCategoryTabs`（8 tab）。
  - 新增 `marketCategoryPresets`（含 `bond/rate` construction 配置）。
  - 侧栏 `index-tracking` 文案改为“行业跟踪”。
- `use-dashboard-market.ts`
  - 新增 `marketCategoryTab` 与 `setMarketCategoryTab`。
  - 引入 `marketPerTabState`（scope/filter/search/selectedTag 按 Tab 记忆）。
  - 切 Tab 时执行“保存当前 -> 恢复目标/应用 preset -> 清理不兼容选中态”。
- `use-dashboard-market-runtime effects` / orchestration / loaders
  - runtime 参数补充 `marketCategoryTab` 等上下文。
  - `resetMarketFilters` 改为“重置到当前 tab preset”，不再硬编码回全局默认。
- `DashboardContainerLayout.tsx`
  - 在 `activeView=market` 时渲染顶部 Tab 条（复用现有 top-tabs 模式）。
- `MarketView.tsx`
  - `bond/rate` 渲染建设中空态，短路常规列表/详情流程。
- `MarketDialogs.tsx`
  - 根据当前 tab 动态显示可用筛选项。
  - construction tab 显示只读说明，禁用无效筛选交互。

## Files/modules touched (high level)
- Frontend source
  - `apps/frontend/src/components/dashboard/types.ts`
  - `apps/frontend/src/components/dashboard/constants.ts`
  - `apps/frontend/src/components/dashboard/DashboardContainer.tsx`
  - `apps/frontend/src/components/dashboard/views/DashboardContainerLayout.tsx`
  - `apps/frontend/src/components/dashboard/views/MarketView.tsx`
  - `apps/frontend/src/components/dashboard/views/market/MarketDialogs.tsx`
  - `apps/frontend/src/components/dashboard/hooks/use-dashboard-market.ts`
  - `apps/frontend/src/components/dashboard/hooks/use-dashboard-market-derived.ts`
  - `apps/frontend/src/components/dashboard/hooks/use-dashboard-market-orchestration.ts`
  - `apps/frontend/src/components/dashboard/hooks/use-dashboard-market-data-loaders.ts`
- Dev docs
  - `dev-docs/active/market-tab-classification-redesign/roadmap.md`
  - `dev-docs/active/market-tab-classification-redesign/00-overview.md`
  - `dev-docs/active/market-tab-classification-redesign/01-plan.md`
  - `dev-docs/active/market-tab-classification-redesign/02-architecture.md`
  - `dev-docs/active/market-tab-classification-redesign/03-implementation-notes.md`
  - `dev-docs/active/market-tab-classification-redesign/04-verification.md`
  - `dev-docs/active/market-tab-classification-redesign/05-pitfalls.md`

## Decisions & tradeoffs
- Decision: 取消一级分类，仅保留单层顶部分类 Tab。
  - Rationale: 用户操作路径更短，认知负担更低，且更接近现有“投资组合”交互习惯。
  - Alternatives considered: 一级+二级双层分类（放弃）。
- Decision: 保留 `marketScope` 的来源语义，不被 tab 替代。
  - Rationale: 避免破坏现有持仓/标签/搜索流程，降低回归风险。
  - Alternatives considered: 用 tab 直接吞并 scope 语义（放弃）。
- Decision: `bond/rate` 先做 construction mode，可点击但无伪数据。
  - Rationale: 先稳定交互框架，不引入低质量或误导数据。
  - Alternatives considered: 直接隐藏 tab；强行复用 stock 流程。
- Decision: 手动筛选按 Tab 记忆，reset 回当前 Tab preset。
  - Rationale: 既保留高级覆盖能力，又避免跨资产状态污染。
  - Alternatives considered: 全局共用筛选；切 Tab 后强制清空。

## Deviations from plan
- 无功能性偏离；仅在实现中补充了类型收敛和 reset preset 回归保护。

## Known issues / follow-ups
- 待办：执行并记录完整手工 smoke（8 Tab + 详情链路 + construction tabs）。
- 后续任务：债券/利率真实数据接入（数据源、模型、管线、详情页能力矩阵）。
- 后续任务：行业跟踪独立功能页（当前仅完成侧栏文案迁移）。

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in `05-pitfalls.md` (append-only).
