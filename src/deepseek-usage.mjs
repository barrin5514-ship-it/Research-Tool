import {appendFile,readFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
export async function recordUsage(file,record){await mkdir(dirname(file),{recursive:true});await appendFile(file,JSON.stringify(record)+'\n');}
export async function readUsage(file,limit=100){try{return (await readFile(file,'utf8')).trim().split('\n').filter(Boolean).map(x=>JSON.parse(x)).slice(limit===Infinity?0:-limit);}catch(e){if(e.code==='ENOENT')return [];throw Error('DeepSeek usage ledger could not be read');}}

export async function usageSummary(file){const calls=await readUsage(file,Infinity);return {calls:calls.length,videoAnalyses:calls.filter(r=>r.kind!=='project-combination').length,combinationCalls:calls.filter(r=>r.kind==='project-combination').length,inputTokens:calls.reduce((n,r)=>n+(r.usage?.inputTokens||0),0),outputTokens:calls.reduce((n,r)=>n+(r.usage?.outputTokens||0),0),estimatedUSD:calls.reduce((n,r)=>n+(r.usage?.estimatedUSD||0),0),unknownUsage:calls.filter(r=>!r.usage).length};}
