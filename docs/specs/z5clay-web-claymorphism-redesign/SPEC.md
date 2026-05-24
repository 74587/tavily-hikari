# Web Claymorphism Redesign

## Status

active

## Summary

Tavily Hikari's web surfaces adopt a high-fidelity claymorphism visual system across the public homepage, user console, admin console, authentication screens, and shared UI components. Light tropical clay remains the primary theme, while dark tropical clay is a low-light companion theme with calmer tinted neutrals, restrained semantic accents, and no decorative glassmorphism. The redesign keeps the existing React/Vite/Tailwind/shadcn architecture and does not change backend APIs or data contracts.

## Scope

- Centralize clay palette, typography, radii, elevation, motion, and reduced-motion behavior.
- Keep light and dark theme tokens aligned so shared components, page shells, and fallback routes inherit one material system.
- Upgrade shared UI wrappers and legacy compatibility classes so existing pages inherit the new material language.
- Keep admin data tables, request logs, quota controls, and settings panels dense and readable.
- Keep Storybook as the primary review surface for page and component states.

## Non-goals

- No backend API, database, authentication, proxy, or quota behavior changes.
- No new design framework or daisyUI runtime dependency.
- No marketing-only landing page rewrite that hides the actual proxy workflows.
- No hard-coded dark-only visual language that bypasses the shared token system.

## Design Contract

- Default surface is light tropical clay with a pale lavender canvas and saturated violet, pink, sky, emerald, and amber accents.
- Dark surface is low-light tropical clay with warm violet tinted neutrals, subtle ambient color, and semantic accents used for state and selection rather than decoration.
- Headings and large labels use Nunito; body and controls use DM Sans; code, tokens, and request paths remain monospace.
- Buttons lift on hover and compress on active press. Inputs and selected controls use recessed pressed shadows.
- Cards and panels use multi-layer clay shadows, but admin list and table density remains suitable for repeated operations.
- Dark cards, dialogs, drawers, dropdowns, loading regions, and empty/error states avoid bright white rim lights, large outer glows, and glass blur.
- Decorative motion must respect `prefers-reduced-motion`.

## Acceptance Criteria

- Public, user console, admin, login, registration paused, and fallback/error states share the same clay token system.
- Shared shadcn/Radix wrappers visually match the global compatibility classes.
- Storybook covers the redesigned UI in light mode and includes stable dark-mode evidence for shared components, admin dashboard, public home, user console, registration paused, and fallback routes.
- Visual evidence is captured from stable Storybook or mock UI sources and stored under this spec.
- `cd web && bun run build` passes.

## Visual Evidence

- source_type: storybook_canvas
  target_program: mock-only
  capture_scope: browser-viewport
  requested_viewport: 1440x1100
  viewport_strategy: storybook-viewport
  sensitive_exclusion: N/A
  submission_gate: pending-owner-approval
  story_id_or_title: design-system-claymorphism--dark-overview
  state: dark shared clay system
  evidence_note: verifies the low-light clay token set, shared cards, buttons, badges, recessed rows, and dense table sample.
  PR: include
  image:
  ![Dark shared clay system](./assets/dark-repair/dark-design-system.png)

- source_type: storybook_canvas
  target_program: mock-only
  capture_scope: browser-viewport
  requested_viewport: 1440x1100
  viewport_strategy: storybook-viewport
  sensitive_exclusion: N/A
  submission_gate: pending-owner-approval
  story_id_or_title: admin-pages--dashboard-dark
  state: dark admin dashboard
  evidence_note: verifies the repaired admin shell, sidebar, dashboard cards, chart region, alerts, and loading-compatible surfaces without bright rim lights.
  PR: include
  image:
  ![Dark admin dashboard](./assets/dark-repair/dark-admin-dashboard.png)

- source_type: storybook_canvas
  target_program: mock-only
  capture_scope: browser-viewport
  requested_viewport: 1440x1100
  viewport_strategy: storybook-viewport
  sensitive_exclusion: N/A
  submission_gate: pending-owner-approval
  story_id_or_title: public-publichome--token-modal-open-dark
  state: dark public token modal
  evidence_note: verifies the public hero modal, form controls, dialog shell, and warning copy on the shared dark clay material.
  PR: include
  image:
  ![Dark public token modal](./assets/dark-repair/dark-public-token-modal.png)

- source_type: storybook_canvas
  target_program: mock-only
  capture_scope: browser-viewport
  requested_viewport: 1440x1100
  viewport_strategy: storybook-viewport
  sensitive_exclusion: N/A
  submission_gate: pending-owner-approval
  story_id_or_title: user-console-userconsole--console-home-dark
  state: dark user console
  evidence_note: verifies the user-console header, quota surfaces, token list, guide card, and code blocks under the repaired dark clay tokens.
  PR: include
  image:
  ![Dark user console](./assets/dark-repair/dark-user-console.png)

