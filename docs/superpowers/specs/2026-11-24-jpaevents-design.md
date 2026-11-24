# JPAEvents: project study and proposed design

Status: approved by the user on 24 November 2026 ("proceed").
Date: 24 November 2026.

## Purpose

Turn this event-specific attendance application into JPAEvents, a reusable event registration service available from the user's studio. Organizers sign up, create and update their own events, customize event details and themes, and share a simple registration link. Attendees should be able to register from a phone without creating an account.

The user identified the companion project as `D:\Development\BRSA-Studio`. The integration recommendation below is a builder proposal, not a previously approved user decision.

## What exists today

| Area | Existing implementation | Implication |
| --- | --- | --- |
| Application | Next.js 16.3.6, React 19, TypeScript, Tailwind 4 | Reuse the application rather than rewrite registration |
| Database and login | Supabase PostgreSQL/Auth; an `admin_users` allowlist | No organizer signup, workspace ownership, or separation between customers |
| Events | `perhimpunan`, with title, text/theme value, date, time, location, session code | Useful foundation, but no description, organizer, publishing state, or customizable branding |
| Active event | A unique database index allows only one active event globally; creation deactivates the previous event | Different customers cannot run independent events |
| Participants | Public registration RPC, name, division/unit, email, compulsory public-service pledge | Registration is tailored to government officers; field requirements need to become event-specific |
| Public routes | `/`, `/daftar`, `/atur-cara`, `/tayangan` discover the global active event | Shared public routes need explicit event context |
| Digital pass | Personal token URL, numbered pass, PNG/PDF exports | Keep exports; printed QR currently points to an old organization's Google Drive folder instead of the scanner token |
| Administration | Sessions, attendance, CSV, agenda editing, QR scan, saved lucky-draw winners | Preserve useful modules and enforce workspace/event ownership for every operation |
| Lucky draw | Pass numbers 1–5 are always excluded | Replace the event-specific exception with an explicit setting; default to all eligible attendees |
| Themes | Text or exactly one bundled artwork (`metamorfosis.png`) | Not a general theme editor or upload system |
| Branding | Government crest, JPA/BRSA copy, Meta Airlines artwork, footer artwork, old icons, download names, browser-storage prefixes | Cleanup must include assets, UI, exports, documentation, fixtures, and deployment names |
| Installation | Fresh schema automatically inserts an old event and agenda; a separate seed contains another old agenda | A clean installation must start empty |
| Git | Old `origin` pointed at the previous event repository | Remote has been removed locally; existing commits remain |

No existing Supabase database, credentials, attendee records, or production services were changed during this study. Local environment values were not printed.

## Companion studio findings

BRSA-Studio uses plain JavaScript, esbuild, and static hosting. Its certificate generator runs in the browser and has no authentication or shared database. Its hash router recognizes `#events`, but that screen is explicitly a planned tool. Certificate projects and participant lists are kept in memory or downloaded project files. The README states that participant files are not uploaded.

Consequently, putting Next.js routes directly into the current static build would require changing the studio's hosting/runtime. The studio also has no identity system for JPAEvents to reuse yet.

## Approaches

1. **Recommended: separate JPAEvents service linked from Studio.** Keep the Next.js application and Supabase backend. Replace the studio's planned Events entry with a configurable link to JPAEvents once a destination is supplied. Deliver a cohesive navigation/return link. Existing attendee CSV exports can be imported into Certificates manually. This provides the tool without disrupting certificate projects or static hosting. Login lives in JPAEvents initially.
2. **Single Next.js studio.** Port the studio shell and certificate UI into this Next.js app, with shared navigation and organizer identity. This produces one application and URL, but requires a larger migration and regression testing of all certificate functionality, deployment, and browser-only processing.
3. **Separate installation per customer.** Easier to isolate an individual deployment, but duplicates upgrades, setup, and operations. This does not fit an accessible self-service studio well and is not recommended.

Use approach 1 as the proposed initial direction, with explicit approval required. A later single-app migration remains possible. No iframe integration is proposed.

## Phase 1: neutral JPAEvents foundation

- Rename the package to `jpaevents`, container name to `jpaevents-web`, metadata/title to JPAEvents, and update documentation and setup instructions.
- Replace the old government/airline logos and application icons with a neutral JPAEvents identity; remove unused old identity artwork and its special rendering logic.
- Remove organization-specific text, Google Drive destinations, event defaults, and public-service pledge copy. Use participant/event language rather than officer/monthly-assembly language.
- Remove automatic sample data from the fresh-install schema and remove obsolete event-specific seed scripts. Do not automatically delete any data from an existing database.
- Rewrite current documentation, old task notes, and test fixtures where they preserve the old project's identity. Preserve required `AGENTS.md` framework instructions and third-party notices. Update behavioral expectations when the underlying rules change.
- Use JPAEvents browser-storage keys. Do not republish old participant tokens or customer-specific assets.
- Detach local Git push/fetch configuration from the old repository. This is complete. Leave local commit history in place unless the user explicitly confirms a history reset; detaching a remote does not erase historical names from commits or delete the GitHub repository.
- Keep ignored environment files private and unchanged during review. Before a real new deployment, configure a dedicated JPAEvents Supabase project and hosting variables. Never ship existing local credentials or assume the old database is empty.

