import test from 'node:test';
import assert from 'node:assert/strict';

import * as cabutan from '../../lib/cabutan.ts';
const { createDrawId } = cabutan;

test('draw pool excludes passports 1–5, invalid numbers and previous winners', () => {
  const participants = [1, 2, 3, 4, 5, 6, 7, 1200, undefined, 0, -1, 6.5, NaN, Infinity]
    .map((no_pasport, index) => ({ id: String(index), no_pasport }));
  assert.deepEqual(cabutan.getEligibleDrawParticipants(participants, [{ peserta_id: '6' }], 5), [participants[5], participants[7]]);
});

test('draw pool is empty when only excluded passports or previous winners remain', () => {
  assert.deepEqual(cabutan.getEligibleDrawParticipants([{ id: 'a', no_pasport: 5 }, { id: 'b', no_pasport: 6 }], [{ peserta_id: 'b' }], 5), []);
  assert.deepEqual(cabutan.getEligibleDrawParticipants([], []), []);
});

test('draw IDs remain valid UUIDs when randomUUID is unavailable on HTTP', () => {
  const randomSource = { getRandomValues: bytes => {
    bytes.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    return bytes;
  } };
  assert.equal(createDrawId(randomSource), '00010203-0405-4607-8809-0a0b0c0d0e0f');
});

test('different draws receive independent IDs', () => {
  const ids = Array.from({ length: 100 }, () => createDrawId());
  assert.equal(new Set(ids).size, 100);
  for (const id of ids) assert.match(id, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
});

test('default draw includes the first participant',()=>{assert.deepEqual(cabutan.getEligibleDrawParticipants([{id:'first',no_pasport:1}],[]),[{id:'first',no_pasport:1}]);});
