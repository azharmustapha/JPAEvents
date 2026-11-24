-- Run on a disposable Supabase project. Independent events open and close atomically.
BEGIN;
SELECT set_config('jpaevents.test_owner',gen_random_uuid()::text,true);
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES (current_setting('jpaevents.test_owner')::uuid,
  current_setting('jpaevents.test_owner')||'@example.invalid',now());
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('jpaevents.test_owner'),true);
DO $$
DECLARE
  workspace uuid := public.create_workspace('Session checks');
  first_event uuid; second_event uuid; code text := gen_random_uuid()::text; settings jsonb;
BEGIN
  settings := jsonb_build_object('workspace_id',workspace,'tajuk','Workshop','tarikh',current_date,
    'masa_mula','10:00','lokasi','Hall','published',true,'status_aktif',true);
  first_event := public.save_event(NULL,settings||jsonb_build_object('slug',code,'kod_sesi',code));
  second_event := public.save_event(NULL,settings||jsonb_build_object('slug',code||'-b','kod_sesi',code||'-B'));
  IF (SELECT count(*) FROM public.perhimpunan WHERE id IN (first_event,second_event) AND status_aktif) <> 2 THEN
    RAISE EXCEPTION 'Opening one event closed another';
  END IF;
  PERFORM public.set_registration_open(first_event,false);
  BEGIN
    PERFORM public.register_event_attendance(first_event,'Closed',NULL,'closed@example.invalid',false,NULL);
    RAISE EXCEPTION 'Closed registration succeeded' USING ERRCODE='22000';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  PERFORM public.register_event_attendance(second_event,'Open',NULL,'open@example.invalid',false,NULL);
  IF public.get_attendance_count(second_event)<>1 THEN RAISE EXCEPTION 'Independent event count incorrect'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
