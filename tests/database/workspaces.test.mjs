import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const schema = await readFile(new URL('../../supabase/schema.sql', import.meta.url), 'utf8');
const people = Array.from({ length: 3 }, () => randomUUID());
async function database(t) {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;`);
  await db.query('INSERT INTO auth.users(id,email_confirmed_at) VALUES ($1, now()),($2, now()),($3, null)', people);
  return db;
}
async function identity(db, user) {
  await db.exec(user ? 'SET ROLE authenticated' : 'SET ROLE anon');
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [user ?? '']);
}
async function scalar(db, sql, args = []) {
  const { rows: [row] } = await db.query(sql, args);
  return Object.values(row)[0];
}
async function workspace(db, user) {
  await identity(db, user);
  return scalar(db, "SELECT public.create_workspace('Team')", []);
}
const settings = (workspace_id, slug) => ({
  workspace_id, slug, kod_sesi: slug.toUpperCase(), tajuk: 'Workshop', tarikh: '2027-04-03',
  masa_mula: '10:00', lokasi: 'Hall',
});
const save = (db, event, fields) => scalar(db, 'SELECT public.save_event($1,$2)', [event, JSON.stringify(fields)]);
const open = (db, event, value) => db.query('SELECT public.set_registration_open($1,$2)', [event,value]);
const register = (db, eventId, name, organization, accepted, displayedConsent = null) => scalar(db,
  'SELECT public.register_event_attendance($1,$2,$3,$4,$5,$6)',
  [eventId,name,organization,'test@example.com',accepted,displayedConsent]);
const draw = (db, event, participant, drawId) => scalar(db,
  'SELECT public.save_cabutan_winner($1,$2,$3)', [drawId,event,participant]);

test('fresh install is empty and verified owners can retry onboarding safely', async t => {
  const db = await database(t);
  await db.exec(schema);
  for (const table of ['perhimpunan','kehadiran_peserta','atur_cara','cabutan_pemenang','workspace_members']) {
    assert.equal(await scalar(db, `SELECT count(*)::int FROM public.${table}`), 0);
  }
  await db.exec(schema);
  for (const file of ['access-control.sql','session-transitions.sql']) {
    await db.exec(await readFile(new URL(`../../supabase/tests/${file}`,import.meta.url),'utf8'));
  }
  assert.equal(await scalar(db,'SELECT count(*)::int FROM public.perhimpunan'),0);
  await identity(db, null);
  await assert.rejects(db.query("SELECT public.create_workspace('Guest')"), {code:'42501'});
  await assert.rejects(workspace(db, people[2]), {code:'42501'});
  const id = await workspace(db, people[0]);
  assert.equal(await workspace(db, people[0]), id);
  assert.notEqual(await workspace(db, people[1]), id);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.workspace_members'), 1);
  await assert.rejects(db.query('INSERT INTO public.workspace_members(workspace_id,user_id) VALUES ($1,$2)', [id,people[1]]), {code:'42501'});
});

test('draft privacy and workspace authorization apply to event settings, attendance, agendas and draw RPCs', async t => {
  const db = await database(t);
  await db.exec(schema);
  const a = await workspace(db, people[0]);
  const event = await save(db, null, settings(a,'workshop'));
  assert.deepEqual((await db.query('SELECT published,status_aktif FROM public.perhimpunan WHERE id=$1', [event])).rows,
    [{published:false,status_aktif:false}]);
  await assert.rejects(open(db,event,true),{code:'22023'});
  await assert.rejects(save(db,event,{workspace_id:a,status_aktif:true}),{code:'22023'});
  await db.query("INSERT INTO public.atur_cara(perhimpunan_id,tajuk_agenda) VALUES ($1,'Intro')", [event]);
  await identity(db, null);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.perhimpunan'), 0);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.atur_cara'), 0);
  assert.equal(await scalar(db, 'SELECT public.get_attendance_count($1)', [event]), null);
  await assert.rejects(register(db,event,'Lee','',false), {code:'P0001'});
  const b = await workspace(db, people[1]);
  await assert.rejects(save(db,event,settings(b,'forged')), {code:'42501'});
  await assert.rejects(save(db,null,settings(a,'forged')), {code:'42501'});
  await assert.rejects(open(db,event,true), {code:'42501'});
  await assert.rejects(draw(db,event,randomUUID(),randomUUID()), {code:'42501'});
  await assert.rejects(db.query("INSERT INTO public.atur_cara(perhimpunan_id,tajuk_agenda) VALUES ($1,'Forged')",[event]), {code:'42501'});
  assert.equal((await db.query("UPDATE public.atur_cara SET tajuk_agenda='Forged' RETURNING id")).rows.length, 0);
  assert.equal(await scalar(db,'SELECT count(*)::int FROM public.kehadiran_peserta'),0);
  assert.equal(await scalar(db,'SELECT count(*)::int FROM public.cabutan_pemenang'),0);
  await identity(db, people[0]);
  await save(db,event,{...settings(a,'workshop'), published:true, status_aktif:true, consent_text:'I agree', require_organization:true, draw_exclude_first:1});
  await identity(db, null);
  assert.equal(await scalar(db,'SELECT count(*)::int FROM public.atur_cara'),1);
  await assert.rejects(register(db,event,'Lee','',true,'I agree'), {code:'22023'});
  await assert.rejects(register(db,event,'Lee','Team',false,'I agree'), {code:'22023'});
  const token = await register(db,event,'Lee','Team',true,'I agree');
  await assert.rejects(register(db,event,' lee ','Else',true,'I agree'), {code:'23505'});
  const secondToken = await register(db,event,'Sam','Team',true,'I agree');
  const pass = await scalar(db,'SELECT public.get_passport($1)',[token]);
  assert.equal(pass.no_pasport, 1);
  assert.equal(pass.perhimpunan.slug, 'workshop');
  assert.equal(pass.perhimpunan.timezone, 'Asia/Kuala_Lumpur');
  assert.equal(pass.perhimpunan.primary_color,'#003053');
  assert.ok(!('emel' in pass || 'akur_janji_pada' in pass));
  await identity(db, people[0]);
  const id = await scalar(db,'SELECT id FROM public.kehadiran_peserta WHERE token_pasport=$1',[token]);
  const drawId = randomUUID();
  await assert.rejects(draw(db,event,id,drawId), {code:'22023'});
  await save(db,event,{...settings(a,'workshop'), published:true, status_aktif:true, draw_exclude_first:0});
  const saved = await draw(db,event,id,drawId);
  assert.equal(saved.no_pasport,1);
  await open(db,event,false);
  assert.deepEqual(await draw(db,event,id,drawId),saved);
  const secondId = await scalar(db,'SELECT id FROM public.kehadiran_peserta WHERE token_pasport=$1',[secondToken]);
  const afterClosing = await draw(db,event,secondId,randomUUID());
  assert.equal(afterClosing.no_pasport,2);
  await identity(db, people[1]);
  assert.equal(await scalar(db,'SELECT count(*)::int FROM public.kehadiran_peserta'),0);
  assert.equal(await scalar(db,'SELECT count(*)::int FROM public.cabutan_pemenang'),0);
  await assert.rejects(draw(db,event,id,drawId),{code:'42501'});
});

test('registration status is independent, optional fields work and invalid settings cannot overwrite an event', async t => {
  const db = await database(t);
  await db.exec(schema);
  const a = await workspace(db, people[0]);
  const first = await save(db,null,{...settings(a,'first'),published:true,status_aktif:true});
  const b = await workspace(db, people[1]);
  const second = await save(db,null,{...settings(b,'second'),published:true,status_aktif:true});
  const logo = `https://sample.supabase.co/storage/v1/object/public/event-assets/${b}/${randomUUID()}.png`;
  await save(db,second,{workspace_id:b,logo_url:logo});
  const invalid = [{layout:'raw-html'},{accent_color:'url(bad)'},{draw_exclude_first:-1},{slug:'not/a/slug'},
    {timezone:'invalid/zone'},{logo_url:'javascript:alert(1)'},{banner_url:'https://example.com/image.svg'},
    {logo_url:logo.replace(b,a)}, {slug:'first'},{kod_sesi:'first'}];
  for (const patch of invalid) {
    await assert.rejects(save(db,second,{...settings(b,'second'),...patch}));
  }
  await identity(db,people[0]);
  await open(db,first,false);
  await identity(db,null);
  await assert.rejects(register(db,first,'Lee','',false),{code:'P0001'});
  await register(db,second,'Lee','',false);
  assert.equal(await scalar(db,'SELECT public.get_attendance_count($1)',[second]),1);
  assert.equal(await scalar(db,'SELECT logo_url FROM public.perhimpunan WHERE id=$1',[second]),logo);
  await identity(db,people[1]);
  assert.equal(await scalar(db,'SELECT akur_janji_pada FROM public.kehadiran_peserta'),null);
});

