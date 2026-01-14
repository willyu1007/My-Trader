# Plan

## Phase 1: Layout + Navigation
- Add a left sidebar with the requested feature list.
- Track active view state in the workspace component.
- Provide a view header with title/description for the active view.

## Phase 2: View Separation
- Move portfolio overview + holdings to the portfolio view.
- Move risk/exposure to the risk view.
- Move market data to the market view.
- Create placeholder panels for opportunities/backtest/insights/alerts/other.
- Add an account view with account summary + lock action.

## Phase 3: Styling + Responsive
- Add sidebar, nav, and view header styles.
- Ensure layout collapses for smaller widths.

## Acceptance Criteria
- Left navigation is visible after login and lists all requested features.
- Each feature renders its own view; content is not all on one page.
- Existing portfolio/risk/market functionality continues to work.
- Placeholder views provide clear “coming soon” messaging.
