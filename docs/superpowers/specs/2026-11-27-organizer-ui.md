# Organizer interface refresh

Approved direction: user supplied Screenshot 2026-11-24 125250.png and instructed “rujuk attachment ini dan proceed” on 27 November 2026.

Use the screenshot's white government header, pale blue background, fine borders, spacious two-column cards and prominent event artwork. Keep readable text sizes and mobile layouts rather than copying the screenshot's scale. The crest identifies the application; uploaded event logos identify the selected organizer/event separately.

## Approach

Extend the existing Next.js application with shared authenticated navigation and an event workspace. This preserves existing event administration, registration and permissions. A separate dashboard rewrite would duplicate working operations; static recoloring alone would leave broken event context and login links.

## Requirements

- Authenticated navigation includes My events, attendance, QR scanning, agenda, lucky draw, projector, event settings and sign out. Unauthenticated visitors retain public navigation.
- Preserve selected event in URLs between modules; reject unknown event identifiers rather than silently acting on another event.
- Apply saved primary/accent colors with readable foregrounds, organizer name, slogan, logo, banner, date, time, timezone and location throughout the organizer workspace. Missing artwork has a deliberate text-only layout.
- Use official MYDS React icons and Jata Negara in the navbar. Retain a visible way to navigate out of the draw screen outside fullscreen.
- Refresh dashboard, event editor, agenda, scanner, draw and footer coherently. Preserve scanner lifecycle, CSV exports, passport actions and draw persistence.
- Keep server authorization and database policies in force. No schema or production data changes.
- Provide loading, empty and error states, keyboard navigation, visible focus and mobile menus.

## Validation

Test event context resolution, event links and safe theme values; run the existing test suite, lint, TypeScript and production build. Review desktop/mobile UI in a local browser. Use synthetic data only for isolated visual previews if no test account is available, and disclose limits on authenticated live verification.
