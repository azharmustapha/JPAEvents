import type { SupabaseClient } from '@supabase/supabase-js';
import type { Acara } from '../types/database';

export async function findRegistrationSession(client: SupabaseClient, explicitCode: string | null): Promise<Acara | null> {
  if (explicitCode === null || !explicitCode.trim()) return null;
  let query = client.from('perhimpunan').select('*').eq('status_aktif', true).eq('published', true);
  if (explicitCode !== null) query = query.eq('kod_sesi', explicitCode.trim().toUpperCase());
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data as Acara | null;
}

export async function loadActiveAssembly(client: SupabaseClient, code: string | null = null) {
  const event = await findRegistrationSession(client, code);
  if (!event) return { event: null, count: 0 };
  const { data, error } = await client.rpc('get_attendance_count', { event_id: event.id });
  if (error) throw error;
  const count = Number(data);
  if (data === null || !Number.isSafeInteger(count) || count < 0) throw new Error('Bilangan kehadiran tidak sah.');
  return { event, count };
}
