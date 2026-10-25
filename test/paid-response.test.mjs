import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {createDeepSeekResearch} from '../src/deepseek.mjs';
import {recordUsage} from '../src/deepseek-usage.mjs';
import {LibraryStore} from '../src/store.mjs';
import {failedReason} from '../public/result-view.mjs';
test('unusable paid response is archived privately with measured usage before validation fails',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'paid-response-'));const file=path.join(dir,'usage.jsonl');try{
 const analyze=createDeepSeekResearch({approved:true,apiKey:'never-save-this-key',onUsage:r=>recordUsage(file,r),fetcher:async()=>Response.json({usage:{prompt_tokens:12,completion_tokens:3},choices:[{message:{content:'unusable response'}}]})});
 await assert.rejects(analyze({job:{id:'broken'}}),/invalid research/);
 const ledger=JSON.parse(await readFile(file,'utf8'));assert.equal(ledger.usage.totalTokens,15);assert.equal(ledger.responseContent,undefined);
 const archive=await readFile(file+'.responses.jsonl','utf8');assert.equal(JSON.parse(archive).responseContent,'unusable response');assert.ok(!archive.includes('never-save-this-key'));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('missing recipe retains usable paid summary instead of discarding it',async()=>{
 const analyze=createDeepSeekResearch({approved:true,apiKey:'stand-in',fetcher:async()=>Response.json({usage:{prompt_tokens:1,completion_tokens:1},choices:[{message:{content:JSON.stringify({summary:'Only the ingredients are mentioned.',recommendations:[]})}}]})});
 const result=await analyze({job:{collections:['food']}});assert.equal(result.provenance.provider,'deepseek');assert.match(result.validationWarnings[0],/recipe/);assert.equal(result.summary,'Only the ingredients are mentioned.');
});
test('failed analysis preserves extraction and shows a plain reason rather than Ready for analysis',()=>{
 const store=new LibraryStore(':memory:');try{store.import([{shortcode:'broken',url:'https://www.instagram.com/p/broken/',title:'Broken',collections:['Tech']}]);store.claim();
 store.finish('broken',{status:'failed',result:{summary:null,transcript:'Saved speech',ocr:[{text:'Saved screen'}],analysisFailure:'The analysis returned no usable summary. Your saved text is safe.'}});
 const saved=store.get('broken');assert.equal(saved.status,'failed');assert.equal(saved.error,'ANALYSIS_FAILED');assert.equal(saved.result.transcript,'Saved speech');assert.match(failedReason(saved),/no usable summary/);assert.equal(store.claim(),undefined);
 }finally{store.close();}
});
