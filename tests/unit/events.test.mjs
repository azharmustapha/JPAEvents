import test from 'node:test';
import assert from 'node:assert/strict';
import { eventPath, parseScannedPassport, validateEventSettings, validateImageUpload, contrastText } from '../../lib/events.ts';
import { normalizeRegistration } from '../../lib/attendance.ts';

test('public links keep the event slug and encode path segments', () => {
  assert.equal(eventPath('my-event', 'daftar'), '/events/my-event/daftar');
  assert.equal(eventPath('a/b'), '/events/a%2Fb');
});
test('scanner accepts tokens and same-origin pass URLs only', () => {
  const token = 'PAS-12345678-1234-4234-8234-123456789abc';
  assert.equal(parseScannedPassport(token, 'https://events.example'), token);
  assert.equal(parseScannedPassport(`https://events.example/pasport/${token}`, 'https://events.example'), token);
  for (const value of [`https://evil.example/pasport/${token}`, 'javascript:alert(1)', 'bad']) assert.equal(parseScannedPassport(value, 'https://events.example'), null);
});
test('event settings reject invalid colors, slug, timezone and excluded-pass counts', () => {
  const base = { tajuk: 'An event', slug: 'my-event', kod_sesi: 'MY-EVENT', lokasi: 'Online', tarikh: '2026-11-24', masa_mula: '08:30', timezone: 'Asia/Kuala_Lumpur', primary_color: '#003053', accent_color: '#087f8c', draw_exclude_first: 0 };
  assert.doesNotThrow(() => validateEventSettings(base));
  for (const bad of [{ slug: '../admin' }, { primary_color: 'url(x)' }, { timezone: 'made/up' }, { draw_exclude_first: -1 }, { tarikh: '2026-02-31' }]) assert.throws(() => validateEventSettings({ ...base, ...bad }));
  assert.equal(contrastText('#ffffff'), '#000000');
  assert.equal(contrastText('#003053'), '#ffffff');
});
test('image uploads allow bounded raster images only', () => {
  assert.equal(validateImageUpload({ type: 'image/png', size: 100 }), 'png');
  assert.throws(() => validateImageUpload({ type: 'image/svg+xml', size: 10 }));
  assert.throws(() => validateImageUpload({ type: 'image/png', size: 5 * 1024 * 1024 + 1 }));
});
test('event registration permits optional organization and consent but enforces enabled settings', () => {
  assert.equal(normalizeRegistration('EVENT', 'Ali', '', 'ali@example.com', false, { require_organization: false, consent_text: null }).division, '');
  assert.throws(() => normalizeRegistration('EVENT', 'Ali', '', 'ali@example.com', true, { require_organization: true }), /organisasi/i);
  assert.throws(() => normalizeRegistration('EVENT', 'Ali', '', 'ali@example.com', false, { consent_text: 'I agree' }), /persetujuan/i);
});
