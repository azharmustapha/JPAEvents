import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const seed = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
const migration = new URL('../../supabase/migrations/202610080001_registration_email_and_pledge.sql', import.meta.url);
async function setup(clean = true) {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;`);
  if (clean) {
    await db.exec(await readFile(new URL('../fixtures/historical-schema.sql', import.meta.url), 'utf8'));
  } else {
    await db.exec(await readFile(new URL('../fixtures/legacy-schema.sql', import.meta.url), 'utf8'));
    for (const file of ['202610070001_security_and_sessions.sql', '202610070002_passport_numbers.sql']) {
      await db.exec(await readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8'));
    }
  }
  return db;
}

test('upgrade preserves legacy passports without inventing email or consent and is repeatable', async () => {
  const db = await setup(false);
  try {
    const token = (await db.query("SELECT public.register_attendance('SAMPLE-26','LEGACY','Unit') AS token")).rows[0].token;
    await db.exec(await readFile(migration, 'utf8'));
    await db.exec(await readFile(migration, 'utf8'));
    const legacy = (await db.query('SELECT * FROM public.kehadiran_peserta WHERE token_pasport=$1', [token])).rows[0];
    assert.equal(legacy.emel, null);
    assert.equal(legacy.akur_janji_pada, null);
    assert.equal(Number(legacy.no_pasport), 1);
    assert.equal((await db.query('SELECT public.get_passport($1) AS p', [token])).rows[0].p.nama_pegawai, 'LEGACY');
    await db.exec('SET ROLE anon');
    const next = (await db.query("SELECT public.register_attendance('SAMPLE-26','NEW','Unit','new@example.org',true) AS token")).rows[0].token;
    assert.equal(Number((await db.query('SELECT public.get_passport($1) AS p', [next])).rows[0].p.no_pasport), 2);
  } finally { await db.close(); }
});

test('public registration stores normalized email and database pledge time without exposing them on the passport', async () => {
  const db = await setup();
  try {
    await db.exec('SET ROLE anon');
    const token = (await db.query('SELECT public.register_attendance($1,$2,$3,$4,$5) AS token',
      [' sample-26 ', ' Ali ', ' Unit A ', ' Ali@Example.org ', true])).rows[0].token;
    const passport = (await db.query('SELECT public.get_passport($1) AS p', [token])).rows[0].p;
    assert.equal(passport.nama_pegawai, 'ALI');
    assert.equal(Number(passport.no_pasport), 1);
    assert.equal('emel' in passport, false);
    assert.equal('akur_janji_pada' in passport, false);
    await assert.rejects(db.query('SELECT emel FROM public.kehadiran_peserta'), { code: '42501' });
    await assert.rejects(db.query("SELECT public.register_attendance('SAMPLE-26','BYPASS','Unit')"), { code: '42883' });
    await db.exec('RESET ROLE');
    const row = (await db.query('SELECT * FROM public.kehadiran_peserta WHERE token_pasport=$1', [token])).rows[0];
    assert.equal(row.emel, 'ali@example.org');
    assert.equal(new Date(row.akur_janji_pada).getTime(), new Date(row.waktu_hadir).getTime());
    assert.ok(Date.now() - new Date(row.akur_janji_pada).getTime() < 10000);
    // Re-running the upgrade must preserve registration details and the counter.
    await db.exec(await readFile(migration, 'utf8'));
    assert.equal((await db.query('SELECT emel FROM public.kehadiran_peserta WHERE token_pasport=$1', [token])).rows[0].emel, 'ali@example.org');
  } finally { await db.close(); }
});

test('database rejects invalid email or unaccepted pledge without registering or consuming a number', async () => {
  const db = await setup();
  try {
    await db.exec('SET ROLE anon');
    for (const email of [null, '', ' ', 'ali', 'ali@team', 'ali @example.org', 'ali@-example.org', `${'a'.repeat(245)}@example.org`]) {
      await assert.rejects(db.query('SELECT public.register_attendance($1,$2,$3,$4,$5)',
        ['SAMPLE-26', 'INVALID', 'Unit', email, true]), { code: '22023' });
    }
    for (const accepted of [false, null]) {
      await assert.rejects(db.query('SELECT public.register_attendance($1,$2,$3,$4,$5)',
        ['SAMPLE-26', 'INVALID', 'Unit', 'ali@example.org', accepted]), { code: '22023' });
    }
    await db.exec('RESET ROLE');
    assert.equal((await db.query('SELECT count(*) AS n FROM public.kehadiran_peserta')).rows[0].n, 0);
    assert.equal(Number((await db.query('SELECT next_passport_number AS n FROM public.perhimpunan WHERE id=$1', [seed])).rows[0].n), 1);
  } finally { await db.close(); }
});

test('duplicate and closed-session registrations keep their existing error behavior', async () => {
  const db = await setup();
  try {
    await db.exec('SET ROLE authenticated');
    await db.query("SELECT public.register_attendance('SAMPLE-26','ALI','Unit','ali@example.org',true)");
    await assert.rejects(db.query("SELECT public.register_attendance('SAMPLE-26',' ali ','Unit','other@example.org',true)"), { code: '23505' });
    await db.exec('RESET ROLE; UPDATE public.perhimpunan SET status_aktif=false; SET ROLE anon;');
    await assert.rejects(db.query("SELECT public.register_attendance('SAMPLE-26','NEW','Unit','new@example.org',true)"), { code: 'P0001' });
    await db.exec('RESET ROLE');
    assert.equal(Number((await db.query('SELECT next_passport_number AS n FROM public.perhimpunan WHERE id=$1', [seed])).rows[0].n), 2);
  } finally { await db.close(); }
});
