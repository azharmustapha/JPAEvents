import type { CabutanPemenang, KehadiranPeserta } from '../types/database';

export function getEligibleDrawParticipants<T extends Pick<KehadiranPeserta, 'id' | 'no_pasport'>>(
  participants: T[], winners: Pick<CabutanPemenang, 'peserta_id'>[], excludeFirst = 0,
): T[] {
  const winnerIds = new Set(winners.map(winner => winner.peserta_id));
  return participants.filter(participant =>
    typeof participant.no_pasport === 'number' && Number.isSafeInteger(participant.no_pasport) &&
    participant.no_pasport > excludeFirst && !winnerIds.has(participant.id));
}

// getRandomValues is also available on local-network HTTP pages.
export function createDrawId(randomSource: Pick<Crypto, 'getRandomValues'> = globalThis.crypto): string {
  const bytes = randomSource.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
