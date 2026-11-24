# Existing Supabase connection

Superseded: on 24 November 2026 the user supplied the dedicated JPAEvents project `bdhkiesduxjgxnxzdusl`. The application now uses that project's standalone schema and Storage with shared mode false. The shared installation described below remains unchanged in the previous project; no old accounts or application data were moved.

User instruction: use the existing project to restore local login.

The configured project reference no longer resolves. The connected account has one healthy project, aspirasiJPA. Its deployed application owns existing event/admin/registration/draw tables, RPCs and audit history. Replacing their schema would disrupt that app.

Implementation decision: keep the existing project's Auth accounts, add isolated `jpaevents_` tables/RPCs and the `jpaevents-event-assets` bucket. Route JPAEvents SDK requests to those resources when `NEXT_PUBLIC_JPAEVENTS_SHARED_PROJECT=true`. Dedicated installations retain their original API names. Preserve existing table contents, policies, functions, triggers and global Auth settings. Do not create an account or reset passwords.

- [x] Inspect project health, table metadata, policies, functions and counts read-only.
- [x] Test SDK resource routing and configure ignored environment files with the chosen project's public key.
- [x] Generate/test/review an additive shared-project schema and storage setup.
- [x] Apply the isolated schema and verify live public/member API availability without changing existing app data.
- [x] Verify lint, TypeScript, build and local login error behavior against the configured project.

Applied migrations: `jpaevents_shared_workspace_setup` and `jpaevents_shared_image_storage` in the existing project. The original public-resource fingerprint remained `5586a3bb82195eb8d1ff940032c9a35a` before/after, with 5 administrators and 6,776 audit records unchanged. Added six isolated tables, member/public RPCs and an image bucket. No accounts or passwords were created/changed.

Review fixes: shared membership uses ON DELETE CASCADE so existing Auth deletion succeeds and revokes stale membership; sessions use the separate `jpaevents-auth` cookie; logout revokes only the current session. Docker forwards and validates shared mode before the Next.js build. Standalone deployments retain their existing resources and schema behavior.

Verification: 136 tests pass, lint and TypeScript pass. Live event API returns 200, anonymous workspace creation returns 401/42501 without mutations, email Auth is enabled, signup is enabled. The user's existing dev process at port 3000 reaches Auth and returns 401/invalid_credentials for a nonexistent test account. A separate dev process was not started because the project already had a running dev server. The user's actual password was neither requested nor tested.

Existing users authenticate normally. Their first JPAEvents login enters workspace onboarding; the old application's administrator allowlist is not imported as workspace membership. A password-authenticated browser check requires the user's own sign-in, and no passwords will be requested or printed by the agent.
