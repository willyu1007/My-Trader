# 02 Architecture

## Boundaries
- Universe ingest: 负责目录同步、分域采集、SSOT 写入
- Target ingest: 负责 SSOT 覆盖检查、回补触发、任务状态物化

## Key Interfaces
- Shared: UniversePoolBucketId, TargetTaskModuleId, TargetTaskStatus, TargetTaskMatrixConfig
- IPC: get/setTargetTaskMatrixConfig, previewTargetTaskCoverage, listTargetTaskStatus, runTargetMaterialization

## Risks
- 破坏性配置切换导致用户历史配置失效
- SSOT-first 带来首轮延迟
- 金属现货仅 SGE 导致覆盖预期偏差
