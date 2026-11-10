import { execFile } from 'node:child_process';
import { createHash, timingSafeEqual } from 'node:crypto';
import { chmod, copyFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { PrimusZKTLS } from '@primuslabs/zktls-js-sdk';
import { resolveStoreOrder } from '../store-order.js';
import { appId, templateId, fixtureUrl } from '../loyalty-config.js';

const run = promisify(execFile);
let executable;
function prepareEngine() {
  if (!executable) {
    executable = (async () => {
      const dir = await mkdtemp(join(tmpdir(), 'confidential-quote-'));
      const destination = join(dir, 'quote');
      await copyFile(join(process.cwd(), 'runtime', 'confidential-quote'), destination);
      await chmod(destination, 0o700);
      return destination;
    })().catch(error => {
      executable = undefined;
      throw error;
    });
  }
  return executable;
}

const digest = value => createHash('sha256').update(value).digest();

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const reply = (status, data) => res.status(status).json(data);
  if (req.method !== 'POST') return reply(405, {error: 'Use POST.'});
  const store = req.query.operation === 'store';
  if ((!store && req.headers.origin !== `https://${req.headers.host}`) ||
      !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) {
    return reply(403, {error: 'Open this demo directly to continue.'});
  }
  let data;
  try {
    data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!data || typeof data !== 'object' || Array.isArray(data) ||
        JSON.stringify(data).length > 32768) throw new Error();
  } catch {
    return reply(400, {error: 'Invalid request.'});
  }

  if (store) {
    const order = resolveStoreOrder(data, req.headers.authorization, process.env.CONFIDENTIAL_QUOTE_STORE_MEMBERS);
    if (order.error) return reply(order.status, {error: order.error});
    try {
      const total = await computeQuote(order.quantity, order.tier);
      return reply(200, {
        sku: order.sku,
        quantity: order.quantity,
        currency: 'USD',
        totalCents: total * 100,
      });
    } catch {
      return reply(503, {error: 'The FHE engine is temporarily unavailable.'});
    }
  }

  const signing = req.query.operation === 'sign';
  const verified = Object.hasOwn(data, 'attestation');
  if (signing || verified) {
    const access = process.env.CONFIDENTIAL_QUOTE_ACCESS_CODE;
    const secret = process.env.CONFIDENTIAL_QUOTE_PRIMUS_SECRET;
    if (!secret || !access || access.length < 24) {
      return reply(503, {error: 'Hosted Primus verification is not configured. Try a sample quote.'});
    }
    const supplied = req.headers['x-quote-access'];
    if (typeof supplied !== 'string' || !timingSafeEqual(digest(access), digest(supplied))) {
      return reply(403, {error: 'Enter the reviewer access code to use live verification.'});
    }
    if (signing) {
      try {
        const sdk = new PrimusZKTLS();
        await sdk.init(appId, secret);
        return reply(200, {signedRequest: await sdk.sign(sdk.generateRequestParams(templateId).toJsonString())});
      } catch {
        return reply(502, {error: 'Primus could not sign the verification request.'});
      }
    }
  }

  const {quantity} = data;
  if (![1, 2, 3].includes(quantity)) return reply(400, {error: 'Select an order quantity from 1 to 3.'});
  let tier = data.tier;
  if (verified) {
    try {
      const proof = data.attestation;
      const now = Date.now();
      if (proof.request?.url !== fixtureUrl || proof.request?.method !== 'GET' ||
          !Number.isSafeInteger(proof.timestamp) || proof.timestamp < now - 300000 ||
          proof.timestamp > now + 30000 || !new PrimusZKTLS().verifyAttestation(proof)) throw new Error();
      const {loyaltyLevel} = JSON.parse(proof.data);
      if (typeof loyaltyLevel !== 'string' || !/^[0-3]$/.test(loyaltyLevel)) throw new Error();
      tier = Number(loyaltyLevel);
    } catch {
      return reply(422, {error: 'Primus could not verify this sandbox attestation.'});
    }
  }
  if (![0, 1, 2, 3].includes(tier)) return reply(400, {error: 'Select a loyalty level from 0 to 3.'});
  try {
    const price = await computeQuote(quantity, tier);
    return reply(200, verified ? {price, verifiedTier: tier} : {price});
  } catch (error) {
    console.error('FHE quote failed', {code: error.code, signal: error.signal, killed: error.killed});
    return reply(503, {error: 'The FHE engine is temporarily unavailable.'});
  }
}

async function computeQuote(quantity, tier) {
  const {stdout} = await run(await prepareEngine(), [String(quantity), String(tier)], {timeout: 20000});
  const price = Number(stdout.trim());
  const subtotal = 5 * quantity;
  if (price !== subtotal && price !== subtotal - 2) throw new Error('Invalid quote');
  return price;
}
