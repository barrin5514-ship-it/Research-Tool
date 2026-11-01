import test from 'node:test';
import assert from 'node:assert/strict';
import { LibraryStore } from '../src/store.mjs';
import { normalizeResearch } from '../src/research.mjs';
import { createDeepSeekResearch } from '../src/deepseek.mjs';

const answers = Object.fromEntries(['what', 'why', 'next'].map((key) => [key, { bullets: ['One short point.', 'Another short point.'], explanation: 'A short explanation.' }]));

test('normalization keeps two independent destination suggestions with short reasons', () => {
  const result = normalizeResearch({ summary: 'A saved source.', destinations: { personafyReference: { suggested: true, reason: 'Outfit and lighting to copy.' }, coachlab: { suggested: false, reason: 'No teachable technique.' } } }, { job: { title: 'Post' } });
  assert.equal(result.destinations.personafyReference.suggested, true);
  assert.equal(result.destinations.personafyReference.reason, 'Outfit and lighting to copy.');
  assert.equal(result.destinations.coachlab.suggested, false);
});

test('destination corrections and sends are saved as examples for later prompts', (t) => {
  const store = new LibraryStore(':memory:');
  t.after(() => store.close());
  store.import([{ shortcode: 'Suggestion1', url: 'https://www.instagram.com/p/Suggestion1/', title: 'Post', collections: [] }]);
  store.recordDestinationFeedback({ videoId: 'Suggestion1', destination: 'personafy_reference', action: 'not_reference', reason: 'It is a tool, not a look.', example: 'Post — tool idea' });
  store.recordDestinationFeedback({ videoId: 'Suggestion1', destination: 'coachlab', action: 'sent', reason: 'Teaches a drill.', example: 'Post — drill' });
  assert.equal(store.destinationFeedback().length, 2);
  const examples = store.destinationExamples(8);
  assert.equal(examples.length, 2);
  assert.ok(examples.some((item) => item.action === 'not_reference' && item.destination === 'personafy_reference'));
});

test('analysis prompt defines suggestions and includes recent owner decisions without another call', async () => {
  let requestBody;
  const research = createDeepSeekResearch({
    apiKey: 'test-key',
    approved: true,
    getProjects: () => [],
    getDestinationExamples: () => [{ destination: 'personafy_reference', action: 'not_reference', reason: 'Tool, not a look.', example: 'Past post — build an app' }],
    onUsage: async () => {},
    fetcher: async (url, options) => {
      requestBody = JSON.parse(options.body);
      return Response.json({
        choices: [{ message: { content: JSON.stringify({ summary: 'A saved source.', answers, destinations: { personafyReference: { suggested: true, reason: 'Lighting and pose to copy.' }, coachlab: { suggested: true, reason: 'A drill to teach.' } } }) } }],
        usage: { prompt_tokens: 100, completion_tokens: 50, prompt_cache_hit_tokens: 0 },
      });
    },
  });
  const result = await research({ job: { id: 'video-dest', url: 'https://www.instagram.com/p/video-dest/' }, transcript: 'Synthetic source text explains a useful technique with enough content for analysis.' });
  assert.equal(requestBody.messages[0].content.includes('personafyReference'), true);
  assert.match(requestBody.messages[1].content, /destinationExamples/);
  assert.match(requestBody.messages[1].content, /Tool, not a look/);
  assert.equal(result.destinations.personafyReference.suggested, true);
  assert.equal(result.destinations.coachlab.suggested, true);
});