- source_type: storybook_canvas
  target_program: mock-only
  capture_scope: browser-viewport
  requested_viewport: 1440x1100
  viewport_strategy: storybook-viewport
  sensitive_exclusion: N/A
  submission_gate: pending-owner-approval
  story_id_or_title: support-pages-notfoundfallback--dark-theme
  state: dark 404 fallback
  evidence_note: verifies fallback routes inherit the shared dark background, shell, link, and text contrast instead of a one-off hard-coded page.
  PR: include
  image:
  ![Dark 404 fallback](./assets/dark-repair/dark-404.png)

- source_type: storybook_canvas
  target_program: mock-only
  capture_scope: browser-viewport
  requested_viewport: 390x900
  viewport_strategy: storybook-viewport
  sensitive_exclusion: N/A
  submission_gate: pending-owner-approval
  story_id_or_title: public-publichome--guide-token-revealed-dark-mobile
  state: dark public mobile guide
  evidence_note: verifies mobile dark guide cards, tabs, code samples, token reveal copy, and touch-size controls on the shared material system.
  PR: include
  image:
  ![Dark public mobile guide](./assets/dark-repair/dark-public-mobile-guide.png)

- source_type: storybook_canvas
  target_program: mock-only
  capture_scope: browser-viewport
  requested_viewport: 1440x1100
  viewport_strategy: browser-resize-fallback
  sensitive_exclusion: N/A
  submission_gate: pending-owner-approval
  story_id_or_title: design-system-claymorphism--overview
  state: clay token and component gallery
  evidence_note: verifies the shared clay palette, typography, controls, status badges, and dense table sample.
  PR: include
  image:
  ![Clay design system overview](./assets/clay-system-overview.png)

- source_type: storybook_canvas
  target_program: mock-only
  capture_scope: browser-viewport
  requested_viewport: 1440x1200
  viewport_strategy: browser-resize-fallback
  sensitive_exclusion: N/A
  submission_gate: pending-owner-approval
  story_id_or_title: admin-pages--dashboard
  state: admin dashboard density
  evidence_note: verifies the restrained clay treatment for the admin shell and data-dense dashboard cards.
  PR: include
  image:
  ![Admin dashboard clay treatment](./assets/admin-dashboard-clay.png)

- source_type: storybook_canvas
  target_program: mock-only
  capture_scope: browser-viewport
  requested_viewport: 390x1100
  viewport_strategy: browser-resize-fallback
  sensitive_exclusion: N/A
  submission_gate: pending-owner-approval
  story_id_or_title: public-publichomeherocard--logged-out-no-token
  state: mobile public hero
  evidence_note: verifies the mobile public homepage clay hero, buttons, metrics, and solid readable headline.
  PR: include
  image:
  ![Public mobile clay hero](./assets/public-mobile-clay.png)

- source_type: storybook_canvas
  target_program: mock-only
  capture_scope: browser-viewport
  requested_viewport: 390x900
  viewport_strategy: browser-resize-fallback
  sensitive_exclusion: N/A
  submission_gate: pending-owner-approval
  story_id_or_title: public-pages-registrationpaused--default
  state: mobile registration paused
  evidence_note: verifies the clay treatment for the registration paused route and fallback action.
  PR: include
  image:
  ![Registration paused mobile clay route](./assets/registration-mobile-clay.png)

- source_type: web_demo
  target_program: mock-only
  capture_scope: browser-viewport
  requested_viewport: 1440x1000
  viewport_strategy: playwright-chrome
  sensitive_exclusion: mock API runtime only
  submission_gate: pending-owner-approval
  route: /?demo=1
  state: public route board
  evidence_note: verifies the non-template public hero with reduced card elevation, traffic routing board, metric rail, and demo-mode badge.
  PR: include
  image:
  ![Public demo route board](./assets/public-demo-route-board.png)

- source_type: web_demo
  target_program: mock-only
  capture_scope: browser-viewport
  requested_viewport: 1440x1000
  viewport_strategy: playwright-chrome
  sensitive_exclusion: mock API runtime only
  submission_gate: pending-owner-approval
  route: /admin.html?demo=1
  state: admin priority panel
  evidence_note: verifies the admin overview leads with operational priority while repeated cards use calmer borders and minimal elevation.
  PR: include
  image:
  ![Admin priority panel](./assets/admin-priority-panel.png)

- source_type: web_demo
  target_program: mock-only
  capture_scope: browser-viewport
  requested_viewport: 1440x1100
  viewport_strategy: headless-chrome-cdp
  sensitive_exclusion: mock API runtime only
  submission_gate: pending-owner-approval
  route: /admin
  state: clay material rebalance admin desktop
  evidence_note: verifies the Admin dashboard keeps dense data grouping while restoring visible clay material shadows, rim lights, recessed priority surfaces, and tactile buttons.
  PR: include
  image:
  ![Clay material rebalance admin desktop](./assets/clay-rebalance/admin-desktop-clay.png)

