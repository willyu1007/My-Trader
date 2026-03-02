# 03-implementation-notes

## 2026-03-02
- Added shared IPC contracts for test data scenario listing/inject/cleanup.
- Added preload bridge methods for new market test-data IPC channels.
- Implemented `marketTestDataService` with six scenario handlers and cleanup paths.
- Wired new IPC handlers in backend runtime.
- Rebuilt Other-Test tab into a scenario workbench and removed CSV import UI.
- Added test-data status contract (`getTestDataStatus`) and backend scenario-level status aggregation.
- Changed left scenario area from card layout to 4-column list layout (`名称 / 覆盖 / 依赖 / 大小`), with description moved to name hover tooltip.
- Added right-side "当前已注入数据" status table showing scenario injection state, total count, and per-scenario breakdown.
