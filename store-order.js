import { createHash } from 'node:crypto';

const sku = 'loyalty-item';

export function resolveStoreOrder(data, authorization, memberConfig) {
  let members;
  try {
    members = JSON.parse(memberConfig || 'null');
    if (!members || typeof members !== 'object' || Array.isArray(members) ||
        !Object.keys(members).length ||
        Object.entries(members).some(([hash, tier]) =>
          !/^[a-f0-9]{64}$/.test(hash) || ![0, 1, 2, 3].includes(tier))) {
      throw new Error('Invalid member configuration');
    }
  } catch {
    return {status: 503, error: 'Store quoting is not configured.'};
  }

  const token = /^Bearer ([a-f0-9]{64})$/.exec(authorization || '')?.[1];
  const hash = token && createHash('sha256').update(token).digest('hex');
  if (!hash || !Object.hasOwn(members, hash)) {
    return {status: 401, error: 'A valid store credential is required.'};
  }

  if (Object.keys(data).length !== 2 || data.sku !== sku || ![1, 2, 3].includes(data.quantity)) {
    return {status: 400, error: 'Send a supported SKU and a quantity from 1 to 3.'};
  }
  return {sku, quantity: data.quantity, tier: members[hash]};
}
