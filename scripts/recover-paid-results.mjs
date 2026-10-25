// Owner-authorized repair of exactly two billed results. No media acquisition imports.
import {readFile,writeFile} from 'node:fs/promises';
import {LibraryStore} from '../src/store.mjs';
import {createDeepSeekResearch,estimateResearchRequest} from '../src/deepseek.mjs';
import {budgetedFetch,writeBudget} from '../src/deepseek-budget.mjs';
import {recordUsage} from '../src/deepseek-usage.mjs';
const ids=['DZfphwwNmKR','Da-6xTXq6bu'];
const file='.research-data/recover-paid-oct25-budget.json';
if(!process.argv.includes('--approved'))throw Error('Requires the owner-approved recovery flag.');
// A live dashboard could start another batch: repair only while it is stopped.
try{const response=await fetch('http://127.0.0.1:5199/api/state',{signal:AbortSignal.timeout(1500)});if(response.ok)throw Error('Stop the idle Research Agent dashboard before recovery.');}catch(error){if(error.message.startsWith('Stop the idle'))throw error;}
const store=new LibraryStore('.research-data/library.sqlite');
const outcomes=[];
try{
 const budget=JSON.parse(await readFile(file,'utf8'));
 if(!budget.active||budget.requests.length||budget.maxCalls!==2||budget.limitUSD!==0.01||budget.mode==='tracking'||budget.videos.length!==2||!budget.videos.every(v=>ids.includes(v.id)))throw Error('Recovery budget does not match owner approval.');
 for(const id of ids){
  const job=store.get(id),saved=job?.result;
  if(!saved?.transcript?.trim()||!Array.isArray(saved.ocr))throw Error('Required saved transcript and OCR are missing.');
  if(budget.videos.find(v=>v.id===id)?.url!==job.url)throw Error('Approved URL does not match saved video.');
  const evidence={job,transcript:saved.transcript,ocr:saved.ocr};
  console.log(JSON.stringify({id,estimatedMaximumUSD:estimateResearchRequest({...evidence,projectContext:Object.fromEntries(store.activeProjects().map(p=>[p.name,p.description]))})}));
  let measured=null;
  const analyze=createDeepSeekResearch({apiKey:process.env.DEEPSEEK_API_KEY,approved:true,getProjects:()=>store.activeProjects(),fetcher:budgetedFetch(file),onUsage:async record=>{
   measured=record.usage;await recordUsage('.research-data/deepseek-usage.jsonl',record);
   const current=JSON.parse(await readFile(file,'utf8'));const request=current.requests.find(r=>r.id===id);if(request&&record.usage)request.usage=record.usage;await writeBudget(file,current);
  }});
  try{
   const analyzed=await analyze(evidence);
   const result={...saved,...analyzed,ocr:saved.ocr,transcript:saved.transcript,extraction:{...saved.extraction,warnings:(saved.extraction?.warnings||[]).filter(w=>!w.startsWith('Research provider is unavailable')),analysisStatus:'required',visionStatus:'not_analyzed'}};
   delete result.analysisFailure;
   store.finish(id,{status:analyzed.skipReason?'skipped':'needs_analysis',result});
   outcomes.push({id,status:store.get(id).status,summary:result.summary,answers:result.answers,recipe:result.recipe,recommendations:result.recommendations,warnings:result.validationWarnings,usage:measured});
  }catch{
   const result={...saved,analysisFailure:'DeepSeek did not return a usable analysis. Your saved transcript and on-screen text are safe.',...(measured?{usage:measured}:{})};
   store.finish(id,{status:'failed',result});outcomes.push({id,status:'failed',reason:result.analysisFailure,usage:measured});
  }
  await writeFile('.research-data/recover-paid-oct25-results.json',JSON.stringify(outcomes,null,2));
  console.log(JSON.stringify(outcomes.at(-1)));
 }
}finally{const budget=JSON.parse(await readFile(file,'utf8'));budget.active=false;await writeBudget(file,budget);store.close();}
