import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const admin = '00000000-0000-4000-8000-000000000001';
const member = '00000000-0000-4000-8000-000000000002';
const drawId = '00000000-0000-4000-8000-000000000010';
const secondDraw = '00000000-0000-4000-8000-000000000011';

async function database(clean) {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;`);
  if (clean) {
    const schema = await readFile(new URL('../fixtures/historical-schema.sql', import.meta.url), 'utf8');
    await db.exec(schema);
    await db.exec(schema);
  } else {
    await db.exec(await readFile(new URL('../fixtures/legacy-schema.sql', import.meta.url), 'utf8'));
    const directory = new URL('../../supabase/migrations/', import.meta.url);
    const files = (await readdir(directory)).filter(file => file.startsWith('202610') && file.endsWith('.sql')).sort();
    for (const file of files) await db.exec(await readFile(new URL(file, directory), 'utf8'));
    await db.exec(await readFile(new URL(files.at(-1), directory), 'utf8'));
  }
  await db.query('INSERT INTO auth.users(id) VALUES ($1),($2)', [admin, member]);
  await db.query('INSERT INTO public.admin_users(user_id) VALUES ($1)', [admin]);
  const event = (await db.query('SELECT id FROM public.perhimpunan WHERE status_aktif')).rows[0].id;
  const excluded = [];
  for (let number = 1; number <= 5; number++) {
    const token = (await db.query(`SELECT public.register_attendance('SAMPLE-26',$1,'Unit A',$2,true) AS token`, [`RESERVED ${number}`, `reserved${number}@example.com`])).rows[0].token;
    excluded.push((await db.query('SELECT id FROM public.kehadiran_peserta WHERE token_pasport=$1', [token])).rows[0].id);
  }
  const token = (await db.query(`SELECT public.register_attendance('SAMPLE-26','WINNER','Unit A','winner@example.com',true) AS token`)).rows[0].token;
  const participant = (await db.query('SELECT id FROM public.kehadiran_peserta WHERE token_pasport=$1', [token])).rows[0].id;
  return { db, event, participant, excluded };
}

async function asRole(db, role, subject, work) {
  await db.exec(`SET ROLE ${role}`);
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [subject || '']);
  try { return await work(); }
  finally { await db.exec('RESET ROLE'); }
}

async function save(db, event, participant, id = drawId) {
  return (await db.query('SELECT public.save_cabutan_winner($1,$2,$3) AS winner', [id, event, participant])).rows[0].winner;
}

for (const clean of [false, true]) {
  const source = clean ? 'historical schema' : 'cabutan migration';

  test(`${source} rejects passports 1–5 through the RPC and accepts passport 6`, async () => {
    const { db, event, participant, excluded } = await database(clean);
    try {
      await asRole(db, 'authenticated', admin, async () => {
        for (const id of excluded) {
          await assert.rejects(save(db, event, id), { code: '22023', message: /1.*5/ });
        }
        assert.equal((await db.query('SELECT * FROM public.cabutan_pemenang')).rows.length, 0);
        assert.equal((await save(db, event, participant)).no_pasport, 6);
      });
    } finally { await db.close(); }
  });

  test(`${source} preserves historical excluded winners and idempotent retries on upgrade`, async () => {
    const { db, event, excluded } = await database(clean);
    try {
      await db.exec(await readFile(new URL('../../supabase/migrations/202610140001_cabutan_winners.sql', import.meta.url), 'utf8'));
      const winner = await asRole(db, 'authenticated', admin, () => save(db, event, excluded[0]));
      await db.exec(await readFile(new URL(clean ? '../fixtures/historical-schema.sql' : '../../supabase/migrations/202610170001_cabutan_exclude_passports.sql', import.meta.url), 'utf8'));
      await asRole(db, 'authenticated', admin, async () => {
        assert.deepEqual(await save(db, event, excluded[0]), winner);
        assert.equal((await db.query('SELECT * FROM public.cabutan_pemenang')).rows.length, 1);
        await assert.rejects(save(db, event, excluded[1], secondDraw), { code: '22023' });
      });
    } finally { await db.close(); }
  });

  test(`${source} preserves winner history and retrying a saved draw does not create another winner`, async () => {
    const { db, event, participant } = await database(clean);
    try {
      const winner = await asRole(db, 'authenticated', admin, () => save(db, event, participant));
      assert.equal(winner.nama_pegawai, 'WINNER');
      assert.equal(winner.no_pasport, 6);
      assert.equal(winner.bahagian_unit, 'Unit A');
      assert.equal(winner.peserta_id, participant);
      assert.equal(winner.perhimpunan_id, event);
      assert.ok(winner.dicipta_pada);
      // A new read represents reopening the page; saved names are snapshots.
      await db.query("UPDATE public.kehadiran_peserta SET nama_pegawai='RENAMED' WHERE id=$1", [participant]);
      await asRole(db, 'authenticated', admin, async () => {
        const history = (await db.query('SELECT * FROM public.cabutan_pemenang WHERE perhimpunan_id=$1', [event])).rows;
        assert.equal(history.length, 1);
        assert.equal(history[0].nama_pegawai, 'WINNER');
        assert.deepEqual(await save(db, event, participant), winner);
        await assert.rejects(save(db, event, participant, secondDraw), { code: '23505' });
      });
      // Applying the matching schema/migration again must retain saved winners.
      await db.exec(await readFile(new URL(clean ? '../fixtures/historical-schema.sql' : '../../supabase/migrations/202610170001_cabutan_exclude_passports.sql', import.meta.url), 'utf8'));
      assert.equal((await db.query('SELECT nama_pegawai FROM public.cabutan_pemenang')).rows[0].nama_pegawai, 'WINNER');
    } finally { await db.close(); }
  });

  test(`${source} restricts winner records and saving to approved administrators`, async () => {
    const { db, event, participant } = await database(clean);
    try {
      await asRole(db, 'authenticated', admin, async () => {
        await save(db, event, participant);
        await assert.rejects(db.query("UPDATE public.cabutan_pemenang SET nama_pegawai='FORGED'"), { code: '42501' });
        await assert.rejects(db.query('DELETE FROM public.cabutan_pemenang'), { code: '42501' });
        await assert.rejects(db.query(`INSERT INTO public.cabutan_pemenang(id,perhimpunan_id,peserta_id,nama_pegawai,bahagian_unit,no_pasport)
          VALUES ($1,$2,$3,'FORGED','Unit',2)`, [secondDraw,event,participant]), { code: '42501' });
      });
      await asRole(db, 'authenticated', member, async () => {
        assert.equal((await db.query('SELECT * FROM public.cabutan_pemenang')).rows.length, 0);
        await assert.rejects(save(db, event, participant), { code: '42501' });
      });
      await asRole(db, 'anon', null, async () => {
        await assert.rejects(db.query('SELECT * FROM public.cabutan_pemenang'), { code: '42501' });
        await assert.rejects(save(db, event, participant), { code: '42501' });
      });
    } finally { await db.close(); }
  });

  test(`${source} rejects participants from another event and new draws after the event closes`, async () => {
    const { db, event, participant } = await database(clean);
    try {
      const otherEvent = (await db.query(`INSERT INTO public.perhimpunan(tajuk,tarikh,masa_mula,lokasi,kod_sesi,status_aktif)
        VALUES ('Other',current_date,'08:30','Hall','OTHER',false) RETURNING id`)).rows[0].id;
      await asRole(db, 'authenticated', admin, async () => {
        await assert.rejects(save(db, event, 'ffffffff-ffff-4fff-8fff-ffffffffffff'), { code: '22023' });
        await assert.rejects(save(db, event, participant, null), { code: '22023' });
        await save(db, event, participant);
        await assert.rejects(save(db, otherEvent, participant), { code: '22023' });
      });
      await db.exec('UPDATE public.perhimpunan SET status_aktif=false');
      await db.query('UPDATE public.perhimpunan SET status_aktif=true WHERE id=$1', [otherEvent]);
      await asRole(db, 'authenticated', admin, async () => {
        await assert.rejects(save(db, otherEvent, participant, secondDraw), { code: '22023' });
        await assert.rejects(save(db, event, participant, secondDraw), { code: 'P0001' });
        assert.equal((await save(db, event, participant)).id, drawId);
        assert.equal((await db.query('SELECT * FROM public.cabutan_pemenang WHERE perhimpunan_id=$1', [otherEvent])).rows.length, 0);
      });
    } finally { await db.close(); }
  });
}
