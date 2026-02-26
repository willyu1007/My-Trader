# 03 Implementation Notes

## Status
- Current status: `in-progress`
- Last updated: 2026-02-24

## What changed
- 新建任务包并完成宏观 roadmap 与分批合并策略。
- 明确禁止整分支直合，采用“main 基线 + pr1 能力移植”的分批并集方案。
- 根据用户确认更新策略：不走 Dashboard 双轨、全部迁移合并、观察窗为 1 个交易日。
- 根据用户确认关闭 open questions：DuckDB 保持 `main` 基线；文档迁移采用“状态不回退”规则。
- Phase 0 已落地：
  - 新增基线守卫脚本：`scripts/verify-pr1-integration-guardrails.mjs`
  - 根脚本入口：`package.json` 增加 `verify:pr1-guardrails`
- Phase 1（低风险协议追加）已启动并落地第一批：
  - `packages/shared/src/ipc.ts` 追加 Source Center V2 / token matrix / readiness / preflight / universe pool / target task matrix 类型与 IPC channels（保留 rollout 兼容接口）
  - `apps/backend/src/preload/index.ts` 追加对应 market API 暴露（仅追加，不删除旧接口）
- Phase 2 已落地（backend Source Center V2）：
  - 新增文件：
    - `apps/backend/src/main/market/dataSourceCatalog.ts`
    - `apps/backend/src/main/market/connectivityTestService.ts`
    - `apps/backend/src/main/market/dataSourceReadinessService.ts`
    - `apps/backend/src/main/market/ingestPreflightService.ts`
    - `apps/backend/src/main/storage/marketDataSourceRepository.ts`
  - `apps/backend/src/main/storage/marketTokenRepository.ts` 升级为 main/domain token 矩阵，并保留 `getResolvedTushareToken/setTushareToken` 兼容入口
  - `apps/backend/src/main/ipc/registerIpcHandlers.ts` 新增 Source Center V2 handlers（catalog/config/token matrix/connectivity/preflight/readiness），并保留 rollout handlers
- Phase 3（low-risk 子步）已落地：
  - 新增文件：
    - `apps/backend/src/main/market/universePoolBuckets.ts`
    - `apps/backend/src/main/market/targetTaskMatrixService.ts`
    - `apps/backend/src/main/market/targetTaskRepository.ts`
    - `apps/backend/src/main/market/targetMaterializationService.ts`
  - 增量 schema：
    - `apps/backend/src/main/market/marketCache.ts` 新增 `target_task_status` / `target_materialization_runs`（保留 `main` 的 fx/macro/ingest_runs 结构）
  - settings 并集：
    - `apps/backend/src/main/storage/marketSettingsRepository.ts` 追加 target-task matrix 配置与 universe pool 运行状态（不移除 rollout flags）
  - IPC 并集：
    - `apps/backend/src/main/ipc/registerIpcHandlers.ts` 追加 universe pool / target-task matrix / materialization handlers，并使用 data-source 配置桥接 legacy universe API
  - DuckDB 基线兼容：
    - `apps/backend/src/main/storage/analysisDuckdb.ts` 仅追加 `AnalysisDuckdbConnection` 类型别名导出（运行时保持 `main` 的 `@duckdb/duckdb-wasm`）
    - `targetMaterializationService.ts` 通过 `information_schema` 探测可选扩展表，避免要求 `main` 基线必须存在 `futures_daily_ext` / `spot_sge_daily_ext`
  - shared/frontend 兼容补丁：
    - `packages/shared/src/ipc.ts` 扩展 `AssetClass` 到 `stock|etf|futures|spot|cash`
    - `apps/frontend/src/components/Dashboard.tsx` 补全 `assetClassLabels` 映射
- Phase 3（high-risk 子步）已落地第一批（runner/provider 并集）：
  - `apps/backend/src/main/market/providers/tushareProvider.ts`
    - futures/spot 产出 `assetClass`
    - 自动追加 universe pool tags（`pool:cn_a|etf|metal_futures|metal_spot`）
  - `apps/backend/src/main/market/marketIngestRunner.ts`
    - Universe ingest 接入 data source config -> legacy buckets
    - 按 selected buckets + profile tags 过滤 stock/etf/futures/spot universe
    - ingest run meta 增加 `selectedBuckets` / `bucketCounts`
    - 执行后回写 `updateMarketUniversePoolBucketStates`
  - 兼容策略：
    - 保留 `main` 的 index/forex/macro/recovery/stale-run 稳定路径，只在 bucket 相关路径做增量并集
- Phase 3（high-risk 子步）已落地第二批（orchestrator -> targets materialization 主流程）：
  - `apps/backend/src/main/market/ingestOrchestrator.ts`
    - targets 任务执行时传入 `analysisDbPath`
  - `apps/backend/src/main/market/marketIngestRunner.ts`
    - targets ingest 完成后自动执行 `materializeTargetsFromSsot`
    - materialization 结果写入 ingest run meta（`targetMaterialization`）
    - materialization 失败按非致命处理并记录错误（run 状态会反映为 partial）
