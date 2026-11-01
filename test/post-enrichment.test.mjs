import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LibraryStore } from '../src/store.mjs';
import { captionFirstLine, enrichPosts } from '../src/post-enrichment.mjs';

const run = promisify(execFile);

async function jpegFixture(root) {
  const file = join(root, 'fixture.jpg');
  await run('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=blue:s=32x32', '-frames:v', '1', '-q:v', '5', '-y', file]);
  return readFile(file);
}

test('captionFirstLine keeps only the first non-empty line', () => {
  assert.equal(captionFirstLine('\n  First line  \nSecond line'), 'First line');
  assert.equal(captionFirstLine(''), '');
  assert.equal(captionFirstLine('9,337 likes, 215 comments - user on September 11, 2026: "Goodnight"'), 'Goodnight');
  assert.equal(captionFirstLine('36K likes, 355 comments - user on October 1, 2026: "Hello"'), 'Hello');
});

test('enrichPosts updates title and thumbnail from the signed-in browser', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'enrich-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const jpeg = await jpegFixture(root);
  const thumbnailRoot = join(root, 'thumbs');
  const store = new LibraryStore(':memory:');
  t.after(() => store.close());
  store.import([{ shortcode: 'Placeholder1', url: 'https://www.instagram.com/p/Placeholder1/', title: 'Instagram post', collections: ['Personafy'] }]);
  let calls = 0;
  const result = await enrichPosts({
    store,
    thumbnailRoot,
    ids: ['Placeholder1'],
    delayMs: 0,
    wait: async () => {},
    browser: {
      async referenceMetadata() {
        calls += 1;
        return { caption: 'A real first line\nMore caption text', imageUrls: ['https://img.example/a.jpg'] };
      },
    },
    fetchImage: async () => ({ bytes: jpeg, type: 'image/jpeg' }),
    prepareThumbnail: async () => jpeg,
  });
  assert.equal(result.done, 1);
  assert.equal(calls, 1);
  assert.equal(store.get('Placeholder1').title, 'A real first line');
  assert.equal((await readdir(thumbnailRoot)).filter((name) => name.endsWith('.jpg')).length, 1);
});

test('no real caption uses the account fallback title and keeps the description out of it', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'enrich-fallback-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const jpeg = await jpegFixture(root);
  const store = new LibraryStore(':memory:');
  t.after(() => store.close());
  store.import([{ shortcode: 'NoCaption1', url: 'https://www.instagram.com/p/NoCaption1/', title: 'Instagram post', collections: [] }]);
  const result = await enrichPosts({
    store,
    thumbnailRoot: join(root, 'thumbs'),
    ids: ['NoCaption1'],
    delayMs: 0,
    wait: async () => {},
    browser: { async postPreview() { return { caption: '9,337 likes, 215 comments - rawred on September 11, 2026:', username: 'rawred', thumbnailBase64: jpeg.toString('base64') }; } },
    prepareThumbnail: async () => jpeg,
  });
  assert.equal(result.done, 1);
  assert.equal(store.get('NoCaption1').title, 'Instagram post from @rawred');
});
test('enrichPosts stops on the first warning and keeps the rest untouched', async (t) => {
  const store = new LibraryStore(':memory:');
  t.after(() => store.close());
  store.import([{ shortcode: 'Stop1', url: 'https://www.instagram.com/p/Stop1/', title: 'Instagram post', collections: [] }]);
  let calls = 0;
  const result = await enrichPosts({
    store,
    thumbnailRoot: join(tmpdir(), 'never-written'),
    ids: ['Stop1'],
    delayMs: 0,
    wait: async () => {},
    browser: {
      async referenceMetadata() {
        calls += 1;
        throw Object.assign(Error('Instagram access check.'), { safetyStop: true });
      },
    },
  });
  assert.equal(calls, 1);
  assert.match(result.stopped, /sign-in or security check/i);
  assert.equal(store.get('Stop1').title, 'Instagram post');
});
