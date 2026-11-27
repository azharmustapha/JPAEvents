import { CalendarIcon, UserGroupIcon, QrCodeIcon, ListIcon, TrophyIcon, DesktopIcon, SettingIcon } from '@govtechmy/myds-react/icon';
import { organizerHref } from '@/lib/organizer-navigation';

export function organizerLinks(eventId: string | null) {
  return [
    { href: organizerHref('/admin', eventId), label: 'Acara saya', icon: CalendarIcon, activePath: '/admin' },
    { href: `${organizerHref('/admin', eventId)}#attendance`, label: 'Kehadiran', icon: UserGroupIcon, activePath: '' },
    { href: organizerHref('/admin/imbas', eventId), label: 'Imbas QR', icon: QrCodeIcon, activePath: '/admin/imbas' },
    { href: organizerHref('/admin/tentatif', eventId), label: 'Tentatif', icon: ListIcon, activePath: '/admin/tentatif' },
    { href: organizerHref('/admin/cabutan', eventId), label: 'Cabutan', icon: TrophyIcon, activePath: '/admin/cabutan' },
    { href: organizerHref('/tayangan', eventId), label: 'Tayangan', icon: DesktopIcon, activePath: '/tayangan' },
    { href: eventId ? `/admin/events/${encodeURIComponent(eventId)}` : '/admin/sesi-baru', label: 'Tetapan', icon: SettingIcon, activePath: '/admin/events/' },
  ];
}
