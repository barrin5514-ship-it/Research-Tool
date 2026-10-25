import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {freemem} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {LibraryStore} from '../src/store.mjs';
import {ResearchQueue} from '../src/queue.mjs';
import {processVideo} from '../src/processor.mjs';
import {createBrowserFallback} from '../src/browser-fallback.mjs';
import {createWindowsExtraction} from '../src/windows-extraction.mjs';
import {createEvidenceResearch} from '../src/evidence-research.mjs';
import {createLocalResearch} from '../src/research.mjs';
import {createApp} from '../src/server.mjs';
// Acceptance harness only: real media, isolated SQLite, no paid adapter or key.
const source='https://www.instagram.com/p/De2y_j8AHd1/';
const visionMode=process.argv.includes('--vision');
const run=promisify(execFile),lms='C:/Users/barri/.lmstudio/bin/lms.exe';
const root=resolve('.test-artifacts/mvp-real');await mkdir(root,{recursive:true});
const scratchRoot=join(root,'scratch');
const mainState=async()=>{const response=await fetch('http://127.0.0.1:5199/api/state');if(!response.ok)throw Error('Main dashboard unavailable');return response.json();};
const fingerprint=s=>createHash('sha256').update(JSON.stringify(s.videos)).digest('hex');
const before=await mainState();if(before.queue.active||before.queue.running)throw Error('Pause main queue before acceptance test');
const store=new LibraryStore(join(root,'acceptance-'+Date.now()+'.sqlite'));
const browser=await createBrowserFallback();
const analyze=visionMode?async evidence=>{
 await run(lms,['load','qwen3-vl-2b-instruct','--gpu','off','--context-length','4096','--parallel','1','--ttl','180','--identifier','qwen3-vl-2b-instruct','--yes'],{windowsHide:true,timeout:90000,maxBuffer:500000,signal:evidence.signal});
 try{const result=await createLocalResearch({model:'qwen3-vl-2b-instruct'})({...evidence,frames:evidence.frames.slice(0,1)});result.provenance.framesAnalyzed=1;return result;}
 finally{await run(lms,['unload','qwen3-vl-2b-instruct'],{windowsHide:true,timeout:30000});}
}:createEvidenceResearch();let acquisition=null;
const queue=new ResearchQueue(store,async(job,signal)=>processVideo(job,{scratchRoot,signal,nativeExtract:createWindowsExtraction(),analyze,acquireFallback:async args=>{const media=await browser.acquire(args);acquisition={method:media.method,bytes:media.bytes};return media;}}),{concurrency:1,minIntervalMs:20000});
const server=createApp({store,queue,browserSession:browser});await new Promise((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok);});
const base='http://127.0.0.1:'+server.address().port;
let report;
try{
 const initial=await(await fetch(base+'/api/state')).json();
 const post=async(route,body)=>{const r=await fetch(base+route,{method:'POST',headers:{origin:base,'content-type':'application/json','x-research-token':initial.csrf},body:JSON.stringify(body)});if(!r.ok)throw Error('Acceptance HTTP request failed');return r.json();};
 await post('/api/links',{links:source,collection:'Tech'});await post('/api/start',{});
 const deadline=Date.now()+390000;
 while(queue.status().running||queue.status().active){if(Date.now()>deadline)throw Error('Acceptance timed out');await new Promise(r=>setTimeout(r,1000));}
 const final=await(await fetch(base+'/api/state')).json();const video=final.videos[0];
 const text=video.result?.transcript||'';const markers=['Steam','Figma','Office','Intercom','Superhuman'].filter(word=>text.toLowerCase().includes(word.toLowerCase()));
 let visionReadiness;
 try{const listing=await(await fetch('http://127.0.0.1:1234/api/v0/models')).json();visionReadiness=listing.data?.find(m=>m.id==='qwen3-vl-2b-instruct')?.state||'unavailable';}catch{visionReadiness='unavailable';}
 const after=await mainState();
 report={at:new Date().toISOString(),scope:visionMode?'REAL Instagram content with local visual-model inference of one sampled frame; isolated test library':'REAL Instagram content; isolated test library; free local evidence analysis, not DeepSeek',source,status:video.status,error:video.error,acquisition,transcriptCharacters:text.length,transcriptExcerpt:text.slice(0,700),recognizedNames:markers,ocrEntries:video.result?.ocr?.length||0,ocrTexts:video.result?.ocr?.map(x=>x.text)||[],frames:video.result?.extraction?.framesExtracted||0,durationSeconds:video.result?.extraction?.durationSeconds,warnings:video.result?.extraction?.warnings||[],visionStatus:video.result?.extraction?.visionStatus||'not_analyzed',visualFindings:video.result?.visualFindings||[],summary:video.result?.summary,framesAnalyzed:video.result?.provenance?.framesAnalyzed||0,visionReadiness,freeRAMGiB:freemem()/2**30,provider:video.result?.provenance?.provider||null,recommendations:video.result?.recommendations||[],dashboardHTTP:(await fetch(base)).status,temporaryEntries:await readdir(scratchRoot).catch(()=>[]),mainDataUnchanged:fingerprint(before)===fingerprint(after),paidCalls:after.deepseekUsage.length-before.deepseekUsage.length,limitations:['Name checks establish intelligibility, not a word-error-rate accuracy measurement.',visionMode?'Only one sampled frame was sent to the vision model; observations still require review.':'No visual-model inference was run. OCR reads text only.','All model/rules suggestions and claims remain NOT VERIFIED.']};
 await writeFile(join(root,'real-result.json'),JSON.stringify(video,null,2));
 await writeFile(visionMode?'docs/MVP_REAL_VISION_ACCEPTANCE.json':'docs/MVP_REAL_ACCEPTANCE.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
 if(!text||markers.length<3||!report.ocrEntries||report.temporaryEntries.length||!report.mainDataUnchanged||report.paidCalls||!video.result||report.dashboardHTTP!==200||(visionMode&&(!report.visualFindings.length||report.visionStatus!=='analyzed')))process.exitCode=1;
}finally{await queue.stop();await new Promise(r=>server.close(r));store.close();}
