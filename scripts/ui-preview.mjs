// Local UI preview for the redesign. Serves synthetic records from an in-memory
// SQLite database so screenshots never touch .research-data or start paid work.
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { LibraryStore } from '../src/store.mjs';
import { ResearchQueue } from '../src/queue.mjs';
import { BatchController } from '../src/batches.mjs';
import { saveThumbnail } from '../src/thumbnails.mjs';

const port = Number(process.env.PREVIEW_PORT || 5230);
const root = await mkdtemp(join(tmpdir(), 'research-ui-preview-'));
const thumbnailRoot = join(root, 'thumbnails');
const batchRoot = join(root, 'batches');
const usageFile = join(root, 'usage.jsonl');
const now = Date.now();

// Keep the preview fully isolated from the real spending ledger and balance.
const usage = [
  { at: now - 4 * 86_400_000, videoId: 'PREVIEW04', kind: 'video', usage: { inputTokens: 940, outputTokens: 320, totalTokens: 1_260, estimatedUSD: 0.0014 } },
  { at: now - 3 * 86_400_000, videoId: 'PREVIEW05', kind: 'video', usage: { inputTokens: 1_020, outputTokens: 360, totalTokens: 1_380, estimatedUSD: 0.0016 } },
  { at: now - 2 * 86_400_000, videoId: 'PREVIEW06', kind: 'video', usage: { inputTokens: 880, outputTokens: 280, totalTokens: 1_160, estimatedUSD: 0.0013 } },
  { at: now - 1 * 86_400_000, videoId: 'PREVIEW07', kind: 'video', usage: { inputTokens: 1_100, outputTokens: 410, totalTokens: 1_510, estimatedUSD: 0.0018 } },
];
await writeFile(usageFile, usage.map((entry) => JSON.stringify(entry)).join('\n') + '\n');
process.env.RESEARCH_USAGE_FILE = usageFile;
const { createApp } = await import('../src/server.mjs');
const balanceTracker = {
  get: async () => ({ checkedAt: now - 3_600_000, balances: [{ currency: 'USD', total: '24.53' }] }),
  refresh: async () => balanceTracker.get(),
};
const store = new LibraryStore(':memory:');
const queue = new ResearchQueue(store, async () => {
  throw Error('Preview server never processes videos');
});
const batches = new BatchController({ store, queue, dataRoot: batchRoot, apiKey: 'preview-only' });
const projects = store.projects();
const projectId = (name) => projects.find((project) => project.name === name)?.id;

