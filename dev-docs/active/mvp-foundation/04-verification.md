# 04 Verification

## Automated checks
- `pnpm typecheck` -> expect exit 0 once scaffolding and TS config are in place
- `pnpm test` -> expect exit 0 once unit tests are added

## Manual smoke checks
- Create account -> expect new data directory and DB files created
- Lock/unlock -> expect account data inaccessible while locked
- Switch account -> expect previous account DBs closed and data isolated
- Add portfolio/position -> expect exposure and limit warnings to appear
- Ingest market data + CSV import -> expect valuations updated with timestamps
- Create opinion -> expect tag + search to return results
- Run backtest -> expect metrics and curves saved and reloadable

## Rollout / Backout (if applicable)
- Rollout: local desktop app update only; no server deploy
- Backout: remove account data directories and shared cache if corruption occurs
