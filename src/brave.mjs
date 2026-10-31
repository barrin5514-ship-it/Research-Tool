// One small client for the Brave Search API (web results only; Brave has no
// shopping endpoint). The key is read on the server and never sent to the page,
// printed, or logged. Brave gives $5 of free credit each month, which is about
// 1,000 searches at $5 per 1,000; paid overage is never used.
import https from 'node:https';
import {lookup} from 'node:dns/promises';
import {publicIPv4} from './store-price.mjs';
export const BRAVE_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';
export const BRAVE_COST_USD = 0.005;
export const BRAVE_FREE_MONTHLY = 1000;

// The owner's .env currently spells the name BRAVE_APY_KEY; accept both spellings.
export function braveKey(env = process.env) {
  const value = env.BRAVE_API_KEY || env.BRAVE_APY_KEY;
  if (typeof value !== 'string' || !value.trim() || /[\r\n]/.test(value)) return '';
  return value.trim();
}

const UNREADABLE_HOSTS = [
  { test: /(^|\.)amazon\./i, reason: "Can't check this store" },
  { test: /(^|\.)amzn\./i, reason: "Can't check this store" }
];
const NOT_A_SHOP = /(^|\.)(instagram|facebook|tiktok|x|twitter|youtube|reddit|pinterest|linkedin)\./i;

export function canReadStore(link) {
  try {
    const host = new URL(link).hostname;
    const hit = UNREADABLE_HOSTS.find(rule => rule.test.test(host));
    return hit ? { canCheck: false, reason: hit.reason } : { canCheck: true, reason: '' };
  } catch {
    return { canCheck: false, reason: "Can't check this store" };
  }
}

