# Public event experience refresh

User asks to redesign all of `/events/coff-b`, continuing the authorized UI work. Read-only inspection shows a published COFF-B event with organizer, logo, theme, date/time/location and no banner. Current public UI repeats its details alongside a full registration form and generic service chrome.

**Design:** Event-led overview with generous typography, a clear status badge, organizer identity, readable facts and a focused registration call to action. Show uploaded banner when present; without one, use an intentional text-led layout rather than empty artwork. Separate overview, registration and agenda routes. Registration gets a concise event summary and one focused form; agenda gets an ordered timeline with loading/error/empty states. Preserve the finished standalone projector. Use saved event palette with safe contrast and official MYDS icons.

Keep the government crest/navbar required earlier. Hide the generic service footer on event pages in favor of a compact event footer. Authenticated navigation remains available. Avoid hardcoding COFF-B content: render its saved data and apply the same quality to every public event.

- [x] Replace public-event composition with separate overview/registration/agenda screens and scoped styling.
- [x] Refine registration states and field presentation without changing RPC consent/validation/passport behavior.
- [x] Correct saved-pass and agenda async lifecycle so results cannot leak across event changes.
- [x] Verify actual COFF-B read-only plus synthetic public flows, mobile layout, loading/closed/saved-pass/error states, tests/lint/build.

## Verification record

145 tests passed with no failures/skips. Final lint and production build (including TypeScript) passed. Inspected the real local `/events/coff-b`, `/daftar` and `/atur-cara` routes read-only at 1440px and 390px: no page errors or horizontal overflow, overview has no embedded form, and the actual empty agenda resolves to a useful empty state. Mobile registration/agenda content precedes the full event summary.

Synthetic localhost QA fixtures verified duplicate-registration feedback with retained inputs, successful registration redirect and token storage, saved-pass form replacement, rejection of another event's saved pass, closed registration without a dead form, and agenda error/retry. No real event registration was submitted.

Independent review identified a stalled saved-pass request blocking registration. A 6-second abort/race now releases the form and ignores a late result; the browser stalled-response test passed. Agenda requests also have a 10-second abort deadline. Event/section keys and cancellation prevent stale callbacks from updating another screen.

QA servers were stopped afterward. Visuals remain in ignored `.verification/coff-b-overview-desktop.png`, `.verification/coff-b-overview-mobile.png`, `.verification/coff-b-register-desktop.png`, `.verification/coff-b-register-mobile.png`, and `.verification/coff-b-agenda-mobile.png`. No deployment or commit was performed.

Do not submit registrations against real events. No database changes or deployment. Preserve prior projector and organizer work.
