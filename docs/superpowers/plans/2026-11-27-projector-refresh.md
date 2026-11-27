# Tayangan: dedicated event presentation

User request: completely redesign the unfriendly projector screen, preserving the previously requested standalone screens.

Design: a dedicated presentation canvas without the application navbar/footer. Keep event identity in a clear header, artwork as the main visual, registration QR and participant count in a focused side panel, and date/location/clock readable from a distance. Use saved colors with contrast-aware text. Provide a compact toolbar outside the fullscreen canvas, plus an accessible fullscreen exit control. Stack naturally on phones, where registration is also directly clickable. Missing artwork gets a text-led event panel.

Preserve published-event scoping, 10-second polling and safe event assets. Initial count is unknown rather than a misleading zero. Connection problems retain the event visual, show reconnection feedback and hide stale registration QR; unpublished events remove the presentation. Registration-closed state has a deliberate replacement panel.

- [x] Test registration-display/count state decisions; implement the pure helper.
- [x] Replace EventProjector with the dedicated canvas, event-aware visual identity and fullscreen controls.
- [x] Replace obsolete projector styling with a responsive dedicated stylesheet.
- [x] Verify desktop, mobile, fullscreen, missing artwork, closed/unpublished events and network interruption with synthetic fixtures; run tests, lint and build.

## Verification

145 tests passed, with no failures/skips. Final lint and production build passed (build includes TypeScript). Browser presentation fits without scrolling at 1366×768, 1440×1000 and 1920×1080 with the synthetic event; mobile 390px had no horizontal overflow. Native fullscreen was denied by the test browser, so the viewport presentation fallback was exercised instead: its exit control, Escape, focus entry/containment/restoration and inert toolbar passed. Physical projection/native-fullscreen behavior was not verified on a real display.

Synthetic browser fixtures verified clickable event-specific QR, closed registration, no artwork, offline QR removal with identity retained, automatic recovery, and removal of event identity on unpublish. No hosted event or attendee data was changed. QA processes were stopped after checks. Independent review identified the fallback-focus issue; the correction was verified with keyboard actions.

Visuals: ignored `.verification/projector-desktop.png`, `.verification/projector-mobile.png`, `.verification/projector-fullscreen.png`. Previous standalone UI work remains intact. No deployment or commit.

Continue in the current checkout. Preserve all earlier standalone-screen work. No database changes or deployment.
