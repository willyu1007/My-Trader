# 04 Verification

## Automated checks
- `pnpm typecheck`
- `pnpm build`

### 2026-02-01
- `pnpm typecheck` ✅（单标的：日期/价格行增加持仓价/目标价；持仓价支持 FIFO fallback）
- `pnpm build` ✅（单标的：日期/价格行增加持仓价/目标价；持仓价支持 FIFO fallback）
- `pnpm typecheck` ✅（UI：目标价挪到右侧）
- `pnpm build` ✅（UI：目标价挪到右侧）

### 2026-01-29
- `pnpm typecheck` ✅
- `pnpm build` ✅
- `pnpm typecheck` ✅（Market 右侧布局/弹层/可调宽度更新后）
- `pnpm build` ✅（Market 右侧布局/弹层/可调宽度更新后）
- `pnpm typecheck` ✅（Market 右侧高度比例/去背景色调整后）
- `pnpm build` ✅（Market 右侧高度比例/去背景色调整后）

### 2026-01-30
- `pnpm typecheck` ✅（getMarketQuotes chunk + daily_basics auto-fetch cap）
- `pnpm build` ✅（getMarketQuotes chunk + daily_basics auto-fetch cap）
- `pnpm typecheck` ✅（market.getTagSeries + 集合整体走势 + 筛选弹层）
- `pnpm build` ✅（market.getTagSeries + 集合整体走势 + 筛选弹层）
- `pnpm typecheck` ✅（图表 hover 对齐参考 + 交易标记 + 持仓均价线）
- `pnpm build` ✅（图表 hover 对齐参考 + 交易标记 + 持仓均价线）
- `pnpm typecheck` ✅（移除横向辅助线 + hover 隐藏顶部日期）
- `pnpm build` ✅（移除横向辅助线 + hover 隐藏顶部日期）
- `pnpm typecheck` ✅（hover 日期移到中间显示，右上角不再显示日期）
- `pnpm build` ✅（hover 日期移到中间显示，右上角不再显示日期）
- `pnpm typecheck` ✅（hover 价格移到中间显示，图内移除价格小框 + pointer move 卡顿优化）
- `pnpm build` ✅（hover 价格移到中间显示，图内移除价格小框 + pointer move 卡顿优化）
- `pnpm typecheck` ✅（修复 hover 固定无响应区域 + 集合走势 hover 日期/价格逻辑对齐个股）
- `pnpm build` ✅（修复 hover 固定无响应区域 + 集合走势 hover 日期/价格逻辑对齐个股）
- `pnpm typecheck` ✅（大数字万/亿格式 + 趋势图下方成交量/净买入面板）
- `pnpm build` ✅（大数字万/亿格式 + 趋势图下方成交量/净买入面板）
- `pnpm typecheck` ✅（成交量迷你图 0 值不绘制）
- `pnpm build` ✅（成交量迷你图 0 值不绘制）
- `pnpm typecheck` ✅（hover 取 volume 用 Map 加速）
- `pnpm build` ✅（hover 取 volume 用 Map 加速）
- `pnpm typecheck` ✅（净买入切换可点击 + 按需加载交易流水）
- `pnpm build` ✅（净买入切换可点击 + 按需加载交易流水）
- `pnpm typecheck` ✅（势能=moneyflow（日级）+ 占比=|势能|/成交量；移除净买入切换）
- `pnpm build` ✅（势能=moneyflow（日级）+ 占比=|势能|/成交量；移除净买入切换）
- `pnpm typecheck` ✅（移除顶部“6个月”标签；demo 注入增加 1/3 模拟持仓 + 月频交易）
- `pnpm build` ✅（移除顶部“6个月”标签；demo 注入增加 1/3 模拟持仓 + 月频交易）
- `pnpm typecheck` ✅（demo 注入提示包含 warnings）
- `pnpm build` ✅（demo 注入提示包含 warnings）
- `pnpm typecheck` ✅（demo 持仓均价修复：注入 baseline ledger；均价线不再影响图表缩放）
- `pnpm build` ✅（demo 持仓均价修复：注入 baseline ledger；均价线不再影响图表缩放）
- `pnpm typecheck` ✅（图表错误边界可复位 + SVG gradient id 去冲突 + 非法数值防御）
- `pnpm build` ✅（图表错误边界可复位 + SVG gradient id 去冲突 + 非法数值防御）
- `pnpm typecheck` ✅（切换标的不闪“图表渲染失败/暂无数据”：ErrorBoundary 同步复位 + 图表加载遮罩）
- `pnpm build` ✅（切换标的不闪“图表渲染失败/暂无数据”：ErrorBoundary 同步复位 + 图表加载遮罩）
- `pnpm typecheck` ✅（demo 重复注入可补齐 baseline 成本，确保“持仓均价”虚线可见）
- `pnpm build` ✅（demo 重复注入可补齐 baseline 成本，确保“持仓均价”虚线可见）
- `pnpm typecheck` ✅（移除“持仓标的”趋势图特殊渲染 + 压缩日期/价格行高度）
- `pnpm build` ✅（移除“持仓标的”趋势图特殊渲染 + 压缩日期/价格行高度）

