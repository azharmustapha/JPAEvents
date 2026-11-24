import type { AturCara } from '../types/database';

function secondsSinceMidnight(time: string | null): number | null {
  if (!time) return null;
  const normalized = time.trim().replace(/^(\d{2})(\d{2})(\s*(?:AM|PM))?$/i, '$1:$2$3');
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(normalized);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || 0);
  const period = match[4]?.toUpperCase();
  if (minute > 59 || second > 59 || (period ? hour < 1 || hour > 12 : hour > 23)) return null;
  if (period) hour = hour % 12 + (period === 'PM' ? 12 : 0);
  return hour * 3600 + minute * 60 + second;
}

export interface AgendaGroup {
  id: string;
  masa_mula: string | null;
  items: AturCara[];
}

// A time starts a block; untimed activities follow it in their published order.
export function groupAgenda(agenda: AturCara[]): AgendaGroup[] {
  const groups: AgendaGroup[] = [];
  for (const item of [...agenda].sort((a, b) => a.turutan - b.turutan)) {
    const previous = groups.at(-1);
    const start = secondsSinceMidnight(item.masa_mula);
    const sharesTime = start !== null && previous && start === secondsSinceMidnight(previous.masa_mula);
    if (!previous || (item.masa_mula?.trim() && !sharesTime)) {
      groups.push({ id: item.id, masa_mula: item.masa_mula || null, items: [item] });
    } else {
      previous.items.push(item);
    }
  }
  return groups;
}

// Earlier agendas sometimes stored the other activities in keterangan.
// Suppress only a complete list already represented by separate main items.
export function getAgendaDescription(item: AturCara, groupItems: AturCara[]): string | null {
  if (!item.keterangan?.trim()) return null;
  const titles = new Set(groupItems.filter(other => other.id !== item.id).map(other => other.tajuk_agenda.trim()));
  const lines = item.keterangan.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return lines.every(line => titles.has(line)) ? null : item.keterangan;
}

// All agenda times belong to the assembly date in Malaysia (UTC+08:00).
export function getCurrentAgendaId(agenda: AturCara[], date: string | null, now: number | null): string | null {
  if (!date || now === null || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const midnight = Date.parse(`${date}T00:00:00+08:00`);
  const currentSecond = (now - midnight) / 1000;
  if (!Number.isFinite(currentSecond) || currentSecond < 0 || currentSecond >= 86400) return null;

  const schedule = groupAgenda(agenda).flatMap(group => {
    const start = secondsSinceMidnight(group.masa_mula);
    return start === null ? [] : [{ group, start }];
  }).sort((a, b) => a.start - b.start || a.group.items[0].turutan - b.group.items[0].turutan);

  const index = schedule.findLastIndex(entry => entry.start <= currentSecond);
  if (index < 0) return null;
  const { group, start } = schedule[index];
  if (group.items.every(item => item.status_selesai)) return null;
  const item = group.items[0];
  const end = item.masa_tamat ? secondsSinceMidnight(item.masa_tamat) : null;
  const stop = Math.min(end ?? 86400, schedule[index + 1]?.start ?? 86400);
  return stop > start && currentSecond < stop ? group.id : null;
}
