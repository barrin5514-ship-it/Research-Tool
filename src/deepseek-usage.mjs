import {appendFile,readFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
export async function recordUsage(file,record){await mkdir(dirname(file),{recursive:true});await appendFile(file,JSON.stringify(record)+'\n');}
export async function readUsage(file){try{return (await readFile(file,'utf8')).trim().split('\n').filter(Boolean).map(x=>JSON.parse(x)).slice(-100);}catch(e){if(e.code==='ENOENT')return [];throw Error('DeepSeek usage ledger could not be read');}}
