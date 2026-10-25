import {collectNewIdeas,answerSections,evidenceLabels} from './result-view.mjs';
let state,filter='All',busy=false,visibleLimit=25,openDetails=new Set(),openAnswers=new Set();
const $=id=>document.getElementById(id);
const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
const labels={pending:'Waiting',running:'Extracting',retry_wait:'Retry scheduled',needs_analysis:'Needs research',completed:'Analyzed',skipped:'Skipped',failed:'Failed'};
const unavailableMessage='The local server is unavailable. Restart it to resume your library.';
function message(text){$('message').textContent=text;}
async function action(path,body={}){
  if(busy)return;busy=true;
  try{const response=await fetch(path,{method:'POST',headers:{'content-type':'application/json','x-research-token':state.csrf},body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw Error(result.error);await refresh();return result;}
  catch(e){message(e.message);throw e;}finally{busy=false;}
}
async function refresh(){const response=await fetch('/api/state');if(!response.ok)throw Error('Dashboard connection failed');state=await response.json();render();if($('message').textContent===unavailableMessage)message('');}
function render(){
  openDetails=new Set([...document.querySelectorAll('.result-details[open]')].map(node=>node.dataset.videoId));
  openAnswers=new Set([...document.querySelectorAll('[data-answer-details]:not([hidden])')].map(node=>node.dataset.videoId));
  const browser=state.instagramBrowser;
  $('instagram-status').textContent=!browser?.available?'Browser capture unavailable':browser.windowOpen?'Sign-in browser is open. Close it before processing.':browser.ownerConfirmed?'Sign-in confirmed by you; access will be checked during capture.':'Instagram is not connected. Public capture will be attempted first.';
  $('instagram-connect').disabled=!browser?.available||state.queue.active>0;
  $('instagram-confirm').disabled=!browser?.available||state.queue.active>0;
  const videos=state.videos;
  const ideas=collectNewIdeas(videos);
  const knownProjects=['Pennywise','Personafy','Tech','Dev Squad AI','Sims 4 Upgrades'];
  $('project-matches').replaceChildren(...knownProjects.flatMap(project=>{
    const matches=videos.flatMap(video=>(video.result?.recommendations||[]).filter(r=>r.project===project).map(recommendation=>({video,recommendation})));
    if(!matches.length)return [];
    const group=el('div',undefined,'panel project-group');group.append(el('h3',project));
    for(const {video,recommendation} of matches){const idea=el('div',undefined,'idea');idea.append(el('p',recommendation.application),el('p',`Priority: ${recommendation.priority||'unranked'} · NOT VERIFIED`,'small'));const source=el('a','Read the research result');source.href='#research-results';idea.append(source);group.append(idea);}return [group];
  }));
  $('new-ideas').replaceChildren(...(ideas.length?ideas.map(({video,recommendation})=>{const item=el('article',undefined,'idea');item.append(el('h3',video.result?.title||video.title),el('p',recommendation.application));const link=el('a','Original Instagram post');link.href=video.url;link.target='_blank';link.rel='noopener noreferrer';item.append(link,el('p','NOT VERIFIED · Recommendation only','small'));return item;}):[el('p','No unmatched ideas have been identified yet. Imported posts will stay unprocessed until you start a batch.','small')]));
  $('api-usage').replaceChildren(...(state.deepseekUsage||[]).map(call=>el('p',`DeepSeek ${call.videoId||'call'}: ${call.usage?`${call.usage.inputTokens} input + ${call.usage.outputTokens} output tokens · estimated $${call.usage.estimatedUSD.toFixed(6)} USD`:'usage/cost unavailable'} · ${call.at}`)));
  const counts=[['Discovered',videos.length],['Analyzed',videos.filter(x=>x.status==='completed').length],['Remaining',videos.filter(x=>['pending','running','retry_wait'].includes(x.status)).length],['Needs research',videos.filter(x=>x.status==='needs_analysis').length],['Skipped',videos.filter(x=>x.status==='skipped').length],['Failed',videos.filter(x=>x.status==='failed').length]];
  $('stats').replaceChildren(...counts.map(([label,value])=>{const box=el('div',undefined,'stat');box.append(el('strong',String(value)),el('span',label));return box;}));
  const names=[...new Set(['All','Pennywise','Personafy','Tech','Unassigned',...videos.flatMap(x=>x.collections)])];
  const matches=(x,name)=>name==='All'||(name==='Unassigned'?x.collections.length===0:x.collections.includes(name));
  $('collections').replaceChildren(...names.map(name=>{const button=el('button',undefined,name===filter?'selected':'');button.append(el('span',name),el('span',String(videos.filter(x=>matches(x,name)).length)));button.onclick=()=>{filter=name;render();};return button;}));
  const q=state.queue;
  $('queue-state').textContent=`${q.running?'Queue running':q.active?'Paused; current videos are finishing':'Queue paused'} · ${q.active} active · concurrency ${q.concurrency} · local AI ${state.localAIEnabled?'enabled (readiness checked per video)':'off'}`;
  $('start').disabled=q.running||q.active>0;
  const selected=videos.filter(x=>matches(x,filter)).sort((a,b)=>Boolean(b.result)-Boolean(a.result));
  $('library-items').replaceChildren(...selected.slice(0,visibleLimit).map(video=>{const row=el('article',undefined,'library-row');const title=video.result?.title||video.title;row.append(el('strong',title.length>130?title.slice(0,127)+'…':title),el('span',labels[video.status]||video.status,'pill'));const link=el('a','Original post');link.href=video.url;link.target='_blank';link.rel='noopener noreferrer';row.append(link);return row;}));
  if(!selected.length)$('library-items').append(el('p','No posts in this collection.'));
  if(selected.length>visibleLimit){const more=el('button',`Show 25 more (${selected.length-visibleLimit} remaining)`,'secondary');more.onclick=()=>{visibleLimit+=25;render();};$('library-items').append(more);}
  const researched=selected.filter(x=>x.result||['failed','skipped'].includes(x.status));
  $('results').replaceChildren(...researched.slice(0,visibleLimit).map(card));
  if(!researched.length)$('results').append(el('div','No research results in this collection yet. Imported posts have not been analyzed.','empty'));
  if(researched.length>visibleLimit){const more=el('button','Show more results','secondary');more.onclick=()=>{visibleLimit+=25;render();};$('results').append(more);}
}
function card(video){
  const box=el('article',undefined,'result'),top=el('div',undefined,'result-top'),heading=el('div');
  const title=video.result?.title||video.title;
  heading.append(el('h3',title.length>180?title.slice(0,177)+'…':title),el('div',(video.collections.join(' · ')||'Unassigned')+` · ${video.attempts} attempt(s)`,'meta'));
  top.append(heading,el('span',labels[video.status]||video.status,'pill'));box.append(top);
  const answers=answerSections(video),answerBox=el('div',undefined,'answer-grid'),expanded=openAnswers.has(video.id),explanations=[];
  for(const [key,question] of [['what','What is this?'],['why','Why is it useful?'],['next','What can I do with it?']]){
    const item=el('div'),list=el('ul');for(const bullet of answers[key].bullets)list.append(el('li',bullet));
    const explanation=el('p',answers[key].explanation);explanation.id=`answer-${video.id}-${key}`;explanation.dataset.answerDetails='true';explanation.dataset.videoId=video.id;explanation.hidden=!expanded;
    item.append(el('h4',question),list,explanation);answerBox.append(item);explanations.push(explanation);
  }
  const more=el('button',expanded?'Give me less':'Give me more','secondary');more.setAttribute('aria-expanded',String(expanded));more.setAttribute('aria-controls',explanations.map(node=>node.id).join(' '));
  more.onclick=()=>{const show=more.getAttribute('aria-expanded')!=='true';more.setAttribute('aria-expanded',String(show));more.textContent=show?'Give me less':'Give me more';for(const explanation of explanations)explanation.hidden=!show;};
  box.append(answerBox,more);
  const link=el('a','Open original Instagram video');link.href=video.url;link.target='_blank';link.rel='noopener noreferrer';box.append(link);
  if(video.error)box.append(el('p',`Processing issue: ${video.error.replaceAll('_',' ')}. Check the setup guide and retry when ready.`));
  const result=video.result;
  if(result){
    const details=el('details',undefined,'result-details'),content=el('div');details.dataset.videoId=video.id;details.open=openDetails.has(video.id);details.append(el('summary','Show more — transcript, evidence and recommendations'),content);box.append(details);
    for(const [label,value] of evidenceLabels(result))content.append(el('p',`${label}: ${value}`,'small'));
    content.append(el('p',result.summary||(video.status==='skipped'?'This video was skipped.': 'Media extraction finished. Research is incomplete: a transcript, visual interpretation, and independent evidence still need to be produced.')));
    if(result.extraction?.reason)content.append(el('p',result.extraction.reason));
    for(const warning of result.extraction?.warnings||[])content.append(el('p',warning,'small'));
    const facts=el('div',undefined,'facts');
    for(const [label,value] of [['Evidence status',result.verification||'NOT VERIFIED'],['Extracted samples',`${result.extraction?.framesExtracted??0} frames · ${Math.round(result.extraction?.durationSeconds??0)} seconds`],['Transcript',result.transcript||'Not available'],['Media retention','Temporary media and frame files are removed after each attempt.']]){const fact=el('div',undefined,'fact');fact.append(el('strong',label),el('span',value));facts.append(fact);}content.append(facts);
    if(result.ocr?.length){content.append(el('h4','On-screen text (Windows OCR)'));const lines=el('ul');for(const entry of result.ocr)lines.append(el('li',entry.text||''));content.append(lines);}
    if(result.visualFindings?.length){content.append(el('h4','Visual observations'));const list=el('ul');for(const finding of result.visualFindings)list.append(el('li',typeof finding==='string'?finding:JSON.stringify(finding)));content.append(list);}
    if(result.claims?.length){content.append(el('h4','Claims to verify'));const list=el('ul');for(const claim of result.claims){const row=el('li',`${claim.claim} — ${claim.status||'NOT VERIFIED'}`);for(const source of claim.sources||[]){try{const url=new URL(source.url);if(url.protocol!=='https:')continue;const link=el('a',` · ${source.title||url.hostname}`);link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';row.append(link);}catch{}}list.append(row);}content.append(list);}
    for(const recommendation of result.recommendations||[]){const block=el('div',undefined,'recommendation');block.append(el('strong',`${recommendation.project}: ${recommendation.application}`),el('p',`Difficulty: ${recommendation.difficulty||'Not estimated'} · Cost: ${recommendation.estimatedCost||'Not estimated'}`),el('p',`Risks: ${recommendation.risks||'Not assessed'}`),el('p',`Further investigation: ${recommendation.worthInvestigating||'Not assessed'} · Priority: ${recommendation.priority||'unranked'}`));content.append(block);}
    if(result.recommendations?.length){const row=el('div',undefined,'review'),label=el('label','Recommendation decision'),select=el('select');select.setAttribute('aria-label',`Review ${video.title}`);for(const name of ['New','Under Review','Approved','Rejected','Implemented']){const option=el('option',name);option.selected=name===video.review_status;select.append(option);}select.onchange=()=>action('/api/review',{id:video.id,status:select.value}).then(()=>message('Decision saved. No project changes were made.')).catch(()=>{});row.append(label,select);content.append(row,el('p','This decision applies to this video’s recommendation set. “Implemented” is an owner record, not an action.','small'));}
  }
  if(['failed','skipped','needs_analysis'].includes(video.status)){const retry=el('button','Queue a fresh attempt','secondary');retry.onclick=()=>action('/api/retry',{id:video.id}).then(()=>message('Queued. Processing will download fresh media and remove it afterward.')).catch(()=>{});box.append(retry);}
  return box;
}
$('import').onclick=async()=>{try{const files=[...$('files').files];if(!files.length)return message('Choose saved-post or saved-collection HTML/JSON files first.');if(files.length>10||files.reduce((n,f)=>n+f.size,0)>10*1024*1024)return message('Choose at most 10 files totaling 10 MiB.');const result=await action('/api/import',{files:await Promise.all(files.map(async file=>({name:file.name,content:await file.text()})))});if(result)message(result.results.map(x=>`${x.filename}: ${x.added} new, ${x.existing} existing. ${x.warnings.join(' ')}`).join('\n'));}catch(e){message(e.message);}};
$('add-links').onclick=()=>action('/api/links',{links:$('links').value,collection:$('manual-collection').value}).then(result=>{if(result)message(`${result.added} new links added; ${result.existing} already known.`);}).catch(()=>{});
$('start').onclick=()=>action('/api/start').then(result=>{if(result)message(result.message||'Pilot batch started. Up to three videos will be attempted.');}).catch(()=>{});
$('pause').onclick=()=>action('/api/pause').then(()=>message('Queue paused. Current videos finish and clean up; no new videos start.')).catch(()=>{});
$('instagram-connect').onclick=()=>action('/api/instagram/connect').then(r=>{if(r)message(r.message);}).catch(()=>{});
$('instagram-confirm').onclick=()=>action('/api/instagram/confirm').then(r=>{if(r)message(r.message);}).catch(()=>{});
refresh().catch(e=>message(e.message));setInterval(()=>refresh().catch(()=>message(unavailableMessage)),3000);
