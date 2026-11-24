// Regenerate the additive install after changing the standalone schema or Storage rules.
import { readFile, writeFile } from 'node:fs/promises';

const directory = new URL('../supabase/', import.meta.url);
const prefix = 'jpaevents_';
const managed = new Set([
  'perhimpunan', 'kehadiran_peserta', 'atur_cara', 'cabutan_pemenang', 'workspaces', 'workspace_members',
  'is_event_member', 'create_workspace', 'save_event', 'set_registration_open', 'register_event_attendance',
  'get_passport', 'check_in_attendee', 'get_attendance_count', 'save_cabutan_winner',
]);

async function read(name) {
  return (await readFile(new URL(name, directory), 'utf8')).replaceAll('\r\n','\n');
}

// Choose only fresh-install sections. Fail if a source boundary changes.
function section(source, start, end) {
  const from = source.indexOf('\n' + start);
  const to = source.indexOf('\n' + end, from + 1);
  if (from === -1 || to === -1) throw new Error(`Missing schema section: ${start} … ${end}`);
  return source.slice(from + 1, to).trimEnd();
}

function qualify(sql) {
  return sql.replace(/\bpublic\.(\w+)/g, (_, name) => {
    if (!managed.has(name)) throw new Error(`Review new public object before sharing a project: ${name}`);
    return 'public.' + prefix + name;
  }).replace(/\bevent-assets\b/g, 'jpaevents-event-assets');
}

function sharedSchema(source) {
  const fresh = [
    section(source,'BEGIN;','LOCK TABLE'),
    section(source,'CREATE TABLE IF NOT EXISTS public.workspaces','DO $migration$'),
    section(source,'ALTER TABLE public.perhimpunan ALTER COLUMN workspace_id','DROP INDEX'),
    section(source,'ALTER TABLE public.kehadiran_peserta ADD COLUMN','-- Remove only known'),
    section(source,'ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;','COMMIT;'),
    'COMMIT;',
  ].join('\n\n');
  return qualify(fresh)
    // The shared Auth project's account lifecycle controls membership in this app.
    .replace('user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT',
      'user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE')
    .replace(/(CREATE (?:UNIQUE )?INDEX IF NOT EXISTS )(\w+)/g,'$1' + prefix + '$2')
    .replace(/CREATE POLICY (\w+) ON (public\.\w+)/g, (_, name, table) =>
      `DROP POLICY IF EXISTS ${prefix}${name} ON ${table};\nCREATE POLICY ${prefix}${name} ON ${table}`);
}

function sharedStorage(source) {
  return qualify(section(source,'BEGIN;','COMMIT;'))
    .replace(/((?:DROP POLICY IF EXISTS|CREATE POLICY) )(\w+)/g,'$1' + prefix + '$2') + '\nCOMMIT;';
}

for (const [input, output, generate] of [
  ['schema.sql','shared-project.sql',sharedSchema],
  ['storage.sql','shared-storage.sql',sharedStorage],
]) {
  const result = `-- Generated from ${input} by scripts/build-shared-schema.mjs.\n${generate(await read(input))}\n`;
  if (process.argv.includes('--check')) {
    if (result !== await read(output)) throw new Error(`Regenerate ${output} with node scripts/build-shared-schema.mjs`);
  } else {
    await writeFile(new URL(output, directory), result);
  }
}
