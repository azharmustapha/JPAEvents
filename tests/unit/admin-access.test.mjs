import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAdminAccess } from '../../lib/auth/access.ts';

test('membership without verified identity cannot grant access', () => {
  assert.equal(resolveAdminAccess(false,true,false),'login');
});
test('non-admin accounts and transport errors are denied', () => {
  assert.equal(resolveAdminAccess(true,false,false),'denied');
  assert.equal(resolveAdminAccess(true,true,true),'unavailable');
});
test('verified members alone receive admin access', () => {
  assert.equal(resolveAdminAccess(true,true,false),'allowed');
});
