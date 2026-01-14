# Architecture

## UI Structure
- `Dashboard` component becomes the workspace shell.
- Left sidebar renders navigation from a single config array.
- Main area renders a header + the active view body.

## State Ownership
- Portfolio/risk/market data and forms remain in `Dashboard` state.
- View components are conditionally rendered based on `activeView`.

## Styling
- Extend `styles.css` with sidebar, nav item, view header, and placeholder styles.
- Use existing design tokens and panel styles for consistency.
