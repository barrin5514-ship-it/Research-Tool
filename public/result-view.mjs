import {normalizeAnswers,ANSWER_KEYS} from './answer-format.mjs';
export function shortSummary(video){
 const text=video.result?.summary?.replace(/\s+/g,' ').trim();
 if(!text)return video.status==='pending'?'Imported only. This post has not been processed.':'No research summary is available yet.';
 if(text.length<=260)return text;
 const cut=text.slice(0,257);return cut.slice(0,cut.lastIndexOf(' ')>180?cut.lastIndexOf(' '):257)+'…';
}
export function collectNewIdeas(videos){
 const projects=new Set(['Pennywise','Personafy','Tech','Dev Squad AI','Sims 4 Upgrades']);
 return videos.flatMap(video=>(video.result?.recommendations||[]).filter(r=>!projects.has(r.project)&&r.application?.trim()).map(recommendation=>({video,recommendation})));
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