export function shoppingQuery(item) {
  const product = item?.product || {};
  const parts = [product.brand, product.name, product.model]
    .filter(value => typeof value === 'string' && value.trim() && !/^product not identified$/i.test(value.trim()));
  const base = (parts.length ? parts.join(' ') : String(item?.title || ''));
  // Remove mentions, links, phone numbers and tags that only add noise to a search.
  const cleaned = base
    .replace(/@[\w.]+/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\b\d{7,}\b/g, ' ')
    .replace(/#[^\s#]+/g, ' ')
    .replace(/[•|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Instagram titles often start with chatter. Prefer the sentence with the most
  // capitalised product-like words, for example "Even G2 Smart Glasses + Even R1 Smart Ring".
  const segments = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  const capitalised = text => (text.match(/\b[A-Z][A-Za-z0-9]*/g) || []).length;
  let best = cleaned;
  if (segments.length > 1) {
    const top = segments.reduce((a, b) => (capitalised(b) > capitalised(a) ? b : a), segments[0]);
    if (capitalised(top) >= 2) best = top;
  }
  // "buy" pulls up store pages; Brave has no shopping catalogue of its own.
  return (best && !/\bbuy$/i.test(best) ? best + ' buy' : best).slice(0, 200);
}

export function parsePriceText(text) {
  const raw = typeof text === 'string' ? text.trim() : '';
  if (!raw) return { amount: null, currency: null };
  // Only the price-looking token counts, so a model name like "X1" is never read as money.
  const match = raw.match(/([$£€])\s?(\d[\d.,]*)/);
  if (!match) return { amount: null, currency: null };
  const currency = match[1] === '$' ? 'USD' : match[1] === '£' ? 'GBP' : 'EUR';
  const digits = match[2];
  const normalised = /,\d{2}$/.test(digits) && digits.includes('.')
    ? digits.replace(/\./g, '').replace(',', '.')
    : digits.replace(/,/g, '');
  const amount = Number(normalised);
  return Number.isFinite(amount) && amount >= 0 ? { amount, currency } : { amount: null, currency: null };
}

function storeName(row) {
  const named = row?.profile?.long_name || row?.profile?.name;
  if (typeof named === 'string' && named.trim()) return named.trim().slice(0, 120);
  try { return new URL(row.url).hostname.replace(/^www\./i, ''); } catch { return 'Store'; }
}

function imageOf(row) {
  const src = row?.thumbnail?.original || row?.thumbnail?.src || row?.profile?.img;
  return typeof src === 'string' && /^https:\/\//i.test(src) ? src : '';
}

// Brave returns ordinary web pages, so a "shopping match" is the best product-looking
// page we can find. Prices are read only from the visible title/snippet; nothing is guessed.
export function parseShoppingResults(body, limit = 5) {
  const rows = Array.isArray(body?.web?.results) ? body.web.results : [];
  const seen = new Set();
  const scored = [];
  for (const row of rows) {
    if (!row || typeof row.url !== 'string' || !/^https:\/\//i.test(row.url)) continue;
    let host = '';
    try { host = new URL(row.url).hostname; } catch { continue; }
    if (NOT_A_SHOP.test(host)) continue;
    if (seen.has(row.url)) continue;
    seen.add(row.url);
    const text = [row.title, row.description, ...(Array.isArray(row.extra_snippets) ? row.extra_snippets : [])].filter(Boolean).join(' ');
    const price = parsePriceText(text);
    const reachable = canReadStore(row.url);
    // Is this actually a shop page, or an article that merely mentions the product?
    const shopPath = /\/product|\/dp\/|\/p\/|\/item|\/shop|shop|store|buy/i.test(row.url + ' ' + host);
    const shopWords = /add to cart|buy now|in stock|sold by|free shipping/i.test(text);
    const storeLike = shopPath || shopWords;
    scored.push({
      // Store pages first, then pages that show a price, then everything else.
      score: (storeLike ? 4 : 0) + (price.amount !== null ? 2 : 0) + (/\/product|\/dp\/|\/p\/|\/item/i.test(row.url) ? 1 : 0),
      match: {
        title: typeof row.title === 'string' ? row.title.slice(0, 300) : '',
        store: storeName(row),
        link: row.url,
        price: price.amount,
        currency: price.currency,
        priceText: price.amount !== null ? `${price.currency} ${price.amount.toFixed(2)}` : '',
        imageUrl: imageOf(row),
        canCheck: reachable.canCheck && storeLike,
        reason: reachable.canCheck ? (storeLike ? '' : 'Not a store page') : reachable.reason
      }
    });
  }
  // Show pages that actually mention a price first, then keep Brave's own order.
  scored.sort((a, b) => b.score - a.score || 0);
  return scored.slice(0, limit).map(item => item.match);
}

export function parseWebResults(body, limit = 3) {
  const rows = Array.isArray(body?.web?.results) ? body.web.results : [];
  const seen = new Set();
  const results = [];
  for (const row of rows) {
    if (!row || typeof row.url !== 'string' || !/^https:\/\//i.test(row.url)) continue;
    if (seen.has(row.url)) continue;
    seen.add(row.url);
    const snippets = [row.description, ...(Array.isArray(row.extra_snippets) ? row.extra_snippets : [])].filter(x => typeof x === 'string' && x.trim());
    results.push({
      title: typeof row.title === 'string' ? row.title.slice(0, 200) : '',
      link: row.url,
      snippet: snippets.join(' ').slice(0, 700)
    });
    if (results.length >= limit) break;
  }
  return results;
}

// One HTTPS call to Brave. `fetcher` is replaceable so tests never touch the network.
export async function braveSearch({ kind, query, apiKey, fetcher = fetch, signal, limit, count }) {
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!key || /[\r\n]/.test(key)) throw Error('Brave search is not configured on the server');
  const text = String(query || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (text.length < 2) throw Error('Enter a product name or question to search');
  const params = new URLSearchParams({ q: text, count: String(count || (kind === 'shopping' ? 20 : 10)), safesearch: 'moderate' });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });
  let response;
  try {
    response = await fetcher(`${BRAVE_ENDPOINT}?${params}`, {
      method: 'GET',
      redirect: 'error',
      signal: controller.signal,
      headers: { 'x-subscription-token': key, accept: 'application/json' }
    });
  } catch (error) {
    throw Error(error?.name === 'AbortError' ? 'Search timed out' : 'Search service is unreachable');
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    if (response.status === 401 || response.status === 403) throw Error('Search key was refused');
    if (response.status === 402 || response.status === 429) throw Object.assign(Error('Brave reports the free search limit is reached. No paid search was made.'), { quota: true });
    throw Error('Search service returned no usable answer');
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw Error('Search service returned unreadable data');
  }
  return kind === 'shopping' ? parseShoppingResults(body, limit) : parseWebResults(body, limit);
}

// Product pictures live on other servers; fetch through this app so the page never
// loads third-party images directly. Only stored match pictures are accepted.
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
