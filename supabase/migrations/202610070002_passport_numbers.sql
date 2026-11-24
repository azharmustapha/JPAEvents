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
