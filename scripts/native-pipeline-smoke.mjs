import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve,join} from 'node:path';
import {unlink,readdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {processVideo} from '../src/processor.mjs';
import {createWindowsExtraction} from '../src/windows-extraction.mjs';
const run=promisify(execFile),root=resolve('.test-artifacts/native-smoke'),clip=join(root,'clip.mp4'),scratch=join(root,'scratch');
try {
 await run('powershell.exe',['-NoProfile','-NonInteractive','-File','scripts/native-smoke.ps1'],{env:{...process.env,RESEARCH_NATIVE_PIPELINE_TEST:'1'},timeout:60000,windowsHide:true});
 const result=await processVideo({id:'native-fixture',title:'KNOWN SYNTHETIC FIXTURE',url:'https://www.instagram.com/p/NativeFixture/'},{scratchRoot:scratch,fixturePath:clip,nativeExtract:createWindowsExtraction()});
 assert.match(result.result.transcript,/research helps people learn new ideas/i);
 assert.ok(result.result.ocr.some(x=>/RESEARCH LIBRARY 123/.test(x.text)));
 assert.equal(result.status,'needs_analysis');assert.deepEqual(await readdir(scratch),[]);
 console.log(JSON.stringify({test:'LIVE LOCAL SYNTHETIC EXTRACTION',transcript:result.result.transcript,ocrFrames:result.result.ocr.length,cleanup:'passed',status:result.status},null,2));
} finally {await unlink(clip).catch(e=>{if(e.code!=='ENOENT')throw e;});}
