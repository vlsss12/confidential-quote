import { execFile } from 'node:child_process';
import { chmod, copyFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
let executable;

async function quote(quantity, profile) {
  if (!executable) {
    executable = (async () => {
      const dir = await mkdtemp(join(tmpdir(), 'confidential-shop-'));
      const destination = join(dir, 'quote');
      await copyFile(join(process.cwd(), 'runtime', 'confidential-quote'), destination);
      await chmod(destination, 0o700);
      return destination;
    })().catch(error => { executable = undefined; throw error; });
  }
  const tier = profile === 'rewards' ? 2 : 1;
  const { stdout } = await run(await executable, [String(quantity), String(tier)], { timeout: 20000 });
  const total = Number(stdout.trim());
  const expected = 5 * quantity - (profile === 'rewards' ? 2 : 0);
  if (total !== expected) throw new Error('Unexpected quote');
  return total;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const reply = (status, body) => res.status(status).json(body);
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (req.method === 'GET') {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return reply(200, { enabled: false });
    try {
      const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/confidential_quote_demo_orders?select=id&limit=0`, {
        headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      });
      return reply(200, { enabled: response.ok });
    } catch { return reply(200, { enabled: false }); }
  }
  if (req.method !== 'POST') return reply(405, { error: 'Use POST.' });
  if (req.headers.origin !== `https://${req.headers.host}` ||
      !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) {
    return reply(403, { error: 'Open this demo directly to continue.' });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return reply(503, { error: 'Order saving is not configured yet.' });
  }

  let data;
  try {
    data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch { return reply(400, { error: 'Invalid request.' }); }
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      Object.keys(data).sort().join(',') !== 'profile,quantity,requestId,sku' ||
      data.sku !== 'loyalty-item' || ![1, 2, 3].includes(data.quantity) ||
      !['standard', 'rewards'].includes(data.profile) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.requestId)) {
    return reply(400, { error: 'Choose a valid sample profile and quantity.' });
  }

  try {
    const total = await quote(data.quantity, data.profile);
    const db = SUPABASE_URL.replace(/\/$/, '');
    const response = await fetch(`${db}/rest/v1/rpc/create_confidential_quote_demo_order`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_order_id: data.requestId,
        p_sku: data.sku,
        p_quantity: data.quantity,
        p_profile: data.profile,
        p_total_cents: total * 100,
      }),
    });
    if (!response.ok) throw new Error('Database request failed');
    const saved = await response.json();
    const order = Array.isArray(saved) ? saved[0] : saved;
    if (!order || order.id !== data.requestId || order.quantity !== data.quantity ||
        order.profile !== data.profile || order.total_cents !== total * 100) {
      return reply(409, { error: 'That request ID was already used for a different order.' });
    }
    return reply(200, {
      id: order.id,
      sku: order.sku,
      quantity: order.quantity,
      profile: order.profile,
      currency: 'USD',
      totalCents: order.total_cents,
      createdAt: order.created_at,
    });
  } catch {
    return reply(503, { error: 'Could not save the demo order. Please try again.' });
  }
}
