# Roadmap

## Milestones
1. IPC contract extension for test-data scenarios/inject/cleanup.
2. Backend scenario registry and idempotent inject/cleanup execution.
3. Other-Test UI refactor to scenario cards + execution panel.
4. Verification (typecheck + manual smoke checks).

## Scope boundaries
- Only remove CSV import UI from Other-Test tab.
- Keep legacy CSV import APIs and `seedDemoData` compatibility path.
- No persistent execution history dashboard.

## Rollback strategy
- Revert frontend tab to previous static demo/CSV view.
- Keep new backend APIs dormant (unused by UI) if partial rollback is needed.
