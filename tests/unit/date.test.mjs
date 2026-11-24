import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDate, formatTime, toTimeInput } from '../../lib/date.ts';

test('formats calendar dates with padded days and Bahasa Malaysia month abbreviations', () => {
  const months = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
  for (let month = 1; month <= 12; month++) {
    assert.equal(formatDate(`2026-${String(month).padStart(2, '0')}-05`), `05/${months[month - 1]}/2026`);
  }
  assert.equal(formatDate('2028-02-29'), '29/Feb/2028');
});

test('uses the Malaysia calendar day for timestamps across midnight and year boundaries', () => {
  assert.equal(formatDate('2026-10-12T16:00:00Z'), '13/Okt/2026');
  assert.equal(formatDate('2026-12-31T16:00:00Z'), '01/Jan/2027');
  assert.equal(formatDate('2026-10-13T00:00:00+08:00'), '13/Okt/2026');
  assert.equal(formatDate(new Date('2026-10-12T15:59:59Z')), '12/Okt/2026');
});

test('missing and invalid dates show a placeholder instead of crashing or rolling into another month', () => {
  for (const value of [null, undefined, '', 'invalid', '2026-02-29', '2026-04-31', '2026-13-01', new Date('invalid')]) {
    assert.equal(formatDate(value), '—');
  }
});

test('time previews convert 24-hour, compact and AM/PM values, including noon and midnight', () => {
  for (const [value, expected] of [
    ['00:00:00', '12:00 AM'], ['08:30', '08:30 AM'], ['12:00', '12:00 PM'],
    ['14:05:59', '02:05 PM'], ['23:59', '11:59 PM'], ['0830', '08:30 AM'],
    [' 2:05 pm ', '02:05 PM'], ['12:00 am', '12:00 AM'], ['0930 AM', '09:30 AM'],
  ]) assert.equal(formatTime(value), expected);
  assert.equal(formatTime('14:05:59', true), '02:05:59 PM');
});

test('timestamp time previews use Malaysia time with explicit English AM/PM', () => {
  assert.equal(formatTime('2026-10-12T16:00:00Z'), '12:00 AM');
  assert.equal(formatTime('2026-10-13T04:05:06Z', true), '12:05:06 PM');
  assert.equal(formatTime(new Date('2026-10-13T15:59:59Z')), '11:59 PM');
});

test('missing or invalid time previews show a placeholder', () => {
  for (const value of [null, undefined, '', 'invalid', '24:00', '08:60', '08:30:60', '00:30 AM', '13:00 PM', new Date('invalid')]) {
    assert.equal(formatTime(value), '—');
  }
});

test('agenda editing converts stored 12-hour and compact times to native time input values', () => {
  for (const [value, expected] of [['2:05 PM', '14:05'], ['12:00 AM', '00:00'], ['12:00 PM', '12:00'], ['0830', '08:30'], ['08:30:00', '08:30'], [null, ''], ['invalid', '']]) {
    assert.equal(toTimeInput(value), expected);
  }
});

test('event timezone changes timestamp reports but preserves calendar-only event dates',()=>{assert.equal(formatDate('2026-11-24T02:00:00Z','America/New_York'),'23/Nov/2026');assert.equal(formatDate('2026-11-24','America/New_York'),'24/Nov/2026');assert.equal(formatTime('2026-11-24T02:00:00Z',false,'America/New_York'),'09:00 PM');});
