import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { processVideo } from '../src/processor.mjs';
import { LibraryStore } from '../src/store.mjs';

const run = promisify(execFile);
const workspace = path.resolve('.');
const job = { id: 'cleanup-job', url: 'https://www.instagram.com/reel/CLEANUP/', title: 'Cleanup test' };

async function setup(t) {
  const root = await mkdtemp(path.join(workspace, '.media-cleanup-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const fixture = path.join(root, 'clip.mp4');
  await run('ffmpeg', ['-nostdin', '-hide_banner', '-v', 'error', '-f', 'lavfi', '-i', 'color=blue:s=64x64:r=5', '-t', '1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-threads', '1', '-y', fixture]);
  return { root, fixture, scratchRoot: path.join(root, 'scratch'), thumbnailRoot: path.join(root, 'thumbs') };
}

function completeAnalysis() {
  return {
    summary: 'A saved summary.',
    transcript: 'A transcript.',
    title: 'Saved title',
    recommendations: [],
    answers: {
      what: { bullets: ['One', 'Two'], explanation: 'Explanation.' },
      why: { bullets: ['One', 'Two'], explanation: 'Explanation.' },
      next: { bullets: ['One', 'Two'], explanation: 'Explanation.' },
    },
    provenance: { provider: 'deepseek' },
    researchStatus: 'complete',
    sourceVerification: 'completed',
    verification: 'NOT VERIFIED',
  };
}

test('successful analysis deletes video/audio and reports freed bytes', async (t) => {
  const x = await setup(t);
  const result = await processVideo(job, {
    scratchRoot: x.scratchRoot,
    thumbnailRoot: x.thumbnailRoot,
    fixturePath: x.fixture,
    analyze: async () => completeAnalysis(),
  });
  assert.ok(['completed', 'needs_analysis'].includes(result.status));
  assert.ok(result.result.extraction.mediaFreedBytes > 0);
  assert.deepEqual(await readdir(x.scratchRoot), []);
  assert.equal(await stat(path.join(x.root, 'retained-media', job.id)).catch(() => null), null);

  const store = new LibraryStore(':memory:');
  t.after(() => store.close());
  store.import([{ shortcode: job.id, url: job.url, title: job.title, collections: [] }]);
  store.finish(job.id, result);
  const stats = store.cleanupStats();
  assert.equal(stats.posts, 1);
  assert.ok(stats.bytes > 0);
});

test('failed analysis keeps the video for Retry', async (t) => {
  const x = await setup(t);
  const result = await processVideo(job, {
    scratchRoot: x.scratchRoot,
    thumbnailRoot: x.thumbnailRoot,
    fixturePath: x.fixture,
    analyze: async () => { throw Error('provider down'); },
  });
  assert.equal(result.status, 'failed');
  assert.equal(result.result.extraction.mediaKept, true);
  assert.deepEqual(await readdir(x.scratchRoot), []);
  const retained = path.join(x.root, 'retained-media', job.id, 'input.mp4');
  assert.ok((await stat(retained)).size > 0, 'video kept for Retry');
});

test('reference media is never deleted by the cleaner', async (t) => {
  const x = await setup(t);
  const result = await processVideo({ ...job, id: 'reference-job', collections: ['reference'] }, {
    scratchRoot: x.scratchRoot,
    thumbnailRoot: x.thumbnailRoot,
    fixturePath: x.fixture,
    analyze: async () => completeAnalysis(),
  });
  assert.equal(result.result.extraction.mediaKept, true);
  const retained = path.join(x.root, 'retained-media', 'reference-job', 'input.mp4');
  assert.ok((await stat(retained)).size > 0, 'reference media preserved');
});
