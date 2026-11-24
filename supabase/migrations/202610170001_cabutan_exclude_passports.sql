-- Exclude passports 1–5 from new draws, preserving saved history and retries.
BEGIN;

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
