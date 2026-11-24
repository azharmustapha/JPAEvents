-- Apply together with the matching application release. Back up the database first.
-- Existing attendee records and passport tokens are preserved.
BEGIN;

LOCK TABLE public.perhimpunan, public.kehadiran_peserta, public.atur_cara IN SHARE ROW EXCLUSIVE MODE;

-- Do not silently leave a deployment-specific permissive policy in place.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename IN ('perhimpunan','kehadiran_peserta','atur_cara','admin_users')
    AND policyname NOT IN (
      'Akses Bacaan Umum Perhimpunan', 'Akses Bacaan Umum Kehadiran',
      'Akses Bacaan Umum Atur Cara', 'Akses Pendaftaran Awam Kehadiran',
      'events_public_read', 'agendas_public_read', 'attendance_admin_read',
      'agenda_admin_insert', 'admin_membership_self'
    )
  ) THEN
    RAISE EXCEPTION 'Polisi tambahan ditemui. Semak pg_policies sebelum migrasi.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.kehadiran_peserta
    GROUP BY perhimpunan_id, upper(btrim(nama_pegawai)) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Nama pegawai bertindih selepas normalisasi. Selesaikan tanpa memadam rekod secara automatik.';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Replace only audited policies, including prior versions of these managed policies.
DO $$
DECLARE item record;
BEGIN
  FOR item IN SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename IN ('perhimpunan','kehadiran_peserta','atur_cara','admin_users')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', item.policyname, item.tablename);
  END LOOP;
END;
$$;

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perhimpunan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kehadiran_peserta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atur_cara ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = (SELECT auth.uid()));
$$;

REVOKE ALL ON public.admin_users, public.perhimpunan, public.kehadiran_peserta, public.atur_cara
FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.perhimpunan, public.atur_cara TO anon, authenticated;
GRANT SELECT ON public.admin_users, public.kehadiran_peserta TO authenticated;
GRANT INSERT ON public.atur_cara TO authenticated;

CREATE POLICY events_public_read ON public.perhimpunan FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY agendas_public_read ON public.atur_cara FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY admin_membership_self ON public.admin_users FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));
CREATE POLICY attendance_admin_read ON public.kehadiran_peserta FOR SELECT TO authenticated
USING ((SELECT public.is_admin()));
CREATE POLICY agenda_admin_insert ON public.atur_cara FOR INSERT TO authenticated
WITH CHECK ((SELECT public.is_admin()));

CREATE UNIQUE INDEX IF NOT EXISTS attendance_normalized_name
ON public.kehadiran_peserta (perhimpunan_id, upper(btrim(nama_pegawai)));

-- Retain the newest active event; do not delete any event or attendee record.
WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY dicipta_pada DESC NULLS LAST, id DESC) AS position
  FROM public.perhimpunan WHERE status_aktif
)
UPDATE public.perhimpunan p SET status_aktif = false
FROM ranked r WHERE p.id = r.id AND r.position > 1;
CREATE UNIQUE INDEX IF NOT EXISTS one_active_event
ON public.perhimpunan ((status_aktif)) WHERE status_aktif;
ALTER TABLE public.perhimpunan ALTER COLUMN status_aktif SET DEFAULT false;

