# 全量池升级 V2 Roadmap（数据来源中心）

## 目标
把当前“单 token + 三桶位”升级为“主令牌 + 一级域 + 二级模块 + 连通性测试 + readiness 门禁 + 旧配置迁移”的完整体系，先交付 UI/UX 与配置框架，按接入状态分批开放同步。

## 里程碑
1. 契约层升级（shared/preload/ipc channels）
2. 后端目录注册中心 + 配置/测试/令牌存储 + readiness
3. IPC handlers 对接与旧接口兼容
4. 前端数据来源中心 UI/UX（树 + 详情 + 测试 + 门禁）
5. 编排与拉取门禁改造（手动/调度）
6. 迁移与回归验证

## 冻结决策
- 贵金属独立现货域（`spot`），不再依附 ETF 子集。
- env token 改为兜底优先级（域覆盖 > 主令牌 > env）。
- 二级模块不配置 token。
- provider 首版仅 `tushare` 可用，其他 provider 仅展示为 planned。
- 配置项先做全，未接入模块不可纳入同步。
