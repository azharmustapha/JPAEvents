# Organizer UI Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver the approved screenshot direction across the authenticated event workspace.

**Architecture:** A root client context tracks authentication and owned event selection. The protected layout renders a reusable branded workspace. Existing module operations remain in their respective pages and use explicit event URLs.

**Tech Stack:** Next.js 16.3.6, React 19, TypeScript, Tailwind 4, Supabase, official MYDS React icons.

**Spec:** docs/superpowers/specs/2026-11-27-organizer-ui.md

## Global Constraints

- Read bundled Next.js documentation before code changes.
- Preserve server authorization and existing workspace-scoped data access.
- No schema or production data changes.
- Use the existing checkout as requested by the workspace context; leave work uncommitted for review.

## Review Focus

- Explicit unknown event IDs must not fall back to another event.
- Switching module must retain the selected event.
- Invalid colors and absent artwork must have readable fallbacks.
- Signing out must clear private UI and expose a retryable failure.
- Mobile navigation and long event titles must remain usable.

## Task 1: Shared event navigation and theme

- [x] Add failing behavioral tests in tests/unit/organizer-navigation.test.mjs for selection, explicit invalid IDs, link construction and validated color defaults.
- [x] Run the test, then implement lib/organizer-navigation.ts and rerun it.
- [x] Implement authentication/event context and white MYDS navbar with logout; use the same navigation in footer.

## Task 2: Branded workspace and modules

- [x] Add components/organizer-workspace.tsx to the protected layout with banner/logo, details, event selection and quick links.
- [x] Integrate dashboard selection with the shared context and preserve existing attendance operations.
- [x] Apply screenshot-inspired typography, surfaces, borders and responsive layout to editor, agenda, scanner and draw; replace module icons with MYDS.

## Task 3: Verification and review

- [x] Run npm test, npm run lint, npx tsc --noEmit and npm run build.
- [x] Review desktop/mobile screens and context switching; fix observed issues.
- [x] Record evidence and any authenticated test limitations before delivery.

## Completion record

Implemented in the current checkout without a commit or deployment. Verification and limitations are recorded in `docs/qa/2026-11-27-organizer-ui.md`. Independent review's selection-retention issue was fixed and confirmed in the browser. Temporary synthetic fixture servers were stopped; the normal local development server remains available on port 3000.
