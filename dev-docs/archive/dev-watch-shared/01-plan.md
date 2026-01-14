# Plan

## Phase 1: Dev script updates
- Spawn a watch build for `packages/shared`.
- Spawn a watch build for backend dist and add restart hooks.

## Phase 2: Restart behavior
- Add file watchers for backend/shared dist outputs.
- Debounce and restart Electron only when builds complete.

## Acceptance Criteria
- `pnpm dev` keeps a watch build running for `packages/shared`.
- Electron auto-restarts after backend/shared dist changes.
- Existing Vite dev server behavior is unchanged.
