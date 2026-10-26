import {isTestFixture,collectionExcluded} from './result-view.mjs';
const compare=(a,b)=>a<b?-1:a>b?1:0;
// Preserve the existing newest-first cohort; show it in the queue's oldest-first execution order.
export function nextBatch(videos,{size=10,collection='All',id,excluded=[],now=Date.now()}={}){
 const collections=Array.isArray(collection)?collection:[collection];
 return videos.filter(v=>!isTestFixture(v)&&!collectionExcluded(v,excluded)&&(!id||v.id===id)&&['pending','retry_wait'].includes(v.status)&&(v.available_at||0)<=now&&(collections.includes('All')||collections.some(name=>v.collections.includes(name)||(name==='Unassigned'&&!v.collections.length))))
 .sort((a,b)=>(b.created_at||0)-(a.created_at||0)||compare(a.id,b.id)).slice(0,size).sort((a,b)=>(a.created_at||0)-(b.created_at||0)||compare(a.id,b.id));
}
