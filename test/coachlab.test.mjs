import test from 'node:test';
import assert from 'node:assert/strict';
import {disciplineOf, techniquesOf, sendToCoachLab} from '../src/coachlab.mjs';

test('discipline is detected from post text and defaults to MMA', () => {
  assert.equal(disciplineOf('a boxing jab and cross'), 'Boxing');
  assert.equal(disciplineOf('muay thai teep and clinch'), 'Muay Thai');
  assert.equal(disciplineOf('bjj armbar and triangle'), 'Brazilian Jiu-Jitsu');
  assert.equal(disciplineOf('wrestling single leg'), 'Wrestling');
  assert.equal(disciplineOf('nothing specific'), 'MMA');
});

test('techniques are extracted only when they appear in the text', () => {
  assert.equal(techniquesOf('practice the jab, cross and hook slowly'), 'jab, cross, hook');
  assert.equal(techniquesOf('no technique words here'), '');
});

test('sendToCoachLab posts the token in a header and never in the body', async () => {
  let seen;
  const fetcher = async (url, options) => { seen = { url, options }; return Response.json({ ok: true, duplicate: false }, { status: 201 }); };
  const result = await sendToCoachLab({ post: { title: 'Jab', url: 'https://www.instagram.com/p/Jab/', summary: 'A jab drill', transcript: 'keep the elbow in' }, baseUrl: 'https://coachlab.example/', token: 'secret-token-123', fetcher });
  assert.equal(seen.url, 'https://coachlab.example/api/import/research-post');
  assert.equal(seen.options.headers['x-coachlab-import-token'], 'secret-token-123');
  assert.doesNotMatch(seen.options.body, /secret-token-123/);
  const body = JSON.parse(seen.options.body);
  assert.equal(body.discipline, 'MMA');
  assert.match(body.drills, /jab/);
  assert.equal(result.duplicate, false);
});

test('sendToCoachLab refuses a missing key and surfaces a refusal', async () => {
  await assert.rejects(sendToCoachLab({ post: { title: 'x', url: 'https://www.instagram.com/p/x/' }, baseUrl: 'https://coachlab.example/', token: '' }), /not configured/);
  const refused = async () => Response.json({ error: 'Import is not authorized.' }, { status: 401 });
  await assert.rejects(sendToCoachLab({ post: { title: 'x', url: 'https://www.instagram.com/p/x/' }, baseUrl: 'https://coachlab.example/', token: 'k', fetcher: refused }), /not authorized/);
});

test('sendToCoachLab includes the configured coach email without exposing the token', async () => {
  const previous = process.env.COACHLAB_IMPORT_OWNER_EMAIL;
  process.env.COACHLAB_IMPORT_OWNER_EMAIL = 'coach@example.com';
  try {
    let seen;
    const fetcher = async (url, options) => { seen = { url, options }; return Response.json({ ok: true }, { status: 201 }); };
    await sendToCoachLab({ post: { title: 'Jab', url: 'https://www.instagram.com/p/Jab/', summary: 'A jab drill' }, baseUrl: 'https://coachlab.example/', token: 'secret-token-123', fetcher });
    const body = JSON.parse(seen.options.body);
    assert.equal(body.ownerEmail, 'coach@example.com');
    assert.doesNotMatch(seen.options.body, /secret-token-123/);
  } finally {
    if (previous === undefined) delete process.env.COACHLAB_IMPORT_OWNER_EMAIL;
    else process.env.COACHLAB_IMPORT_OWNER_EMAIL = previous;
  }
});