- Phase 5 已落地（Dashboard 模块化直接切换，非双轨）：
  - `apps/frontend/src/components/Dashboard.tsx` 切换为模块入口转发（不再使用单体文件）
  - 新增模块化目录 `apps/frontend/src/components/dashboard/*`（views/hooks/primitives/components）
  - `apps/frontend/scripts/verify-theme-contract.mjs` 兼容模块化入口校验
  - `apps/frontend/src/components/dashboard/views/other/data-management/OtherDataManagementSourceSection.tsx` 清理颜色字面量以满足主题契约
- Phase 6（今日收口）已落地：
  - `scripts/verify-pr1-integration-guardrails.mjs` 增强为“今日闭环门禁”，新增检查：
    - Dashboard 模块化单路径（非双轨）入口与关键目录存在
    - targets materialization 已接入托管 ingest 主流程
    - dual-pool 过滤链路（provider 标签 + runner bucket 执行 + pool 状态回写）完整
  - 说明：用户于 2026-02-22 明确接受“可使用历史数据完成工程闭环”；据此执行历史窗口 gate snapshot 验收并完成任务收口。
  - 历史验收证据：
    - `dev-docs/active/dashboard-pr1-main-integration/evidence/2026-02-22-history-gate-snapshot.json`

## Files/modules touched (high level)
- `dev-docs/active/dashboard-pr1-main-integration/*`
- `scripts/verify-pr1-integration-guardrails.mjs`
- `package.json`
- `packages/shared/src/ipc.ts`
- `apps/backend/src/preload/index.ts`
- `apps/backend/src/main/ipc/registerIpcHandlers.ts`
- `apps/backend/src/main/storage/marketTokenRepository.ts`
- `apps/backend/src/main/storage/marketDataSourceRepository.ts`
- `apps/backend/src/main/market/dataSourceCatalog.ts`
- `apps/backend/src/main/market/connectivityTestService.ts`
- `apps/backend/src/main/market/dataSourceReadinessService.ts`
- `apps/backend/src/main/market/ingestPreflightService.ts`
- `apps/backend/src/main/market/universePoolBuckets.ts`
- `apps/backend/src/main/market/targetTaskMatrixService.ts`
- `apps/backend/src/main/market/targetTaskRepository.ts`
- `apps/backend/src/main/market/targetMaterializationService.ts`
- `apps/backend/src/main/market/marketCache.ts`
- `apps/backend/src/main/market/marketIngestRunner.ts`
- `apps/backend/src/main/market/ingestOrchestrator.ts`
- `apps/backend/src/main/market/providers/tushareProvider.ts`
- `apps/backend/src/main/storage/analysisDuckdb.ts`
- `apps/backend/src/main/storage/marketSettingsRepository.ts`
- `apps/frontend/src/components/Dashboard.tsx`
- `apps/frontend/src/components/dashboard/*`
- `apps/frontend/scripts/verify-theme-contract.mjs`

## Decisions & tradeoffs
- Decision: 先迁移业务能力，后切 Dashboard 结构。
  - Rationale: 将功能风险与结构风险解耦，减少单批次爆炸半径。
  - Alternatives considered: 直接 merge `pr1`（放弃，风险过高）。

- Decision: 保留 rollout flags 兼容接口。
  - Rationale: `main` 收口与门禁仍依赖该链路进行稳定性保障。
  - Alternatives considered: 立即删除兼容（放弃，存在回退风险）。

## Deviations from plan
- None.

## Known issues / follow-ups
- 需要在实施阶段把 42 个提交映射到最终 PR 批次（可能不是原 commit 粒度）。
- 进入 Phase 6 后需补齐 1 个交易日观察记录（稳定性验收 evidence）。

## Pitfalls / dead ends (do not repeat)
- 详见 `05-pitfalls.md`。

