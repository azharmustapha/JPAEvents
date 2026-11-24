import type { SupabaseClient } from '@supabase/supabase-js';
import type { Acara } from '../types/database';

export async function loadPublishedSnapshot(client: SupabaseClient, eventId: string): Promise<{ event: Acara | null; count: number }> {
  const { data: event, error } = await client.from('perhimpunan').select('*').eq('id', eventId).eq('published', true).maybeSingle();
  if (error) throw error;
  if (!event) return { event: null, count: 0 };
  const { data, error: countError } = await client.rpc('get_attendance_count', { event_id: eventId });
  if (countError || data === null || !Number.isSafeInteger(Number(data)) || Number(data) < 0) throw new Error('Kehadiran tidak tersedia.');
  return { event: event as Acara, count: Number(data) };
}
