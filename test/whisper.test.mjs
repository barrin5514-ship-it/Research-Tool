import test from 'node:test';
import assert from 'node:assert/strict';
import {transcribeWhisper} from '../src/whisper.mjs';
import {createWindowsExtraction} from '../src/windows-extraction.mjs';
test('Whisper caps CPU threads and runs without shell or persistent transcript output',async()=>{
 let args,options;const text=await transcribeWhisper('C:/test/audio.wav',{run:async(_bin,a,o)=>{args=a;options=o;return{stdout:' Known sentence. '};}});
 assert.equal(text,'Known sentence.');assert.equal(args[args.indexOf('-t')+1],'2');assert.ok(args.includes('-ng'));assert.equal(options.timeout,120000);assert.equal(options.shell,undefined);assert.ok(!args.includes('-otxt'));
});
test('native extraction prefers Whisper and retains Windows OCR',async()=>{
 let speechCalls=0;const extraction=createWindowsExtraction({whisper:async()=> 'Whisper sentence',run:async(_bin,args)=>{if(args.includes('speech'))speechCalls++;return{stdout:'{"text":"OCR"}'};}});
 const result=await extraction({audioPath:'audio.wav',frames:[{path:'frame.jpg'}]});assert.equal(result.transcript,'Whisper sentence');assert.equal(speechCalls,0);assert.equal(result.ocr[0].text,'OCR');
});
