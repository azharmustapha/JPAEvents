-- ==============================================================================
-- Skema Pangkalan Data: Acara (PostgreSQL / Supabase)
-- Fail: supabase/schema.sql
-- ==============================================================================

-- 1. Jadual: Perhimpunan
CREATE TABLE IF NOT EXISTS perhimpunan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tajuk TEXT NOT NULL,
    tema TEXT,
    tarikh DATE NOT NULL,
    masa_mula TEXT NOT NULL,
    lokasi TEXT NOT NULL,
    kod_sesi TEXT UNIQUE NOT NULL,
    status_aktif BOOLEAN DEFAULT true,
    dicipta_pada TIMESTAMPTZ DEFAULT now()
);

-- Indeks carian kod sesi
CREATE INDEX IF NOT EXISTS idx_perhimpunan_kod_sesi ON perhimpunan (kod_sesi);
CREATE INDEX IF NOT EXISTS idx_perhimpunan_status_aktif ON perhimpunan (status_aktif);

-- 2. Jadual: Kehadiran Peserta
CREATE TABLE IF NOT EXISTS kehadiran_peserta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    perhimpunan_id UUID NOT NULL REFERENCES perhimpunan(id) ON DELETE CASCADE,
    nama_pegawai TEXT NOT NULL,
    bahagian_unit TEXT NOT NULL,
    waktu_hadir TIMESTAMPTZ DEFAULT now(),
    token_pasport TEXT UNIQUE NOT NULL,
    dicipta_pada TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unik_kehadiran_pegawai UNIQUE (perhimpunan_id, nama_pegawai)
);

-- Indeks carian pantas
CREATE INDEX IF NOT EXISTS idx_kehadiran_token ON kehadiran_peserta (token_pasport);
CREATE INDEX IF NOT EXISTS idx_kehadiran_perhimpunan ON kehadiran_peserta (perhimpunan_id);

-- 3. Jadual: Atur Cara Majlis
CREATE TABLE IF NOT EXISTS atur_cara (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    perhimpunan_id UUID NOT NULL REFERENCES perhimpunan(id) ON DELETE CASCADE,
    masa_mula TEXT,
    masa_tamat TEXT,
    tajuk_agenda TEXT NOT NULL,
    keterangan TEXT,
    turutan INTEGER NOT NULL DEFAULT 0,
    status_selesai BOOLEAN DEFAULT false,
    dicipta_pada TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_atur_cara_perhimpunan ON atur_cara (perhimpunan_id, turutan);
ALTER TABLE public.atur_cara ALTER COLUMN masa_mula DROP NOT NULL;


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
      'agenda_admin_insert', 'agenda_admin_update', 'agenda_admin_delete', 'admin_membership_self'
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
GRANT INSERT, UPDATE, DELETE ON public.atur_cara TO authenticated;

CREATE POLICY events_public_read ON public.perhimpunan FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY agendas_public_read ON public.atur_cara FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY admin_membership_self ON public.admin_users FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));
CREATE POLICY attendance_admin_read ON public.kehadiran_peserta FOR SELECT TO authenticated
USING ((SELECT public.is_admin()));
CREATE POLICY agenda_admin_insert ON public.atur_cara FOR INSERT TO authenticated
WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY agenda_admin_update ON public.atur_cara FOR UPDATE TO authenticated
USING ((SELECT public.is_admin()))
WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY agenda_admin_delete ON public.atur_cara FOR DELETE TO authenticated
USING ((SELECT public.is_admin()));

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
  VALUES (btrim(event_title),nullif(btrim(event_theme),''),event_date,start_time::time,btrim(venue),upper(btrim(session_code)),true)
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

-- Seed only an empty clean-install database. Never reactivate closed sessions.
DO $seed$
BEGIN
IF NOT EXISTS (SELECT 1 FROM public.perhimpunan) THEN
INSERT INTO perhimpunan (id, tajuk, tema, tarikh, masa_mula, lokasi, kod_sesi, status_aktif)
VALUES (
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'Bengkel Komuniti',
    'Belajar Bersama',
    '2026-10-15',
    '08:30:00',
    'Dewan Utama',
    'SAMPLE-26',
    true
)
ON CONFLICT (kod_sesi) DO NOTHING;

