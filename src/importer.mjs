/**
 * Read-only Instagram export parser. Nothing in an export is evaluated or fetched.
 * HTML parsing patterns are adapted from Instagram Saved Library (MIT).
 * See THIRD_PARTY_NOTICES.md for attribution and license.
 */
export const MAX_EXPORT_BYTES = 10 * 1024 * 1024;

const ENTITIES = Object.freeze({
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  hellip: '…', copy: '©', reg: '®', trade: '™', bull: '•',
});

function decodeEntities(value) {
  return String(value).replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (original, code) => {
    if (!code.startsWith('#')) return ENTITIES[code] ?? original;
    const point = code[1].toLowerCase() === 'x'
      ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
    return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
      ? String.fromCodePoint(point) : '\uFFFD';
  });
}

function htmlText(value) {
  // Remove markup before decoding: escaped markup stays literal text.
  return decodeEntities(String(value).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function plainText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

export function normalizeInstagramUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 4096) {
    throw new Error('Instagram URL must be a nonempty string of at most 4096 characters.');
  }
  if (/[\u0000-\u001f\u007f\\]/u.test(raw)) throw new Error('Invalid characters in Instagram URL.');
  const input = decodeEntities(raw.trim());
  if (/[\u0000-\u0020\u007f\\]/u.test(input)) throw new Error('Invalid characters in Instagram URL.');
  let parsed;
  try { parsed = new URL(input); } catch { throw new Error('Invalid Instagram URL.'); }
  if (!['https:', 'http:'].includes(parsed.protocol)
    || !['instagram.com', 'www.instagram.com'].includes(parsed.hostname.toLowerCase())
    || parsed.username || parsed.password || parsed.port) {
    throw new Error('Only public Instagram post URLs without credentials or custom ports are accepted.');
  }
  const path = parsed.pathname.match(/^\/(?:p|reel|tv)\/([A-Za-z0-9_-]{3,64})\/?$/);
  if (!path) throw new Error('Expected an Instagram /p/, /reel/, or /tv/ post URL.');
  const shortcode = path[1];
  return { url: `https://www.instagram.com/p/${shortcode}/`, shortcode };
}

