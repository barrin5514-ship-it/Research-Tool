import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { processVideo } from '../src/processor.mjs';

// This smoke test generates local synthetic fixtures only. It exercises existing
// FFmpeg binaries; it does not contact Instagram, Cobalt, or an AI provider.
const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = await mkdtemp(path.join(workspace, '.media-smoke-'));
const scratchRoot = path.join(directory, 'scratch');
const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const ffprobe = process.env.FFPROBE_PATH || 'ffprobe';

async function generate(file, color, audio, duration) {
  const args = ['-nostdin', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `color=c=${color}:s=320x240:r=10:d=${duration}`];
  if (audio) args.push('-f', 'lavfi', '-i', `sine=frequency=440:sample_rate=16000:duration=${duration}`);
  args.push('-c:v', 'mpeg4', '-q:v', '5');
  if (audio) args.push('-c:a', 'aac', '-shortest');
  args.push('-y', file);
  await new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], signal: AbortSignal.timeout(20_000) });
    child.on('error', reject);
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Fixture generation failed (${code}): ${stderr.slice(0, 500)}`)));
  });
}

try {
  const results = [];
  for (const [index, color] of ['red', 'green', 'blue'].entries()) {
    const fixturePath = path.join(directory, `fixture-${index + 1}.mp4`);
    await generate(fixturePath, color, index === 2, [0.8, 2.4, 6.4][index]);
    let temporaryEvidence;
    const outcome = await processVideo({ id: `fixture-${index + 1}`, title: `${color} synthetic clip` }, {
      scratchRoot, fixturePath, ffmpeg, ffprobe,
      ...(index === 2 ? { analyze: async ({ frames, audioPath, fixture }) => {
        assert.equal(fixture, true);
        assert.ok((await stat(audioPath)).size > 44);
        assert.ok((await stat(frames[0].path)).size > 0);
        temporaryEvidence = frames[0].path;
        // A fixture checker deliberately produces no AI research or transcript.
        return { summary: null };
      } } : {}),
    });
    assert.equal(outcome.status, 'needs_analysis');
    assert.equal(outcome.result.verification, 'NOT VERIFIED');
    assert.match(outcome.result.title, /^TEST FIXTURE:/);
    assert.equal(outcome.result.transcript, null);
    assert.equal(outcome.result.summary, null);
    assert.ok(outcome.result.extraction.framesExtracted > 0 && outcome.result.extraction.framesExtracted <= 6);
    if (index === 2) assert.equal(outcome.result.extraction.framesExtracted, 6);
    assert.deepEqual(await readdir(scratchRoot), []);
    if (temporaryEvidence) await assert.rejects(stat(temporaryEvidence), { code: 'ENOENT' });
    results.push({ fixture: color, status: outcome.status, framesExtracted: outcome.result.extraction.framesExtracted, audioExtracted: outcome.result.extraction.audioExtracted });
  }
  console.log(JSON.stringify({ label: 'TEST FIXTURE ONLY', scope: 'Three synthetic clips: local decode, frame extraction, optional audio, missing-analysis status, cleanup. No Instagram or AI validation.', results }, null, 2));
} finally {
  const resolved = path.resolve(directory);
  assert.equal(path.dirname(resolved), workspace);
  assert.match(path.basename(resolved), /^\.media-smoke-/);
  await rm(resolved, { recursive: true, force: true });
}
