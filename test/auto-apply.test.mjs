import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeepSeekResearch } from '../src/deepseek.mjs';

const answers = Object.fromEntries(['what', 'why', 'next'].map((key) => [key, { bullets: ['Check the source first.', 'Start with a small test.'], explanation: 'A short explanation.' }]));
const project = { id: 'project-1', name: 'Pennywise', description: 'Paper trading.', profile: { what: 'A paper-trading app.', uses: 'Python and SQLite.' } };

function researchResponse() {
  return Response.json({
    choices: [{ message: { content: JSON.stringify({ summary: 'A saved source.', answers, recommendations: [{ project: 'Pennywise', application: 'Add a risk warning to the report.' }] }) } }],
    usage: { prompt_tokens: 100, completion_tokens: 50, prompt_cache_hit_tokens: 0 },
  });
}

function planResponse(plan = {}) {
  return Response.json({
    choices: [{ message: { content: JSON.stringify({ plan: {
      changes: 'Add a risk warning near the report.',
      touches: 'The report page.',
      effort: 'small',
      alreadyHave: false,
      alreadyHaveReason: '',
      buildPrompt: 'Inspect the report page, add a short risk warning, and do not change unrelated code.',
      ...plan,
    } }) } }],
    usage: { prompt_tokens: 80, completion_tokens: 40, prompt_cache_hit_tokens: 0 },
  });
}

test('matched analysis creates and attaches one apply plan without a click', async () => {
  let calls = 0;
  const usage = [];
  const research = createDeepSeekResearch({
    apiKey: 'test-key',
    approved: true,
    getProjects: () => [project],
    autoApplyPlans: true,
    hasApplyPlan: () => false,
    applyFiles: async () => ({ files: [{ name: 'app.py', purpose: 'Python application entry point' }] }),
    onUsage: async (record) => usage.push(record),
    fetcher: async () => {
      calls += 1;
      return calls === 1 ? researchResponse() : planResponse();
    },
  });
  const result = await research({ job: { id: 'video-1', url: 'https://www.instagram.com/p/Video1/' }, transcript: 'Synthetic source text explains a useful technique with enough content for analysis.' });
  assert.equal(calls, 2);
  assert.equal(result.autoApplyPlans.length, 1);
  assert.equal(result.autoApplyPlans[0].projectId, 'project-1');
  assert.equal(result.autoApplyPlans[0].plan.effort, 'small');
  assert.equal(usage.length, 2);
  assert.equal(usage[1].kind, 'project-apply');
  assert.equal(usage[1].videoId, 'video-1');
});

test('auto apply skips a plan marked Already have this and skips saved plans', async () => {
  let calls = 0;
  const research = createDeepSeekResearch({
    apiKey: 'test-key',
    approved: true,
    getProjects: () => [project],
    autoApplyPlans: true,
    hasApplyPlan: () => false,
    applyFiles: async () => ({ files: [] }),
    onUsage: async () => {},
    fetcher: async () => {
      calls += 1;
      return calls === 1 ? researchResponse() : planResponse({ alreadyHave: true, alreadyHaveReason: 'The report already has this warning.' });
    },
  });
  const result = await research({ job: { id: 'video-2' }, transcript: 'Synthetic source text explains a useful technique with enough content for analysis.' });
  assert.equal(calls, 2);
  assert.deepEqual(result.autoApplyPlans, []);
});

test('auto apply makes no extra call when a saved plan already exists', async () => {
  let calls = 0;
  const research = createDeepSeekResearch({
    apiKey: 'test-key',
    approved: true,
    getProjects: () => [project],
    autoApplyPlans: true,
    hasApplyPlan: () => true,
    onUsage: async () => {},
    fetcher: async () => { calls += 1; return researchResponse(); },
  });
  const result = await research({ job: { id: 'video-3' }, transcript: 'Synthetic source text explains a useful technique with enough content for analysis.' });
  assert.equal(calls, 1);
  assert.deepEqual(result.autoApplyPlans, []);
});
