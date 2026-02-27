# 00-overview

## Goal
Refactor Other -> Instrument Management to support persistent manual tag entities (allow empty tags), richer temporary-target table columns/actions, and updated UI layout/interaction.

## Non-goals
- Redesigning unrelated tabs
- Changing ingest pipeline semantics
- Modifying provider tag generation rules

## Scope
- Backend schema/repository/service updates
- Shared IPC contract updates
- Electron preload + main ipc handlers
- Frontend instrument-management UI and interaction updates

## Status
done

## Current focus
Completed backend + frontend delivery and type/build verification.
