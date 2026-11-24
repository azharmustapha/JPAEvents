import { resolveEventTheme } from '@/lib/event-theme';
export function EventTheme({ tema, large = false, label = 'Tema acara' }: { tema?: string | null; large?: boolean; label?: string }) {
  const theme = resolveEventTheme(tema);
  return theme ? <div className={`event-theme${large ? ' event-theme-display' : ''}`}><p className="event-theme-label">{label}</p><p className="event-theme-text">{theme.text}</p></div> : null;
}
