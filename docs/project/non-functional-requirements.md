# Non-functional Requirements (NFR)

## Conclusions (read first)
- Security/privacy: 默认本地优先与最小化外发；本地数据按敏感信息对待，提供加密与可导出备份
- Performance: 常用视图秒开；风险/敞口计算在常见数据规模下保持交互流畅；回测在可接受时间内完成并可复现
- Availability: 离线可用；不依赖常驻后端服务；提供备份/恢复与故障降级路径
- Compliance: 当前不作为交易执行或券商系统；不承担监管合规要求（但需提供清晰免责声明与数据来源合规审视）

## Security and privacy
- Data classification:
  - 高敏感：用户自建持仓/交易日志、观点记录、回测参数与结果（可推断投资行为）
  - 中敏感：自选列表、筛选结果、偏好设置
  - 低敏感：公开行情与公开宏观数据（仍需遵守数据源许可）
- Authentication/authorization:
  - 本地账号登录（单用户为主）；权限模型以“解锁本地数据仓库”为核心
  - 未来如引入云同步，再扩展为云端账号体系与设备管理
- Audit/logging:
  - 应用日志默认仅本地保存，可一键导出用于排障
  - 关键数据操作（例如持仓变更、风险限制修改）建议记录变更历史以支持复盘
- Threat model notes:
  - 设备丢失/磁盘被拷贝：需要本地数据加密与安全存储密钥
  - 恶意软件/本机被入侵：无法完全防护；以最小权限、减少敏感外发为原则
  - 数据源篡改/异常：需要来源标记、时间戳与异常检测（例如缺口、突变）
- Compliance:
  - 明确：不提供投资建议、不承诺收益、不替代持牌服务
  - 明确：数据源许可与使用条款需在接入前审查并记录

MVP scope note:
- 暂不强制实现“本地数据加密/密钥托管/一键备份”，先以功能闭环为主；相关能力作为后续增强项纳入风险与规划。

## Performance and scalability
- Target latency:
  - 应用冷启动进入主界面：5 秒内（典型开发机/用户机）
  - 组合概览与风险面板切换：500 毫秒内完成渲染（不含首次数据拉取）
  - 风险/敞口重计算：2 秒内（常见规模：单组合 500 个持仓、日频数据）
- Throughput:
  - 行情更新：按数据源能力增量刷新；支持按标的批量请求并缓存
  - 回测运行：支持批量计算与可取消，避免阻塞 UI 线程
- Data size expectations:
  - 日频 K 线：按 10 年规模估算（A 股+港股股票与 ETF，约 8000–12000 标的量级）需要支持分区/压缩/归档策略
  - 分钟级数据：不建议默认全量保存所有标的；优先对自选/候选池/回测 Universe 做增量采集与保留策略（否则体量会快速膨胀）
  - 回测结果：以“可复现”为目标保存必要摘要、参数、数据版本与关键中间产物，避免无限膨胀
- Scaling assumptions:
  - 单机单用户为主；并发写入压力有限
  - 若未来引入云同步/多用户协作，将迁移到服务端数据库与任务队列架构

## Availability and resilience
- Availability target:
  - 离线可用（无网络时可查看历史数据与本地记录）
  - 外部数据源不可用时可降级：使用最近缓存数据并提示“数据时间”
- Backup/restore expectations:
  - 暂不作为 MVP 强制要求（后续增强）；MVP 至少保证数据目录可被用户手动拷贝与迁移
- Failure modes and degradation:
  - 数据源异常：标记缺失区间，避免静默错误影响回测/风险计算
  - 本地数据库损坏：提供修复尝试、只读模式与恢复引导
  - 回测任务长耗时：支持取消、进度展示与资源占用提示

## Operability
- Observability:
  - 本地日志：按天滚动、可配置级别、可导出
  - 运行诊断：记录数据源请求统计与失败原因（不包含敏感内容）
- Support workflows:
  - 用户可导出：诊断包（日志 + 配置摘要 + 数据库版本信息）
  - 用户可选择性开启崩溃报告（默认关闭或显式征得同意）

## Data sourcing constraints (licensing / crawling)

- 数据源接入必须遵守许可与使用条款；如需要 API Key，则由用户配置，本地安全保存
- 自动爬取功能需默认关闭或显式启用，并具备限流、失败重试与反爬变化的降级策略
- 任何“爬取/抓取”能力必须可被替换为官方 API 或用户导入文件，以降低合规与稳定性风险
- 允许调用外部 LLM API（用于观点整理/相似发现等），但必须：
  - 用户显式启用并配置 API Key
  - 默认不上传持仓等高敏感数据（或提供脱敏/选择性上传机制）

## Verification
- Each section has either measurable targets or explicit “pending decision” items recorded in `risk-open-questions.md`.