## Phase 2: organizer accounts and event ownership

Proposed default: a verified email/password account can create an organizer workspace and immediately create events. No payment/subscription system is included in this first release.

- Add organizer workspaces and membership records. Start with one owner per newly created workspace; team invitations can follow later.
- Associate each event with a workspace. Scope participant, agenda, theme assets, and draw access through that ownership.
- Replace global admin authorization with membership checks in server routes, database policies, RPCs, and storage policies. Authentication alone never grants access to another workspace.
- Remove the globally unique active-event assumption. Each event has its own draft/published state and registration-open state. Creating an event does not close another event.
- Draft events and their agendas are private. Only published event information is public. Attendance lists, email addresses, exports, and draw administration remain private.
- Retain the existing database table names initially to reduce migration risk; the interface uses generic event terminology. Fresh installs start empty. Existing-data migrations stop if records cannot be assigned to an explicitly configured owner.

## Phase 3: simple organizer and attendee flows

Organizer journey:

`Sign up / Sign in → My events → Create event → Details → Theme → Registration → Preview → Publish / Copy link`

Event settings include title, description, date/time, timezone (default Asia/Kuala_Lumpur), location or online link, organizer display name, slug, and registration-open status. Existing events can be edited and previewed.

Theme settings include logo, banner, primary/accent colors, and a small selection of accessible layouts. Keep text-only themes valid. Store uploaded images in workspace-scoped Supabase Storage with validated image types, size limits, and safe rendering. Arbitrary HTML/CSS/scripts are not accepted as themes. Public assets must be treated as public once published.

Registration defaults to full name and email. Organization/team is optional; the organizer can require it. Replace the mandatory public-service pledge with optional organizer-defined consent text, with acceptance required only when that event enables it. Do not claim historical pledge acceptance covers a new statement.

Public event links use `/events/[slug]`, with event-specific registration, agenda, and projector routes beneath that event. No organizer's event is selected by a global fallback. Historical passport URLs remain valid. Legacy public routes must show an explicit event selection/closed state unless an unambiguous event code is provided.

Attendee journey:

`Open event link / scan registration QR → Read event details → Enter required information → Submit → Save digital pass`

Attendees do not need accounts. Keep useful duplicate-registration messages without disclosing someone else's private pass. Pass QR data must match the event-scoped check-in scanner contract, with any clickable PDF link pointing to the attendee's pass rather than an old external resource. Possession of a pass URL/token remains a private access capability.

Agenda, projector, attendance export, scanning, and lucky draws all operate on an explicit event. Preserve existing draw history and idempotent saves; configurable exclusions replace the hard-coded first-five rule. The default includes all attendees who have not already won.

## Studio integration and boundaries

- Implement and verify JPAEvents independently first.
- After a deployed/base URL is chosen, connect Studio's Events navigation and dashboard tool card, removing its Planned label only when the destination works.
- Keep Studio certificate files browser-only and preserve unsaved certificate edits when navigating to Events (initially open the service separately).
- Use manual CSV transfer for the first release. Automatic participant syncing, shared sign-on, and moving certificate files to a server are separate scope.
- Retain the Studio's own name for now; this request renames the event project. No destination URL, deployment, new GitHub repository, or Studio rename is assumed.
- The companion folder was inspected read-only. Editing outside this chat's writable root requires the environment's applicable access mechanism.

## Acceptance and verification

1. Current baseline tests are recorded before implementation. Unit/database tests, lint, TypeScript, and a production build are required for the resulting release; failed or skipped checks are reported honestly.
2. Scan tracked source, docs, assets, fixtures, and configuration for old identity and destinations, allowing only deliberate compatibility references and third-party notices. Verify no old Git remote or upstream remains; verify secrets are not tracked.
3. Fresh schema creates zero real events/attendees and no legacy sample agenda. Existing-data migration preserves records/tokens and requires explicit ownership assignment.
4. Two organizers can publish and open registration for different events concurrently. Direct table, RPC, API, guessed-ID, and storage attempts cannot read or modify the other workspace's private data.
5. Drafts are private; published pages show only the correct event. Closed registration is enforced by the database, not just a disabled button.
6. Create/edit/preview/publish settings persist after reload. Uploaded logos/themes display on mobile, pass PNG/PDF, and projector views.
7. Register, duplicate-submit, save pass, scan/check-in, export CSV, manage agenda, and draw winners against the selected event. QR generation and scanner interpretation agree.
8. Verify keyboard navigation, form labels, readable theme contrast, error recovery, and mobile widths. Confirm optional fields and consent behavior at both UI and database layers.
9. Studio navigation reaches the verified destination without discarding unsaved certificate edits; existing certificate import/export/build tests remain passing if Studio is changed.

## Builder choices and outstanding decisions

Builder proposals: retain Next.js/Supabase, implement workspace isolation, use separate-service integration first, offer email/password signup, default to Malay while removing government-specific wording, and defer billing/team invitations/automatic certificate syncing.

The user approved this design and separate-service integration. A real Studio link additionally needs the final JPAEvents base URL. Erasing local Git history is a separate destructive action; the old remote is already disconnected.
