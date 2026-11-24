const tables = new Set(['workspaces', 'workspace_members', 'perhimpunan', 'atur_cara', 'kehadiran_peserta', 'cabutan_pemenang']);
const functions = new Set(['create_workspace', 'save_event', 'set_registration_open', 'register_event_attendance', 'get_passport', 'get_attendance_count', 'check_in_attendee', 'save_cabutan_winner', 'is_event_member']);

export function usesSharedProject(): boolean {
  const mode = process.env.NEXT_PUBLIC_JPAEVENTS_SHARED_PROJECT;
  if (mode !== undefined && mode !== 'true' && mode !== 'false') throw new Error('NEXT_PUBLIC_JPAEVENTS_SHARED_PROJECT must be true or false.');
  return mode === 'true';
}

export const authCookieOptions = { name: 'jpaevents-auth' };

export function eventAssetsBucket(shared = usesSharedProject()): string {
  return shared ? 'jpaevents-event-assets' : 'event-assets';
}

export function routeProjectRequest(input: string, projectUrl: string, shared = usesSharedProject()): string {
  if (!shared) return input;
  const url = new URL(input);
  if (url.origin !== new URL(projectUrl).origin) return input;
  const match = /^\/rest\/v1\/(rpc\/)?([a-z_]+)$/.exec(url.pathname);
  if (!match || !(match[1] ? functions : tables).has(match[2])) return input;
  url.pathname = `/rest/v1/${match[1] || ''}jpaevents_${match[2]}`;
  return url.href;
}

export function projectFetch(projectUrl: string, requestFetch: typeof fetch = fetch): typeof fetch {
  return (input, init) => {
    const original = input instanceof Request ? input.url : String(input);
    const routed = routeProjectRequest(original, projectUrl);
    return requestFetch(routed === original ? input : input instanceof Request ? new Request(routed, input) : routed, init);
  };
}
