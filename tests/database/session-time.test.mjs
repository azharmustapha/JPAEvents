import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const admin = '00000000-0000-4000-8000-000000000001';
const seedId = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
const timeMigration = await readFile(new URL('../../supabase/migrations/202610130001_create_event_time_compatibility.sql', import.meta.url), 'utf8');

async function database(timeColumn = false, legacy = false) {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;`);
  await db.exec(await readFile(new URL(legacy ? '../fixtures/legacy-schema.sql' : '../fixtures/historical-schema.sql',import.meta.url),'utf8'));
  if (legacy) {
    await db.exec('GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated');
    await db.exec(await readFile(new URL('../../supabase/migrations/202610070001_security_and_sessions.sql', import.meta.url), 'utf8'));
  }
  if(timeColumn) await db.exec('ALTER TABLE public.perhimpunan ALTER COLUMN masa_mula TYPE time USING masa_mula::time');
  await db.query('INSERT INTO auth.users(id) VALUES ($1)',[admin]);
  await db.query('INSERT INTO public.admin_users(user_id) VALUES ($1)',[admin]);
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[admin]);
  await db.exec('SET ROLE authenticated');
  return db;
}

for(const timeColumn of [true,false]) {
  test(`session creation supports a ${timeColumn?'time':'text'} start-time column and preserves the image theme`,async()=>{
    const db=await database(timeColumn);
    try {
      const {rows}=await db.query('SELECT public.create_event($1,$2,$3,$4,$5,$6) AS event',[
        'Bengkel Komuniti','/sample.png','2026-10-19','08:00:00','Auditorium','COMMUNITY2026',
      ]);
      assert.equal(rows[0].event.masa_mula,'08:00:00');
      assert.equal(rows[0].event.tema,'/sample.png');
      assert.equal(rows[0].event.tarikh,'2026-10-19');
      assert.equal(rows[0].event.status_aktif,true);
      await db.exec('RESET ROLE');
      assert.equal((await db.query('SELECT count(*)::int AS n FROM public.perhimpunan WHERE status_aktif')).rows[0].n,1);
    } finally {await db.close();}
  });

  test(`time migration upgrades a ${timeColumn?'time':'text'} column without changing records, access, or rollback`, async () => {
    const db = await database(timeColumn, true);
    try {
      await db.exec('RESET ROLE');
      const snapshot = async () => (await db.query(`SELECT
        (SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.perhimpunan p) AS events,
        (SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.atur_cara a) AS agenda,
        (SELECT data_type FROM information_schema.columns
         WHERE table_schema='public' AND table_name='perhimpunan' AND column_name='masa_mula') AS time_type`)).rows;
      const before = await snapshot();
      await db.exec(timeMigration);
      await db.exec(timeMigration);
      assert.deepEqual(await snapshot(), before);

      await db.exec('SET ROLE anon');
      await assert.rejects(db.query("SELECT public.create_event('Test',null,current_date,'08:00','Hall','DENIED')"), { code: '42501' });
      await db.exec('SET ROLE authenticated');
      await db.query("SELECT set_config('request.jwt.claim.sub','',false)");
      await assert.rejects(db.query("SELECT public.create_event('Test',null,current_date,'08:00','Hall','DENIED')"), { code: '42501' });
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [admin]);
      await assert.rejects(db.query("SELECT public.create_event('Test',null,current_date,'25:00','Hall','INVALID')"), { code: '22023' });
      await assert.rejects(db.query("SELECT public.create_event('Test',null,current_date,'08:00','Hall','SAMPLE-26')"), { code: '23505' });
      assert.equal((await db.query('SELECT id FROM public.perhimpunan WHERE status_aktif')).rows[0].id, seedId);

      const { rows } = await db.query("SELECT public.create_event('Test','COMMUNITY','2026-10-19','08:30','Hall','NEW-SESSION') AS event");
      assert.equal(rows[0].event.masa_mula, '08:30:00');
      assert.equal(rows[0].event.tema, 'COMMUNITY');
      assert.deepEqual((await db.query('SELECT id FROM public.perhimpunan WHERE status_aktif')).rows, [{ id: rows[0].event.id }]);
    } finally { await db.close(); }
  });
}
