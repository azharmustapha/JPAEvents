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
