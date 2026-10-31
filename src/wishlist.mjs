import {setTimeout as delay} from 'node:timers/promises';
import {randomUUID} from 'node:crypto';
import {storeUrl,checkStorePrice} from './store-price.mjs';
import {serperSearch,SERPER_COST_USD,shoppingQuery,SHOPPING_RESULT_LIMIT} from './serper.mjs';
export const wishlistPost=video=>video.collections?.some(c=>c.trim().toLowerCase()==='shit i want to buy');
export function productDetails(raw){const text=value=>typeof value==='string'?value.trim().slice(0,300):'';return {name:text(raw?.name)||'Product not identified',brand:text(raw?.brand),model:text(raw?.model),mentionedPrice:text(raw?.mentionedPrice)};}
export function evidencedProduct(raw,evidence){const product=productDetails(raw),normalize=value=>String(value).normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim(),source=normalize(evidence);for(const key of ['name','brand','model','mentionedPrice'])if(product[key]&&!source.includes(normalize(product[key])))product[key]=key==='name'?'Product not identified':'';return product;}
const DAY=86400000;
// The Wishlist can (1) track a store link the owner confirmed, and (2) search for
// shopping matches through Serper, then track only the matches the owner picks.
// Searching costs money, so it always needs a confirmed cost preview first.
export class Wishlist{
 constructor({store,checkPrice=checkStorePrice,search=serperSearch,apiKey='',fetcher=fetch,now=Date.now,isBusy=()=>false,wait=delay}){
  Object.assign(this,{store,checkPrice,search,apiKey,fetcher,now,isBusy,wait});
  this.running=false;
  this.previews=new Map();
  store.db.exec(`CREATE TABLE IF NOT EXISTS wishlist_links(video_id TEXT PRIMARY KEY REFERENCES videos(id),url TEXT NOT NULL,target REAL,currency TEXT NOT NULL,status TEXT NOT NULL,reason TEXT,last_check INTEGER,next_check INTEGER);
   CREATE TABLE IF NOT EXISTS wishlist_prices(id INTEGER PRIMARY KEY,video_id TEXT NOT NULL,url TEXT NOT NULL,amount REAL NOT NULL,currency TEXT NOT NULL,at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS wishlist_matches(id INTEGER PRIMARY KEY,video_id TEXT NOT NULL,title TEXT,store TEXT,url TEXT NOT NULL,price REAL,currency TEXT,price_text TEXT,image_url TEXT,can_check INTEGER NOT NULL DEFAULT 1,reason TEXT,searched_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS wishlist_tracked(id INTEGER PRIMARY KEY,video_id TEXT NOT NULL,url TEXT NOT NULL,store TEXT,title TEXT,currency TEXT NOT NULL,status TEXT NOT NULL,reason TEXT,last_check INTEGER,next_check INTEGER,created_at INTEGER NOT NULL,UNIQUE(video_id,url));
   CREATE TABLE IF NOT EXISTS wishlist_drops(id INTEGER PRIMARY KEY,video_id TEXT NOT NULL,url TEXT NOT NULL,store TEXT,old_amount REAL NOT NULL,new_amount REAL NOT NULL,currency TEXT NOT NULL,at INTEGER NOT NULL,dismissed INTEGER NOT NULL DEFAULT 0);`);
 }
 lowestFor(videoId,urls){if(!urls.length)return null;const rows=this.store.db.prepare('SELECT url,amount,currency FROM wishlist_prices WHERE video_id=?').all(videoId).filter(row=>urls.includes(row.url));if(!rows.length)return null;const best=rows.reduce((a,b)=>b.amount<a.amount?b:a);const tracked=this.store.db.prepare('SELECT store FROM wishlist_tracked WHERE video_id=? AND url=?').get(videoId,best.url);return {amount:best.amount,currency:best.currency,url:best.url,store:tracked?.store||new URL(best.url).hostname};}
 drops(){const rows=this.store.db.prepare('SELECT * FROM wishlist_drops WHERE dismissed=0 ORDER BY at DESC LIMIT 20').all();return {count:rows.length,items:rows.map(row=>{const video=this.store.get(row.video_id);return {videoId:row.video_id,title:video?.result?.title||video?.title||'Wishlist item',store:row.store,url:row.url,oldAmount:row.old_amount,newAmount:row.new_amount,currency:row.currency,at:row.at};})};}
 list(){
  const videos=this.store.list().filter(wishlistPost),drops=this.drops();
  return {estimatedDailyUSD:0,running:this.running,drops,items:videos.map(video=>{
   const tracking=this.store.db.prepare('SELECT * FROM wishlist_links WHERE video_id=?').get(video.id);
   const history=tracking?this.store.db.prepare('SELECT amount,currency,at FROM wishlist_prices WHERE video_id=? AND url=? ORDER BY id DESC LIMIT 90').all(video.id,tracking.url):[];
   const current=history[0]||null;
   const low=tracking?this.store.db.prepare('SELECT MIN(amount) AS amount FROM wishlist_prices WHERE video_id=? AND url=? AND currency=?').get(video.id,tracking.url,current?.currency||tracking.currency)?.amount:null;
   const matches=this.store.db.prepare('SELECT * FROM wishlist_matches WHERE video_id=? ORDER BY id').all(video.id).map(row=>({title:row.title,store:row.store,url:row.url,price:row.price,currency:row.currency,priceText:row.price_text,imageUrl:row.image_url,canCheck:Boolean(row.can_check),reason:row.reason}));
   const tracked=this.store.db.prepare('SELECT * FROM wishlist_tracked WHERE video_id=? ORDER BY id').all(video.id).map(row=>{const points=this.store.db.prepare('SELECT amount,currency,at FROM wishlist_prices WHERE video_id=? AND url=? ORDER BY id DESC LIMIT 1').all(video.id,row.url);const latest=points[0]||null;return {url:row.url,store:row.store,title:row.title,currency:row.currency,status:row.status,reason:row.reason,lastCheck:row.last_check,current:latest};});
   const lowest=this.lowestFor(video.id,[...(tracking?[tracking.url]:[]),...tracked.map(row=>row.url)]);
   return {videoId:video.id,title:video.result?.title||video.title,sourceUrl:video.url,product:productDetails(video.result?.product),analyzed:Boolean(video.result?.summary),matches,tracked,lowest,tracking:tracking?{...tracking,current,lowest:low,history,priceDropped:current&&tracking.target!==null&&current.currency===tracking.currency&&current.amount<=tracking.target}:null};
  })};
 }
 // Step 1 of a paid search: describe the cost and hold a short-lived token.
 prepareFind(id){const video=this.store.get(id);if(!wishlistPost(video||{}))throw Error('Choose a post from the wishlist collection.');const query=shoppingQuery({title:video.result?.title||video.title,product:productDetails(video.result?.product)});if(query.length<2)throw Error('This item has no product name to search for yet.');if(!this.apiKey)throw Error('SERPER_API_KEY is not configured on the server');const token=randomUUID();this.previews.set(token,{id,query,at:Date.now()});return {token,query,estimatedUSD:SERPER_COST_USD,note:'One Google Shopping search. Nothing is tracked until you pick a match.'};}
 // Step 2: the owner confirmed the cost, so run exactly one shopping search.
 async find({token,confirmed}){const preview=this.previews.get(token);if(confirmed!==true||!preview||this.now()-preview.at>600000)throw Error('Review the cost and confirm first.');if(this.running)throw Error('Wait for the current price check to finish.');this.previews.delete(token);this.running=true;try{const matches=await this.search({kind:'shopping',query:preview.query,apiKey:this.apiKey,fetcher:this.fetcher,limit:SHOPPING_RESULT_LIMIT});const stamp=this.now();this.store.db.prepare('DELETE FROM wishlist_matches WHERE video_id=?').run(preview.id);const insert=this.store.db.prepare('INSERT INTO wishlist_matches(video_id,title,store,url,price,currency,price_text,image_url,can_check,reason,searched_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)');for(const match of matches)insert.run(preview.id,match.title,match.store,match.link,match.price,match.currency,match.priceText,match.imageUrl,Number(match.canCheck),match.reason,stamp);this.store.logCheck('wishlist-search',{videoId:preview.id,matches:matches.length,estimatedUSD:SERPER_COST_USD},stamp);return {matches,estimatedUSD:SERPER_COST_USD,message:matches.length?'Choose Track on the matches you want.':'No shopping matches were found.'};}finally{this.running=false;}}
 // Tracking is free and only applies to a match that was just shown for this item.
 track({videoId,url,store,title,currency}){const video=this.store.get(videoId);if(!wishlistPost(video||{}))throw Error('Choose a post from the wishlist collection.');const link=storeUrl(url).href;const match=this.store.db.prepare('SELECT * FROM wishlist_matches WHERE video_id=? AND url=?').get(videoId,link);if(!match)throw Error('Pick a store from the search results first.');const code=typeof currency==='string'&&/^[A-Za-z]{3}$/.test(currency)?currency.toUpperCase():(match.currency||'USD');const existing=this.store.db.prepare('SELECT 1 FROM wishlist_tracked WHERE video_id=? AND url=?').get(videoId,link);if(!existing)this.store.db.prepare('INSERT INTO wishlist_tracked(video_id,url,store,title,currency,status,reason,last_check,next_check,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(videoId,link,String(store||match.store||'').slice(0,120),String(title||match.title||'').slice(0,300),code,'waiting',null,null,this.now(),this.now());return {message:existing?'Already tracked.':'Tracked. Its price is checked at most once a day.',estimatedUSD:0};}
 dismissDrops(){this.store.db.prepare('UPDATE wishlist_drops SET dismissed=1 WHERE dismissed=0').run();return {count:0};}
 // Only pictures that came from a saved shopping match may be fetched for the page.
 imageAllowed(url){return Boolean(this.store.db.prepare('SELECT 1 FROM wishlist_matches WHERE image_url=? LIMIT 1').get(String(url||'')));}
 async tick(){
  if(this.running||this.isBusy())return;this.running=true;
  try{
   // Older confirmed links keep their original behaviour and wording.
   const due=this.store.db.prepare("SELECT * FROM wishlist_links WHERE status!='blocked' AND next_check<=? ORDER BY next_check LIMIT 100").all(this.now());
   for(const item of due){
    if(this.isBusy())break;
    const stamp=this.now();this.store.db.prepare('UPDATE wishlist_links SET next_check=? WHERE video_id=?').run(stamp+DAY,item.video_id);
    let status='tracking',reason=null;
    try{
     const host=new URL(item.url).hostname;
     if(this.store.setting('wishlist-blocked-hosts',[]).includes(host))throw Object.assign(Error("Can't track this store"),{blocked:true});
     const price=await this.checkPrice(item.url);
     this.recordPrice(item.video_id,item.url,price,stamp);
    }catch(error){
     if(error.blocked){const blocked=this.store.setting('wishlist-blocked-hosts',[]);this.store.setSetting('wishlist-blocked-hosts',[...new Set([...blocked,new URL(item.url).hostname])]);}
     status=error.blocked?'blocked':'unavailable';
     reason=error.blocked?"Can't track this store":['No clear product price was found.','Multiple prices found; choose a link for one exact product variant.','Store did not return the product page. Confirm its direct link.','Store did not return a readable product page.'].includes(error.message)?error.message:'Price check unavailable. No price was guessed.';
    }
    this.store.db.prepare('UPDATE wishlist_links SET status=?,reason=?,last_check=? WHERE video_id=?').run(status,reason,stamp,item.video_id);
    this.store.logCheck('wishlist',{videoId:item.video_id,status,reason,estimatedUSD:0},stamp);
    if(due.length>1)await this.wait(2000);
   }
   // New: tracked shopping matches are checked at most once a day as well.
   const trackedDue=this.store.db.prepare("SELECT * FROM wishlist_tracked WHERE status!='blocked' AND next_check<=? ORDER BY next_check LIMIT 100").all(this.now());
   for(const item of trackedDue){
    if(this.isBusy())break;
    const stamp=this.now();this.store.db.prepare('UPDATE wishlist_tracked SET next_check=? WHERE id=?').run(stamp+DAY,item.id);
    let status='tracking',reason=null;
    try{
     const host=new URL(item.url).hostname;
     if(this.store.setting('wishlist-blocked-hosts',[]).includes(host))throw Object.assign(Error("Can't check this store"),{blocked:true});
     const price=await this.checkPrice(item.url);
     this.recordPrice(item.video_id,item.url,price,stamp,item.store,true);
    }catch(error){
     if(error.blocked){const blocked=this.store.setting('wishlist-blocked-hosts',[]);this.store.setSetting('wishlist-blocked-hosts',[...new Set([...blocked,new URL(item.url).hostname])]);}
     status=error.blocked?'blocked':'unavailable';
     reason=error.blocked?"Can't check this store":['No clear product price was found.','Multiple prices found; choose a link for one exact product variant.','Store did not return the product page. Confirm its direct link.','Store did not return a readable product page.'].includes(error.message)?error.message:'Price check unavailable. No price was guessed.';
    }
    this.store.db.prepare('UPDATE wishlist_tracked SET status=?,reason=?,last_check=? WHERE id=?').run(status,reason,stamp,item.id);
    this.store.logCheck('wishlist',{videoId:item.video_id,url:item.url,status,reason,estimatedUSD:0},stamp);
    if(trackedDue.length>1)await this.wait(2000);
   }
  }finally{this.running=false;}
 }
 // Save a price and remember a real drop (new price strictly lower than the last one).
 recordPrice(videoId,url,price,stamp,store='',rememberDrop=true){
  const previous=this.store.db.prepare('SELECT amount,currency FROM wishlist_prices WHERE video_id=? AND url=? ORDER BY id DESC LIMIT 1').get(videoId,url);
  this.store.db.prepare('INSERT INTO wishlist_prices(video_id,url,amount,currency,at) VALUES(?,?,?,?,?)').run(videoId,url,price.amount,price.currency,stamp);
  if(rememberDrop&&previous&&previous.currency===price.currency&&price.amount<previous.amount)this.store.db.prepare('INSERT INTO wishlist_drops(video_id,url,store,old_amount,new_amount,currency,at,dismissed) VALUES(?,?,?,?,?,?,?,0)').run(videoId,url,store||'',previous.amount,price.amount,price.currency,stamp);
 }
 confirm({id,url,target,currency,confirmed}){if(confirmed!==true)throw Error('Confirm the store link before tracking.');if(!wishlistPost(this.store.get(id)||{}))throw Error('Choose a post from the wishlist collection.');const link=storeUrl(url).href;currency=typeof currency==='string'?currency.trim().toUpperCase():'';if(!/^[A-Z]{3}$/.test(currency))throw Error('Enter a three-letter currency, such as USD.');const amount=target===''||target===null||target===undefined?null:Number(target);if(amount!==null&&(!Number.isFinite(amount)||amount<0||amount>1e9))throw Error('Enter a valid target price or leave it empty.');const old=this.store.db.prepare('SELECT * FROM wishlist_links WHERE video_id=?').get(id);this.store.db.prepare('INSERT OR REPLACE INTO wishlist_links VALUES(?,?,?,?,?,?,?,?)').run(id,link,amount,currency,old?.url===link?old.status:'waiting',old?.url===link?old.reason:null,old?.url===link?old.last_check:null,old?.url===link?old.next_check:this.now());return {message:'Store link confirmed. Checks use no paid API.'};}
}
