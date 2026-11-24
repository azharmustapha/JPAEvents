import pg from 'pg';
import { readFile } from 'node:fs/promises';

if (!process.env.TEST_DATABASE_URL || process.env.ALLOW_DATABASE_TESTS !== 'true') {
  console.log('SKIPPED: live database checks require an explicitly disposable TEST_DATABASE_URL and ALLOW_DATABASE_TESTS=true. Embedded database tests run with npm test.');
  process.exit(0);
}
const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL, statement_timeout: 15000 });
await client.connect();
try {
  for (const file of ['access-control.sql','session-transitions.sql']) {
    await client.query(await readFile(new URL(`../supabase/tests/${file}`, import.meta.url),'utf8'));
    console.log(`PASS: ${file}`);
  }
} finally {
  await client.query('ROLLBACK');
  await client.end();
}
