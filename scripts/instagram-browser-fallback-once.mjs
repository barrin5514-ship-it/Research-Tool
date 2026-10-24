import {open,writeFile,readdir,appendFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createBrowserFallback} from '../src/browser-fallback.mjs';
import {processVideo} from '../src/processor.mjs';
import {createWindowsExtraction} from '../src/windows-extraction.mjs';
import {createDeepSeekResearch,DEEPSEEK_ENDPOINT} from '../src/deepseek.mjs';
import {recordUsage} from '../src/deepseek-usage.mjs';
import {LibraryStore} from '../src/store.mjs';
process.loadEnvFile('.env');
const id='De2y_j8AHd1',url='https://www.instagram.com/p/De2y_j8AHd1/';
const guard=await open(`.research-data/instagram-${id}.browser-fallback-attempt-2`,'wx');await guard.writeFile(new Date().toISOString());await guard.close();
await appendFile('docs/PROMPT_LOG.md',`\n## Approved single real Instagram processing request\n\nApproved: process ONE real public Instagram video end to end (Cobalt download → Whisper → OCR → DeepSeek → dashboard). Max one DeepSeek call, max $0.01. I will provide the link. Delete the video after processing. Report: what was transcribed, DeepSeek's recommendations, actual tokens and cost, and anything that failed. Update PROMPT_LOG.md.\n\nSource: ${url}\n`);
let paidCalls=0,httpStatus=null,rawUsage=null,cobaltIssue=null,analysisIssue=null;
const scratchRoot=resolve('.research-data/scratch');
const store=new LibraryStore('.research-data/library.sqlite');
if(store.get(id)){if(store.get(id).status!=='failed'){store.close();throw Error('Existing non-failed record requires review');}store.retry(id);}
store.import([{shortcode:id,url,title:'Instagram public video: De2y_j8AHd1',collections:[]}]);
const job=store.claim(Date.now(),new Set([id]));
const analyze=createDeepSeekResearch({apiKey:process.env.DEEPSEEK_API_KEY,approved:true,onUsage:r=>recordUsage('.research-data/deepseek-usage.jsonl',r),fetcher:async(target,options)=>{
 if(target!==DEEPSEEK_ENDPOINT||paidCalls!==0)throw Error('Paid request restricted');
 const bound=Buffer.byteLength(options.body)*0.30/1e6+1200*1.20/1e6;
 if(bound>0.01)throw Error('Input exceeds approved conservative USD0.01 budget');
 const paidGuard=await open(`.research-data/instagram-${id}.browser-fallback-paid.used`,'wx');await paidGuard.writeFile(new Date().toISOString());await paidGuard.close();
 paidCalls++;
 const response=await fetch(target,options);httpStatus=response.status;
 if(response.ok)try{rawUsage=(await response.clone().json()).usage;}catch{}
 return response;
}});
let outcome,acquisition=null;
try{
 const browser=await createBrowserFallback();
 outcome=await processVideo(job,{scratchRoot,acquireFallback:async args=>{const media=await browser.acquire(args);acquisition={method:media.method,bytes:media.bytes};return media;},nativeExtract:createWindowsExtraction(),analyze:async evidence=>{
  if(!evidence.transcript?.trim()&&!evidence.ocr?.some(x=>x.text?.trim()))throw Error('No meaningful extracted text; no paid request sent');
  try{return await analyze(evidence);}catch(e){analysisIssue=e.message;throw e;}
 },fetcher:async(target,options)=>{
  const r=await fetch(target,options);
  if(options?.method==='POST')try{const b=await r.clone().json();if(b.status==='error')cobaltIssue=b.error?.code||'unknown Cobalt rejection';}catch{}
  return r;
 }});
 store.finish(id,outcome);
}catch(error){store.fail(id,{code:error.code||'PROCESSING_FAILED',retryable:false});outcome={status:'failed',failureCode:error.code||'PROCESSING_FAILED'};}
finally{store.close();}
const remaining=await readdir(scratchRoot).catch(()=>[]);
const report={sourceUrl:url,paidCalls,httpStatus,rawUsage,cobaltIssue,analysisIssue,acquisition,...outcome,scratchEntriesAfter:remaining,costNote:'Chat API does not return an invoice charge. usage.estimatedUSD uses conservative published peak prices; actual billed amount is unverified.'};
await writeFile('docs/INSTAGRAM_BROWSER_FALLBACK_TEST.json',JSON.stringify(report,null,2));
await appendFile('docs/PROMPT_LOG.md',`\nExecution outcome: ${outcome.status}; paid requests: ${paidCalls}; Cobalt issue: ${cobaltIssue||'none reported'}; remaining scratch entries: ${remaining.length}. Full evidence in docs/INSTAGRAM_BROWSER_FALLBACK_TEST.json. No further paid calls authorized.\n`);
console.log(JSON.stringify(report,null,2));


