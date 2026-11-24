import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const seed = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
const numbering = new URL('../../supabase/migrations/202610070002_passport_numbers.sql', import.meta.url);
async function setup() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;`);
  await db.exec(await readFile(new URL('../fixtures/legacy-schema.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../../supabase/migrations/202610070001_security_and_sessions.sql', import.meta.url), 'utf8'));
  return db;
}

test('existing passports receive stable session numbers and upgrade is repeatable', async () => {
  const db = await setup();
  try {
    await db.query(`INSERT INTO public.kehadiran_peserta(perhimpunan_id,nama_pegawai,bahagian_unit,token_pasport,waktu_hadir)
      VALUES ($1,'LATE','Unit','PAS-22222222','2026-10-07T09:00:00Z'),
      ($1,'EARLY','Unit','PAS-11111111','2026-10-07T08:00:00Z')`, [seed]);
    await db.exec(await readFile(numbering, 'utf8'));
    await db.exec(await readFile(numbering, 'utf8'));
    const rows = (await db.query('SELECT token_pasport,no_pasport FROM public.kehadiran_peserta ORDER BY no_pasport')).rows;
    assert.deepEqual(rows.map(row => [row.token_pasport, Number(row.no_pasport)]), [['PAS-11111111',1],['PAS-22222222',2]]);
    assert.equal(Number((await db.query("SELECT public.get_passport('PAS-11111111') AS p")).rows[0].p.no_pasport),1);
    assert.equal((await db.query("SELECT public.get_passport('1') AS p")).rows[0].p,null);
    const token = (await db.query("SELECT public.register_attendance('SAMPLE-26','NEW','Unit') AS t")).rows[0].t;
    assert.equal(Number((await db.query('SELECT public.get_passport($1) AS p',[token])).rows[0].p.no_pasport),3);
  } finally { await db.close(); }
});

test('numbers increase per session, failed duplicates do not consume a number, and constraints reject collisions', async () => {
  const db = await setup();
  try {
    await db.exec(await readFile(numbering, 'utf8'));
    await db.exec('SET ROLE anon');
    await db.query("SELECT public.register_attendance('SAMPLE-26','ONE','Unit')");
    await assert.rejects(db.query("SELECT public.register_attendance('SAMPLE-26','one','Unit')"), {code:'23505'});
    await db.query("SELECT public.register_attendance('SAMPLE-26','TWO','Unit')");
    await db.exec('RESET ROLE');
    assert.deepEqual((await db.query('SELECT no_pasport FROM public.kehadiran_peserta ORDER BY no_pasport')).rows.map(r=>Number(r.no_pasport)),[1,2]);
    await assert.rejects(db.query("INSERT INTO public.kehadiran_peserta(perhimpunan_id,nama_pegawai,bahagian_unit,token_pasport,no_pasport) VALUES ($1,'BAD','Unit','PAS-33333333',2)",[seed]),{code:'23505'});
    await assert.rejects(db.query("INSERT INTO public.kehadiran_peserta(perhimpunan_id,nama_pegawai,bahagian_unit,token_pasport,no_pasport) VALUES ($1,'BAD','Unit','PAS-33333333',0)",[seed]),{code:'23514'});
    await db.query('DELETE FROM public.kehadiran_peserta WHERE no_pasport=2');
    await db.exec(await readFile(numbering, 'utf8'));
    const third=(await db.query("SELECT public.register_attendance('SAMPLE-26','THREE','Unit') AS t")).rows[0].t;
    assert.equal(Number((await db.query('SELECT public.get_passport($1) AS p',[third])).rows[0].p.no_pasport),3);
    await db.exec('UPDATE public.perhimpunan SET status_aktif=false');
    await db.query("INSERT INTO public.perhimpunan(tajuk,tarikh,masa_mula,lokasi,kod_sesi,status_aktif) VALUES ('Next',current_date,'08:30','Hall','NEXT',true)");
    const token=(await db.query("SELECT public.register_attendance('NEXT','ONE','Unit') AS t")).rows[0].t;
    assert.equal(Number((await db.query('SELECT public.get_passport($1) AS p',[token])).rows[0].p.no_pasport),1);
    await assert.rejects(db.query("SELECT public.register_attendance('SAMPLE-26','CLOSED','Unit')"), {code:'P0001'});
  } finally { await db.close(); }
});
