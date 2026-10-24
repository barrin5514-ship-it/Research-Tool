import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { freemem,totalmem,cpus } from 'node:os';
const run=promisify(execFile);
console.log(JSON.stringify({node:process.version,cores:cpus().length,totalMemoryGiB: +(totalmem()/2**30).toFixed(2),freeMemoryGiB:+(freemem()/2**30).toFixed(2)},null,2));
for(const binary of ['ffmpeg','ffprobe']) {
  try{const result=await run(binary,['-version'],{timeout:10000,windowsHide:true});console.log(`${binary}: ${result.stdout.split(/\r?\n/)[0]}`);}catch{console.log(`${binary}: NOT VERIFIED (not reachable from this shell)`);}
}
for(const [label,url] of [['Cobalt','http://127.0.0.1:9100/'],['Personafy','http://127.0.0.1:5185/'],['Local AI','http://127.0.0.1:1234/v1/models']]) {
  try{const response=await fetch(url,{signal:AbortSignal.timeout(3000),redirect:'error'});console.log(`${label}: HTTP ${response.status}`);await response.body?.cancel();}catch{console.log(`${label}: not reachable`);}
}
console.log('Speech/OCR: built-in Windows extraction enabled by default on Windows (disable with RESEARCH_WINDOWS_EXTRACTION=0). Independent claim retrieval is limited; semantic verification remains incomplete. No paid API requested.');
