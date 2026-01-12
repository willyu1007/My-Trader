# Architecture Notes (Init System)

## Init pipeline entry point

- `node init/skills/initialize-project-from-requirements/scripts/init-pipeline.cjs <command> --repo-root .`

## Stage outputs

- Stage A:
  - Generates `init/stage-a-docs/*` templates and `init/project-blueprint.json` template.
  - Validation: `check-docs --strict`
- Stage B:
  - Validates `init/project-blueprint.json`.
  - Validation: `validate`
- Stage C:
  - Applies scaffold/config/skill packs and optional add-ons.
  - Validation: command success + smoke checks as needed.

## Add-ons

- Stage C may install add-on payloads non-destructively (copy-if-missing), depending on blueprint settings.

