import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { cleanupStaleAttempts, processVideo } from '../src/processor.mjs';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const job = { id: 'test-job', url: 'https://www.instagram.com/reel/TEST_CLIP/' };
const json = (value, init = {}) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' }, ...init });

async function setup(t) {
  const directory = await mkdtemp(path.join(workspace, '.processor-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const scratchRoot = path.join(directory, 'scratch');
  const sentinel = path.join(directory, 'unrelated.txt');
  await writeFile(sentinel, 'keep me');
  return {
    directory, scratchRoot,
    async clean() {
      assert.deepEqual(await readdir(scratchRoot), [], 'attempt media must be removed');
      assert.equal(await readFile(sentinel, 'utf8'), 'keep me', 'unrelated files must survive');
    },
  };
}

test('requests proxy mode and refuses a remote tunnel before downloading', async (t) => {
  const state = await setup(t);
  let calls = 0;
  await assert.rejects(processVideo(job, {
    scratchRoot: state.scratchRoot,
    fetcher: async (url, options) => {
      calls += 1;
      assert.equal(url, 'http://127.0.0.1:9100/');
      assert.equal(options.redirect, 'manual');
      assert.equal(JSON.parse(options.body).alwaysProxy, true);
      return json({ status: 'tunnel', url: 'https://example.com/tunnel?id=x' });
    },
  }), { code: 'UNSAFE_TUNNEL', retryable: false });
  assert.equal(calls, 1);
  await state.clean();
});

test('refuses a different loopback port and an unrelated same-origin endpoint', async (t) => {
  const state = await setup(t);
  for (const url of ['http://127.0.0.1:1234/tunnel?id=x', 'http://127.0.0.1:9100/admin']) {
    await assert.rejects(processVideo(job, {
      scratchRoot: state.scratchRoot,
      fetcher: async () => json({ status: 'tunnel', url }),
    }), { code: 'UNSAFE_TUNNEL' });
  }
  await state.clean();
});

test('does not follow API or media redirects', async (t) => {
  const state = await setup(t);
  for (const redirectAt of [1, 2]) {
    let calls = 0;
    await assert.rejects(processVideo(job, {
      scratchRoot: state.scratchRoot,
      fetcher: async () => {
        calls += 1;
        if (calls === redirectAt) return new Response('', { status: 302, headers: { location: 'http://127.0.0.1:1234/' } });
        return json({ status: 'tunnel', url: 'http://127.0.0.1:9100/tunnel?id=x' });
      },
    }), { code: 'REDIRECT_REFUSED' });
    assert.equal(calls, redirectAt);
  }
  await state.clean();
});

test('propagates HTTP rate limits with bounded retry delay', async (t) => {
  const state = await setup(t);
  await assert.rejects(processVideo(job, {
    scratchRoot: state.scratchRoot,
    fetcher: async () => new Response('', { status: 429, headers: { 'retry-after': '37' } }),
  }), { code: 'COBALT_HTTP', retryable: true, retryAfterMs: 37_000 });
  await state.clean();
});

test('Cobalt JSON rate limits request a queue-wide cooldown', async (t) => {
  const state = await setup(t);
  await assert.rejects(processVideo(job, {
    scratchRoot: state.scratchRoot,
    fetcher: async () => json({ status: 'error', error: { code: 'error.api.rate_limit' } }),
  }), { code: 'COBALT_REJECTED', retryable: true, retryAfterMs: 30_000 });
  await state.clean();
});

test('rejects oversized media from Content-Length before body consumption', async (t) => {
  const state = await setup(t);
  let calls = 0;
  await assert.rejects(processVideo(job, {
    scratchRoot: state.scratchRoot,
    fetcher: async () => ++calls === 1
      ? json({ status: 'tunnel', url: 'http://127.0.0.1:9100/tunnel?id=x' })
      : new Response('small body', { headers: { 'content-type': 'video/mp4', 'content-length': String(80 * 1024 * 1024 + 1) } }),
  }), { code: 'SIZE_LIMIT', retryable: false });
  assert.equal(calls, 2);
  await state.clean();
});

test('bounds streamed API JSON even without a Content-Length header', async (t) => {
  const state = await setup(t);
  await assert.rejects(processVideo(job, {
    scratchRoot: state.scratchRoot,
    fetcher: async () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(65 * 1024)); controller.close(); },
    })),
  }), { code: 'SIZE_LIMIT' });
  await state.clean();
});

