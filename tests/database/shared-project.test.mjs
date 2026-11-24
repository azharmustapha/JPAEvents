import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const databaseFiles = new URL('../../supabase/', import.meta.url);
const existingTables = [
  'perhimpunan', 'kehadiran_peserta', 'atur_cara', 'admin_users', 'cabutan_pemenang',
  'pendaftaran_peserta', 'cabutan_permohonan', 'audit_trail',
];
const owners = [randomUUID(), randomUUID()];

test('shared SQL artifacts match the current database and Storage definitions', () => {
  const generator = fileURLToPath(new URL('../../scripts/build-shared-schema.mjs', import.meta.url));
  execFileSync(process.execPath, [generator, '--check']);
});

async function fixtures(db) {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email_confirmed_at timestamptz);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(bucket_id text REFERENCES storage.buckets(id),name text);
    GRANT USAGE ON SCHEMA public,auth,storage TO anon,authenticated;
    GRANT SELECT,INSERT ON storage.objects TO anon,authenticated;
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    INSERT INTO storage.buckets VALUES ('event-assets','event-assets',false,123,ARRAY['image/gif']);
    CREATE POLICY event_asset_upload ON storage.objects FOR INSERT WITH CHECK (bucket_id='event-assets');
    CREATE POLICY event_asset_list_scope ON storage.objects FOR SELECT USING (bucket_id='event-assets');`);
  await db.query('INSERT INTO auth.users VALUES ($1,now()),($2,now())', owners);
  for (const name of existingTables) {
    await db.exec(`CREATE TABLE public.${name}(marker text PRIMARY KEY);
      INSERT INTO public.${name} VALUES ('existing');
      ALTER TABLE public.${name} ENABLE ROW LEVEL SECURITY;
      GRANT SELECT ON public.${name} TO authenticated;
      CREATE POLICY original_read ON public.${name} FOR SELECT TO authenticated USING (true)`);
  }
  await db.exec(`CREATE UNIQUE INDEX one_active_event ON public.perhimpunan(marker);
    CREATE INDEX attendance_normalized_name ON public.kehadiran_peserta(marker);
    CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
    CREATE FUNCTION public.get_passport(text) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{"original":true}'::jsonb $$;
    CREATE FUNCTION public.get_attendance_count(uuid) RETURNS bigint LANGUAGE sql AS $$ SELECT 42::bigint $$;
    CREATE FUNCTION public.create_event(text,text,date,text,text,text) RETURNS text LANGUAGE sql AS $$ SELECT 'original'::text $$;
    CREATE FUNCTION public.original_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN INSERT INTO public.audit_trail VALUES (NEW.marker); RETURN NEW; END $$;
    CREATE TRIGGER original_audit AFTER INSERT ON public.perhimpunan FOR EACH ROW EXECUTE FUNCTION public.original_audit();`);
}

async function existingObjects(db) {
  const queries = [
    `SELECT c.relname,c.oid,c.relrowsecurity,c.relacl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname NOT LIKE 'jpaevents\\_%' ORDER BY c.relname`,
    `SELECT table_name,column_name,data_type FROM information_schema.columns
     WHERE table_schema='public' AND table_name NOT LIKE 'jpaevents\\_%' ORDER BY table_name,ordinal_position`,
    `SELECT * FROM pg_policies WHERE schemaname IN ('storage','public') AND policyname NOT LIKE 'jpaevents\\_%'
     ORDER BY tablename,policyname`,
    `SELECT p.oid,p.proacl,pg_get_functiondef(p.oid) FROM pg_proc p
     WHERE p.pronamespace='public'::regnamespace AND p.proname NOT LIKE 'jpaevents\\_%' ORDER BY p.oid`,
    "SELECT * FROM storage.buckets WHERE id='event-assets'",
    ...existingTables.map(name => `SELECT * FROM public.${name} ORDER BY marker`),
  ];
  const results = [];
  for (const sql of queries) results.push((await db.query(sql)).rows);
  return results;
}

async function scalar(db, sql, args = []) {
  return Object.values((await db.query(sql, args)).rows[0])[0];
}

async function identity(db, user) {
  await db.exec(user ? 'SET ROLE authenticated' : 'SET ROLE anon');
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [user ?? '']);
}

async function saveEvent(db, workspace, slug) {
  return scalar(db, 'SELECT public.jpaevents_save_event(null,$1)', [{
    workspace_id: workspace, slug, kod_sesi: slug, tajuk: slug, tarikh: '2027-05-01',
    masa_mula: '09:00', lokasi: 'Hall', published: true, status_aktif: true, consent_text: 'Accept',
    logo_url: `https://sample.supabase.co/storage/v1/object/public/jpaevents-event-assets/${workspace}/${randomUUID()}.png`,
  }]);
}

