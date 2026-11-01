import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquireReference } from '../src/reference-acquisition.mjs';

const meta = { caption: 'Photo post', hasVideo: false, mediaCount: 2, imageUrls: [] };

async function run(t, browser, jobMeta = meta) {
  const directory = await mkdtemp(join(tmpdir(), 'reference-photo-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const result = await acquireReference({ id: 'photo1', url: 'https://www.instagram.com/p/photo1/' }, {
    directory,
    browser,
    fetcher: async () => { throw Error('Cobalt unavailable'); },
    active: () => true,
  });
  return { directory, result };
}

test('photo posts save the actual post images when no video recording exists', async (t) => {
  const { directory, result } = await run(t, {
    referenceMetadata: async () => meta,
    capturePostImages: async () => ({ mediaCount: 2, images: [{ bytes: Buffer.from([1, 2, 3]) }, { bytes: Buffer.from([4, 5]) }] }),
    captureReference: async () => { throw Error('A full browser recording was unavailable.'); },
  });
  assert.equal(result.method, 'signed_in_post_images');
  assert.equal(result.files.length, 2);
  assert.equal(result.complete, true);
  assert.deepEqual(await readdir(directory), ['image-1.source', 'image-2.source']);
});

test('a false video flag falls back to the post images after recording fails', async (t) => {
  const { result } = await run(t, {
    referenceMetadata: async () => ({ ...meta, hasVideo: true }),
    capturePostImages: async () => ({ mediaCount: 1, images: [{ bytes: Buffer.from([9, 9]) }] }),
    captureReference: async () => { throw Error('A full browser recording was unavailable.'); },
  });
  assert.equal(result.method, 'signed_in_post_images');
  assert.equal(result.files.length, 1);
  assert.equal(result.complete, true);
});

test('a sign-in stop is not converted into a generic photo failure', async (t) => {
  await assert.rejects(run(t, {
    referenceMetadata: async () => meta,
    capturePostImages: async () => { throw Object.assign(Error('Instagram access check.'), { safetyStop: true }); },
  }), (error) => error.safetyStop === true);
});