test('marks multi-item posts skipped without pretending to analyze them', async (t) => {
  const state = await setup(t);
  const outcome = await processVideo(job, { scratchRoot: state.scratchRoot, fetcher: async () => json({ status: 'picker', picker: [] }) });
  assert.equal(outcome.status, 'skipped');
  assert.equal(outcome.result.verification, 'NOT VERIFIED');
  assert.equal(outcome.result.summary, null);
  assert.equal(outcome.result.extraction.framesExtracted, 0);
  await state.clean();
});

test('cancellation ends even an uncooperative fetcher and cleans its attempt', async (t) => {
  const state = await setup(t);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30);
  try {
    await assert.rejects(processVideo(job, {
      scratchRoot: state.scratchRoot, signal: controller.signal, fetcher: async () => new Promise(() => {}),
    }), { code: 'CANCELLED', retryable: false });
  } finally { clearTimeout(timer); }
  await state.clean();
});

test('rejects non-Instagram source URLs without making a request', async (t) => {
  const state = await setup(t);
  await assert.rejects(processVideo({ url: 'http://169.254.169.254/video.mp4' }, {
    scratchRoot: state.scratchRoot, fetcher: () => { throw new Error('must not fetch'); },
  }), { code: 'INVALID_SOURCE' });
  await state.clean();
});

test('cleans a downloaded file when the local probe cannot start', async (t) => {
  const state = await setup(t);
  let calls = 0;
  await assert.rejects(processVideo(job, {
    scratchRoot: state.scratchRoot, ffprobe: 'research-agent-ffprobe-does-not-exist',
    fetcher: async () => ++calls === 1
      ? json({ status: 'tunnel', url: 'http://127.0.0.1:9100/tunnel?id=x' })
      : new Response('not really a video', { headers: { 'content-type': 'video/mp4' } }),
  }), { code: 'MEDIA_TOOL_UNAVAILABLE', retryable: false });
  await state.clean();
});

test('refuses workspace root, outside scratch directories, and configuration directories', async () => {
  for (const scratchRoot of [workspace, path.dirname(workspace), path.join(workspace, '.git', 'scratch')]) {
    await assert.rejects(processVideo(job, { scratchRoot }), { code: 'UNSAFE_PATH' });
  }
});

test('refuses scratch paths through junctions without deleting their target', async (t) => {
  const state = await setup(t);
  const target = path.join(state.directory, 'target');
  const link = path.join(state.directory, 'link');
  await mkdir(target);
  await writeFile(path.join(target, 'keep.txt'), 'keep');
  try { await symlink(target, link, process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) return t.skip('Host does not allow test symlinks'); throw error; }
  await assert.rejects(processVideo(job, { scratchRoot: path.join(link, 'scratch') }), { code: 'UNSAFE_PATH' });
  assert.equal(await readFile(path.join(target, 'keep.txt'), 'utf8'), 'keep');
});

test('startup cleanup removes only marked attempts with confirmed dead owners', async (t) => {
  const state = await setup(t);
  await mkdir(state.scratchRoot);
  const deadPid = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', ''], { windowsHide: true, stdio: 'ignore' });
    child.on('error', reject);
    child.on('close', () => resolve(child.pid));
  });
  const dirs = ['video-attempt-orphan', 'video-attempt-active', 'video-attempt-unmarked', 'video-attempt-foreign', 'unrelated-folder'];
  for (const name of dirs) {
    await mkdir(path.join(state.scratchRoot, name));
    await writeFile(path.join(state.scratchRoot, name, 'keep.txt'), 'evidence');
  }
  for (const [name, pid, tag] of [
    ['video-attempt-orphan', deadPid, 'research-agent-video-attempt-v1'],
    ['video-attempt-active', process.pid, 'research-agent-video-attempt-v1'],
    ['video-attempt-foreign', deadPid, 'another-library'],
  ]) {
    await writeFile(path.join(state.scratchRoot, name, '.research-agent-owner.json'), JSON.stringify({ tag, pid, token: randomUUID() }));
  }
  assert.deepEqual(await cleanupStaleAttempts(state.scratchRoot), { removed: 1 });
  assert.deepEqual((await readdir(state.scratchRoot)).sort(), dirs.filter((name) => name !== 'video-attempt-orphan').sort());
  assert.deepEqual(await cleanupStaleAttempts(state.scratchRoot), { removed: 0 });
});
