# 03 Implementation Notes

## Status
- Current status: planned
- Last updated: 2026-01-12

## What changed
- Created dev-docs bundle for MVP foundation planning; no code changes yet.

## Files/modules touched (high level)
- dev-docs/active/mvp-foundation/*
- docs/project/requirements.md

## Decisions & tradeoffs
- Decision: account-scoped business DBs + shared market cache
  - Rationale: strong isolation with minimal data duplication
  - Alternatives considered: single shared DB with account_id partitioning
- Decision: no DB encryption in MVP
  - Rationale: reduce complexity; password unlock only
  - Alternatives considered: SQLCipher or filesystem encryption
- Decision: curated ETF whitelist based on official list; include bond and precious-metals ETFs
  - Rationale: deterministic scope and easier coverage validation
  - Alternatives considered: fully automatic ETF discovery from providers
- Decision: CSV import includes holdings + daily prices + volume; no trade ledger in MVP
  - Rationale: supports valuation and risk without trade-level reconstruction
  - Alternatives considered: full trade-ledger import

## Deviations from plan
- None.

## Known issues / follow-ups
- Define the initial ETF whitelist (names/tickers) and map to official source fields.
- Specify CSV column names and validation rules for holdings/prices/volume.

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in `05-pitfalls.md` (append-only).
