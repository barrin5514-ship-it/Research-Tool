import { createServer } from 'node:http';
import { readFile, mkdir, open, unlink } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { LibraryStore } from './store.mjs';
import { ResearchQueue } from './queue.mjs';
import { parseExport, normalizeInstagramUrl } from './importer.mjs';
import { processVideo,cleanupStaleAttempts } from './processor.mjs';
import { createLocalResearch } from './research.mjs';
import { createAnalyzer } from './analyzer-integration.mjs';
import { createWindowsExtraction } from './windows-extraction.mjs';
import {createEvidenceResearch} from './evidence-research.mjs';
import {createDeepSeekResearch} from './deepseek.mjs';
import {recordUsage,readUsage} from './deepseek-usage.mjs';
import {createBrowserFallback} from './browser-fallback.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const USAGE_FILE=join(ROOT,'.research-data','deepseek-usage.jsonl');
const STATIC = new Map([['/',['index.html','text/html; charset=utf-8']],['/app.js',['app.js','text/javascript; charset=utf-8']],['/style.css',['style.css','text/css; charset=utf-8']]]);
const MAX_BODY = 12 * 1024 * 1024;
async function readJson(req) {
  const chunks = []; let length = 0;
  for await (const chunk of req) { length += chunk.length; if (length > MAX_BODY) { const error = new Error('Import is too large; choose fewer files (12 MiB limit)'); error.status = 413; throw error; } chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('Invalid JSON request'); }
}
export function createApp({store,queue,localAIEnabled=false,port=5199,onShutdown,browserSession}) {
  const csrf = randomBytes(32).toString('hex');
  const server = createServer(async (req,res) => {
    const origin = `http://127.0.0.1:${server.address()?.port || port}`;
    const send = (status,body,type='application/json; charset=utf-8') => {
      res.writeHead(status,{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff',
        'referrer-policy':'no-referrer','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
      res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
    };
    try {
      if (req.headers.host !== new URL(origin).host) return send(403,{error:'Invalid local host'});
      const path = new URL(req.url,origin).pathname;
      if (req.method === 'GET' && STATIC.has(path)) { const [file,type]=STATIC.get(path); return send(200,await readFile(join(ROOT,'public',file)),type); }
      if (req.method === 'GET' && path === '/api/state') return send(200,{application:'instagram-research-library',instagramBrowser:browserSession?await browserSession.status():null,deepseekUsage:await readUsage(USAGE_FILE),videos:store.list(),queue:queue.status(),csrf,localAIEnabled,
        limitations:['Pilot: at most three videos per batch.','Windows speech/OCR is available; model reasoning and semantic claim verification remain incomplete.','No background operation after this server stops.','Approval records your decision; it does not modify a project.']});
      if (req.method !== 'POST') return send(404,{error:'Not found'});
      const token = Buffer.from(String(req.headers['x-research-token'] || ''));
      const expected = Buffer.from(csrf);
      if (req.headers.origin !== origin || token.length !== expected.length || !timingSafeEqual(token,expected)) return send(403,{error:'Reload this local dashboard before making changes'});
      if (!(req.headers['content-type'] || '').startsWith('application/json')) return send(415,{error:'JSON requests only'});
      const body = await readJson(req);
      if(path==='/api/instagram/connect'||path==='/api/instagram/confirm'){
        if(!browserSession)throw new Error('Browser capture is unavailable.');
        if(queue.status().active)throw new Error('Pause processing and wait for the active video to finish first.');
        queue.pause();return send(200,await browserSession[path.endsWith('connect')?'connect':'confirm']());
      }
      if (path === '/api/import') {
        if (!Array.isArray(body.files) || body.files.length < 1 || body.files.length > 10) throw new Error('Choose 1 to 10 extracted saved-post or collection files');
        const parsed = body.files.map(file => {
          if (typeof file.name !== 'string' || typeof file.content !== 'string') throw new Error('Invalid import file');
          return {name:file.name.slice(0,200),content:file.content,...parseExport(file.content,{filename:file.name})};
        });
        const results = parsed.map(file => ({filename:file.name,warnings:file.warnings,...store.import(file.items,{hash:createHash('sha256').update(file.content).digest('hex'),filename:file.name})}));
        return send(200,{results});
      }
      if (path === '/api/links') {
        if (typeof body.links !== 'string' || body.links.length > 10000) throw new Error('Paste up to three Instagram links');
        const links = body.links.split(/\s+/).filter(Boolean);
        if (links.length < 1 || links.length > 3) throw new Error('Paste one to three links for this pilot');
        const collection = ['Pennywise','Personafy','Tech'].includes(body.collection) ? body.collection : undefined;
        const items = links.map(raw => ({...normalizeInstagramUrl(raw),title:'Instagram video',collections:collection?[collection]:[]}));
        return send(200,store.import(items));
      }
      if (path === '/api/start') return send(200,queue.start(3));
      if (path === '/api/pause') {queue.pause(); return send(200,queue.status());}
      if (path === '/api/retry') {store.retry(body.id);return send(200,{ok:true});}
      if (path === '/api/review') {store.review(body.id,body.status);return send(200,{ok:true});}
      if (path === '/api/shutdown' && onShutdown) {send(200,{ok:true});setImmediate(()=>onShutdown());return;}
      return send(404,{error:'Not found'});
    } catch(e) { return send(e.status || 400,{error:e.message || 'Request failed'}); }
  });
  return server;
}

export async function start() {
  const data = join(ROOT,'.research-data'); await mkdir(data,{recursive:true});
  const lockPath = join(data,'server.lock'); let lock;
  try {lock=await open(lockPath,'wx');} catch(e) {
    if (e.code !== 'EEXIST') throw e;
    const pid = Number(await readFile(lockPath,'utf8'));
    if (!Number.isInteger(pid) || pid<1) throw new Error('Invalid server.lock. Check whether the dashboard is running before removing it.');
    try {process.kill(pid,0);throw new Error('The research dashboard is already running.');} catch(probe) {if(probe.code !== 'ESRCH') throw probe;}
    await unlink(lockPath); lock=await open(lockPath,'wx');
  }
  await lock.writeFile(String(process.pid));
  let store,queue,server;
  const release=async()=>{await lock.close();await unlink(lockPath).catch(()=>{});};
  try {
    const port = Number(process.env.RESEARCH_PORT || 5199);
    if (!Number.isInteger(port) || port<1024 || port>65535) throw new Error('RESEARCH_PORT must be 1024–65535');
    const concurrency = 1;
    const browserSession=await createBrowserFallback();
    const localAIEnabled = process.env.RESEARCH_LOCAL_AI === '1';
    const analyze = process.env.RESEARCH_PROVIDER==='deepseek' ? createDeepSeekResearch({apiKey:process.env.DEEPSEEK_API_KEY,approved:process.env.RESEARCH_DEEPSEEK_APPROVED==='1',onUsage:record=>recordUsage(USAGE_FILE,record)}) : localAIEnabled ? createLocalResearch({baseUrl:process.env.RESEARCH_LOCAL_AI_URL,model:process.env.RESEARCH_LOCAL_MODEL}) : createEvidenceResearch();
    const extract = process.env.RESEARCH_ANALYZER_ENTRY ? createAnalyzer({entry:process.env.RESEARCH_ANALYZER_ENTRY}) : undefined;
    const nativeExtractionEnabled = process.platform === 'win32' && process.env.RESEARCH_WINDOWS_EXTRACTION !== '0';
    const nativeExtract = nativeExtractionEnabled ? createWindowsExtraction() : undefined;
    await cleanupStaleAttempts(join(data,'scratch'));
    store = new LibraryStore(join(data,'library.sqlite')); store.recover();
    queue = new ResearchQueue(store,(job,signal)=>processVideo(job,{scratchRoot:join(data,'scratch'),cobaltUrl:'http://127.0.0.1:9100',signal,analyze,extract,nativeExtract,acquireFallback:browserSession.acquire}),{concurrency,minIntervalMs:20_000});
    let close;
    server = createApp({store,queue,port,localAIEnabled,browserSession,onShutdown:()=>close()});
    await new Promise((done,fail)=>{server.once('error',fail);server.listen(port,'127.0.0.1',done);});
    console.log(`Research Library: http://127.0.0.1:${port}\nPilot mode: three videos per batch, concurrency ${concurrency}. No paid API calls.\nStop with Ctrl+C. Media extraction is not complete research.`);
    let closing=false;
    close=async()=>{if(closing)return;closing=true;server.close();server.closeIdleConnections();await queue.stop();store.close();await release();};
    process.once('SIGINT',()=>close().then(()=>process.exit(0))); process.once('SIGTERM',()=>close().then(()=>process.exit(0)));
    return {server,store,queue,close};
  } catch(e) { if(queue)await queue.stop();if(store)store.close();await release();throw e; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) start().catch(e=>{console.error(e.message);process.exitCode=1;});
