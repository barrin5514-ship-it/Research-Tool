// Slowly fills missing captions and thumbnails from the signed-in Instagram browser.
// One post at a time, no AI provider, and it stops on the first warning.
import { mkdtemp, readFile, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { saveThumbnail, thumbnailName } from './thumbnails.mjs';
import { fetchShoppingImage } from './brave.mjs';

const run = promisify(execFile);
export const ENRICH_LIMITS = Object.freeze({ maxPosts: 20, delayMs: 20_000 });

// A nearly black JPEG is not a useful preview. YAVG comes from FFmpeg's signalstats.
async function isDarkThumbnail(file){
  try{
    const {stdout}=await run('ffmpeg',['-v','error','-i',file,'-vf','signalstats,metadata=print:file=-','-f','null','-']);
    const match=stdout.match(/YAVG=([\d.]+)/);
    return Boolean(match&&Number(match[1])<24);
  }catch{return false;}
}

// The visible caption, not Instagram's "12K likes ... on date" description.
export function captionText(value){
  const caption=captionFirstLine(value);
  return /^[A-Za-z0-9._]+\s+on\s+[A-Z][a-z]+\s+\d{1,2},\s+\d{4}$/.test(caption)?'':caption;
}
export function usernameFromMeta(meta,value){
  if(meta?.username)return String(meta.username).replace(/^@/,'').slice(0,40);
  const text=String(value||''),match=text.match(/-\s*([A-Za-z0-9._]+)\s+on\s+/)||text.match(/^\s*([A-Za-z0-9._]+)\s+on\s+/);
  return match?.[1]||'';
}

export function captionFirstLine(value) {
  // Instagram's meta description starts with "9,337 likes, 215 comments - user on date:".
  // Strip that prefix so the title is the creator's first caption line.
  let text = String(value || '').replace(/^\s*[\d,.]+[KMB]?\s+likes?[^:]*:\s*/i, '');
  text = text.replace(/^.*?\bon\s+[A-Z][a-z]+\s+\d{1,2},\s+\d{4}:\s*/, '');
  text = text.replace(/^[\s"“]+/, '').replace(/["”]\s*\.?\s*$/, '').trim();
  const line = text.split(/\r?\n/).map((part) => part.trim()).find(Boolean) || '';
  return line.slice(0, 200);
}

async function prepareJpeg(bytes, ffmpeg = 'ffmpeg') {
  const directory = await mkdtemp(join(tmpdir(), 'research-thumbnail-'));
  try {
    const input = join(directory, 'source');
    const output = join(directory, 'thumb.jpg');
    await writeFile(input, bytes, { flag: 'wx' });
    await run(ffmpeg, ['-nostdin', '-hide_banner', '-loglevel', 'error', '-i', input, '-frames:v', '1', '-vf', 'scale=320:320:force_original_aspect_ratio=decrease', '-q:v', '5', '-y', output]);
    const jpeg = await readFile(output);
    if (jpeg.length > 128 * 1024) throw Error('The thumbnail is over the size limit.');
    return jpeg;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function needsMetadata(store, id, thumbnailRoot) {
  const video = store.get(id);
  if (!video || !video.url) return false;
  if (/^Instagram (?:video|post)$/i.test(String(video.title || '').trim())) return true;
  try {
    const file = join(thumbnailRoot, thumbnailName(id));
    await stat(file);
    return isDarkThumbnail(file);
  } catch {
    return true;
  }
}

export async function enrichPosts({
  store,
  browser,
  thumbnailRoot,
  ids = null,
  repair = false,
  limit = ENRICH_LIMITS.maxPosts,
  delayMs = ENRICH_LIMITS.delayMs,
  wait = (ms) => new Promise((done) => setTimeout(done, ms)),
  fetchImage = fetchShoppingImage,
  prepareThumbnail = prepareJpeg,
  onProgress = () => {},
} = {}) {
  if (!store || !browser) throw Error('Post enrichment is unavailable.');
  const source = (ids ? ids.map((id) => store.get(id)).filter(Boolean) : store.list())
    .filter((video) => video && !video.result?.extraction?.fixture && video.status !== 'running');
  // Failed, skipped and placeholder posts are the ones the owner cannot identify,
  // so give them the first slots in the slow batch.
  const priority = (video) => (/^Instagram (?:video|post)$/i.test(String(video.title || '').trim()) ? 2 : 0)
    + (['failed', 'skipped'].includes(video.status) ? 4 : 0);
  source.sort((a, b) => priority(b) - priority(a));
  const limitCount = Math.max(1, Math.min(ENRICH_LIMITS.maxPosts, limit));
  const candidates = [];
  if (repair) {
    // Existing thumbnails are repaired first. A black JPEG is usually very small.
    const later = [];
    for (const video of source) {
      let size = 0;
      try { size = (await stat(join(thumbnailRoot, thumbnailName(video.id)))).size; } catch {}
      (size && size >= 10_000 ? later : candidates).push(video);
      if (candidates.length >= limitCount) break;
    }
    if (candidates.length < limitCount) candidates.push(...later.slice(0, limitCount - candidates.length));
  } else {
    for (const video of source) {
      if (candidates.length >= limitCount) break;
      if (await needsMetadata(store, video.id, thumbnailRoot)) candidates.push(video);
    }
  }
  let done = 0;
  let stopped = null;
  for (let index = 0; index < candidates.length; index += 1) {
    const video = candidates[index];
    try {
      const meta = browser.postPreview ? await browser.postPreview(video.url) : await browser.referenceMetadata(video.url);
      const caption = captionText(meta?.caption || meta?.pageTitle);
      const username = usernameFromMeta(meta, meta?.caption || meta?.pageTitle);
      // Prefer the real caption. If there is truly none, use the account name rather
      // than letting a visual description become the title.
      const title = caption || (username ? 'Instagram post from @' + username : 'Instagram post');
      let jpeg;
      if (meta.thumbnailBase64) {
        // The signed-in page gave us a screenshot, so no separate image request is needed.
        jpeg = await prepareThumbnail(Buffer.from(meta.thumbnailBase64, 'base64'));
      } else {
        const imageUrl = meta?.thumbnailUrl || (Array.isArray(meta.imageUrls) ? meta.imageUrls.find(Boolean) : null);
        if (!imageUrl) throw Error('Instagram did not show a thumbnail image for this post.');
        const image = await fetchImage(imageUrl);
        jpeg = await prepareThumbnail(image.bytes);
      }
      await saveThumbnail(thumbnailRoot, video.id, jpeg);
      store.updateVideoMetadata(video.id, { title, caption: meta.caption || caption });
      done += 1;
      onProgress({ done, total: candidates.length, id: video.id });
    } catch (error) {
      stopped = error.safetyStop
        ? 'Instagram needs a sign-in or security check. Reconnect the browser, then try again.'
        : String(error.message || 'The caption or thumbnail could not be read.').slice(0, 180);
      if(repair){try{const file=join(thumbnailRoot,thumbnailName(video.id));if(await isDarkThumbnail(file))await unlink(file);}catch{}}
      break;
    }
    if (index < candidates.length - 1) await wait(delayMs);
  }
  return { done, total: candidates.length, stopped, message: stopped || (done ? `Updated ${done} post${done === 1 ? '' : 's'}.` : 'No posts needed captions or thumbnails.') };
}