test('shared project installs alongside existing tables, RPCs, audit triggers and Storage policies', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await fixtures(db);
  const before = await existingObjects(db);
  for (let run = 0; run < 2; run++) {
    for (const filename of ['shared-project.sql', 'shared-storage.sql']) {
      await db.exec(await readFile(new URL(filename, databaseFiles), 'utf8'));
    }
    assert.deepEqual(await existingObjects(db), before);
    assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.jpaevents_perhimpunan'), 0);
  }
  assert.equal(await scalar(db, 'SELECT public.is_admin()'), true);
  assert.deepEqual(await scalar(db, "SELECT public.get_passport('test')"), { original: true });
  assert.equal(Number(await scalar(db, 'SELECT public.get_attendance_count(null)')), 42);
  assert.equal(await scalar(db, 'SELECT public.create_event(null,null,null,null,null,null)'), 'original');
  await db.exec("INSERT INTO public.perhimpunan VALUES ('audit me')");
  assert.equal(await scalar(db, "SELECT marker FROM public.audit_trail WHERE marker='audit me'"), 'audit me');

  await identity(db, owners[0]);
  const a = await scalar(db, "SELECT public.jpaevents_create_workspace('Team A')");
  const first = await saveEvent(db, a, 'first');
  await identity(db, owners[1]);
  const b = await scalar(db, "SELECT public.jpaevents_create_workspace('Team B')");
  const second = await saveEvent(db, b, 'second');
  assert.notEqual(a,b);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.jpaevents_workspace_members'),1);
  await assert.rejects(db.query('SELECT public.jpaevents_set_registration_open($1,false)', [first]), {code:'42501'});
  await db.query('SELECT public.jpaevents_set_registration_open($1,false)', [second]);

  await identity(db, null);
  const register = (event, statement) => scalar(db,
    'SELECT public.jpaevents_register_event_attendance($1,$2,$3,$4,true,$5)',
    [event,'Lee','Team','lee@example.org',statement]);
  await assert.rejects(register(second,'Accept'), {code:'P0001'});
  await assert.rejects(register(first,'Previous consent'), {code:'22023'});
  const token = await register(first,'Accept');
  await assert.rejects(register(first,'Accept'), {code:'23505'});
  const passport = await scalar(db, 'SELECT public.jpaevents_get_passport($1)', [token]);
  assert.equal(passport.perhimpunan.id, first);
  assert.equal(passport.no_pasport, 1);
  const checkIn = () => scalar(db,'SELECT public.jpaevents_check_in_attendee($1,$2)',[first,token]);
  await assert.rejects(checkIn(), {code:'42501'});
  await identity(db, owners[1]);
  await assert.rejects(checkIn(), {code:'42501'});
  await identity(db, owners[0]);
  const scanned = await checkIn();
  assert.ok(scanned.checked_in_at);
  assert.deepEqual(await checkIn(), scanned);
  assert.equal(await scalar(db,
    'SELECT accepted_consent_text FROM public.jpaevents_kehadiran_peserta WHERE perhimpunan_id=$1',[first]),'Accept');

  const asset = `${a}/${randomUUID()}.png`;
  const upload = (bucket, path) => db.query('INSERT INTO storage.objects VALUES ($1,$2)', [bucket,path]);
  await upload('jpaevents-event-assets',asset);
  await identity(db,owners[1]);
  await assert.rejects(upload('jpaevents-event-assets',asset), {code:'42501'});
  await identity(db,null);
  await assert.rejects(upload('jpaevents-event-assets',asset), {code:'42501'});
  await upload('event-assets','old-path');
  assert.deepEqual((await db.query('SELECT name FROM storage.objects')).rows, [{name:'old-path'}]);

  await db.exec('RESET ROLE');
  const legacyBeforeDeletion = await existingObjects(db);
  await db.query('DELETE FROM auth.users WHERE id=$1', [owners[0]]);
  assert.deepEqual(await existingObjects(db), legacyBeforeDeletion);
  assert.deepEqual((await db.query('SELECT workspace_id,user_id FROM public.jpaevents_workspace_members')).rows,
    [{workspace_id:b, user_id:owners[1]}]);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.jpaevents_perhimpunan'), 2);
  await identity(db, owners[0]);
  await assert.rejects(checkIn(), {code:'42501'});
  await identity(db, owners[1]);
  await db.query('SELECT public.jpaevents_set_registration_open($1,true)', [second]);
});
