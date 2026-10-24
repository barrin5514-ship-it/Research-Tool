import {gatherEvidence} from './fact-check.mjs';

export function rankRecommendations(items){
 return items.map(item=>{
  const usefulness=['high','medium','low'].includes(item.usefulness)?item.usefulness:'unknown';
  const cost=['free','low','high'].includes(item.costLevel)?item.costLevel:'unknown';
  const risk=['low','medium','high'].includes(item.riskLevel)?item.riskLevel:'unknown';
  const score=({high:6,medium:4,low:2,unknown:0}[usefulness])+({free:2,low:1,high:-2,unknown:-1}[cost])+({low:2,medium:0,high:-3,unknown:-2}[risk]);
  return {...item,score,rankingBasis:{usefulness,cost,risk},priority:score>=7?'high':score>=3?'medium':'low'};
 }).sort((a,b)=>b.score-a.score);
}

export function createEvidenceResearch({retrieve=gatherEvidence}={}){
 return async({job,transcript,ocr=[],signal})=>{
  const text=[transcript,...ocr.map(x=>x.text)].filter(x=>typeof x==='string').join('\n').slice(0,40000);
  if(!text.trim())throw Error('No transcript or OCR evidence available for research');
  const sentences=text.split(/(?<=[.!?])\s+|\n+/).filter(x=>/\b(?:python|sqlite|node(?:\.js)?|ffmpeg)\b/i.test(x)).slice(0,10);
  const claims=await retrieve(sentences.map(claim=>({claim,status:'NOT VERIFIED',sources:[]})),{signal});
  const projects=new Set();
  if(/\b(?:trading|paper.trad|risk management|backtest)\b/i.test(text))projects.add('Pennywise');
  if(/\b(?:influencer|character consistency|content production|image generation)\b/i.test(text))projects.add('Personafy');
  if(/\b(?:AI coding agents?|coding agents?|multi.agent workflows?|code review|prompting|developer tools|Codex|Claude)\b/i.test(text))projects.add('Dev Squad AI');
  let simsApplication;
  if(/\b(?:The Sims 4|Sims 4|TS4)\b/i.test(text)&&/\b(?:mods?|scripting|custom content|AI tools|graphics|automation|gameplay|upgrades?)\b/i.test(text))simsApplication='Evaluate the described Sims 4 improvement in an isolated test, checking game-version compatibility and backing up saves before any owner-approved change.';
  else if(/\b(?:Blender|mesh editing|texture creation|3D modeling|custom content|ReShade)\b/i.test(text))simsApplication='Investigate whether the described asset or graphics workflow can create compatible Sims 4 custom content or improve visuals; verify export formats, licensing and performance first.';
  else if(/\b(?:Python scripts?|batch renaming|asset organization|save backups?)\b/i.test(text))simsApplication='Investigate an offline Sims 4 mod/custom-content organization or save-backup workflow using the described scripting idea, with dry runs and no automatic game-file changes.';
  if(simsApplication)projects.add('Sims 4 Upgrades');
  const recommendations=rankRecommendations([...projects].map(project=>({project,application:project==='Sims 4 Upgrades'?simsApplication:`Review the extracted idea against ${project}'s existing architecture before proposing changes.`,difficulty:'Not assessed',estimatedCost:'Not assessed',risks:'Source accuracy and implementation risk require review.',worthInvestigating:'Tentative content/keyword match only; relevance has not been established.',usefulness:'unknown',costLevel:'unknown',riskLevel:'unknown'})));
  return {title:job.title,transcript:transcript||null,summary:'Extracted source excerpt (unverified): '+text.slice(0,1800),visualFindings:[],claims,recommendations,verification:'NOT VERIFIED',researchStatus:'requires_verification',provenance:{provider:'local-evidence-rules',generatedAt:new Date().toISOString(),sourceUrl:job.url,independentVerification:false},limitations:['No generative model was used.','Collection/keyword matches are tentative.','Documentation links are background evidence, not proof of the source claims.']};
 };
}
