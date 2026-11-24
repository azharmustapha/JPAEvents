# Connect JPAEvents to your Studio

The companion project at `D:\Development\BRSA-Studio` is a static browser-only certificate workspace. JPAEvents needs a Next.js server and its own Supabase project, so deploy it as a separate service first.

Once the JPAEvents URL is available:

1. Set the Studio Event registration navigation and dashboard tool card to that exact URL.
2. Open the service in a separate tab using `target="_blank" rel="noopener noreferrer"` to preserve unsaved certificate edits.
3. Remove Planned labels only after verifying the destination.
4. Test desktop/mobile navigation and existing certificate import, editing, project save/open and PDF/ZIP exports.
5. Export attendees as CSV from JPAEvents and import that file into Certificates manually.

No Studio code or hosting configuration is changed until a real destination URL is chosen. Shared sign-on, automatic participant sync and server storage for certificate files are outside this release. The Studio name remains independent.
