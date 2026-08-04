# Implementation

## Current Coverage

- User token logs API now accepts `billing=all|billable`, defaults to `all`, and clamps user-facing
  list size to 50.
- `countsBusinessQuota` is exposed to the user console log views so the UI can filter by request-kind
  billing semantics without inferring from charge amount or quota state.
- Token detail recent requests default to 50 rows, support `All / Quota usage` filtering, and keep
  the desktop table inside a scrollable 10-row viewport.
- Mobile token detail shows a dedicated recent-requests entry, while the full filtered list lives on
  the separate token logs route.
- Storybook coverage includes desktop token detail and mobile logs entry states, with visual evidence
  captured for the desktop 10-row scroll layout.
- The desktop log table keeps its native header for semantics and column sizing while rendering an
  aligned visual header outside the browser's table painting context. The shared sticky-header
  stylesheet uses a 56px semi-transparent surface, progressive backdrop filtering, and a
  synchronized 12px-blurred row backdrop so both light and dark themes keep a visible frosted
  effect while preventing sharp body-row text from painting over labels.

## Validation

- `bun test ./src/UserConsole.stories.test.ts`
- `bun run build`
- `bun run build-storybook`
- Playwright verification of light/dark Storybook canvases at `1440x1100`, including internal
  scrolling, sticky positioning, semi-transparent header backgrounds, and blurred backdrop styles.
