import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LibraryStore } from '../src/store.mjs';
import { ResearchQueue } from '../src/queue.mjs';
import { createApp } from '../src/server.mjs';
import { coreLinks, coreNodes, coreMarkup, CORE_CENTER } from '../public/hero-core.mjs';
import {
  activityModel,
  ideaCount,
  knowledgeStats,
  librarySnapshot,
  mountDashboard,
  pipelineStages,
  projectSummaries,
  recentResults,
  relativeTime,
  settingsModel,
} from '../public/dashboard-view.mjs';

const projects = [
  { id: 'penny', name: 'Pennywise', enabled: true },
  { id: 'persona', name: 'Personafy', enabled: true },
];

function video(overrides = {}) {
  return {
    id: 'a',
    title: 'A post',
    status: 'completed',
    updated_at: 3000,
    collections: ['Tech'],
    result: { summary: 'A saved summary', provenance: { provider: 'deepseek' }, recommendations: [] },
    ...overrides,
  };
}

test('relative time is short and stable', () => {
  const now = Date.parse('2026-10-31T12:00:00Z');
  assert.equal(relativeTime(now - 20_000, now), 'Just now');
  assert.equal(relativeTime(now - 5 * 60_000, now), '5m ago');
  assert.equal(relativeTime(now - 3 * 3_600_000, now), '3h ago');
  assert.equal(relativeTime(now - 2 * 86_400_000, now), '2d ago');
  assert.equal(relativeTime(0, now), 'Just now');
});

test('library snapshot and pipeline stages use real statuses only', () => {
  const state = {
    projects,
    videos: [
      video({ id: 'a' }),
      video({ id: 'b', status: 'pending', updated_at: 2000, result: undefined }),
      video({ id: 'c', status: 'failed', updated_at: 1000, result: undefined }),
    ],
  };
  assert.deepEqual(librarySnapshot(state), { posts: 3, insights: 1, projects: 2 });
  const stages = pipelineStages(state);
  assert.deepEqual(stages.map((stage) => stage.key), ['ingest', 'extract', 'analyze', 'match', 'ideas']);
  assert.equal(stages[0].count, 3);
  assert.equal(stages[1].count, 0);
  assert.equal(stages[2].count, 1);
  assert.equal(pipelineStages({ ...state, queue: { running: true } })[2].active, true);
});

test('recent results are newest first and skip test fixtures', () => {
  const state = {
    videos: [
      video({ id: 'old', updated_at: 1000 }),
      video({ id: 'new', updated_at: 9000 }),
      video({ id: 'fixture', updated_at: 9900, title: 'TEST FIXTURE: ignore me' }),
      video({ id: 'none', result: undefined, status: 'pending' }),
    ],
  };
  assert.deepEqual(recentResults(state).map((item) => item.id), ['new', 'old']);
});

test('activity model reports honest progress and an idle state', () => {
  const idle = activityModel({ queue: { running: false, active: 0 } });
  assert.equal(idle.running, false);
  assert.equal(idle.percent, 0);
  const running = activityModel({
    queue: { running: true, active: 1, batchSize: 4, done: 1, estimatedSecondsLeft: 180 },
    batch: {
      active: true,
      costUSD: 0.02,
      posts: [
        { id: 'x', title: 'Working post', label: 'Working on it' },
        { id: 'y', title: 'Next post', label: 'Up next' },
      ],
    },
    videos: [],
  });
  assert.equal(running.running, true);
  assert.equal(running.title, 'Working post');
  assert.equal(running.percent, 25);
  assert.equal(running.minutesLeft, 3);
  assert.equal(running.posts.length, 2);
});

test('project summaries count only matched saved results', () => {
  const state = {
    projects,
    videos: [
      video({ result: { summary: 'A', recommendations: [{ project: 'Pennywise', application: 'Try this' }] } }),
      video({ id: 'b', result: { summary: 'B', recommendations: [{ project: 'Personafy', application: 'Try that' }] } }),
      video({ id: 'c', result: { summary: 'C', recommendations: [] } }),
    ],
  };
  assert.deepEqual(
    projectSummaries(state).map((project) => [project.name, project.matches]),
    [['Pennywise', 1], ['Personafy', 1]],
  );
});