## 2026-02-22 Reopen: 全量池基线回收（按 tushare-rollout-closure）
- 触发背景：线上观察到 `targets ingest` 持续长跑并反复出现 futures 标的失败日志（示例：`CS1903.DCE`），用户明确要求“全量池的数据类型/表格/抓取对象以 `tushare-rollout-closure` 为准”。
- 本次回收动作（最小集）：
  - `apps/backend/src/main/market/marketIngestRunner.ts`
    - 恢复为 closure 语义：
      - 去除 Universe ingest 的 `selectedBuckets` 过滤链路与 bucket state 回写。
      - 去除 targets ingest 自动 materialization 绑定（回到 closure 的纯 targets 抓取语义）。
  - `apps/backend/src/main/market/providers/tushareProvider.ts`
    - futures/spot `assetClass` 回归 `null`（不再作为 targets 自动抓取资产类型）。
    - 去除 universe pool tag 自动注入（回归 closure provider 行为）。
  - `apps/backend/src/main/market/ingestOrchestrator.ts`
    - 移除 targets 任务对 `analysisDbPath` 的传递（与 closure targets 路径对齐）。
  - `apps/backend/src/main/market/marketRepository.ts`
    - `listAutoIngestItems` 收紧为 `asset_class in ('stock','etf')`，防止历史脏数据进入 targets 抓取对象。
  - `apps/backend/src/main/market/targetsService.ts`
    - `resolveAutoIngestItems` 仅输出 `stock/etf` 抓取对象（未知/其他资产类型不再默认降级为 stock）。
  - `apps/backend/src/main/market/marketCache.ts`
    - 增加兼容迁移：启动时将 `instruments.asset_class in ('futures','spot')` 归一化为 `null`。
    - 移除 `target_task_status` / `target_materialization_runs` 的 schema 创建步骤（回归 closure 的 market cache 表结构基线）。
- 运行态纠偏（本地账户数据）：
  - 执行一次性 SQL：`update instruments set asset_class = null where asset_class in ('futures','spot')`。
  - 纠偏后核对：`auto_ingest=1` 且 `asset_class in ('stock','etf')` = `5491`，`futures/spot` = `0`。
- 稳定性补丁（防止 ingest 长时间 running）：
  - `apps/backend/src/main/market/tushareClient.ts`
  - `apps/backend/src/main/market/providers/tushareProvider.ts`
  - 为 TuShare HTTP 调用增加 20s abort 超时；超时统一抛出明确错误，避免单请求无响应导致队列长期占用。
- UI/运行口径解耦修正（回应“目标池编辑应为 2 万+ 标的”）：
  - `apps/backend/src/main/market/targetsService.ts` 改为在“目标池编辑预览”阶段读取全量 `auto_ingest` symbols（不再受抓取资产类型过滤）。
  - `apps/backend/src/main/market/marketRepository.ts` 新增 `listAutoIngestSymbols`。
  - 结果：编辑口径恢复全量；执行口径仍由 `resolveAutoIngestItems` 限制为 `stock/etf`，避免 futures/spot 抓取报错风暴。
- 标的结构看板修复（2026-02-22）：
  - `apps/frontend/src/components/dashboard/hooks/use-dashboard-market-target-pool-stats.ts`
  - 当 `pool:*` 标签成员汇总为 0 时，自动回退到 `market.previewTargets()` 作为 universe symbols 口径，避免“全量标的=0”的空板问题。
  - 分类统计仍沿用分类标签成员并与 universe symbol 集求交，保证指标语义一致。

## 2026-02-22 Follow-up: 口径收敛（full-pool 默认全开）与新库 schema 断链修复
- 触发背景：用户确认“全量池正常不需要额外配置（除子 token 外）”，并要求确认图片中的 P1 风险是否真实。
- 已落地改动：
  - `apps/backend/src/main/market/marketCache.ts`
    - 恢复 `target_task_status` / `target_materialization_runs` 两张表及索引 DDL（`create table/index if not exists`）。
    - 目的：消除新建库/新环境在目标任务状态写入时的 schema 断链风险。
  - `scripts/verify-pr1-integration-guardrails.mjs`
    - 门禁从“PR1 双池 + managed-ingest 强接入”口径，收敛为“closure 基线 + 可用性”口径：
      - 保留 `main` 基线与 Dashboard 模块化断言；
      - materialization 改为校验 IPC 手动路径 + schema 可用；
      - 明确不再要求 `selectedBuckets/updateMarketUniversePoolBucketStates` 接入 managed ingest；
      - 明确 futures/spot 不再作为 targets 自动抓取资产类型。
  - `apps/frontend/src/components/dashboard/hooks/use-dashboard-market-target-pool-stats.ts`
    - 当 `pool:*` 标签未命中时，优先回退到 `listInstrumentRegistry` 分页拉全量 symbols（而非直接回退到 `previewTargets`）。
    - 目的：结构看板“全量标的”在无 pool 标签场景下仍可反映全量池口径（2 万+），避免被目标池口径误缩小。
- 结果：
  - `verify:pr1-guardrails` 恢复通过，且语义与当前 `tushare-rollout-closure` 基线一致；
  - 新库初始化不再缺失 target-task 相关表。

## 2026-02-23 Follow-up: 分类链路补齐（SW L2 + 概念）与全量目录默认收起
- 触发背景：
  - 用户反馈“结构看板二级行业/概念为 0”，并要求补齐链路；
  - 用户同时要求“全量数据池目录默认收起”。
