import {readFile,writeFile,open,appendFile} from 'node:fs/promises';
import {createDeepSeekResearch,DEEPSEEK_ENDPOINT} from '../src/deepseek.mjs';
import {recordUsage} from '../src/deepseek-usage.mjs';
import {LibraryStore} from '../src/store.mjs';
process.loadEnvFile('.env');
const id='SyntheticDeepSeekOneShot';
if(!process.env.DEEPSEEK_API_KEY?.trim())throw Error('Local API key is missing; no request sent');
const lock=await open('.research-data/deepseek-one-shot.used','wx');await lock.writeFile(new Date().toISOString());await lock.close();
// This durable guard is consumed before network I/O. Never automatically retry.
let count=0,rawUsage=null,httpStatus=null;
const research=createDeepSeekResearch({apiKey:process.env.DEEPSEEK_API_KEY,approved:true,onUsage:record=>recordUsage('.research-data/deepseek-usage.jsonl',record),fetcher:async(url,options)=>{
 if(url!==DEEPSEEK_ENDPOINT||++count!==1)throw Error('Single-call restriction');
 const upperBound=Buffer.byteLength(options.body)*0.30/1e6+1200*1.20/1e6;
 if(upperBound>0.01)throw Error('Conservative preflight exceeds approved budget');
 const response=await fetch(url,options);httpStatus=response.status;
 if(response.ok){try{rawUsage=(await response.clone().json()).usage;}catch{}}
 return response;
}});
try{
 const result=await research({job:{id,title:'TEST FIXTURE: DeepSeek text-only synthetic research',url:'https://www.instagram.com/p/SyntheticDeepSeekOneShot/',collections:['Tech']},transcript:'This is a synthetic software research example, not an Instagram video. SQLite is an embedded database engine. A research library could use transactions to preserve processing status after interruption. Investigate whether this improves the existing Research Agent without modifying other projects.',ocr:[{text:'SYNTHETIC TEST: SQLite transactions and resumable research queues. No trading advice.'}]});
 result.title='TEST FIXTURE: DeepSeek text-only synthetic research';
 const store=new LibraryStore('.research-data/library.sqlite');
 try{if(store.get(id))throw Error('Synthetic result already exists');store.import([{shortcode:id,url:'https://www.instagram.com/p/SyntheticDeepSeekOneShot/',title:result.title,collections:['Tech']}]);store.finish(id,{status:'needs_analysis',result});}finally{store.close();}
 const report={requestCount:count,httpStatus,parsed:true,rawUsage,costEstimate:result.usage,verification:result.verification,dashboardId:id,actualInvoiceCost:'Not returned by chat-completion API; cost is calculated from reported tokens and published rates.'};
 await writeFile('docs/DEEPSEEK_LIVE_RESULT.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(error){const report={requestCount:count,httpStatus,parsed:false,rawUsage,error:'One-shot test failed; no automatic retry permitted.'};await writeFile('docs/DEEPSEEK_LIVE_RESULT.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));process.exitCode=1;}
