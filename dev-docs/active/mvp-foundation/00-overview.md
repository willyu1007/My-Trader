# 00 Overview

## Status
- State: in_progress
- Next step: Run manual smoke checks for portfolio/risk/market flows and record verification results

## Goal
Deliver a local-first MVP with account-isolated storage and the agreed priority order: portfolio, risk, market data, opinions, backtest.

## Non-goals
- Automated trading or broker integration
- Cloud sync or multi-device sharing
- Multi-user collaboration or org permissions
- Derivatives or intraday/HFT data
- Database encryption in MVP
- HK/US ingestion in MVP

## Context
- Electron + React scaffold is in place with IPC and account unlock UI.
- Account isolation requirements and MVP roadmap exist; Milestone 1 groundwork is implemented, Milestone 2+ pending.

## Acceptance criteria (high level)
- [x] Account index + per-account DBs created on login; only one account open at a time
- [x] Portfolio/position CRUD with risk exposures and limit warnings (pending verification)
- [x] Official-source + CSV import for A-share and common ETF daily data (pending verification/token)
- [ ] Opinions/journal CRUD with tags and search
- [ ] Daily backtest with fees/taxes and saved runs
