import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, mkdtemp, open, readFile, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import {normalizeAnswers} from '../public/answer-format.mjs';

const WORKSPACE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_BYTES = 80 * 1024 * 1024;
const MAX_SECONDS = 180;
const MAX_FRAMES = 6;
const ATTEMPT_MS = 360_000;
const RESERVED = new Set(['.git', '.agents', '.codex', '.aws']);
const OWNER_TAG = 'research-agent-video-attempt-v1';
const OWNER_FILE = '.research-agent-owner.json';

export class ProcessingError extends Error {
  constructor(code, message, { retryable = false, retryAfterMs, cause } = {}) {
    super(message, { cause });
    this.name = 'ProcessingError';
    this.code = code;
    this.retryable = retryable;
    if (Number.isFinite(retryAfterMs)) this.retryAfterMs = retryAfterMs;
  }
}

function fail(code, message, options) {
  throw new ProcessingError(code, message, options);
}

function contained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

/** Refuse symlinks/junctions before creating or removing any scratch directory. */
async function safeWorkspacePath(candidate, { directory = true, create = false } = {}) {
  if (typeof candidate !== 'string' || !path.isAbsolute(candidate)) {
    fail('UNSAFE_PATH', 'Use an absolute workspace path for scratch and fixture files.');
  }
  const resolved = path.resolve(candidate);
  if (!contained(WORKSPACE, resolved)) fail('UNSAFE_PATH', 'The path must be inside this project workspace.');
  const segments = path.relative(WORKSPACE, resolved).split(path.sep);
  if (segments.some((segment) => RESERVED.has(segment.toLowerCase()))) {
    fail('UNSAFE_PATH', 'Scratch and fixture paths cannot enter project configuration directories.');
  }
  let current = WORKSPACE;
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]);
    let entry;
    try { entry = await lstat(current); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      if (!create) throw error;
      await mkdir(current).catch((mkdirError) => { if (mkdirError.code !== 'EEXIST') throw mkdirError; });
      entry = await lstat(current);
    }
    if (entry.isSymbolicLink()) fail('UNSAFE_PATH', 'Symbolic links and junctions are not allowed in media paths.');
    if ((index < segments.length - 1 || directory) && !entry.isDirectory()) {
      fail('UNSAFE_PATH', 'A media directory path is not a directory.');
    }
  }
  const actualRoot = await realpath(WORKSPACE);
  const actualPath = await realpath(resolved);
  if (!contained(actualRoot, actualPath)) fail('UNSAFE_PATH', 'The resolved path escapes the project workspace.');
  return resolved;
}

async function readOwner(directory) {
  try {
    const markerPath = path.join(directory, OWNER_FILE);
    const marker = await lstat(markerPath);
    if (!marker.isFile() || marker.isSymbolicLink() || marker.size > 1024) return null;
    const owner = JSON.parse(await readFile(markerPath, 'utf8'));
    if (owner.tag !== OWNER_TAG || !Number.isInteger(owner.pid) || owner.pid <= 0
        || typeof owner.token !== 'string' || !/^[0-9a-f-]{36}$/.test(owner.token)) return null;
    return owner;
  } catch { return null; }
}

function ownerIsGone(pid) {
  try { process.kill(pid, 0); return false; }
  catch (error) { return error.code === 'ESRCH'; }
}

/** Startup reaper: only this library's marked attempts with confirmed dead PIDs. */
export async function cleanupStaleAttempts(scratchRoot) {
  const root = await safeWorkspacePath(scratchRoot, { create: true });
  let removed = 0;
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink() || !/^video-attempt-[A-Za-z0-9_-]+$/.test(entry.name)) continue;
    const directory = path.join(root, entry.name);
    try { await safeWorkspacePath(directory); } catch { continue; }
    const owner = await readOwner(directory);
    if (!owner || !ownerIsGone(owner.pid)) continue;
    // Recheck identity immediately before removal; a malformed/replaced marker
    // or a reused live PID is a reason to keep the directory, never guess.
    await safeWorkspacePath(root);
    try { await safeWorkspacePath(directory); } catch { continue; }
    const currentOwner = await readOwner(directory);
    if (!currentOwner || currentOwner.token !== owner.token || currentOwner.pid !== owner.pid || !ownerIsGone(owner.pid)) continue;
    await rm(directory, { recursive: true, force: true });
    removed += 1;
  }
  return { removed };
}