const hour = 3_600_000;
const posts = [
  {
    id: 'PREVIEW01', age: 0.4, collection: 'Pennywise', tone: ['0x1b2450', '0x3f8cff'],
    title: 'How to structure a trading research journal',
    summary: 'A weekly review habit that separates ideas worth testing from guesses. The post suggests keeping one page per hypothesis with the evidence behind it.',
    recommendation: ['Pennywise', 'Add the one-page hypothesis template to the research journal.'],
  },
  {
    id: 'PREVIEW02', age: 1.2, collection: 'Personafy', tone: ['0x2a1250', '0xff5cc8'],
    title: 'Keeping an AI character consistent across scenes',
    summary: 'A simple reference sheet and lighting checklist for keeping a generated character recognisable between shots.',
    recommendation: ['Personafy', 'Use a per-character lighting checklist before generating a new scene.'],
  },
  {
    id: 'PREVIEW03', age: 2.4, collection: 'Dev Squad AI', tone: ['0x0f2a30', '0x39e1ff'],
    title: 'Prompt patterns for a coding agent',
    summary: 'Three prompt shapes that make a coding assistant explain its plan before editing files, and how to review the plan quickly.',
    recommendation: ['Dev Squad AI', 'Add a plan-first prompt to the agent review step.'],
  },
  {
    id: 'PREVIEW04', age: 3.6, collection: 'Tech', tone: ['0x30122a', '0xffcf6b'],
    title: 'A small research pipeline in Node',
    summary: 'A minimal queue that stores jobs in SQLite, retries once, and writes a plain summary file for each finished item.',
    recommendation: ['Tech', 'Compare the retry rules with the local research queue.'],
  },
  {
    id: 'PREVIEW05', age: 5.1, collection: 'Pennywise', tone: ['0x12213f', '0x22d3ee'],
    title: 'Backtesting without look-ahead bias',
    summary: 'Explains why a backtest should only use information that was available at the time of each decision, with a short checklist.',
    recommendation: ['Pennywise', 'Add the look-ahead checklist to the experiment notes.'],
  },
  {
    id: 'PREVIEW06', age: 7.5, collection: 'Personafy', tone: ['0x2b1b12', '0xff897a'],
    title: 'Faster video edits with sampled frames',
    summary: 'A quick way to pick the best moments from a long recording by sampling frames before editing the final cut.',
    recommendation: ['Personafy', 'Try frame sampling before the next short-form edit.'],
  },
  {
    id: 'PREVIEW07', age: 9.2, collection: 'Tech', tone: ['0x0d2c24', '0x3ee6b0'],
    title: 'Designing a personal knowledge base',
    summary: 'Notes work best when every page has one source link, one claim and one next action, rather than a long unconnected summary.',
    recommendation: ['Martial Arts', 'Compare the one-source note layout with the current notes.'],
  },
];

const pending = [
  { id: 'PREVIEW08', age: 11, collection: 'Pennywise', title: 'Saved reel about weekly review prompts' },
  { id: 'PREVIEW09', age: 13, collection: 'Personafy', title: 'Saved reel about lighting a green screen' },
  { id: 'PREVIEW10', age: 15, collection: 'Dev Squad AI', title: 'Saved reel about agent memory' },
];

function resultFor(post) {
  const answers = {
    what: { bullets: ['A short practical walkthrough.', 'One idea that can be tried this week.'], explanation: 'The post walks through a single workflow and shows the steps in order.' },
    why: { bullets: ['It costs little to test.', 'It fits an existing project.'], explanation: 'The workflow reuses tools the workspace already has, so the first trial is small.' },
    next: { bullets: ['Write down the first step.', 'Try it on one item.'], explanation: 'Start with one saved result, then compare the outcome before changing anything else.' },
  };
  return {
    summary: post.summary,
    topic: 'Research workflow',
    technologies: [],
    answers,
    provenance: { provider: 'deepseek', model: 'deepseek-flash', generatedAt: new Date(now - post.age * hour).toISOString() },
    recommendations: [
      {
        project: post.recommendation[0],
        application: post.recommendation[1],
        difficulty: 'Low',
        estimatedCost: 'Low',
        risks: 'None identified beyond normal review.',
        worthInvestigating: 'Yes, as a small trial.',
        priority: 'Medium',
        alreadyHave: false,
      },
    ],
    claims: [],
    verification: 'NOT VERIFIED',
    extraction: { framesExtracted: 6, durationSeconds: 48, audioExtracted: true },
    transcript: 'Synthetic preview transcript for layout checks only.',
  };
}

async function thumbnail(post) {
  const file = join(root, post.id + '.jpg');
  execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', `gradients=s=320x200:c0=${post.tone[0]}:c1=${post.tone[1]}`, '-frames:v', '1', '-update', '1', '-q:v', '6', file], { stdio: 'ignore' });
  const { readFile } = await import('node:fs/promises');
  await saveThumbnail(thumbnailRoot, post.id, await readFile(file));
}

