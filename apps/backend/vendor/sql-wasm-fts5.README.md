# sql-wasm-fts5.wasm provenance

- Source project: `sql.js`
- Source tag: `v1.13.0`
- Build date: `2026-02-26`
- SQLite compile flag delta: added `-DSQLITE_ENABLE_FTS5`
- Output file: `sql-wasm-fts5.wasm`

## Build notes (local)

1. Clone `https://github.com/sql-js/sql.js` at tag `v1.13.0`.
2. In `Makefile`, add `-DSQLITE_ENABLE_FTS5` to `SQLITE_COMPILATION_FLAGS`.
3. Build with emsdk (`npm run rebuild`).
4. Copy `dist/sql-wasm.wasm` to this folder as `sql-wasm-fts5.wasm`.

The backend build script `apps/backend/scripts/copy-sql-wasm.mjs` prefers this file over the default wasm in `node_modules/sql.js/dist/`.
