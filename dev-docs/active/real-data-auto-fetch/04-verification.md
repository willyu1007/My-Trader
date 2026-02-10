# 04 Verification

## Automated checks
- `pnpm typecheck` -> expect exit 0
- `pnpm build` -> expect exit 0

## Runs (recorded)
- 2026-01-28: `pnpm typecheck` -> ✅ (exit 0)
- 2026-01-28: `pnpm build` -> ✅ (exit 0)
- 2026-02-01: `pnpm typecheck` -> ✅ (ingest_runs + token IPC + scheduler + DuckDB-WASM)
- 2026-02-01: `pnpm build` -> ✅ (ingest_runs + token IPC + scheduler + DuckDB-WASM)
- 2026-02-01: `pnpm typecheck` -> ✅ (fix scheduler missing-token unhandled rejection)
- 2026-02-01: `pnpm build` -> ✅ (fix scheduler missing-token unhandled rejection)
- 2026-02-01: `pnpm typecheck` -> ✅ (market data status UI: token + ingest_runs)
- 2026-02-01: `pnpm build` -> ✅ (market data status UI: token + ingest_runs)
- 2026-02-01: `pnpm typecheck` -> ✅ (UI polish: token source labels)
- 2026-02-01: `pnpm typecheck` -> ✅ (move market tools to Other tabs; remove date-range ingest UI)
- 2026-02-01: `pnpm build` -> ✅ (move market tools to Other tabs; remove date-range ingest UI)
- 2026-02-01: `pnpm typecheck` -> ✅ (theme scheme B: warm dark background)
- 2026-02-01: `pnpm build` -> ✅ (theme scheme B: warm dark background)
- 2026-02-01: `pnpm typecheck` -> ✅ (warm card surfaces + raised inputs; reduce blue cast in panels)
- 2026-02-01: `pnpm build` -> ✅ (warm card surfaces + raised inputs; reduce blue cast in panels)
- 2026-02-01: `pnpm typecheck` -> ✅ (apply B2 globally: remove slate-tinted dark surfaces; raised inputs)
- 2026-02-01: `pnpm build` -> ✅ (apply B2 globally: remove slate-tinted dark surfaces; raised inputs)
- 2026-02-01: `pnpm typecheck` -> ✅ (fix “添加” button wrap/layout)
- 2026-02-01: `pnpm build` -> ✅ (fix “添加” button wrap/layout)
- 2026-02-01: `pnpm typecheck` -> ✅ (warm “最新行情日期” banner background)
- 2026-02-01: `pnpm build` -> ✅ (warm “最新行情日期” banner background)
- 2026-02-01: `pnpm typecheck` -> ✅ (global checkbox/radio accent tone)
- 2026-02-01: `pnpm build` -> ✅ (global checkbox/radio accent tone)
- 2026-02-01: `pnpm typecheck` -> ✅ (market sidebar: dropdowns + filter button; date in title)
- 2026-02-01: `pnpm build` -> ✅ (market sidebar: dropdowns + filter button; date in title)
- 2026-02-01: `pnpm typecheck` -> ✅ (market UI follow-ups: merged dropdown; portfolio next to username; lower date)
- 2026-02-01: `pnpm build` -> ✅ (market UI follow-ups: merged dropdown; portfolio next to username; lower date)
- 2026-02-01: `pnpm typecheck` -> ✅ (market sidebar compact spacing; dropdown row ~70% height)
- 2026-02-01: `pnpm build` -> ✅ (market sidebar compact spacing; dropdown row ~70% height)
- 2026-02-01: `pnpm typecheck` -> ✅ (market dropdown: always-down popover + distinct styling)
- 2026-02-01: `pnpm build` -> ✅ (market dropdown: always-down popover + distinct styling)
- 2026-02-01: `pnpm typecheck` -> ✅ (market dropdown full-width + overlay filter button)
- 2026-02-01: `pnpm build` -> ✅ (market dropdown full-width + overlay filter button)
- 2026-02-01: `pnpm typecheck` -> ✅ (market sidebar: tighter padding; lighter search; conditional status row)
- 2026-02-01: `pnpm build` -> ✅ (market sidebar: tighter padding; lighter search; conditional status row)
- 2026-02-02: `pnpm typecheck` -> ✅ (market sidebar: unified search+collection frame, no gap)
- 2026-02-02: `pnpm build` -> ✅ (market sidebar: unified search+collection frame, no gap)
- 2026-02-02: `pnpm typecheck` -> ✅ (market sidebar: widen unified control with -mx-1)
- 2026-02-02: `pnpm build` -> ✅ (market sidebar: widen unified control with -mx-1)
- 2026-02-02: `pnpm typecheck` -> ✅ (market sidebar: unified control full width / edge-to-edge)
- 2026-02-02: `pnpm build` -> ✅ (market sidebar: unified control full width / edge-to-edge)
- 2026-02-02: `pnpm typecheck` -> ✅ (market sidebar: unified control square corners; align search/select padding)
- 2026-02-02: `pnpm build` -> ✅ (market sidebar: unified control square corners; align search/select padding)
- 2026-02-02: `pnpm typecheck` -> ✅ (market sidebar: header no padding; unified control true full-bleed)
- 2026-02-02: `pnpm build` -> ✅ (market sidebar: header no padding; unified control true full-bleed)
- 2026-02-02: `pnpm typecheck` -> ✅ (market sidebar: remove double focus lines; reduce search padding)
- 2026-02-02: `pnpm build` -> ✅ (market sidebar: remove double focus lines; reduce search padding)
- 2026-02-02: `pnpm typecheck` -> ✅ (Other tabs: remove icons; center text)
- 2026-02-02: `pnpm build` -> ✅ (Other tabs: remove icons; center text)
- 2026-02-02: `pnpm typecheck` -> ✅ (Other/Data Management: remove explanatory helper copy)
- 2026-02-02: `pnpm build` -> ✅ (Other/Data Management: remove explanatory helper copy)
- 2026-02-02: `pnpm typecheck` -> ✅ (Other/Data Management: plan2 reorder + top dashboard; move import to Test)
- 2026-02-02: `pnpm build` -> ✅ (Other/Data Management: plan2 reorder + top dashboard; move import to Test)
- 2026-02-02: `pnpm typecheck` -> ✅ (Other/Data Management: add latest ingest time/status; move actions into cards)
- 2026-02-02: `pnpm build` -> ✅ (Other/Data Management: add latest ingest time/status; move actions into cards)
- 2026-02-02: `pnpm typecheck` -> ✅ (Other/Data Management: refresh/save first row; auto-ingest scope dropdown; manual ingest one-row; Chinese labels)
- 2026-02-02: `pnpm build` -> ✅ (Other/Data Management: refresh/save first row; auto-ingest scope dropdown; manual ingest one-row; Chinese labels)
- 2026-02-02: `pnpm typecheck` -> ✅ (Other/Data Management: remove English tag placeholder)
- 2026-02-02: `pnpm build` -> ✅ (Other/Data Management: remove English tag placeholder)
- 2026-02-03: `pnpm typecheck` -> ✅ (auto-ingest 写 ingest_runs + scheduler/manual mode 标识 + DuckDB trade_calendar 同步 + 侧边栏数据状态入口)
- 2026-02-03: `pnpm build` -> ✅ (auto-ingest 写 ingest_runs + scheduler/manual mode 标识 + DuckDB trade_calendar 同步 + 侧边栏数据状态入口)
- 2026-02-03: `pnpm typecheck` -> ✅ (fix instrument catalog upsert chunking for SQLite param limit)
- 2026-02-03: `pnpm build` -> ✅ (fix instrument catalog upsert chunking for SQLite param limit)
- 2026-02-03: `pnpm dlx tsx /tmp/mytrader-manual-check.ts` (cwd=`apps/backend`) -> ✅ (missing token 触发 targets/universe/on_demand run=failed 记录; upsertInstrumentProfiles 1200 OK)
- 2026-02-03: `MYTRADER_TUSHARE_TOKEN=invalid_token pnpm dlx tsx /tmp/mytrader-token-test.ts` (cwd=`apps/backend`) -> ✅ (env token 解析 OK；testToken 失败提示可读且不泄露 token)
- 2026-02-04: `pnpm typecheck` -> ✅ (Temp Targets + remove sidebar Data Status + dev server port fix)
- 2026-02-04: `pnpm build` -> ✅ (Temp Targets + remove sidebar Data Status + dev server port fix)
- 2026-02-04: `pnpm dev` -> ✅ (5173 被占用时 Vite 自动切换至 5174；Electron 启动并注入 preload)
- 2026-02-08: `pnpm -C packages/shared build` -> ✅ (新增 IPC 类型与 channel 编译通过)
- 2026-02-08: `pnpm -C apps/backend typecheck` -> ✅ (ingest orchestrator + scheduler/control + registry IPC)
- 2026-02-08: `pnpm -C apps/frontend typecheck` -> ✅ (Other/数据管理 UI 重构 + 新 IPC 调用)
- 2026-02-08: `pnpm typecheck` -> ✅ (shared/backend/frontend 联合类型校验通过)
- 2026-02-08: `pnpm -C apps/backend build && pnpm -C apps/frontend build` -> ✅ (前后端构建通过)
- 2026-02-09: `pnpm -C /Volumes/DataDisk/Project/MyTrader/packages/shared build` -> ✅（新增 Universe Pool IPC 类型与 channel）
- 2026-02-09: `pnpm -C /Volumes/DataDisk/Project/MyTrader/apps/backend typecheck` -> ✅（Universe Pool 配置存储 + runner 过滤 + IPC handlers）
- 2026-02-09: `pnpm -C /Volumes/DataDisk/Project/MyTrader/apps/frontend typecheck` -> ✅（数据来源区并入全量池配置 + 全量标的统计口径联动）
- 2026-02-09: `pnpm -C /Volumes/DataDisk/Project/MyTrader/apps/backend build` -> ✅（后端构建通过）
- 2026-02-09: `pnpm -C /Volumes/DataDisk/Project/MyTrader/apps/frontend build` -> ✅（前端构建通过）
- 2026-02-09: `pnpm -C /Volumes/DataDisk/Project/MyTrader/apps/backend typecheck && pnpm -C /Volumes/DataDisk/Project/MyTrader/apps/backend build` -> ✅（修正 universe pool 默认状态对象后复验通过）
- 2026-02-09: `pnpm -C /Volumes/DataDisk/Project/MyTrader/apps/frontend typecheck && pnpm -C /Volumes/DataDisk/Project/MyTrader/apps/frontend build` -> ✅（前端联动口径复验通过）

