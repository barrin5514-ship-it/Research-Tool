import {randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {isTestFixture} from '../public/result-view.mjs';
import {budgetedFetch,writeBudget} from './deepseek-budget.mjs';
import {createDeepSeekResearch} from './deepseek.mjs';
export class BatchController{
 constructor({store,queue,dataRoot,apiKey,onUsage=async()=>{},fetcher=fetch}){Object.assign(this,{store,queue,dataRoot,apiKey,onUsage,fetcher});this.current=null;this.pendingWrite=Promise.resolve();queue.onIdle=()=>this.end();}
 async start({size=10,collection='All'}={}){
  if(this.starting||this.queue.running||this.queue.active.size)throw Error('Wait for the current batch to finish.');
  if(![3,5,10,25].includes(size))throw Error('Choose 3, 5, 10 or 25 videos.');
  if(!this.apiKey?.trim())throw Error('Configure the server-side DeepSeek key first.');
  const videos=this.store.list().filter(v=>!isTestFixture(v)&&['pending','retry_wait'].includes(v.status)&&(collection==='All'||v.collections.includes(collection)||(collection==='Unassigned'&&!v.collections.length))).slice(0,size).map(v=>({id:v.id,url:v.url,title:v.title}));
  if(!videos.length)throw Error('No waiting videos are available in this collection.');
  this.starting=true;this.cancelStart=false;
  try{await this.pendingWrite;await mkdir(this.dataRoot,{recursive:true});const file=join(this.dataRoot,`batch-${randomUUID()}.json`);const budget={active:true,mode:'tracking',maxCalls:videos.length,videos,requests:[]};await writeFile(file,JSON.stringify(budget,null,2),{flag:'wx'});this.current={file,budget,collection};if(this.cancelStart){this.end();await this.pendingWrite;return this.queue.status();}return this.queue.start(size,new Set(videos.map(v=>v.id)));}finally{this.starting=false;}
 }
 end(){const batch=this.current;if(!batch||!batch.budget.active)return;batch.budget.active=false;this.pendingWrite=this.pendingWrite.then(async()=>{const b=JSON.parse(await readFile(batch.file,'utf8'));b.active=false;await writeBudget(batch.file,b);});this.pendingWrite.catch(()=>{});}
 stop(){this.cancelStart=true;this.queue.pause('Stopped by owner; current video finishes.');return this.queue.status();}
 async status(){await this.pendingWrite;if(!this.current)return {active:false,costUSD:0,unknownUsage:false};const b=JSON.parse(await readFile(this.current.file,'utf8'));return {active:this.current.budget.active,costUSD:b.requests.reduce((n,r)=>n+(r.usage?.estimatedUSD||0),0),unknownUsage:b.requests.some(r=>!r.usage),collection:this.current.collection};}
 async analyze(evidence){const batch=this.current;if(!batch?.budget.active||!batch.budget.videos.some(v=>v.id===evidence.job.id))throw Error('This video is outside the active batch.');const analyze=createDeepSeekResearch({apiKey:this.apiKey,approved:true,getProjects:()=>this.store.activeProjects(),fetcher:budgetedFetch(batch.file,this.fetcher),onUsage:async record=>{await this.onUsage(record);const b=JSON.parse(await readFile(batch.file,'utf8'));const request=b.requests.find(r=>r.id===record.videoId);if(record.usage&&request)request.usage=record.usage;await writeBudget(batch.file,b);}});try{return await analyze(evidence);}catch(error){this.queue.pause('DeepSeek failed; batch stopped without a paid retry.');throw error;}}
}
