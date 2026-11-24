-- Disposable migrated Supabase test project only; all fixtures roll back.
BEGIN;
INSERT INTO auth.users(id,email) VALUES ('00000000-0000-4000-8000-000000000001','security-admin@test.invalid') ON CONFLICT DO NOTHING;
INSERT INTO public.admin_users(user_id) VALUES ('00000000-0000-4000-8000-000000000001') ON CONFLICT DO NOTHING;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
DO $$
DECLARE created jsonb; previous_id uuid;
BEGIN
  created := public.create_event('Session test',null,current_date,'08:30','Hall','TEST-TRANSITIONS');
  previous_id := (created->>'id')::uuid;
  IF (SELECT count(*) FROM public.perhimpunan WHERE status_aktif) <> 1 THEN RAISE EXCEPTION 'Multiple active events'; END IF;
  BEGIN
    PERFORM public.set_active_event('ffffffff-ffff-4fff-8fff-ffffffffffff');
    RAISE EXCEPTION 'Missing event activated';
  EXCEPTION WHEN no_data_found THEN NULL;
  END;
  BEGIN
    PERFORM public.create_event('Duplicate',null,current_date,'08:30','Hall','TEST-TRANSITIONS');
    RAISE EXCEPTION 'Duplicate code created';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  IF NOT EXISTS (SELECT 1 FROM public.perhimpunan WHERE id=previous_id AND status_aktif) THEN RAISE EXCEPTION 'Failed change closed prior event'; END IF;
  PERFORM public.set_active_event(null);
  IF EXISTS (SELECT 1 FROM public.perhimpunan WHERE status_aktif) THEN RAISE EXCEPTION 'Close failed'; END IF;
  BEGIN
    PERFORM public.register_attendance('TEST-TRANSITIONS','Closed officer','Unit','officer@test.invalid',true);
    RAISE EXCEPTION 'Closed registration succeeded' USING ERRCODE='22000';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
  PERFORM public.set_active_event(previous_id);
END;
$$;
RESET ROLE;
ROLLBACK;
