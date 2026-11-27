import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveOrganizerEvent, organizerHref, organizerColors } from '../../lib/organizer-navigation.ts';
const events = [{ id: 'one', status_aktif: false }, { id: 'two', status_aktif: true }];

test('explicit selection wins; an unknown explicit ID never selects a different event', () => {
  assert.equal(resolveOrganizerEvent(events, 'one', 'two')?.id, 'one');
  assert.equal(resolveOrganizerEvent(events, 'foreign', 'two'), null);
  assert.equal(resolveOrganizerEvent([], null, null), null);
});
test('retains previous selection and defaults to the open event', () => {
  assert.equal(resolveOrganizerEvent(events, null, 'one')?.id, 'one');
  assert.equal(resolveOrganizerEvent(events, null, null)?.id, 'two');
});
test('event links preserve encoded selection and do not invent an event', () => {
  assert.equal(organizerHref('/admin/tentatif', 'one'), '/admin/tentatif?event=one');
  assert.equal(organizerHref('/admin', 'a&b'), '/admin?event=a%26b');
  assert.equal(organizerHref('/admin/imbas', null), '/admin');
});
test('invalid colors use defaults and foregrounds remain readable at extremes', () => {
  assert.deepEqual(organizerColors({ primary_color: 'red;display:none', accent_color: null }), { primary: '#003053', accent: '#087f8c', foreground: '#ffffff' });
  assert.equal(organizerColors({ primary_color: '#ffffff' }).foreground, '#000000');
  assert.equal(organizerColors({ primary_color: '#000000' }).foreground, '#ffffff');
});