test('unmatched ideas, knowledge totals and settings stay derived from state', () => {
  const state = {
    projects,
    videos: [
      video({ result: { summary: 'A', recommendations: [{ project: 'Pennywise', application: 'Known project' }] } }),
      video({
        id: 'b',
        result: {
          summary: 'B',
          recommendations: [{ project: 'Martial Arts', application: 'Unmatched idea' }],
        },
      }),
    ],
    combinedPlans: [{ projectId: 'penny', plans: [{ videoIds: ['a', 'b', 'c'] }] }],
    researchProvider: 'deepseek',
    coachlab: { configured: false },
    braveConfigured: true,
    instagramBrowser: { available: true, windowOpen: false },
    queue: { running: false, active: 0 },
  };
  assert.equal(ideaCount(state), 1);
  assert.deepEqual(knowledgeStats(state), { projects: 2, videos: 2, connections: 2 });
  const settings = settingsModel(state);
  assert.equal(settings.provider, 'deepseek');
  assert.equal(settings.instagram, 'Available');
  assert.equal(settings.brave, 'Configured');
  assert.equal(settings.queue, 'Idle');
});

test('hero core layout is deterministic and inside its sphere', () => {
  const first = coreNodes();
  assert.deepEqual(first, coreNodes());
  for (const node of first) {
    const distance = Math.hypot(node.x - CORE_CENTER.x, node.y - CORE_CENTER.y);
    assert.ok(distance <= 78.5, 'node stays inside the core');
  }
  const links = coreLinks(first);
  assert.ok(links.length > 20, 'the mesh has visible connections');
  for (const [a, b] of links) {
    assert.ok(first[a] && first[b]);
    assert.ok(a < b);
  }
  assert.match(coreMarkup(), /class="core-svg"/);
  assert.match(coreMarkup(), /core-orb/);
});

test('the redesigned page keeps every working section and control', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const required = [
    'home', 'idea-map', 'my-library', 'research-results', 'project-ideas', 'ideas', 'recipes', 'wishlist', 'settings',
    'links', 'add-links', 'manual-collection', 'files', 'import', 'instagram-status', 'instagram-connect', 'instagram-confirm',
    'stats', 'library-items', 'collections', 'post-detail-heading', 'sync-enabled', 'sync-now', 'reference-handoff-enabled',
    'batch-size', 'batch-collection', 'start', 'pause', 'batch-preview', 'batch-posts', 'deepseek-balance',
    'spending-tracker', 'excluded-options', 'research-select-all', 'research-personafy-send', 'research-coachlab-send', 'research-send-status', 'skipped-items', 'results', 'research-filter', 'my-project-list',
    'project-add', 'combine-review', 'recheck-review', 'new-ideas', 'recipe-list', 'wishlist-list', 'full-result',
    'home-projects', 'home-recent', 'pipeline-stages', 'activity-body', 'hero-core', 'sidebar-status', 'settings-provider',
  ];
  for (const id of required) assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
  assert.match(html, /class="workspace-section/);
  assert.match(html, /Research Library/);
  assert.match(html, /data-theme="dark"/);
  assert.match(html, /theme\.css/);
});

test('new theme and module assets are served locally without loosening the CSP', async () => {
  const store = new LibraryStore(':memory:');
  const queue = new ResearchQueue(store, async () => {
    throw Error('No processing allowed');
  });
  const server = createApp({ store, queue });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    for (const [path, type] of [
      ['/theme.css', /text\/css/],
      ['/dashboard-view.mjs', /javascript/],
      ['/hero-core.mjs', /javascript/],
    ]) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200, path);
      assert.match(response.headers.get('content-type'), type);
      assert.ok(!response.headers.get('content-security-policy').includes('unsafe-inline'));
      await response.arrayBuffer();
    }
    const page = await fetch(base);
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /id="home"/);
    assert.match(html, /class="source-chips"/);
  } finally {
    await new Promise((done) => server.close(done));
    store.close();
  }
});

test('dashboard mount is a no-op without its host elements', () => {
  const fakeDocument = { getElementById: () => null, addEventListener() {}, createElement() {} };
  const render = mountDashboard({ document: fakeDocument });
  assert.doesNotThrow(() => render({ videos: [], projects: [] }));
});
