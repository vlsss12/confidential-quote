import { PrimusZKTLS } from '@primuslabs/zktls-js-sdk';
import { appId } from '../loyalty-config.js';

const button = document.querySelector('#verify-loyalty');
const quantity = document.querySelector('#quantity');
const tier = document.querySelector('#tier');
const price = document.querySelector('#price');
const status = document.querySelector('#status');
const proofDetails = document.querySelector('#proof-details');
const controls = [...document.querySelectorAll('button, select, input')];
const reviewerCode = document.querySelector('#reviewer-code');
const hosted = location.protocol === 'https:';
document.querySelector('#access-field').hidden = !hosted;

async function post(path, payload, accessCode) {
  const response = await fetch(path, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', ...(hosted && {'X-Quote-Access': accessCode})},
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

button.disabled = false;
button.addEventListener('click', async () => {
  const accessCode = reviewerCode.value;
  controls.forEach(control => { control.disabled = true; });
  price.textContent = '—';
  proofDetails.hidden = true;
  status.textContent = 'Opening Primus verification…';
  try {
    const { signedRequest } = await post('/primus/sign', {}, accessCode);
    if (!window.primus) throw new Error('Open this page in Chrome with the Primus extension enabled.');
    const sdk = new PrimusZKTLS();
    await sdk.init(appId);
    const attestation = await sdk.startAttestation(signedRequest);
    status.textContent = 'Checking the attestation and computing the quote…';
    const result = await post('/quote', { quantity: Number(quantity.value), attestation }, accessCode);
    tier.value = String(result.verifiedTier);
    price.textContent = '$' + result.price.toFixed(2);
    document.querySelector('#proof-claim').textContent = result.verifiedClaim;
    const source = document.querySelector('#proof-source');
    source.href = result.proofSource;
    source.textContent = new URL(result.proofSource).hostname + ' · public fixture ↗';
    const checkedAt = new Date(result.verifiedAt);
    document.querySelector('#proof-time').dateTime = checkedAt.toISOString();
    document.querySelector('#proof-time').textContent = checkedAt.toLocaleString(undefined, {dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC'}) + ' UTC';
    document.querySelector('#proof-template').textContent = result.templateId;
    proofDetails.hidden = false;
    status.textContent = 'Primus verified the sandbox fixture; FHE computed the quote.';
  } catch (error) {
    status.textContent = error?.message || 'Primus verification did not complete.';
  } finally {
    controls.forEach(control => { control.disabled = false; });
  }
});
