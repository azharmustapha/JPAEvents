import test from 'node:test';
import assert from 'node:assert/strict';
import * as agendaHelpers from '../../lib/agenda.ts';
const { getCurrentAgendaId } = agendaHelpers;

const date = '2026-10-15';
function agenda(id, start, end, order = 1, done = false) {
  return { id, perhimpunan_id: 'session', masa_mula: start, masa_tamat: end,
    tajuk_agenda: id, turutan: order, status_selesai: done };
}
const schedule = [agenda('arrival', '08:00', '08:30'), agenda('anthem', '08:30 AM', '08:45 AM', 2), agenda('prayer', '08:45:00', '09:00:00', 3)];
const at = time => Date.parse(`${date}T${time}+08:00`);

test('the dot switches from the first item to the 08:30 item exactly at its start', () => {
  assert.equal(getCurrentAgendaId(schedule, date, at('08:29:59')), 'arrival');
  assert.equal(getCurrentAgendaId(schedule, date, at('08:30:00')), 'anthem');
  assert.equal(getCurrentAgendaId(schedule, date, at('08:44:59')), 'anthem');
  assert.equal(getCurrentAgendaId(schedule, date, at('08:45:00')), 'prayer');
});

test('no dot blinks before the event, before the first item, or after the last end', () => {
  for (const now of [Date.parse('2026-10-14T08:30:00+08:00'), at('07:59:59'), at('09:00:00'), Date.parse('2026-10-16T08:30:00+08:00')]) {
    assert.equal(getCurrentAgendaId(schedule, date, now), null);
  }
});

test('Malaysia time is used even when the timestamp is supplied in UTC', () => {
  assert.equal(getCurrentAgendaId(schedule, date, Date.parse('2026-10-15T00:30:00Z')), 'anthem');
});

test('an item with no end stops at the next start and the final item stops at midnight', () => {
  const items = [agenda('first', '08:30', null), agenda('last', '09:00', null, 2)];
  assert.equal(getCurrentAgendaId(items, date, at('08:59:59')), 'first');
  assert.equal(getCurrentAgendaId(items, date, at('09:00:00')), 'last');
  assert.equal(getCurrentAgendaId(items, date, at('23:59:59')), 'last');
  assert.equal(getCurrentAgendaId(items, date, Date.parse('2026-10-16T00:00:00+08:00')), null);
});

test('gaps do not blink and overlapping times select only the most recently started item', () => {
  assert.equal(getCurrentAgendaId([agenda('first', '08:00', '08:15'), agenda('next', '08:30', '08:45', 2)], date, at('08:20:00')), null);
  assert.equal(getCurrentAgendaId([agenda('first', '08:00', '09:00'), agenda('next', '08:30', '08:45', 2)], date, at('08:30:00')), 'next');
});

test('completed items never blink or reactivate an older item', () => {
  const items = [agenda('first', '08:00', '09:00'), agenda('done', '08:30', '08:45', 2, true)];
  assert.equal(getCurrentAgendaId(items, date, at('08:30:00')), null);
});

test('12-hour, compact, and 24-hour times preserve morning, noon and midnight', () => {
  for (const [start, time] of [['0830 AM', '08:30:00'], ['8:30 am', '08:30:00'], ['12:00 AM', '00:00:00'], ['12:00 PM', '12:00:00'], ['1:30 PM', '13:30:00'], ['13:30:05', '13:30:05']]) {
    assert.equal(getCurrentAgendaId([agenda('item', start, null)], date, at(time)), 'item');
  }
});

test('schedule selection follows start times even when display order differs', () => {
  assert.equal(getCurrentAgendaId([...schedule].reverse(), date, at('08:30:00')), 'anthem');
});

test('empty schedules, missing dates and invalid times do not select an item', () => {
  assert.equal(getCurrentAgendaId([], date, at('08:30:00')), null);
  assert.equal(getCurrentAgendaId(schedule, null, at('08:30:00')), null);
  assert.equal(getCurrentAgendaId(schedule, 'invalid', at('08:30:00')), null);
  for (const time of ['25:00', '08:99', '00:30 AM', '13:00 PM', 'TBC', '']) {
    assert.equal(getCurrentAgendaId([agenda('invalid', time, null)], date, at('08:30:00')), null);
  }
});

