-- Apply after the October migrations. For populated installations, the database
-- owner must set jpaevents.legacy_owner_id in this same session to the verified
-- auth.users UUID responsible for ALL currently unassigned events. If events
-- have different owners, arrange an explicit per-event mapping before rollout.
BEGIN;
LOCK TABLE public.perhimpunan, public.kehadiran_peserta, public.atur_cara, public.cabutan_pemenang
  IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.workspace_members (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT
);
ALTER TABLE public.perhimpunan
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS organizer_name text,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Kuala_Lumpur',
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS primary_color text NOT NULL DEFAULT '#003053',
  ADD COLUMN IF NOT EXISTS accent_color text NOT NULL DEFAULT '#087f8c',
  ADD COLUMN IF NOT EXISTS layout text NOT NULL DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS require_organization boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_text text,
  ADD COLUMN IF NOT EXISTS draw_exclude_first integer NOT NULL DEFAULT 0,
  ALTER COLUMN status_aktif SET DEFAULT false;

DO $migration$
DECLARE
  owner_id uuid;
  assigned_workspace uuid;
BEGIN
  IF EXISTS (SELECT FROM public.perhimpunan WHERE workspace_id IS NULL) THEN
    owner_id := nullif(current_setting('jpaevents.legacy_owner_id',true),'')::uuid;
    IF NOT EXISTS (SELECT FROM auth.users WHERE id = owner_id AND email_confirmed_at IS NOT NULL) THEN
      RAISE EXCEPTION 'Set jpaevents.legacy_owner_id to the verified owner of all unassigned events before migration.';
    END IF;
    SELECT workspace_id INTO assigned_workspace FROM public.workspace_members WHERE user_id = owner_id;
    IF NOT FOUND THEN
      INSERT INTO public.workspaces(name) VALUES ('Imported events') RETURNING id INTO assigned_workspace;
      INSERT INTO public.workspace_members(workspace_id,user_id) VALUES (assigned_workspace,owner_id);
    END IF;
    -- Preserve previously public event links/passes and historical draw eligibility.
    UPDATE public.perhimpunan SET workspace_id = assigned_workspace, published = true,
      require_organization = true, draw_exclude_first = 5 WHERE workspace_id IS NULL;
  END IF;
END;
$migration$;
UPDATE public.perhimpunan SET slug = 'event-' || id WHERE slug IS NULL;
ALTER TABLE public.perhimpunan ALTER COLUMN workspace_id SET NOT NULL, ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS perhimpunan_slug_key ON public.perhimpunan(slug);
CREATE INDEX IF NOT EXISTS perhimpunan_workspace_idx ON public.perhimpunan(workspace_id);
DROP INDEX IF EXISTS public.one_active_event;

-- Preserve historical timestamps. Record which statement each future attendee accepted.
ALTER TABLE public.kehadiran_peserta ADD COLUMN IF NOT EXISTS accepted_consent_text text;
ALTER TABLE public.kehadiran_peserta ADD COLUMN IF NOT EXISTS checked_in_at timestamptz;

-- Remove only known managed policies. An unknown extension must receive a security
-- review before allowing a historical installation into multi-workspace operation.
DO $policies$
DECLARE p record;
BEGIN
  FOR p IN SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public'
    AND tablename IN ('workspaces','workspace_members','perhimpunan','atur_cara','kehadiran_peserta','cabutan_pemenang')
  LOOP
    IF (p.tablename || '.' || p.policyname) <> ALL(ARRAY[
      'perhimpunan.events_public_read','atur_cara.agendas_public_read','kehadiran_peserta.attendance_admin_read',
      'atur_cara.agenda_admin_insert','atur_cara.agenda_admin_update','atur_cara.agenda_admin_delete',
      'cabutan_pemenang.cabutan_admin_read','workspaces.workspace_read','workspace_members.membership_read',
      'perhimpunan.published_event_read','perhimpunan.member_event_read','atur_cara.visible_agenda_read',
      'atur_cara.member_agenda_write','kehadiran_peserta.member_attendance_read','cabutan_pemenang.member_draw_read'
    ]) THEN
      RAISE EXCEPTION 'Review unexpected policy %.% before applying the workspace migration',p.tablename,p.policyname;
    END IF;
    EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,p.tablename);
  END LOOP;