CREATE OR REPLACE FUNCTION public.register_attendance(session_code text, officer_name text, division text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  selected_event uuid;
  normalized_name text := upper(btrim(officer_name));
  normalized_code text := upper(btrim(session_code));
  normalized_division text := btrim(division);
  new_token text;
BEGIN
  IF normalized_code IS NULL OR char_length(normalized_code) NOT BETWEEN 1 AND 80
    OR normalized_name IS NULL OR char_length(normalized_name) NOT BETWEEN 1 AND 200
    OR normalized_division IS NULL OR char_length(normalized_division) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Maklumat pendaftaran tidak sah.' USING ERRCODE = '22023';
  END IF;
  -- This lock blocks session deactivation until attendance insertion commits.
  SELECT p.id INTO selected_event FROM public.perhimpunan p
  WHERE p.kod_sesi = normalized_code AND p.status_aktif FOR SHARE;
  IF selected_event IS NULL THEN
    RAISE EXCEPTION 'Sesi tidak aktif atau telah ditutup.' USING ERRCODE = 'P0001';
  END IF;
  new_token := 'PAS-' || gen_random_uuid()::text;
  INSERT INTO public.kehadiran_peserta(perhimpunan_id,nama_pegawai,bahagian_unit,token_pasport,waktu_hadir)
  VALUES (selected_event, normalized_name, normalized_division, new_token, now());
  RETURN new_token;
EXCEPTION WHEN unique_violation THEN
  -- Never disclose another attendee's token or PostgreSQL constraint details.
  RAISE EXCEPTION 'Nama ini telah didaftarkan. Buka pasport yang disimpan atau hubungi urus setia.'
    USING ERRCODE = '23505';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_passport(passport_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'nama_pegawai', k.nama_pegawai, 'bahagian_unit', k.bahagian_unit,
    'waktu_hadir', k.waktu_hadir, 'token_pasport', k.token_pasport,
    'perhimpunan', jsonb_build_object('tajuk', p.tajuk, 'tema', p.tema,
      'tarikh', p.tarikh, 'lokasi', p.lokasi, 'kod_sesi', p.kod_sesi)
  ) FROM public.kehadiran_peserta k
  JOIN public.perhimpunan p ON p.id = k.perhimpunan_id
  WHERE k.token_pasport = passport_token
    AND passport_token ~* '^PAS-([A-F0-9]{8}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_attendance_count(event_id uuid)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT count(*) FROM public.kehadiran_peserta WHERE perhimpunan_id = event_id; $$;

CREATE OR REPLACE FUNCTION public.create_event(
  event_title text, event_theme text, event_date date, start_time text, venue text, session_code text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE created_event public.perhimpunan;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses pentadbir diperlukan.' USING ERRCODE = '42501';
  END IF;
  IF event_title IS NULL OR char_length(btrim(event_title)) NOT BETWEEN 1 AND 200
    OR event_date IS NULL OR venue IS NULL OR char_length(btrim(venue)) NOT BETWEEN 1 AND 200
    OR session_code IS NULL OR char_length(btrim(session_code)) NOT BETWEEN 1 AND 80
    OR char_length(coalesce(event_theme,'')) > 500
    OR start_time IS NULL OR start_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' THEN
    RAISE EXCEPTION 'Maklumat sesi tidak sah.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(20261007,1);
  UPDATE public.perhimpunan SET status_aktif = false WHERE status_aktif;
  INSERT INTO public.perhimpunan(tajuk,tema,tarikh,masa_mula,lokasi,kod_sesi,status_aktif)
  VALUES (btrim(event_title),nullif(btrim(event_theme),''),event_date,start_time,btrim(venue),upper(btrim(session_code)),true)
  RETURNING * INTO created_event;
  RETURN to_jsonb(created_event);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_active_event(event_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses pentadbir diperlukan.' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(20261007,1);
  IF event_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.perhimpunan p WHERE p.id = set_active_event.event_id
  ) THEN
    RAISE EXCEPTION 'Sesi tidak ditemui.' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.perhimpunan SET status_aktif = false WHERE status_aktif;
  IF event_id IS NOT NULL THEN
    UPDATE public.perhimpunan p SET status_aktif = true WHERE p.id = set_active_event.event_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.is_admin(), public.register_attendance(text,text,text),
  public.get_passport(text), public.get_attendance_count(uuid),
  public.create_event(text,text,date,text,text,text), public.set_active_event(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(), public.create_event(text,text,date,text,text,text),
  public.set_active_event(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_attendance(text,text,text), public.get_passport(text),
  public.get_attendance_count(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
