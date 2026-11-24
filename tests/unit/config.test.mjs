import test from 'node:test';
import assert from 'node:assert/strict';
import { getSupabaseConfig } from '../../lib/supabase/config.ts';

test('missing, invalid and example configuration is unavailable', () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  try {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    assert.equal(getSupabaseConfig(), null);
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'bad-url';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-test-key';
    assert.equal(getSupabaseConfig(), null);
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://your-project.supabase.co';
    assert.equal(getSupabaseConfig(), null);
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    assert.deepEqual(getSupabaseConfig(), { url: 'https://example.supabase.co', key: 'public-test-key' });
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
    assert.equal(getSupabaseConfig().url, 'http://127.0.0.1:54321');
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'file:///tmp/db';
    assert.equal(getSupabaseConfig(), null);
  } finally {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
  }
});
