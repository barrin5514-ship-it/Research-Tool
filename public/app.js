let state,filter='All',busy=false;
const $=id=>document.getElementById(id);
const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
const labels={pending:'Waiting',running:'Extracting',retry_wait:'Retry scheduled',needs_analysis:'Needs research',completed:'Analyzed',skipped:'Skipped',failed:'Failed'};
function message(text){$('message').textContent=text;}
async function action(path,body={}){
  if(busy)return;busy=true;
  try{const response=await fetch(path,{method:'POST',headers:{'content-type':'application/json','x-research-token':state.csrf},body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw Error(result.error);await refresh();return result;}
  catch(e){message(e.message);throw e;}finally{busy=false;}
}
async function refresh(){const response=await fetch('/api/state');if(!response.ok)throw Error('Dashboard connection failed');state=await response.json();render();}
function render(){
  const videos=state.videos;
  const counts=[['Discovered',videos.length],['Analyzed',videos.filter(x=>x.status==='completed').length],['Remaining',videos.filter(x=>['pending','running','retry_wait'].includes(x.status)).length],['Needs research',videos.filter(x=>x.status==='needs_analysis').length],['Skipped',videos.filter(x=>x.status==='skipped').length],['Failed',videos.filter(x=>x.status==='failed').length]];
  $('stats').replaceChildren(...counts.map(([label,value])=>{const box=el('div',undefined,'stat');box.append(el('strong',String(value)),el('span',label));return box;}));
  const names=[...new Set(['All','Pennywise','Personafy','Tech','Unassigned',...videos.flatMap(x=>x.collections)])];
  const matches=(x,name)=>name==='All'||(name==='Unassigned'?x.collections.length===0:x.collections.includes(name));
  $('collections').replaceChildren(...names.map(name=>{const button=el('button',undefined,name===filter?'selected':'');button.append(el('span',name),el('span',String(videos.filter(x=>matches(x,name)).length)));button.onclick=()=>{filter=name;render();};return button;}));
  const q=state.queue;
  $('queue-state').textContent=`${q.running?'Queue running':q.active?'Paused; current videos are finishing':'Queue paused'} · ${q.active} active · concurrency ${q.concurrency} · local AI ${state.localAIEnabled?'enabled (readiness checked per video)':'off'}`;
  $('start').disabled=q.running||q.active>0;
  const selected=videos.filter(x=>matches(x,filter));
  if(!selected.length){const box=el('div',undefined,'empty');box.append(el('h3','Your research inbox is ready'),el('p','Import an export or add three links to begin. No videos have been analyzed here yet.'));$('results').replaceChildren(box);return;}
  $('results').replaceChildren(...selected.map(card));
}
function card(video){
  const box=el('article',undefined,'result'),top=el('div',undefined,'result-top'),heading=el('div');
  heading.append(el('h3',video.result?.title||video.title),el('div',(video.collections.join(' · ')||'Unassigned')+` · ${video.attempts} attempt(s)`,'meta'));
  top.append(heading,el('span',labels[video.status]||video.status,'pill'));box.append(top);
  const link=el('a','Open original Instagram video');link.href=video.url;link.target='_blank';link.rel='noopener noreferrer';box.append(link);
  if(video.error)box.append(el('p',`Processing issue: ${video.error.replaceAll('_',' ')}. Check the setup guide and retry when ready.`));
  const result=video.result;
  if(result){
    box.append(el('p',result.summary||(video.status==='skipped'?'This video was skipped.': 'Media extraction finished. Research is incomplete: a transcript, visual interpretation, and independent evidence still need to be produced.')));
    if(result.extraction?.reason)box.append(el('p',result.extraction.reason));
    for(const warning of result.extraction?.warnings||[])box.append(el('p',warning,'small'));
    const facts=el('div',undefined,'facts');
    for(const [label,value] of [['Evidence status',result.verification||'NOT VERIFIED'],['Extracted samples',`${result.extraction?.framesExtracted??0} frames · ${Math.round(result.extraction?.durationSeconds??0)} seconds`],['Transcript',result.transcript||'Not available'],['Media retention','Temporary media and frame files are removed after each attempt.']]){const fact=el('div',undefined,'fact');fact.append(el('strong',label),el('span',value));facts.append(fact);}box.append(facts);
    if(result.ocr?.length){box.append(el('h4','On-screen text (Windows OCR)'));const lines=el('ul');for(const entry of result.ocr)lines.append(el('li',entry.text||''));box.append(lines);}
    if(result.visualFindings?.length){box.append(el('h4','Visual observations'));const list=el('ul');for(const finding of result.visualFindings)list.append(el('li',typeof finding==='string'?finding:JSON.stringify(finding)));box.append(list);}
    if(result.claims?.length){box.append(el('h4','Claims to verify'));const list=el('ul');for(const claim of result.claims){const row=el('li',`${claim.claim} — ${claim.status||'NOT VERIFIED'}`);for(const source of claim.sources||[]){try{const url=new URL(source.url);if(url.protocol!=='https:')continue;const link=el('a',` · ${source.title||url.hostname}`);link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';row.append(link);}catch{}}list.append(row);}box.append(list);}
    for(const recommendation of result.recommendations||[]){const block=el('div',undefined,'recommendation');block.append(el('strong',`${recommendation.project}: ${recommendation.application}`),el('p',`Difficulty: ${recommendation.difficulty||'Not estimated'} · Cost: ${recommendation.estimatedCost||'Not estimated'}`),el('p',`Risks: ${recommendation.risks||'Not assessed'}`),el('p',`Further investigation: ${recommendation.worthInvestigating||'Not assessed'} · Priority: ${recommendation.priority||'unranked'}`));box.append(block);}
    if(result.recommendations?.length){const row=el('div',undefined,'review'),label=el('label','Recommendation decision'),select=el('select');select.setAttribute('aria-label',`Review ${video.title}`);for(const name of ['New','Under Review','Approved','Rejected','Implemented']){const option=el('option',name);option.selected=name===video.review_status;select.append(option);}select.onchange=()=>action('/api/review',{id:video.id,status:select.value}).then(()=>message('Decision saved. No project changes were made.')).catch(()=>{});row.append(label,select);box.append(row,el('p','This decision applies to this video’s recommendation set. “Implemented” is an owner record, not an action.','small'));}
  }
  if(['failed','skipped','needs_analysis'].includes(video.status)){const retry=el('button','Queue a fresh attempt','secondary');retry.onclick=()=>action('/api/retry',{id:video.id}).then(()=>message('Queued. Processing will download fresh media and remove it afterward.')).catch(()=>{});box.append(retry);}
  return box;
}
$('import').onclick=async()=>{try{const files=[...$('files').files];if(!files.length)return message('Choose saved-post or saved-collection HTML/JSON files first.');if(files.length>10||files.reduce((n,f)=>n+f.size,0)>10*1024*1024)return message('Choose at most 10 files totaling 10 MiB.');const result=await action('/api/import',{files:await Promise.all(files.map(async file=>({name:file.name,content:await file.text()})))});if(result)message(result.results.map(x=>`${x.filename}: ${x.added} new, ${x.existing} existing. ${x.warnings.join(' ')}`).join('\n'));}catch(e){message(e.message);}};
$('add-links').onclick=()=>action('/api/links',{links:$('links').value,collection:$('manual-collection').value}).then(result=>{if(result)message(`${result.added} new links added; ${result.existing} already known.`);}).catch(()=>{});
$('start').onclick=()=>action('/api/start').then(result=>{if(result)message(result.message||'Pilot batch started. Up to three videos will be attempted.');}).catch(()=>{});
$('pause').onclick=()=>action('/api/pause').then(()=>message('Queue paused. Current videos finish and clean up; no new videos start.')).catch(()=>{});
refresh().catch(e=>message(e.message));setInterval(()=>refresh().catch(()=>message('The local server is unavailable. Restart it to resume your library.')),3000);
