# Organizer UI verification — 27 November 2026

## Delivered

- White government navbar and footer, Jata Negara from the official MYDS asset, and official `@govtechmy/myds-react/icon` icons.
- Authenticated navigation for events, attendance, scanner, agenda, draws, projector, settings and logout. Projector navigation explains that draft events must be published first.
- Shared event workspace with uploaded banner/logo, saved colors, slogan, organizer, publishing status, date/time/timezone and location.
- Screenshot-inspired pale background, thin borders and white cards across the dashboard, editor, agenda, scanner and draw. Navigation remains available on the draw page outside fullscreen.
- Explicit event URLs across modules; initial default selection is pinned in the URL so closing registration does not switch to another event.
- Workspace subtree resets on event changes, clearing participant previews and unfinished module state. Scanner cancellation is checked before a delayed check-in request.
- Streamed hydration handles an Auth event arriving before a navbar/footer Suspense boundary hydrates.
- Logout handles this installed Supabase SDK clearing local credentials even when remote revocation returns an error.

## Checks

| Check | Result |
| --- | --- |
| `npm test` | 140 passed; 0 failures/skips |
| `npm run lint` | Passed; 0 errors/warnings |
| `npx tsc --noEmit` | Passed |
| Final `npm run build` | Passed, including TypeScript and all 17 generated pages |
| `git diff --check` | Passed |
| Anonymous/forged-session requests to five protected routes | All redirected to `/admin/login` |

The existing `npm run test:auth` printed PASS for its anonymous route checks and SKIPPED for hosted-account checks, then exited with a Node 24 Windows libuv assertion in its explicit `process.exit(0)` path. Repeating the five route assertions in a standalone script that exits normally passed with exit code 0. No verified hosted test account was supplied; real-account login/logout was not exercised.

## Browser verification

Used a separate localhost QA build and loopback-only synthetic Auth/REST fixtures. No production identities, attendee records or stored event settings were modified. Temporary QA servers were stopped afterward.

- Desktop 1440px and mobile 390px: reviewed the dashboard, menu, agenda, scanner shell, editor and draw layout. No horizontal document overflow in tested screens.
- Switched from a blue event with artwork to a purple event without artwork; module URL, branding and selected event stayed aligned.
- Opened `/admin` without a query; confirmed canonical event URL and selection retention after toggling registration.
- Unknown event ID displayed an access/selection error with no other event card or participant rows.
- Mobile menu exposed all modules and logout; links closed the menu.
- Both normal logout and simulated remote logout failure cleared local private UI and returned the public menu.
- Reload after the hydration correction produced no page errors in the checked screens.
- Camera hardware scanning, real draw persistence, fullscreen projection and hosted-account flows were not end-to-end tested against a live service. Existing unit/database tests cover the underlying operations; browser checks here focused on the changed UI.

Visual captures remain in ignored `.verification/organizer-desktop.png`, `.verification/organizer-mobile.png`, `.verification/agenda-desktop.png` and `.verification/draw-desktop.png`. They contain synthetic event content; some module captures include loading states.

## Review and dependencies

An independent read-only review identified a default-selection jump after closing registration; pinning the default selection in the URL resolved it and the browser assertion passed. Its scanner cancellation finding was also resolved before completion.

Production dependency audit reported the existing Next.js 16.3.6 advisory group; no new production dependency advisory was reported for MYDS. Framework upgrades remain outside this UI change.

References: [MYDS icons](https://design.digital.gov.my/en/icon), [MYDS usage](https://design.digital.gov.my/en/docs/develop/usage), [official crest asset](https://d2391uizq0pg2.cloudfront.net/common/jata-negara.png).
