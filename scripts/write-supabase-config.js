import { writeFile } from 'node:fs/promises';

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_PUBLISHABLE_KEY || '';
if (url && !/^https:\/\/[\w.-]+\.supabase\.co\/?$/.test(url)) {
  throw new Error('SUPABASE_URL must be a Supabase project URL.');
}
if (key && !key.startsWith('sb_publishable_')) {
  throw new Error('Only a Supabase publishable key may be included in the browser bundle.');
}
await writeFile('web/supabase-config.js',
  `export const SUPABASE_URL = ${JSON.stringify(url)};\nexport const SUPABASE_PUBLISHABLE_KEY = ${JSON.stringify(key)};\n`);
