import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_EXPORT_BYTES, normalizeInstagramUrl, parseExport } from '../src/importer.mjs';

const saved = (url, creator = 'creator_not_collection') => ({
  title: creator, string_map_data: { 'Saved on': { href: url, timestamp: 1700000000 } },
});
const header = name => `<table><tr><td>Name</td><td>${name}</td></tr><tr><td>Type</td><td>Saved collection</td></tr></table>`;
const htmlPost = (url, caption = '') => `URL<div><a href="${url}">Link</a></div><table><tr><td>Caption</td><td>${caption}</td></tr><tr><td>Name</td><td>Creator</td></tr></table>`;

test('normalizes Instagram post aliases, host, query, fragment and trailing slash', () => {
  for (const raw of ['https://instagram.com/reel/Abc_123-/?igsh=x#saved', 'http://www.instagram.com/tv/Abc_123-', 'https://www.instagram.com/p/Abc_123-/']) {
    assert.deepEqual(normalizeInstagramUrl(raw), { url: 'https://www.instagram.com/p/Abc_123-/', shortcode: 'Abc_123-' });
  }
});

test('rejects credentials, other hosts, protocols, paths and encoded/control tricks', () => {
  for (const raw of [
    'https://user:password@instagram.com/p/Abc123/', 'https://instagram.com.evil.test/p/Abc123/',
    'https://evilinstagram.com/p/Abc123/', 'https://instagram.com:9100/p/Abc123/',
    'file:///p/Abc123/', 'javascript:alert(1)', 'https://instagram.com/stories/Abc123/',
    'https://instagram.com/p/Abc123/more', 'https://instagram.com/p/%41bc123/',
    'https://instagram.com/p/Abc123/\n', 'https://instagram.com\\@evil.test/p/Abc123/',
    'https://instagram.com/p/a/', 'https://instagram.com/p/Abc 123/',
  ]) assert.throws(() => normalizeInstagramUrl(raw), undefined, raw);
});

test('imports known HTML Name/Type collections, captions and merged membership', () => {
  const text = '<!doctype html><html><body>'
    + header('Pennywise') + htmlPost('https://instagram.com/reel/Shared123/?igsh=x', 'Risk &amp; rewards')
    + header('Personafy') + htmlPost('http://www.instagram.com/p/Shared123/')
    + header('Tech') + htmlPost('https://www.instagram.com/tv/Other123/', 'Local tools') + '</body></html>';
  const result = parseExport(text, { filename: 'saved_collections.html' });
  assert.equal(result.items.length, 2);
  assert.deepEqual(result.items[0].collections, ['Pennywise', 'Personafy']);
  assert.equal(result.items[0].title, 'Risk & rewards');
  assert.deepEqual(result.items[1].collections, ['Tech']);
  assert.match(result.warnings.join(' '), /duplicate/);
});

test('HTML escaped malicious collection names remain text and scripts are ignored', () => {
  const name = "Research&#39;);globalThis.pwned=true;// &lt;img src=x onerror=alert(1)&gt;";
  const result = parseExport(header(name) + htmlPost('https://instagram.com/p/Safe123/')
    + '<script>URL<div><a href="https://evil.test/p/Bad123/">Fake</a></script>', { filename: 'saved_collections.html' });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].collections[0], "Research');globalThis.pwned=true;// <img src=x onerror=alert(1)>");
  assert.equal(globalThis.pwned, undefined);
});

test('imports official saved_saved_media JSON without inventing creator membership', () => {
  const result = parseExport(JSON.stringify({ saved_saved_media: [saved('https://www.instagram.com/reel/Video123/', 'Pennywise')] }), { filename: 'saved_posts.json' });
  assert.deepEqual(result.items, [{ url: 'https://www.instagram.com/p/Video123/', shortcode: 'Video123', originalUrl: 'https://www.instagram.com/reel/Video123/', title: '', collections: [] }]);
  assert.match(result.warnings.join(' '), /unassigned/);
});