INSERT INTO atur_cara (perhimpunan_id, masa_mula, masa_tamat, tajuk_agenda, keterangan, turutan, status_selesai)
VALUES 
(
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    '08:00',
    '08:30',
    'Ketibaan Peserta & Pendaftaran Kendiri',
    'Imbasan Kod QR skrin besar & penjanaan pasport digital',
    1,
    true
),
(
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    '08:30',
    '08:45',
    'Pengenalan Fasilitator',
    'Peserta berkenalan dengan fasilitator',
    2,
    false
),
(
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    '08:45',
    '09:00',
    'Pembukaan Bengkel',
    'Dipimpin oleh fasilitator',
    3,
    false
),
(
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    '09:00',
    '09:45',
    'Perbincangan Kumpulan',
    'Bincangkan idea untuk projek kumpulan',
    4,
    false
),
(
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    '09:45',
    '10:15',
    'Pembentangan Projek',
    'Setiap kumpulan membentangkan projek',
    5,
    false
),
(
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    '10:15',
    '10:30',
    'Sesi Fotografi & Jamuan Ringan',
    'Majlis bersurai ke foyer utama',
    6,
    false
)
ON CONFLICT DO NOTHING;

END IF;
END;
$seed$;


-- Apply after 202610070001_security_and_sessions.sql.
-- Public passport numbers start at 1 per assembly; private access tokens are preserved.
BEGIN;
LOCK TABLE public.perhimpunan, public.kehadiran_peserta IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE public.kehadiran_peserta ADD COLUMN IF NOT EXISTS no_pasport bigint;
ALTER TABLE public.perhimpunan ADD COLUMN IF NOT EXISTS next_passport_number bigint NOT NULL DEFAULT 1;

WITH numbered AS (
  SELECT k.id, row_number() OVER (
    PARTITION BY k.perhimpunan_id ORDER BY k.waktu_hadir NULLS LAST, k.dicipta_pada NULLS LAST, k.id
  ) + coalesce((SELECT max(existing.no_pasport) FROM public.kehadiran_peserta existing
    WHERE existing.perhimpunan_id = k.perhimpunan_id), 0) AS number
  FROM public.kehadiran_peserta k WHERE k.no_pasport IS NULL
)
UPDATE public.kehadiran_peserta k SET no_pasport = n.number FROM numbered n WHERE k.id = n.id;

ALTER TABLE public.kehadiran_peserta ALTER COLUMN no_pasport SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS unique_passport_number_per_session
  ON public.kehadiran_peserta(perhimpunan_id, no_pasport);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='positive_passport_number' AND conrelid='public.kehadiran_peserta'::regclass) THEN
    ALTER TABLE public.kehadiran_peserta ADD CONSTRAINT positive_passport_number CHECK (no_pasport > 0);
  END IF;
END $$;

UPDATE public.perhimpunan p SET next_passport_number = greatest(p.next_passport_number,
  coalesce((SELECT max(k.no_pasport) + 1 FROM public.kehadiran_peserta k WHERE k.perhimpunan_id=p.id), 1));

