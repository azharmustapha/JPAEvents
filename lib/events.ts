export function eventPath(slug: string, section = ''): string {
  return `/events/${encodeURIComponent(slug)}${section ? `/${section}` : ''}`;
}

export function parseScannedPassport(value: string, origin: string): string | null {
  const valid = (token: string) => /^PAS-(?:[a-f0-9]{8}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(token);
  if (valid(value.trim())) return value.trim();
  try {
    const url = new URL(value);
    if (url.origin !== new URL(origin).origin) return null;
    const match = /^\/pasport\/([^/]+)$/.exec(url.pathname);
    const token = match && decodeURIComponent(match[1]);
    return token && valid(token) ? token : null;
  } catch { return null; }
}

export function contrastText(color: string): string {
  const channels = [1, 3, 5].map(index => {
    const value = parseInt(color.slice(index, index + 2), 16) / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  });
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722 > .179 ? '#000000' : '#ffffff';
}

export function validateImageUpload(file: { type: string; size: number }): string {
  const extension = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as Record<string, string>)[file.type];
  if (!extension || file.size <= 0 || file.size > 5 * 1024 * 1024) throw new Error('Pilih imej PNG, JPG atau WebP sehingga 5 MB.');
  return extension;
}

export function validateEventSettings(settings: Record<string, unknown>): void {
  for (const field of ['tajuk', 'lokasi', 'kod_sesi']) {
    if (typeof settings[field] !== 'string' || !String(settings[field]).trim() || String(settings[field]).length > (field === 'kod_sesi' ? 80 : 200)) throw new Error('Lengkapkan tajuk, lokasi dan kod acara yang sah.');
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(settings.slug)) || String(settings.slug).length > 80) throw new Error('Pautan acara hanya boleh menggunakan huruf kecil, nombor dan sempang.');
  const date = String(settings.tarikh);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error('Tarikh acara tidak sah.');
  if (!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(String(settings.masa_mula))) throw new Error('Masa acara tidak sah.');
  for (const key of ['primary_color', 'accent_color']) if (!/^#[0-9a-f]{6}$/i.test(String(settings[key]))) throw new Error('Warna tema tidak sah.');
  try { new Intl.DateTimeFormat('ms', { timeZone: String(settings.timezone) }).format(); } catch { throw new Error('Zon masa tidak sah.'); }
  if (!Number.isSafeInteger(settings.draw_exclude_first) || Number(settings.draw_exclude_first) < 0) throw new Error('Bilangan pengecualian cabutan tidak sah.');
}