## Manual functional test checklist
> 说明：本次在 CLI 环境完成后端验证；涉及 UI / 有效 token 的项目需在桌面端手工补测。

### Token / 配置
- [ ] 无 env、无本地 token：后端验证 ✅（getResolved=none；targets/universe/on_demand ingest_runs=failed）；UI 提示待手工验收
- [ ] 设置本地 token：受限于无 Electron safeStorage（CLI 环境），未验证
- [ ] 设置 env token：后端验证 ✅（source=env）；UI 显示来源待手工验收
- [ ] Token 失效：后端验证 ✅（testToken 报错“您的token不对，请确认。”且无泄露）；UI 错误提示待手工验收

### 标的基础库（Tushare catalog）
- [ ] 同步标的库：需有效 token + 网络，未验证
- [ ] 搜索：需先同步 catalog（同上），未验证
- [ ] 详情：需先同步 catalog（同上），未验证

### ingest_runs / 可观测
- [ ] 手动拉取一次：缺少有效 token，仅验证失败路径（run=failed + error_message）；success 未验证
- [x] 故意触发失败（无 token）：run 记录 status=failed 且有错误摘要
- [x] auto-ingest 触发：用 mode=on_demand + meta.schedule=interval 模拟，run 记录可区分

### ledger-first symbol + 自动拉取
- [ ] 仅录入 trade 流水新增标的（不创建 position）：能触发/或在周期内补齐行情
- [ ] ledger 更新频繁：debounce 生效（不会每次都立刻拉取）
- [ ] 手动拉取与 auto-ingest 不并发写库（mutex 生效）

### 数据状态入口
- [ ] 覆盖率/新鲜度/缺失标的清单展示正确（UI 未验）
- [ ] 缺口提示给出可执行修复入口（UI 未验）
- [ ] Targets 配置变更后，“将拉取的标的数/预览列表”实时更新且与实际拉取一致（UI 未验）

### 交易日历（方案B）
- [ ] 周末/节假日不会误报“过期”
- [ ] 自动拉取的截止日取最近交易日（或解释清晰）

### 日K（OHLCV）
- [ ] 范围查询：1M/3M/6M/1Y/YTD/ALL 切换稳定
- [ ] 区间超出历史：提示数据不足，并可触发按需回补
- [ ] 存在缺口（停牌/缺数据）：图表明确提示缺口原因（至少“数据不连续”）
- [ ] 存在拆股/分红未处理事件：显示“未处理/未复权，可能不连续”提示

### 公司行为/分红（仅展示 + 未处理标识）
- [ ] 拉取到事件后：UI 显示 `unhandled`，并提供“去处理”入口
- [ ] 用户手工入账后：状态变为 `handled`（或至少不再提示）
