import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {parsePriceText,parseShoppingResults,parseWebResults,braveSearch,braveKey,shoppingQuery,canReadStore,fetchShoppingImage} from '../src/brave.mjs';
import {BraveQuota,freeLimitMessage,monthKey} from '../src/brave-quota.mjs';

const page=(title,url,description,extra={})=>({title,url,description,profile:{long_name:'Outdoor Co'},thumbnail:{src:'https://img.example/c.jpg'},...extra});

test('shopping matches come from Brave web results, skip social pages and mark Amazon',()=>{
 const body={web:{results:[
  page('Camp Chair X1 — Forest Green','https://shop.example/product/chair','Light chair for camping. $98.00'),
  page('Instagram post','https://www.instagram.com/p/abc/','$50'),
  page('Amazon listing','https://www.amazon.com/dp/B1','$90.00'),
  page('Chair review blog','https://blog.example/chair','A long review with no price')
 ]}};
 const rows=parseShoppingResults(body);
 assert.equal(rows.length,3);
 assert.equal(rows[0].store,'Outdoor Co');
 assert.deepEqual([rows[0].price,rows[0].currency],[98,'USD']);
 assert.equal(rows[0].imageUrl,'https://img.example/c.jpg');
 assert.equal(rows.some(r=>/amazon/i.test(r.link)&&r.canCheck===false),true);
 assert.equal(canReadStore('https://amazon.co.uk/dp/1').canCheck,false);
 assert.equal(canReadStore('https://shop.example/x').canCheck,true);
 assert.equal(rows.find(r=>r.link.includes('blog.example')).canCheck,false);
 assert.equal(rows.find(r=>r.link.includes('blog.example')).reason,'Not a store page');
});

test('price text only becomes a number when the currency and one amount are clear',()=>{
 assert.deepEqual(parsePriceText('$1,299.00'),{amount:1299,currency:'USD'});
 assert.deepEqual(parsePriceText('£12.50'),{amount:12.5,currency:'GBP'});
 assert.deepEqual(parsePriceText('Call for price'),{amount:null,currency:null});
 assert.deepEqual(parsePriceText('12.50'),{amount:null,currency:null});
});

test('web results keep three distinct https pages and join extra snippets',()=>{
 const rows=parseWebResults({web:{results:[
  page('A','https://a.example/1','first',{extra_snippets:['second']}),
  page('A2','https://a.example/1','duplicate'),
  page('B','https://b.example/2','third'),
  page('C','https://c.example/3','fourth'),
  page('D','https://d.example/4','fifth')
 ]}});
 assert.deepEqual(rows.map(r=>r.link),['https://a.example/1','https://b.example/2','https://c.example/3']);
 assert.match(rows[0].snippet,/first second/);
});

test('search refuses a missing key or blank query before any network call',async()=>{
 let calls=0;const fetcher=async()=>{calls++;return Response.json({});};
 await assert.rejects(braveSearch({kind:'web',query:'hello',apiKey:'',fetcher}),/not configured/);
 await assert.rejects(braveSearch({kind:'web',query:'x',apiKey:'k'.repeat(20),fetcher}),/Enter a product/);
 assert.equal(calls,0);
 assert.equal(braveKey({BRAVE_API_KEY:'  abc  '}),'abc');
 assert.equal(braveKey({BRAVE_APY_KEY:'  typo-key  '}),'typo-key');
 assert.equal(braveKey({BRAVE_API_KEY:'a\nb'}),'');
});

test('search sends the key only in a header, never in the URL',async()=>{
 let seen;const fetcher=async(url,options)=>{seen={url,options};return Response.json({web:{results:[]}});};
 await braveSearch({kind:'web',query:'chair',apiKey:'secret-key-123',fetcher});
 assert.match(seen.url,/api\.search\.brave\.com\/res\/v1\/web\/search/);
 assert.match(seen.url,/q=chair|q=chair/);
 assert.doesNotMatch(seen.url,/secret-key-123/);
 assert.equal(seen.options.headers['x-subscription-token'],'secret-key-123');
 assert.equal(seen.options.method,'GET');
});

test('a refused or rate-limited search becomes a plain message with no retry',async()=>{
 const limited=async()=>new Response('{}',{status:429});
 await assert.rejects(braveSearch({kind:'web',query:'chair',apiKey:'k'.repeat(20),fetcher:limited}),/free search limit/);
 const refused=async()=>new Response('{}',{status:401});
 await assert.rejects(braveSearch({kind:'web',query:'chair',apiKey:'k'.repeat(20),fetcher:refused}),/key was refused/);
});

test('shopping query strips hashtags and falls back to the post title',()=>{
 assert.equal(shoppingQuery({product:{name:'Example chair',brand:'Example',model:'X1'},title:'t'}),'Example Example chair X1 buy');
 assert.equal(shoppingQuery({product:{name:'Product not identified',brand:'',model:''},title:'A blue tent #camping #gear'}),'A blue tent buy');
});

test('the monthly free-search counter stops at the limit and resets next month',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'brave-quota-'));
 try{
  const file=join(dir,'usage.json');const now=Date.UTC(2026,9,31,12);
  const quota=new BraveQuota({file,limit:2,now:()=>now});
  assert.deepEqual(quota.status(),{month:'2026-10',used:0,limit:2,remaining:2});
  assert.equal((await quota.reserve(1)).allowed,true);
  assert.equal((await quota.reserve(1)).allowed,true);
  const refused=await quota.reserve(1);
  assert.equal(refused.allowed,false);
  assert.match(freeLimitMessage(refused),/free Brave search limit for this month is used up \(2 of 2\)/);
  assert.equal(quota.status().remaining,0);
  // A new calendar month starts fresh.
  const november=new BraveQuota({file,limit:2,now:()=>Date.UTC(2026,10,1,12)});
  assert.equal(november.status().month,'2026-11');
  assert.equal(november.status().remaining,2);
  assert.equal(monthKey(now),'2026-10');
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('product pictures pin a public address, require an image and enforce a size cap',async()=>{
 const {EventEmitter}=await import('node:events');
 const request=(url,options,handler)=>{options.lookup(url.hostname,{},(error,address,family)=>{assert.equal(address,'8.8.8.8');assert.equal(family,4);});const req=new EventEmitter();req.setTimeout=()=>{};req.end=()=>{const res=new EventEmitter();res.statusCode=200;res.headers={'content-type':'image/jpeg'};res.destroy=()=>{};handler(res);queueMicrotask(()=>{res.emit('data',Buffer.from([1,2,3]));res.emit('end');});};return req;};
 const image=await fetchShoppingImage('https://img.example/a.jpg',{resolve:async()=>[{address:'8.8.8.8'}],request});
 assert.equal(image.type,'image/jpeg');
 await assert.rejects(fetchShoppingImage('https://img.example/a.jpg',{resolve:async()=>[{address:'127.0.0.1'}]}),/not public/);
 await assert.rejects(fetchShoppingImage('http://img.example/a.jpg',{resolve:async()=>[{address:'8.8.8.8'}]}),/secure/);
});
