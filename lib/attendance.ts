import type { KehadiranPeserta } from '../types/database';

export function filterAttendance<T extends Pick<KehadiranPeserta, 'nama_pegawai' | 'bahagian_unit' | 'emel' | 'no_pasport'>>(rows: T[], query: string): T[] {
  const search = query.trim().toLocaleLowerCase('ms');
  if (!search) return rows;
  return rows.filter(row => [row.nama_pegawai, row.bahagian_unit, row.emel, row.no_pasport]
    .some(value => value != null && String(value).toLocaleLowerCase('ms').includes(search)));
}

export function normalizeRegistration(code: string, name: string, division: string, email: string, pledgeAccepted: boolean, settings?: { require_organization?: boolean; consent_text?: string | null }) {
  const payload = {
    session_code: code.trim().toUpperCase(),
    officer_name: name.trim().toUpperCase(),
    division: division.trim(),
    email_address: email.trim().toLowerCase(),
    pledge_accepted: pledgeAccepted,
  };
  if (!payload.session_code || payload.session_code.length > 80 ||
      !payload.officer_name || payload.officer_name.length > 200 ||
      payload.division.length > 200 || (settings === undefined && !payload.division)) {
    throw new Error('Sila lengkapkan maklumat yang sah (nama/unit maksimum 200 aksara).');
  }
  if (payload.email_address.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(payload.email_address)) {
    throw new Error('Sila masukkan alamat e-mel yang sah (maksimum 254 aksara).');
  }
  if (settings?.require_organization && !payload.division) throw new Error('Sila lengkapkan organisasi / kumpulan.');
  if (settings?.consent_text?.trim() && pledgeAccepted !== true) throw new Error('Sila tandakan kotak persetujuan sebelum mendaftar.');
  if (settings === undefined && pledgeAccepted !== true) {
    throw new Error('Sila tandakan kotak akur janji sebelum mendaftar masuk.');
  }
  return payload;
}

export function isPassportToken(value: string): boolean {
  return /^PAS-(?:[A-F0-9]{8}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(value);
}

export function passportNumber(value: number | undefined): string {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? String(value) : '—';
}

export function forgetMissingPassport(
  storage: Pick<Storage, 'length' | 'key' | 'getItem' | 'removeItem'>,
  token: string,
  response: { data: unknown; error: unknown },
): boolean {
  // A successful null response confirms absence; a connection error does not.
  if (response.error || response.data !== null) return false;
  try {
    const matches: string[] = [];
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key?.startsWith('jpaevents_pasport_') && storage.getItem(key) === token) matches.push(key);
    }
    matches.forEach(key => storage.removeItem(key));
    return matches.length > 0;
  } catch { return false; }
}
