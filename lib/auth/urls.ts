const publicSite = 'https://jpaevents.vercel.app';

export function authOrigin(requestUrl: string, configuredUrl = process.env.NEXT_PUBLIC_SITE_URL, production = process.env.NODE_ENV === 'production'): string {
  const url = new URL(configuredUrl?.trim() || (production ? publicSite : requestUrl));
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.hostname.endsWith('.localhost');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (production && (url.protocol !== 'https:' || local))) {
    throw new Error('NEXT_PUBLIC_SITE_URL mesti menggunakan alamat HTTPS awam aplikasi.');
  }
  return url.origin;
}
