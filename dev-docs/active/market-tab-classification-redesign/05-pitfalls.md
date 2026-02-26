# 05 Pitfalls (do not repeat)

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)
- Do not merge `tab` semantics into `marketScope`; keep classification and source dimensions separate.
- Do not let filter reset ignore current tab presets; reset must be tab-aware.
- Do not route `bond/rate` through legacy list/detail flow in v1; keep construction mode short-circuit.
- Do not hide manual filters when introducing tabs; users need an override path.

## Pitfall log (append-only)

### 2026-02-25 - Task bundle initialized
- Symptom:
  - N/A (initial documentation stage)
- Context:
  - Created documentation bundle before implementation.
- What we tried:
  - N/A
- Why it failed (or current hypothesis):
  - N/A
- Fix / workaround (if any):
  - N/A
- Prevention (how to avoid repeating it):
  - Keep this log updated whenever a real dead-end or resolved failure appears.
- References (paths/commands/log keywords):
  - `dev-docs/active/market-tab-classification-redesign/*`

### 2026-02-26 - Type narrowing regression in runtime effects
- Symptom:
  - `pnpm typecheck` 首次失败，`marketCategoryTab` 被推断为 `string`，无法作为 preset record 的安全 key。
- Context:
  - 新增 `marketCategoryPresets` 后，runtime effect 选项类型未同步更新。
- What we tried:
  - 先在使用点强转 key，能临时通过但会降低类型保护。
- Why it failed (or current hypothesis):
  - 根因是接口定义过宽，非调用点问题；强转会掩盖未来错误。
- Fix / workaround (if any):
  - 在 `UseDashboardMarketRuntimeEffectsOptions` 中把 `marketCategoryTab` 明确为 `MarketCategoryTab`。
- Prevention (how to avoid repeating it):
  - 增加新 enum/union 驱动的状态字段时，必须同步收敛 orchestration/runtime 的 options 类型。
- References (paths/commands/log keywords):
  - `apps/frontend/src/components/dashboard/hooks/use-dashboard-market.ts`
  - `pnpm typecheck`

### 2026-02-26 - Filter reset semantics drift
- Symptom:
  - 切换到非股票 tab 后执行筛选重置，状态会回到全局默认而不是当前 tab preset。
- Context:
  - 历史 `resetMarketFilters` 逻辑硬编码 `market=all + empty kinds/classes`。
- What we tried:
  - 维持原硬编码并在切 tab 时额外覆盖。
- Why it failed (or current hypothesis):
  - reset 入口不止一处触发，补丁式覆盖容易遗漏并产生不一致。
- Fix / workaround (if any):
  - 在 loader 层引入 `resolveFilterResetPreset()`，由当前 `marketCategoryTab` 计算 reset 目标。
- Prevention (how to avoid repeating it):
  - 所有“重置”语义必须从单一 source-of-truth（tab preset）导出，禁止散落硬编码默认值。
- References (paths/commands/log keywords):
  - `apps/frontend/src/components/dashboard/hooks/use-dashboard-market-data-loaders.ts`
  - `apps/frontend/src/components/dashboard/hooks/use-dashboard-market-orchestration.ts`
