# 02 Architecture

## Context & current state
- Market 当前核心概念：
  - `marketScope = holdings | tags | search`（来源维度）
  - `marketFilterMarket / marketFilterAssetClasses / marketFilterKinds`（筛选维度）
- 当前问题：来源维度与展示分类耦合不足，且默认口径偏 `CN + stock/etf`，对跨资产展示不友好。

## Final design contract

### Core types (frontend)
- `MarketCategoryTab`
  - `"stock" | "etf" | "index" | "spot" | "forex" | "futures" | "bond" | "rate"`
- `MarketFilterMarket`
  - `"all" | "CN" | "FX"`
- `MarketCategoryPreset`
  - `filterMarket`
  - `filterAssetClasses`
  - `filterKinds`
  - `defaultScope`
  - `defaultTag`
  - `construction`（`bond/rate=true`）
  - `constructionTitle?`
  - `constructionDescription?`

### Tab presets (v1)
1. `stock`: `CN + assetClass:stock + kind:stock + defaultScope:holdings`
2. `etf`: `CN + assetClass:etf + kind:fund + defaultScope:holdings`
3. `index`: `CN + kind:index + defaultScope:tags + defaultTag:kind:index`
4. `spot`: `CN + kind:spot + defaultScope:tags + defaultTag:kind:spot`
5. `forex`: `FX + kind:forex + defaultScope:tags + defaultTag:kind:forex`
6. `futures`: `CN + kind:futures + defaultScope:tags + defaultTag:kind:futures`
7. `bond`: `construction=true`
8. `rate`: `construction=true`

### Per-tab memory state
- `marketPerTabState`（session-level，不持久化）
  - 每个 tab 记忆：
    - `scope`
    - `filterMarket`
    - `filterAssetClasses`
    - `filterKinds`
    - `searchInput`
    - `selectedTag`
- 切换规则：
  - 先保存当前 tab 快照
  - 切到目标 tab 时，优先恢复历史；无历史则应用 preset 默认
  - 清理不兼容的 symbol/detail 选择，避免脏状态

### Boundaries & dependency rules
- Allowed dependencies:
  - tab 可以驱动默认筛选和默认 scope
  - 手动筛选继续可用，且按 tab 独立记忆
  - `marketScope` 继续作为来源维度
- Forbidden dependencies:
  - 禁止把 `marketScope` 重定义为分类维度
  - 禁止在本轮引入后端 schema/API 破坏性变更

## Construction mode contract (bond/rate)
- `MarketView`
  - 若当前 tab preset 为 `construction=true`，渲染统一建设中空态
  - 不进入常规 `Sidebar + Detail + Chart` 数据流程
- `MarketDialogs`
  - construction tab 保留入口但只读说明
  - 禁止无效筛选写入

## Modules touched
- `DashboardContainer`：注入默认 tab 与 presets
- `DashboardContainerLayout`：Market 顶部 tab 渲染
- `constants.ts`：`marketCategoryTabs` + `marketCategoryPresets` + 侧栏文案
- `use-dashboard-market.ts`：tab 状态与 per-tab memory
- `use-dashboard-market-orchestration.ts`：preset reset 与 runtime 参数传递
- `use-dashboard-market-data-loaders.ts`：reset 使用当前 tab preset
- `use-dashboard-market-derived.ts`：类型收敛与最终过滤产出
- `MarketView.tsx`：construction mode 短路渲染
- `MarketDialogs.tsx`：按 tab 动态筛选项和 construction 只读模式

## Compatibility and migration
- 无数据库迁移
- 无 IPC 变更
- 旧逻辑可回退点：
  - `tab -> preset` 绑定
  - per-tab scope/filter 记忆
  - construction tab 短路逻辑
