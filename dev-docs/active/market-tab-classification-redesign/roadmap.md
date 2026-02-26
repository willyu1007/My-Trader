# Market Tab Classification Redesign - Roadmap (Synced)

## Goal
- 把 Market 升级为“单层顶部分类 Tab”，不做一级/二级嵌套入口。
- 行业能力从 Market Tab 体系中移除，仅保留侧栏入口（复用 `index-tracking` key，文案改为“行业跟踪”）。

## Locked decisions
1. 侧栏 `index-tracking` 只改文案为“行业跟踪”，不改 key 和路由占位行为。
2. Market 顶部固定 8 个 Tab（顺序）：
   - `股票 / ETF / 指数 / 现货 / 汇率 / 期货 / 债券 / 利率`
3. 手动筛选按 Tab 记忆，不做全局共用。
4. `marketScope` 按 Tab 记忆；首次进入某 Tab 使用该 Tab preset 默认值。
5. `债券 / 利率` v1 可点击，但进入建设中空态，不接入伪数据和现有详情链路。
6. IPC/后端接口本轮不变，保持兼容。

## Scope and impact
- 前端代码改动：
  - `apps/frontend/src/components/dashboard/types.ts`
  - `apps/frontend/src/components/dashboard/constants.ts`
  - `apps/frontend/src/components/dashboard/DashboardContainer.tsx`
  - `apps/frontend/src/components/dashboard/views/DashboardContainerLayout.tsx`
  - `apps/frontend/src/components/dashboard/views/MarketView.tsx`
  - `apps/frontend/src/components/dashboard/views/market/MarketDialogs.tsx`
  - `apps/frontend/src/components/dashboard/hooks/use-dashboard-market.ts`
  - `apps/frontend/src/components/dashboard/hooks/use-dashboard-market-orchestration.ts`
  - `apps/frontend/src/components/dashboard/hooks/use-dashboard-market-data-loaders.ts`
  - `apps/frontend/src/components/dashboard/hooks/use-dashboard-market-derived.ts`
- 文档改动：
  - `dev-docs/active/market-tab-classification-redesign/*`
- 不在本任务内：
  - 新数据源接入
  - 债券/利率真实行情链路
  - 独立行业页面实现

## Milestones
1. Milestone 1: 类型与常量重构（已完成）
   - `MarketCategoryTab`、`MarketCategoryPreset`、`MarketFilterMarket="all|CN|FX"`落地。
2. Milestone 2: Tab 状态与 per-tab memory（已完成）
   - 按 Tab 保存/恢复 scope/filter/search/selectedTag。
3. Milestone 3: 布局与视图绑定（已完成）
   - Market 顶部 8 Tab 接入；`bond/rate` 进入建设中空态；侧栏文案更新为“行业跟踪”。
4. Milestone 4: 验证与任务包同步（进行中）
   - `pnpm typecheck`、`pnpm build` 已通过；待产品侧手工 smoke 验收。

## Verification and acceptance
- 自动检查
  - `pnpm typecheck`：通过
  - `pnpm build`：通过
- 手工验收（待执行）
  - 验证 Market 仅 8 Tab 且无“行业”Tab
  - 验证 side nav 为“行业跟踪”，key 不变
  - 验证 per-tab 手动筛选与 scope 记忆
  - 验证 `bond/rate` 稳定空态
  - 验证其余 6 Tab 搜索/标签/详情/图表链路无回归

## Risks and rollback
| Risk | Mitigation | Rollback |
|---|---|---|
| Tab preset 与手动筛选冲突 | 统一在 derived 层合并 preset + manual filter，且 reset 回到当前 Tab preset | 回退 tab->preset 绑定，恢复旧 filter-only 路径 |
| Tab/scope 语义混并导致状态错乱 | 明确 `tab=资产分类`、`scope=来源维度`，切 Tab 仅应用默认，不覆盖用户后续修改 | 回退 per-tab scope 记忆逻辑 |
| 债券/利率误触发旧详情链路 | construction 模式下短路常规列表/详情流 | 暂时隐藏对应 Tab（最后手段） |
