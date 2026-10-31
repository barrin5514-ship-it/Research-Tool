import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createDeepSeekResearch,DEEPSEEK_ENDPOINT,estimateDeepSeekCost} from '../src/deepseek.mjs';
const sampleAnswers=Object.fromEntries(['what','why','next'].map(key=>[key,{bullets:['Check the source before trying this idea.','Start with a small test you can undo.'],explanation:'This is the longer explanation for this section.'}]));
test('DeepSeek uses official address, text only, normalized unverified output and measured costs',async()=>{
 let requestBody,authorization;const server=createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;requestBody=JSON.parse(body);authorization=req.headers.authorization;res.setHeader('content-type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({summary:'Test summary',answers:sampleAnswers,claims:[{claim:'A claim',status:'VERIFIED',sources:['fake']}],recommendations:[]})}}],usage:{prompt_tokens:1000,completion_tokens:100,prompt_cache_hit_tokens:200}}));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const records=[];
 try{const research=createDeepSeekResearch({apiKey:'test-only-key',approved:true,onUsage:async x=>records.push(x),fetcher:async(url,options)=>{assert.equal(url,DEEPSEEK_ENDPOINT);assert.equal(options.redirect,'error');return fetch(`http://127.0.0.1:${server.address().port}/chat/completions`,options);}});
 const result=await research({job:{id:'test',url:'https://www.instagram.com/p/Test/',collections:['Tech','reference','bjj','Dev Squad AI']},transcript:'Transcript Synthetic source text explains a useful technique with enough content for analysis.',ocr:[{text:'On screen'}],frames:[{path:'never-read.jpg'}]});
 assert.deepEqual(JSON.parse(requestBody.messages[1].content).collections,['Tech']);assert.equal(authorization,'Bearer test-only-key');assert.ok(requestBody.messages.every(x=>typeof x.content==='string'));const sent=JSON.stringify(requestBody);assert.match(sent,/Transcript/);assert.match(sent,/On screen/);assert.match(sent,/Pennywise/);assert.ok(!sent.includes('never-read')&&!sent.includes('image_url')&&!sent.includes('test-only-key'));
 assert.equal(result.claims[0].status,'NOT VERIFIED');assert.deepEqual(result.claims[0].sources,[]);assert.deepEqual(result.visualFindings,[]);assert.equal(records.length,1);assert.equal(result.usage.totalTokens,1100);assert.ok(Math.abs(result.usage.estimatedUSD-0.0003612)<1e-12);
 assert.deepEqual(result.answers,sampleAnswers);assert.match(requestBody.messages[0].content,/2 or 3 short bullets directly/);assert.match(requestBody.messages[0].content,/fewer than 15 words/);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('invalid short bullets preserve paid summary without rewriting or automatic paid retries',async()=>{
 let calls=0,usageRecorded=0;
 const answers=structuredClone(sampleAnswers);answers.what.bullets=['word '.repeat(15).trim(),'Check this first.'];
 const research=createDeepSeekResearch({approved:true,apiKey:'stand-in-key',onUsage:async()=>usageRecorded++,fetcher:async()=>{calls++;return Response.json({usage:{prompt_tokens:10,completion_tokens:10},choices:[{message:{content:JSON.stringify({summary:'A saved description',answers})}}]});}});
 const result=await research({job:{},transcript:'Synthetic source text explains a useful technique with enough content for analysis.'});assert.equal(result.summary,'A saved description');assert.equal(result.answers,undefined);assert.deepEqual(result.savedAnswerDetails,answers);assert.ok(result.validationWarnings.length);assert.equal(calls,1);assert.equal(usageRecorded,1);
});
test('no network call before owner approval or without a key',async()=>{
 let calls=0;const fetcher=async()=>{calls++;};await assert.rejects(createDeepSeekResearch({apiKey:'key',fetcher})({job:{},transcript:'Synthetic source text explains a useful technique with enough content for analysis.'}),/approval/);await assert.rejects(createDeepSeekResearch({approved:true,fetcher})({job:{},transcript:'Synthetic source text explains a useful technique with enough content for analysis.'}),/key/);assert.equal(calls,0);
});
test('errors do not echo credentials, response bodies, or redirect targets',async()=>{
 const research=createDeepSeekResearch({apiKey:'private-test-key',approved:true,fetcher:async()=>new Response('private-test-key',{status:302,headers:{location:'https://evil.example'}})});
 await assert.rejects(research({job:{},transcript:'Synthetic source text explains a useful technique with enough content for analysis.'}),e=>!e.message.includes('private-test-key')&&!e.message.includes('evil.example'));
});
test('usage is recorded even if paid output cannot be normalized, and the malformed answer is retried once',async()=>{
 const records=[];let calls=0;const research=createDeepSeekResearch({approved:true,apiKey:'test',retryOnInvalid:true,onUsage:async r=>records.push(r),fetcher:async()=>{calls++;return Response.json({usage:{prompt_tokens:2,completion_tokens:3},choices:[{message:{content:'not json'}}]})}});
 await assert.rejects(research({job:{},transcript:'Synthetic source text explains a useful technique with enough content for analysis.'}),/invalid research/);assert.equal(calls,2);assert.equal(records.length,2);assert.equal(records[0].usage.totalTokens,5);assert.equal(estimateDeepSeekCost({prompt_tokens:-1,completion_tokens:1}),null);
});
test('one broken answer is retried once and succeeds on the second attempt',async()=>{
 let calls=0;const research=createDeepSeekResearch({approved:true,apiKey:'test',retryOnInvalid:true,fetcher:async()=>{calls++;return Response.json({usage:{prompt_tokens:2,completion_tokens:3},choices:[{message:{content:calls===1?'not json':JSON.stringify({summary:'A saved description after retry',answers:sampleAnswers,claims:[],recommendations:[]})}}]})}});
 const result=await research({job:{},transcript:'Synthetic source text explains a useful technique with enough content for analysis.'});assert.equal(calls,2);assert.equal(result.summary,'A saved description after retry');
});
