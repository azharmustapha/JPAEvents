import { CalendarIcon, UserGroupIcon, QrCodeIcon, ListIcon, TrophyIcon, SettingIcon } from '@govtechmy/myds-react/icon';
import { organizerHref } from '@/lib/organizer-navigation';
import type { ComponentType, SVGProps } from 'react';

export type OrganizerLink = { href: string; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> | null; activePath: string; group: 'primary' | 'profile' };

export function organizerLinks(eventId: string | null): OrganizerLink[] {
  return [
    { href: organizerHref('/admin', eventId), label: 'Acara saya', icon: CalendarIcon, activePath: '/admin', group: 'primary' },
    { href: organizerHref('/admin/kehadiran', eventId), label: 'Kehadiran', icon: UserGroupIcon, activePath: '/admin/kehadiran', group: 'primary' },
    { href: organizerHref('/admin/imbas', eventId), label: 'Imbas QR', icon: QrCodeIcon, activePath: '/admin/imbas', group: 'profile' },
    { href: organizerHref('/admin/tentatif', eventId), label: 'Tentatif', icon: ListIcon, activePath: '/admin/tentatif', group: 'primary' },
    { href: organizerHref('/admin/cabutan', eventId), label: 'Cabutan', icon: TrophyIcon, activePath: '/admin/cabutan', group: 'primary' },
    { href: eventId ? `/admin/events/${encodeURIComponent(eventId)}` : '/admin/sesi-baru', label: 'Tetapan acara', icon: SettingIcon, activePath: '/admin/events/', group: 'profile' },
  ];
}
