# 02-architecture

## Data flow
1. UI loads scenario catalog via `market.listTestDataScenarios`.
2. User selects scenarios and triggers inject/cleanup.
3. Backend resolves dependencies, executes scenarios serially, aggregates summary.
4. UI displays summary counters and per-scenario mini results.

## Backend modules
- `services/marketTestDataService.ts`
  - scenario metadata registry
  - inject/cleanup handlers per scenario
  - aggregate result builder
- `ipc/registerIpcHandlers.ts`
  - bind new channels to service methods

## Safety design
- Test data is namespaced with `test:` tags and `TEST*` symbols.
- Cleanup filters by namespace/prefix to avoid deleting non-test records.
- Legacy APIs remain available to avoid coupling regressions.
