-- Run on a disposable Supabase project. Test records roll back together.
BEGIN;
SELECT set_config('jpaevents.test_owner',gen_random_uuid()::text,true);
SELECT set_config('jpaevents.test_other',gen_random_uuid()::text,true);
INSERT INTO auth.users(id,email,email_confirmed_at)
SELECT id::uuid,id||'@example.invalid',now()
FROM (VALUES (current_setting('jpaevents.test_owner')), (current_setting('jpaevents.test_other'))) u(id);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('jpaevents.test_owner'),true);
DO $$
DECLARE workspace uuid; event uuid; code text := gen_random_uuid()::text;
BEGIN
  workspace := public.create_workspace('Fixture');
  event := public.save_event(NULL,jsonb_build_object('workspace_id',workspace,'tajuk','Private event',
    'slug',code,'kod_sesi',code,'tarikh',current_date,'masa_mula','08:30','lokasi','Hall'));
  INSERT INTO public.atur_cara(perhimpunan_id,tajuk_agenda) VALUES (event,'Opening');
  PERFORM set_config('jpaevents.test_event',event::text,true);
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('jpaevents.test_other'),true);
SELECT public.create_workspace('Other fixture');
DO $$
DECLARE event uuid := current_setting('jpaevents.test_event')::uuid;
BEGIN
  IF EXISTS (SELECT FROM public.perhimpunan WHERE id=event)
    OR EXISTS (SELECT FROM public.atur_cara WHERE perhimpunan_id=event) THEN
    RAISE EXCEPTION 'Private event was visible to another organizer';
  END IF;
  BEGIN
    PERFORM public.set_registration_open(event,true);
    RAISE EXCEPTION 'Another organizer changed event status';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET LOCAL ROLE anon;
DO $$
DECLARE event uuid := current_setting('jpaevents.test_event')::uuid;
BEGIN
  IF public.get_attendance_count(event) IS NOT NULL THEN RAISE EXCEPTION 'Private count is visible'; END IF;
  BEGIN
    PERFORM 1 FROM public.kehadiran_peserta;
    RAISE EXCEPTION 'Anonymous user read attendance';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