test('untimed main activities stay separate and follow their timed group in display order', () => {
  assert.equal(typeof agendaHelpers.groupAgenda, 'function');
  const groups = agendaHelpers.groupAgenda([
    agenda('choir', null, null, 4),
    agenda('language', '08:15', null, 1),
    agenda('quiz', null, null, 2),
    agenda('arrivals', '09:20', null, 5),
    agenda('cheer', '', null, 3),
    agenda('anthem', null, null, 6),
  ]);
  assert.deepEqual(groups.map(group => [group.id, group.masa_mula, group.items.map(item => item.id)]), [
    ['language', '08:15', ['language', 'quiz', 'cheer', 'choir']],
    ['arrivals', '09:20', ['arrivals', 'anthem']],
  ]);
});

test('null start times do not crash the clock or invent an individual current activity', () => {
  const items = [agenda('language', '08:15', null, 1), agenda('quiz', null, null, 2),
    agenda('choir', null, null, 3), agenda('arrivals', '09:20', null, 4)];
  assert.equal(getCurrentAgendaId(items, date, at('08:40:00')), 'language');
  assert.equal(getCurrentAgendaId(items, date, at('09:20:00')), 'arrivals');
  assert.equal(getCurrentAgendaId([agenda('untimed', null, null)], date, at('09:00:00')), null);
});

test('a completed first activity does not end a group containing unfinished activities', () => {
  const items = [agenda('language', '08:15', null, 1, true), agenda('quiz', null, null, 2)];
  assert.equal(getCurrentAgendaId(items, date, at('08:30:00')), 'language');
  items[1].status_selesai = true;
  assert.equal(getCurrentAgendaId(items, date, at('08:30:00')), null);
});

test('leading untimed activities remain visible without inheriting a later time', () => {
  assert.equal(typeof agendaHelpers.groupAgenda, 'function');
  const groups = agendaHelpers.groupAgenda([agenda('intro', null, null, 1), agenda('start', '08:00', null, 2)]);
  assert.deepEqual(groups.map(group => [group.masa_mula, group.items.map(item => item.id)]), [
    [null, ['intro']], ['08:00', ['start']],
  ]);
});

test('consecutive activities with the same start share a block without dropping an activity', () => {
  assert.equal(typeof agendaHelpers.groupAgenda, 'function');
  const groups = agendaHelpers.groupAgenda([agenda('safety', '08:10', null, 1),
    agenda('bulletin', '08:10:00', null, 2), agenda('language', '08:15', null, 3)]);
  assert.deepEqual(groups.map(group => group.items.map(item => item.id)), [['safety', 'bulletin'], ['language']]);
  assert.equal(getCurrentAgendaId(groups.flatMap(group => group.items), date, at('08:12:00')), 'safety');
});

test('legacy descriptions listing only activities now present in the group do not display twice', () => {
  assert.equal(typeof agendaHelpers.getAgendaDescription, 'function');
  const language = { ...agenda('language', '08:15', null, 1), tajuk_agenda: 'Slot Kita dan Bahasa',
    keterangan: 'Kuiz Kahoot\r\nSlot Ceria Pagi\r\nPersembahan Koir JPA' };
  const items = [language, {...agenda('quiz', null, null, 2), tajuk_agenda:'Kuiz Kahoot'},
    {...agenda('cheer', null, null, 3), tajuk_agenda:'Slot Ceria Pagi'},
    {...agenda('choir', null, null, 4), tajuk_agenda:'Persembahan Koir JPA'}];
  assert.equal(agendaHelpers.getAgendaDescription(language, items), null);
  assert.equal(language.keterangan, 'Kuiz Kahoot\r\nSlot Ceria Pagi\r\nPersembahan Koir JPA');
  assert.equal(agendaHelpers.getAgendaDescription(language, [language]), language.keterangan);
  const notes = {...language, keterangan:'Kuiz Kahoot\nSediakan telefon bimbit.'};
  assert.equal(agendaHelpers.getAgendaDescription(notes, items), notes.keterangan);
});
