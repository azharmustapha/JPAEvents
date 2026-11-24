'use client';

import { useEffect, useState } from 'react';
import { getBrowserSupabase } from '@/lib/supabaseClient';
import { loadActiveAssembly } from '@/lib/assembly';
import { startPolling } from '@/lib/polling';
import type { Acara } from '@/types/database';

export function useActiveAssembly() {
  const [state, setState] = useState<{ event: Acara | null; count: number; loading: boolean; error: string | null }>({
    event: null, count: 0, loading: true, error: null,
  });
  useEffect(() => startPolling(
    () => loadActiveAssembly(getBrowserSupabase()),
    snapshot => setState({ ...snapshot, loading: false, error: null }),
    () => setState({ event: null, count: 0, loading: false, error: 'Maklumat sesi tidak dapat dimuatkan. Cuba lagi sebentar.' }),
  ), []);
  return state;
}
