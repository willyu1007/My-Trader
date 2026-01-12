# mytrader

跨平台桌面端个人交易工作台（本地优先）：风险/敞口、组合管理、行情跟踪、数据记录、回测、机会发现、观点管理

## Scope (MVP)

- Markets: A 股、港股
- Instruments: 股票、ETF（含债券 ETF、贵金属 ETF 等高流通性风险管理品类）
- Data sources: A 股主数据源 Tushare；港股/美股 AkShare（必要时补充交易所公开数据）
- Backtest: 日频优先；纳入 A 股涨跌停与费用税；港股费用税也纳入（参数与规则版本需可复现）
- Opinions: 结构化字段 + 标签 + 全文检索（后续预留 RAG/LLM 相似发现；允许外部 API）

## Tech Stack

| Category | Value |
|----------|-------|
| Desktop runtime | Electron |
| Frontend | React + TypeScript |
| Backend | Electron main process (Node) |
| Storage | SQLite (business) + DuckDB (analysis) |
| Node | >= 20 |
| Package manager | pnpm |
| Repo layout | monorepo |

## Repo Layout

- `apps/frontend/` - UI
- `apps/backend/` - Desktop main process / local services
- `packages/shared/` - Shared types/utilities
- `docs/project/` - Requirements and blueprint (archived)

## Docs

- Requirements: `docs/project/requirements.md`
- Blueprint: `docs/project/project-blueprint.json`

## Getting Started

- Install: `pnpm install`
- Dev: `pnpm dev` (placeholder until Electron/Vite scaffolding is added)
- Test: `pnpm test` (placeholder)
- Typecheck: `pnpm typecheck`
