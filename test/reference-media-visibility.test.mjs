import test from 'node:test';
import assert from 'node:assert/strict';
import { displayRoutes } from '../public/result-routing.mjs';
import { demoCounts } from '../public/result-view.mjs';

test('reference media never appears in research results or failed counts', () => {
  const videos = [
    { id: 'ref', title: 'Reference photo', url: 'https://www.instagram.com/p/ref/', status: 'failed', collections: ['reference'], created_at: 1, updated_at: 1, result: null },
    { id: 'normal', title: 'Normal post', url: 'https://www.instagram.com/p/normal/', status: 'failed', collections: ['Tech'], created_at: 2, updated_at: 2, result: null },
  ];
  const routes = displayRoutes(videos, [], []);
  assert.deepEqual(routes.research.map((video) => video.id), ['normal']);
  const counts = demoCounts(videos, []);
  assert.equal(counts.failed, 1);
});
