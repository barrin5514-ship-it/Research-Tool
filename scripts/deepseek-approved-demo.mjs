import {readFile,writeFile,open,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {LibraryStore} from '../src/store.mjs';
import {processVideo} from '../src/processor.mjs';
import {createBrowserFallback} from '../src/browser-fallback.mjs';
import {createWindowsExtraction} from '../src/windows-extraction.mjs';
import {createDeepSeekResearch} from '../src/deepseek.mjs';
import {budgetedFetch} from '../src/deepseek-budget.mjs';
import {recordUsage} from '../src/deepseek-usage.mjs';
// Owner-approved fixed plan. A persistent reservation is made before every request.
process.loadEnvFile('.env');
const budgetFile='.research-data/deepseek-demo-budget.json';
const videos=JSON.parse(await readFile('.research-data/deepseek-demo-plan.json','utf8'));
if(videos.length!==3||videos.filter(v=>v.project==='Pennywise').length!==2||videos.filter(v=>v.project==='Personafy').length!==1)throw Error('Invalid approved plan');
const guard=await open(budgetFile,'wx');await guard.writeFile(JSON.stringify({active:true,videos,requests:[]},null,2));await guard.close();
const setApproval=async value=>{let env=await readFile('.env','utf8');env=env.replace(/^RESEARCH_DEEPSEEK_APPROVED=.*$/m,'RESEARCH_DEEPSEEK_APPROVED='+value);await writeFile('.env',env);};
const report={started:new Date().toISOString(),limitUSD:0.03,maxCalls:3,videos:[],costNote:'Actual token counts; cost estimated at conservative peak rates, not an invoice.'};
const store=new LibraryStore('.research-data/library.sqlite');
try{
 await setApproval('1');const browser=await createBrowserFallback();
 for(const item of videos){
  const previous=store.get(item.id);if(!previous||previous.result||previous.status!=='pending')throw Error('Selected video is no longer new');
  const job=store.claim(Date.now(),new Set([item.id]));let acquisition=null,analysisIssue=null,httpStatus=null,usage=null;
  console.log('Processing '+item.project+' '+item.id);
  const analyze=createDeepSeekResearch({apiKey:process.env.DEEPSEEK_API_KEY,approved:true,fetcher:budgetedFetch(budgetFile,async(...args)=>{const response=await fetch(...args);httpStatus=response.status;return response;}),onUsage:async record=>{usage=record.usage;await recordUsage('.research-data/deepseek-usage.jsonl',record);}});
  let outcome;
  try{
   outcome=await processVideo(job,{scratchRoot:resolve('.research-data/scratch'),cobaltUrl:'http://127.0.0.1:9100',nativeExtract:createWindowsExtraction(),acquireFallback:async args=>{const media=await browser.acquire(args);acquisition={method:media.method,bytes:media.bytes};return media;},analyze:async evidence=>{try{if(!evidence.transcript?.trim()&&!evidence.ocr?.some(x=>x.text?.trim()))throw Error('No meaningful text recovered; no paid call sent');return await analyze(evidence);}catch(error){analysisIssue=error.message;throw error;}}});
   store.finish(item.id,outcome);
  }catch(error){store.fail(item.id,{code:error.code||'PROCESSING_FAILED',retryable:false});outcome={status:'failed',failureCode:error.code||'PROCESSING_FAILED'};}
  const record={...item,httpStatus,usage,acquisition,analysisIssue,...outcome,scratchEntriesAfter:await readdir('.research-data/scratch').catch(()=>[])};
  report.videos.push(record);await writeFile('.research-data/deepseek-demo-result.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({id:item.id,status:outcome.status,method:acquisition?.method||outcome.result?.extraction?.mode,httpStatus,analysisIssue,usage}));
  if(analysisIssue||outcome.status==='failed'||!outcome.result?.answers){report.stopped='Stopped on first failure; no later videos attempted.';break;}
  if(item!==videos.at(-1))await new Promise(done=>setTimeout(done,20000));
 }
}catch(error){report.stopped=error.message;}
finally{
 const budget=JSON.parse(await readFile(budgetFile,'utf8'));budget.active=false;await writeFile(budgetFile,JSON.stringify(budget,null,2));await setApproval('0');store.close();report.finished=new Date().toISOString();report.requests=budget.requests;report.estimatedUSD=report.videos.reduce((n,v)=>n+(v.usage?.estimatedUSD||0),0);report.paidApprovalDisabled=true;await writeFile('.research-data/deepseek-demo-result.json',JSON.stringify(report,null,2));console.log('Finished; paid approval disabled. Requests: '+budget.requests.length);
}
