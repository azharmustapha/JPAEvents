import test from 'node:test';
import assert from 'node:assert/strict';
import * as attendance from '../../lib/attendance.ts';
const { normalizeRegistration, isPassportToken } = attendance;

test('normalizes officer details without supplying token or timestamp', () => {
  assert.deepEqual(normalizeRegistration(' event-01 ', ' Ali ', ' Unit A ', ' Ali@example.com ', true), {
    session_code: 'EVENT-01', officer_name: 'ALI', division: 'Unit A',
    email_address: 'ali@example.com', pledge_accepted: true,
  });
});
test('rejects empty or oversized registration fields', () => {
  for (const args of [['X', ' ', 'A'], ['', 'Ali', 'A'], ['X', 'Ali', ''], ['X', 'a'.repeat(201), 'A'], ['x'.repeat(81), 'Ali', 'A'], ['X', 'Ali', 'a'.repeat(201)]]) {
    assert.throws(() => normalizeRegistration(...args, 'ali@example.com', true));
  }
});

test('rejects missing, malformed or oversized email addresses', () => {
  for (const email of ['', ' ', 'ali', 'ali@', '@example.com', 'ali @example.com', 'ali@jpa', 'ali@-example.com', `${'a'.repeat(245)}@example.com`]) {
    assert.throws(() => normalizeRegistration('EVENT-01', 'Ali', 'Unit A', email, true), /e-mel/i);
  }
});

test('requires explicit pledge acceptance before producing a registration payload', () => {
  for (const accepted of [false, undefined, null, 'true', 1]) {
    assert.throws(() => normalizeRegistration('EVENT-01', 'Ali', 'Unit A', 'ali@example.com', accepted), /akur janji/i);
  }
});
test('accepts legacy and full UUID passport tokens only', () => {
  assert.equal(isPassportToken('PAS-ABCDEF12'), true);
  assert.equal(isPassportToken('PAS-550e8400-e29b-41d4-a716-446655440000'), true);
  for (const token of ['', 'https://example.org', 'PAS-123', 'PAS-ABCDEF12-extra']) {
    assert.equal(isPassportToken(token), false);
  }
});

function stored(values) {
  const items = new Map(Object.entries(values));
  return {
    get length() { return items.size; },
    key: index => [...items.keys()][index] ?? null,
    getItem: key => items.get(key) ?? null,
    removeItem: key => items.delete(key),
  };
}

test('a missing passport removes only matching saved links, allowing registration again', () => {
  const storage = stored({
    jpaevents_pasport_OCT: 'PAS-11111111',
    jpaevents_pasport_OTHER: 'PAS-11111111',
    jpaevents_pasport_NOV: 'PAS-22222222',
    unrelated: 'PAS-11111111',
  });
  assert.equal(attendance.forgetMissingPassport(storage, 'PAS-11111111', { data: null, error: null }), true);
  assert.equal(storage.getItem('jpaevents_pasport_OCT'), null);
  assert.equal(storage.getItem('jpaevents_pasport_OTHER'), null);
  assert.equal(storage.getItem('jpaevents_pasport_NOV'), 'PAS-22222222');
  assert.equal(storage.getItem('unrelated'), 'PAS-11111111');
});

test('connection errors and found passports preserve saved links', () => {
  for (const response of [{ data: null, error: { code: 'NETWORK' } }, { data: { token_pasport: 'PAS-11111111' }, error: null }]) {
    const storage = stored({ jpaevents_pasport_OCT: 'PAS-11111111' });
    assert.equal(attendance.forgetMissingPassport(storage, 'PAS-11111111', response), false);
    assert.equal(storage.getItem('jpaevents_pasport_OCT'), 'PAS-11111111');
  }
});

test('an unavailable browser storage does not block the missing-passport screen', () => {
  const storage = { get length() { throw new Error('Storage unavailable'); } };
  assert.equal(attendance.forgetMissingPassport(storage, 'PAS-11111111', { data: null, error: null }), false);
});
