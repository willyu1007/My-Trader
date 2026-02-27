# 02-architecture

## Data model
- New table: `manual_tags`
  - `tag` (PK, normalized `user:*`)
  - `name`, `description`, `color`
  - `is_reserved`, `created_at`, `updated_at`
- Existing `instrument_tags` keeps symbol-tag binding.
- Temp target payload in market settings now includes `createdAt`.

## API surface
- Shared IPC adds manual-tag DTO and APIs:
  - list/create/update/delete manual tags
- Existing listTags response enriched with manual-tag metadata for user tags.
- Temp target list response enriched with profile fields (name/kind).

## UI responsibilities
- Tag management section: 2 equal columns.
- Provider side: compact chip+value style, no duplicate full-tag line.
- Manual side: same list style + add/delete/edit flows.
- Temp target section: heading + counts, toolbar in frame right, tabular rows.

## Risks
- Migration compatibility with existing DB files
- Backward compatibility of existing frontend code using TagSummary
- Reserved tags behavior consistency (non-delete/non-color-edit)
