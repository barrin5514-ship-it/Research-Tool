// One small client for Serper (a paid Google-results service).
// The API key is read from the server environment and never sent to the browser,
// printed, or written to logs. Both shopping and web searches cost the same.
import https from 'node:https';
import {lookup} from 'node:dns/promises';
import {publicIPv4} from './store-price.mjs';
export const SERPER_ENDPOINT = 'https://google.serper.dev';
// $1.00 per 1,000 searches in the standard credit pack.
export const SERPER_COST_USD = 0.001;
export const SHOPPING_RESULT_LIMIT = 5;
export const WEB_RESULT_LIMIT = 3;

// Stores whose pages this app is not allowed to read automatically.
// Amazon blocks automated page reads, and its own product API needs an approved
// Amazon Associates account plus qualifying sales, so it is listed as unreachable.
const UNREADABLE_HOSTS = [
  { test: /(^|\.)amazon\./i, reason: "Can't check this store" },
  { test: /(^|\.)amzn\./i, reason: "Can't check this store" }
];

export function serperKey(env = process.env) {
  const value = env.SERPER_API_KEY;
  // A key must be one non-empty line. Reject odd values instead of sending them.
  if (typeof value !== 'string' || !value.trim() || /[\r\n]/.test(value)) return '';
  return value.trim();
}

export function canReadStore(link) {
  try {
    const host = new URL(link).hostname;
    const hit = UNREADABLE_HOSTS.find(rule => rule.test.test(host));
    return hit ? { canCheck: false, reason: hit.reason } : { canCheck: true, reason: '' };
  } catch {
    return { canCheck: false, reason: "Can't check this store" };
  }
}

// Turn a wishlist item into a short shopping query using only known product facts.
export function shoppingQuery(item) {
  const product = item?.product || {};
  const parts = [product.brand, product.name, product.model]
    .filter(value => typeof value === 'string' && value.trim() && !/^product not identified$/i.test(value.trim()));
  const text = (parts.length ? parts.join(' ') : String(item?.title || '')).replace(/\s+/g, ' ').trim();
  return text.slice(0, 200);
}

// Serper returns prices as display text such as "$19.99" or "€1.299,00".
// Only accept a value when one number is clearly present; otherwise keep the text.
export function parsePriceText(text) {
  const raw = typeof text === 'string' ? text.trim() : '';
  if (!raw) return { amount: null, currency: null };
  const currency = /\$/.test(raw) ? 'USD' : /£/.test(raw) ? 'GBP' : /€/.test(raw) ? 'EUR' : null;
  if (!currency) return { amount: null, currency: null };
  const digits = raw.replace(/[^0-9.,]/g, '');
  // European style writes 1.299,00; US style writes 1,299.00.
  const normalised = /,\d{2}$/.test(digits) && digits.includes('.')
    ? digits.replace(/\./g, '').replace(',', '.')
    : digits.replace(/,/g, '');
  const amount = Number(normalised);
  return Number.isFinite(amount) && amount >= 0 ? { amount, currency } : { amount: null, currency: null };
}

