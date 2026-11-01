import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LibraryStore } from '../src/store.mjs';
import { BatchController } from '../src/batches.mjs';
import { AUTO_APPLY_MAX_PER_POST } from '../src/deepseek.mjs';
import { APPLY_MAX_USD } from '../src/apply-plan-core.mjs';

test('batch estimate includes the automatic apply-plan allowance', async (t) => {
  const store = new LibraryStore(':memory:');
  const root = await mkdtemp(join(tmpdir(), 'batch-apply-'));
  t.after(async () => { store.close(); await rm(root, { recursive: true, force: true }); });
  store.import(Array.from({ length: 3 }, (_, index) => ({ shortcode: `auto${index}`, url: `https://www.instagram.com/p/auto${index}/`, title: 'Waiting post', collections: ['Pennywise'] })));
  const queue = { running: false, active: new Set() };
  const batches = new BatchController({ store, queue, dataRoot: root, apiKey: 'test-key', fetcher: async () => { throw Error('No network in this test'); } });
  const preview = batches.prepareBatch({ size: 3, collection: ['All'] });
  assert.equal(preview.count, 3);
  const allowance = 3 * AUTO_APPLY_MAX_PER_POST * APPLY_MAX_USD;
  assert.ok(preview.estimatedUSD > allowance);
  assert.match(preview.note, /automatic apply plans/);
});

test('saving an analysis stores auto plans and drops Already have this rows', (t) => {
  const store = new LibraryStore(':memory:');
  t.after(() => store.close());
  const project = store.projects().find((item) => item.name === 'Pennywise');
  store.import([{ shortcode: 'autoSave', url: 'https://www.instagram.com/p/autoSave/', title: 'Auto save', collections: ['Pennywise'] }]);
  store.finish('autoSave', {
    status: 'completed',
    result: {
      summary: 'A summary.',
      provenance: { provider: 'deepseek' },
      autoApplyPlans: [
        { projectId: project.id, plan: { changes: 'Add it.', touches: 'A file.', effort: 'small', alreadyHave: false, buildPrompt: 'Do it.' }, usage: { estimatedUSD: 0.001 } },
        { projectId: project.id, plan: { changes: 'Already there.', touches: 'A file.', effort: 'small', alreadyHave: true, buildPrompt: 'Do not.' }, usage: { estimatedUSD: 0.001 } },
      ],
    },
  });
  assert.ok(store.getApplyPlan(project.id, 'autoSave'));
  assert.equal(store.applyPlans().length, 1);
});
