import {collectNewIdeas,answerSections,evidenceLabels,dashboardVideos,isTestFixture,spendingCards,recommendationProject,collectionExcluded,collectionKey,visualReference,researchCounts,libraryView,combinationSources,hasDeepSeekResult,videoStatus,demoCounts,failedReason,projectIdeaBullets,shortSummary} from './result-view.mjs';
let resultFilter='all';
let state,filter='All',busy=false,visibleLimit=25,skippedLimit=10,openDetails=new Set(),openAnswers=new Set(),openCombined=new Set();
const $=id=>document.getElementById(id);
const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
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
  openCombined=new Set([...document.querySelectorAll('[data-combined-detail][open]')].map(node=>node.dataset.combinedDetail));
  const browser=state.instagramBrowser;
  $('instagram-status').textContent=!browser?.available?'Browser capture unavailable':browser.windowOpen?'Sign-in browser is open. Close it before processing.':browser.ownerConfirmed?'Sign-in confirmed by you; access will be checked during capture.':'Instagram is not connected. Public capture will be attempted first.';
  $('instagram-connect').disabled=!browser?.available||state.queue.active>0;
  $('instagram-confirm').disabled=!browser?.available||state.queue.active>0;
  const videos=dashboardVideos(state.videos),excluded=state.excludedCollections||[];
  renderExclusions(videos,excluded);renderSkipped(videos,excluded);
  const ideaVideos=videos.filter(v=>!collectionExcluded(v,excluded)&&!visualReference(v)&&v.status!=='skipped');
  const projects=state.projects||[];renderProjects(projects,ideaVideos);
  const ideas=collectNewIdeas(ideaVideos,projects);
  $('new-ideas').replaceChildren(...(ideas.length?ideas.map(({video,recommendation})=>{const item=el('article',undefined,'idea');item.append(el('h3',video.result?.title||video.title),el('p',recommendation.application));const link=el('a','Original Instagram post');link.href=video.url;link.target='_blank';link.rel='noopener noreferrer';item.append(link,el('p','NOT VERIFIED · Recommendation only','small'));return item;}):[el('p','No unmatched ideas have been identified yet. Imported posts will stay unprocessed until you start a batch.','small')]));
  $('api-usage').replaceChildren(...(state.deepseekUsage||[]).filter(call=>!state.videos.some(video=>video.id===call.videoId&&isTestFixture(video))).map(call=>el('p',`DeepSeek ${call.videoId||'call'}: ${call.usage?`${call.usage.inputTokens} input + ${call.usage.outputTokens} output tokens · estimated $${call.usage.estimatedUSD.toFixed(6)} USD`:'usage/cost unavailable'} · ${call.at}`)));
  const totals=demoCounts(state.videos,excluded);$('exclusion-totals').textContent=`${totals.excluded} posts excluded · ${totals.left} left to do`;
  const counts=[['Discovered',totals.discovered,'All saved posts in your library.'],['Excluded',totals.excluded,'Collections and visual references set aside.'],['Left to do',totals.left,'Not started or waiting for a summary.'],['Summary ready',totals.summary,'DeepSeek notes saved; claims not checked.'],['Failed',totals.failed,'Posts that could not be read.']];
  $('stats').replaceChildren(...counts.map(([label,value,explanation])=>{const box=el('div',undefined,'stat');box.append(el('strong',String(value)),el('span',label),el('p',explanation,'count-explanation'));return box;}));
  const library=libraryView(videos,excluded),names=library.names,toDoVideos=library.videos.filter(v=>!hasDeepSeekResult(v)||['pending','retry_wait','running'].includes(v.status));if(!names.includes(filter))filter='All';
  const matches=(x,name)=>name==='All'||(name==='Unassigned'?x.collections.length===0:x.collections.includes(name));
  $('collections').replaceChildren(...names.map(name=>{const button=el('button',undefined,name===filter?'selected':'');button.append(el('span',name),el('span',String(toDoVideos.filter(x=>matches(x,name)).length)));button.onclick=()=>{filter=name;render();};return button;}));
  const q=state.queue;
  const collectionPicker=$('batch-collection'),chosen=collectionPicker.value;const batchNames=names.filter(name=>!excluded.some(item=>collectionKey(item)===collectionKey(name)));collectionPicker.replaceChildren(...batchNames.map(name=>{const option=el('option',name);option.value=name;return option;}));collectionPicker.value=batchNames.includes(chosen)?chosen:'All';
  const batch=state.batch,posts=batch?.posts||[],batchIds=new Set(posts.map(p=>p.id));const batchState=q.running?'Working':q.active?'Finishing current post':'Ready';
  const costText=batch?.unknownUsage?'cost not known yet':batch?.costUSD>0&&batch.costUSD<0.001?'less than $0.001':'about $'+(batch?.costUSD||0).toFixed(3);

  const progress=`${batchState} · ${batch?.done??q.done??0} of ${batch?.total??q.batchSize??0} done · ${costText}`;
  $('batch-progress').textContent=progress+(q.running?' · about '+Math.max(1,Math.ceil(q.estimatedSecondsLeft/60))+' min left':'');
  $('batch-posts').replaceChildren(...posts.map(post=>{const row=el('li',undefined,'batch-post '+post.label.toLowerCase().replaceAll(' ','-'));row.append(el('strong',post.title.length>140?post.title.slice(0,137)+'…':post.title),el('span',post.collections.join(' · ')||'No collection','small'),el('span',post.label,'pill'));if(post.reason)row.append(el('p',post.reason,'small'));return row;}));
  if(!posts.length)$('batch-posts').append(el('li','Choose a collection and start a batch to see its posts.','small'));
  $('pause').disabled=!q.running&&!q.active&&!state.rechecks?.running;
  const money=spendingCards(state.spending,state.balance);
  $('spending-tracker').textContent=money.spent;$('spending-tiny').hidden=!money.tiny;
  $('spending-count').textContent=totals.summary+' videos with saved summaries';$('spending-extra').textContent=(state.spending?.calls||0)+' recorded calls. '+money.extra;
  $('deepseek-balance').textContent=money.balance;$('balance-updated').textContent=money.updated;$('balance-extra').textContent=money.balanceExtra;

  for(const id of ['batch-size','batch-collection'])$(id).disabled=q.running||q.active>0;
  $('queue-state').textContent=q.stopReason||'One post at a time. Finished summaries appear below automatically.';
  $('start').disabled=q.running||q.active>0||state.rechecks?.running||state.combining?.running;
  $('combine-status').textContent=state.combining?.running?'Combining saved ideas for '+state.combining.project+'…':state.combining?.error||'';
  $('recheck-status').textContent=state.rechecks?.running?`Re-checking ${state.rechecks.project}: ${state.rechecks.done} of ${state.rechecks.total} done · estimated spend USD ${state.rechecks.costUSD.toFixed(6)}`:state.rechecks?.error||'';
  const selected=toDoVideos.filter(x=>matches(x,filter)).sort((a,b)=>Boolean(b.result)-Boolean(a.result));
  $('library-items').replaceChildren(...selected.slice(0,visibleLimit).map(video=>{const row=el('article',undefined,'library-row'+(batchIds.has(video.id)?' batch-picked':''));const title=video.result?.title||video.title;row.append(el('strong',title.length>130?title.slice(0,127)+'…':title),el('span',videoStatus(video),'pill'));const link=el('a','Original post');link.href=video.url;link.target='_blank';link.rel='noopener noreferrer';row.append(link);if(video.status==='failed'){row.append(el('p',failedReason(video),'small'));const retry=el('button','Try again','secondary');retry.onclick=()=>action('/api/retry',{id:video.id}).catch(()=>{});row.append(retry);}if(collectionExcluded(video,excluded))row.append(el('span','Excluded collection','pill'));if(visualReference(video))row.append(el('span','Skipped: visual reference','pill'));if(video.septemberOnly)row.append(el('span','September export only','pill'));return row;}));
  if(!selected.length)$('library-items').append(el('p','No posts left to do in this collection. Finished notes are in Research results.'));
  if(selected.length>visibleLimit){const more=el('button',`Show 25 more (${selected.length-visibleLimit} remaining)`,'secondary');more.onclick=()=>{visibleLimit+=25;render();};$('library-items').append(more);}
  const researched=library.videos.filter(x=>(hasDeepSeekResult(x)||x.result||x.status==='failed')&&(resultFilter!=='just-finished'||batchIds.has(x.id))).sort((a,b)=>b.updated_at-a.updated_at);
  $('results').replaceChildren(...researched.slice(0,visibleLimit).map(card));
  if(!researched.length)$('results').append(el('div',resultFilter==='just-finished'?'No results from the latest batch yet.':'No research results yet.','empty'));
  if(researched.length>visibleLimit){const more=el('button','Show more results','secondary');more.onclick=()=>{visibleLimit+=25;render();};$('results').append(more);}
}
function card(video){
  const box=el('article',undefined,'result'),top=el('div',undefined,'result-top'),heading=el('div');
  const title=video.result?.title||video.title;
  heading.append(el('h3',title.length>180?title.slice(0,177)+'…':title),el('div',(video.collections.join(' · ')||'Unassigned')+` · ${video.attempts} attempt(s)`+(video.result?.provenance?.provider==='deepseek'?' · DeepSeek':''),'meta'));
  top.append(heading,el('span',videoStatus(video),'pill'));box.append(top);
  if(video.septemberOnly)box.append(el('p','September export only','pill'));
  const answers=answerSections(video);
  if(video.result?.recipe){const recipe=video.result.recipe;const recipeBox=el('div',undefined,'recipe-card');recipeBox.append(el('h4','Ingredients'));const ingredients=el('ul');recipe.ingredients.forEach(line=>ingredients.append(el('li',line)));recipeBox.append(ingredients);if(!recipe.ingredients.length)recipeBox.append(el('p','Ingredients not given.'));recipeBox.append(el('h4','Instructions'));const steps=el('ol');recipe.instructions.forEach(line=>steps.append(el('li',line)));recipeBox.append(steps);if(!recipe.instructions.length)recipeBox.append(el('p','Steps not shown.'));if(!recipe.fullRecipeShown)recipeBox.append(el('p','Full recipe not shown in the video','notice'));box.append(recipeBox);
  }else if(answers){
  const answerBox=el('div',undefined,'answer-grid'),expanded=openAnswers.has(video.id),explanations=[];
  for(const [key,question] of [['what','What is this?'],['why','Why is it useful?'],['next','What can I do with it?']]){
    const item=el('div'),list=el('ul');for(const bullet of answers[key].bullets)list.append(el('li',bullet));
    const explanation=el('p',answers[key].explanation);explanation.id=`answer-${video.id}-${key}`;explanation.dataset.answerDetails='true';explanation.dataset.videoId=video.id;explanation.hidden=!expanded;
    item.append(el('h4',question),list,explanation);answerBox.append(item);explanations.push(explanation);
  }
  const more=el('button',expanded?'Give me less':'Give me more','secondary');more.setAttribute('aria-expanded',String(expanded));more.setAttribute('aria-controls',explanations.map(node=>node.id).join(' '));
  more.onclick=()=>{const show=more.getAttribute('aria-expanded')!=='true';more.setAttribute('aria-expanded',String(show));more.textContent=show?'Give me less':'Give me more';for(const explanation of explanations)explanation.hidden=!show;};
  box.append(answerBox,more);
  }else if(hasDeepSeekResult(video)){box.append(el('p',shortSummary(video),'result-summary'));}else{box.append(el('p',videoStatus(video)));if(video.status==='needs_analysis')box.append(el('p','Saved text is ready; a DeepSeek summary is still needed.','small'));}
  if(video.result?.validationWarnings?.length)box.append(el('p','Summary saved. Some answers need formatting; open Show more for the original response.','small'));
  const link=el('a','Open original Instagram video');link.href=video.url;link.target='_blank';link.rel='noopener noreferrer';box.append(link);
  if(video.status==='failed')box.append(el('p',failedReason(video),'failure-reason'));
  if(hasDeepSeekResult(video)){const check=el('button','Check claims (coming soon)','secondary claim-check');check.disabled=true;box.append(check);}
  const result=video.result;
  if(result){
    const details=el('details',undefined,'result-details'),content=el('div');details.dataset.videoId=video.id;details.open=openDetails.has(video.id);details.append(el('summary','Show more — transcript, evidence and recommendations'),content);box.append(details);
    for(const [label,value] of evidenceLabels(result))content.append(el('p',`${label}: ${value}`,'small'));
    content.append(el('p',result.summary||(video.status==='skipped'?'This video was skipped.': 'Media extraction finished. Research is incomplete: a transcript, visual interpretation, and independent evidence still need to be produced.')));
    if(result.savedAnswerDetails){content.append(el('h4','Saved answers (original format)'));for(const [key,label] of [['what','What is this?'],['why','Why is it useful?'],['next','What can I do with it?']]){const answer=result.savedAnswerDetails[key];if(!answer)continue;content.append(el('h5',label));if(Array.isArray(answer.bullets)){const list=el('ul');for(const bullet of answer.bullets)if(typeof bullet==='string')list.append(el('li',bullet));content.append(list);}if(typeof answer.explanation==='string')content.append(el('p',answer.explanation));}}
    if(result.analysisFailure)content.append(el('p',result.analysisFailure));
    if(result.extraction?.reason)content.append(el('p',result.extraction.reason));
    for(const warning of [...(result.extraction?.warnings||[]),...(result.validationWarnings||[])])content.append(el('p',warning,'small'));
    const facts=el('div',undefined,'facts');
    for(const [label,value] of [['Evidence status',result.verification||'NOT VERIFIED'],['Extracted samples',`${result.extraction?.framesExtracted??0} frames · ${Math.round(result.extraction?.durationSeconds??0)} seconds`],['Transcript',result.transcript||'Not available'],['Media retention','Temporary media and frame files are removed after each attempt.']]){const fact=el('div',undefined,'fact');fact.append(el('strong',label),el('span',value));facts.append(fact);}content.append(facts);
    if(result.ocr?.length){content.append(el('h4','On-screen text (Windows OCR)'));const lines=el('ul');for(const entry of result.ocr)lines.append(el('li',entry.text||''));content.append(lines);}
    if(result.visualFindings?.length){content.append(el('h4','Visual observations'));const list=el('ul');for(const finding of result.visualFindings)list.append(el('li',typeof finding==='string'?finding:JSON.stringify(finding)));content.append(list);}
    if(result.claims?.length){content.append(el('h4','Claims to verify'));const list=el('ul');for(const claim of result.claims){const row=el('li',`${claim.claim} — ${claim.status||'NOT VERIFIED'}`);for(const source of claim.sources||[]){try{const url=new URL(source.url);if(url.protocol!=='https:')continue;const link=el('a',` · ${source.title||url.hostname}`);link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';row.append(link);}catch{}}list.append(row);}content.append(list);}
    for(const recommendation of result.recommendations||[]){const block=el('div',undefined,'recommendation');block.append(el('strong',`${recommendation.project}: ${recommendation.application}`),el('p',`Difficulty: ${recommendation.difficulty||'Not estimated'} · Cost: ${recommendation.estimatedCost||'Not estimated'}`),el('p',`Risks: ${recommendation.risks||'Not assessed'}`),el('p',`Further investigation: ${recommendation.worthInvestigating||'Not assessed'} · Priority: ${recommendation.priority||'unranked'}`));content.append(block);}
    if(result.recommendations?.length){const row=el('div',undefined,'review'),label=el('label','Recommendation decision'),select=el('select');select.setAttribute('aria-label',`Review ${video.title}`);for(const name of ['New','Under Review','Approved','Rejected','Implemented']){const option=el('option',name);option.selected=name===video.review_status;select.append(option);}select.onchange=()=>action('/api/review',{id:video.id,status:select.value}).then(()=>message('Decision saved. No project changes were made.')).catch(()=>{});row.append(label,select);content.append(row,el('p','This decision applies to this video’s recommendation set. “Implemented” is an owner record, not an action.','small'));}
  }
  if(['failed','skipped','needs_analysis'].includes(video.status)){const retry=el('button',video.status==='failed'?'Try again':'Try analysis again','secondary');retry.onclick=()=>action('/api/retry',{id:video.id}).then(()=>message('Added to the to-do list. Start a batch when ready.')).catch(()=>{});box.append(retry);}
  return box;
}
$('import').onclick=async()=>{try{const files=[...$('files').files];if(!files.length)return message('Choose saved-post or saved-collection HTML/JSON files first.');if(files.length>10||files.reduce((n,f)=>n+f.size,0)>10*1024*1024)return message('Choose at most 10 files totaling 10 MiB.');const result=await action('/api/import',{files:await Promise.all(files.map(async file=>({name:file.name,content:await file.text()})))});if(result)message(result.results.map(x=>`${x.filename}: ${x.added} new, ${x.existing} existing. ${x.warnings.join(' ')}`).join('\n'));}catch(e){message(e.message);}};
$('add-links').onclick=()=>action('/api/links',{links:$('links').value,collection:$('manual-collection').value}).then(result=>{if(result)message(`${result.added} new links added; ${result.existing} already known.`);}).catch(()=>{});
$('research-filter').onchange=()=>{resultFilter=$('research-filter').value;render();};
$('start').onclick=()=>action('/api/start',{size:Number($('batch-size').value),collection:$('batch-collection').value}).then(()=>message('Batch started. Stop finishes the current video before stopping.')).catch(()=>{});
$('pause').onclick=()=>action('/api/stop').then(()=>message('Stopping after the current video; no further videos will start.')).catch(()=>{});
$('refresh-balance').onclick=()=>action('/api/balance').then(()=>message('DeepSeek balance refreshed. No research request was made.')).catch(()=>{});
$('instagram-connect').onclick=()=>action('/api/instagram/connect').then(r=>{if(r)message(r.message);}).catch(()=>{});
$('instagram-confirm').onclick=()=>action('/api/instagram/confirm').then(r=>{if(r)message(r.message);}).catch(()=>{});


let combinePreview;
async function previewCombination(project){try{const preview=await action('/api/projects/combine/preview',{id:project.id});if(!preview)return;combinePreview=preview;$('combine-summary').textContent=`Combine ${preview.count} analyzed results for ${preview.project}. Estimated cost: up to about $${preview.estimatedUSD.toFixed(4)}. ${preview.note}`;$('combine-review').hidden=false;$('combine-review').scrollIntoView({behavior:'smooth',block:'center'});}catch{}}
function appendCombinations(group,project,videos){
 const sources=combinationSources(videos,project,state.excludedCollections||[]),allowed=new Set(sources.map(v=>v.videoId));
 const disabled=sources.length<2||state.queue.running||state.queue.active>0||state.rechecks?.running||state.combining?.running;
 const combine=el('button','Combine ideas','secondary');combine.disabled=disabled;combine.onclick=()=>previewCombination(project);group.append(combine,el('p',sources.length+(sources.length===1?' analyzed result available':' analyzed results available'),'small'));
 const sets=(state.combinedPlans||[]).filter(set=>set.projectId===project.id);
 if(!sets.length){group.append(el('p','No combined plans yet.','small'));return;}
 const refresh=el('button','Refresh','secondary');refresh.setAttribute('aria-label','Refresh combined plans for '+project.name);refresh.disabled=disabled;refresh.onclick=()=>previewCombination(project);group.append(refresh);
 if(JSON.stringify(sets[0].sources)!==JSON.stringify(sources))group.append(el('p','Saved results have changed. Refresh to combine the latest ideas.','small'));
 function renderSet(set){const section=el('section',undefined,'combined-set');const date=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(set.createdAt));section.append(el('h4','Combined plans'),el('p',date+' · NOT VERIFIED','small'));
  const plans=set.plans.filter(plan=>plan.videoIds.every(id=>allowed.has(id)));if(!plans.length)section.append(el('p','Plans using excluded or no-longer-matched results are hidden.','small'));
  plans.forEach((plan,index)=>{const article=el('article',undefined,'combined-plan');article.append(el('h4',plan.name));const list=el('ul');plan.bullets.forEach(b=>list.append(el('li',b)));article.append(list);const links=el('p',undefined,'small');links.append(document.createTextNode('Uses: '));plan.videoIds.forEach((id,i)=>{const video=state.videos.find(v=>v.id===id);if(i)links.append(document.createTextNode(' · '));const link=el('a',video?.result?.title||id);if(video){link.href=video.url;link.target='_blank';link.rel='noopener noreferrer';}links.append(link);});article.append(links);
   const details=el('details');details.dataset.combinedDetail=set.id+':'+index;details.open=openCombined.has(details.dataset.combinedDetail);details.append(el('summary','Give me more'),el('h5','What they do together'),el('p',plan.together),el('h5','First step to try'),el('p',plan.firstStep));article.append(details);section.append(article);});return section;}
 group.append(renderSet(sets[0]));if(sets.length>1){const earlier=el('details');earlier.dataset.combinedDetail='history:'+project.id;earlier.open=openCombined.has(earlier.dataset.combinedDetail);earlier.append(el('summary','Earlier combined plans'));sets.slice(1).forEach(set=>earlier.append(renderSet(set)));group.append(earlier);}
}
$('combine-confirm').onclick=()=>{if(!combinePreview)return;action('/api/projects/combine/confirm',{token:combinePreview.token,confirmed:true}).then(()=>{combinePreview=null;$('combine-review').hidden=true;message('Combining saved ideas. No videos will be downloaded.');}).catch(()=>{});};
$('combine-cancel').onclick=()=>{combinePreview=null;$('combine-review').hidden=true;};
let exclusionsFingerprint='';
function renderExclusions(videos,excluded){
 const names=[...new Map([...videos.flatMap(v=>v.collections),...excluded].map(name=>[collectionKey(name),name])).values()].sort((a,b)=>Number(excluded.some(n=>collectionKey(n)===collectionKey(b)))-Number(excluded.some(n=>collectionKey(n)===collectionKey(a)))||a.localeCompare(b));const fingerprint=JSON.stringify([names,excluded]);if(fingerprint===exclusionsFingerprint)return;exclusionsFingerprint=fingerprint;
 $('excluded-options').replaceChildren(...names.map(name=>{const label=el('label'),input=el('input');input.type='checkbox';input.checked=excluded.some(item=>collectionKey(item)===collectionKey(name));input.onchange=()=>action('/api/collections/exclusion',{name,excluded:input.checked}).catch(()=>{input.checked=!input.checked;});label.append(input,document.createTextNode(' '+name));return label;}));
}
function renderSkipped(videos,excluded){
 const skipped=videos.filter(v=>collectionExcluded(v,excluded)||visualReference(v)||v.status==='skipped').sort((a,b)=>Number(visualReference(b))-Number(visualReference(a)));$('skipped-summary').textContent='Give me more — '+skipped.length+' excluded posts';
 $('skipped-items').replaceChildren(...skipped.slice(0,skippedLimit).map(video=>{const row=el('div',undefined,'skipped-row');row.append(el('strong',video.result?.title||video.title),el('p',visualReference(video)?'Excluded: visual reference':collectionExcluded(video,excluded)?'Excluded collection':video.result?.extraction?.reason||'Excluded: this post has no supported video.','small'));const retry=el('button','Not reference — analyze it','secondary');retry.onclick=()=>action('/api/reference/override',{id:video.id}).then(result=>{if(result)message(result.message);}).catch(()=>{});if(collectionExcluded(video,excluded)||visualReference(video))row.append(retry);return row;}));
 if(!skipped.length)$('skipped-items').append(el('p','No skipped posts.','small'));if(skipped.length>skippedLimit){const more=el('button','Show 10 more skipped posts','secondary');more.onclick=()=>{skippedLimit+=10;render();};$('skipped-items').append(more);}
}
let renderedProjects='';
function renderProjects(projects,videos){
 const fingerprint=JSON.stringify(projects),host=$('my-project-list');
 if(fingerprint!==renderedProjects){renderedProjects=fingerprint;host.replaceChildren(...projects.map(project=>{
  const row=el('article',undefined,'panel project-group project-card');row.dataset.projectCard=project.id;row.append(el('h3',project.name+(project.enabled?'':' (off)')),el('p',project.description,'project-description'));
  if(project.technicalDescription){const technical=el('details');technical.append(el('summary','Give me more'),el('p',project.technicalDescription,'small'));row.append(technical);}
  row.append(el('div',undefined,'matched-ideas'),el('div',undefined,'combined-ideas'));
  const controls=el('div',undefined,'project-controls'),details=el('details'),form=el('form');details.append(el('summary','Edit'));
  const name=el('input');name.value=project.name;name.required=true;name.maxLength=80;name.setAttribute('aria-label','Project name for '+project.name);
  const description=el('textarea');description.value=project.description;description.required=true;description.maxLength=3000;description.rows=3;description.setAttribute('aria-label','Project description for '+project.name);
  const save=el('button','Save changes');save.type='submit';form.append(name,description,save);form.onsubmit=event=>{event.preventDefault();action('/api/projects/save',{id:project.id,name:name.value,description:description.value,enabled:project.enabled}).then(()=>message('Project saved.')).catch(()=>{});};details.append(form);
  const remove=el('button','Delete project','secondary'),confirmation=el('div');confirmation.hidden=true;confirmation.append(el('p','Delete '+project.name+'? Saved findings will be kept.'));const yes=el('button','Confirm delete'),no=el('button','Cancel','secondary');yes.onclick=()=>action('/api/projects/delete',{id:project.id,confirmed:true}).catch(()=>{});no.onclick=()=>confirmation.hidden=true;confirmation.append(yes,no);remove.onclick=()=>confirmation.hidden=false;
  const recheck=el('button','Re-check older results','secondary');recheck.disabled=!project.enabled;recheck.onclick=async()=>{try{const preview=await action('/api/projects/recheck/preview',{id:project.id});if(!preview)return;recheckPreview=preview;$('recheck-summary').textContent=`Re-check ${preview.count} videos for ${preview.project}. Estimated cost: up to about $${preview.estimatedUSD.toFixed(4)}. ${preview.note}`;$('recheck-confirm').disabled=preview.count===0;$('recheck-review').hidden=false;$('recheck-review').scrollIntoView({behavior:'smooth',block:'center'});}catch{}};details.append(remove,recheck,confirmation);
  const toggle=el('button',project.enabled?'Turn off':'Turn on','secondary');toggle.onclick=()=>action('/api/projects/save',{id:project.id,name:project.name,description:project.description,enabled:!project.enabled}).catch(()=>{});controls.append(details,toggle);row.append(controls);return row;
 }));}
 const cards=new Map([...host.children].map(row=>[row.dataset.projectCard,row]));
 for(const project of projects){const row=cards.get(project.id);if(!row)continue;const matches=videos.flatMap(video=>(video.result?.recommendations||[]).filter(r=>recommendationProject(r,projects)?.id===project.id).map(recommendation=>({video,recommendation}))).sort((a,b)=>Number(hasDeepSeekResult(b.video))-Number(hasDeepSeekResult(a.video))||b.video.updated_at-a.video.updated_at);
  const slot=row.querySelector('.matched-ideas');slot.replaceChildren(...matches.map(({video,recommendation},index)=>{const idea=el('div',undefined,'idea'),list=el('ul');idea.append(el('span',hasDeepSeekResult(video)?'DeepSeek':'Older keyword match','pill'));for(const line of projectIdeaBullets(recommendation.application))list.append(el('li',line));idea.append(list);
   const more=el('details');more.dataset.combinedDetail='idea:'+project.id+':'+video.id+':'+index;more.open=openCombined.has(more.dataset.combinedDetail);more.append(el('summary','Give me more'),el('p',recommendation.application),el('p','From: '+(video.result?.title||video.title),'small'));idea.append(more);return idea;}));if(!matches.length)slot.append(el('p','No matches yet','small'));
  const combined=row.querySelector('.combined-ideas');combined.replaceChildren();appendCombinations(combined,project,videos);
 }
}
let recheckPreview;
$('project-add').onsubmit=event=>{event.preventDefault();action('/api/projects/save',{name:$('project-name').value,description:$('project-description').value,enabled:true}).then(()=>{$('project-add').reset();message('Project added.');}).catch(()=>{});};
$('recheck-confirm').onclick=()=>{if(!recheckPreview)return;action('/api/projects/recheck/confirm',{token:recheckPreview.token,confirmed:true}).then(()=>{$('recheck-review').hidden=true;recheckPreview=null;message('Confirmed re-check started.');}).catch(()=>{});};
$('recheck-cancel').onclick=()=>{$('recheck-review').hidden=true;recheckPreview=null;};

refresh().catch(e=>message(e.message));setInterval(()=>refresh().catch(()=>message(unavailableMessage)),3000);
