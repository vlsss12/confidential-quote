import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase-config.js';

const $ = selector => document.querySelector(selector);
const form = $('#quote-form');
const quantity = $('#quantity');
const tier = $('#tier');
const computeButton = $('#compute');
const saveButton = $('#save');
const total = $('#total');
const quoteStatus = $('#quote-status');
const signinForm = $('#signin-form');
const authStatus = $('#auth-status');
let latestQuote;
let client;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  $('#auth-config-warning').hidden = false;
  signinForm.hidden = true;
} else {
  client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  await client.auth.exchangeCodeForSession(window.location.href).catch(() => null);
  await refreshAuth();
  client.auth.onAuthStateChange(() => { void refreshAuth(); });
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  computeButton.disabled = true;
  saveButton.disabled = true;
  latestQuote = undefined;
  total.textContent = '—';
  quoteStatus.textContent = 'Calculating the sample with the FHE helper…';
  quoteStatus.className = 'status';
  try {
    const response = await fetch('/quote', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: Number(quantity.value), tier: Number(tier.value) }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'The quote could not be calculated.');
    latestQuote = { quantity: Number(quantity.value), tier: Number(tier.value), price: result.price };
    total.textContent = `$${result.price.toFixed(2)}`;
    quoteStatus.textContent = 'Sample quote calculated. Sign in to save it to your history.';
    saveButton.disabled = !client;
  } catch (error) {
    quoteStatus.textContent = error.message;
    quoteStatus.classList.add('error');
  } finally { computeButton.disabled = false; }
});

signinForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!client) return;
  const button = $('#signin');
  button.disabled = true;
  authStatus.textContent = 'Sending your sign-in link…';
  try {
    const { error } = await client.auth.signInWithOtp({
      email: $('#email').value.trim(),
      options: { emailRedirectTo: `${location.origin}/shop` },
    });
    if (error) throw error;
    authStatus.textContent = 'Check your inbox for the secure sign-in link.';
  } catch (error) {
    authStatus.textContent = error.message || 'Could not send the sign-in link.';
    authStatus.classList.add('error');
  } finally { button.disabled = false; }
});

saveButton.addEventListener('click', async () => {
  if (!client || !latestQuote) return;
  saveButton.disabled = true;
  quoteStatus.textContent = 'Saving this quote to your account…';
  try {
    const { data: { session }, error } = await client.auth.getSession();
    if (error || !session) throw new Error('Sign in first, then calculate the quote again.');
    const response = await fetch('/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ quantity: latestQuote.quantity, tier: latestQuote.tier, requestId: crypto.randomUUID() }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not save this quote.');
    quoteStatus.textContent = 'Saved to your account history.';
    quoteStatus.classList.add('ok');
    await loadQuotes(session.access_token);
  } catch (error) {
    quoteStatus.textContent = error.message;
    quoteStatus.classList.add('error');
    saveButton.disabled = false;
  }
});

$('#signout').addEventListener('click', async () => {
  await client?.auth.signOut();
  $('#quotes').replaceChildren();
});

async function refreshAuth() {
  if (!client) return;
  const { data: { session } } = await client.auth.getSession();
  signinForm.hidden = Boolean(session);
  $('#signed-in').hidden = !session;
  $('#user-email').textContent = session?.user?.email || '';
  saveButton.disabled = !latestQuote || !session;
  if (session) {
    authStatus.textContent = 'Signed in. Your quote history is private to this account.';
    authStatus.className = 'status ok';
    await loadQuotes(session.access_token);
  } else {
    authStatus.textContent = 'Sign in to save and view your own quotes.';
    authStatus.className = 'status';
  }
}

async function loadQuotes(token) {
  const list = $('#quotes');
  list.replaceChildren();
  try {
    const response = await fetch('/quotes', { headers: { Authorization: `Bearer ${token}` } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not load history.');
    if (!result.quotes.length) {
      const empty = document.createElement('p');
      empty.className = 'status';
      empty.textContent = 'No quotes saved yet.';
      list.append(empty);
      return;
    }
    for (const quote of result.quotes) {
      const row = document.createElement('div');
      row.className = 'quote-row';
      const detail = document.createElement('span');
      const date = new Date(quote.created_at).toLocaleString();
      const label = document.createElement('strong');
      label.textContent = `${quote.quantity} item${quote.quantity === 1 ? '' : 's'} · Tier ${quote.loyalty_tier}`;
      const meta = document.createElement('small');
      meta.textContent = date;
      detail.append(label, meta);
      const amount = document.createElement('strong');
      amount.textContent = `$${(quote.total_cents / 100).toFixed(2)}`;
      row.append(detail, amount);
      list.append(row);
    }
  } catch (error) {
    authStatus.textContent = error.message;
    authStatus.className = 'status error';
  }
}
