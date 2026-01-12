# Risks and Open Questions

## Conclusions (read first)
- Highest risk areas:
  - 数据正确性与复现性（行情、复权、板块成分、因子计算口径）
  - 跨平台桌面端架构与性能（UI 流畅性、长任务不阻塞、打包发布）
  - 数据源许可与稳定性（API Key、限流、可用性、合规）
  - “决策引导”边界（避免被误解为投顾；提示语与免责声明）
- Biggest unknowns:
  - 首选行情/基础数据源的覆盖与稳定性（A 股 Tushare；港股/美股 AkShare；以及交易所公开数据补充）
  - 回测引擎形态与精度边界（需纳入涨跌停与费用税；日频为主但需清晰说明近似假设）
  - 因子/模型的 MVP 范围与扩展机制（内置集合与插件机制）
  - 是否需要引入分析型存储（SQLite + DuckDB 组合）以及数据分区策略
- Decisions needed before build:
  - 数据源选型与许可审查（在接入前完成；已选：A 股 Tushare 为主数据源；港股/美股 AkShare）
  - MVP 回测范围（频率、交易规则、复权口径、成本模型；已确认：纳入涨跌停与费用税，港股也需要较准确回测）
  - 桌面技术栈落地方案（Electron vs Tauri；UI 框架与包管理）
  - 本地数据加密与密钥管理方案（暂不作为 MVP）
  - 已确认范围：市场优先 A 股、港股；资产类型包含股票与 ETF（债券 ETF、贵金属 ETF 等），暂不考虑期货

## Resolved decisions (as of 2026-01-11)

- 市场与口径：按市场交易日历与市场币种存储/计算；组合结算收益统一按 CNY，港股按汇率换算；历史回测使用历史汇率并记录取值时间与来源
- 复权与公司行为：保存原始价与复权价/复权因子；优先使用复权口径用于指标与回测；保留公司行为事件以支持复现
- 停牌处理：估值可用上一交易日收盘价标记；交易撮合层面禁止成交并记录原因
- A/H 映射：交易与持仓层面仍视为不同 Instrument；研究与风控聚合按 Issuer 建立映射与对照
- 数据源：
  - A 股主数据源：Tushare（含股票与 ETF：债券 ETF、贵金属 ETF 等）
  - 港股/美股：AkShare（按其聚合来源条款使用），必要时补充交易所公开数据
  - 板块/概念体系：以主数据源口径为准；如多源并存，定义主从与映射策略
- 回测精度：纳入 A 股涨跌停与费用税；港股费用税也纳入；费率与规则版本写入回测运行记录以支持复现
- 存储：SQLite（业务与用户内容）+ DuckDB（分析/回测）为主；大规模时序优先分区落盘（例如 Parquet）并由 DuckDB 查询
- 观点系统：MVP 先做结构化字段 + 标签 + 全文检索；数据模型预留后续 RAG/LLM 相似发现（允许调用外部 API，需用户显式启用与配置）
- 桌面端：Electron；工程基线：Node.js >= 20；代码组织：monorepo

## Open questions (prioritized)

- (none)

## Risks

- Risk: 数据口径不一致导致回测/风险结果误导
  - Impact: 用户做出错误决策，且难以追溯原因；信任受损。
  - Likelihood: 高
  - Mitigation: 为每条数据标记来源与时间；明确复权与缺失处理；关键计算提供可追溯说明与复现记录。
  - Trigger: 同一标的不同来源价格差异显著；回测结果与外部对照偏离明显。

- Risk: 跨平台桌面端性能不足（大表格/图表/长任务）
  - Impact: 交互卡顿、崩溃、用户流失。
  - Likelihood: 中
  - Mitigation: 计算任务后台化（worker/服务）；分页与虚拟列表；性能基线与数据规模压测样例。
  - Trigger: 风险面板/回测运行期间 UI 频繁无响应或内存暴涨。

- Risk: 数据源许可或限流导致功能无法落地
  - Impact: 核心功能（行情、板块、回测数据）受阻。
  - Likelihood: 中
  - Mitigation: 数据源可插拔；支持离线导入（CSV/Parquet）；在接入前完成许可审查与配额评估。
  - Trigger: 数据源条款禁止缓存/再分发；请求频率无法满足需求。

- Risk: “决策引导”被误解为投资建议
  - Impact: 合规风险与用户期望偏差。
  - Likelihood: 中
  - Mitigation: 采用流程化检查与信息组织；禁用收益承诺与直接交易建议；明显免责声明。
  - Trigger: UI 文案或功能形态出现“建议买入/卖出”式结论。

## Assumptions register (optional)
- Assumption: MVP 以单机单用户为主，先做本地登录与本地数据仓库
  - Validation plan: 在 Stage C 产出后进行一次跨平台打包与本地数据持久化冒烟测试。
- Assumption: MVP 优先支持日频数据与日频回测
  - Validation plan: 以 3-5 个代表性策略/因子样例验证性能与复现性；必要时再扩展更高频。

## Verification
- All unresolved items from other docs are consolidated here.
