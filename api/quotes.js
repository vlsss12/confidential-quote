import { execFile } from 'node:child_process';
import { chmod, copyFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
let executable;

async function quote(quantity, tier) {
  if (!executable) {
    executable = (async () => {
      const dir = await mkdtemp(join(tmpdir(), 'confidential-quotes-'));
      const destination = join(dir, 'quote');
      await copyFile(join(process.cwd(), 'runtime', 'confidential-quote'), destination);
      await chmod(destination, 0o700);
      return destination;
    })().catch(error => { executable = undefined; throw error; });
  }
  const { stdout } = await run(await executable, [String(quantity), String(tier)], { timeout: 20000 });
  const amount = Number(stdout.trim());
  const expected = 5 * quantity - (tier >= 2 ? 2 : 0);
  if (amount !== expected) throw new Error('Invalid quote');
  return amount;
}

function bearer(req) {
  const value = req.headers.authorization;
  const match = typeof value === 'string' && /^Bearer ([\w.-]+)$/.exec(value);
  return match?.[1];
}

async function identifyUser(base, publishableKey, token) {
  const response = await fetch(`${base}/auth/v1/user`, {
    headers: { apikey: publishableKey, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const user = await response.json();
  return typeof user.id === 'string' ? user.id : null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const reply = (status, body) => res.status(status).json(body);
  if (!['GET', 'POST'].includes(req.method)) return reply(405, { error: 'Use GET or POST.' });
  if (req.headers.origin !== `https://${req.headers.host}`) return reply(403, { error: 'Open the app directly to continue.' });

  const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !publishableKey || !serviceKey) return reply(503, { error: 'Saved quote storage is not configured.' });

  const token = bearer(req);
  if (!token) return reply(401, { error: 'Sign in to save and view your quote history.' });
  const userId = await identifyUser(base, publishableKey, token).catch(() => null);
  if (!userId) return reply(401, { error: 'Your session expired. Sign in again.' });

  if (req.method === 'GET') {
    const response = await fetch(`${base}/rest/v1/confidential_quote_saved_quotes?select=id,quantity,loyalty_tier,total_cents,created_at&order=created_at.desc&limit=25`, {
      headers: { apikey: publishableKey, Authorization: `Bearer ${token}` },
    }).catch(() => null);
    if (!response?.ok) return reply(503, { error: 'Could not load your quote history.' });
    return reply(200, { quotes: await response.json() });
  }

  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return reply(415, { error: 'Send JSON.' });
  let data;
  try {
    data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch { return reply(400, { error: 'Invalid request.' }); }
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      Object.keys(data).sort().join(',') !== 'quantity,requestId,tier' ||
      ![1, 2, 3].includes(data.quantity) || ![0, 1, 2, 3].includes(data.tier) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.requestId)) {
    return reply(400, { error: 'Choose a valid quantity and loyalty tier.' });
  }

  try {
    const totalCents = await quote(data.quantity, data.tier) * 100;
    const response = await fetch(`${base}/rest/v1/confidential_quote_saved_quotes`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        id: data.requestId,
        user_id: userId,
        quantity: data.quantity,
        loyalty_tier: data.tier,
        total_cents: totalCents,
      }),
    });
    if (!response.ok) throw new Error('Database request failed');
    const [saved] = await response.json();
    return reply(201, { quote: saved });
  } catch {
    return reply(503, { error: 'Could not save this quote. Please try again.' });
  }
}
