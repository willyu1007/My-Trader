# Plan

Status: done

## Phase 1: Stage A (requirements docs)

- [x] Run `start` to generate Stage A templates.
- [x] Draft Stage A docs and run `check-docs --strict`.
- [x] Get explicit user approval, then `approve --stage A`.

Acceptance criteria:
- [x] `check-docs --strict` passes.

## Phase 2: Stage B (blueprint)

- [x] Draft `project-blueprint.json` (now archived to `docs/project/project-blueprint.json`).
- [x] Run `validate`.
- [x] Review packs, then `approve --stage B`.

Acceptance criteria:
- [x] `validate` passes.

## Phase 3: Stage C (apply)

- [x] Run `apply --providers both` to scaffold/configure and sync skill wrappers.
- [x] Get explicit user approval, then `approve --stage C`.

Acceptance criteria:
- [x] Stage C apply completes without errors.

## Optional: Post-init housekeeping

- [x] Update root `AGENTS.md` and `README.md` from the blueprint.
- [x] Run `cleanup-init --archive` (Stage A + blueprint archived to `docs/project/`, `init/` removed).
