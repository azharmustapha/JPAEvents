-- Fix 42804 when an existing database stores masa_mula as time rather than text.
-- Keep the RPC signature, existing records, and column type unchanged.
BEGIN;

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

REVOKE ALL ON FUNCTION public.create_event(text,text,date,text,text,text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_event(text,text,date,text,text,text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
