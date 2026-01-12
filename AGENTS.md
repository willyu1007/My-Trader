# AI Assistant Instructions

MyTrader is a cross-platform (macOS/Windows/Linux) desktop trading workstation for experienced individual traders.
This document records repo navigation and constraints for AI assistants and contributors.

## Project Type

mytrader - 跨平台桌面端个人交易工作台（本地优先）：风险/敞口、组合管理、行情跟踪、数据记录、回测、机会发现、观点管理

## Tech Stack

| Category | Value |
|----------|-------|
| Desktop runtime | Electron |
| Frontend | React + TypeScript |
| Backend | Electron main process (Node) |
| Storage | SQLite (business) + DuckDB (analysis) |
| Package manager | pnpm |
| Repo layout | monorepo (`apps/`, `packages/`) |
| Node | >= 20 |
| LLM | Optional external API |

## Key Directories

| Directory | Purpose | Entry Point |
|-----------|---------|-------------|
| `apps/` | Applications (desktop UI + main process) | `apps/frontend/README.md` |
| `packages/` | Shared packages/types | `packages/shared/README.md` |
| `docs/project/` | Requirements + blueprint (archived) | `docs/project/requirements.md` |
| `addons/` | Optional add-on payloads | `addons/AGENTS.md` |
| `.ai/` | Skills, scripts, LLM governance | `.ai/AGENTS.md` |
| `dev-docs/` | Complex task documentation | `dev-docs/AGENTS.md` |
| `.codex/` | Codex skill stubs (generated) | - |
| `.claude/` | Claude skill stubs (generated) | - |

## Routing

| Task Type | Entry Point |
|-----------|-------------|
| **Project overview / requirements** | `docs/project/requirements.md` |
| **Skill authoring / maintenance** | `.ai/AGENTS.md` |
| **LLM engineering** | `.ai/llm-config/AGENTS.md` |
| **Complex task documentation** | `dev-docs/AGENTS.md` |

## Global Rules

- Always edit `.ai/skills/` (SSOT), never edit `.codex/` or `.claude/` directly
- Follow progressive disclosure: read only the file you are routed to
- For complex tasks (multi-module, multi-session, >2 hours), create docs under `dev-docs/active/`
- On context reset for ongoing work, read `dev-docs/active/<task-name>/00-overview.md` first

## Coding Workflow (MUST)

- Before modifying code/config for a non-trivial task, apply the Decision Gate in `dev-docs/AGENTS.md` and create/update the dev-docs task bundle as required.
- If the user asks for planning artifacts (plan/roadmap/milestones/implementation plan; 规划/方案/路线图/里程碑/实施计划) before coding, use `plan-maker` first, then ask for confirmation to proceed with implementation.
- If the task needs context preservation (multi-session, handoff, 交接, 上下文恢复, 归档) or qualifies as complex, follow `dev-docs/AGENTS.md` and use dev-docs workflows (`create-dev-docs-plan`, `update-dev-docs-for-handoff`).
