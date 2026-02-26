# 01 Plan

## Milestones
### Milestone 1: 类型与常量层（completed）
- Acceptance
  - 明确 8 Tab 集合与顺序：`股票/ETF/指数/现货/汇率/期货/债券/利率`
  - `MarketCategoryTab` 与 `MarketCategoryPreset` 落地
  - `MarketFilterMarket` 扩展到 `all|CN|FX`

### Milestone 2: 状态层 per-tab 记忆（completed）
- Acceptance
  - 增加 `marketCategoryTab`、`setMarketCategoryTab`
  - 按 Tab 记忆 `scope/filter/search/selectedTag`
  - 切 Tab 时先保存当前 Tab，再恢复目标 Tab；无历史则应用 preset

### Milestone 3: 布局与视图联动（completed）
- Acceptance
  - `DashboardContainerLayout` 在 `activeView=market` 渲染顶部 Tab 条
  - 侧栏 `index-tracking` 文案改为“行业跟踪”
  - `MarketView` 对 `bond/rate` 渲染统一建设中空态
  - `MarketDialogs` 对 construction tabs 只读显示说明

### Milestone 4: 派生逻辑与稳定性（completed）
- Acceptance
  - derived 层合并 `tab preset + manual filters`
  - `tab` 与 `scope` 保持正交，不互相覆盖语义
  - 切 Tab 清理不兼容选中状态，避免详情脏态

### Milestone 5: 验证与交付（in progress）
- Acceptance
  - `pnpm typecheck` 通过
  - `pnpm build` 通过
  - 8 Tab 手工 smoke 完成并记录
  - 回退策略保持可执行

## Detailed execution checklist
1. `types.ts` 增加 `MarketCategoryTab`，扩展 `MarketFilterMarket`。
2. `constants.ts` 增加 `marketCategoryTabs` 与 `marketCategoryPresets`，并改侧栏文案。
3. `use-dashboard-market.ts` 接入 `marketPerTabState` 和 Tab 切换保存/恢复。
4. `DashboardContainerLayout.tsx` 渲染 Market 顶部 Tab。
5. `MarketView.tsx` 接入 `bond/rate` construction 空态。
6. `MarketDialogs.tsx` 按 Tab 动态筛选项，并对 construction tab 只读。
7. `use-dashboard-market-derived.ts` 与 orchestration/data-loader 完成 preset + manual 合并和 reset 行为。
8. 完成自动检查与手工 smoke 记录。

## Risks & mitigations
- Risk: tab preset 与筛选弹层冲突，导致空列表难解释。
  - Mitigation: 统一在 derived 合并逻辑；reset 回到当前 tab preset。
- Risk: `tab` 与 `scope` 语义混并导致状态漂移。
  - Mitigation: 切换 tab 仅应用默认；后续用户手动 scope 修改在该 tab 内独立记忆。
- Risk: bond/rate 进入旧详情流程造成错误。
  - Mitigation: construction mode 在 `MarketView` 层短路主流程。