## Manual checklist
- [ ] 进入 Market 自动折叠导航；退出恢复符合预期
- [ ] 左侧栏可拖拽调节宽度；刷新后保持
- [ ] 左侧列表展示 latest 与涨跌（无数据降级清晰）
- [ ] 无数据场景：点击“注入示例数据”后可看到 `demo:*` tags + `watchlist:demo`，集合整体走势可加载
- [ ] 筛选弹层：market/assetClass/kind 对搜索/持仓列表生效；筛选后无结果提示正确
- [ ] Targets 弹层打开/保存/预览不阻塞主布局
- [ ] 集合模式：能加载成分股、排序、跳转单标的
- [ ] 集合模式：整体走势（派生指数）可加载；切换区间生效；覆盖提示清晰
- [ ] 图表 hover：能显示对应日期与价格（tooltip/crosshair）
- [ ] 图表 hover：日期与价格在图表上方中间区域更新（替换“今日日期”）；图内不显示价格小框；右上角不显示日期
- [ ] 信息版：成交量/平均成交量/流通市值等大数字使用万/亿单位展示
- [ ] 趋势图下方：显示每日成交量迷你图；可切换「总成交量 / 势能（moneyflow）」；势能显示占比=|势能|/成交量
- [ ] 集合模式：成分弹层可打开、点击跳转单标的
- [ ] 单标的：日期行 hover 显示时间范围 pills，切换后驱动区间加载
- [ ] 单标的：日期/价格行左侧展示「持仓价 / 目标价」（目标价可用用户标签 `target:xx.xx` 设置；持仓价优先 `Position.cost`，否则 FIFO）
- [ ] 单标的：右侧不滚动，图表+统计在一屏内
- [ ] 标的详情弹层：自选分组/标签/原始字段可用

### 2026-02-09
- `pnpm -C /Volumes/DataDisk/Project/MyTrader/apps/frontend typecheck` ✅（目标池编辑 1:1 布局 + 数据同步范围下拉 + 当前目标池弹窗）
- `pnpm -C /Volumes/DataDisk/Project/MyTrader/apps/frontend build` ✅（目标池编辑 1:1 布局 + 数据同步范围下拉 + 当前目标池弹窗）
- `pnpm -C /Volumes/DataDisk/Project/MyTrader/apps/frontend typecheck` ✅（手动添加标的流程重构：解析预览/部分应用/保留输入）
- `pnpm -C /Volumes/DataDisk/Project/MyTrader/apps/frontend build` ✅（手动添加标的流程重构：解析预览/部分应用/保留输入）
- `pnpm -C /Volumes/DataDisk/Project/MyTrader/apps/frontend typecheck` ✅（“解析预览”改为输入框内“解析”，并保留应用流程）
- `pnpm -C /Volumes/DataDisk/Project/MyTrader/apps/frontend build` ✅（“解析预览”改为输入框内“解析”，并保留应用流程）
- `pnpm -C /Volumes/DataDisk/Project/MyTrader/apps/frontend typecheck` ✅（手动区去重：移除“当前手动标的”，按钮位置重排为输入/预览框右下角）
- `pnpm -C /Volumes/DataDisk/Project/MyTrader/apps/frontend build` ✅（手动区去重：移除“当前手动标的”，按钮位置重排为输入/预览框右下角）
- `pnpm -C /Volumes/DataDisk/Project/MyTrader/apps/frontend typecheck` ✅（隐藏数据管理“注册标的”入口 + includeRegistryAutoIngest 强制收敛为 false）
- `pnpm -C /Volumes/DataDisk/Project/MyTrader/apps/frontend build` ✅（隐藏数据管理“注册标的”入口 + includeRegistryAutoIngest 强制收敛为 false）
- `pnpm -C /Volumes/DataDisk/Project/MyTrader/apps/frontend typecheck` ✅（差异分组折叠 + 目标池编辑左右拖拽调宽）
- `pnpm -C /Volumes/DataDisk/Project/MyTrader/apps/frontend build` ✅（差异分组折叠 + 目标池编辑左右拖拽调宽）
