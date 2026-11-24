# JPAEvents database setup and upgrade

## Shared existing project

When another application already uses the same Supabase project, install `shared-project.sql` and `shared-storage.sql` and set `NEXT_PUBLIC_JPAEVENTS_SHARED_PROJECT=true` before starting/building the app. These files create separately prefixed tables, RPCs, indexes and Storage policies. Existing Auth accounts can log in; each user creates a JPAEvents workspace on first use. Other app data and global Auth settings are retained. Regenerate these SQL files with `node scripts/build-shared-schema.mjs` after changing the standalone schema, and verify with its `--check` flag.

## Dedicated project

Fresh projects run `supabase/schema.sql`, then `supabase/storage.sql`. The schema refuses to replace a populated installation.

For an existing installation:

1. Back up the database and verify restore access.
2. Apply missing historical migrations in filename order through `202610170001_cabutan_exclude_passports.sql`.
3. Identify the verified Supabase Auth user who should own all currently unassigned events. If events have different owners, prepare an explicit per-event ownership migration instead of assigning everything to one person.
4. In the **same SQL Editor session** as the workspace migration, run `SELECT set_config('jpaevents.legacy_owner_id', 'VERIFIED-AUTH-USER-UUID', false);`.
5. Run `supabase/migrations/202611240001_workspace_events.sql`. It fails if ownership is unspecified or the user is unverified. On success it preserves event/attendee IDs, pass tokens, numbering, agenda and draw history. Imported events remain published with their previous registration flags; review settings before a public deployment.
6. Run `supabase/storage.sql`. Review the bucket MIME/size limits and workspace insert/list policies.
7. Test two-organizer isolation in a disposable project before deploying the matching application.

The previous admin allowlist no longer grants event access. New verified users create their workspace through `create_workspace`. Users cannot directly insert membership or reassign another organizer's event.

Do not grant broad authenticated table writes. Event changes and check-in use audited RPCs; participant data remains private through ownership policies. Stored consent wording is a historical acceptance record, not permission to substitute a new statement.

`npm test` uses isolated embedded PostgreSQL. Live database/concurrency scripts require `TEST_DATABASE_URL` and `ALLOW_DATABASE_TESTS=true`; use a disposable migrated database. Live Auth uses separate `TEST_*` variables. No live migration is applied automatically by the application.

Storage tests emulate Storage tables in PostgreSQL. Verify actual hosted uploads, email confirmation, camera access and production cookies in the target environment.
