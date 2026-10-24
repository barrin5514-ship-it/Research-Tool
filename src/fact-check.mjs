// Curated independent documentation, never a model-supplied download URL.
const SOURCES=[{pattern:/python/i,url:'https://docs.python.org/3/',title:'Python documentation'},{pattern:/sqlite/i,url:'https://www.sqlite.org/about.html',title:'SQLite documentation'},{pattern:/node\.?(js)?\b/i,url:'https://nodejs.org/en/about',title:'Node.js documentation'},{pattern:/ffmpeg/i,url:'https://ffmpeg.org/about.html',title:'FFmpeg documentation'}];
export async function gatherEvidence(claims,{fetcher=fetch,signal}={}){
  const results=[];
  for(const claim of claims.slice(0,10)){
    const sources=[];
    for(const source of SOURCES.filter(x=>x.pattern.test(claim.claim)).slice(0,2)){
      try{
        const response=await fetcher(source.url,{redirect:'error',signal:AbortSignal.any([signal||new AbortController().signal,AbortSignal.timeout(8000)])});
        if(!response.ok||!response.body)continue;
        const reader=response.body.getReader();let bytes=0;const chunks=[];
        try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>256000)break;chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
        const text=Buffer.concat(chunks).toString('utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
        if(text)sources.push({url:source.url,title:source.title,retrievedAt:new Date().toISOString(),excerpt:text.slice(0,2000),relationship:'Background source; claim support requires review'});
      }catch{}
    }
    results.push({...claim,status:'NOT VERIFIED',sources});
  }
  return results;
}
