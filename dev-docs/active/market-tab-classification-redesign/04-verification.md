# 04 Verification

## Automated checks
- `2026-02-26` `pnpm typecheck`
  - Result: pass
  - Notes: shared/frontend/backend typecheck 全部通过；修复过一次 `marketCategoryTab` 键类型不收敛问题后稳定通过。
- `2026-02-26` `pnpm build`
  - Result: pass
  - Notes: frontend/backend 构建成功；存在 chunk size warning（非阻塞）。

## Manual smoke checks
- [ ] 打开 `市场行情` 页面，顶部只显示 8 个 Tab：股票/ETF/指数/现货/汇率/期货/债券/利率。
- [ ] 确认无“行业”Tab；侧栏显示“行业跟踪”，并保持 `index-tracking` 入口行为不变。
- [ ] 首次进入每个 Tab 时，过滤与 scope 命中 preset 默认值。
- [ ] 在任意 Tab 修改手动筛选后，切走再切回能恢复该 Tab 筛选。
- [ ] 在任意 Tab 修改 `scope` 后，切走再切回能恢复该 Tab scope。
- [ ] 切 Tab 后不会残留不兼容的 `selectedSymbol` 详情脏状态。
- [ ] `债券`/`利率` 可点击，稳定进入建设中空态，不报错、不崩溃。
- [ ] `股票/ETF/指数/现货/汇率/期货` 的搜索、标签、详情、图表链路无回归。

## Rollout / Backout (if applicable)
- Rollout:
  - 先完成上述手工 smoke，再进入合并流程。
- Backout:
  - 若出现关键回归，优先回退 `tab -> preset` 绑定与 per-tab memory 逻辑，恢复旧 `marketScope + filter` 路径。
  - 侧栏“行业跟踪”文案可独立保留，不影响功能回退。
