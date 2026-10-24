import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createDeepSeekResearch,DEEPSEEK_ENDPOINT,estimateDeepSeekCost} from '../src/deepseek.mjs';
test('DeepSeek uses official address, text only, normalized unverified output and measured costs',async()=>{
 let requestBody,authorization;const server=createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;requestBody=JSON.parse(body);authorization=req.headers.authorization;res.setHeader('content-type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({summary:'Test summary',claims:[{claim:'A claim',status:'VERIFIED',sources:['fake']}],recommendations:[]})}}],usage:{prompt_tokens:1000,completion_tokens:100,prompt_cache_hit_tokens:200}}));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const records=[];
 try{const research=createDeepSeekResearch({apiKey:'test-only-key',approved:true,onUsage:async x=>records.push(x),fetcher:async(url,options)=>{assert.equal(url,DEEPSEEK_ENDPOINT);assert.equal(options.redirect,'error');return fetch(`http://127.0.0.1:${server.address().port}/chat/completions`,options);}});
 const result=await research({job:{id:'test',url:'https://www.instagram.com/p/Test/',collections:['Tech']},transcript:'Transcript',ocr:[{text:'On screen'}],frames:[{path:'never-read.jpg'}]});
 assert.equal(authorization,'Bearer test-only-key');assert.ok(requestBody.messages.every(x=>typeof x.content==='string'));const sent=JSON.stringify(requestBody);assert.match(sent,/Transcript/);assert.match(sent,/On screen/);assert.match(sent,/Pennywise/);assert.ok(!sent.includes('never-read')&&!sent.includes('image_url')&&!sent.includes('test-only-key'));
 assert.equal(result.claims[0].status,'NOT VERIFIED');assert.deepEqual(result.claims[0].sources,[]);assert.deepEqual(result.visualFindings,[]);assert.equal(records.length,1);assert.equal(result.usage.totalTokens,1100);assert.ok(Math.abs(result.usage.estimatedUSD-0.0003612)<1e-12);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test('no network call before owner approval or without a key',async()=>{
 let calls=0;const fetcher=async()=>{calls++;};await assert.rejects(createDeepSeekResearch({apiKey:'key',fetcher})({job:{}}),/approval/);await assert.rejects(createDeepSeekResearch({approved:true,fetcher})({job:{}}),/key/);assert.equal(calls,0);
});
test('errors do not echo credentials, response bodies, or redirect targets',async()=>{
 const research=createDeepSeekResearch({apiKey:'private-test-key',approved:true,fetcher:async()=>new Response('private-test-key',{status:302,headers:{location:'https://evil.example'}})});
 await assert.rejects(research({job:{}}),e=>!e.message.includes('private-test-key')&&!e.message.includes('evil.example'));
});
test('usage is recorded even if paid output cannot be normalized',async()=>{
 const records=[];const research=createDeepSeekResearch({approved:true,apiKey:'test',onUsage:async r=>records.push(r),fetcher:async()=>Response.json({usage:{prompt_tokens:2,completion_tokens:3},choices:[{message:{content:'not json'}}]})});
 await assert.rejects(research({job:{}}),/invalid research/);assert.equal(records.length,1);assert.equal(records[0].usage.totalTokens,5);assert.equal(estimateDeepSeekCost({prompt_tokens:-1,completion_tokens:1}),null);
});
