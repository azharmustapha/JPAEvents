# JPAEvents Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a neutral event service with organizer-owned events, customizable registration/theme settings, and event-scoped public and management tools.

**Architecture:** Retain Next.js/Supabase and the existing table names. Introduce organizer workspace membership, event settings, independent publishing/open status, and ownership-based RLS/RPCs. Studio connects as a separate service when its destination URL exists.

**Tech Stack:** Next.js 16.3.6, React 19, TypeScript, Supabase, Tailwind 4, PGlite/node:test.

**Spec:** ../specs/2026-11-24-jpaevents-design.md

## Global Constraints

- Fresh installs start empty; preserve existing records/tokens and stop migrations with unassigned events.
- No live database changes, deployment, pushes, credential publication, or history reset.
- Every event operation enforces workspace membership; drafts and attendance are private.
- Public pages use explicit event identifiers, never global active-event discovery.
- Keep certificate files browser-only and leave Studio unchanged until its target URL is available.
- Reuse this checkout as requested; create a `codex/` branch, without moving folders.

## Review Focus

- Cross-workspace guessed IDs must fail in tables, RPCs and storage.
- Two events can accept registration concurrently; closing one cannot close another.
- Draft event details and agendas cannot be enumerated anonymously.
- Optional organization/consent behavior is enforced in both form and SQL.
- QR payloads and the event-scoped scanner agree; exports preserve branding and pass access.

## Task 1: Database isolation and settings

Files: `supabase/schema.sql`, new workspace migration, `supabase/storage.sql`, `tests/database/workspaces.test.mjs`, legacy database fixtures.

Interfaces: retain `perhimpunan`, `kehadiran_peserta`, `atur_cara`, `cabutan_pemenang`. Add event fields `workspace_id`, `slug`, `description`, `organizer_name`, `timezone`, `published`, `primary_color`, `accent_color`, `layout`, `logo_url`, `banner_url`, `require_organization`, `consent_text`, `draw_exclude_first`. `status_aktif` means this event's registration is open. Workspace membership uses `workspace_members(workspace_id,user_id)`.

RPCs: `create_workspace(workspace_name text) -> uuid`; `save_event(event_id uuid,event_settings jsonb) -> uuid`; `set_registration_open(event_id uuid,is_open boolean)`; `register_event_attendance(event_id,officer_name,division,email_address,consent_accepted,expected_consent_text)` enforces immutable event identity and displayed consent. `check_in_attendee(event_id,passport_token)` records idempotent member-only check-in. Retain passport/count/draw RPCs with event privacy and membership checks. `get_passport` returns presentation settings and check-in status without personal email/consent. New events are drafts and closed unless explicitly published/opened. Session codes and slugs are unique.

- [x] Write failing database tests for empty install, ownership, draft privacy, event updates, independent opening, settings validation, consent/organization requirements, pass retrieval and draw behavior.
- [x] Run new tests and observe failure.
- [x] Implement migration, fresh schema, and optional workspace-scoped image bucket/policies. Existing databases need explicit owner assignment; refuse implicit reassignment.
- [x] Run database tests. Retain historical migration tests against an explicit historical schema fixture rather than imposing old behavior on the new schema.

## Task 2: Neutral identity and signup

Files: package/lock, Docker config, `components/brand-logo.tsx`, layout/navbar/footer, `app/page.tsx`, `app/signup/page.tsx`, `app/auth/confirm/route.ts`, auth access/login modules, public assets and docs.

Interfaces: authenticated organizer membership replaces `admin_users` gate; first login with no membership enters onboarding. Signup uses verified email/password and exchanges confirmation tokens on the server. Onboarding calls `create_workspace` and refreshes.

- [x] Add unit tests for event presentation validation, optional registration and scanner token parsing; observe RED.
- [x] Rename identity, remove old artwork/sample assets and external destinations, implement signup/onboarding and public welcome page.
- [x] Preserve login timeout/cookie isolation and safe redirects. Run auth/unit tests after membership update.

## Task 3: Organizer event editor and event-scoped tools

Files: new `lib/events.ts`, event types, `components/event-editor.tsx`, protected dashboard/create/edit pages, agenda/scanner/draw pages, `hooks/use-active-assembly.ts`.

Interfaces: dashboard lists member-owned events through RLS. Create/edit use `save_event` with validated JSON settings; image paths are immutable uploads in `event-assets/<workspace UUID>/...`, with public URLs. Tool links carry `?event=<UUID>` and remain scoped to it. UI does not choose a random active event. New `useActiveAssembly(eventId)` loads that specific event/count.

- [x] Implement event editor with details/theme/registration preview, publish/open controls, uploads and accessible colors.
- [x] Replace global discovery with explicit selected event, including scanner/agenda/draw/export queries and navigation.
- [x] Verify create/edit payloads, correct event links, blank/invalid IDs and error recovery.

## Task 4: Public event routes and passes

Files: `app/events/[slug]/page.tsx`, nested registration/agenda/display routes, shared event view, registration form, theme component, passport card/image/PDF exports, legacy public routes.

Interfaces: resolve published event by slug; public subroutes retain slug context; historic `/pasport/[token]` remains. Printed QR encodes private token, clickable PDF destination opens pass URL; scanner accepts raw token or trusted same-origin pass URL. Registration settings default to name/email with optional organization and event-defined consent.

- [x] Implement mobile public page and event-specific navigation/projector, including empty/closed states.
- [x] Replace old QR destination, artwork special case and storage keys; use saved event theme assets in passes and exports.
- [x] Run registration, theme, scanner, PNG/PDF and database tests.

## Task 5: Documentation, verification and review

Files: README/setup/integration docs, historical notes/fixtures and cleanup scripts as needed.

- [x] Remove old identity from tracked working files, preserving framework instructions, third-party notices and deliberate database compatibility names.
- [x] Document dedicated Supabase setup, verified signup, existing-data migration/owner assignment, storage policies and Studio URL integration.
- [x] Run `npm test`, `npm run lint`, `npx tsc --noEmit --incremental false`, `npm run build` and inspect mobile/desktop UI locally without using old production data.
- [x] Request a fresh independent whole-change review; resolve important findings and rerun affected checks.
- [x] Report verified behavior and any deployment/Studio URL requirements; do not publish or attach a new repository.
