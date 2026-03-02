# 01-plan

## Phase 1: Contract
- Add scenario list/inject/cleanup types and IPC channels.
- Extend preload `window.mytrader.market` API exposure.

## Phase 2: Backend
- Implement scenario registry with six scenarios:
  - portfolio.core
  - market.multi_domain
  - tags.watchlist.targets
  - data_status.ingest_completeness
  - valuation.ready
  - insights.sample
- Implement dependency expansion and ordered execution.
- Implement namespace-based cleanup safeguards.

## Phase 3: Frontend
- Replace Other-Test layout with two-panel workbench:
  - left: scenario cards + multi-select
  - right: execution panel + summary
- Remove CSV import section from test tab.

## Phase 4: Verification
- Run frontend/backend/workspace typecheck.
- Record outcomes and manual smoke checks.
