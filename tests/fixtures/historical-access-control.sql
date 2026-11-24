-- Disposable migrated Supabase test project only; all fixtures roll back.
BEGIN;
INSERT INTO auth.users(id,email) VALUES
('00000000-0000-4000-8000-000000000001','security-admin@test.invalid'),
('00000000-0000-4000-8000-000000000002','security-member@test.invalid') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.admin_users(user_id) VALUES ('00000000-0000-4000-8000-000000000001') ON CONFLICT DO NOTHING;
UPDATE public.perhimpunan SET status_aktif=false;
INSERT INTO public.perhimpunan(id,tajuk,tarikh,masa_mula,lokasi,kod_sesi,status_aktif)
VALUES ('00000000-0000-4000-8000-000000000010','Security fixture',current_date,'08:30','Hall','TEST-SECURITY',true);
INSERT INTO public.kehadiran_peserta(perhimpunan_id,nama_pegawai,bahagian_unit,token_pasport,no_pasport)
VALUES ('00000000-0000-4000-8000-000000000010','FIXTURE OFFICER','Unit','PAS-ABCDEF00',1);

UPDATE public.perhimpunan SET next_passport_number=2 WHERE kod_sesi='TEST-SECURITY';
SET LOCAL ROLE anon;
DO $$
DECLARE token text; passport jsonb;
BEGIN
  BEGIN
    PERFORM 1 FROM public.kehadiran_peserta;
    RAISE EXCEPTION 'Anonymous direct attendance access succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.kehadiran_peserta(perhimpunan_id,nama_pegawai,bahagian_unit,token_pasport,no_pasport)
    VALUES ('00000000-0000-4000-8000-000000000010','FORGED','Unit','PAS-00000000',999);
    RAISE EXCEPTION 'Anonymous attendance insertion succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  token := public.register_attendance('TEST-SECURITY',' Test Officer ',' Unit A ','officer@test.invalid',true);
  IF token !~ '^PAS-[a-f0-9-]{36}$' THEN RAISE EXCEPTION 'Token entropy was reduced'; END IF;
  passport := public.get_passport(token);
  IF passport->>'nama_pegawai' <> 'TEST OFFICER' THEN RAISE EXCEPTION 'Passport lookup failed'; END IF;
  IF public.get_attendance_count('00000000-0000-4000-8000-000000000010') <> 2 THEN RAISE EXCEPTION 'Count incorrect'; END IF;
  BEGIN
    PERFORM public.register_attendance('TEST-SECURITY','test officer','Other','officer@test.invalid',true);
    RAISE EXCEPTION 'Duplicate registration succeeded';
  EXCEPTION WHEN unique_violation THEN
    IF position(token IN SQLERRM) > 0 THEN RAISE EXCEPTION 'Duplicate disclosed token'; END IF;
  END;
  IF public.get_passport('PAS-00000000') IS NOT NULL THEN RAISE EXCEPTION 'Unknown passport found'; END IF;
END;
$$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
DO $$
BEGIN
  IF public.is_admin() THEN RAISE EXCEPTION 'Non-admin authorized'; END IF;
  IF EXISTS (SELECT 1 FROM public.kehadiran_peserta) THEN RAISE EXCEPTION 'Non-admin can read attendees'; END IF;
  BEGIN
    INSERT INTO public.admin_users(user_id) VALUES ('00000000-0000-4000-8000-000000000002');
    RAISE EXCEPTION 'Self enrollment succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.set_active_event(null);
    RAISE EXCEPTION 'Non-admin closed registration';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.atur_cara(perhimpunan_id,masa_mula,tajuk_agenda)
    VALUES ('00000000-0000-4000-8000-000000000010','09:00','Unauthorized');
    RAISE EXCEPTION 'Non-admin wrote agenda';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
DO $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin denied'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.kehadiran_peserta WHERE nama_pegawai='TEST OFFICER') THEN RAISE EXCEPTION 'Admin report unavailable'; END IF;
END;
$$;
INSERT INTO public.atur_cara(perhimpunan_id,masa_mula,tajuk_agenda)
VALUES ('00000000-0000-4000-8000-000000000010','09:00','Authorized');
RESET ROLE;
ROLLBACK;
