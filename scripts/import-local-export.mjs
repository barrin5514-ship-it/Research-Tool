import {readFile,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {parseExport,MAX_EXPORT_BYTES} from '../src/importer.mjs';
// Read in place, send only to the existing loopback importer, never save a copy.
const folder=process.argv[2];if(!folder)throw Error('Supply the extracted your_instagram_activity/saved directory.');
const base='http://127.0.0.1:5199';
const digest=x=>createHash('sha256').update(x).digest('hex');
const files=[];const parsed=[];const hashes=[];
const archive=(await stat(resolve(folder))).isFile();
const sourceHash=archive?digest(await readFile(resolve(folder))):null;
if(archive){
 const reader=await readFile(resolve('scripts/read-saved-archive.ps1'),'utf8');
 const output=await promisify(execFile)('powershell.exe',['-NoProfile','-NonInteractive','-Command',`& { ${reader} } -Archive $env:RESEARCH_IMPORT_ARCHIVE`],{env:{...process.env,RESEARCH_IMPORT_ARCHIVE:resolve(folder)},windowsHide:true,maxBuffer:32*1024*1024,timeout:30000});
 const contents=JSON.parse(output.stdout.replace(/^\uFEFF/,''));
 for(const file of contents){parsed.push(parseExport(file.content,{filename:file.name}));files.push(file);}
}else for(const name of ['saved_posts.json','saved_collections.json']){
 const source=join(resolve(folder),name);if((await stat(source)).size>MAX_EXPORT_BYTES)throw Error('Export exceeds importer limit.');
 const content=await readFile(source,'utf8');parsed.push(parseExport(content,{filename:name}));files.push({name,content});hashes.push(digest(content));
}
const get=async()=>{const response=await fetch(base+'/api/state',{redirect:'error'});if(!response.ok)throw Error('Dashboard unavailable');const value=await response.json();if(value.application!=='instagram-research-library')throw Error('Unexpected local application');return value;};
const before=await get();
const post=async(route,body)=>{const response=await fetch(base+route,{method:'POST',redirect:'error',headers:{origin:base,'content-type':'application/json','x-research-token':before.csrf},body:JSON.stringify(body)});if(!response.ok)throw Error('Local import request failed');return response.json();};
await post('/api/pause',{});if((await get()).queue.active)throw Error('An existing video is still active; import stopped.');
const imported=await post('/api/import',{files});const after=await get();
const all=new Map();for(const p of parsed)for(const item of p.items){const memberships=all.get(item.shortcode)||new Set();item.collections.forEach(n=>memberships.add(n));all.set(item.shortcode,memberships);}
const existing=new Map(before.videos.map(v=>[v.id,v]));
const unchangedExisting=after.videos.filter(v=>existing.has(v.id)).every(v=>{const old=existing.get(v.id);return v.status===old.status&&v.attempts===old.attempts&&JSON.stringify(v.result)===JSON.stringify(old.result);});
const noNewProcessing=after.videos.filter(v=>!existing.has(v.id)).every(v=>v.status==='pending'&&v.attempts===0);
const sourceFilesUnchanged=archive?digest(await readFile(resolve(folder)))===sourceHash:(await Promise.all(files.map(async(f,i)=>digest(await readFile(join(resolve(folder),f.name),'utf8'))===hashes[i]))).every(Boolean);
const collections=new Map(parsed.flatMap(p=>p.collections.map(c=>[c.name,c])));
const report={files:imported.results.map((r,i)=>({filename:r.filename,uniquePosts:parsed[i].items.length,collectionCount:parsed[i].collections.length,added:r.added,existing:r.existing,warnings:r.warnings})),uniqueExportPosts:all.size,exportCollections:collections.size,collectionCounts:[...collections.keys()].map(name=>({name,posts:[...all.values()].filter(s=>s.has(name)).length})),targetCollectionCounts:Object.fromEntries(['Pennywise','Personafy','Tech','Dev Squad AI'].map(n=>[n,[...all.values()].filter(s=>s.has(n)).length])),libraryPostsAfter:after.videos.length,unchangedExisting,noNewProcessing,sourceFilesUnchanged,queuePaused:!after.queue.running&&after.queue.active===0,noPaidCalls:after.deepseekUsage.length===before.deepseekUsage.length};
console.log(JSON.stringify(report,null,2));
if(!unchangedExisting||!noNewProcessing||!sourceFilesUnchanged||!report.queuePaused||!report.noPaidCalls)process.exitCode=1;
