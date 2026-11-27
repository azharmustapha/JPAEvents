import test from 'node:test';
import assert from 'node:assert/strict';
import { projectorRegistrationState, projectorCount } from '../../lib/projector.ts';

test('projector never displays a registration QR before the snapshot is verified or during a disconnection', () => {
  assert.equal(projectorRegistrationState({ available: true, verified: false, connected: true, registrationOpen: true, hasUrl: true }), 'loading');
  assert.equal(projectorRegistrationState({ available: true, verified: true, connected: false, registrationOpen: true, hasUrl: true }), 'offline');
  assert.equal(projectorRegistrationState({ available: false, verified: true, connected: true, registrationOpen: true, hasUrl: true }), 'unavailable');
});
test('projector requires an open verified event and a usable registration URL', () => {
  const state = { available: true, verified: true, connected: true, registrationOpen: true, hasUrl: true };
  assert.equal(projectorRegistrationState(state), 'open');
  assert.equal(projectorRegistrationState({ ...state, registrationOpen: false }), 'closed');
  assert.equal(projectorRegistrationState({ ...state, hasUrl: false }), 'unavailable');
});
test('projector distinguishes unknown counts from a real zero and rejects invalid counts', () => {
  assert.equal(projectorCount(null), '—');
  assert.equal(projectorCount(0), '0');
  assert.equal(projectorCount(1250), '1,250');
  for (const value of [-1, NaN, Infinity, 1.5]) assert.equal(projectorCount(value), '—');
});