END;
$policies$;
DROP FUNCTION IF EXISTS public.create_event(text,text,date,text,text,text);
DROP FUNCTION IF EXISTS public.set_active_event(uuid);
DROP FUNCTION IF EXISTS public.register_attendance(text,text,text);
DROP FUNCTION IF EXISTS public.register_attendance(text,text,text,text,boolean);
DO $$ BEGIN
  IF to_regclass('public.admin_users') IS NOT NULL THEN
    REVOKE ALL ON public.admin_users FROM PUBLIC,anon,authenticated;
    DROP POLICY IF EXISTS admin_membership_self ON public.admin_users;
  END IF;
END $$;
DROP FUNCTION IF EXISTS public.is_admin();

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perhimpunan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atur_cara ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kehadiran_peserta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cabutan_pemenang ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workspaces, public.workspace_members, public.perhimpunan, public.atur_cara,
  public.kehadiran_peserta, public.cabutan_pemenang FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.workspaces, public.workspace_members, public.kehadiran_peserta, public.cabutan_pemenang TO authenticated;
GRANT SELECT ON public.perhimpunan, public.atur_cara TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.atur_cara TO authenticated;

CREATE POLICY membership_read ON public.workspace_members FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY workspace_read ON public.workspaces FOR SELECT TO authenticated USING
  (id IN (SELECT m.workspace_id FROM public.workspace_members m));
CREATE POLICY published_event_read ON public.perhimpunan FOR SELECT TO anon, authenticated USING (published);
CREATE POLICY member_event_read ON public.perhimpunan FOR SELECT TO authenticated USING
  (workspace_id IN (SELECT m.workspace_id FROM public.workspace_members m));
CREATE POLICY visible_agenda_read ON public.atur_cara FOR SELECT TO anon, authenticated USING
  (EXISTS (SELECT FROM public.perhimpunan p WHERE p.id = perhimpunan_id));

