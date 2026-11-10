import { readFileSync } from 'node:fs';
import { PrimusZKTLS } from '@primuslabs/zktls-js-sdk';
import { appId, templateId, fixtureUrl } from './loyalty-config.js';

const sdk = new PrimusZKTLS();

try {
  switch (process.argv[2]) {
    case 'sign': {
      const secret = process.env.CONFIDENTIAL_QUOTE_PRIMUS_SECRET;
      if (!secret) throw new Error('Primus signer is not configured.');
      await sdk.init(appId, secret);
      const request = sdk.generateRequestParams(templateId);
      process.stdout.write(await sdk.sign(request.toJsonString()));
      break;
    }
    case 'verify': {
      const attestation = JSON.parse(readFileSync(0, 'utf8'));
      const now = Date.now();
      if (attestation.request?.url !== fixtureUrl ||
          attestation.request?.method !== 'GET' ||
          !Number.isSafeInteger(attestation.timestamp) ||
          attestation.timestamp < now - 300_000 ||
          attestation.timestamp > now + 30_000) {
        throw new Error('Unexpected or expired loyalty attestation.');
      }

      // The SDK logs signer details. Keep stdout reserved for the tier.
      console.log = (...args) => console.error(...args);
      if (!sdk.verifyAttestation(attestation)) {
        throw new Error('Invalid Primus attestation signature.');
      }

      const { loyaltyLevel } = JSON.parse(attestation.data);
      if (typeof loyaltyLevel !== 'string' || !/^[0-3]$/.test(loyaltyLevel)) {
        throw new Error('Invalid attested loyalty level.');
      }
      process.stdout.write(loyaltyLevel);
      break;
    }
    default:
      throw new Error('Unknown bridge operation.');
  }
} catch {
  process.exitCode = 1;
}