CREATE OR REPLACE FUNCTION public.register_attendance(session_code text, officer_name text, division text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  selected_event uuid;
  normalized_name text := upper(btrim(officer_name));
  normalized_code text := upper(btrim(session_code));
  normalized_division text := btrim(division);
  new_token text;
  new_number bigint;
BEGIN
  IF normalized_code IS NULL OR char_length(normalized_code) NOT BETWEEN 1 AND 80
    OR normalized_name IS NULL OR char_length(normalized_name) NOT BETWEEN 1 AND 200
    OR normalized_division IS NULL OR char_length(normalized_division) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Maklumat pendaftaran tidak sah.' USING ERRCODE = '22023';
  END IF;
  -- Atomic per-session counter serializes simultaneous registrations and session closure.
  -- Failed inserts roll back this increment; deleted passports never cause number reuse.
  UPDATE public.perhimpunan p SET next_passport_number = p.next_passport_number + 1
    WHERE p.kod_sesi = normalized_code AND p.status_aktif
    RETURNING p.id, p.next_passport_number - 1 INTO selected_event, new_number;
  IF selected_event IS NULL THEN
    RAISE EXCEPTION 'Sesi tidak aktif atau telah ditutup.' USING ERRCODE = 'P0001';
  END IF;
  new_token := 'PAS-' || gen_random_uuid()::text;
  INSERT INTO public.kehadiran_peserta(perhimpunan_id,nama_pegawai,bahagian_unit,token_pasport,no_pasport,waktu_hadir)
    VALUES (selected_event,normalized_name,normalized_division,new_token,new_number,now());
  RETURN new_token;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Nama ini telah didaftarkan. Buka pasport yang disimpan atau hubungi urus setia.' USING ERRCODE='23505';
END $$;

CREATE OR REPLACE FUNCTION public.get_passport(passport_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'nama_pegawai',k.nama_pegawai,'bahagian_unit',k.bahagian_unit,
    'waktu_hadir',k.waktu_hadir,'token_pasport',k.token_pasport,'no_pasport',k.no_pasport,
    'perhimpunan',jsonb_build_object('tajuk',p.tajuk,'tema',p.tema,
      'tarikh',p.tarikh,'lokasi',p.lokasi,'kod_sesi',p.kod_sesi)
  ) FROM public.kehadiran_peserta k JOIN public.perhimpunan p ON p.id=k.perhimpunan_id
  WHERE k.token_pasport=passport_token
    AND passport_token ~* '^PAS-([A-F0-9]{8}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$'
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.register_attendance(text,text,text), public.get_passport(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_attendance(text,text,text), public.get_passport(text) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;

-- Apply after 202610070002_passport_numbers.sql, together with the updated app.
BEGIN;
LOCK TABLE public.perhimpunan, public.kehadiran_peserta IN SHARE ROW EXCLUSIVE MODE;

-- Legacy attendance remains valid; do not invent emails or pledge acceptance.
ALTER TABLE public.kehadiran_peserta ADD COLUMN IF NOT EXISTS emel text;
ALTER TABLE public.kehadiran_peserta ADD COLUMN IF NOT EXISTS akur_janji_pada timestamptz;

-- Remove the old public entry point so consent cannot be bypassed.
DROP FUNCTION IF EXISTS public.register_attendance(text,text,text);
CREATE OR REPLACE FUNCTION public.register_attendance(
  session_code text, officer_name text, division text, email_address text, pledge_accepted boolean
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  selected_event uuid;
  normalized_name text := upper(btrim(officer_name));
  normalized_code text := upper(btrim(session_code));
  normalized_division text := btrim(division);
  normalized_email text := lower(btrim(email_address));
  new_token text;
  new_number bigint;
BEGIN
  IF normalized_code IS NULL OR char_length(normalized_code) NOT BETWEEN 1 AND 80
    OR normalized_name IS NULL OR char_length(normalized_name) NOT BETWEEN 1 AND 200
    OR normalized_division IS NULL OR char_length(normalized_division) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Maklumat pendaftaran tidak sah.' USING ERRCODE = '22023';
  END IF;
  IF normalized_email IS NULL OR char_length(normalized_email) NOT BETWEEN 1 AND 254
    OR normalized_email !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' THEN
    RAISE EXCEPTION 'Sila masukkan alamat e-mel yang sah.' USING ERRCODE = '22023';
  END IF;
  IF pledge_accepted IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Sila tandakan kotak akur janji sebelum mendaftar masuk.' USING ERRCODE = '22023';
  END IF;
  -- Keep numbering and session closure atomic. Failed inserts roll back the counter.
  UPDATE public.perhimpunan p SET next_passport_number = p.next_passport_number + 1
    WHERE p.kod_sesi = normalized_code AND p.status_aktif
    RETURNING p.id, p.next_passport_number - 1 INTO selected_event, new_number;
  IF selected_event IS NULL THEN
    RAISE EXCEPTION 'Sesi tidak aktif atau telah ditutup.' USING ERRCODE = 'P0001';
  END IF;
  new_token := 'PAS-' || gen_random_uuid()::text;
  INSERT INTO public.kehadiran_peserta(
    perhimpunan_id,nama_pegawai,bahagian_unit,emel,akur_janji_pada,token_pasport,no_pasport,waktu_hadir
  ) VALUES (selected_event,normalized_name,normalized_division,normalized_email,now(),new_token,new_number,now());
  RETURN new_token;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Nama ini telah didaftarkan. Buka pasport yang disimpan atau hubungi urus setia.' USING ERRCODE='23505';
END $$;

REVOKE ALL ON FUNCTION public.register_attendance(text,text,text,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_attendance(text,text,text,text,boolean) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;


-- One permanent winner history per perhimpunan, with no separate draw sessions.
BEGIN;

CREATE TABLE IF NOT EXISTS public.cabutan_pemenang (
  id uuid PRIMARY KEY,
  perhimpunan_id uuid NOT NULL REFERENCES public.perhimpunan(id) ON DELETE CASCADE,
  peserta_id uuid NOT NULL REFERENCES public.kehadiran_peserta(id),
  nama_pegawai text NOT NULL,
  bahagian_unit text NOT NULL,
  no_pasport bigint NOT NULL CHECK (no_pasport > 0),
  dicipta_pada timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT unik_pemenang_perhimpunan UNIQUE (perhimpunan_id, peserta_id)
);

CREATE INDEX IF NOT EXISTS idx_cabutan_perhimpunan
  ON public.cabutan_pemenang(perhimpunan_id, dicipta_pada DESC, id DESC);

ALTER TABLE public.cabutan_pemenang ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cabutan_pemenang FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.cabutan_pemenang TO authenticated;
DROP POLICY IF EXISTS cabutan_admin_read ON public.cabutan_pemenang;
CREATE POLICY cabutan_admin_read ON public.cabutan_pemenang FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

CREATE OR REPLACE FUNCTION public.save_cabutan_winner(draw_id uuid, event_id uuid, participant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  active_event boolean;
  participant public.kehadiran_peserta;
  winner public.cabutan_pemenang;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses pentadbir diperlukan.' USING ERRCODE = '42501';
  END IF;
  IF draw_id IS NULL OR event_id IS NULL OR participant_id IS NULL THEN
    RAISE EXCEPTION 'Maklumat cabutan tidak sah.' USING ERRCODE = '22023';
  END IF;
  -- Serialize saves and event closure; retries use the same draw ID.
  SELECT p.status_aktif INTO active_event FROM public.perhimpunan p
    WHERE p.id = event_id FOR UPDATE;
  SELECT w.* INTO winner FROM public.cabutan_pemenang w WHERE w.id = draw_id;
  IF FOUND THEN
    IF winner.perhimpunan_id <> event_id OR winner.peserta_id <> participant_id THEN
      RAISE EXCEPTION 'Maklumat cabutan tidak sepadan.' USING ERRCODE = '22023';
    END IF;
    RETURN to_jsonb(winner);
  END IF;
  IF active_event IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Sesi tidak aktif atau telah ditutup.' USING ERRCODE = 'P0001';
  END IF;
  SELECT k.* INTO participant FROM public.kehadiran_peserta k
    WHERE k.id = participant_id AND k.perhimpunan_id = event_id FOR SHARE;
  IF NOT FOUND OR participant.no_pasport IS NULL THEN
    RAISE EXCEPTION 'Peserta cabutan tidak sah.' USING ERRCODE = '22023';
  END IF;
  IF participant.no_pasport <= 5 THEN
    RAISE EXCEPTION 'Pasport 1 hingga 5 dikecualikan daripada cabutan bertuah.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.cabutan_pemenang(id, perhimpunan_id, peserta_id, nama_pegawai, bahagian_unit, no_pasport)
    VALUES (draw_id, event_id, participant_id, participant.nama_pegawai, participant.bahagian_unit, participant.no_pasport)
    RETURNING * INTO winner;
  RETURN to_jsonb(winner);
END;
$$;

REVOKE ALL ON FUNCTION public.save_cabutan_winner(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_cabutan_winner(uuid,uuid,uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
