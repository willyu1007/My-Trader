# 05 Pitfalls (do not repeat)

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)
- 不要直接把 `codex/dashboard-modularization-pr1` 整分支 merge 到 `main`。
- 不要用 `pr1` 版本整文件覆盖 `main` 的重叠核心文件（ingest/IPC/DuckDB/Dashboard）。
- 不要在同一批次同时切换 Dashboard 架构与后端 ingest 行为。
- 不要移除 rollout flags 兼容接口，直到完成稳定观察窗。

## Pitfall log (append-only)

### 2026-02-22 - Branch divergence underestimation
- Symptom: `pr1` 与 `main` 在 12 个核心文件同时有改动，且语义方向不一致（如 DuckDB runtime、rollout flags）。
- Context: 需求目标是“合并 pr1 到 main 且不返工 main 收口成果”。
- What we tried: 先做全量 diff + overlap 分析，再决定合并策略。
- Why it failed (or current hypothesis): 若按常规 merge，会把 `main` 的 9 个后续稳定提交重新冲掉。
- Fix / workaround (if any): 改为“main 基线 + 分批移植 + 每批次门禁”的集成策略。
- Prevention (how to avoid repeating it): 任何后续批次先过 overlap 检查，再进入实现。
- References (paths/commands/log keywords): `git log main..codex/dashboard-modularization-pr1`, `git log codex/dashboard-modularization-pr1..main`, `comm -12` overlap list.
