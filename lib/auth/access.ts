export function resolveAdminAccess(identityVerified: boolean, membership: boolean, failed: boolean) {
  if (failed) return 'unavailable';
  if (!identityVerified) return 'login';
  return membership ? 'allowed' : 'denied';
}
