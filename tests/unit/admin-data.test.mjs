import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import * as adminData from '../../lib/admin-data.ts';
const { loadAttendance } = adminData;

function clientFor({ failSecond = false, insertBetweenPages = false } = {}) {
  const attendees = Array.from({ length: 1001 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${(index + 1).toString(16).padStart(12, '0')}`,
    nama_pegawai: `OFFICER ${index}`, waktu_hadir: new Date(index * 1000).toISOString(),
  }));
  let calls = 0;
  return createClient('https://test.supabase.co','public-test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async input => {
      const url = new URL(String(input));
      if (calls++ && failSecond) return Response.json({message:'offline'}, {status:500});
      if (calls === 2 && insertBetweenPages) attendees.push({
        id: '00000000-0000-4000-8000-000000000000', nama_pegawai: 'NEW OFFICER',
        waktu_hadir: new Date(2000000).toISOString(),
      });
      const ordered = [...attendees].sort((a,b) => url.searchParams.get('order') === 'id.asc'
        ? a.id.localeCompare(b.id) : b.waktu_hadir.localeCompare(a.waktu_hadir));
      const cursor = url.searchParams.get('id')?.replace(/^gt\./, '');
      const eligible = cursor ? ordered.filter(row => row.id > cursor) : ordered;
      const offset = Number(url.searchParams.get('offset') || 0);
      const limit = Number(url.searchParams.get('limit'));
      return Response.json(eligible.slice(offset,offset + limit));
    } },
  });
}
test('attendance reports include rows beyond the API default row limit', async () => {
  const rows = await loadAttendance(clientFor(),'event-id');
  assert.equal(rows.length,1001);
  assert.equal(rows[0].nama_pegawai,'OFFICER 1000');
});
test('a failed subsequent attendance page does not produce a partial successful report', async () => {
  await assert.rejects(loadAttendance(clientFor({failSecond:true}),'event-id'));
});
test('registration between page reads never duplicates a participant', async () => {
  const rows = await loadAttendance(clientFor({insertBetweenPages:true}),'event-id');
  assert.equal(new Set(rows.map(row => row.id)).size, rows.length);
  assert.equal(rows.filter(row => row.nama_pegawai.startsWith('OFFICER ')).length,1001);
});

test('saved winner history restores all names, excludes other events and keeps the latest draw first', async () => {
  const rows = Array.from({ length: 1001 }, (_, index) => ({
    id: String(index + 1).padStart(5, '0'), perhimpunan_id: 'event-id',
    peserta_id: `participant-${index}`, nama_pegawai: `WINNER ${index}`,
    bahagian_unit: 'Unit', no_pasport: index + 1,
    dicipta_pada: new Date(index * 1000).toISOString(),
  }));
  const client = createClient('https://test.supabase.co', 'public-test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async input => {
      const url = new URL(String(input));
      if (!url.pathname.endsWith('/cabutan_pemenang') || url.searchParams.get('perhimpunan_id') !== 'eq.event-id') {
        return Response.json({ message: 'Wrong history requested' }, { status: 400 });
      }
      const cursor = url.searchParams.get('id')?.replace(/^gt\./, '') || '';
      const limit = Number(url.searchParams.get('limit') || 1000);
      return Response.json(rows.filter(row => row.id > cursor).slice(0, limit));
    } },
  });
  assert.equal(typeof adminData.loadCabutanWinners, 'function', 'Saved winner history needs a loader');
  const winners = await adminData.loadCabutanWinners(client, 'event-id');
  assert.equal(winners.length, 1001);
  assert.equal(winners[0].nama_pegawai, 'WINNER 1000');
  assert.equal(winners.at(-1).nama_pegawai, 'WINNER 0');
  assert.equal(new Set(winners.map(winner => winner.peserta_id)).size, 1001);
});

test('a failed history load blocks drawing instead of presenting an empty winner list', async () => {
  const client = createClient('https://test.supabase.co', 'public-test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async () => Response.json({ message: 'offline' }, { status: 503 }) },
  });
  assert.equal(typeof adminData.loadCabutanWinners, 'function', 'Saved winner history needs a loader');
  await assert.rejects(adminData.loadCabutanWinners(client, 'event-id'));
});