-- Invoker uses the caller's own membership, even when the requested event is published.
CREATE OR REPLACE FUNCTION public.is_event_member(event_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT EXISTS (SELECT FROM public.perhimpunan e JOIN public.workspace_members m USING (workspace_id)
    WHERE e.id = event_id AND m.user_id = (SELECT auth.uid()));
$$;
REVOKE ALL ON FUNCTION public.is_event_member(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_member(uuid) TO authenticated;
CREATE POLICY member_agenda_write ON public.atur_cara FOR ALL TO authenticated
  USING (public.is_event_member(perhimpunan_id)) WITH CHECK (public.is_event_member(perhimpunan_id));
CREATE POLICY member_attendance_read ON public.kehadiran_peserta FOR SELECT TO authenticated
  USING (public.is_event_member(perhimpunan_id));
CREATE POLICY member_draw_read ON public.cabutan_pemenang FOR SELECT TO authenticated
  USING (public.is_event_member(perhimpunan_id));

CREATE OR REPLACE FUNCTION public.create_workspace(workspace_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE subject uuid := auth.uid(); result uuid;
BEGIN
  -- Serialize onboarding retries for this identity without blocking other organizers.
  PERFORM 1 FROM auth.users WHERE id = subject AND email_confirmed_at IS NOT NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sahkan e-mel anda dahulu.' USING ERRCODE='42501'; END IF;
  SELECT workspace_id INTO result FROM public.workspace_members WHERE user_id = subject;
  IF FOUND THEN RETURN result; END IF;
  IF workspace_name IS NULL OR char_length(btrim(workspace_name)) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Nama ruang kerja tidak sah.' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.workspaces(name) VALUES (btrim(workspace_name)) RETURNING id INTO result;
  INSERT INTO public.workspace_members(workspace_id,user_id) VALUES (result,subject);
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_event(event_id uuid, event_settings jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  supplied_workspace uuid := (event_settings->>'workspace_id')::uuid;
  item public.perhimpunan;
  asset text;
  asset_pattern text;
BEGIN
  IF supplied_workspace IS NULL OR NOT EXISTS (SELECT FROM public.workspace_members m
      WHERE m.workspace_id = supplied_workspace AND m.user_id = (SELECT auth.uid())) THEN
    RAISE EXCEPTION 'Akses ruang kerja diperlukan.' USING ERRCODE='42501';
  END IF;
  IF event_id IS NULL THEN
    item.published := false;
    item.status_aktif := false;
    item.primary_color := '#003053';
    item.accent_color := '#087f8c';
    item.layout := 'classic';
    item.timezone := 'Asia/Kuala_Lumpur';
    item.require_organization := false;
    item.draw_exclude_first := 0;
  ELSE
    SELECT e.* INTO item FROM public.perhimpunan e
      WHERE e.id = event_id AND e.workspace_id = supplied_workspace FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Akses acara diperlukan.' USING ERRCODE='42501'; END IF;
  END IF;
  -- Read only organizer-editable fields. Counters, row IDs and timestamps never
  -- enter the INSERT or UPDATE, regardless of additional JSON properties.
  item := jsonb_populate_record(item,event_settings - ARRAY['id','next_passport_number','dicipta_pada']);
  item.tajuk := btrim(item.tajuk);
  item.tema := nullif(btrim(item.tema),'');
  item.lokasi := btrim(item.lokasi);
  item.kod_sesi := upper(btrim(item.kod_sesi));
  item.slug := btrim(item.slug);
  item.organizer_name := nullif(btrim(item.organizer_name),'');
  item.consent_text := nullif(regexp_replace(item.consent_text,'^[[:space:]]+|[[:space:]]+$','','g'),'');
  item.logo_url := nullif(btrim(item.logo_url),'');
  item.banner_url := nullif(btrim(item.banner_url),'');
  IF coalesce(char_length(item.tajuk),0) NOT BETWEEN 1 AND 200
    OR coalesce(char_length(item.lokasi),0) NOT BETWEEN 1 AND 200
    OR coalesce(char_length(item.kod_sesi),0) NOT BETWEEN 1 AND 80
    OR char_length(item.tema) > 500 OR char_length(item.description) > 2000
    OR char_length(item.organizer_name) > 200 OR char_length(item.consent_text) > 2000
    OR item.tarikh IS NULL OR coalesce(item.masa_mula::text,'') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
    OR coalesce(item.slug,'') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR char_length(item.slug) > 80
    OR NOT EXISTS (SELECT FROM pg_catalog.pg_timezone_names tz WHERE tz.name = item.timezone)
    OR coalesce(item.primary_color,'') !~ '^#[A-Fa-f0-9]{6}$'
    OR coalesce(item.accent_color,'') !~ '^#[A-Fa-f0-9]{6}$'
    OR coalesce(item.layout,'') NOT IN ('classic','spotlight')
    OR coalesce(item.draw_exclude_first,-1) NOT BETWEEN 0 AND 10000
    OR item.published IS NULL OR item.status_aktif IS NULL OR item.require_organization IS NULL
    OR (item.status_aktif AND NOT item.published) THEN
    RAISE EXCEPTION 'Tetapan acara tidak sah.' USING ERRCODE='22023';
  END IF;
  asset_pattern := '^(https://[a-z0-9-]+[.]supabase[.]co|http://(localhost|127[.]0[.]0[.]1)(:[0-9]{1,5})?)/storage/v1/object/public/event-assets/'
    || supplied_workspace || '/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}[.](png|jpg|webp)$';
  FOREACH asset IN ARRAY ARRAY[item.logo_url,item.banner_url] LOOP
    IF asset IS NOT NULL AND asset !~ asset_pattern THEN
      RAISE EXCEPTION 'Imej perlu dimuat naik ke ruang kerja ini.' USING ERRCODE='22023';
    END IF;
  END LOOP;
  IF event_id IS NULL THEN
    INSERT INTO public.perhimpunan (workspace_id,tajuk,tema,tarikh,masa_mula,lokasi,kod_sesi,slug,
      description,organizer_name,timezone,published,status_aktif,primary_color,accent_color,layout,
      logo_url,banner_url,require_organization,consent_text,draw_exclude_first)
    VALUES (supplied_workspace,item.tajuk,item.tema,item.tarikh,item.masa_mula,item.lokasi,item.kod_sesi,item.slug,
      item.description,item.organizer_name,item.timezone,item.published,item.status_aktif,item.primary_color,
      item.accent_color,item.layout,item.logo_url,item.banner_url,item.require_organization,item.consent_text,item.draw_exclude_first)
    RETURNING id INTO event_id;
  ELSE
    UPDATE public.perhimpunan SET
      tajuk=item.tajuk,tema=item.tema,tarikh=item.tarikh,masa_mula=item.masa_mula,
      lokasi=item.lokasi,kod_sesi=item.kod_sesi,slug=item.slug,description=item.description,
      organizer_name=item.organizer_name,timezone=item.timezone,published=item.published,status_aktif=item.status_aktif,
      primary_color=item.primary_color,accent_color=item.accent_color,layout=item.layout,logo_url=item.logo_url,
      banner_url=item.banner_url,require_organization=item.require_organization,consent_text=item.consent_text,
      draw_exclude_first=item.draw_exclude_first WHERE id=event_id AND workspace_id=supplied_workspace;
  END IF;
  RETURN event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_registration_open(event_id uuid, is_open boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE event_published boolean;
BEGIN
  IF is_open IS NULL THEN RAISE EXCEPTION 'Status diperlukan.' USING ERRCODE='22023'; END IF;
  UPDATE public.perhimpunan e SET status_aktif = is_open WHERE e.id = event_id
    AND EXISTS (SELECT FROM public.workspace_members m WHERE m.workspace_id=e.workspace_id AND m.user_id=(SELECT auth.uid()))
    RETURNING published INTO event_published;
  IF NOT FOUND THEN RAISE EXCEPTION 'Akses acara diperlukan.' USING ERRCODE='42501'; END IF;
  IF is_open AND NOT event_published THEN
    RAISE EXCEPTION 'Terbitkan acara sebelum membuka pendaftaran.' USING ERRCODE='22023';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_event_attendance(
  event_id uuid, officer_name text, division text, email_address text,
  consent_accepted boolean, expected_consent_text text
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  event public.perhimpunan;
  participant_name text := upper(btrim(officer_name));
  organization text := coalesce(btrim(division),'');
  displayed_consent text := nullif(regexp_replace(expected_consent_text,'^[[:space:]]+|[[:space:]]+$','','g'),'');
  email text := lower(btrim(email_address));
  token text := 'PAS-' || gen_random_uuid()::text;
BEGIN
  IF coalesce(char_length(participant_name),0) NOT BETWEEN 1 AND 200 OR char_length(organization)>200
    OR coalesce(char_length(email),0) NOT BETWEEN 1 AND 254
    OR email !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' THEN
    RAISE EXCEPTION 'Maklumat pendaftaran tidak sah.' USING ERRCODE='22023';
  END IF;
  -- The row lock serializes numbering, consent edits and closing registration.
  UPDATE public.perhimpunan e SET next_passport_number = e.next_passport_number + 1
    WHERE e.id=event_id AND e.status_aktif AND e.published RETURNING * INTO event;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pendaftaran ditutup.' USING ERRCODE='P0001'; END IF;
  IF event.require_organization AND organization='' THEN
    RAISE EXCEPTION 'Nama organisasi diperlukan.' USING ERRCODE='22023';
  END IF;
  IF displayed_consent IS DISTINCT FROM event.consent_text THEN
    RAISE EXCEPTION 'Teks persetujuan telah berubah. Muat semula halaman dan baca semula sebelum mendaftar.' USING ERRCODE='22023';
  END IF;
  IF event.consent_text IS NOT NULL AND consent_accepted IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Persetujuan diperlukan.' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.kehadiran_peserta(perhimpunan_id,nama_pegawai,bahagian_unit,emel,token_pasport,no_pasport,
      akur_janji_pada,accepted_consent_text)
    VALUES (event.id,participant_name,organization,email,token,event.next_passport_number-1,
      CASE WHEN event.consent_text IS NOT NULL THEN now() END,event.consent_text);
  RETURN token;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Nama ini telah didaftarkan. Buka pas yang disimpan atau hubungi penganjur.' USING ERRCODE='23505';
END;
$$;

-- The private token is the access capability. Preserve issued passes after closure.
CREATE OR REPLACE FUNCTION public.get_passport(passport_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('nama_pegawai',k.nama_pegawai,'bahagian_unit',k.bahagian_unit,
    'waktu_hadir',k.waktu_hadir,'checked_in_at',k.checked_in_at,'token_pasport',k.token_pasport,'no_pasport',k.no_pasport,
    'perhimpunan',jsonb_build_object('id',p.id,'slug',p.slug,'tajuk',p.tajuk,'tema',p.tema,'tarikh',p.tarikh,
      'masa_mula',p.masa_mula,'lokasi',p.lokasi,'kod_sesi',p.kod_sesi,'organizer_name',p.organizer_name,'timezone',p.timezone,
      'primary_color',p.primary_color,'accent_color',p.accent_color,'layout',p.layout,'logo_url',p.logo_url,'banner_url',p.banner_url))
  FROM public.kehadiran_peserta k JOIN public.perhimpunan p ON p.id=k.perhimpunan_id
  WHERE k.token_pasport=passport_token AND passport_token ~* '^PAS-([a-f0-9]{8}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$';
$$;

CREATE OR REPLACE FUNCTION public.check_in_attendee(event_id uuid, passport_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE participant public.kehadiran_peserta;
BEGIN
  IF NOT public.is_event_member(event_id) THEN
    RAISE EXCEPTION 'Akses acara diperlukan.' USING ERRCODE='42501';
  END IF;
  -- Serialize simultaneous scans. Repeat scans return the first timestamp.
  SELECT k.* INTO participant FROM public.kehadiran_peserta k
    WHERE k.perhimpunan_id=event_id AND k.token_pasport=passport_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pas tidak ditemui untuk acara ini.' USING ERRCODE='P0002'; END IF;
  IF participant.checked_in_at IS NULL THEN
    UPDATE public.kehadiran_peserta SET checked_in_at=clock_timestamp()
      WHERE id=participant.id RETURNING checked_in_at INTO participant.checked_in_at;
  END IF;
  RETURN jsonb_build_object('nama_pegawai',participant.nama_pegawai,'bahagian_unit',participant.bahagian_unit,
    'waktu_hadir',participant.waktu_hadir,'checked_in_at',participant.checked_in_at,
    'token_pasport',participant.token_pasport,'no_pasport',participant.no_pasport);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_attendance_count(event_id uuid)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT (SELECT count(*) FROM public.kehadiran_peserta k WHERE k.perhimpunan_id=p.id) FROM public.perhimpunan p
  WHERE p.id=event_id AND (p.published OR EXISTS (
    SELECT FROM public.workspace_members m WHERE m.workspace_id=p.workspace_id AND m.user_id=(SELECT auth.uid())));
$$;

CREATE OR REPLACE FUNCTION public.save_cabutan_winner(draw_id uuid, event_id uuid, participant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  event public.perhimpunan;
  participant public.kehadiran_peserta;
  winner public.cabutan_pemenang;
BEGIN
  SELECT p.* INTO event FROM public.perhimpunan p WHERE p.id=event_id AND EXISTS (
    SELECT FROM public.workspace_members m WHERE m.workspace_id=p.workspace_id AND m.user_id=(SELECT auth.uid())) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Akses acara diperlukan.' USING ERRCODE='42501'; END IF;
  IF draw_id IS NULL OR participant_id IS NULL THEN
    RAISE EXCEPTION 'Maklumat cabutan tidak sah.' USING ERRCODE='22023';
  END IF;
  SELECT w.* INTO winner FROM public.cabutan_pemenang w WHERE w.id=draw_id AND w.perhimpunan_id=event_id;
  IF FOUND THEN
    IF winner.peserta_id<>participant_id THEN RAISE EXCEPTION 'Cabutan tidak sepadan.' USING ERRCODE='22023'; END IF;
    RETURN to_jsonb(winner);
  END IF;
  SELECT k.* INTO participant FROM public.kehadiran_peserta k WHERE k.id=participant_id AND k.perhimpunan_id=event_id FOR SHARE;
  IF NOT FOUND OR participant.no_pasport <= event.draw_exclude_first THEN
    RAISE EXCEPTION 'Peserta tidak layak untuk cabutan ini.' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.cabutan_pemenang(id,perhimpunan_id,peserta_id,nama_pegawai,bahagian_unit,no_pasport)
    VALUES (draw_id,event_id,participant_id,participant.nama_pegawai,participant.bahagian_unit,participant.no_pasport)
    RETURNING * INTO winner;
  RETURN to_jsonb(winner);
END;
$$;

REVOKE ALL ON FUNCTION public.create_workspace(text),public.save_event(uuid,jsonb),public.set_registration_open(uuid,boolean),
  public.register_event_attendance(uuid,text,text,text,boolean,text),public.get_passport(text),public.get_attendance_count(uuid),
  public.check_in_attendee(uuid,text),public.save_cabutan_winner(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_workspace(text),public.save_event(uuid,jsonb),public.set_registration_open(uuid,boolean),
  public.check_in_attendee(uuid,text),public.save_cabutan_winner(uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_event_attendance(uuid,text,text,text,boolean,text),public.get_passport(text),
  public.get_attendance_count(uuid) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
