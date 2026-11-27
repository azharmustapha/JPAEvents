import test from 'node:test';
import assert from 'node:assert/strict';
import { filterEventCatalog } from '../../lib/event-catalog.ts';

const events = [
  { id: 'a', tajuk: 'Majlis Aspirasi', organizer_name: 'JPA', kod_sesi: 'ASP-01', lokasi: 'Putrajaya', published: true, status_aktif: true },
  { id: 'b', tajuk: 'Bengkel Seni', organizer_name: 'Studio Kreatif', kod_sesi: 'SENI', lokasi: 'Kuala Lumpur', published: true, status_aktif: false },
  { id: 'c', tajuk: 'Hari Keluarga', kod_sesi: 'FAM', lokasi: 'Taman', published: false, status_aktif: false },
];
test('event catalog searches title, organizer, location and code without case or surrounding-space sensitivity', () => {
  for (const query of [' aspirasi ', 'jPa', 'putrajaya', 'asp-01']) assert.deepEqual(filterEventCatalog(events, query, 'all').map(e => e.id), ['a']);
  assert.deepEqual(filterEventCatalog(events, '', 'all'), events);
  assert.deepEqual(filterEventCatalog(events, 'missing', 'all'), []);
});
test('event catalog combines status filters and search while preserving event order', () => {
  assert.deepEqual(filterEventCatalog(events, '', 'published').map(e => e.id), ['a', 'b']);
  assert.deepEqual(filterEventCatalog(events, '', 'draft').map(e => e.id), ['c']);
  assert.deepEqual(filterEventCatalog(events, '', 'open').map(e => e.id), ['a']);
  assert.deepEqual(filterEventCatalog(events, 'seni', 'draft'), []);
  assert.deepEqual(filterEventCatalog([], '', 'all'), []);
});
