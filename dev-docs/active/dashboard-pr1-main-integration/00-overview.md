# 00 Overview

## Status
- State: in_progress（2026-02-22 reopen）
- Next step: 收口“全量池以 `tushare-rollout-closure` 为基线”的代码与运行态对齐，并完成回归确认。

## Goal
在不回退 `main` rollout 收口与稳定修复成果的前提下，把 `codex/dashboard-modularization-pr1` 的功能与重构成果分批并入主干。

## Non-goals
- 不做整分支一次性合并。
- 不在单个批次里同时完成后端行为重写与前端结构大重构。
- 不在本轮移除兼容接口（rollout flags/旧 token API）。
- 不采用 Dashboard 双轨运行（本轮目标为直接模块化切换完成）。

## Context
- 当前分支状态：`main` 相对 merge-base 新增 10 个提交；`pr1` 新增 42 个提交。
- 双方重叠改动 12 个关键文件，集中在 ingest、IPC、Dashboard、DuckDB 运行时。
- `main` 已完成 rollout 收口与多轮稳定性修复，属于必须保留基线。

## Acceptance criteria (high level)
- [x] `main` 稳定修复关键行为不回退（DuckDB、stale-run 收敛、rollout 兼容、phase gate）。
- [x] Source Center V2 + token matrix 能力可用且兼容旧 API。
- [x] Target/Universe 双池能力可用且 ingest 对账可解释。
- [x] Dashboard 模块化直接切换完成；根据用户确认（2026-02-22）使用历史数据完成闭环验收。
