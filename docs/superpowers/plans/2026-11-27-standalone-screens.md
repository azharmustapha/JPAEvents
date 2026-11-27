# Standalone organizer screens

User direction: separate every screen, move scanner/settings/logout into hamburger or profile dropdown, and make My events more inviting and suitable for any event. This refines the already authorized organizer UI work.

**Design:** Neutral white navigation and pale background; event artwork appears in the My events catalog rather than a repeated hero above every module. Each event card uses its own saved palette and artwork. Module screens retain a small event context/selector and their own heading/content only. Desktop profile disclosure contains scanner, settings and logout; mobile hamburger contains grouped primary and account actions. Keep existing MYDS icons and crest.

**Approach:** Reuse existing operations and protected routes. Move attendance to `/admin/kehadiran`; replace `/admin` with a responsive, searchable event catalog. Avoid embedding attendance, agenda, scanner, editor or draw inside the catalog or one another.

- [x] Test catalog search/status behavior, then implement a pure catalog filter.
- [x] Move existing attendance operations to the separate attendance route; retain CSV, searching and passport actions.
- [x] Replace the shared event hero with compact context, correct module/back links, and separate primary/profile navigation.
- [x] Build the event catalog with artwork, statuses, useful details, empty states and create/manage/attendance actions.
- [x] Verify desktop/mobile dropdown behavior, isolated modules, event selection, filters, regression tests, lint and production build.

## Verification

142 tests passed; lint and standalone TypeScript check passed; production build passed with the new `/admin/kehadiran` route and 18 generated pages. Independent read-only review returned no actionable findings.

Local browser checks used only synthetic Auth/REST fixtures on a separate QA build. Verified primary navigation excludes scanner/settings/logout; profile disclosure contains those actions; Escape returns focus and outside click closes it. Catalog filtering and reset, attendance CSV download, screen isolation, editor event switching, mobile hamburger grouping, navigation dismissal and horizontal overflow checks passed. Normal profile logout returned to the login page. The real local server rejected anonymous/forged access to the new attendance route. Live-account operations and camera hardware were not tested. Temporary QA servers were stopped; no real data was changed.

Screenshots are in ignored `.verification/standalone-catalog-desktop.png`, `.verification/standalone-catalog-mobile.png`, and `.verification/standalone-attendance-mobile.png`.

No database changes, deployments or commits are included. Continue in the existing checkout and preserve earlier changes.
