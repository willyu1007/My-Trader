# 01 Plan

## Milestones
1. M1 破坏性配置切换（移除 precious_metal）
2. M2 Universe 金属口径链路（metal_futures / metal_spot）
3. M3 Target SSOT-first + 缺口回补触发
4. M4 任务矩阵与可观测（target_task_status / materialization runs）
5. M5 回归验证与灰度准备

## Acceptance
- 旧 bucket 输入会被拒绝并提示重设
- 全量池配置仅允许 `cn_a/etf/metal_futures/metal_spot`
- 目标池每个 symbol/module 均有状态 `complete/partial/missing/not_applicable`
- `ingest_runs` 的 inserted/updated/errors 具备可对账语义
- 手动/定时/启动补跑/暂停恢复取消不回退
