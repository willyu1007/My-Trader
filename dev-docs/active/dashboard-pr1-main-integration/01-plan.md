# 01 Plan

## Milestones
1. [x] 固化 `main` 稳定基线与防回退守卫。
2. [x] 合入 shared/preload 的协议追加（兼容旧接口）。
3. [x] 合入 backend Source Center V2（服务 + IPC + readiness）。
4. [x] 合入 target/universe 双池与任务矩阵（并集整合）。
5. [x] 合入前端 Source Center V2 + Dashboard 模块化切换（非双轨）。
6. [x] 完成 Dashboard 模块化直接切换；按用户确认使用历史数据完成闭环验收（2026-02-22）。

## Detailed steps
- 在集成分支上创建 guard checklist，明确不可回退项。
- 拆分 PR-1：只做 shared/preload 协议追加，不改运行逻辑。
- 拆分 PR-2：只做 backend Source Center V2 服务与 handler，确保旧 token API 仍可用。
- 拆分 PR-3：合并 dual-pool/target-task，采用“main 稳定修复 + pr1 新能力”并集方式改造重叠文件。
- 拆分 PR-4：迁移前端 Source Center V2 UI 能力，不切 Dashboard 结构。
- 拆分 PR-5：引入 dashboard 模块目录与兼容壳，完成直接切换。
- 每个 PR 独立执行 typecheck/build/smoke，并记录到 `04-verification.md`。

## Risks & mitigations
- Risk: 重叠文件直接覆盖导致 `main` 修复丢失。
  - Mitigation: 所有重叠文件仅做人工并集整合，禁止整文件替换。
- Risk: Dashboard 模块化切换回归难定位。
  - Mitigation: 分阶段提交 + 切换前后全量 smoke + 快速 PR 级回退。
- Risk: Source Center V2 与旧 API 不兼容。
  - Mitigation: preload 同时暴露新旧 API，迁移期保持双写/双读语义。