function interruption(signal) {
  if (signal?.aborted) {
    const timedOut = signal.reason?.name === 'TimeoutError';
    fail(timedOut ? 'TIMEOUT' : 'CANCELLED', timedOut ? 'Media processing timed out.' : 'Media processing was cancelled.', { retryable: timedOut });
  }
}

function signals(parent, milliseconds) {
  return AbortSignal.any([...(parent ? [parent] : []), AbortSignal.timeout(milliseconds)]);
}

async function abortable(promise, signal) {
  interruption(signal);
  let listener;
  const cancelled = new Promise((_, reject) => {
    listener = () => { try { interruption(signal); } catch (error) { reject(error); } };
    signal.addEventListener('abort', listener, { once: true });
  });
  try { return await Promise.race([promise, cancelled]); }
  finally { signal.removeEventListener('abort', listener); }
}

function retryDelay(value) {
  if (!value) return undefined;
  const seconds = Number(value);
  const milliseconds = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - Date.now();
  return Number.isFinite(milliseconds) ? Math.min(1_800_000, Math.max(0, milliseconds)) : undefined;
}

function cobaltBase(value) {
  let url;
  try { url = new URL(value); } catch { fail('COBALT_CONFIG', 'The Cobalt address is invalid.'); }
  if (url.protocol !== 'http:' || !['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname)
      || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    fail('COBALT_CONFIG', 'Cobalt must use an HTTP loopback origin with no credentials or extra path.');
  }
  return url;
}

function instagramUrl(value) {
  let url;
  try { url = new URL(value); } catch { fail('INVALID_SOURCE', 'An Instagram post or reel URL is required.'); }
  if (url.protocol !== 'https:' || !['instagram.com', 'www.instagram.com'].includes(url.hostname)
      || url.port || url.username || url.password || !/^\/(?:reel|reels|p|tv)\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) {
    fail('INVALID_SOURCE', 'Only individual HTTPS Instagram post and reel URLs are accepted.');
  }
  return `https://www.instagram.com${url.pathname}`;
}

async function checkedFetch(fetcher, url, options, signal, allowApiError = false) {
  interruption(signal);
  try {
    const response = await abortable(fetcher(url, { ...options, redirect: 'manual', signal }), signal);
    interruption(signal);
    if (response.redirected || (response.status >= 300 && response.status < 400)) {
      await response.body?.cancel().catch(() => {});
      fail('REDIRECT_REFUSED', 'The local media service returned a redirect; it was not followed.');
    }
    if (!response.ok && !(allowApiError && response.status!==429)) {
      await response.body?.cancel().catch(() => {});
      fail('COBALT_HTTP', `The local media service returned HTTP ${response.status}.`, {
        retryable: response.status === 408 || response.status === 429 || response.status >= 500,
        retryAfterMs: retryDelay(response.headers.get('retry-after')),
      });
    }
    return response;
  } catch (error) {
    if (error instanceof ProcessingError) throw error;
    interruption(signal);
    fail('COBALT_UNAVAILABLE', 'The local media service could not be reached.', { retryable: true, cause: error });
  }
}

async function readBounded(response, limit, signal, onChunk) {
  const lengthHeader = response.headers.get('content-length');
  if (lengthHeader !== null && Number(lengthHeader) > limit) {
    await response.body?.cancel().catch(() => {});
    fail('SIZE_LIMIT', 'The media response exceeds its permitted size.');
  }
  if (!response.body) fail('EMPTY_RESPONSE', 'The media service returned no response body.');
  const reader = response.body.getReader();
  let bytes = 0;
  try {
    while (true) {
      interruption(signal);
      const { done, value } = await abortable(reader.read(), signal);
      interruption(signal);
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) fail('SIZE_LIMIT', 'The media response exceeds its permitted size.');
      await onChunk(value);
    }
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  if (!bytes) fail('EMPTY_RESPONSE', 'The media service returned an empty response.');
  return bytes;
}

async function download(job, destination, options, signal) {
  const base = cobaltBase(options.cobaltUrl);
  const url = instagramUrl(job.url ?? job.sourceUrl);
  const apiSignal = signals(signal, 90_000);
  const response = await checkedFetch(options.fetcher, base.href, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ url, downloadMode:'auto',videoQuality:'1080',filenameStyle:'basic',alwaysProxy:false }),
  }, apiSignal,true);
  const chunks = [];
  await readBounded(response, 64 * 1024, apiSignal, (chunk) => { chunks.push(chunk); });
  let payload;
  try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch {
    fail('COBALT_RESPONSE', 'The local media service returned invalid JSON.');
  }
  if (payload.status === 'picker') return { skipped: 'This post contains multiple media items; select an individual video for this POC.' };
  if (payload.status === 'error') {
    const code = String(payload.error?.code ?? 'unknown');
    fail('COBALT_REJECTED', `Cobalt could not retrieve this post (${code.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 100)}).`, {
      retryable: /rate|timeout|connect|temporar|fetch/i.test(code),
      retryAfterMs: /rate/i.test(code) ? 30_000 : undefined,
    });
  }
  if (payload.status === 'redirect' && typeof payload.url === 'string') {
    // Reuse Personafy's existing DNS-pinned, public-HTTPS fetcher read-only.
    // It sends no cookies/auth and revalidates every redirect/DNS connection.
    const publicFetch=options.publicFetcher || (await import(pathToFileURL('C:/Users/barri/Documents/ChatGPT/Persona Phi/src/media/public-fetch.ts').href)).publicFetch;
    const remote=new URL(payload.url);
    if(remote.protocol!=='https:'||remote.username||remote.password||(remote.port&&remote.port!=='443'))fail('UNSAFE_TUNNEL','Cobalt returned an unsafe public-media address.');
    const media=await publicFetch(remote.href,{maxBytes:MAX_BYTES,timeoutMs:120_000,headers:{accept:'*/*'},inspect(info){if(info.contentType&&!info.contentType.startsWith('video/')&&info.contentType!=='application/octet-stream')fail('NOT_VIDEO','Cobalt did not return video media.');}});
    if(media.status<200||media.status>=300)fail('COBALT_HTTP','The public video server refused the download.');
    if(!media.bytes.length||media.bytes.length>MAX_BYTES)fail('SIZE_LIMIT','The public media size is invalid.');
    interruption(signal);
    await writeFile(destination,media.bytes,{flag:'wx'});
    return {bytes:media.bytes.length};
  }
  if (payload.status !== 'tunnel' || typeof payload.url !== 'string') {
    fail('TUNNEL_REQUIRED', 'Cobalt did not provide a proxied local video tunnel.');
  }
  let tunnel;
  try { tunnel = new URL(payload.url); } catch { fail('TUNNEL_REQUIRED', 'Cobalt returned an invalid tunnel URL.'); }
  if (tunnel.origin !== base.origin || tunnel.username || tunnel.password || tunnel.hash || !/^\/tunnel(?:\/|$)/.test(tunnel.pathname)) {
    fail('UNSAFE_TUNNEL', 'The download tunnel must remain on the configured local Cobalt origin.');
  }
  const mediaSignal = signals(signal, 120_000);
  const media = await checkedFetch(options.fetcher, tunnel.href, { method: 'GET',headers:{accept:'*/*'} }, mediaSignal);
  const contentType = media.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (contentType && !contentType.startsWith('video/') && contentType !== 'application/octet-stream') {
    await media.body?.cancel().catch(() => {});
    fail('NOT_VIDEO', 'The download tunnel did not return a video payload.');
  }
  const file = await open(destination, 'wx');
  try {
    const bytes = await readBounded(media, MAX_BYTES, mediaSignal, async (chunk) => {
      let offset = 0;
      while (offset < chunk.byteLength) {
        const { bytesWritten } = await file.write(chunk, offset, chunk.byteLength - offset);
        if (!bytesWritten) fail('WRITE_FAILED', 'The temporary video could not be written.');
        offset += bytesWritten;
      }
    });
    return { bytes };
  } finally { await file.close(); }
}

