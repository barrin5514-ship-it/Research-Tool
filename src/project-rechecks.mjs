import {randomUUID,createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {createDeepSeekResearch,estimateResearchRequest,DEEPSEEK_ENDPOINT} from './deepseek.mjs';
import {isTestFixture} from '../public/result-view.mjs';
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export class ProjectRechecks{
 constructor({store,apiKey,isBusy=()=>false,onUsage=async()=>{},fetcher=fetch,minIntervalMs=20000}){Object.assign(this,{store,apiKey,isBusy,onUsage,fetcher,minIntervalMs});this.preview=null;this.state={running:false,done:0,total:0,costUSD:0,error:null};}
 fingerprint(video,project){return digest({project:{id:project.id,name:project.name,description:project.description},transcript:video.result?.transcript||null,ocr:video.result?.ocr||[],caption:video.title,researchOverride:video.researchOverride});}
 prepare(projectId){
  if(this.state.running||this.isBusy())throw Error('Wait for the current batch to finish.');
  const project=this.store.activeProjects().find(p=>p.id===projectId);if(!project)throw Error('Turn this project on before re-checking.');
  const candidates=this.store.list().filter(v=>!isTestFixture(v)&&!this.store.isExcluded(v)&&(v.researchOverride||v.result?.skipReason!=='visual_reference')&&v.status!=='running'&&(v.result?.transcript?.trim()||v.result?.ocr?.some(x=>x.text?.trim()))).map(v=>({id:v.id,fingerprint:this.fingerprint(v,project)})).filter(v=>!this.store.hasProjectRecheck(v.id,project.id,v.fingerprint));
  const projectContext={[project.name]:project.description};
  const estimatedUSD=candidates.reduce((sum,item)=>{const v=this.store.get(item.id);return sum+estimateResearchRequest({job:v,transcript:v.result.transcript,ocr:v.result.ocr||[],projectContext});},0);
  this.preview={token:randomUUID(),projectId,projectFingerprint:digest(project),candidates,estimatedUSD,createdAt:Date.now()};return {token:this.preview.token,project:project.name,count:candidates.length,estimatedUSD,note:'Conservative upper estimate. Uses saved transcript and on-screen text, without downloading videos. Earlier answers and other project matches are kept.'};
 }
 confirm({token,confirmed}){
  if(confirmed!==true||!this.preview||token!==this.preview.token||Date.now()-this.preview.createdAt>600000)throw Error('Review the count and cost and confirm first.');
  if(this.state.running||this.isBusy())throw Error('Wait for the current batch to finish.');
  if(!this.apiKey?.trim())throw Error('Configure the server-side DeepSeek key.');
  const plan=this.preview,project=this.store.activeProjects().find(p=>p.id===plan.projectId);
  if(!project||digest(project)!==plan.projectFingerprint||plan.candidates.some(c=>{const v=this.store.get(c.id);return !v||this.store.isExcluded(v)||this.fingerprint(v,project)!==c.fingerprint;}))throw Error('The project or saved evidence changed. Review again.');
  this.preview=null;this.stopRequested=false;this.waitController=new AbortController();this.state={running:plan.candidates.length>0,project:project.name,done:0,total:plan.candidates.length,costUSD:0,error:null};
  this.finished=this.run(plan,project).catch(()=>{this.state.error='Re-check failed; no automatic paid retry.';}).finally(()=>{this.state.running=false;});return this.status();
 }
 async run(plan,project){
  for(const candidate of plan.candidates){
   if(this.stopRequested)break;
   const current=this.store.activeProjects().find(p=>p.id===project.id);if(!current||digest(current)!==plan.projectFingerprint){this.state.error='Project changed; review remaining results again.';break;}
   const video=this.store.get(candidate.id);if(this.store.isExcluded(video)||this.fingerprint(video,project)!==candidate.fingerprint){this.state.error='Saved evidence changed; review again.';break;}
   let requests=0;const analyze=createDeepSeekResearch({apiKey:this.apiKey,approved:true,getProjects:()=>[project],fetcher:async(url,options)=>{if(url!==DEEPSEEK_ENDPOINT||requests++)throw Error('Only one request per confirmed saved result is permitted.');return this.fetcher(url,options);},onUsage:async record=>{this.state.costUSD+=record.usage?.estimatedUSD||0;await this.onUsage({...record,kind:'project-recheck',projectId:project.id});}});
   try{const result=await analyze({job:video,transcript:video.result.transcript,ocr:video.result.ocr||[]});const latest=this.store.activeProjects().find(p=>p.id===project.id);if(!latest||digest(latest)!==plan.projectFingerprint){this.state.error='Project changed while the response arrived; findings were not replaced.';break;}if(result.skipReason==='visual_reference'){this.store.finish(video.id,{status:'skipped',result:{...video.result,...result,recommendations:[]}});}else this.store.saveProjectRecheck(video.id,project,candidate.fingerprint,result);this.state.done++;}catch{this.state.error='DeepSeek re-check failed; stopped without a paid retry.';break;}
   if(this.state.done<plan.candidates.length&&!this.stopRequested)try{await delay(this.minIntervalMs,undefined,{signal:this.waitController.signal});}catch{break;}
  }
 }
 stop(){this.preview=null;this.stopRequested=true;this.waitController?.abort();}
 status(){return {...this.state};}
 async close(){this.stop();await this.finished;}
}
