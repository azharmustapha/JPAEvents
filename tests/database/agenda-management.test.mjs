import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const admin = '00000000-0000-4000-8000-000000000001';
const member = '00000000-0000-4000-8000-000000000002';
const migration = new URL('../../supabase/migrations/202610130002_agenda_management.sql', import.meta.url);

async function database(clean) {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;`);
  if (clean) {
    const schema = await readFile(new URL('../fixtures/historical-schema.sql', import.meta.url), 'utf8');
    await db.exec(schema);
    await db.exec(schema);
  } else {
    await db.exec(await readFile(new URL('../fixtures/legacy-schema.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../../supabase/migrations/202610070001_security_and_sessions.sql', import.meta.url), 'utf8'));
    const sql = await readFile(migration, 'utf8');
    await db.exec(sql);
    await db.exec(sql);
  }
  await db.query('INSERT INTO auth.users(id) VALUES ($1),($2)', [admin, member]);
  await db.query('INSERT INTO public.admin_users(user_id) VALUES ($1)', [admin]);
  return db;
}

async function asRole(db, role, subject, work) {
  await db.exec(`SET ROLE ${role}`);
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [subject || '']);
  try { return await work(); }
  finally { await db.exec('RESET ROLE'); }
}

for (const clean of [false, true]) {
  test(`${clean ? 'historical schema' : 'agenda migration'} allows admin editing and deleting while protecting agenda from other users`, async () => {
    const db = await database(clean);
    try {
      const original = (await db.query('SELECT * FROM public.atur_cara ORDER BY turutan LIMIT 1')).rows[0];
      await asRole(db, 'authenticated', admin, async () => {
        const updated = await db.query(`UPDATE public.atur_cara SET tajuk_agenda='Edited', masa_mula='14:00', masa_tamat='14:30', keterangan='Updated', turutan=9
          WHERE id=$1 AND perhimpunan_id=$2 RETURNING *`, [original.id, original.perhimpunan_id]);
        assert.equal(updated.rows[0].tajuk_agenda, 'Edited');
        assert.equal(updated.rows[0].masa_mula, '14:00');
        assert.equal(updated.rows[0].turutan, 9);
        assert.equal(updated.rows[0].status_selesai, original.status_selesai);
      });
      await asRole(db, 'authenticated', member, async () => {
        assert.equal((await db.query("UPDATE public.atur_cara SET tajuk_agenda='Forged' WHERE id=$1 RETURNING id", [original.id])).rows.length, 0);
        assert.equal((await db.query('DELETE FROM public.atur_cara WHERE id=$1 RETURNING id', [original.id])).rows.length, 0);
      });
      await asRole(db, 'anon', null, async () => {
        assert.equal((await db.query('SELECT tajuk_agenda FROM public.atur_cara WHERE id=$1', [original.id])).rows[0].tajuk_agenda, 'Edited');
        await assert.rejects(db.query("UPDATE public.atur_cara SET tajuk_agenda='Forged' WHERE id=$1", [original.id]), { code: '42501' });
        await assert.rejects(db.query('DELETE FROM public.atur_cara WHERE id=$1', [original.id]), { code: '42501' });
      });
      await asRole(db, 'authenticated', admin, async () => {
        assert.equal((await db.query('DELETE FROM public.atur_cara WHERE id=$1 AND perhimpunan_id=$2 RETURNING id', [original.id, 'ffffffff-ffff-4fff-8fff-ffffffffffff'])).rows.length, 0);
        assert.equal((await db.query('DELETE FROM public.atur_cara WHERE id=$1 AND perhimpunan_id=$2 RETURNING id', [original.id, original.perhimpunan_id])).rows[0].id, original.id);
      });
      assert.equal((await db.query('SELECT * FROM public.atur_cara WHERE id=$1', [original.id])).rows.length, 0);
    } finally { await db.close(); }
  });

  test(`${clean ? 'historical schema' : 'optional-time migration'} saves main activities with null start and end times`, async () => {
    const db = await database(clean);
    try {
      if (!clean) {
        const sql = await readFile(new URL('../../supabase/migrations/202610130003_optional_agenda_start.sql', import.meta.url), 'utf8');
        await db.exec(sql);
        await db.exec(sql);
      }
      const event = (await db.query('SELECT id FROM public.perhimpunan LIMIT 1')).rows[0];
      await asRole(db, 'authenticated', admin, async () => {
        const { rows } = await db.query(`INSERT INTO public.atur_cara(perhimpunan_id, tajuk_agenda, masa_mula, masa_tamat, turutan)
          VALUES ($1, 'Kuiz Kahoot', null, null, 20) RETURNING *`, [event.id]);
        assert.equal(rows[0].masa_mula, null);
        assert.equal(rows[0].masa_tamat, null);
        assert.equal(rows[0].tajuk_agenda, 'Kuiz Kahoot');
      });
      await asRole(db, 'authenticated', member, async () => {
        await assert.rejects(db.query(`INSERT INTO public.atur_cara(perhimpunan_id, tajuk_agenda, masa_mula, turutan)
          VALUES ($1, 'Forged', null, 21)`, [event.id]), { code: '42501' });
      });
    } finally { await db.close(); }
  });
}
