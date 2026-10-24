import test from 'node:test';
import assert from 'node:assert/strict';
import { LibraryStore } from '../src/store.mjs';
import { ResearchQueue } from '../src/queue.mjs';

const item=(id,collections=['Tech'])=>({shortcode:id,url:`https://www.instagram.com/p/${id}/`,title:id,collections});
const research={summary:'Test summary',provenance:{provider:'test'},recommendations:[{application:'Paper experiment'}]};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate){for(let i=0;i<200;i++){if(predicate())return;await delay(5);}assert.fail('Condition timed out');}

test('updated exports deduplicate across collections and preserve completed analysis and reviews',()=>{
  const store=new LibraryStore(':memory:');
  try{assert.equal(store.import([item('abc')],{hash:'first'}).added,1);store.claim();store.finish('abc',{status:'completed',result:research});store.review('abc','Approved');
    const update=store.import([item('abc',['Pennywise']),item('def')],{hash:'second'});
    assert.deepEqual([update.added,update.existing],[1,1]);assert.deepEqual(store.get('abc').collections,['Pennywise','Tech']);
    assert.equal(store.get('abc').status,'completed');assert.equal(store.get('abc').review_status,'Approved');
    assert.equal(store.import([item('abc')],{hash:'second'}).repeatedExport,true);assert.equal(store.list().length,2);
    assert.throws(()=>store.retry('abc'),/Only/);
  }finally{store.close();}
});
test('interrupted jobs resume but completed items are never claimed',()=>{
  const store=new LibraryStore(':memory:');try{store.import([item('aaa'),item('bbb')]);const a=store.claim();store.finish(a.id,{status:'completed',result:research});const b=store.claim();
    assert.equal(store.recover(),1);assert.equal(store.get(b.id).attempts,0);assert.equal(store.claim().id,b.id);assert.equal(store.claim(),undefined);
  }finally{store.close();}
});
test('transient errors back off, cap retries, and store only sanitized error codes',()=>{
  const store=new LibraryStore(':memory:');try{store.import([item('abc')]);store.claim(100);const error=Object.assign(new Error('secret signed-url'),{retryable:true,code:'RATE_LIMIT',retryAfterMs:30000});
    store.fail('abc',error,100);assert.equal(store.get('abc').available_at,30100);assert.equal(store.claim(30099),undefined);assert.equal(store.claim(30100).attempts,2);
    store.fail('abc',error,30100);store.claim(60100);store.fail('abc',error,60100);assert.equal(store.get('abc').status,'failed');assert.equal(store.get('abc').error,'RATE_LIMIT');
    store.retry('abc');assert.equal(store.claim(70000).attempts,1);
  }finally{store.close();}
});
test('three-video pilot enforces concurrency, isolates failures, and leaves a fourth job untouched',async()=>{
  const store=new LibraryStore(':memory:');store.import(['aaa','bbb','ccc','ddd'].map(id=>item(id)));
  let active=0,maximum=0;const seen=[];
  const queue=new ResearchQueue(store,async job=>{active++;maximum=Math.max(maximum,active);seen.push(job.id);await delay(20);active--;if(job.id==='bbb')throw Object.assign(Error('deleted'),{code:'DELETED'});return {status:'needs_analysis',result:{summary:null}};},{concurrency:2,minIntervalMs:0});
  try{queue.start(3);for(let i=0;i<30&&queue.running;i++){queue.tick();await delay(5);}await until(()=>!queue.running);
    assert.equal(maximum,2);assert.equal(seen.length,3);assert.equal(store.list().filter(x=>x.status==='pending').length,1);assert.equal(store.get('bbb').status,'failed');
  }finally{await queue.stop();store.close();}
});
test('pause cannot replace a still-active batch, and invalid concurrency is rejected',async()=>{
  const store=new LibraryStore(':memory:');store.import(['aaa','bbb','ccc','ddd'].map(id=>item(id)));
  let finish;const queue=new ResearchQueue(store,()=>new Promise(resolve=>{finish=resolve;}),{concurrency:1,minIntervalMs:0});
  try{assert.throws(()=>new ResearchQueue(store,()=>{}, {concurrency:3}),/Concurrency/);queue.start();await until(()=>!!finish);const cohort=[...queue.ids];queue.pause();assert.match(queue.start().message,/finishing/);assert.deepEqual([...queue.ids],cohort);finish({status:'skipped',result:{}});await until(()=>queue.active.size===0);}
  finally{await queue.stop();store.close();}
});
test('approval requires recommendations and does not create an implementation job',()=>{
  const store=new LibraryStore(':memory:');try{store.import([item('abc')]);assert.throws(()=>store.review('abc','Approved'),/no research/);store.finish('abc',{status:'needs_analysis',result:research});store.review('abc','Approved');assert.equal(store.get('abc').status,'needs_analysis');assert.equal(store.claim(),undefined);assert.throws(()=>store.review('abc','execute'),/Invalid/);}finally{store.close();}
});
test('a fresh research result cannot inherit approval of old recommendations',()=>{
  const store=new LibraryStore(':memory:');try{store.import([item('abc')]);store.finish('abc',{status:'needs_analysis',result:research});store.review('abc','Approved');store.retry('abc');store.claim();
    store.finish('abc',{status:'needs_analysis',result:{...research,recommendations:[{application:'Different hypothesis'}]}});
    assert.equal(store.get('abc').review_status,'New');
  }finally{store.close();}
});
test('graceful cancellation leaves a job pending without spending an attempt',async()=>{
  const store=new LibraryStore(':memory:');store.import([item('aaa')]);
  const queue=new ResearchQueue(store,(_job,signal)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(Error('cancelled'),{code:'CANCELLED'})),{once:true})),{minIntervalMs:0});
  try{queue.start();await delay(5);await queue.stop();assert.equal(store.get('aaa').status,'pending');assert.equal(store.get('aaa').attempts,0);assert.equal(store.claim().id,'aaa');}finally{store.close();}
});
