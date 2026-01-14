# Architecture

## Processes
- `pnpm dev` continues to execute `apps/backend/scripts/dev.mjs`.
- The script spawns:
  - Vite dev server
  - One-time builds (shared + backend)
  - Watch builds (shared + backend)
  - Electron process

## Restart Trigger
- File watchers observe `apps/backend/dist/*.js` and `packages/shared/dist/*.js`.
- Changes trigger a debounced Electron restart.
