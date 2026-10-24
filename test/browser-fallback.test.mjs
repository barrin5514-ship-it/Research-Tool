import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createBrowserFallback} from '../src/browser-fallback.mjs';
import {processVideo} from '../src/processor.mjs';
async function setup(t,options={}){
 const root=await mkdtemp(resolve('.processor-test-browser-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const attemptPath=join(root,'attempt');await mkdir(attemptPath);
 const controller=await createBrowserFallback({dataRoot:join(root,'profiles'),browserPath:'stand-in-browser',profileProcesses:async()=>({all:[]}),ytDlp:null,...options});
 return {controller,root,args:{job:{url:'https://www.instagram.com/p/Test123/?tracking=1'},attemptPath,inputPath:join(attemptPath,'input.mp4')}};
}
test('anonymous capture writes only temporary recording, strips tracking, and enforces polite gap',async t=>{
 let calls=0,slept=0;
 const {controller,args}=await setup(t,{now:()=>100000,wait:async ms=>{slept=ms;},capture:{async capture(url,opts){calls++;assert.equal(url,'https://www.instagram.com/p/Test123/');assert.match(opts.profileDir,/attempt[\\/]anonymous-browser$/);assert.equal(opts.want,'video');return {kind:'video',partial:false,bytes:Buffer.from('video')};}}});
 assert.equal((await controller.acquire(args)).method,'browser_recording');assert.equal(await readFile(args.inputPath,'utf8'),'video');
 await rm(args.inputPath);await rm(join(args.attemptPath,'anonymous-browser'),{recursive:true});await controller.acquire(args);assert.equal(calls,2);assert.equal(slept,20000);
});
test('login wall requires owner confirmation; signed profile stays inside Research Agent',async t=>{
 let calls=0;const paths=[];
 const {controller,args,root}=await setup(t,{wait:async()=>{},capture:{async capture(url,opts){paths.push(opts.profileDir);calls++;if(opts.profileDir.includes('anonymous-browser'))throw Object.assign(Error('login'),{signInWall:true});return {kind:'video',partial:false,bytes:Buffer.from('video')};}}});
 await assert.rejects(controller.acquire(args),{code:'INSTAGRAM_LOGIN_REQUIRED'});
 await controller.confirm();await rm(join(args.attemptPath,'anonymous-browser'),{recursive:true});
 assert.equal((await controller.acquire(args)).method,'browser_recording_signed_in');assert.equal(calls,3);assert.equal(paths.at(-1),join(root,'profiles','instagram'));assert.equal((await controller.status()).ownerConfirmed,true);
});
test('partial recordings and images cannot reach analysis',async t=>{
 const {controller,args}=await setup(t,{capture:{async capture(){return {kind:'video',partial:true,bytes:Buffer.from('partial')};}}});
 await assert.rejects(controller.acquire(args),{code:'CAPTURE_INCOMPLETE'});assert.equal((await readdir(args.attemptPath)).includes('input.mp4'),false);
});
test('separate profile refuses external paths and open login windows',async t=>{
 await assert.rejects(createBrowserFallback({dataRoot:resolve('..','Persona Phi','data')}),{code:'UNSAFE_PROFILE'});
 const {controller}=await setup(t,{capture:{},profileProcesses:async()=>({all:[123]})});await assert.rejects(controller.confirm(),{code:'BROWSER_BUSY'});
});
test('capture lock refuses simultaneous processing',async t=>{
 let release;const waiting=new Promise(r=>release=r);
 const {controller,args}=await setup(t,{capture:{async capture(){await waiting;return {kind:'video',partial:false,bytes:Buffer.from('video')};}}});
 const first=controller.acquire(args);await new Promise(r=>setTimeout(r,30));await assert.rejects(controller.acquire(args),{code:'BROWSER_BUSY'});release();await first;
});
test('failed fallback removes its recording and attempt directory',async t=>{
 const {root}=await setup(t,{capture:{}});const scratchRoot=join(root,'scratch');let invoked=0;
 await assert.rejects(processVideo({url:'https://www.instagram.com/p/Test123/'},{scratchRoot,fetcher:async()=>Response.json({status:'error',error:{code:'error.api.fetch.fail'}}),acquireFallback:async()=>{invoked++;throw Object.assign(Error('login'),{code:'INSTAGRAM_LOGIN_REQUIRED'});}}));
 assert.equal(invoked,1);assert.deepEqual(await readdir(scratchRoot),[]);
});

test('installed yt-dlp is tried before browser, with configs and cookie arguments excluded',async t=>{
 let browserCalls=0;
 const {controller,args}=await setup(t,{ytDlp:'stand-in-yt-dlp',runner:async(binary,argv,options)=>{
  assert.equal(binary,'stand-in-yt-dlp');assert.ok(argv.includes('--ignore-config'));assert.ok(argv.includes('--no-playlist'));assert.equal(argv.some(x=>/^--.*(cookies|browser)/i.test(x)),false);assert.equal(options.shell,false);
  await writeFile(join(options.cwd,'download.mp4'),'test video');
 },capture:{async capture(){browserCalls++;throw Error('Must not be called');}}});
 assert.equal((await controller.acquire(args)).method,'yt-dlp');assert.equal(browserCalls,0);
});
