import type { SupabaseClient } from '@supabase/supabase-js';
import type { CabutanPemenang, KehadiranPeserta, Acara } from '../types/database';

export async function loadAdminSessions(client: SupabaseClient): Promise<Acara[]> {
  const { data: memberships, error: membershipError } = await client.from('workspace_members').select('workspace_id');
  if (membershipError) throw membershipError;
  if (!memberships?.length) return [];
  const { data, error } = await client.from('perhimpunan').select('*').in('workspace_id', memberships.map(row => row.workspace_id)).order('dicipta_pada', { ascending: false });
  if (error) throw error;
  return data as Acara[];
}

export async function loadAttendance(client: SupabaseClient, eventId: string): Promise<KehadiranPeserta[]> {
  const rows: KehadiranPeserta[] = [];
  const pageSize = 500;
  let cursor: string | undefined;
  for (;;) {
    let query = client.from('kehadiran_peserta').select('*')
      .eq('perhimpunan_id', eventId).order('id', { ascending: true }).limit(pageSize);
    if (cursor) query = query.gt('id', cursor);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...data as KehadiranPeserta[]);
    if (data.length < pageSize) return rows.sort((a, b) =>
      (b.waktu_hadir || '').localeCompare(a.waktu_hadir || '') || b.id.localeCompare(a.id));
    cursor = data[data.length - 1].id;
  }
}

export async function loadCabutanWinners(client: SupabaseClient, eventId: string): Promise<CabutanPemenang[]> {
  const rows: CabutanPemenang[] = [];
  const pageSize = 500;
  let cursor: string | undefined;
  for (;;) {
    let query = client.from('cabutan_pemenang').select('*')
      .eq('perhimpunan_id', eventId).order('id', { ascending: true }).limit(pageSize);
    if (cursor) query = query.gt('id', cursor);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...data as CabutanPemenang[]);
    if (data.length < pageSize) return rows.sort((a, b) =>
      b.dicipta_pada.localeCompare(a.dicipta_pada) || b.id.localeCompare(a.id));
    cursor = data[data.length - 1].id;
  }
}