test('stale forms cannot accept revised consent or register against a different event reusing the old code', async t => {
  const db = await database(t);
  await db.exec(schema);
  const a = await workspace(db,people[0]);
  const original = await save(db,null,{...settings(a,'training'),published:true,status_aktif:true,consent_text:'First statement'});
  await save(db,original,{workspace_id:a,kod_sesi:'MOVED',consent_text:'Second statement'});
  const b = await workspace(db,people[1]);
  const other = await save(db,null,{...settings(b,'other'),kod_sesi:'TRAINING',published:true,status_aktif:true});
  await identity(db,null);
  await assert.rejects(register(db,original,'Lee','',true,'First statement'),{code:'22023'});
  await assert.rejects(register(db,original,'Lee','',true,null),{code:'22023'});
  await assert.rejects(db.query("SELECT public.register_attendance('TRAINING','Lee','','lee@example.com',true)"),{code:'42883'});
  const token = await register(db,original,'Lee','',true,' Second statement ');
  const pass = await scalar(db,'SELECT public.get_passport($1)',[token]);
  assert.equal(pass.perhimpunan.id,original);
  assert.equal(pass.no_pasport,1);
  assert.equal(await scalar(db,'SELECT public.get_attendance_count($1)',[other]),0);
  await identity(db,people[0]);
  await save(db,original,{workspace_id:a,consent_text:null});
  await identity(db,null);
  await assert.rejects(register(db,original,'Sam','',true,'Second statement'),{code:'22023'});
  await register(db,original,'Sam','',false,'  ');
  await identity(db,people[0]);
  const statements = (await db.query('SELECT accepted_consent_text FROM public.kehadiran_peserta ORDER BY no_pasport')).rows;
  assert.deepEqual(statements,[{accepted_consent_text:'Second statement'},{accepted_consent_text:null}]);
});