for (const [index, post] of posts.entries()) {
  store.import([{ shortcode: post.id, url: 'https://www.instagram.com/p/' + post.id + '/', title: post.title, collections: [post.collection] }], { now: now - (post.age + 30) * hour });
  store.finish(post.id, { status: 'completed', result: resultFor(post) }, now - post.age * hour);
  if (index < 6) await thumbnail(post);
}
for (const post of pending) {
  store.import([{ shortcode: post.id, url: 'https://www.instagram.com/p/' + post.id + '/', title: post.title, collections: [post.collection] }], { now: now - post.age * hour });
}
const failed = { id: 'PREVIEW11', title: 'Saved reel that needs another try', collection: 'Tech' };
store.import([{ shortcode: failed.id, url: 'https://www.instagram.com/p/' + failed.id + '/', title: failed.title, collections: [failed.collection] }], { now: now - 18 * hour });
store.fail(failed.id, { code: 'CAPTURE_FAILED' }, now - 17 * hour);

// One recipe result so the Recipes tab is populated.
store.import([{ shortcode: 'PREVIEW12', url: 'https://www.instagram.com/p/PREVIEW12/', title: 'High-protein meal prep bowls', collections: ['Food'] }], { now: now - 20 * hour });
store.finish('PREVIEW12', {
  status: 'completed',
  result: {
    summary: 'A simple meal-prep bowl with rice, chicken and vegetables.',
    recipe: { ingredients: ['2 cups cooked rice', '2 chicken breasts', '1 cup broccoli'], instructions: ['Cook the rice.', 'Grill the chicken.', 'Combine and portion.'], fullRecipeShown: true },
    provenance: { provider: 'deepseek', model: 'deepseek-flash', generatedAt: new Date(now - 19 * hour).toISOString() },
    recommendations: [],
    verification: 'NOT VERIFIED',
  },
}, now - 19 * hour);

// One saved combined plan so the Knowledge Web shows connection lines.
store.saveCombination({
  projectId: projectId('Pennywise'),
  fingerprint: 'preview',
  sources: posts.filter((post) => post.collection === 'Pennywise').map((post) => ({ videoId: post.id, summary: post.summary, selected: true })),
  plans: [{ kind: 'merged', title: 'A weekly review loop', goal: 'Combine the journal and the backtest checklist.', steps: [], videoIds: posts.filter((post) => post.collection === 'Pennywise').map((post) => post.id) }],
  usage: { estimatedUSD: 0.0021 },
});

// A finished batch file gives the activity panel and library list real rows.
await mkdir(batchRoot, { recursive: true });
await writeFile(join(batchRoot, 'batch-00000000-0000-0000-0000-000000000000.json'), JSON.stringify({
  active: false,
  mode: 'tracking',
  maxCalls: 3,
  videos: [
    { id: 'PREVIEW01', url: 'https://www.instagram.com/p/PREVIEW01/', title: posts[0].title, collections: ['Pennywise'] },
    { id: 'PREVIEW02', url: 'https://www.instagram.com/p/PREVIEW02/', title: posts[1].title, collections: ['Personafy'] },
    { id: 'PREVIEW03', url: 'https://www.instagram.com/p/PREVIEW03/', title: posts[2].title, collections: ['Dev Squad AI'] },
  ],
  requests: [{ id: 'PREVIEW01', usage: { estimatedUSD: 0.0011, totalTokens: 2_140 } }],
}, null, 2));

const app = createApp({ store, queue, thumbnailRoot, batches, balanceTracker, port });
const server = await new Promise((resolve, reject) => {
  const instance = app;
  instance.once('error', reject);
  instance.listen(port, '127.0.0.1', () => resolve(instance));
});
console.log('UI preview: http://127.0.0.1:' + port + '/');
console.log('Projects: ' + projects.map((project) => project.name).join(', '));
console.log('Posts: ' + store.list().length + ' (synthetic, in-memory only)');
console.log('Press Ctrl+C to stop.');

const close = async () => {
  await new Promise((done) => server.close(done));
  batches.end();
  await batches.pendingWrite;
  store.close();
  await rm(root, { recursive: true, force: true });
  process.exit(0);
};
process.once('SIGINT', close);
process.once('SIGTERM', close);
