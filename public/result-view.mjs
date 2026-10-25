import {normalizeAnswers,ANSWER_KEYS} from './answer-format.mjs';
export const collectionKey=name=>String(name).trim().toLowerCase();
export function collectionExcluded(video,excluded=[]){return !video.researchOverride&&(video.collections||[]).some(name=>excluded.some(item=>collectionKey(item)===collectionKey(name)));}
export function visualReference(video){return !video.researchOverride&&video.result?.skipReason==='visual_reference';}
export function researchCounts(videos,excluded){const visible=dashboardVideos(videos);return {excluded:visible.filter(v=>collectionExcluded(v,excluded)).length,remaining:visible.filter(v=>!collectionExcluded(v,excluded)&&!visualReference(v)&&(['pending','retry_wait','failed'].includes(v.status)||(v.status==='needs_analysis'&&!v.result?.answers))).length};}
export function shortSummary(video){
 const text=video.result?.summary?.replace(/\s+/g,' ').trim();
 if(!text)return video.status==='pending'?'Imported only. This post has not been processed.':'No research summary is available yet.';
 if(text.length<=260)return text;
 const cut=text.slice(0,257);return cut.slice(0,cut.lastIndexOf(' ')>180?cut.lastIndexOf(' '):257)+'…';
}
export function recommendationProject(recommendation,projects){return projects.find(p=>recommendation.projectId?p.id===recommendation.projectId:p.name===recommendation.project||p.aliases?.includes(recommendation.project));}
export function collectNewIdeas(videos,projectList){
 const projects=new Set(['Pennywise','Personafy','Tech','Dev Squad AI','Sims 4 Upgrades']);
 return videos.flatMap(video=>(video.result?.recommendations||[]).filter(r=>(projectList?!recommendationProject(r,projectList):!projects.has(r.project))&&r.application?.trim()).map(recommendation=>({video,recommendation})));
}

export function resultAnswers(video){
 const result=video.result;
 const direct=normalizeAnswers(result?.answers);
 if(direct)return Object.fromEntries(ANSWER_KEYS.map(key=>[key,direct[key].explanation]));
 if(!result)return {what:shortSummary(video),why:'Usefulness has not been assessed yet.',next:'Process the post before deciding what to try.'};
 const recommendations=(result.recommendations||[]).filter(r=>r.application?.trim()&&!/\b(no credible|no clear|no specific|unrelated|irrelevant)\b/i.test(r.application));
 const projects=[...new Set(recommendations.map(r=>r.project).filter(Boolean))];
 const next=recommendations[0]?.application;
 return {what:shortSummary(video),why:projects.length?`The saved analysis suggests possible uses for ${projects.join(', ')}. These suggestions still need checking.`:'A useful application has not been established from the available evidence.',next:next?(next.length>420?next.slice(0,417)+'…':next):'Read the transcript and check the source before deciding whether to try anything.'};
}

export function answerSections(video){return normalizeAnswers(video.result?.answers);}

export function evidenceLabels(result){
 return [
  ['Audio transcription',result?.transcript?.trim()?'Transcript available; accuracy still needs human review.':'No transcript available.'],
  ['On-screen text',result?.ocr?.some(x=>x.text?.trim())?'OCR text available. OCR can miss or misread words.':'No on-screen text was recovered.'],
  ['Visual reasoning',result?.extraction?.visionStatus==='analyzed'&&result?.visualFindings?.length?'Visual model observations available; not independently verified.':'Not demonstrated. OCR and sampled frames are not visual reasoning.']
 ];
}

export function isTestFixture(video){return video.result?.extraction?.fixture===true||/^TEST FIXTURE:/i.test(video.title||'')||/^TEST FIXTURE:/i.test(video.result?.title||'')||/^SyntheticDeepSeek/i.test(video.id||'');}
export function dashboardVideos(videos){return videos.filter(video=>!isTestFixture(video));}

export function spendingCards(spending,balance){
 const usd=balance?.balances?.find(b=>b.currency==='USD');
 const amount=usd?Number(usd.total):NaN,cost=spending?.estimatedUSD;
 const date=balance?.checkedAt?new Date(balance.checkedAt):null;
 return {balance:Number.isFinite(amount)?'$'+amount.toFixed(2):'Not checked',updated:date&&!Number.isNaN(date.getTime())?'Updated '+new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/New_York'}).format(date):'Not checked yet',balanceExtra:(balance?.balances||[]).filter(b=>b.currency!=='USD').map(b=>b.currency+' '+b.total).join(' · ')||'No other currency balance is available.',spent:typeof cost==='number'&&Number.isFinite(cost)?'$'+cost.toFixed(3):'Not available',tiny:typeof cost==='number'&&cost>0&&cost<0.01,count:(spending?.calls||0)+' videos analyzed',extra:((spending?.inputTokens||0)+(spending?.outputTokens||0))+' tokens. Includes test calls and repeat analyses. Spending is an estimate, not your bill.'+(spending?.unknownUsage?' Some costs are not available.':'')};
}
