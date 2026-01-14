# Implementation Notes

- Added a shared watch build script and wired it into the backend dev runner.
- Added file watchers for backend/shared dist outputs to trigger a debounced Electron restart.
- Kept the initial build gate so Electron starts only after shared/backend builds complete.