- source_type: web_demo
  target_program: mock-only
  capture_scope: browser-viewport
  requested_viewport: 390x900
  viewport_strategy: headless-chrome-cdp
  sensitive_exclusion: mock API runtime only
  submission_gate: pending-owner-approval
  route: /admin
  state: clay material rebalance admin mobile
  evidence_note: verifies the stronger clay material treatment does not reintroduce mobile header overlap, horizontal overflow, console warnings, or small mobile touch targets.
  PR: include
  image:
  ![Clay material rebalance admin mobile](./assets/clay-rebalance/admin-mobile-clay.png)

- source_type: web_demo
  target_program: mock-only
  capture_scope: browser-viewport
  requested_viewport: 1440x1100
  viewport_strategy: headless-chrome-cdp
  sensitive_exclusion: mock API runtime only
  submission_gate: pending-owner-approval
  route: /
  state: clay material rebalance public desktop
  evidence_note: verifies the public page now carries a more recognizable clay material through stronger ambient blobs, convex routing nodes, tactile buttons, and soft outer surfaces.
  PR: include
  image:
  ![Clay material rebalance public desktop](./assets/clay-rebalance/public-desktop-clay.png)

- source_type: web_demo
  target_program: mock-only
  capture_scope: browser-viewport
  requested_viewport: 1440x1100
  viewport_strategy: headless-chrome-cdp
  sensitive_exclusion: mock API runtime only
  submission_gate: pending-owner-approval
  route: /admin
  state: critique fix dense admin dashboard
  evidence_note: verifies the Admin homepage uses a denser operations-console hierarchy, less nested card elevation, clearer action labels, and no visible duplicate H1.
  PR: include
  image:
  ![Critique fix dense admin dashboard](./assets/fix-critique/admin-desktop-dense.png)

- source_type: web_demo
  target_program: mock-only
  capture_scope: browser-viewport
  requested_viewport: 390x900
  viewport_strategy: headless-chrome-cdp
  sensitive_exclusion: mock API runtime only
  submission_gate: pending-owner-approval
  route: /admin
  state: critique fix mobile admin header
  evidence_note: verifies the mobile Admin sidebar control no longer collides with the page header, with no horizontal overflow and no small mobile touch targets.
  PR: include
  image:
  ![Critique fix mobile admin header](./assets/fix-critique/admin-mobile-header.png)

- source_type: web_demo
  target_program: mock-only
  capture_scope: browser-viewport
  requested_viewport: 1440x1100
  viewport_strategy: headless-chrome-cdp
  sensitive_exclusion: mock API runtime only
  submission_gate: pending-owner-approval
  route: /
  state: critique fix condensed public guide
  evidence_note: verifies the public guide exposes the primary clients first and moves secondary clients behind a compact menu.
  PR: include
  image:
  ![Critique fix condensed public guide](./assets/fix-critique/public-guide-condensed.png)

- source_type: web_demo
  target_program: mock-only
  capture_scope: browser-viewport
  requested_viewport: 390x900
  viewport_strategy: headless-chrome-cdp
  sensitive_exclusion: mock API runtime only
  submission_gate: pending-owner-approval
  route: /login.html
  state: critique fix login title hierarchy
  evidence_note: verifies the login page no longer repeats the same Admin Login heading and keeps the mobile form compact with no small touch targets.
  PR: include
  image:
  ![Critique fix login title hierarchy](./assets/fix-critique/login-mobile-title.png)

- source_type: web_demo
  target_program: mock-only
  capture_scope: browser-viewport
  requested_viewport: 390x920
  viewport_strategy: playwright-chrome
  sensitive_exclusion: mock API runtime only
  submission_gate: pending-owner-approval
  route: /?demo=1
  state: mobile demo badge
  evidence_note: verifies the mobile route-board layout, reduced card treatment, and compact demo marker without blocking key content.
  PR: include
  image:
  ![Public mobile demo badge](./assets/public-mobile-demo-badge.png)

- source_type: web_demo
  target_program: mock-only
  capture_scope: browser-viewport
  requested_viewport: 390x920
  viewport_strategy: playwright-chrome
  sensitive_exclusion: mock API runtime only
  submission_gate: pending-owner-approval
  route: /admin.html?demo=1
  state: audit fix mobile admin
  evidence_note: verifies the mobile admin route has no horizontal overflow and keeps touch targets reachable after the audit fixes.
  PR: include
  image:
  ![Audit fix mobile admin](./assets/fix-audit/admin-mobile.png)

- source_type: web_demo
  target_program: mock-only
  capture_scope: browser-viewport
  requested_viewport: 390x920
  viewport_strategy: playwright-chrome
  sensitive_exclusion: mock API runtime only
  submission_gate: pending-owner-approval
  route: /?demo=1
  state: audit fix mobile public
  evidence_note: verifies public mobile links and guide controls meet the mobile touch-target fixes without reintroducing overflow.
  PR: include
  image:
  ![Audit fix mobile public](./assets/fix-audit/public-mobile.png)
