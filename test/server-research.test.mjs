import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { LibraryStore } from '../src/store.mjs';
import { ResearchQueue } from '../src/queue.mjs';
import { createApp } from '../src/server.mjs';
import { normalizeResearch,validateLocalUrl,createLocalResearch } from '../src/research.mjs';

test('local dashboard import/update and host/origin/CSRF security boundaries',async()=>{
  const store=new LibraryStore(':memory:');const queue=new ResearchQueue(store,async()=>({status:'needs_analysis',result:{}}));const server=createApp({store,queue});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  try{
    const page=await fetch(base);assert.equal(page.status,200);assert.match(await page.text(),/Research Library/);assert.match(page.headers.get('content-security-policy'),/frame-src 'none'/);
    const state=await (await fetch(base+'/api/state')).json();
    const send=(path,body,headers={})=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json',origin:base,'x-research-token':state.csrf,...headers},body:JSON.stringify(body)});
    assert.equal((await send('/api/start',{}, {origin:'https://evil.example'})).status,403);
    assert.equal((await send('/api/start',{}, {'x-research-token':'wrong'})).status,403);
    const rebindingStatus=await new Promise((resolve,reject)=>{const req=request(base+'/api/state',{headers:{host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});
    assert.equal(rebindingStatus,403);
    const files=[{name:'saved_posts.json',content:JSON.stringify({saved_saved_media:[{title:'creator',string_map_data:{'Saved on':{href:'https://www.instagram.com/reel/Test001/?igsh=tracking'}}}]})}];
    const first=await send('/api/import',{files});assert.equal(first.status,200);assert.equal((await first.json()).results[0].added,1);
    const again=await send('/api/import',{files});assert.equal((await again.json()).results[0].repeatedExport,true);
    assert.equal((await send('/api/links',{links:'http://127.0.0.1/secret'})).status,400);
    const add=await send('/api/links',{links:'https://www.instagram.com/p/Test001/',collection:'Tech'});assert.equal(add.status,200);assert.deepEqual(store.get('Test001').collections,['Tech']);
    assert.equal(store.list().length,1);assert.equal((await send('/api/review',{id:'Test001',status:'Approved'})).status,400);
  }finally{await queue.stop();await new Promise(resolve=>server.close(resolve));store.close();}
});

test('AI suggestions cannot assert verified claims or invent retained citations',()=>{
  const result=normalizeResearch({summary:'Potential idea',claims:[null,{claim:'Guaranteed returns',status:'VERIFIED',sources:['https://fake.example']}],recommendations:[{project:'Pennywise',application:'Paper test',estimatedCost:'$0 (model estimate)'}]}, {model:'test',job:{title:'Clip',url:'https://www.instagram.com/p/abc/'}});
  assert.equal(result.verification,'NOT VERIFIED');assert.equal(result.transcript,null);assert.equal(result.claims[0].status,'NOT VERIFIED');assert.deepEqual(result.claims[0].sources,[]);assert.equal(result.provenance.independentVerification,false);
});
test('research provider permits only explicit local models and origins',async()=>{
  for(const url of ['https://api.openai.com','http://user:secret@localhost:1234','http://localhost:1234/a','http://192.168.1.2:1234'])assert.throws(()=>validateLocalUrl(url));
  assert.equal(validateLocalUrl('http://127.0.0.1:1234/'),'http://127.0.0.1:1234');assert.throws(()=>createLocalResearch({}),/explicit/);
  let called=0;const research=createLocalResearch({model:'not-loaded',fetcher:async()=>{called++;return Response.json({data:[{id:'not-loaded',type:'vlm',state:'not-loaded'}]});}});
  await assert.rejects(research({job:{},frames:[]}),/already be loaded/);assert.equal(called,1);
});
