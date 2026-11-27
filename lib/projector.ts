type RegistrationSnapshot = { available: boolean; verified: boolean; connected: boolean; registrationOpen: boolean; hasUrl: boolean };
export function projectorRegistrationState(state: RegistrationSnapshot): 'loading' | 'offline' | 'unavailable' | 'closed' | 'open' {
  if (!state.available) return 'unavailable';
  if (!state.connected) return 'offline';
  if (!state.verified) return 'loading';
  if (!state.hasUrl) return 'unavailable';
  return state.registrationOpen ? 'open' : 'closed';
}
export function projectorCount(value: number | null): string {
  return value !== null && Number.isSafeInteger(value) && value >= 0 ? new Intl.NumberFormat('en-MY').format(value) : '—';
}