test('imports explicit named JSON collections and deduplicates updated aliases', () => {
  const result = parseExport(JSON.stringify({
    saved_saved_media: [saved('https://instagram.com/p/Video123/?x=1')],
    saved_saved_collections: [
      { string_map_data: { Name: { value: "Tech & Barry's" } }, items: [saved('https://instagram.com/tv/Video123/')] },
      { name: 'Personafy', urls: ['https://www.instagram.com/reel/Video123/?igsh=two', 'https://instagram.com/p/New123/'] },
    ],
  }));
  assert.equal(result.items.length, 2);
  assert.deepEqual(result.items[0].collections, ["Tech & Barry's", 'Personafy']);
  assert.deepEqual(result.items[1].collections, ['Personafy']);
});

test('explicit collection maps and missing names preserve only evidenced membership', () => {
  const mapped = parseExport(JSON.stringify({ collections: { Tech: ['https://instagram.com/reel/Map123/'] } }));
  assert.deepEqual(mapped.items[0].collections, ['Tech']);
  const unnamed = parseExport(JSON.stringify({ saved_collections: [{ title: 'Pennywise', posts: [saved('https://instagram.com/p/Missing123/')] }] }));
  assert.deepEqual(unnamed.items[0].collections, []);
  assert.match(unnamed.warnings.join(' '), /explicit name/);
});

test('older string_list_data and filename-scoped arrays are supported', () => {
  const result = parseExport(JSON.stringify([{ title: 'Personafy', string_list_data: [{ href: 'https://instagram.com/p/Older123/' }] }]), { filename: 'saved_posts_1.json' });
  assert.equal(result.items[0].shortcode, 'Older123');
  assert.deepEqual(result.items[0].collections, []);
});

test('standalone HTML posts retain unknown collection membership', () => {
  const result = parseExport(htmlPost('https://instagram.com/p/Loose123/', '&#x1F4A1; &lt;b&gt;idea&lt;/b&gt;'), { filename: 'saved_posts.html' });
  assert.deepEqual(result.items[0].collections, []);
  assert.equal(result.items[0].title, '💡 <b>idea</b>');
});

test('empty recognized exports are explicit and malformed/unsupported inputs fail', () => {
  assert.equal(parseExport('{"saved_saved_media":[]}').items.length, 0);
  assert.match(parseExport('{"saved_saved_media":[]}').warnings.join(' '), /No post URLs/);
  for (const [input, filename] of [
    ['{"saved_saved_media":', 'saved_posts.json'], ['{"unexpected":[]}', 'saved_posts.json'],
    ['{"saved_saved_media":{}}', 'saved_posts.json'], ['{"saved_saved_media":[{}]}', 'saved_posts.json'],
    ['<html><body>unrecognized page</body></html>', 'saved_posts.html'], ['[]', 'unknown.json'],
    ['not an export', 'saved_posts.csv'], ['', 'saved_posts.json'],
  ]) assert.throws(() => parseExport(input, { filename }), undefined, input);
});

test('bad imported URLs fail instead of becoming downloadable jobs', () => {
  assert.throws(() => parseExport(JSON.stringify({ saved_saved_media: [saved('https://127.0.0.1:9100/')] })), /Only public Instagram/);
  assert.throws(() => parseExport(htmlPost('https://example.com/p/Fake123/'), { filename: 'saved_posts.html' }), /Only public Instagram/);
});

test('input limit counts UTF-8 bytes and supports BOM', () => {
  assert.throws(() => parseExport('a'.repeat(MAX_EXPORT_BYTES + 1)), /10 MiB/);
  assert.throws(() => parseExport('💡'.repeat(Math.floor(MAX_EXPORT_BYTES / 4) + 1)), /10 MiB/);
  assert.equal(parseExport('\uFEFF{"saved_saved_media":[]}').items.length, 0);
});
