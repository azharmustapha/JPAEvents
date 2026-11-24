import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { loadPublishedSnapshot } from '../../lib/public-event-data.ts';
test('projector refresh observes event closure and hides unpublished details and QR context', async () => {
  let published = true, open = true;
  const client = createClient('https://test.supabase.co', 'public-test-key', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async input => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/rpc/get_attendance_count')) return Response.json(8);
    assert.equal(url.searchParams.get('id'), 'eq.event-id');
    assert.equal(url.searchParams.get('published'), 'eq.true');
    return Response.json(published ? [{ id: 'event-id', published, status_aktif: open }] : []);
  } } });
  assert.equal((await loadPublishedSnapshot(client, 'event-id')).event.status_aktif, true);
  open = false;
  assert.equal((await loadPublishedSnapshot(client, 'event-id')).event.status_aktif, false);
  published = false;
  assert.deepEqual(await loadPublishedSnapshot(client, 'event-id'), { event: null, count: 0 });
});