async function command(binary, args, signal, timeoutMs = 25_000, maxOutput = 128 * 1024) {
  const commandSignal = signals(signal, timeoutMs);
  interruption(commandSignal);
  return new Promise((resolve, reject) => {
    let child;
    let stdout = '';
    let stderr = '';
    let tooLarge = false;
    try {
      child = spawn(binary, args, { windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'], signal: commandSignal });
    } catch (error) { reject(error); return; }
    for (const [stream, isOutput] of [[child.stdout, true], [child.stderr, false]]) {
      stream.on('data', (chunk) => {
        if (isOutput) stdout += chunk.toString();
        else stderr += chunk.toString();
        if (stdout.length + stderr.length > maxOutput) { tooLarge = true; child.kill(); }
      });
    }
    let spawnError;
    child.on('error', (error) => { spawnError = error; });
    child.on('close', (code) => {
      if (commandSignal.aborted) {
        try { interruption(commandSignal); } catch (error) { reject(error); }
      } else if (tooLarge) reject(new ProcessingError('PROCESS_OUTPUT_LIMIT', 'Media tooling exceeded its output limit.'));
      else if (spawnError) reject(new ProcessingError('MEDIA_TOOL_UNAVAILABLE', 'The configured local media tool could not start.', { cause: spawnError }));
      else if (code !== 0) reject(new ProcessingError('INVALID_MEDIA', 'The local media tool could not decode this file.'));
      else resolve(stdout);
    });
  });
}

function baseResult(job, fixture) {
  return {
    title: fixture ? `TEST FIXTURE: ${job.title || 'synthetic clip'}` : (job.title || 'Instagram video'),
    transcript: null,
    visualFindings: [],
    summary: null,
    claims: [],
    recommendations: [],
    verification: 'NOT VERIFIED',
    extraction: {
      mode: fixture ? 'fixture' : 'cobalt', fixture, framesExtracted: 0, audioExtracted: false,
      transcriptionStatus: 'unavailable', visionStatus: 'not_analyzed', analysisStatus: 'required',
      warnings: fixture ? ['TEST FIXTURE only. This does not verify Instagram access, transcription, or AI analysis.'] : [],
    },
  };
}

/**
 * Bounded local extraction. The optional analyzer receives temporary evidence
 * before cleanup; the returned document never includes temporary media paths.
 */
export async function processVideo(job, {
  scratchRoot,
  cobaltUrl = 'http://127.0.0.1:9100',
  ffmpeg = 'ffmpeg',
  ffprobe = 'ffprobe',
  signal,
  fetcher = fetch,
  publicFetcher,
  fixturePath,
  analyze,
  extract,
  nativeExtract,
  acquireFallback,
} = {}) {
  interruption(signal);
  const root = await safeWorkspacePath(scratchRoot, { create: true });
  const attempt = await mkdtemp(path.join(root, 'video-attempt-'));
  const owner = { tag: OWNER_TAG, pid: process.pid, token: randomUUID(), createdAt: new Date().toISOString() };
  const result = baseResult(job, Boolean(fixturePath));
  const attemptSignal = signals(signal, ATTEMPT_MS);
  try {
    await writeFile(path.join(attempt, OWNER_FILE), JSON.stringify(owner), { flag: 'wx' });
    let input = path.join(attempt, 'input.mp4');
    let bytes;
    if (fixturePath) {
      const fixture = await safeWorkspacePath(fixturePath, { directory: false });
      const info = await stat(fixture);
      if (!info.isFile() || info.size < 1 || info.size > MAX_BYTES) fail('SIZE_LIMIT', 'The test fixture is empty, non-regular, or over the size limit.');
      await copyFile(fixture, input, constants.COPYFILE_EXCL);
      bytes = info.size;
    } else {
      let downloaded;
      try { downloaded = await download(job, input, { cobaltUrl, fetcher,publicFetcher }, attemptSignal); }
      catch(error) {
        interruption(attemptSignal);
        if(!acquireFallback || !['COBALT_UNAVAILABLE','COBALT_REJECTED','COBALT_HTTP','TUNNEL_REQUIRED'].includes(error.code))throw error;
        await rm(input,{force:true});
        try { downloaded=await acquireFallback({job,attemptPath:attempt,inputPath:input,signal:attemptSignal}); }
        catch(fallbackError){interruption(attemptSignal);throw new ProcessingError(fallbackError.code||'BROWSER_CAPTURE_FAILED',fallbackError.message,{retryable:false});}
        result.extraction.mode=downloaded.method;
        result.extraction.warnings.push('Cobalt failed; an alternative acquisition method was used. Browser recordings reproduce playback and are not original downloads.');
      }
      if (downloaded.skipped) {
        result.extraction.analysisStatus = 'skipped';
        result.extraction.reason = downloaded.skipped;
        return { status: 'skipped', result };
      }
      bytes = downloaded.bytes;
    }
    // MediaRecorder's streaming WebM often has no duration header. Remux it
    // locally (without re-encoding) before the ordinary bounded media probe.
    if(result.extraction.mode.startsWith('browser_recording')){
      const normalized=path.join(attempt,'normalized.webm');
      await command(ffmpeg,['-nostdin','-hide_banner','-loglevel','error','-protocol_whitelist','file','-format_whitelist','matroska,webm','-i',input,'-map','0:v:0','-map','0:a?','-c','copy','-f','webm','-y',normalized],attemptSignal);
      if((await stat(normalized)).size>MAX_BYTES)fail('SIZE_LIMIT','Normalized recording exceeds its size limit.');
      input=normalized;
    }
    const rawProbe = await command(ffprobe, [
      '-v', 'error', '-protocol_whitelist', 'file', '-format_whitelist', 'mov,matroska,webm', '-show_entries',
      'format=duration:stream=codec_type,codec_name,width,height', '-of', 'json', input,
    ], attemptSignal);
    let probe;
    try { probe = JSON.parse(rawProbe); } catch { fail('PROBE_FAILED', 'Local media metadata could not be parsed.'); }
    const video = probe.streams?.find((stream) => stream.codec_type === 'video');
    const duration = Number(probe.format?.duration);
    if (!video || !Number.isFinite(duration) || duration <= 0) fail('INVALID_MEDIA', 'The file has no video stream with a usable duration.');
    if (!(video.width > 0 && video.height > 0) || video.width * video.height > 3840 * 2160) {
      fail('DIMENSION_LIMIT', 'The video exceeds the supported 4K pixel budget.');
    }
    result.extraction = {
      ...result.extraction, downloadedBytes: bytes, durationSeconds: duration,
      width: video.width, height: video.height,
      hasAudio: Boolean(probe.streams?.some((stream) => stream.codec_type === 'audio')),
    };
    if (duration > MAX_SECONDS) {
      result.extraction.analysisStatus = 'skipped';
      result.extraction.reason = `Clip duration exceeds the ${MAX_SECONDS}-second POC limit.`;
      return { status: 'skipped', result };
    }
    const frames = [];
    const frameCount = Math.min(MAX_FRAMES, Math.max(1, Math.ceil(duration)));
    for (let index = 0; index < frameCount; index += 1) {
      const timeSeconds = Number(((index + 0.5) * duration / frameCount).toFixed(3));
      const framePath = path.join(attempt, `frame-${index + 1}.jpg`);
      await command(ffmpeg, [
        '-nostdin', '-hide_banner', '-loglevel', 'error', '-protocol_whitelist', 'file', '-format_whitelist', 'mov,matroska,webm',
        '-ss', String(timeSeconds), '-i', input, '-an', '-sn', '-dn', '-frames:v', '1',
        '-vf', "scale='min(640,iw)':'min(640,ih)':force_original_aspect_ratio=decrease", '-q:v', '4', '-y', framePath,
      ], attemptSignal);
      const frameStat = await stat(framePath).catch(() => null);
      if (!frameStat?.size || frameStat.size > 2 * 1024 * 1024) fail('FRAME_FAILED', 'A bounded video frame could not be extracted.');
      frames.push({ path: framePath, timeSeconds });
    }
    result.extraction.framesExtracted = frames.length;
    let audioPath;
    if (result.extraction.hasAudio && (analyze || nativeExtract)) {
      audioPath = path.join(attempt, 'audio.wav');
      try {
        await command(ffmpeg, [
          '-nostdin', '-hide_banner', '-loglevel', 'error', '-protocol_whitelist', 'file', '-format_whitelist', 'mov,matroska,webm',
          '-i', input, '-t', String(MAX_SECONDS), '-vn', '-sn', '-dn', '-ac', '1', '-ar', '16000',
          '-c:a', 'pcm_s16le', '-fs', String(6 * 1024 * 1024), '-y', audioPath,
        ], attemptSignal);
        const audio = await stat(audioPath);
        if (!audio.size || audio.size > 6 * 1024 * 1024) fail('AUDIO_LIMIT', 'The audio extraction exceeded its limit.');
        result.extraction.audioExtracted = true;
      } catch (error) {
        interruption(attemptSignal);
        audioPath = undefined;
        result.extraction.warnings.push('Audio extraction failed; visual evidence remains available.');
      }
    }
    if (!nativeExtract && !extract) result.extraction.warnings.push('No local speech-to-text backend is configured; a transcript has not been generated.');
    if (nativeExtract) {
      const evidence=await nativeExtract({audioPath,frames,signal:attemptSignal});
      interruption(attemptSignal);
      result.transcript=evidence.transcript;
      result.ocr=evidence.ocr;
      result.extraction.transcriptionStatus=evidence.transcript?'extracted':'unavailable';
      result.extraction.warnings.push(...evidence.warnings);
    }
    if (extract) {
      try {
        const evidence=await extract({inputPath:input,attemptPath:attempt,signal:attemptSignal});
        result.transcript=evidence.transcript;
        result.ocr=evidence.ocr;
        result.extraction.transcriptionStatus=evidence.transcript?'extracted':'unavailable';
        result.extraction.warnings.push(...evidence.warnings);
      } catch { interruption(attemptSignal);result.extraction.warnings.push('Analyzer extraction failed; retry after checking its local dependencies.'); }
    }
    if (!analyze) return { status: 'needs_analysis', result };
    let analyzed;
    try {
      analyzed = await abortable(analyze({ job, frames, audioPath, transcript:result.transcript, ocr:result.ocr, durationSeconds: duration, signal: attemptSignal, fixture: Boolean(fixturePath) }), attemptSignal);
    } catch (error) {
      interruption(attemptSignal);
      result.extraction.warnings.push('Research provider is unavailable or failed. Extracted media was removed; analysis remains incomplete.');
      return { status: 'needs_analysis', result };
    }
    interruption(attemptSignal);
    if (!analyzed || typeof analyzed.summary !== 'string' || !analyzed.summary.trim()) {
      result.extraction.warnings.push('The local analyzer did not produce a research summary.');
      return { status: 'needs_analysis', result };
    }
    // Copy only research fields. Never persist provider internals or file paths.
    for (const field of ['summary', 'transcript', 'title']) {
      if (typeof analyzed[field] === 'string') result[field] = analyzed[field].slice(0, 40_000);
    }
    for (const field of ['visualFindings', 'claims', 'recommendations']) {
      if (Array.isArray(analyzed[field])) result[field] = analyzed[field].slice(0, 100);
    }
    if(normalizeAnswers(analyzed.answers))result.answers=normalizeAnswers(analyzed.answers);
    result.verification = analyzed.verification === 'PARTIALLY VERIFIED' ? 'PARTIALLY VERIFIED' : 'NOT VERIFIED';
    if (analyzed.provenance && typeof analyzed.provenance === 'object') {
      result.provenance = JSON.parse(JSON.stringify(analyzed.provenance).split(attempt).join('[temporary evidence]'));
    }
    const researchComplete = Boolean(result.transcript?.trim()) && analyzed.researchStatus === 'complete' && analyzed.sourceVerification === 'completed';
    result.researchStatus = result.transcript?.trim() ? 'requires_verification' : 'visual_only';
    result.extraction.analysisStatus = researchComplete ? 'completed' : 'required';
    result.extraction.visionStatus = ['local-evidence-rules','deepseek'].includes(analyzed.provenance?.provider) ? 'not_analyzed' : 'analyzed';
    if(analyzed.usage)result.usage=analyzed.usage;
    result.extraction.transcriptionStatus = result.transcript ? 'provided_by_local_analyzer' : 'unavailable';
    if (fixturePath) {
      result.title = `TEST FIXTURE: ${job.title || 'synthetic clip'}`;
      result.verification = 'NOT VERIFIED';
    }
    if (researchComplete) result.researchStatus = 'complete';
    return { status: researchComplete && !fixturePath ? 'completed' : 'needs_analysis', result };
  } catch (error) {
    if (error instanceof ProcessingError) throw error;
    interruption(attemptSignal);
    throw new ProcessingError('PROCESSING_FAILED', 'The media extraction or local analysis failed.', {
      retryable: error.retryable === true, retryAfterMs: error.retryAfterMs, cause: error,
    });
  } finally {
    // Only delete the directory created by this invocation, after resolving it.
    await safeWorkspacePath(root);
    await safeWorkspacePath(attempt);
    if (path.dirname(attempt) !== root || !path.basename(attempt).startsWith('video-attempt-')) {
      fail('UNSAFE_CLEANUP', 'Refused to remove a directory not owned by this media attempt.');
    }
    const currentOwner = await readOwner(attempt);
    if (!currentOwner || currentOwner.token !== owner.token || currentOwner.pid !== process.pid) {
      fail('UNSAFE_CLEANUP', 'The scratch ownership marker is missing or changed; the directory was preserved.');
    }
    await rm(attempt, { recursive: true, force: true });
  }
}
