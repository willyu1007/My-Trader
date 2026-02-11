# 02 Architecture

## 核心边界
- 目录定义（域/模块/接入状态）由 backend `dataSourceCatalog` 单点维护。
- 业务配置与测试记录存 `business.sqlite.market_settings`。
- token 仅 safeStorage 加密存储，不入库明文。

## 关键不变式
- token 优先级：domain override > main > env fallback。
- 未接入模块不可被启用同步（前后端双门禁）。
- readiness 规则由后端统一计算，前端仅展示。

## 兼容策略
- 保留旧 token IPC：映射到主令牌。
- 保留旧 universe pool IPC：从 v2 config 派生 stock/etf 桶位。
- 旧 `pool:precious_metal` 进入弃用，不自动映射 `spot` 启用。
