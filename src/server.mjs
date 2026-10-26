import {SavedAnalysis} from './saved-analysis.mjs';
import {INPUT_LIMITS} from '../public/input-limits.mjs';
import {thumbnailVideos,readThumbnail} from './thumbnails.mjs';
import {ProjectCombinations} from './project-combinations.mjs';
import {researchCounts,visualReference} from '../public/result-view.mjs';
import {ProjectRechecks} from './project-rechecks.mjs';
import {createBalanceTracker} from './deepseek-balance.mjs';
import {BatchController} from './batches.mjs';
import { createServer } from 'node:http';
import { readFile, mkdir, open, unlink } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { LibraryStore } from './store.mjs';
import { ResearchQueue } from './queue.mjs';
import { parseExport, normalizePastedPostUrl } from './importer.mjs';
import { processVideo,cleanupStaleAttempts } from './processor.mjs';
import { createLocalResearch } from './research.mjs';
import { createAnalyzer } from './analyzer-integration.mjs';
import { createWindowsExtraction } from './windows-extraction.mjs';
import {createEvidenceResearch} from './evidence-research.mjs';
import {recordUsage,readUsage,usageSummary} from './deepseek-usage.mjs';
import {createBrowserFallback} from './browser-fallback.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const USAGE_FILE=join(ROOT,'.research-data','deepseek-usage.jsonl');
const STATIC = new Map([['/',['index.html','text/html; charset=utf-8']],['/app.js',['app.js','text/javascript; charset=utf-8']],['/style.css',['style.css','text/css; charset=utf-8']]]);
const MAX_BODY = INPUT_LIMITS.importRequestBytes;
STATIC.set('/result-view.mjs',['result-view.mjs','text/javascript; charset=utf-8']);
STATIC.set('/post-view.mjs',['post-view.mjs','text/javascript; charset=utf-8']);
STATIC.set('/add-links.mjs',['add-links.mjs','text/javascript; charset=utf-8']);
STATIC.set('/result-routing.mjs',['result-routing.mjs','text/javascript; charset=utf-8']);
STATIC.set('/last-run.mjs',['last-run.mjs','text/javascript; charset=utf-8']);
STATIC.set('/input-limits.mjs',['input-limits.mjs','text/javascript; charset=utf-8']);
STATIC.set('/thumbnail-view.mjs',['thumbnail-view.mjs','text/javascript; charset=utf-8']);
STATIC.set('/batch-preview.mjs',['batch-preview.mjs','text/javascript; charset=utf-8']);
STATIC.set('/recipes.mjs',['recipes.mjs','text/javascript; charset=utf-8']);
STATIC.set('/recipes-view.mjs',['recipes-view.mjs','text/javascript; charset=utf-8']);
STATIC.set('/answer-format.mjs',['answer-format.mjs','text/javascript; charset=utf-8']);
async function readJson(req) {
  const chunks = []; let length = 0;
  for await (const chunk of req) { length += chunk.length; if (length > MAX_BODY) { const error = new Error('These files are too large to upload together. Choose fewer files under 25 MB each.'); error.status = 413; throw error; } chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('Invalid JSON request'); }
}
export function createApp({store,queue,localAIEnabled=false,researchProvider='deepseek',paidApproval=false,port=5199,thumbnailRoot=join(ROOT,'.research-data','thumbnails'),onShutdown,browserSession,batches,balanceTracker,rechecks,combinations}) {
  const savedAnalysis=new SavedAnalysis({store,apiKey:process.env.DEEPSEEK_API_KEY,isBusy:()=>queue.running||queue.active.size>0||rechecks?.status().running||combinations?.status().running,onUsage:record=>recordUsage(USAGE_FILE,record)});
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
      if(req.method==='GET'&&path.startsWith('/api/thumbnails/')){try{return send(200,await readThumbnail(thumbnailRoot,path.slice('/api/thumbnails/'.length)),'image/jpeg');}catch{return send(404,{error:'Thumbnail unavailable'});}}
      if (req.method === 'GET' && path === '/api/state') return send(200,{application:'instagram-research-library',instagramBrowser:browserSession?await browserSession.status():null,deepseekUsage:await readUsage(USAGE_FILE),videos:await thumbnailVideos(store.list(),thumbnailRoot),projects:store.projects(),combinedPlans:store.combinations(),combining:combinations?.status()||{running:false},excludedCollections:store.excludedCollections(),researchCounts:researchCounts(store.list(),store.excludedCollections()),rechecks:savedAnalysis.running?{running:true,project:'saved result',done:0,total:1,costUSD:0}:rechecks?.status()||{running:false},queue:queue.status(),csrf,localAIEnabled,researchProvider,paidApproval:false,batch:batches?await batches.status():null,spending:await usageSummary(USAGE_FILE),balance:balanceTracker?await balanceTracker.get():null,
        limitations:['Choose up to 25 videos; one video at a time.','Windows speech/OCR is available; model reasoning and semantic claim verification remain incomplete.','No background operation after this server stops.','Approval records your decision; it does not modify a project.']});
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
        if (!Array.isArray(body.files) || body.files.length < 1 || body.files.length > INPUT_LIMITS.importFilesPerRequest) throw new Error('Choose 1 to 10 extracted saved-post or collection files');
        const parsed = body.files.map(file => {
          if (typeof file.name !== 'string' || typeof file.content !== 'string') throw new Error('Invalid import file');
          return {name:file.name.slice(0,200),content:file.content,...parseExport(file.content,{filename:file.name})};
        });
        const results = parsed.map(file => ({filename:file.name,posts:file.items.length,collections:file.collections,warnings:file.warnings,...store.import(file.items,{hash:createHash('sha256').update(file.content).digest('hex'),filename:file.name})}));
        return send(200,{results});
      }
      if (path === '/api/links') {
        if (typeof body.links !== 'string' || body.links.length > 10000) throw new Error('Paste up to three Instagram links');
        const links = body.links.split(/\s+/).filter(Boolean);
        if (links.length < 1 || links.length > 3) throw new Error('Paste one to three links for this pilot');
        const collection = ['Pennywise','Personafy','Tech'].includes(body.collection) ? body.collection : undefined;
        const items = links.map(raw => ({...normalizePastedPostUrl(raw),title:'Instagram video',collections:collection?[collection]:[]}));
        const addedIds=items.filter(item=>!store.get(item.shortcode)).map(item=>item.shortcode);return send(200,{...store.import(items),ids:items.map(item=>item.shortcode),addedIds});
      }
      if(path==='/api/posts/move'){if(savedAnalysis.running)throw Error('Wait for current research to finish.');store.moveToProject(body.id,body.projectId);return send(200,{message:'Project choice saved. No paid call.'});}
      if(path==='/api/posts/analyze/preview')return send(200,savedAnalysis.prepare(body.id));
      if(path==='/api/posts/analyze/confirm'){if(researchProvider!=='deepseek')throw Error('DeepSeek is unavailable.');return send(200,await savedAnalysis.confirm(body));}
      if(savedAnalysis.running)throw Error('Wait for current research to finish.');
      if(path==='/api/projects/combine/preview'){if(!combinations)throw Error('Combining is unavailable.');return send(200,combinations.prepare(body.id));}
      if(path==='/api/projects/combine/confirm'){if(!combinations)throw Error('Combining is unavailable.');return send(200,combinations.confirm(body));}
      if(path==='/api/collections/exclusion')return send(200,{excluded:store.setCollectionExcluded(body.name,body.excluded)});
      if(path==='/api/reference/override'){const video=store.get(body.id);if(!video||(!store.isExcluded(video)&&!visualReference(video)))throw Error('This item is not excluded or marked visual reference.');store.overrideReference(body.id);if(queue.running||queue.active.size||batches?.starting||rechecks?.status().running||combinations?.status().running)return send(200,{message:'Marked not reference and queued. Start a new batch when current work finishes.'});if(!batches)throw Error('Batch processing unavailable.');await batches.start({size:1,id:body.id});return send(200,{message:'Marked not reference; analysis started for this video only.'});}
      if(path==='/api/projects/save')return send(200,store.saveProject(body));
      if(path==='/api/projects/delete'){store.deleteProject(body.id,body.confirmed);return send(200,{ok:true});}
      if(path==='/api/projects/recheck/preview'){if(combinations?.status().running)throw Error('Wait for combined plans to finish.');if(!rechecks)throw Error('Re-check unavailable.');return send(200,rechecks.prepare(body.id));}
      if(path==='/api/projects/recheck/confirm'){if(combinations?.status().running)throw Error('Wait for combined plans to finish.');if(!rechecks)throw Error('Re-check unavailable.');return send(200,rechecks.confirm(body));}
      if(path==='/api/posts/run/preview'||path==='/api/posts/run/confirm'){if(!batches||researchProvider!=='deepseek')throw Error('DeepSeek processing is unavailable.');if(rechecks?.status().running||combinations?.status().running)throw Error('Wait for the current research to finish.');return send(200,path.endsWith('/preview')?batches.prepareSingle(body.id):await batches.confirmSingle(body));}
      if(path==='/api/start'){if(combinations?.status().running)throw Error('Wait for combined plans to finish.');if(rechecks?.status().running)throw Error('Wait for the project re-check to finish.');if(!batches||researchProvider!=='deepseek')throw Error('DeepSeek batches are unavailable.');return send(200,await batches.start(body));}
      if(path==='/api/balance'){if(!balanceTracker)throw Error('Balance lookup is unavailable.');return send(200,await balanceTracker.refresh());}
      if(path==='/api/analyze')throw Error('Choose a collection and start a batch from My library.');
      if(path==='/api/pause'||path==='/api/stop'){rechecks?.stop();if(batches)batches.stop();else queue.pause();return send(200,queue.status());}
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
    const researchProvider=process.env.RESEARCH_PROVIDER||'deepseek';
    if(!['deepseek','local','evidence'].includes(researchProvider))throw Error('Unknown research provider');
    const paidApproval=false;let batches;
    const analyze = researchProvider==='deepseek' ? evidence=>batches.analyze(evidence) : researchProvider==='local'&&localAIEnabled ? createLocalResearch({baseUrl:process.env.RESEARCH_LOCAL_AI_URL,model:process.env.RESEARCH_LOCAL_MODEL}) : researchProvider==='evidence' ? createEvidenceResearch() : async()=>{throw Error('Local analysis is disabled');};
    const extract = process.env.RESEARCH_ANALYZER_ENTRY ? createAnalyzer({entry:process.env.RESEARCH_ANALYZER_ENTRY}) : undefined;
    const nativeExtractionEnabled = process.platform === 'win32' && process.env.RESEARCH_WINDOWS_EXTRACTION !== '0';
    const nativeExtract = nativeExtractionEnabled ? createWindowsExtraction() : undefined;
    await cleanupStaleAttempts(join(data,'scratch'));
    store = new LibraryStore(join(data,'library.sqlite')); store.recover();
    queue = new ResearchQueue(store,(job,signal)=>store.isExcluded(store.get(job.id))?Promise.resolve({status:'skipped',result:{...(job.result||{}),summary:job.result?.summary||'Skipped: excluded collection',skipReason:'excluded_collection'}}):processVideo(job,{scratchRoot:join(data,'scratch'),thumbnailRoot:join(data,'thumbnails'),cobaltUrl:'http://127.0.0.1:9100',signal,analyze,extract,nativeExtract,acquireFallback:browserSession.acquire}),{concurrency,minIntervalMs:20_000});
    batches=new BatchController({store,queue,dataRoot:join(data,'batches'),apiKey:process.env.DEEPSEEK_API_KEY,onUsage:record=>recordUsage(USAGE_FILE,record)});
    const rechecks=new ProjectRechecks({store,apiKey:process.env.DEEPSEEK_API_KEY,isBusy:()=>queue.running||queue.active.size>0||batches.starting,onUsage:record=>recordUsage(USAGE_FILE,record)});
    const combinations=new ProjectCombinations({store,apiKey:process.env.DEEPSEEK_API_KEY,isBusy:()=>queue.running||queue.active.size>0||batches.starting||rechecks.status().running,onUsage:record=>recordUsage(USAGE_FILE,record)});
    const balanceTracker=createBalanceTracker({apiKey:process.env.DEEPSEEK_API_KEY,file:join(data,'deepseek-balance.json')});
    let close;
    server = createApp({store,queue,port,localAIEnabled,researchProvider,paidApproval,browserSession,batches,balanceTracker,rechecks,combinations,onShutdown:()=>close()});
    await new Promise((done,fail)=>{server.once('error',fail);server.listen(port,'127.0.0.1',done);});
    console.log(`Research Library: http://127.0.0.1:${port}\nBatch mode: up to 25 videos per batch, concurrency ${concurrency}. Research provider: ${researchProvider}; starts only from dashboard; spending tracked without a cap.\nStop with Ctrl+C. Media extraction is not complete research.`);
    let closing=false;
    close=async()=>{if(closing)return;closing=true;server.close();server.closeIdleConnections();await queue.stop();await rechecks.close();await combinations.close();batches.end();await batches.pendingWrite;store.close();await release();};
    process.once('SIGINT',()=>close().then(()=>process.exit(0))); process.once('SIGTERM',()=>close().then(()=>process.exit(0)));
    return {server,store,queue,close};
  } catch(e) { if(queue)await queue.stop();if(store)store.close();await release();throw e; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) start().catch(e=>{console.error(e.message);process.exitCode=1;});