test('only a member can check a pass into its issuing event and retries preserve the check-in timestamp', async t => {
  const db = await database(t);
  await db.exec(schema);
  const a = await workspace(db,people[0]);
  const first = await save(db,null,{...settings(a,'first'),published:true,status_aktif:true});
  const another = await save(db,null,settings(a,'another'));
  await identity(db,null);
  const token = await register(db,first,'Lee','Team',false);
  const pass = () => scalar(db,'SELECT public.get_passport($1)',[token]);
  assert.equal((await pass()).checked_in_at,null);
  const checkIn = (eventId,tokenToCheck=token) => scalar(db,'SELECT public.check_in_attendee($1,$2)',[eventId,tokenToCheck]);
  await assert.rejects(checkIn(first),{code:'42501'});
  await workspace(db,people[1]);
  await assert.rejects(checkIn(first),{code:'42501'});
  await identity(db,people[0]);
  await assert.rejects(checkIn(another),{code:'P0002'});
  await assert.rejects(checkIn(first,'PAS-00000000'),{code:'P0002'});
  await open(db,first,false);
  const result = await checkIn(first);
  assert.deepEqual(Object.keys(result).sort(),['bahagian_unit','checked_in_at','nama_pegawai','no_pasport','token_pasport','waktu_hadir']);
  assert.equal(result.token_pasport,token);
  assert.equal(result.no_pasport,1);
  assert.ok(Number.isFinite(Date.parse(result.checked_in_at)));
  assert.deepEqual(await checkIn(first),result);
  await identity(db,null);
  assert.equal((await pass()).checked_in_at,result.checked_in_at);
});

