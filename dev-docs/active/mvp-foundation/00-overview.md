# 00 Overview

## Status
- State: planned
- Next step: Confirm ETF universe and CSV schema; decide shared market cache scope

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
- Repo has placeholder frontend/backend packages and requirements.
- Account isolation requirements and MVP roadmap exist; no implementation yet.

## Acceptance criteria (high level)
- [ ] Account index + per-account DBs created on login; only one account open at a time
- [ ] Portfolio/position CRUD with risk exposures and limit warnings
- [ ] Official-source + CSV import for A-share and common ETF daily data
- [ ] Opinions/journal CRUD with tags and search
- [ ] Daily backtest with fees/taxes and saved runs
