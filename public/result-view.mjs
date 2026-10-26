import {normalizeAnswers,ANSWER_KEYS} from './answer-format.mjs';
export const collectionKey=name=>String(name).trim().toLowerCase();
export function combinationSources(videos,project,excluded=[]){return dashboardVideos(videos).filter(v=>!collectionExcluded(v,excluded)&&!visualReference(v)&&v.status!=='running'&&v.result?.summary?.trim()&&(v.result.provenance?.provider==='deepseek'||(v.result.provenance?.provider==='local'&&v.result.extraction?.visionStatus==='analyzed'))).flatMap(v=>{const recommendations=(v.result.recommendations||[]).filter(r=>r.application?.trim()&&recommendationProject(r,[project]));return recommendations.length?[{videoId:v.id,summary:shortSummary(v),recommendations:recommendations.map(r=>({application:r.application,difficulty:r.difficulty||'',estimatedCost:r.estimatedCost||'',risks:r.risks||''}))}]:[];});}
export function collectionExcluded(video,excluded=[]){return !video.researchOverride&&(video.collections||[]).some(name=>excluded.some(item=>collectionKey(item)===collectionKey(name)));}
export function visualReference(video){return !video.researchOverride&&video.result?.skipReason==='visual_reference';}
export function researchCounts(videos,excluded){const counts=demoCounts(videos,excluded);return {excluded:counts.excluded,remaining:counts.left};}
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
 return {balance:Number.isFinite(amount)?'$'+amount.toFixed(2):'Not checked',updated:date&&!Number.isNaN(date.getTime())?'Updated '+new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/New_York'}).format(date):'Not checked yet',balanceExtra:(balance?.balances||[]).filter(b=>b.currency!=='USD').map(b=>b.currency+' '+b.total).join(' · ')||'No other currency balance is available.',spent:typeof cost==='number'&&Number.isFinite(cost)?'$'+cost.toFixed(3):'Not available',tiny:typeof cost==='number'&&cost>0&&cost<0.01,count:(spending?.videoAnalyses??spending?.calls??0)+' videos analyzed',extra:((spending?.inputTokens||0)+(spending?.outputTokens||0))+' tokens. Includes test calls, repeat analyses and combined plans. Spending is an estimate, not your bill.'+(spending?.unknownUsage?' Some costs are not available.':'')};
}

export function libraryView(videos,excluded=[]){const visible=videos.filter(v=>!collectionExcluded(v,excluded)&&!visualReference(v)&&v.status!=='skipped');const names=[...new Set(['All','Pennywise','Personafy','Tech','Unassigned',...visible.flatMap(v=>v.collections)])].filter(name=>name==='All'||!excluded.some(item=>collectionKey(item)===collectionKey(name)));return {videos:visible,names};}

export const DEMO_DESCRIPTIONS={Pennywise:'My stock trading bot. Matches anything about trading, stocks, markets, strategies or forecasting.',Personafy:'My AI influencer studio. Matches AI influencers, AI image and video generation, motion, AI voice, captions and copywriting, and video download or capture tools like Cobalt.','Dev Squad AI':'My AI coding agent. Matches AI coding tools, agent workflows, prompting, code review and automation.','Sims 4 Upgrades':'Upgrading The Sims 4. Matches mods, scripting, custom content, graphics, gameplay changes and AI tools for the game.',Tech: "General tech ideas that don't fit another project yet."};
export function hasDeepSeekResult(video){return video?.result?.provenance?.provider==='deepseek'&&!video.result?.skipReason&&Boolean(video.result?.summary||video.result?.recipe);}
export function videoStatus(video){if(video.result?.skipReason==='insufficient_content')return 'Skipped: not enough content to analyze';if(video.status==='failed')return 'Failed';if(video.status==='running')return 'Working on it';if(visualReference(video)||video.status==='skipped')return 'Excluded';if(hasDeepSeekResult(video))return 'Summary ready · claims not checked';if(video.status==='needs_analysis'||video.result?.extraction?.audioExtracted||video.result?.transcript)return 'Ready for analysis';return 'Not started';}
export function demoCounts(videos,excluded=[]){const all=dashboardVideos(videos),isExcluded=v=>collectionExcluded(v,excluded)||visualReference(v)||v.status==='skipped';return {discovered:all.length,excluded:all.filter(isExcluded).length,left:all.filter(v=>!isExcluded(v)&&!hasDeepSeekResult(v)&&v.status!=='failed').length,summary:all.filter(hasDeepSeekResult).length,failed:all.filter(v=>!isExcluded(v)&&v.status==='failed').length};}
export function failedReason(video){const code=String(video.error||'').toUpperCase();if(code==='ANALYSIS_FAILED')return video.result?.analysisFailure||'Analysis failed. Saved text is available; check the provider before trying again.';if(/LOGIN|SIGN.*IN/.test(code))return 'Sign in to Instagram, then try this video again.';if(/DELETED|PRIVATE|UNAVAILABLE/.test(code))return 'This post may be private, removed or unavailable.';if(/LIMIT|TOO_LARGE|TOO_LONG/.test(code))return 'This video exceeded the current size or time limit.';if(/CAPTURE|COBALT|DOWNLOAD/.test(code))return 'The video could not be downloaded or captured.';if(video.status==='needs_analysis')return 'The video was read, but its summary could not be finished.';return 'This video could not be read. You can try it again.';}
export function projectIdeaBullets(text){return String(text||'').split(/(?<=[.!?])\s+|[\r\n]+/).map(x=>x.trim()).filter(Boolean).slice(0,3).map(line=>line.split(/\s+/).length>18?line.split(/\s+/).slice(0,18).join(' ')+'…':line);}

export function sameCombinationSources(a,b){const key=items=>JSON.stringify([...items].sort((x,y)=>x.videoId.localeCompare(y.videoId)));return key(a)===key(b);}
