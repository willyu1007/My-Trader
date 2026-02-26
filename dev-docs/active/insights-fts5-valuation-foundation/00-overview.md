# 00 Overview

## Status
- State: in_progress
- Last updated: 2026-02-26
- Next step: 执行 UI 手工联调与 E2E 验收（观点生命周期、scope 展开、symbol 侧解绑、跨资产预览）。

## Goal
- 构建“观点模块 + 估值方法体系”首版可运行能力。
- 观点可作用于所有可估值标的（开放集合，symbol 落地），并支持时间轴插值、算子冲突合并、双向解绑。
- 在标的侧展示“当前值 vs 调整后值”与影响链路。

## Non-goals
- 本任务不做 instrument_id 全链路迁移（仍以 symbol 为落地键）。
- 本任务不补齐所有未接入行情域的数据采集链路（未接入域用模板占位 + not_applicable）。
- 本任务不做云端同步与多用户协作。

## Context
- 当前仓库已完成 `sql.js` FTS5 runtime 升级。
- 观点页当前仍为 placeholder，尚无 insights entity / valuation methods entity。
- 现有标的主键语义以 `symbol` 为主；`kind/assetClass/market` 已具备，适合先做开放集合落地。

## Acceptance criteria (high level)
- [x] FTS5 runtime 可用且可回归验证。
- [x] 业务库新增 insights/valuation 相关 schema 与索引。
- [x] shared IPC 定义完成并可在 preload/main/renderer 全链路调用。
- [x] 观点 CRUD + scope 展开 + materialization + exclusion + FTS 搜索可用。
- [x] 估值方法管理（内置只读、克隆、自定义发布）可用。
- [x] 标的估值预览可展示 base vs adjusted 与 applied effects。
