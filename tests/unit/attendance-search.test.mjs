import test from 'node:test';
import assert from 'node:assert/strict';
import * as attendance from '../../lib/attendance.ts';

const rows = [
  { id: 'a', nama_pegawai: 'NUR AIN', bahagian_unit: 'Sumber Manusia', emel: 'ain@example.com', no_pasport: 42 },
  { id: 'b', nama_pegawai: 'AZHAR ALI', bahagian_unit: 'Teknologi Maklumat', emel: null, no_pasport: 143 },
  { id: 'c', nama_pegawai: 'SITI', bahagian_unit: 'Kewangan' },
];

test('attendance search finds names, divisions, emails and passport numbers regardless of case', () => {
  assert.equal(typeof attendance.filterAttendance, 'function');
  for (const [query, expected] of [[' nur ain ', ['a']], ['SUMBER', ['a']], ['AIN@EXAMPLE', ['a']], ['42', ['a']], ['143', ['b']], ['unknown', []]]) {
    assert.deepEqual(attendance.filterAttendance(rows, query).map(row => row.id), expected);
  }
});

test('blank attendance search restores all rows and tolerates missing optional fields', () => {
  assert.equal(typeof attendance.filterAttendance, 'function');
  assert.deepEqual(attendance.filterAttendance(rows, '  ').map(row => row.id), ['a', 'b', 'c']);
  assert.deepEqual(attendance.filterAttendance(rows, 'kewangan').map(row => row.id), ['c']);
  assert.deepEqual(attendance.filterAttendance([], 'ain'), []);
});
