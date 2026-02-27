# 05-pitfalls

## do-not-repeat summary
- Frontend theme contract rejects inline color literals in most TS/TSX files; use tokenized/dynamic construction to avoid `#xxxxxx` literals.
- Manual tag CRUD must preserve reserved-tag constraints in both UI and backend (backend remains source of truth).
- `listTags` alone is not enough for manual-tag metadata (description/color/editable); UI must call dedicated manual-tag APIs.
- Browser MCP attached to plain Vite pages cannot validate Electron preload-dependent flows; keep run-action verification as fallback.
