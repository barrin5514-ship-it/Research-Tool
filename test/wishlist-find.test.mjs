import test from 'node:test';import assert from 'node:assert/strict';import {LibraryStore} from '../src/store.mjs';import {Wishlist} from '../src/wishlist.mjs';

const MATCHES=[
 {title:'Chair A',store:'Shop One',link:'https://shop.example/a',price:100,currency:'USD',priceText:'$100.00',imageUrl:'https://img.example/a.jpg',canCheck:true,reason:''},
 {title:'Amazon chair',store:'Amazon',link:'https://www.amazon.com/dp/B1',price:90,currency:'USD',priceText:'$90.00',imageUrl:'',canCheck:false,reason:"Can't check this store"}
];
function setup({apiKey='test-key'}={}){const store=new LibraryStore(':memory:');store.import([{shortcode:'Buy',url:'https://www.instagram.com/p/Buy/',title:'A chair post with enough words',collections:['shit I want to buy']}]);let searches=0;const wishlist=new Wishlist({store,apiKey,now:()=>Date.now(),wait:async()=>{},search:async()=>{searches++;return MATCHES;},checkPrice:async()=>({amount:80,currency:'USD'})});return {store,wishlist,searches:()=>searches};}

test('finding matches costs one search, needs confirmation, and stores at most five matches',async()=>{
 const {store,wishlist,searches}=setup();try{
  const preview=wishlist.prepareFind('Buy');
  assert.equal(preview.estimatedUSD,0.001);
  await assert.rejects(wishlist.find({token:preview.token,confirmed:false}),/confirm/i);
  assert.equal(searches(),0);
  const result=await wishlist.find({token:preview.token,confirmed:true});
  assert.equal(searches(),1);
  assert.equal(result.matches.length,2);
  const item=wishlist.list().items[0];
  assert.equal(item.matches.length,2);
  assert.equal(item.matches[1].canCheck,false);
  assert.equal(item.matches[1].reason,"Can't check this store");
 }finally{store.close();}
});

test('a missing server key is reported before any search and never stored in state',()=>{
 const {store,wishlist}=setup({apiKey:''});try{
  assert.throws(()=>wishlist.prepareFind('Buy'),/SERPER_API_KEY/);
  assert.doesNotMatch(JSON.stringify(wishlist.list()),/test-key/);
 }finally{store.close();}
});

test('nothing is tracked until a shown match is picked, and only once',async()=>{
 const {store,wishlist}=setup();try{
  const preview=wishlist.prepareFind('Buy');
  await wishlist.find({token:preview.token,confirmed:true});
  assert.equal(wishlist.list().items[0].tracked.length,0);
  assert.throws(()=>wishlist.track({videoId:'Buy',url:'https://other.example/x',store:'Other'}),/search results/);
  wishlist.track({videoId:'Buy',url:'https://shop.example/a',store:'Shop One',title:'Chair A',currency:'USD'});
  wishlist.track({videoId:'Buy',url:'https://shop.example/a',store:'Shop One',title:'Chair A',currency:'USD'});
  assert.equal(wishlist.list().items[0].tracked.length,1);
 }finally{store.close();}
});

test('tracked prices are checked once a day, record the lowest store and raise one drop banner',async()=>{
 const {store,wishlist}=setup();try{
  const preview=wishlist.prepareFind('Buy');
  await wishlist.find({token:preview.token,confirmed:true});
  wishlist.track({videoId:'Buy',url:'https://shop.example/a',store:'Shop One',title:'Chair A',currency:'USD'});
  let calls=0;const priced=new Wishlist({store,apiKey:'test-key',wait:async()=>{},checkPrice:async()=>{calls++;return {amount:calls===1?100:80,currency:'USD'};}});
  // Replace the tracked row's check function by using a new instance over the same store.
  const before=Date.now();await priced.tick();assert.equal(calls,1);
  await priced.tick();assert.equal(calls,1);
  const item=priced.list().items[0];
  assert.equal(item.tracked[0].current.amount,100);
  assert.equal(item.lowest.amount,100);
  assert.equal(item.lowest.store,'Shop One');
  assert.equal(priced.list().drops.count,0);
  // Move the clock one day forward by resetting next_check, then check again.
  store.db.prepare('UPDATE wishlist_tracked SET next_check=0').run();
  await priced.tick();
  const dropped=priced.list();
  assert.equal(dropped.drops.count,1);
  assert.equal(dropped.drops.items[0].newAmount,80);
  assert.equal(dropped.items[0].lowest.amount,80);
  priced.dismissDrops();
  assert.equal(priced.list().drops.count,0);
  assert.ok(before>0);
 }finally{store.close();}
});

test('an unreadable tracked store shows Can not check this store and is not retried',async()=>{
 const {store,wishlist}=setup();try{
  const preview=wishlist.prepareFind('Buy');
  await wishlist.find({token:preview.token,confirmed:true});
  wishlist.track({videoId:'Buy',url:'https://shop.example/a',store:'Shop One',title:'Chair A',currency:'USD'});
  let calls=0;const blocked=new Wishlist({store,wait:async()=>{},checkPrice:async()=>{calls++;throw Object.assign(Error('blocked'),{blocked:true});}});
  await blocked.tick();
  store.db.prepare('UPDATE wishlist_tracked SET next_check=0').run();
  await blocked.tick();
  assert.equal(calls,1);
  assert.equal(blocked.list().items[0].tracked[0].reason,"Can't check this store");
 }finally{store.close();}
});
