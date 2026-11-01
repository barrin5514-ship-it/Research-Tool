import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LibraryStore } from '../src/store.mjs';
import { ResearchQueue } from '../src/queue.mjs';
import { createApp } from '../src/server.mjs';
import { createStaticResolver, staticContentType } from '../src/static-files.mjs';

test('static resolver serves only allowlisted regular files under public', async () => {
  const root = await mkdtemp(join(tmpdir(), 'static-files-'));
  try {
    await mkdir(join(root, 'nested'));
    await writeFile(join(root, 'index.html'), '<!doctype html><title>ok</title>');
    await writeFile(join(root, 'theme.css'), 'body{color:black}');
    await writeFile(join(root, 'app.js'), 'export {};');
    await writeFile(join(root, 'nested', 'mod.mjs'), 'export {};');
    await writeFile(join(root, 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    await writeFile(join(root, '.env'), 'SECRET=1');
    await writeFile(join(root, 'data.json'), '{}');
    await writeFile(join(root, 'notes.txt'), 'nope');
    const resolveStatic = createStaticResolver({ root });

    assert.deepEqual((await resolveStatic('/'))?.type, 'text/html; charset=utf-8');
    assert.deepEqual((await resolveStatic('/theme.css'))?.type, 'text/css; charset=utf-8');
    assert.deepEqual((await resolveStatic('/app.js'))?.type, 'text/javascript; charset=utf-8');
    assert.deepEqual((await resolveStatic('/nested/mod.mjs'))?.type, 'text/javascript; charset=utf-8');
    assert.deepEqual((await resolveStatic('/icon.svg'))?.type, 'image/svg+xml');
    assert.equal((await resolveStatic('/.env')), null);
    assert.equal((await resolveStatic('/data.json')), null);
    assert.equal((await resolveStatic('/notes.txt')), null);
    assert.equal((await resolveStatic('/missing.css')), null);
    assert.equal((await resolveStatic('/nested')), null);
    assert.equal((await resolveStatic('/../theme.css')), null);
    assert.equal((await resolveStatic('/%2e%2e/theme.css')), null);
    assert.equal((await resolveStatic('/nested/%2e%2e/%2e%2e/index.html')), null);
    assert.equal((await resolveStatic('/..%5ctheme.css')), null);
    assert.equal((await resolveStatic('/api/state')), null);
    assert.equal(staticContentType('theme.css'), 'text/css; charset=utf-8');
    assert.equal(staticContentType('video.mp4'), 'application/octet-stream');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('every local asset referenced by the real page is served by the real app', async () => {
  const store = new LibraryStore(':memory:');
  const queue = new ResearchQueue(store, async () => {
    throw Error('No processing allowed');
  });
  const server = createApp({ store, queue });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const page = await fetch(base);
    assert.equal(page.status, 200);
    const html = await page.text();
    const refs = [...html.matchAll(/(?:src|href)="(\/[^"#]+)"/g)].map((match) => match[1]);
    assert.ok(refs.includes('/theme.css'), 'theme stylesheet is referenced');
    assert.ok(refs.includes('/app.js'), 'app module is referenced');
    for (const ref of new Set(refs)) {
      const response = await fetch(base + ref);
      assert.equal(response.status, 200, ref);
      assert.ok(!response.headers.get('content-security-policy').includes('unsafe-inline'));
      await response.arrayBuffer();
    }
    for (const path of ['/theme.css', '/dashboard-view.mjs', '/hero-core.mjs', '/favicon.svg', '/vendor/three/three.module.js']) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200, path);
      await response.arrayBuffer();
    }
    for (const path of ['/.env', '/data.json', '/vendor/three/../../.research-data/library.sqlite']) {
      assert.equal((await fetch(base + path)).status, 404, path);
    }
    assert.match(await readFile('public/index.html', 'utf8'), /theme\.css/);
  } finally {
    await new Promise((done) => server.close(done));
    store.close();
  }
});
