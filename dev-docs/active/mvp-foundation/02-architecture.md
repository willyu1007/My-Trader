# 02 Architecture

## Context & current state
- Frontend/backend packages are placeholders.
- Requirements define a local-first desktop app with account isolation.
- A macro roadmap exists for MVP sequencing.

## Proposed design

### Components / modules
- apps/frontend: React UI for account unlock, portfolio, risk, market data, opinions, backtest.
- apps/backend: Electron main process services for storage, ingestion, and computation.
- packages/shared: shared types, DTOs, and validation helpers.
- dev-docs: task-level documentation for handoff and verification.

### Interfaces & contracts
- IPC surface between frontend and backend for:
  - Account lifecycle (create, lock, unlock, switch)
  - Portfolio and position CRUD
  - Risk exposure calculations and limit rules
  - Market data ingestion and query
  - Opinions/journal CRUD
  - Backtest execution and retrieval
- Data models / schemas:
  - Account index (global)
  - Account business DB (SQLite)
  - Account analysis DB (DuckDB)
  - Shared market cache (SQLite or similar)
- Events / jobs:
  - Market data ingestion tasks with timestamps, source metadata, and volume support

### Boundaries & dependency rules
- Allowed dependencies:
  - Frontend -> backend IPC only
  - Backend -> local DBs and providers (Tushare, CSV)
- Forbidden dependencies:
  - Frontend direct DB access
  - Cross-account read/write after account switch

## Data migration (if applicable)
- Migration steps:
  - Versioned schema per DB (account index, business DB, market cache)
  - Apply migrations at app startup per active DB
- Backward compatibility strategy:
  - Maintain migration history and block startup on migration failure
- Rollout plan:
  - Create new DBs on account creation; migrate existing on unlock

## Non-functional considerations
- Security/auth/permissions:
  - Password unlock only for MVP
  - Tokens stored in local config or OS keychain, never in repo
- Performance:
  - Daily data focus; use shared market cache to avoid duplication
- Observability (logs/metrics/traces):
  - Log ingestion runs, schema migrations, and account switch events

## Open questions
- ETF universe and data source coverage for MVP (resolved: curated whitelist via official list)
- CSV import scope and field mapping (resolved: holdings + prices + volume)
- Shared cache scope and lifecycle (resolved: shared across accounts)
