import {readFile,writeFile} from 'node:fs/promises';
export const BALANCE_ENDPOINT='https://api.deepseek.com/user/balance';
export function createBalanceTracker({apiKey,file,fetcher=fetch}){
 return {
  async get(){try{return JSON.parse(await readFile(file,'utf8'));}catch{return null;}},
  async refresh(){
   if(!apiKey?.trim()||/[\r\n]/.test(apiKey))throw Error('Configure the server-side DeepSeek key first.');
   let response;try{response=await fetcher(BALANCE_ENDPOINT,{method:'GET',redirect:'error',signal:AbortSignal.timeout(10000),headers:{authorization:`Bearer ${apiKey}`,accept:'application/json'}});}catch{throw Error('DeepSeek balance is unavailable.');}
   if(!response.ok||response.redirected){await response.body?.cancel().catch(()=>{});throw Error(`DeepSeek balance request failed (${response.status}).`);}
   const reader=response.body.getReader(),chunks=[];let length=0;
   try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>32000)throw Error('Balance response is too large.');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
   let raw;try{raw=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Error('Invalid balance response.');}
   if(typeof raw.is_available!=='boolean'||!Array.isArray(raw.balance_infos))throw Error('Invalid balance response.');
   const balances=raw.balance_infos.filter(b=>['USD','CNY'].includes(b.currency)&&typeof b.total_balance==='string'&&/^-?\d+(?:\.\d+)?$/.test(b.total_balance)).map(b=>({currency:b.currency,total:b.total_balance}));
   if(!balances.length)throw Error('No supported balance was returned.');
   const result={checkedAt:new Date().toISOString(),available:raw.is_available,balances};await writeFile(file,JSON.stringify(result,null,2));return result;
  }
 };
}