- 已落地改动：
  - `apps/backend/src/main/market/providers/tushareProvider.ts`
    - `fetchInstrumentCatalog` 新增股票分类增强链路，保持“可选能力、失败不阻断主流程”：
      - 申万行业链路：`index_classify` + `index_member_all`（失败时回退 `index_member`）；
      - 概念链路：`concept` + `concept_detail`（全量失败时回退按概念编码拉取）；
    - 股票 profile 标签增强：
      - 新增 `ind:sw:l1:<name>` / `ind:sw:l2:<name>`；
      - 新增 `concept:<name>`，并兼容写入 `theme:ths:<name>`；
      - `providerData` 增补 `swIndustry` 与 `concepts` 字段，便于后续排查与审计。
  - `apps/backend/src/main/market/providers/tushareBulkFetch.ts`
    - 为分页 TuShare 调用补齐 20s HTTP 超时（AbortController），避免分类链路引入长时间挂起风险。
  - `apps/frontend/src/components/dashboard/views/other/data-management/OtherDataManagementSourceSection.tsx`
    - `directoryPanelExpanded` 默认值调整为 `false`，即“全量数据池目录默认收起”。
- 当前状态：
  - 代码链路已补齐并通过类型/门禁验证；
  - 运行态要看到二级行业/概念统计恢复，仍需触发一次 universe catalog 同步以回填新标签。

## 2026-02-23 Follow-up #2: L1-L2 关联修正与概念链路增强回退
- 触发背景：
  - 运行态核对发现 `ind:sw:l2:*` 已落库（124 类），但 `ind:sw:l1:*` 为 0；
  - `concept:*` 仍为 0，导致概念分类卡片空值。
- 已落地改动：
  - `apps/backend/src/main/market/providers/tushareProvider.ts`
    - SW 行业：
      - `index_classify` 改为多参数聚合拉取（`src + level(L1/L2)`），并合并节点；
      - 兼容更多 level 表示（`L1/L2`、数字、中文一级/二级）；
      - 当 `parent_code` 缺失时，按申万代码规则回退推导 L1 code（例如 `801783.SI -> 801780.SI`）。
    - 概念：
      - 保留原 `concept + concept_detail` 主链路；
      - 新增 `ths_index + ths_member` 回退链路（当主链路为空时启用），并保持 active member 过滤。
    - 目标：保证在不同 token 权限/接口可用性条件下，尽可能回填 `ind:sw:l1` 与 `concept` 标签，减少“有 L2 无 L1、概念全空”的概率。

## 2026-02-23 Follow-up #3: 全量池入口收口（去重）
- 触发背景：
  - 用户反馈“全量池配置重复”，同一页面同时存在：
    - Source Center 的“全量数据池目录”（目录/域模块配置入口）；
    - Target Pool 区块的“全量池配置”（legacy bucket 卡片入口）。
- 已落地改动：
  - `apps/frontend/src/components/dashboard/views/other/data-management/OtherDataManagementTargetPoolSection.tsx`
    - 移除 `OtherDataManagementUniversePoolPanel` 依赖与整段“全量池”渲染；
    - 收敛为仅保留“目标池编辑”区块。
  - `apps/frontend/src/components/dashboard/views/other/OtherDataManagementTab.tsx`
    - 移除向 `OtherDataManagementTargetPoolSection` 透传的 legacy universe pool props。
  - `apps/frontend/src/components/dashboard/views/OtherView.tsx`
    - 移除 `dataManagementTabProps` 中 legacy universe pool 相关透传字段。
  - 删除死代码文件：
    - `apps/frontend/src/components/dashboard/views/other/data-management/OtherDataManagementUniversePoolPanel.tsx`
- 结果：
  - UI 层“全量池配置”仅保留 Source Center 单入口，消除重复配置点与覆盖歧义；
  - 后端 legacy IPC 兼容路径仍保留（未破坏兼容），本次仅做前端入口收口。

## 2026-02-23 Follow-up #4: 目标任务矩阵可用性收敛（命名/信息架构）
- 触发背景：
  - 用户反馈“目标任务矩阵”术语与操作路径困惑，要求：
    - 名称改为“目标池数据完备性”；
    - 定义信息改为问号悬停提示，不默认展示；
    - “缺口回补窗口”先隐藏；
    - 状态明细默认收起。
- 已落地改动：
  - `apps/frontend/src/components/dashboard/views/other/data-management/OtherDataManagementTargetTaskPanel.tsx`
    - 标题改名为“目标池数据完备性”；
    - 增加问号提示（`title`/`aria-label`）承载定义文案；
    - “完备性模块配置”区仅保留模块开关，隐藏 `defaultLookbackDays` 输入；
    - 状态明细区新增折叠开关，默认 `collapsed`，仅展开时加载/刷新状态；
    - 保存提示文案调整为“完备性配置已保存”，加载文案改为“完备性面板加载中...”。
- 结果：
  - 交互主路径从“技术矩阵配置 + 全量状态表”收敛为“总览 + 物化 + 按需排障”；
  - 保持后端能力与配置结构不变，属于纯前端可用性收敛，无数据格式变更风险。

