import test from 'node:test';import assert from 'node:assert/strict';import {LibraryStore} from '../src/store.mjs';import {ClaimCheck,estimateClaimCost,MAX_CLAIMS} from '../src/claim-check.mjs';

const CLAIMS=['Kronos gives 100% returns.','Python 3.13 was released in 2024.','Coffee cures all disease.','The moon is made of cheese.','Node.js uses the V8 engine.','An unchecked sixth claim.'];
function setup(){const store=new LibraryStore(':memory:');store.import([{shortcode:'Post',url:'https://www.instagram.com/p/Post/',title:'A research post',collections:['Tech']}]);
 store.finish('Post',{status:'completed',result:{summary:'A saved summary about trading software.',provenance:{provider:'deepseek'},verification:'NOT VERIFIED',claims:CLAIMS.map(claim=>({claim,status:'NOT VERIFIED',sources:[]}))}});return store;}
const links=n=>Array.from({length:n},(_,i)=>({title:'Page '+i,link:'https://source.example/'+i,snippet:'Snippet '+i}));

test('five claims cost far less than two cents and the sixth is left unchecked',()=>{
 const cost=estimateClaimCost(CLAIMS);
 assert.equal(cost.claims,5);
 assert.ok(cost.estimatedUSD<0.02);
 assert.ok(cost.searchUSD===0.005);
});

test('checking searches once per claim and saves only supplied links, never a made-up one',async()=>{
 const store=setup();try{
  let searches=0,calls=0,usage=null;
  const check=new ClaimCheck({store,apiKey:'x'.repeat(20),isBusy:()=>false,
   search:async({query})=>{searches++;return query.startsWith('The moon')?[]:[{title:'Result for '+query,link:'https://source.example/'+searches,snippet:'s'}];},
   fetcher:async()=>{calls++;return Response.json({usage:{prompt_tokens:900,completion_tokens:200},choices:[{message:{content:JSON.stringify({claims:[
    {claim:CLAIMS[0],status:'Confirmed',reason:'One page states it directly.',sources:[{url:'https://source.example/1',title:'Page 1'}]},
    {claim:CLAIMS[1],status:'Confirmed',reason:'Invented link below.',sources:[{url:'https://made-up.example/x',title:'Invented'}]},
    {claim:CLAIMS[2],status:'Looks false',reason:'The page contradicts it.',sources:[{url:'https://source.example/3'}]},
    {claim:CLAIMS[3],status:"Couldn't find proof.",reason:'No usable results.',sources:[]},
    {claim:CLAIMS[4],status:'Not confirmed',reason:'Unclear.',sources:[]}
   ]})}}]});},
   onUsage:record=>{usage=record;}});
  const preview=check.prepare('Post');
  assert.equal(preview.claims,5);
  assert.equal(preview.skipped,1);
  const result=await check.confirm({token:preview.token,confirmed:true});
  assert.equal(searches,5);
  assert.equal(calls,1);
  assert.ok(usage.usage.estimatedUSD>0);
  const claims=store.get('Post').result.claims;
  assert.equal(claims[0].status,'Confirmed');
  assert.deepEqual(claims[0].sources.map(s=>s.url),['https://source.example/1']);
  assert.equal(claims[1].status,'Not confirmed');
  assert.equal(claims[1].sources.length,0);
  assert.equal(claims[2].status,'Looks false');
  assert.equal(claims[3].status,"Couldn't find proof.");
  assert.equal(claims[4].status,'Not confirmed');
  // The sixth claim was never checked and keeps its original status.
  assert.equal(claims[5].status,'NOT VERIFIED');
  assert.equal(store.get('Post').result.verification,'NOT VERIFIED');
  assert.equal(MAX_CLAIMS,5);
 }finally{store.close();}
});

test('a check without confirmation or with a changed claim list is refused before any call',async()=>{
 const store=setup();try{
  let calls=0;
  const check=new ClaimCheck({store,apiKey:'x',search:async()=>{calls++;return [];},fetcher:async()=>{calls++;return Response.json({});}});
  const preview=check.prepare('Post');
  await assert.rejects(check.confirm({token:preview.token,confirmed:false}),/confirm/i);
  assert.equal(calls,0);
  store.finish('Post',{status:'completed',result:{summary:'Changed summary that is long enough.',provenance:{provider:'deepseek'},verification:'NOT VERIFIED',claims:[{claim:'A different claim',status:'NOT VERIFIED',sources:[]}]}});
  await assert.rejects(check.confirm({token:preview.token,confirmed:true}),/changed/);
  assert.equal(calls,0);
 }finally{store.close();}
});

test('a server with no DeepSeek key cannot start a check',()=>{
 const store=setup();try{
  const check=new ClaimCheck({store,apiKey:''});
  assert.throws(()=>check.prepare('Post'));
 }finally{store.close();}
});
