import test from 'node:test';import assert from 'node:assert/strict';import {parsePriceText,parseShoppingResults,parseWebResults,serperSearch,serperKey,shoppingQuery,canReadStore,fetchShoppingImage} from '../src/serper.mjs';

test('shopping results keep five https matches, drop duplicates and mark Amazon unreadable',()=>{
 const body={shopping:[
  {title:'Chair A',link:'https://shop.example/a',source:'Shop',price:'$19.99',imageUrl:'https://img.example/a.jpg'},
  {title:'Chair A again',link:'https://shop.example/a',source:'Shop',price:'$19.99'},
  {title:'Amazon chair',link:'https://www.amazon.com/dp/B1',source:'Amazon',price:'$25.00'},
  {title:'Bad link',link:'http://insecure.example/b'},
  {title:'Chair B',link:'https://other.example/b',price:'€1.299,00'},
  {title:'Chair C',link:'https://third.example/c'},
  {title:'Chair D',link:'https://fourth.example/d'}
 ]};
 const rows=parseShoppingResults(body);
 assert.equal(rows.length,5);
 assert.equal(rows[0].store,'Shop');
 assert.deepEqual([rows[0].price,rows[0].currency],[19.99,'USD']);
 assert.equal(rows[1].canCheck,false);
 assert.equal(rows[1].reason,"Can't check this store");
 assert.equal(rows[2].price,1299);
 assert.equal(rows[2].currency,'EUR');
 assert.equal(canReadStore('https://amazon.co.uk/dp/1').canCheck,false);
 assert.equal(canReadStore('https://shop.example/x').canCheck,true);
});

test('price text only becomes a number when the currency and one amount are clear',()=>{
 assert.deepEqual(parsePriceText('$1,299.00'),{amount:1299,currency:'USD'});
 assert.deepEqual(parsePriceText('£12.50'),{amount:12.5,currency:'GBP'});
 assert.deepEqual(parsePriceText('Call for price'),{amount:null,currency:null});
 assert.deepEqual(parsePriceText('12.50'),{amount:null,currency:null});
});

test('web results are limited to three distinct https pages',()=>{
 const rows=parseWebResults({organic:[{title:'A',link:'https://a.example/1',snippet:'s'},{title:'A2',link:'https://a.example/1'},{title:'B',link:'https://b.example/2'},{title:'C',link:'https://c.example/3'},{title:'D',link:'https://d.example/4'}]});
 assert.deepEqual(rows.map(r=>r.link),['https://a.example/1','https://b.example/2','https://c.example/3']);
});

test('search refuses a missing key and a blank query before any network call',async()=>{
 let calls=0;const fetcher=async()=>{calls++;return Response.json({});};
 await assert.rejects(serperSearch({kind:'web',query:'hello',apiKey:'',fetcher}),/not configured/);
 await assert.rejects(serperSearch({kind:'web',query:'x',apiKey:'k'.repeat(20),fetcher}),/Enter a product/);
 assert.equal(calls,0);
 assert.equal(serperKey({SERPER_API_KEY:'  abc  '}),'abc');
 assert.equal(serperKey({SERPER_API_KEY:'a\nb'}),'');
});

test('search sends the key only in the request header and never in the body',async()=>{
 let seen;const fetcher=async(url,options)=>{seen={url,options};return Response.json({shopping:[]});};
 await serperSearch({kind:'shopping',query:'chair',apiKey:'secret-key-123',fetcher});
 assert.match(seen.url,/google\.serper\.dev\/shopping$/);
 assert.equal(seen.options.headers['x-api-key'],'secret-key-123');
 assert.equal(JSON.parse(seen.options.body).q,'chair');
 assert.doesNotMatch(JSON.stringify(seen.options.body),/secret-key-123/);
});

test('shopping query uses product facts and falls back to the post title',()=>{
 assert.equal(shoppingQuery({product:{name:'Example chair',brand:'Example',model:'X1'},title:'t'}),'Example Example chair X1');
 assert.equal(shoppingQuery({product:{name:'Product not identified',brand:'',model:''},title:'  A   blue tent '}),'A blue tent');
});

test('product pictures pin a public address, require an image and enforce a size cap',async()=>{
 const {EventEmitter}=await import('node:events');
 const request=(url,options,handler)=>{options.lookup(url.hostname,{},(error,address,family)=>{assert.equal(address,'8.8.8.8');assert.equal(family,4);});const req=new EventEmitter();req.setTimeout=()=>{};req.end=()=>{const res=new EventEmitter();res.statusCode=200;res.headers={'content-type':'image/jpeg'};res.destroy=()=>{};handler(res);queueMicrotask(()=>{res.emit('data',Buffer.from([1,2,3]));res.emit('end');});};return req;};
 const image=await fetchShoppingImage('https://img.example/a.jpg',{resolve:async()=>[{address:'8.8.8.8'}],request});
 assert.equal(image.type,'image/jpeg');
 await assert.rejects(fetchShoppingImage('https://img.example/a.jpg',{resolve:async()=>[{address:'127.0.0.1'}]}),/not public/);
 await assert.rejects(fetchShoppingImage('http://img.example/a.jpg',{resolve:async()=>[{address:'8.8.8.8'}]}),/secure/);
});
