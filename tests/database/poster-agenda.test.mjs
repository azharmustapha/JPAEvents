import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { groupAgenda, getCurrentAgendaId } from '../../lib/agenda.ts';

const eventId = '00000000-0000-4000-8000-000000000088';
const importFile = new URL('../fixtures/historical-agenda-import.sql', import.meta.url);

for (const timeType of ['time', 'text']) {
test(`latest poster import with ${timeType} columns preserves IDs, backs up superseded activities, and is safe to rerun`, async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE TABLE perhimpunan(id uuid PRIMARY KEY, kod_sesi text, tarikh date);
      CREATE TABLE atur_cara(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), perhimpunan_id uuid REFERENCES perhimpunan(id),
        masa_mula ${timeType} NOT NULL, masa_tamat ${timeType}, tajuk_agenda text, turutan integer, status_selesai boolean DEFAULT false, keterangan text);
      INSERT INTO perhimpunan VALUES ('${eventId}', 'SAMPLE2026', '2026-10-19'), ('00000000-0000-4000-8000-000000000099', 'OTHER', '2026-10-19');
      INSERT INTO atur_cara(id,perhimpunan_id,masa_mula,tajuk_agenda,turutan) VALUES
        ('00000000-0000-4000-8000-000000000010','${eventId}','08:00','Workshop activity 1',1),
        ('00000000-0000-4000-8000-000000000011','${eventId}','08:10','Workshop activity 3',2),
        ('00000000-0000-4000-8000-000000000012','${eventId}','11:00','Retired closing',5),
        ('00000000-0000-4000-8000-000000000013','00000000-0000-4000-8000-000000000099','08:00','Other event',1),
        ('00000000-0000-4000-8000-000000000014','${eventId}','08:15','Retired workshop',3),
        ('00000000-0000-4000-8000-000000000015','${eventId}','09:20','Previous activity 8',9),
        ('00000000-0000-4000-8000-000000000016','${eventId}','09:20','Previous activity 23',23);
      UPDATE atur_cara SET status_selesai=true, keterangan='Keep details' WHERE id='00000000-0000-4000-8000-000000000010';`);
    const sql = await readFile(importFile, 'utf8');
    await db.exec(sql);
    const first = (await db.query('SELECT * FROM atur_cara WHERE perhimpunan_id=$1 ORDER BY turutan', [eventId])).rows;
    await db.exec(sql);
    const second = (await db.query('SELECT * FROM atur_cara WHERE perhimpunan_id=$1 ORDER BY turutan', [eventId])).rows;
    assert.deepEqual(second, first);
    assert.equal(first.length, 23);
    assert.deepEqual(first.map(item => item.turutan), Array.from({length:23}, (_, i) => i + 1));
    assert.equal(first[0].id, '00000000-0000-4000-8000-000000000010');
    assert.equal(first[0].status_selesai, true);
    assert.equal(first[0].keterangan, 'Keep details');
    assert.equal(first[2].id, '00000000-0000-4000-8000-000000000011');
    assert.equal(first[7].id, '00000000-0000-4000-8000-000000000015');
    assert.equal(first[7].tajuk_agenda, 'Workshop activity 8');
    assert.equal(first[22].id, '00000000-0000-4000-8000-000000000016');
    assert.equal(first[2].masa_mula, null);
    assert.equal(first[11].tajuk_agenda, 'Workshop activity 12');
    assert.equal(first[12].tajuk_agenda, 'Workshop activity 13');
    assert.equal(first[14].tajuk_agenda, 'Workshop activity 15');
    assert.equal(first[19].tajuk_agenda, 'Workshop activity 20');
    assert.equal(first[22].tajuk_agenda, 'Workshop activity 23');
    assert.ok(first.every(item => item.masa_tamat === null));
    assert.deepEqual(groupAgenda(first).map(group => [group.masa_mula, group.items.length]), [
      ['08:00:00', 1], ['08:10:00', 2], ['08:15:00', 1], ['08:25:00', 1], ['08:35:00', 1],
      ['08:45:00', 3], ['09:00:00', 1], ['09:05:00', 1], ['09:15:00', 1], ['09:20:00', 1],
      ['09:25:00', 1], ['09:30:00', 7], ['10:00:00', 1], ['10:15:00', 1],
    ]);
    assert.equal(getCurrentAgendaId(first, '2026-10-19', Date.parse('2026-10-19T09:59:59+08:00')), first[14].id);
    assert.equal(getCurrentAgendaId(first, '2026-10-19', Date.parse('2026-10-19T10:00:00+08:00')), first[21].id);
    assert.equal(getCurrentAgendaId(first, '2026-10-19', Date.parse('2026-10-19T10:15:00+08:00')), first[22].id);
    const backup = (await db.query('SELECT agenda FROM public.atur_cara_import_backups WHERE perhimpunan_id=$1', [eventId])).rows[0].agenda;
    assert.equal(backup.length, 6);
    assert.ok(backup.some(item => item.tajuk_agenda === 'Retired workshop'));
    assert.ok(backup.some(item => item.tajuk_agenda === 'Retired closing'));
    await db.exec('SET ROLE anon');
    await assert.rejects(db.query('SELECT * FROM public.atur_cara_import_backups'), {code:'42501'});
    await db.exec('RESET ROLE');
    assert.equal((await db.query('SELECT tajuk_agenda FROM atur_cara WHERE id=$1', ['00000000-0000-4000-8000-000000000013'])).rows[0].tajuk_agenda, 'Other event');
  } finally { await db.close(); }
});
}

test('poster import refuses a mismatched session without changing its agenda', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE perhimpunan(id uuid, kod_sesi text, tarikh date);
      CREATE TABLE atur_cara(id uuid, perhimpunan_id uuid, masa_mula text NOT NULL, masa_tamat text, tajuk_agenda text, turutan integer);
      INSERT INTO perhimpunan VALUES ('${eventId}', 'WRONG', '2026-10-15');`);
    const sql = await readFile(importFile, 'utf8');
    await assert.rejects(db.exec(sql), /SAMPLE2026/);
    await db.exec('ROLLBACK');
    assert.equal((await db.query('SELECT count(*)::int AS total FROM atur_cara')).rows[0].total, 0);
  } finally { await db.close(); }
});