## 2026-02-23 Follow-up #5: 状态版 V1（告警优先）重构
- 触发背景：
  - 用户反馈当前状态版“重点不显眼”，难以快速识别风险与优先动作。
- 已落地改动：
  - `apps/frontend/src/components/dashboard/views/other/data-management/OtherDataManagementTargetTaskPanel.tsx`
    - 顶部总览从“平铺信息卡”改为“告警优先”结构：
      - 新增健康状态横幅（健康/需关注/高风险）+ 数据滞后天数 + 操作提示；
      - 新增关键指标卡：覆盖完成率、缺失占比、部分缺失占比、待回补任务数；
      - 新增资产覆盖风险条（按缺失率排序，展示 Top Risk 资产与分段覆盖条）。
    - 状态明细表状态文案由英文改为中文（完整/部分缺失/缺失/不适用）。
  - 说明：该版本为前端 V1 视觉层级优化，不变更后端口径与任务执行语义。

## 2026-02-23 Follow-up #6: 状态版 V1.1 收敛（风格统一 + 布局重排）
- 触发背景：
  - 用户反馈 V1 存在“配色过重、与整体风格割裂、资产风险区占行过大、缩写文案不直观”问题。
- 已落地改动：
  - `apps/frontend/src/components/dashboard/views/other/data-management/OtherDataManagementTargetTaskPanel.tsx`
    - 将“健康状态 + 4 指标”整合为同一总览容器，统一为中性色底，仅保留小面积语义色（状态点/关键数字）；
    - 将资产覆盖风险区从单列长条改为紧凑网格（`lg` 下 2 列），并仅展示 `applicable > 0` 的资产类别；
    - 资产明细文案由 `C/P/M/NA` 改为中文全称“完整/部分缺失/缺失/不适用”；
    - 在资产区补充“当前显示 N 个资产类别”，减少对“为什么只有四类”的认知歧义。
- 结果：
  - 面板与整体 Dashboard 视觉风格更一致；
  - 信息密度更高且阅读路径更清晰，适合日常快速巡检。

## 2026-02-23 Follow-up #7: 状态版 V1.2（健康状态行 + 覆盖状态矩阵）
- 触发背景：
  - 用户要求进一步收敛信息表达：
    - 健康状态不使用外框；
    - 风险提示与“健康状态”同一行展示；
    - 将“完整/部分缺失/缺失/不适用/待回补”改为矩阵化展示（纵轴状态，横轴整体+资产类别）。
- 已落地改动：
  - `apps/frontend/src/components/dashboard/views/other/data-management/OtherDataManagementTargetTaskPanel.tsx`
    - 健康状态区：
      - 去除健康状态胶囊外框，仅保留状态点 + 文本；
      - 将操作提示迁移至同一行右侧；统计日期/延迟/规模下移为次级信息行。
    - 资产覆盖区：
      - 从“资产风险卡片”改为“资产覆盖状态矩阵”；
      - 行维度：完整、部分缺失、缺失、不适用、待回补；
      - 列维度：整体 + 动态资产类别（股票/ETF/期货/现货等，以运行时数据为准）；
      - 单元格展示 `数量 + 占比`，支持横向滚动，避免列多时挤压布局。
    - 统计口径补齐：
      - 新增 `notApplicableRate`（分母为 `applicable + notApplicable`）；
      - 新增 `repairRate`（`待回补 = 部分缺失 + 缺失`，分母为 `applicable`）。

## 2026-02-23 Follow-up #8: 去除重复 KPI 卡片（保留矩阵单一主视图）
- 触发背景：
  - 用户确认“有了覆盖状态矩阵后，上方四张 KPI 卡片不再必要”。
- 已落地改动：
  - `apps/frontend/src/components/dashboard/views/other/data-management/OtherDataManagementTargetTaskPanel.tsx`
    - 移除“覆盖完成率/缺失占比/部分缺失占比/待回补任务”四张卡片区域；
    - 保留“健康状态行 + 统计日期行 + 覆盖状态矩阵”作为单一主视图。
- 结果：
  - 降低信息重复与视觉噪音，页面焦点统一到矩阵视图。

## 2026-02-23 Follow-up #9: 顶部状态条单行化（无外框）
- 触发背景：
  - 用户要求顶部状态信息“压缩成一行，并去掉外框”。
- 已落地改动：
  - `apps/frontend/src/components/dashboard/views/other/data-management/OtherDataManagementTargetTaskPanel.tsx`
    - 将“健康状态 + 提示语 + 统计日期/延迟/规模”合并为单行展示；
    - 移除该信息块的内层边框与背景；
    - 为窄屏增加横向滚动容器，避免强制换行破坏单行布局。

## 2026-02-23 Follow-up #10: 顶部统计文案右对齐
- 触发背景：
  - 用户要求“统计日期/延迟/规模”文案靠右。
