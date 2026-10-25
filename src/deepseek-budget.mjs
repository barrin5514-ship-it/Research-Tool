import {open,readFile,unlink} from 'node:fs/promises';
import {DEEPSEEK_ENDPOINT} from './deepseek.mjs';
// Reserve the worst-case cost before sending. Failed/unknown requests are never refunded.
export function budgetedFetch(file,fetcher=fetch){
 return async(target,options)=>{
  if(target!==DEEPSEEK_ENDPOINT)throw Error('Only the official DeepSeek endpoint is permitted');
  const payload=JSON.parse(options.body),input=JSON.parse(payload.messages[1].content);
  const bound=(Buffer.byteLength(options.body)+2048)*0.30/1e6+1200*1.20/1e6;
  if(payload.model!=='deepseek-flash'||payload.max_tokens!==1200||bound>0.01)throw Error('Request exceeds approved limits');
  const lock=await open(file+'.lock','wx');
  try{
   const handle=await open(file,'r+');
   try{
    const budget=JSON.parse(await handle.readFile('utf8'));
    const item=budget.videos.find(v=>v.url===input.sourceUrl);
    if(!budget.active||!item||budget.requests.length>=3||budget.requests.some(r=>r.id===item.id)||budget.requests.reduce((n,r)=>n+r.reservedUSD,0)+bound>0.03)throw Error('No remaining owner approval for this video');
    budget.requests.push({id:item.id,at:new Date().toISOString(),reservedUSD:bound});
    await handle.truncate(0);await handle.write(JSON.stringify(budget,null,2),0,'utf8');await handle.sync();
   }finally{await handle.close();}
  }finally{await lock.close();await unlink(file+'.lock');}
  return fetcher(target,options);
 };
}
export async function hasVideoApproval(file,id){try{const b=JSON.parse(await readFile(file,'utf8'));return b.active&&b.videos.some(v=>v.id===id)&&!b.requests.some(r=>r.id===id)&&b.requests.length<3;}catch{return false;}}
