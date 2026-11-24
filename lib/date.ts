const dateFormatter = new Intl.DateTimeFormat('ms-MY', {
  day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur',
});

export function formatDate(value: string | Date | null | undefined, timezone = 'Asia/Kuala_Lumpur'): string {
  if (!value) return '—';
  const dateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = value instanceof Date ? value : new Date(dateOnly ? `${value}T12:00:00+08:00` : value);
  if (!Number.isFinite(date.getTime())) return '—';
  if (dateOnly && date.toISOString().slice(0, 10) !== value) return '—';
  const formatter = dateOnly || timezone === 'Asia/Kuala_Lumpur' ? dateFormatter : new Intl.DateTimeFormat('ms-MY', {day:'2-digit',month:'short',year:'numeric',timeZone:timezone});
  const parts = formatter.formatToParts(date);
  return ['day', 'month', 'year'].map(type => parts.find(part => part.type === type)?.value).join('/');
}

function parseClockTime(value: string): { hour: number; minute: number; second: number } | null {
  const normalized = value.trim().replace(/^(\d{2})(\d{2})(\s*(?:AM|PM))?$/i, '$1:$2$3');
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(normalized);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || 0);
  const period = match[4]?.toUpperCase();
  if (minute > 59 || second > 59 || (period ? hour < 1 || hour > 12 : hour > 23)) return null;
  if (period) hour = hour % 12 + (period === 'PM' ? 12 : 0);
  return { hour, minute, second };
}

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kuala_Lumpur',
});

export function formatTime(value: string | Date | null | undefined, includeSeconds = false, timezone = 'Asia/Kuala_Lumpur'): string {
  if (!value) return '—';
  const clock = typeof value === 'string' ? parseClockTime(value) : null;
  if (clock) {
    const hour = String(clock.hour % 12 || 12).padStart(2, '0');
    const minute = String(clock.minute).padStart(2, '0');
    const seconds = includeSeconds ? `:${String(clock.second).padStart(2, '0')}` : '';
    return `${hour}:${minute}${seconds} ${clock.hour < 12 ? 'AM' : 'PM'}`;
  }
  if (typeof value === 'string' && !/^\d{4}-\d{2}-\d{2}T/.test(value)) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  const formatter = timezone === 'Asia/Kuala_Lumpur' ? timeFormatter : new Intl.DateTimeFormat('en-US', {hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true, timeZone: timezone});
  const parts = formatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(entry => entry.type === type)?.value;
  return `${part('hour')}:${part('minute')}${includeSeconds ? `:${part('second')}` : ''} ${part('dayPeriod')}`;
}

export function toTimeInput(value: string | null | undefined): string {
  const clock = value ? parseClockTime(value) : null;
  return clock ? `${String(clock.hour).padStart(2, '0')}:${String(clock.minute).padStart(2, '0')}` : '';
}
