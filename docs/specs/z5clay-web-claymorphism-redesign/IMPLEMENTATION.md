# Implementation

## Current Plan

- Add project design context in `PRODUCT.md` and `DESIGN.md`.
- Add a final clay override stylesheet imported after existing light/dark/page styles.
- Update Tailwind tokens and shared UI wrappers for clay shadows, radii, input depth, and button feedback.
- Update Storybook defaults and stories as needed for stable visual review.
- Repair dark tropical clay as a first-class companion theme across shared components, public pages, user console, admin shell, registration paused, and fallback routes.
- Add stable dark Storybook entries for shared clay tokens, admin dashboard, public home, user console desktop/mobile, token detail, and registration paused surfaces.

## Validation

- `cd web && bun run build` passes.
- `cd web && bun test UserConsole.stories.test.ts PublicHome.stories.test.ts AdminPages.stories.test.ts NotFoundFallbackPreview.stories.test.ts` passes.
- `cd web && bun test` passes.
- `cd web && bun run build-storybook` passes.
- `git diff --check` passes.
- Storybook canvas evidence captured from `design-system-claymorphism--overview`, `admin-pages--dashboard`, `public-publichomeherocard--logged-out-no-token`, and `public-pages-registrationpaused--default`.
- Dark Storybook canvas evidence captured from `design-system-claymorphism--dark-overview`, `admin-pages--dashboard-dark`, `public-public-home--token-modal-open-dark`, `user-console-user-console--console-home-dark`, and `support-pages-notfoundfallback--dark-theme`.
- Codex review finding for dark-mode clay token inheritance was fixed; follow-up review reported no actionable correctness, build, or regression findings.