export function parseShoppingResults(body, limit = SHOPPING_RESULT_LIMIT) {
  const rows = Array.isArray(body?.shopping) ? body.shopping : [];
  const seen = new Set();
  const results = [];
  for (const row of rows) {
    if (!row || typeof row.link !== 'string' || !/^https:\/\//i.test(row.link)) continue;
    if (seen.has(row.link)) continue;
    seen.add(row.link);
    const price = parsePriceText(row.price);
    const reachable = canReadStore(row.link);
    results.push({
      title: typeof row.title === 'string' ? row.title.slice(0, 300) : '',
      store: typeof row.source === 'string' && row.source.trim() ? row.source.trim().slice(0, 120) : new URL(row.link).hostname,
      link: row.link,
      price: price.amount,
      currency: price.currency,
      priceText: typeof row.price === 'string' ? row.price.slice(0, 60) : '',
      imageUrl: typeof row.imageUrl === 'string' && /^https:\/\//i.test(row.imageUrl) ? row.imageUrl : '',
      canCheck: reachable.canCheck,
      reason: reachable.reason
    });
    if (results.length >= limit) break;
  }
  return results;
}

export function parseWebResults(body, limit = WEB_RESULT_LIMIT) {
  const rows = Array.isArray(body?.organic) ? body.organic : [];
  const seen = new Set();
  const results = [];
  for (const row of rows) {
    if (!row || typeof row.link !== 'string' || !/^https:\/\//i.test(row.link)) continue;
    if (seen.has(row.link)) continue;
    seen.add(row.link);
    results.push({
      title: typeof row.title === 'string' ? row.title.slice(0, 200) : '',
      link: row.link,
      snippet: typeof row.snippet === 'string' ? row.snippet.slice(0, 500) : ''
    });
    if (results.length >= limit) break;
  }
  return results;
}

// One JSON POST to Serper. `fetcher` is replaceable so tests never touch the network.
export async function serperSearch({ kind, query, apiKey, fetcher = fetch, signal, limit, gl = 'us', hl = 'en' }) {
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!key || /[\r\n]/.test(key)) throw Error('Serper search is not configured on the server');
  const path = kind === 'shopping' ? 'shopping' : kind === 'web' ? 'search' : '';
  if (!path) throw Error('Unknown search type');
  const text = String(query || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (text.length < 2) throw Error('Enter a product name or question to search');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  // Keep the caller's cancel signal wired in as well.
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });
  let response;
  try {
    response = await fetcher(`${SERPER_ENDPOINT}/${path}`, {
      method: 'POST',
      redirect: 'error',
      signal: controller.signal,
      headers: { 'x-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({ q: text, gl, hl, ...(kind === 'shopping' ? { num: Math.max(5, limit || SHOPPING_RESULT_LIMIT) } : { num: 10 }) })
    });
  } catch (error) {
    throw Error(error?.name === 'AbortError' ? 'Search timed out' : 'Search service is unreachable');
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    // Never echo response bodies: they can contain account details.
    throw Error(response.status === 401 || response.status === 403 ? 'Search key was refused' : 'Search service returned no usable answer');
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw Error('Search service returned unreadable data');
  }
  return kind === 'shopping' ? parseShoppingResults(body, limit) : parseWebResults(body, limit);
}

// Product pictures live on store servers. The browser is allowed to load pictures
// only from this app, so the server fetches the picture and passes the bytes through.
// Only URLs that came from a stored shopping match are accepted by the route.
export async function fetchShoppingImage(link, { request = https.request, resolve = lookup, maxBytes = 2_000_000 } = {}) {
  const url = new URL(link);
  if (url.protocol !== 'https:') throw Error('Picture is not on a secure site');
  const addresses = await resolve(url.hostname, { all: true, family: 4 });
  if (!addresses.length || addresses.some(x => !publicIPv4(x.address))) throw Error('Picture address is not public');
  const address = addresses[0].address;
  return new Promise((ok, no) => {
    const req = request(url, {
      method: 'GET',
      headers: { 'user-agent': 'ResearchAgentWishlist/1.0', accept: 'image/*' },
      lookup: (_host, options, callback) => callback(null, options.all ? [{ address, family: 4 }] : address, 4)
    }, res => {
      if (res.statusCode !== 200 || !/^image\//i.test(res.headers['content-type'] || '')) { res.destroy(); return no(Error('No picture was returned')); }
      const chunks = []; let size = 0;
      res.on('data', data => {
        size += data.length;
        if (size > maxBytes) { res.destroy(); no(Error('Picture is too large')); } else chunks.push(data);
      });
      res.on('error', no);
      res.on('end', () => ok({ type: res.headers['content-type'], bytes: Buffer.concat(chunks) }));
    });
    req.setTimeout(15000, () => req.destroy(Error('Picture took too long')));
    req.on('error', no);
    req.end();
  });
}