- 已落地改动：
  - `apps/frontend/src/components/dashboard/views/other/data-management/OtherDataManagementTargetTaskPanel.tsx`
    - 单行容器改为 `flex + min-w-full + w-max`；
    - 统计文案块新增 `ml-auto text-right`，在可用宽度内右侧对齐，同时保留窄屏横向滚动能力。

## 2026-02-23 Follow-up #11: 状态矩阵 V1.3（去卡片化 + 五档健康短条）
- 触发背景：
  - 用户反馈矩阵仍有“卡片感过重、框线偏多、首列过宽、颜色表达弱、需支持横向滚动扩展”问题。
- 已落地改动：
  - `apps/frontend/src/components/dashboard/views/other/data-management/OtherDataManagementTargetTaskPanel.tsx`
    - 矩阵区域去卡片化：
      - 去掉矩阵内层圆角边框容器，改为纯表格视图（仅保留表头/行分隔线）。
    - 滚动与布局：
      - 表格容器调整为 `max-h + overflow-auto`，同时支持纵向/横向滚动；
      - 首列（维度列）收窄为 `w-24/min-w-[96px]`，并设置 `sticky left`；
      - 表头设置 `sticky top`，便于滚动浏览更多列与行。
    - 语义表达增强：
      - 行维度（完整/部分缺失/缺失/不适用/待回补）增加语义色点与文本色；
      - 列维度（整体 + 各资产）在表头增加“完整率短条”，采用 5 档颜色：
        - 红（<20%）
        - 橙（20%-40%）
        - 黄（40%-60%）
        - 淡绿（60%-80%）
        - 绿（>=80%）

## 2026-02-23 Follow-up #12: 维度列极简化（去圆点/去颜色 + 再压缩列宽）
- 触发背景：
  - 用户要求“保持简洁，不需要圆点和颜色，列宽还可以减小”。
- 已落地改动：
  - `apps/frontend/src/components/dashboard/views/other/data-management/OtherDataManagementTargetTaskPanel.tsx`
    - 维度列去除语义色圆点与彩色文字，统一为中性文本；
    - 首列宽度继续收窄：`min-w 96 -> 80`；
    - 表格整体横向占用同步收紧：`min-w 980 -> 860`，并减小 cell padding。

## 2026-02-23 Follow-up #13: 分割线 + 完整度着色迁移 + 资产列顺序固定
- 触发背景：
  - 用户要求：
    - “健康状态”与“资产覆盖状态矩阵”之间增加全宽分割线；
    - 去掉资产列标题下方短条，改为给“完整”百分比着色；
    - 列头文案改为“覆盖程度”，资产列顺序固定为“整体、股票、ETF、期货、现货”。
- 已落地改动：
  - `apps/frontend/src/components/dashboard/views/other/data-management/OtherDataManagementTargetTaskPanel.tsx`
    - 在顶部状态条与矩阵之间新增全宽分割线；
    - 移除“整体/资产”列表头短条；
    - 将色彩表达迁移到“完整”行百分比（整体与各资产列）；
    - 覆盖程度列标题由“维度”改为“覆盖程度”；
    - 资产列顺序收敛为固定顺序：`stock -> etf -> futures -> spot`（仅显示有数据列）。

## 2026-02-23 Follow-up #14: Completeness V2（注册表驱动 + 双轨兼容）落地
- 触发背景：
  - 用户要求将“目标池数据完备性”从 `target-task` 硬编码模型升级为注册表驱动，并纳入 `P0/P1/P2` 资产范围；同时保持当前 targets 执行口径稳定（stock/etf 优先）。
