export function getSupabaseConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key || url.includes('your-project.supabase.co') || key === 'your-anon-key-here') return null;
  try {
    if (!['http:', 'https:'].includes(new URL(url).protocol)) return null;
  } catch {
    return null;
  }
  return { url, key };
}

export function requireSupabaseConfig() {
  const config = getSupabaseConfig();
  if (!config) throw new Error('Tetapkan NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY sebelum membina aplikasi.');
  return config;
}
