# JPAEvents changes

## 24 November 2026

- Neutral JPAEvents branding and removal of bundled old-event assets/data.
- Verified organizer signup, private workspaces and independent events.
- Event details, logo/banner uploads, colors, layouts and configurable registration.
- Event-scoped public registration, agenda, projector and management tools.
- QR passes, check-in, CSV/PNG/PDF exports and configurable lucky-draw exclusions.
- Old Git remote disconnected; no deployment or live database changes.
- Connected the existing Supabase project using separate JPAEvents tables, RPCs, bucket and session cookies. Existing application data and access rules were retained; local login connectivity verified.
- Switched local/production configuration to the user-created dedicated JPAEvents project, installed the empty standalone schema and image bucket, and verified Auth/API access and rollback tests.
