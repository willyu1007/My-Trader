# Pitfalls / Do-not-repeat

## Summary

- Stage C apply can fail with `EPERM` when writing `.codex/skills` under sandbox; rerun apply with escalated permissions.

## 2026-01-11: EPERM writing `.codex/skills` during Stage C apply

- Symptom: `init-pipeline.cjs apply` fails with `EPERM: operation not permitted` when unlinking/opening files under `.codex/skills/*/SKILL.md`.
- Root cause: Sandbox restrictions prevented writes to `.codex/skills` (Codex provider stubs), while `.claude/skills` remained writable.
- What was tried:
  - Running `.ai/scripts/sync-skills.cjs` in `--mode update` still failed for `--providers codex`.
- Fix/workaround:
  - Re-run Stage C apply with escalated filesystem permissions so the pipeline can regenerate `.codex/skills` stubs.
- Prevention:
  - If Stage C apply hits EPERM on `.codex/skills`, rerun the same apply command with required escalation approval instead of changing the blueprint.
