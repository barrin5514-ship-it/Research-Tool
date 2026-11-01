import test from 'node:test';
import assert from 'node:assert/strict';
import {LibraryStore} from '../src/store.mjs';
import {createDeepSeekResearch} from '../src/deepseek.mjs';
import {DRAFT_PROFILES} from '../src/project-drafts.mjs';

test('project profiles save per project and merge into the project list', () => {
  const store = new LibraryStore(':memory:');
  try {
    const pennywise = store.projects().find(p => p.name === 'Pennywise');
    assert.equal(pennywise.profile, null);
    store.saveProjectProfile(pennywise.id, 'A stock bot.', 'Python, Streamlit.');
    const updated = store.projects().find(p => p.name === 'Pennywise');
    assert.deepEqual(updated.profile, { what: 'A stock bot.', uses: 'Python, Streamlit.' });
    assert.throws(() => store.saveProjectProfile('nope', 'x', 'y'), /Project not found/);
  } finally { store.close(); }
});

test('the two boxes reach DeepSeek and Already have this labels return with the result', async () => {
  const store = new LibraryStore(':memory:');
  try {
    const pennywise = store.projects().find(p => p.name === 'Pennywise');
    store.saveProjectProfile(pennywise.id, 'A stock bot.', 'Python, Streamlit.');
    let body;
    const research = createDeepSeekResearch({
      approved: true, apiKey: 'k', getProjects: () => store.activeProjects(),
      fetcher: async (url, options) => {
        body = JSON.parse(options.body);
        return Response.json({
          usage: { prompt_tokens: 1, completion_tokens: 1 },
          choices: [{ message: { content: JSON.stringify({
            summary: 'A summary of the idea.',
            answers: { what: { bullets: ['A short bullet.'], explanation: 'An explanation.' }, why: { bullets: ['A short bullet.'], explanation: 'An explanation.' }, next: { bullets: ['A short bullet.'], explanation: 'An explanation.' } },
            claims: [], recommendations: [{ project: 'Pennywise', application: 'Use it here.', alreadyHave: true }]
          }) } }]
        });
      }
    });
    const result = await research({ job: { id: 't', url: 'https://www.instagram.com/p/t/', collections: [] }, transcript: 'A long enough transcript about trading strategies and market data for research analysis.' });
    const context = JSON.parse(body.messages[1].content).projectContext;
    assert.match(context.Pennywise, /What this project is: A stock bot\. What it already uses: Python, Streamlit\./);
    assert.match(body.messages[0].content, /Already have this/);
    assert.equal(result.recommendations[0].alreadyHave, true);
  } finally { store.close(); }
});

test('a read-only draft exists for every seeded project', () => {
  const store = new LibraryStore(':memory:');
  try {
    // Martial Arts and Fitness is owner-created in the real library, not seeded in tests.
    const seeded = ['Pennywise', 'Personafy', 'Tech', 'Dev Squad AI', 'Sims 4 Upgrades'];
    for (const name of seeded) { assert.ok(DRAFT_PROFILES[name], name + ' draft missing'); assert.ok(store.projects().some(p => p.name === name), name + ' project missing'); }
  } finally { store.close(); }
});
