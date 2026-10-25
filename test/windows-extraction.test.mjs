import test from 'node:test';
import assert from 'node:assert/strict';
import {createWindowsExtraction} from '../src/windows-extraction.mjs';
test('Windows extraction passes local inputs as separate arguments and retains text only',async()=>{
 const calls=[];const extract=createWindowsExtraction({run:async(binary,args)=>{calls.push(args);return {stdout:JSON.stringify({text:args.includes('speech')?'known speech':'KNOWN OCR'})};}});
 const result=await extract({audioPath:'C:/scratch/audio.wav',frames:[{path:'C:/scratch/frame.jpg',timeSeconds:1}]});
 assert.equal(result.transcript,'known speech');assert.equal(result.ocr[0].text,'KNOWN OCR');assert.equal(calls.length,2);assert.ok(calls.every(x=>x.includes('-NoProfile')));
});
test('missing native capabilities produce explicit partial output',async()=>{
 const result=await createWindowsExtraction({run:async()=>{throw Error('missing');}})({audioPath:'a',frames:[{path:'b'}]});
 assert.equal(result.transcript,null);assert.equal(result.warnings.length,2);
});

test('an unreadable sampled frame does not discard later OCR evidence',async()=>{
 let calls=0;
 const extract=createWindowsExtraction({run:async()=>{calls++;if(calls===1)throw Error('Unreadable first frame');return {stdout:'{"text":"LATER FRAME TEXT"}'};}});
 const result=await extract({frames:[{path:'first.jpg',timeSeconds:1},{path:'second.jpg',timeSeconds:2}]});
 assert.equal(calls,2);assert.deepEqual(result.ocr,[{text:'LATER FRAME TEXT',timeSeconds:2}]);assert.equal(result.warnings.length,1);
});
