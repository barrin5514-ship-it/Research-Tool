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
  const projects=new Set((job.collections||[]).filter(x=>['Pennywise','Personafy'].includes(x)));
  if(/\b(?:trading|paper.trad|risk management|backtest)\b/i.test(text))projects.add('Pennywise');
  if(/\b(?:influencer|character consistency|content production|image generation)\b/i.test(text))projects.add('Personafy');
  const recommendations=rankRecommendations([...projects].map(project=>({project,application:`Review the extracted idea against ${project}'s existing architecture before proposing changes.`,difficulty:'Not assessed',estimatedCost:'Not assessed',risks:'Source accuracy and implementation risk require review.',worthInvestigating:'Tentative collection/keyword match only; relevance has not been established.',usefulness:'unknown',costLevel:'unknown',riskLevel:'unknown'})));
  return {title:job.title,transcript:transcript||null,summary:'Extracted source excerpt (unverified): '+text.slice(0,1800),visualFindings:[],claims,recommendations,verification:'NOT VERIFIED',researchStatus:'requires_verification',provenance:{provider:'local-evidence-rules',generatedAt:new Date().toISOString(),sourceUrl:job.url,independentVerification:false},limitations:['No generative model was used.','Collection/keyword matches are tentative.','Documentation links are background evidence, not proof of the source claims.']};
 };
}
