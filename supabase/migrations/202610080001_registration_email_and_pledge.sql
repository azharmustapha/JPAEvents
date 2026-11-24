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
