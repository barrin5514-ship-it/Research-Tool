import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzerEnvironment,createAnalyzer } from '../src/analyzer-integration.mjs';
import { gatherEvidence } from '../src/fact-check.mjs';
test('analyzer child cannot inherit cloud credentials or runtime injection',()=>{
 const env=analyzerEnvironment({PATH:'tools',OPENAI_API_KEY:'secret',ANTHROPIC_API_KEY:'secret',NODE_OPTIONS:'bad',HTTP_PROXY:'bad'},'scratch');
 assert.equal(env.PATH,'tools');for(const key of ['OPENAI_API_KEY','ANTHROPIC_API_KEY','NODE_OPTIONS','HTTP_PROXY'])assert.equal(env[key],undefined);
 assert.throws(()=>createAnalyzer({entry:'https://example.com/script.js'}));
});
test('evidence retrieval links independent sources without declaring claims verified',async()=>{
 const requests=[];const result=await gatherEvidence([{claim:'SQLite stores data',status:'VERIFIED',sources:[]}],{fetcher:async url=>{requests.push(url);return new Response('<html>SQLite documentation</html>');}});
 assert.deepEqual(requests,['https://www.sqlite.org/about.html']);assert.equal(result[0].status,'NOT VERIFIED');assert.equal(result[0].sources.length,1);assert.match(result[0].sources[0].excerpt,/SQLite/);
});
test('unsupported claims get no fabricated citations; unavailable sources are tolerated',async()=>{
 const result=await gatherEvidence([{claim:'Guaranteed trading profit'},{claim:'Python claim'}],{fetcher:async()=>{throw Error('offline');}});
 assert.ok(result.every(x=>x.status==='NOT VERIFIED'&&x.sources.length===0));
});

 test('upstream transcript segments are preserved by the analyzer adapter',async()=>{
  const fs=await import('node:fs/promises');const path=await import('node:path');
  const root=path.resolve('.test-artifacts');await fs.mkdir(root,{recursive:true});const attempt=await fs.mkdtemp(path.join(root,'analyzer-contract-'));
  try{const analyzer=createAnalyzer({entry:path.resolve('fixture-index.js'),run:async()=>({stdout:JSON.stringify({transcript:[{time:'0',text:'Known first sentence'},{time:'1',text:'Known second sentence'}],ocrResults:[],warnings:[]})})});
   const result=await analyzer({inputPath:path.join(attempt,'input.mp4'),attemptPath:attempt});assert.equal(result.transcript,'Known first sentence Known second sentence');
  }finally{assert.equal(path.dirname(attempt),root);assert.ok(path.basename(attempt).startsWith('analyzer-contract-'));await fs.rm(attempt,{recursive:true,force:true});}
 });
