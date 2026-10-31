import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDeepSeekResearch,buildVisionPayload} from '../src/deepseek.mjs';

const answers={what:{bullets:['A jab is shown.'],explanation:'A short jab explanation.'},why:{bullets:['It controls distance.'],explanation:'Why the jab matters.'},next:{bullets:['Practice slowly.'],explanation:'How to practice.'}};

test('vision payload sends sampled frames and warns against invented moves',()=>{
 const payload=buildVisionPayload({job:{url:'https://www.instagram.com/p/Test/',collections:[]},transcript:null,ocr:[],images:[{url:'data:image/jpeg;base64,ZmFrZQ==',timeSeconds:1.5}]});
 assert.equal(payload.model,'deepseek-flash');
 assert.ok(Array.isArray(payload.messages[1].content));
 assert.ok(payload.messages[1].content.some(block=>block.type==='image_url'&&block.image_url.url.startsWith('data:image/jpeg;base64,')));
 assert.match(payload.messages[0].content,/Never invent/);
});

test('a silent video with frames is analyzed by vision instead of skipped',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'vision-frame-'));
 try{
  const framePath=join(dir,'frame.jpg');await writeFile(framePath,Buffer.from('fakejpeg'));
  let body,calls=0;
  const research=createDeepSeekResearch({approved:true,apiKey:'k',fetcher:async(url,opts)=>{calls++;body=JSON.parse(opts.body);return Response.json({usage:{prompt_tokens:10,completion_tokens:10},choices:[{message:{content:JSON.stringify({summary:'Visible striking technique',visualFindings:['A jab'],answers,claims:[],recommendations:[]})}}]})}});
  const result=await research({job:{id:'Test',url:'https://www.instagram.com/p/Test/',collections:[]},transcript:null,ocr:[],frames:[{path:framePath,timeSeconds:1.5}]});
  assert.equal(calls,1);
  assert.ok(Array.isArray(body.messages[1].content));
  assert.ok(body.messages[1].content.some(b=>b.type==='image_url'));
  assert.equal(result.summary,'Visible striking technique');
  assert.match(result.limitations[0],/Frame-based analysis/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('a silent video with no frames is still skipped without a paid call',async()=>{
 let calls=0;
 const research=createDeepSeekResearch({approved:true,apiKey:'k',fetcher:async()=>{calls++;}});
 const result=await research({job:{id:'Test',url:'https://www.instagram.com/p/Test/',collections:[]},transcript:null,ocr:[]});
 assert.equal(calls,0);
 assert.equal(result.skipReason,'insufficient_content');
});
