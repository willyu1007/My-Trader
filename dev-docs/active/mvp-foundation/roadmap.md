# MyTrader MVP Foundation - Roadmap

## Goal
- Deliver a local-first MVP that supports account-isolated storage, portfolio/position management, risk views, and daily market data ingestion for A-share + common ETFs, followed by opinions and basic backtest per the agreed priority.

## Non-goals
- Automated trading or broker integration
- Cloud sync / multi-device sharing
- Multi-user collaboration or org permissions
- Futures/options/derivatives trading
- Intraday/HFT-grade data or execution
- Storing API tokens or secrets in the repo
- At-rest encryption in MVP (optional later)

## Open questions and assumptions
### Open questions (answer before execution)
- Q1: What is the exact "common ETF" universe for MVP, and which official data source covers it? (answered)
- Q2: CSV import scope for MVP (holdings only, trades, watchlists, or all of them) and expected field mapping? (answered)
- Q3: Confirm shared market-data cache across accounts is acceptable for MVP. (answered)

### Assumptions (if unanswered)
- A1: MVP focuses on A-share + common ETFs only; HK/US data is out of scope (risk: low).
- A2: Password unlock only, no DB encryption in MVP (risk: low).
- A3: Only one account database is open at a time (risk: low).

### Decisions (confirmed)
- ETF coverage: use Scheme A (official list) with a curated ETF whitelist; include easy-to-educate bond and precious-metals ETFs.
- CSV scope: holdings + daily prices + volume; no trade ledger in MVP.
- Market cache: shared local cache across accounts is acceptable for MVP.

## Scope and impact
- Affected areas/modules: apps/backend, apps/frontend, packages/shared, docs/project, dev-docs
- External interfaces/APIs: Tushare (A-share), CSV import; AkShare reserved for HK/US later
- Data/storage impact: global account index + per-account SQLite business DB + per-account DuckDB analysis DB + shared market-data cache
- Backward compatibility: greenfield, no migrations needed yet

## Milestones
1. **Milestone 1**: Foundation and account-scoped storage
   - Deliverable: Electron app skeleton + account unlock flow + DB layout and migrations
   - Acceptance criteria: create account, select data directory, lock/unlock, DBs created per account
2. **Milestone 2**: Portfolio and risk
   - Deliverable: portfolio/position CRUD + valuation + risk exposures and limit warnings
   - Acceptance criteria: weights/exposures shown; limit breaches explainable
3. **Milestone 3**: Market data ingestion
   - Deliverable: official-source ingestion for A-share + common ETF data; CSV import for holdings and prices; cache + timestamping
   - Acceptance criteria: valuations use latest data; data is traceable to source and time
4. **Milestone 4**: Opinions/journal
   - Deliverable: structured opinion entries, tags, search, linkage to instruments/portfolios
   - Acceptance criteria: create/search/review entries and link from holdings
5. **Milestone 5**: Backtest (daily)
   - Deliverable: daily backtest with fees/taxes, saved runs, basic metrics and curves
   - Acceptance criteria: backtest results are reproducible and saved with parameters

## Step-by-step plan (phased)
> Keep each step small, verifiable, and reversible.

### Phase 0 - Discovery
- Objective: confirm ETF data source coverage, CSV schema, and shared cache decision
- Deliverables:
  - data-source decision notes
  - CSV field mapping spec
- Verification:
  - decisions recorded and approved
- Rollback:
  - N/A (no code changes)

### Phase 1 - Foundation and account storage
- Objective: establish app skeleton, IPC, and account-scoped storage layout
- Deliverables:
  - account index store
  - per-account business DB and analysis DB
  - login/lock UI flow
- Verification:
  - manual: create account, lock/unlock, ensure data directories are isolated
- Rollback:
  - remove created DB files and revert migrations

### Phase 2 - Portfolio and risk
- Objective: implement portfolio/position CRUD and risk exposures
- Deliverables:
  - portfolio/position models and CRUD
  - exposure views and limit rules
- Verification:
  - manual: create portfolio, add positions, see exposures and limit warnings
- Rollback:
  - revert schema and UI changes for this phase

### Phase 3 - Market data ingestion
- Objective: ingest official market data and support CSV import
- Deliverables:
  - Tushare integration for A-share + ETF daily data
  - shared market cache storage
  - CSV import pipeline for holdings and prices
- Verification:
  - manual: ingest data, compute valuation from latest prices, confirm timestamps
- Rollback:
  - disable ingestion jobs and remove cached data

### Phase 4 - Opinions/journal
- Objective: capture trade ideas and research notes
- Deliverables:
  - opinion CRUD + tags + search
  - linkage to instruments/portfolios
- Verification:
  - manual: create/edit/search notes and link them
- Rollback:
  - remove opinion tables and UI routes

### Phase 5 - Backtest (daily)
- Objective: run daily backtests with fees/taxes and save runs
- Deliverables:
  - backtest engine with fees/taxes
  - run persistence and comparison views
- Verification:
  - manual: run backtest and verify metrics + curves saved
- Rollback:
  - disable backtest modules and remove runs

## Verification and acceptance criteria
- Build/typecheck:
  - `pnpm typecheck`
- Automated tests:
  - unit tests added per module (when introduced)
- Manual checks:
  - account creation, lock/unlock, and data-dir selection
  - portfolio CRUD + risk exposure view
  - market data ingestion + CSV import
  - opinions CRUD + search
  - backtest run + results saved
- Acceptance criteria:
  - MVP priority order implemented: portfolio > risk > market > opinions > backtest
  - data is local-first and account-isolated
  - official-source import and CSV import are both supported

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|---:|---:|---|---|---|
| ETF data source coverage is insufficient | med | high | validate provider coverage early; add fallback source | ingest gaps in coverage report | disable ETF ingestion or restrict universe |
| Token handling leaks secrets | low | high | store tokens in local config/OS keychain only | repo scan for secrets | revoke token and rotate |
| Schema changes block upgrades | low | med | versioned migrations per DB | migration failures on startup | revert to previous schema |
| Shared cache causes cross-account confusion | low | med | keep cache read-only for accounts; log source | mismatched data timestamps | clear cache and rebuild |

## Optional detailed documentation layout (convention)
If you maintain a detailed dev documentation bundle for the task, the repository convention is:

```
dev-docs/active/mvp-foundation/
  roadmap.md              # Macro-level planning (plan-maker)
  00-overview.md
  01-plan.md
  02-architecture.md
  03-implementation-notes.md
  04-verification.md
  05-pitfalls.md
```

The roadmap document can be used as the macro-level input for the other files. The plan-maker skill does not create or update those files.

Suggested mapping:
- The roadmap's Goal/Non-goals/Scope -> `00-overview.md`
- The roadmap's Milestones/Phases -> `01-plan.md`
- The roadmap's Architecture direction (high level) -> `02-architecture.md`
- Decisions/deviations during execution -> `03-implementation-notes.md`
- The roadmap's Verification -> `04-verification.md`

## To-dos
- [ ] Confirm open questions
- [ ] Confirm milestone ordering and DoD
- [ ] Confirm verification/acceptance criteria
- [ ] Confirm rollout/rollback strategy
