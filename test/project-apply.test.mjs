import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LibraryStore } from '../src/store.mjs';
import { ProjectApplyPlans, APPLY_MAX_USD } from '../src/project-apply.mjs';
import { projectFileSummary } from '../src/project-files.mjs';

function setup(t) {
  const store = new LibraryStore(':memory:');
  t.after(() => store.close());
  const project = store.projects().find((item) => item.name === 'Pennywise');
  store.saveProjectProfile(project.id, 'A paper-trading research app.', 'Python, Streamlit and SQLite.');
  store.import([{ shortcode: 'Apply1', url: 'https://www.instagram.com/p/Apply1/', title: 'Apply test', collections: ['Pennywise'] }]);
  store.finish('Apply1', {
    status: 'completed',
    result: {
      title: 'Apply test',
      summary: 'A saved source summary.',
      recommendations: [{ project: 'Pennywise', application: 'Add a small risk warning to the paper-trading report.' }],
      provenance: { provider: 'deepseek' },
    },
  });
  return { store, project };
}

function fakeFetch(calls) {
  return async () => {
    calls.count += 1;
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ plan: {
        changes: 'Add a risk warning near the paper-trading result.',
        touches: 'The report page and its existing result text.',
        effort: 'small',
        alreadyHave: false,
        alreadyHaveReason: '',
        buildPrompt: 'Open the report page, add a short risk warning near the result, and do not change unrelated code.',
      } }) } }],
      usage: { prompt_tokens: 200, completion_tokens: 120, total_tokens: 320, prompt_cache_hit_tokens: 0 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}

test('apply preview stays under one cent and saves one plan without paying twice', async (t) => {
  const { store, project } = setup(t);
  const calls = { count: 0 };
  const usage = [];
  const apply = new ProjectApplyPlans({
    store,
    apiKey: 'test-key',
    fetcher: fakeFetch(calls),
    files: async () => ({ files: [{ name: 'src/', purpose: 'application source code' }], note: 'fixture' }),
    onUsage: async (record) => usage.push(record),
  });
  const preview = await apply.prepare({ projectId: project.id, videoId: 'Apply1' });
  assert.ok(preview.estimatedUSD > 0 && preview.estimatedUSD <= APPLY_MAX_USD);
  assert.match(preview.note, /Maximum \$0\.01/);
  apply.confirm({ token: preview.token, confirmed: true });
  await apply.close();
  assert.equal(calls.count, 1);
  assert.equal(usage.length, 1);
  const saved = store.getApplyPlan(project.id, 'Apply1');
  assert.equal(saved.plan.effort, 'small');
  assert.equal(saved.plan.alreadyHave, false);
  const again = await apply.prepare({ projectId: project.id, videoId: 'Apply1' });
  assert.equal(again.saved, true);
  assert.equal(again.estimatedUSD, 0);
  assert.equal(calls.count, 1, 'a saved plan must not make another paid call');
});

test('project file summary is read-only names and never includes .env or secrets', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'apply-files-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'src'));
  await writeFile(join(root, '.env'), 'SECRET=never'); 
  await writeFile(join(root, 'credentials.json'), 'never');
  await writeFile(join(root, 'package.json'), '{}');
  await writeFile(join(root, 'src', 'app.ts'), 'export {};');
  const summary = await projectFileSummary('Fixture', { roots: { Fixture: root } });
  const names = summary.files.map((file) => file.name);
  assert.ok(names.includes('src/'));
  assert.ok(names.includes('package.json'));
  assert.equal(names.includes('.env'), false);
  assert.equal(names.includes('credentials.json'), false);
  assert.match(summary.note, /contents were not read/);
});