- 已落地改动：
  - shared/preload/IPC：
    - `packages/shared/src/ipc.ts` 新增 completeness v2 类型与 channels（并保留 legacy target-task API）。
    - `apps/backend/src/preload/index.ts` 暴露 completeness v2 API。
    - `apps/backend/src/main/ipc/registerIpcHandlers.ts` 新增 completeness handlers，legacy handlers 转调 completeness adapter。
  - backend completeness 核心：
    - 新增目录：`apps/backend/src/main/market/completeness/`
      - `datasetRegistry.ts`
      - `checkRegistry.ts`
      - `entityResolver.ts`
      - `statusEvaluator.ts`
      - `completenessRepository.ts`
      - `completenessService.ts`
      - `legacyTargetModule.ts`
    - 新增执行计划解析：`apps/backend/src/main/market/executionPlanResolver.ts`（`DataSourceConfig ∩ RolloutFlags`）。
    - 新增 step 观测仓储：`apps/backend/src/main/market/ingestStepRunsRepository.ts`。
  - schema + 迁移：
    - `apps/backend/src/main/market/marketCache.ts` 新增：
      - `completeness_status_v2`
      - `completeness_runs_v2`
      - `ingest_step_runs_v1`
    - 增加幂等 backfill（`target_task_status -> completeness_status_v2`，`target_materialization_runs -> completeness_runs_v2`）与 marker：`market_meta.completeness_v2_backfill_v1`。
  - 兼容层：
    - `apps/backend/src/main/storage/marketSettingsRepository.ts`
      - 新增 `completeness_config_v2`；
      - legacy target-task matrix 配置读写转为 completeness 配置适配。
    - `apps/backend/src/main/market/targetTaskRepository.ts`
      - target-task 状态与物化 run 双写至 completeness v2 表。
  - orchestrator/runner：
    - `apps/backend/src/main/market/ingestOrchestrator.ts` 接入 execution plan resolver，并向 targets/universe 传递执行计划。
    - `apps/backend/src/main/market/marketIngestRunner.ts` 新增 `extract/normalize/upsert/evaluate` step 记录，写入 `ingest_step_runs_v1`。
  - Source Center 对齐：
    - `apps/backend/src/main/market/dataSourceCatalog.ts` 将 `index.daily`、`fx.daily`、`macro.snapshot` 与执行模块对齐为可配置 sync-capable 模块。
    - `apps/backend/src/main/market/completeness/completenessService.ts` 按 Source Center 配置过滤 source checks；source 无数据时统一为 `not_started`。
  - frontend：
    - `apps/frontend/src/components/dashboard/views/other/data-management/OtherDataManagementTargetTaskPanel.tsx`
      - 升级为 completeness 面板；
      - 双区块展示（`target_pool` / `source_pool`）；
      - target 可编辑、source 只读。
  - 验证工具链：
    - 新增 `apps/backend/src/main/verifyCompletenessV2.ts`
    - `apps/backend/package.json` 新增 `verify:completeness-v2`
    - `apps/backend/tsup.config.ts` 新增 `verify-completeness-v2` 构建入口
    - `scripts/verify-pr1-integration-guardrails.mjs` 兼容 completeness adapter 路径（target materialization IPC 校验支持 `runCompletenessMaterialization`）。

## 2026-02-24 Follow-up #15: 启动/切换/滚轮/退出卡顿闭环修复
- 触发背景：
  - 用户反馈启动、切页、滚轮（数据管理页最明显）与退出均存在明显卡顿，并伴随 `disk I/O error` 弹窗。
- 已落地改动：
  - Phase A（持久化止血）：
    - `apps/backend/src/main/storage/sqlite.ts`
      - `exec/run` 改为 `dirty + debounce flush(250ms)`，不再每次非事务写都全量落盘；
      - 增加事务感知（事务内不 flush，`commit` 后单次 flush）；
      - 引入原子落盘（`*.tmp` + `rename`）；
      - `close` 前有脏写才 flush；
      - 增加嵌套事务 savepoint 支持，避免 schema/回填路径事务嵌套冲突；
      - 新增只读诊断统计导出：`getSqliteRuntimePerfStats()`。
  - Phase B（schema 初始化降载）：
    - `apps/backend/src/main/market/marketCache.ts`
      - `ensureMarketCacheSchema` 改为单事务执行；
      - 将 `instruments.asset_class in ('futures','spot') -> null` 改为一次性 marker 迁移（`market_meta.targets_asset_class_baseline_v1`），避免每次启动重写。
    - `apps/backend/src/main/storage/businessSchema.ts`
      - `ensureBusinessSchema` 改为单事务执行，减少启动期多次独立写盘。
  - Phase C（启动任务/退出任务收敛）：
    - `apps/backend/src/main/storage/marketSettingsRepository.ts`
      - `DEFAULT_INGEST_SCHEDULER_CONFIG` 调整为 `runOnStartup=false`、`catchUpMissed=false`；
      - 新增一次性收敛：`convergeMarketIngestSchedulerStartupDisabled`（写入 `app_meta.ingest_scheduler_startup_disabled_converged_v1`）。
    - `apps/backend/src/main/market/autoIngest.ts`
      - 去掉启动即 `runOnce("startup")`，仅保留 interval/trigger。
    - `apps/backend/src/main/ipc/registerIpcHandlers.ts`
      - 账号解锁时执行 startup-scheduler 收敛；
      - 新增 `shutdownBackendRuntime()` 统一停机清理（orchestrator/auto/scheduler + DB close）；
      - market-cache 启动健康检查增强：读写错误触发自动 rotate 备份并重建。
    - `apps/backend/src/main/index.ts`
      - 新增 `before-quit`：带 2s 超时的统一 shutdown，降低退出挂起概率。
  - Phase D（数据管理页交互性能）：
    - `apps/frontend/src/components/dashboard/views/DashboardContainerLayout.tsx`
      - 仅 `other/data-management` 关闭平滑滚动（`scroll-auto`），其余页面保持 `scroll-smooth`。
    - `apps/frontend/src/components/dashboard/hooks/use-dashboard-market.ts`
      - 数据管理页进入时移除批量自动重查询；
      - 状态轮询由 `8s` 调整为 `15s`，并在 `document.hidden=true` 时暂停，恢复可见时再刷新。
  - Phase E（缓存损坏自愈闭环）：
    - `apps/backend/src/main/ipc/registerIpcHandlers.ts`
      - 检测到 `disk I/O/malformed/not a database` 时自动备份 `market-cache.sqlite{,-shm,-wal}` 为 `.corrupt-<ts>.bak` 并重建；
      - 首次自愈后弹出一次用户可见提示（说明备份与重拉口径）。
  - 可选诊断 API（已落地）：
    - `packages/shared/src/ipc.ts` / `apps/backend/src/preload/index.ts` / `apps/backend/src/main/ipc/registerIpcHandlers.ts`
      - 新增 `market.getRuntimePerfStats()`（`MARKET_RUNTIME_PERF_STATS_GET`），用于回归定位 flush 与进程内存指标。

