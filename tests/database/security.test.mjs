import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const admin = '00000000-0000-4000-8000-000000000001';
const member = '00000000-0000-4000-8000-000000000002';
const seedId = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
const legacy = await readFile(new URL('../fixtures/legacy-schema.sql', import.meta.url), 'utf8');
const migrationPath = new URL('../../supabase/migrations/202610070001_security_and_sessions.sql', import.meta.url);

async function database(clean = false) {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;`);
  await db.exec(clean ? await readFile(new URL('../fixtures/historical-schema.sql',import.meta.url),'utf8') : legacy);
  if (!clean) await db.exec('GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated');
  return db;
}
async function upgrade(db) {
  await db.exec(await readFile(migrationPath, 'utf8'));
  await db.query('INSERT INTO auth.users(id,email) VALUES ($1,$2),($3,$4)', [admin,'admin@test.local',member,'member@test.local']);
  await db.query('INSERT INTO public.admin_users(user_id) VALUES ($1)', [admin]);
}
async function asRole(db, role, subject, work) {
  await db.exec(`SET ROLE ${role}`);
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [subject ?? '']);
  try { return await work(); }
  finally { await db.exec('RESET ROLE'); await db.query("SELECT set_config('request.jwt.claim.sub','',false)"); }
}

test('migration closes anonymous enumeration and preserves existing passport', async () => {
  const db = await database();
  try {
    await db.query(`INSERT INTO public.kehadiran_peserta(perhimpunan_id,nama_pegawai,bahagian_unit,token_pasport)
      VALUES ($1,'LEGACY OFFICER','Unit A','PAS-ABCDEF12')`, [seedId]);
    await upgrade(db);
    await asRole(db,'anon',null, async () => {
      await assert.rejects(db.query('SELECT * FROM public.kehadiran_peserta'), { code: '42501' });
      const { rows } = await db.query("SELECT public.get_passport('PAS-ABCDEF12') AS passport");
      assert.equal(rows[0].passport.nama_pegawai, 'LEGACY OFFICER');
      assert.equal(rows[0].passport.perhimpunan.kod_sesi, 'SAMPLE-26');
      assert.equal((await db.query('SELECT public.get_attendance_count($1) AS n',[seedId])).rows[0].n, 1);
      for (const token of ['', 'PAS-00000000', 'x'.repeat(100)]) {
        assert.equal((await db.query('SELECT public.get_passport($1) AS p',[token])).rows[0].p, null);
      }
    });
  } finally { await db.close(); }
});

test('registration uses database credentials and never discloses a duplicate token', async () => {
  const db = await database();
  try {
    await upgrade(db);
    await asRole(db,'anon',null, async () => {
      const { rows } = await db.query('SELECT public.register_attendance($1,$2,$3) AS token',[' sample-26 ',' Ali ',' Unit A ']);
      const token = rows[0].token;
      assert.match(token,/^PAS-[a-f0-9-]{36}$/);
      const passport = (await db.query('SELECT public.get_passport($1) AS p',[token])).rows[0].p;
      assert.equal(passport.nama_pegawai,'ALI');
      assert.equal(passport.bahagian_unit,'Unit A');
      assert.ok(Date.now() - new Date(passport.waktu_hadir).getTime() < 10000);
      await assert.rejects(db.query('SELECT public.register_attendance($1,$2,$3)',['SAMPLE-26','ali','Other']), (error) => {
        assert.equal(error.code,'23505');
        assert.equal(JSON.stringify(error).includes(token),false);
        return true;
      });
      await assert.rejects(db.query('SELECT public.register_attendance($1,$2,$3)',['SAMPLE-26',' ','Unit']), {code:'22023'});
      await assert.rejects(db.query('SELECT public.register_attendance($1,$2,$3)',['SAMPLE-26','A'.repeat(201),'Unit']), {code:'22023'});
      await assert.rejects(db.query(`INSERT INTO public.kehadiran_peserta(perhimpunan_id,nama_pegawai,bahagian_unit,token_pasport)
        VALUES ($1,'FORGED','Unit','PAS-00000001')`,[seedId]), {code:'42501'});
    });
  } finally { await db.close(); }
});

test('ordinary accounts cannot enroll, read attendees, create events or insert agendas', async () => {
  const db = await database();
  try {
    await upgrade(db);
    await asRole(db,'authenticated',member, async () => {
      assert.equal((await db.query('SELECT public.is_admin() AS allowed')).rows[0].allowed,false);
      assert.equal((await db.query('SELECT * FROM public.admin_users')).rows.length,0);
      assert.equal((await db.query('SELECT * FROM public.kehadiran_peserta')).rows.length,0);
      await assert.rejects(db.query('INSERT INTO public.admin_users(user_id) VALUES ($1)',[member]),{code:'42501'});
      await assert.rejects(db.query('SELECT public.set_active_event($1)',[seedId]),{code:'42501'});
      await assert.rejects(db.query("SELECT public.create_event('Test',null,current_date,'08:30','Hall','TEST-DENIED')"),{code:'42501'});
      await assert.rejects(db.query("INSERT INTO public.atur_cara(perhimpunan_id,masa_mula,tajuk_agenda) VALUES ($1,'08:00','Test')",[seedId]),{code:'42501'});
    });
    await asRole(db,'anon',null, async () => {
      await assert.rejects(db.query('SELECT public.set_active_event($1)',[seedId]),{code:'42501'});
    });
    await asRole(db,'authenticated',admin, async () => {
      assert.equal((await db.query('SELECT public.is_admin() AS allowed')).rows[0].allowed,true);
      assert.equal((await db.query('SELECT * FROM public.admin_users')).rows.length,1);
      await db.query("INSERT INTO public.atur_cara(perhimpunan_id,masa_mula,tajuk_agenda) VALUES ($1,'11:00','Admin agenda')",[seedId]);
      await assert.rejects(db.query('UPDATE public.perhimpunan SET status_aktif=false'),{code:'42501'});
    });
    await db.query('DELETE FROM public.admin_users WHERE user_id=$1',[admin]);
    await asRole(db,'authenticated',admin, async () => {
      assert.equal((await db.query('SELECT public.is_admin() AS allowed')).rows[0].allowed,false);
      await assert.rejects(db.query('SELECT public.set_active_event($1)',[seedId]),{code:'42501'});
    });
  } finally { await db.close(); }
});

test('activation, closing, invalid targets and failed creation preserve the session invariant', async () => {
  const db = await database();
  try {
    await upgrade(db);
    await asRole(db,'authenticated',admin, async () => {
      const { rows } = await db.query("SELECT public.create_event('New event',null,current_date,'08:30','Hall','TEST-NEW') AS event");
      const id = rows[0].event.id;
      assert.equal((await db.query('SELECT id FROM public.perhimpunan WHERE status_aktif')).rows[0].id,id);
      await assert.rejects(db.query('SELECT public.set_active_event($1)',['ffffffff-ffff-4fff-8fff-ffffffffffff']),{code:'P0002'});
      await assert.rejects(db.query("SELECT public.create_event('Duplicate',null,current_date,'08:30','Hall','TEST-NEW')"),{code:'23505'});
      assert.equal((await db.query('SELECT id FROM public.perhimpunan WHERE status_aktif')).rows[0].id,id);
      await db.query('SELECT public.set_active_event(null)');
      assert.equal((await db.query('SELECT id FROM public.perhimpunan WHERE status_aktif')).rows.length,0);
      await db.query('SELECT public.set_active_event($1)',[seedId]);
      assert.equal((await db.query('SELECT id FROM public.perhimpunan WHERE status_aktif')).rows.length,1);
    });
    await asRole(db,'anon',null, async () => {
      await assert.rejects(db.query("SELECT public.register_attendance('TEST-NEW','Officer','Unit')"),{code:'P0001'});
    });
    await assert.rejects(db.query(`INSERT INTO public.perhimpunan(tajuk,tarikh,masa_mula,lokasi,kod_sesi,status_aktif)
      VALUES ('Invalid',current_date,'08:30','Hall','TEST-SECOND',true)`),{code:'23505'});
  } finally { await db.close(); }
});

test('upgrade is repeatable and preserves the latest active event without deleting attendance', async () => {
  const db = await database();
  try {
    const newer = '00000000-0000-4000-8000-000000000099';
    await db.query(`INSERT INTO public.perhimpunan(id,tajuk,tarikh,masa_mula,lokasi,kod_sesi,status_aktif,dicipta_pada)
      VALUES ($1,'Newer',current_date,'08:00','Hall','TEST-LATEST',true,'2100-01-01')`,[newer]);
    await upgrade(db);
    await db.exec(await readFile(migrationPath,'utf8'));
    assert.equal((await db.query('SELECT id FROM public.perhimpunan WHERE status_aktif')).rows[0].id,newer);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.perhimpunan')).rows[0].n,2);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.atur_cara')).rows[0].n,6);
  } finally { await db.close(); }
});

test('unknown policies and normalized duplicate names abort the migration without losing data', async () => {
  for (const fixture of ['policy','names']) {
    const db = await database();
    try {
      if (fixture === 'policy') await db.exec('CREATE POLICY surprise ON public.kehadiran_peserta FOR SELECT USING (true)');
      else await db.query(`INSERT INTO public.kehadiran_peserta(perhimpunan_id,nama_pegawai,bahagian_unit,token_pasport)
        VALUES ($1,'Ali','Unit','PAS-11111111'),($1,' ALI ','Unit','PAS-22222222')`,[seedId]);
      await assert.rejects(db.exec(await readFile(migrationPath,'utf8')));
      await db.exec('ROLLBACK');
      assert.equal((await db.query('SELECT count(*)::int AS n FROM public.kehadiran_peserta')).rows[0].n,fixture === 'names' ? 2 : 0);
    } finally { await db.close(); }
  }
});

test('historical schema and rollback-only integration SQL are repeatable', async () => {
  const db = await database(true);
  try {
    const schema = await readFile(new URL('../fixtures/historical-schema.sql',import.meta.url),'utf8');
    await db.exec(schema);
    await db.exec(schema);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.atur_cara')).rows[0].n,6);
    for (const name of ['access-control.sql','session-transitions.sql']) {
      await db.exec(await readFile(new URL(`../fixtures/historical-${name}`,import.meta.url),'utf8'));
    }
    await db.exec('UPDATE public.perhimpunan SET status_aktif=false');
    await db.exec(schema);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.perhimpunan WHERE status_aktif')).rows[0].n,0);
  } finally { await db.close(); }
});
