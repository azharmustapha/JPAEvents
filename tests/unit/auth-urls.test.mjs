import test from 'node:test';
import assert from 'node:assert/strict';
import { authOrigin } from '../../lib/auth/urls.ts';

test('production ignores internal localhost and untrusted forwarded origins', () => {
  for (const url of ['http://localhost:3000', 'https://evil.example', 'https://preview.vercel.app']) {
    assert.equal(authOrigin(url, '', true), 'https://jpaevents.vercel.app');
  }
});
test('explicit public deployment origin is used, while local development stays local', () => {
  assert.equal(authOrigin('http://localhost:3000', 'https://events.example/', true), 'https://events.example');
  assert.equal(authOrigin('http://localhost:3000', '', false), 'http://localhost:3000');
});
test('production configuration rejects local URLs, insecure protocols and embedded credentials', () => {
  for (const url of ['http://localhost:3000', 'https://localhost', 'https://127.0.0.1', 'https://[::1]', 'http://events.example', 'javascript:alert(1)', 'https://user:password@events.example']) {
    assert.throws(() => authOrigin('http://localhost:3000', url, true));
  }
});
