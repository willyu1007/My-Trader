# 01 Plan

## Milestones
1. M1: Foundation alignment (Phase A)
- Deliverables:
  - 统一表与资产扩展表迁移顺序定稿（含幂等校验）
  - 批次开关、回滚开关、告警阈值配置
  - 目标表与 run 统计对账口径固化
- Acceptance:
  - 迁移可重复执行
  - 旧链路可回退

2. M2: P0 rollout (Phase B)
- Deliverables:
  - 股票/ETF/指数上下文/期货/现货（SGE）Universe 接入
  - Target 模块按规划状态矩阵输出
  - P0 资产首轮全量 + 增量回归
- Acceptance:
  - 覆盖率与质量门禁达到 P0 阈值
  - 指数上下文模块稳定供给 stock/etf

3. M3: P1 rollout (Phase C)
- Deliverables:
  - 外汇日线白名单入库与 Target 消费
  - 宏观模块（国内 + 美国）入库、`available_date` 生效与版本追溯
- Acceptance:
  - 外汇覆盖达标
  - 宏观 missing 占比与回测安全达标

3.1 M3-R: P1 stability-to-recovery (Phase C extension)
- Deliverables:
  - 模块级恢复开关（`universeIndexDailyEnabled/universeDailyBasicEnabled/universeMoneyflowEnabled`）
  - 模块级游标（index_daily / daily_basic / moneyflow）
  - Wave 恢复执行框架（按接口独立分片与独立回滚）
- Acceptance:
  - 主链路稳定产出持续达标
  - Wave-1/2/3 按顺序灰度恢复并通过门禁

4. M4: P2 rollout (Phase D)
- Deliverables:
  - 权限型/专题型增强模块按接口探测结果灰度开放
  - 模块级开关、回滚路径与隔离验证
- Acceptance:
  - P2 功能可独立开关
  - 不回退 P0/P1 已达标结果

5. M5: Stabilization and handoff (Phase E)
- Deliverables:
  - 三批次综合覆盖率/质量/稳定性报告
  - 异常处置手册与回滚手册
  - 下一阶段 backlog（未纳入模块、依赖权限接口）
- Acceptance:
  - 文档可直接支撑归档决策

## Execution Sequence
1. 先做 Phase A 的 schema 与开关基线
2. 再完成 P0（主交易相关资产）
3. 然后推进 P1（外汇/宏观）
4. 在 P1 内先完成稳定产出，再按 wave 恢复降级接口
5. 最后灰度上线 P2 并做全链路稳态回归

## Stage gate rules (MUST)
1. Phase A -> Phase B (P0) entry gate
- MUST 完成统一表迁移 dry-run + rollback 演练各 1 次。
- MUST 完成批次开关与回滚开关落库，并能通过手工切换验证。

2. Phase B (P0) exit gate
- MUST 完成 P0 全量 + 增量回归。
- MUST 满足 P0 覆盖率与质量门禁。
- MUST 连续 3 个交易日无阻断错误 run。

3. Phase C (P1) exit gate
- MUST 完成外汇与宏观链路回归。
- MUST 满足 P1 覆盖率与回测安全门禁（`available_date`）。
- MUST 完成降级接口恢复（Wave-1/2/3）或形成保留降级的正式豁免记录。

4. Phase D (P2) entry gate
- MUST 在 P0/P1 均稳定后再启动。
- MUST 对每个 P2 模块完成“权限探测记录 + 单模块开关验证 + 单模块回滚验证”。

5. Failure handling gate
- 任一 gate 未通过时，MUST 冻结后续阶段，仅允许修复当前阶段或回滚到上一稳定阶段。

## Dependency Strategy
- 复用 `real-data-auto-fetch` 已落地能力：
  - ingest orchestrator
  - scheduler/control state
  - ingest run 可观测体系
  - Targets/Universe 基础入口
- 本任务只补“多资产覆盖域能力”，避免重复重构既有基础设施。

## Risks and Mitigations
- Risk: 批次并行造成调度拥塞与失败扩散
- Mitigation: 严格按批次放开 + 限并发 + checkpoint 断点续跑

- Risk: 宏观发布时间口径不一致导致未来数据穿越
- Mitigation: 强制 `available_date` 生效规则 + 回测安全门禁

- Risk: P2 增强模块冲击核心链路稳定性
- Mitigation: P2 仅灰度放开，失败可独立回滚
