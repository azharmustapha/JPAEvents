import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { loadActiveAssembly, findRegistrationSession } from '../../lib/assembly.ts';
import { startPolling } from '../../lib/polling.ts';

const event = { id: '00000000-0000-4000-8000-000000000001', kod_sesi: 'NEW', status_aktif: true };
function clientFor({ available = true, failCount = false } = {}) {
  return createClient('https://test.supabase.co','public-test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/rpc/get_attendance_count')) {
        assert.equal(JSON.parse(init.body).event_id,event.id);
        return Response.json(failCount ? { message: 'unavailable', code: 'P0001' } : 12, { status: failCount ? 500 : 200 });
      }
      const code = url.searchParams.get('kod_sesi');
      const rows = available && (!code || code === 'eq.NEW') ? [event] : [];
      return Response.json(rows);
    } },
  });
}
test('missing registration code selects active event but explicit closed code does not', async () => {
  assert.equal(await findRegistrationSession(clientFor(),null),null);
  assert.equal((await findRegistrationSession(clientFor(),'NEW')).kod_sesi,'NEW');
  assert.equal(await findRegistrationSession(clientFor(),'OLD'),null);
  assert.equal(await findRegistrationSession(clientFor(),' '),null);
});
test('public snapshot uses aggregate count and handles a closed session', async () => {
  assert.deepEqual(await loadActiveAssembly(clientFor(),'NEW'),{ event, count: 12 });
  assert.deepEqual(await loadActiveAssembly(clientFor({available:false}),'NEW'),{event:null,count:0});
});
test('failed counts are errors rather than zero attendance', async () => {
  await assert.rejects(loadActiveAssembly(clientFor({failCount:true}),'NEW'));
});
test('polling cleanup prevents a late result from updating a departed page', async () => {
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  const received = [];
  const stop = startPolling(() => pending, result => received.push(result), () => received.push('error'));
  stop();
  resolve('old-session');
  await pending;
  await new Promise(done => setImmediate(done));
  assert.deepEqual(received,[]);
});
test('polling reports failures instead of successful snapshots', async () => {
  const received = [];
  const stop = startPolling(async () => { throw new Error('offline'); }, value => received.push(value), () => received.push('error'));
  await new Promise(done => setImmediate(done));
  stop();
  assert.deepEqual(received,['error']);
});
