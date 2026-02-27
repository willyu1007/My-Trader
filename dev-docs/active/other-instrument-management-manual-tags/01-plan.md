# 01-plan

## Phase 1: Data/Contract foundation
- Add persistent manual tag metadata store
- Add temp-target createdAt persistence
- Extend shared contracts and IPC channels

## Phase 2: Backend behavior
- Implement CRUD for manual tags
- Ensure delete-tag cascades remove symbol-tag bindings
- Enrich temp targets with instrument profile name/kind

## Phase 3: Frontend refactor
- Rework tag management headers/search/layout
- Implement manual-tag add modal + delete mode + color edit
- Refactor temp-target list to tabular columns and in-table action toolbar

## Phase 4: Verification
- Run backend/frontend/shared typechecks
- Smoke test core instrument-management flows
- Browser MCP visual confirmation of layout

## Acceptance criteria
- Manual tags can be created empty, edited (description/color), listed, deleted
- Provider and manual columns are equal width and visually aligned
- Temp target table shows symbol/name/type/added/remain columns
- Batch action toolbar is inside temp-target frame, right aligned
