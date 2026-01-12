# 01 Plan

## Milestones
1. Foundation and account storage
   - Acceptance: account create/lock/unlock, isolated data directories, DBs created per account
2. Portfolio and risk
   - Acceptance: portfolio/position CRUD, exposure views, limit warnings with explainable inputs
3. Market data ingestion
   - Acceptance: A-share + ETF daily data ingestion, CSV import (holdings + prices + volume), cached with timestamps
4. Opinions and journal
   - Acceptance: create/search/tag entries and link to instruments/portfolios
5. Backtest (daily)
   - Acceptance: run daily backtests with fees/taxes, save results and metrics

## Detailed steps
1. Confirm ETF universe, CSV mapping, and shared cache policy.
2. Scaffold Electron app, IPC layer, and storage layout (account index + per-account DBs).
3. Implement portfolio/position models and risk exposure calculations.
4. Add market data ingestion pipeline + CSV import (holdings + prices + volume).
5. Build opinions/journal module with tags and search.
6. Implement daily backtest engine and persistence.
7. Add smoke checks and basic unit tests per module.

## Risks & mitigations
- Risk: ETF data source coverage gaps
  - Mitigation: validate provider coverage early; define fallback source or restrict universe
- Risk: account data leakage across DBs
  - Mitigation: enforce single active account connection and isolate file paths
- Risk: token mishandling
  - Mitigation: store tokens in local config or OS keychain only; never in repo
