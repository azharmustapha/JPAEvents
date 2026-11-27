type EventChoice = { id: string; status_aktif: boolean };

export function resolveOrganizerEvent<T extends EventChoice>(events: T[], explicit: string | null, previous: string | null): T | null {
  if (explicit !== null) return events.find(event => event.id === explicit) ?? null;
  return events.find(event => event.id === previous) ?? events.find(event => event.status_aktif) ?? events[0] ?? null;
}

export function organizerHref(path: string, eventId: string | null): string {
  return eventId ? `${path}?event=${encodeURIComponent(eventId)}` : '/admin';
}

export function organizerColors(event?: { primary_color?: string | null; accent_color?: string | null } | null) {
  const valid = (value: string | null | undefined, fallback: string) => /^#[\da-f]{6}$/i.test(value ?? '') ? value! : fallback;
  const primary = valid(event?.primary_color, '#003053');
  const accent = valid(event?.accent_color, '#087f8c');
  const luminance = [1, 3, 5].map(index => {
    const channel = parseInt(primary.slice(index, index + 2), 16) / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  });
  const foreground = luminance[0] * .2126 + luminance[1] * .7152 + luminance[2] * .0722 > .179 ? '#000000' : '#ffffff';
  return { primary, accent, foreground };
}
