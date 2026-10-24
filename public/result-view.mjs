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