function parseHtml(text, add, warn) {
  const raw = text.replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  // The official export shape has a collection Name row followed by Type.
  // Do not treat creators' Name rows or arbitrary headings as collections.
  const collectionPattern = /<td\b[^>]*>\s*Name\s*<\/td>\s*<td\b[^>]*>((?:(?!<\/td\s*>)[\s\S])*)<\/td\s*>\s*<\/tr>\s*<tr\b[^>]*>\s*<td\b[^>]*>\s*Type\s*<\/td>/gi;
  const collections = [...raw.matchAll(collectionPattern)].map(match => ({
    index: match.index, name: htmlText(match[1]),
  }));
  const postPattern = /\bURL\s*(?:<\/td>\s*<td\b[^>]*>\s*)?(?:<div\b[^>]*>\s*)?<a\b[^>]*\shref\s*=\s*(["'])(.*?)\1/gi;
  const posts = [...raw.matchAll(postPattern)];
  if (!posts.length && !collections.length && !/\bSaved (?:posts|collections)\b/i.test(htmlText(raw))) {
    throw new Error('Unsupported HTML export: expected saved-post URL fields or named collection records.');
  }
  let collectionIndex = -1;
  for (let i = 0; i < posts.length; i += 1) {
    const match = posts[i];
    while (collectionIndex + 1 < collections.length && collections[collectionIndex + 1].index < match.index) {
      collectionIndex += 1;
    }
    const nextPost = posts[i + 1]?.index ?? raw.length;
    const nextCollection = collections[collectionIndex + 1]?.index ?? raw.length;
    const block = raw.slice(match.index, Math.min(nextPost, nextCollection));
    const caption = block.match(/\bCaption\s*<\/td>\s*<td\b[^>]*>([\s\S]*?)<\/td>/i);
    const collection = collectionIndex >= 0 ? collections[collectionIndex].name : '';
    add(match[2], caption ? htmlText(caption[1]) : '', collection ? [collection] : []);
  }
  if (collections.some(collection => !collection.name)) warn('An empty collection name was ignored.');
  if (!posts.length) warn('The recognized HTML export contains no supported post URL fields.');
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseJson(text, filename, add, warn) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Malformed JSON export.'); }
  let recognized = false;

  function post(entry, collections, direct = false) {
    if (typeof entry === 'string' && direct) { add(entry, '', collections); return; }
    if (!isObject(entry)) throw new Error('Unsupported saved-post entry: expected an object.');
    if(Array.isArray(entry.label_values)||Array.isArray(entry.dict)){
      const fields=entry.label_values??entry.dict;
      const link=fields.find(x=>x?.label==='URL');
      const caption=fields.find(x=>x?.label==='Caption');
      if(typeof (link?.href||link?.value)!=='string')throw new Error('Labeled saved-post record has no URL.');
      add(link.href||link.value,plainText(caption?.value),collections);return;
    }
    const saved = entry.string_map_data?.['Saved on'];
    const title = plainText(entry.caption ?? entry.string_map_data?.Caption?.value);
    if (typeof saved?.href === 'string') { add(saved.href, title, collections); return; }
    if (Array.isArray(entry.string_list_data)) {
      const links = entry.string_list_data.filter(value => typeof value?.href === 'string');
      if (!links.length) throw new Error('Saved-post record has no href in string_list_data.');
      for (const value of links) add(value.href, title, collections);
      return;
    }
    if (direct && typeof (entry.url ?? entry.href) === 'string') {
      add(entry.url ?? entry.href, title || plainText(entry.title), collections);
      return;
    }
    throw new Error('Unsupported saved-post record: no recognized Instagram URL field.');
  }

  function posts(entries, memberships = [], direct = false) {
    if (!Array.isArray(entries)) throw new Error('Saved-post records must be an array.');
    for (const entry of entries) post(entry, memberships, direct);
  }

  function collectionRecords(entries) {
    if (isObject(entries)) {
      // An explicit collection-name -> posts map. Keys are names only here.
      for (const [name, members] of Object.entries(entries)) {
        const cleaned = plainText(name);
        if (!cleaned) warn('An empty collection name was ignored.');
        posts(members, cleaned ? [cleaned] : [], true);
      }
      return;
    }
    if (!Array.isArray(entries)) throw new Error('Saved collections must be an array or a named collection map.');
    for (const entry of entries) {
      if (!isObject(entry)) throw new Error('Unsupported collection record.');
      if(Array.isArray(entry.label_values)){
        const name=plainText(entry.label_values.find(x=>x?.label==='Name')?.value);
        const media=entry.label_values.find(x=>x?.title==='Media'&&Array.isArray(x.dict));
        if(!name)warn('A collection record has no explicit name; its posts remain unassigned.');
        if(!media)throw new Error('Labeled collection record has no Media group.');
        posts(media.dict,name?[name]:[],false);continue;
      }
      const name = plainText(entry.name ?? entry.collection_name ?? entry.string_map_data?.Name?.value);
      // title commonly names a creator in saved posts; it is never membership evidence.
      if (!name) warn('A collection record has no explicit name; its posts remain unassigned.');
      const memberships = name ? [name] : [];
      let found = false;
      for (const key of ['items', 'posts', 'media', 'urls', 'saved_saved_media', 'saved_posts']) {
        if (Object.hasOwn(entry, key)) { posts(entry[key], memberships, true); found = true; }
      }
      if (entry.string_map_data?.['Saved on']?.href || Array.isArray(entry.string_list_data)) {
        post(entry, memberships); found = true;
      }
      if (!found) warn('A collection record has no recognized member URL fields; its membership could not be imported.');
    }
  }

  if (isObject(data)) {
    for (const key of ['saved_saved_media', 'saved_posts']) {
      if (Object.hasOwn(data, key)) { posts(data[key]); recognized = true; }
    }
    for (const key of ['saved_saved_collections', 'saved_collections', 'collections']) {
      if (Object.hasOwn(data, key)) { collectionRecords(data[key]); recognized = true; }
    }
  } else if (Array.isArray(data)) {
    const base = filename.replaceAll('\\', '/').split('/').at(-1).toLowerCase();
    if (/^saved_posts(?:_\d+)?\.json$/.test(base)) { posts(data); recognized = true; }
    if (/^saved_collections(?:_\d+)?\.json$/.test(base)) { collectionRecords(data); recognized = true; }
  }
  if (!recognized) throw new Error('Unsupported JSON export: no recognized saved-post or collection structure.');
}

export function parseExport(text, { filename = '' } = {}) {
  if (typeof text !== 'string') throw new TypeError('Export content must be text.');
  if (typeof filename !== 'string') throw new TypeError('Export filename must be text.');
  if (Buffer.byteLength(text, 'utf8') > MAX_EXPORT_BYTES) throw new Error('Export exceeds the 10 MiB input limit.');
  const input = text.replace(/^\uFEFF/, '').trim();
  if (!input) throw new Error('Export is empty.');
  const byShortcode = new Map();
  const warnings = new Set();
  let duplicates = 0;
  const warn = message => warnings.add(message);
  const add = (raw, title, memberships) => {
    memberships=memberships.map(name=>['Pennywise','Personafy','Tech'].find(project=>project.toLowerCase()===name.toLowerCase())||name);
    const normalized = normalizeInstagramUrl(raw);
    const originalPath = new URL(decodeEntities(raw.trim())).pathname.replace(/\/$/, '');
    const originalUrl = `https://www.instagram.com${originalPath}/`;
    const existing = byShortcode.get(normalized.shortcode);
    if (existing) {
      duplicates += 1;
      existing.collections = [...new Set([...existing.collections, ...memberships])];
      if (!existing.title && title) existing.title = title;
    } else {
      byShortcode.set(normalized.shortcode, { ...normalized, originalUrl, title, collections: [...new Set(memberships)] });
    }
  };
  if (/\.json$/i.test(filename) || /^[\[{]/.test(input)) parseJson(input, filename, add, warn);
  else if (/\.html?$/i.test(filename) || input.startsWith('<')) parseHtml(input, add, warn);
  else throw new Error('Unsupported export format. Choose an Instagram saved-post or collection JSON/HTML file.');
  const items = [...byShortcode.values()];
  if (duplicates) warn(`${duplicates} duplicate URL record${duplicates === 1 ? '' : 's'} merged by Instagram shortcode.`);
  if (items.some(item => !item.collections.length)) warn('Some posts have no collection membership in the export and remain unassigned. Creator names were not used as collections.');
  if (!items.length) warn('No post URLs were imported; check the export format and selected Saved information.');
  return { items, warnings: [...warnings] };
}