## 2026-02-25 Follow-up #16: 数据管理-状态明细搜索（P0）
- 触发背景：
  - 用户反馈“状态明细”在高基数数据下全量展示意义不大，要求增加可定位问题的搜索能力，并讨论与其它模块的搜索逻辑复用边界。
- 已落地改动：
  - shared 协议扩展：
    - `packages/shared/src/ipc.ts`
      - `ListCompletenessStatusInput` 新增字段：
        - `domainId` / `moduleId` / `asOfTradeDate`
        - `keyword` / `keywordFields`
        - `onlyExceptions`
        - `sortBy` / `sortOrder`
  - backend 查询增强：
    - `apps/backend/src/main/market/completeness/completenessRepository.ts`
      - `listCompletenessStatusRows` 新增结构化过滤（domain/module/asOf）；
      - 新增关键词搜索（entity/check/module，`LIKE` + 转义）；
      - 新增 `onlyExceptions` 过滤（`missing/partial/not_started`）；
      - 新增排序控制（updatedAt/asOfTradeDate/status）；
      - 增加保护：无任何过滤条件时拒绝执行查询，避免无意义全表扫描。
    - `apps/backend/src/main/market/completeness/completenessService.ts`
      - list-status cache-error fallback 默认分页大小收敛为 50。
  - frontend 状态明细交互增强：
    - `apps/frontend/src/components/dashboard/views/other/data-management/OtherDataManagementTargetTaskPanel.tsx`
      - 新增关键词输入（Entity/Check/Module），支持 Enter 立即检索 + 250ms debounce；
      - 新增“仅异常”开关（默认开启）；
      - 新增“清空搜索”动作；
      - 新增分页导航（50/页，上一页/下一页）；
      - 切换 scope/check/status 或关键词时自动回到第一页；
      - “查看供给详情”入口会重置为 source + onlyExceptions=true，便于异常排查。
- 设计取舍：
  - 复用范围收敛在“查询协议与交互模式”，暂不跨模块统一 repository/SQL；
  - 先保证定位效率与性能（结构化过滤 + 限页），不引入全文检索引擎。

## 2026-02-25 Follow-up #17: 数据管理滚动卡顿收敛（tooltip/overflow 降载）
- 触发背景：
  - 用户反馈在“数据管理”面板滚动出现轻微卡顿，体感较此前变差。
- 已落地改动（最小风险）：
  - `apps/frontend/src/components/dashboard/views/other/data-management/OtherDataManagementTargetTaskPanel.tsx`
    - 移除本文件内大量 `HoverTooltip` 组件实例（每个标签一个），统一改为 `data-mt-tooltip`，交由全局 `GlobalHoverTooltipLayer` 处理；
    - 目标检查项列表滚动容器从 `overflow-y-hidden + hover/focus 切换` 改为常驻 `overflow-y-auto`，避免 hover 切换触发额外重排；
    - 保留现有视觉样式与 tooltip 语义，不改变业务口径。
- 预期收益：
  - 降低滚动中的组件状态开销与样式切换重排概率；
  - 保持 tooltip 与标签展示一致性的同时减少交互卡顿。

## 2026-02-25 Follow-up #18: 全局 tooltip 滚动抖动抑制
- 触发背景：
  - Follow-up #17 后用户反馈“仍不够流畅”，说明卡顿热点不只在面板局部组件，还可能在全局 hover 监听链路。
- 已落地改动：
  - `apps/frontend/src/components/GlobalHoverTooltipLayer.tsx`
    - 新增滚动抑制窗口：`POINTER_SUPPRESS_AFTER_SCROLL_MS = 120`；
    - 在滚动后短窗口内跳过 `mouseover/mouseout` 处理，避免滚动过程中大量 pointer 事件触发 tooltip 解析；
    - `releaseActiveElement` 增加空态短路，避免“无 active tooltip 时”的重复状态更新。
- 预期收益：
  - 减少滚动期间由 tooltip 层带来的高频 JS 调度与状态更新；
  - 降低数据管理长页滚动时的主线程噪声。
