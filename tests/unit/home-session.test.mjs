import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { transpileModule, ModuleKind } from 'typescript';

const require = createRequire(import.meta.url);
const next = require('next/server');
const code = transpileModule(await readFile(new URL('../../lib/supabase/proxy.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ModuleKind.CommonJS },
}).outputText;

function session({ signedIn = false, unavailable = false, refresh = false } = {}) {
  const exports = {};
  new Function('exports', 'require', code)(exports, name => {
    if (name === 'next/server') return next;
    if (name === './config') return { getSupabaseConfig: () => ({ url: 'https://test.supabase.co', key: 'test-key' }) };
    if (name === './project-routing') return { authCookieOptions: {} };
    if (name === '../auth/timeout') return { withAuthTimeout: fn => fn(new AbortController().signal) };
    assert.equal(name, '@supabase/ssr');
    return { createServerClient: (_url, _key, options) => ({ auth: { getClaims: async () => {
      if (unavailable) throw new Error('Auth unavailable');
      if (refresh) options.cookies.setAll([{ name: 'session', value: 'refreshed', options: { path: '/' } }], {});
      return { data: { claims: signedIn ? { sub: 'organizer' } : null }, error: null };
    } } }) };
  });
  return path => exports.updateSession(new next.NextRequest(`https://app.test${path}`));
}

test('signed-in visitors to home go directly to admin with refreshed cookies', async () => {
  const response = await session({ signedIn: true, refresh: true })('/?source=home');
  assert.equal(response.headers.get('location'), 'https://app.test/admin');
  assert.equal(response.cookies.get('session')?.value, 'refreshed');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
});

test('signed-out visitors and Auth outages keep the public home accessible', async () => {
  for (const options of [{}, { unavailable: true }]) {
    const response = await session(options)('/');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('location'), null);
  }
});

test('admin remains protected and login remains accessible', async () => {
  assert.equal((await session()('/admin')).headers.get('location'), 'https://app.test/admin/login');
  assert.equal((await session({ unavailable: true })('/admin')).headers.get('location'), 'https://app.test/admin/login?error=unavailable');
  assert.equal((await session({ signedIn: true })('/admin')).status, 200);
  assert.equal((await session({ unavailable: true })('/admin/login')).status, 200);
});
