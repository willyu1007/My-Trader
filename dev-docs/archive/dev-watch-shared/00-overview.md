# Overview

Status: done

## Goal
- Add a shared package watch build during `pnpm dev`.
- Auto-restart Electron when backend or shared outputs change, reducing manual restarts.

## Non-goals
- Change frontend Vite configuration or routing.
- Add hot reload for main/preload without restarting Electron.

## Notes
- Keep existing dev flow (backend script spawns Vite + Electron).
