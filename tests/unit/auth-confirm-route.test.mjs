import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { transpileModule, ModuleKind } from 'typescript';

const require = createRequire(import.meta.url);
const nextServer = require('next/server');
const code = transpileModule(await readFile(new URL('../../app/auth/confirm/route.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ModuleKind.CommonJS },
}).outputText;

function route(error = null) {
  const calls = [];
  const exports = {};
  new Function('exports', 'require', code)(exports, name => {
    if (name === 'next/server') return nextServer;
    if (name === '@/lib/auth/urls') return { authOrigin: () => 'https://jpaevents.vercel.app' };
    assert.equal(name, '@/lib/supabase/server');
    return { createServerSupabase: async () => ({ auth: {
      verifyOtp: async input => { calls.push(input); return { error }; },
      exchangeCodeForSession: async code => { calls.push(code); return { error }; },
    } }) };
  });
  return { get: exports.GET, calls };
}

test('confirmation behind a localhost proxy redirects to the public onboarding URL', async () => {
  const handler = route();
  const response = await handler.get(new nextServer.NextRequest('http://localhost:3000/auth/confirm?token_hash=test-token&type=email'));
  assert.equal(response.headers.get('location'), 'https://jpaevents.vercel.app/onboarding?confirmed=1');
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.deepEqual(handler.calls, [{ token_hash: 'test-token', type: 'email' }]);
});

test('PKCE confirmation still exchanges the code and uses the public destination', async () => {
  const handler = route();
  const response = await handler.get(new nextServer.NextRequest('http://localhost:3000/auth/confirm?code=test-code&next=https://evil.example'));
  assert.equal(response.headers.get('location'), 'https://jpaevents.vercel.app/onboarding?confirmed=1');
  assert.deepEqual(handler.calls, ['test-code']);
});

test('expired or missing verification links lead to a recovery page without disclosing the token', async () => {
  for (const query of ['?token_hash=expired&type=email', '', '?token_hash=wrong&type=recovery']) {
    const handler = route({ code: 'otp_expired' });
    const response = await handler.get(new nextServer.NextRequest(`http://localhost:3000/auth/confirm${query}`));
    assert.equal(response.headers.get('location'), 'https://jpaevents.vercel.app/auth/confirmation-error');
    assert.match(response.headers.get('cache-control'), /no-store/);
    if (!query.includes('type=email')) assert.deepEqual(handler.calls, []);
  }
});