test('workspace migration requires an explicit verified owner and preserves historical passes and records on reruns', async t => {
  const db = await database(t);
  const old = await readFile(new URL('../fixtures/historical-schema.sql', import.meta.url), 'utf8');
  const upgrade = await readFile(new URL('../../supabase/migrations/202611240001_workspace_events.sql', import.meta.url), 'utf8');
  await db.exec(old);
  await db.exec('ALTER TABLE public.perhimpunan ALTER COLUMN masa_mula TYPE time USING masa_mula::time');
  const token = await scalar(db,"SELECT public.register_attendance('SAMPLE-26','Prior','Dept','test@example.com',true)");
  const event = await scalar(db,'SELECT id FROM public.perhimpunan');
  const before = (await db.query('SELECT id,no_pasport,akur_janji_pada FROM public.kehadiran_peserta')).rows;
  for (const owner of [null, people[2]]) {
    if (owner) await db.query("SELECT set_config('jpaevents.legacy_owner_id',$1,false)",[owner]);
    await assert.rejects(db.exec(upgrade), /legacy_owner_id/);
    await db.exec('ROLLBACK');
    assert.deepEqual((await db.query('SELECT id,no_pasport,akur_janji_pada FROM public.kehadiran_peserta')).rows,before);
  }
  await db.query("SELECT set_config('jpaevents.legacy_owner_id',$1,false)",[people[0]]);
  await db.exec(upgrade);
  await db.exec(upgrade);
  await identity(db,people[0]);
  const membership = await scalar(db,'SELECT workspace_id FROM public.workspace_members');
  const imported = (await db.query('SELECT * FROM public.perhimpunan WHERE id=$1',[event])).rows[0];
  assert.equal(imported.workspace_id,membership);
  assert.equal(imported.published,true);
  assert.equal(imported.status_aktif,true);
  assert.equal(imported.draw_exclude_first,5);
  assert.equal(await scalar(db,'SELECT count(*)::int FROM public.atur_cara WHERE perhimpunan_id=$1',[event]),6);
  assert.equal(await scalar(db,'SELECT accepted_consent_text FROM public.kehadiran_peserta'),null);
  assert.deepEqual((await db.query('SELECT id,no_pasport,akur_janji_pada FROM public.kehadiran_peserta')).rows,before);
  await save(db,event,{workspace_id:membership,masa_mula:'12:05'});
  assert.equal(await scalar(db,'SELECT masa_mula FROM public.perhimpunan WHERE id=$1',[event]),'12:05:00');
  await identity(db,null);
  assert.equal((await scalar(db,'SELECT public.get_passport($1)',[token])).perhimpunan.id,event);
  for (const signature of ['public.create_event(text,text,date,text,text,text)','public.set_active_event(uuid)',
    'public.register_attendance(text,text,text)','public.register_attendance(text,text,text,text,boolean)']) {
    assert.equal(await scalar(db,'SELECT to_regprocedure($1)::text',[signature]),null);
  }
});

test('storage bucket permits immutable image uploads only inside the uploader workspace', async t => {
  const db = await database(t);
  await db.exec(schema);
  // Use the Storage schema boundary. The Storage service enforces bucket MIME/byte limits.
  await db.exec(`CREATE SCHEMA storage;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(bucket_id text,name text, PRIMARY KEY(bucket_id,name));
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA storage TO anon,authenticated;
    GRANT ALL ON storage.objects TO anon,authenticated;
    CREATE POLICY other_bucket_policy ON storage.objects FOR ALL USING (true) WITH CHECK (true);`);
  const install = await readFile(new URL('../../supabase/storage.sql', import.meta.url), 'utf8');
  await db.exec(install);
  await db.exec(install);
  const bucket = (await db.query("SELECT * FROM storage.buckets WHERE id='event-assets'")).rows[0];
  assert.equal(Number(bucket.file_size_limit),5242880);
  assert.deepEqual(bucket.allowed_mime_types.sort(),['image/jpeg','image/png','image/webp']);
  const a = await workspace(db,people[0]);
  const b = await workspace(db,people[1]);
  const image = randomUUID()+'.png';
  const upload = path => db.query("INSERT INTO storage.objects(bucket_id,name) VALUES ('event-assets',$1)",[path]);
  await upload(b+'/'+image);
  await assert.rejects(upload(a+'/'+image),{code:'42501'});
  await assert.rejects(upload(b+'/sub/'+image),{code:'42501'});
  await assert.rejects(upload(b+'/'+randomUUID()+'.svg'),{code:'42501'});
  await assert.rejects(upload(b+'/'+image),{code:'23505'});
  assert.equal((await db.query("DELETE FROM storage.objects WHERE name=$1 RETURNING name",[b+'/'+image])).rows.length,0);
  assert.equal((await db.query("UPDATE storage.objects SET name='replacement' WHERE name=$1 RETURNING name",[b+'/'+image])).rows.length,0);
  await identity(db,people[0]);
  assert.equal(await scalar(db,"SELECT count(*)::int FROM storage.objects WHERE bucket_id='event-assets'"),0);
  await identity(db,null);
  assert.equal(await scalar(db,"SELECT count(*)::int FROM storage.objects WHERE bucket_id='event-assets'"),0);
  await assert.rejects(upload(b+'/'+randomUUID()+'.webp'),{code:'42501'});
});
