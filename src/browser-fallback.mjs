import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile,open,unlink,lstat,readdir,stat} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const run=promisify(execFile),MAX=80*1024*1024;
const upstream='C:/Users/barri/Documents/ChatGPT/Persona Phi/src/media/';
const problem=(code,message)=>Object.assign(new Error(message),{code,retryable:false});

/** Reuse installed capture tooling read-only. Never acquire Personafy's session. */
export async function createBrowserFallback({capture,profileProcesses,browserPath,launch,ytDlp,runner=run,now=Date.now,wait=delay,dataRoot=join(ROOT,'.research-data','browser-profiles')}={}){
  const relative=resolve(dataRoot).slice(ROOT.length);
  if(!resolve(dataRoot).startsWith(ROOT+'\\')&&!resolve(dataRoot).startsWith(ROOT+'/'))throw problem('UNSAFE_PROFILE','Browser profiles must stay inside Research Agent.');
  let cursor=ROOT;
  for(const segment of relative.split(/[\\/]/).filter(Boolean)){
    cursor=join(cursor,segment);await mkdir(cursor).catch(e=>{if(e.code!=='EEXIST')throw e;});
    if((await lstat(cursor)).isSymbolicLink())throw problem('UNSAFE_PROFILE','Browser profile junctions are refused.');
  }
  const profile=join(dataRoot,'instagram'),metaFile=join(dataRoot,'instagram-state.json'),lockFile=join(dataRoot,'capture.lock');
  await mkdir(profile,{recursive:true});
  if((await lstat(profile)).isSymbolicLink())throw problem('UNSAFE_PROFILE','Browser profile junctions are refused.');
  if(!capture){
    const mod=await import(pathToFileURL(upstream+'browser-capture.ts').href);
    const env={ProgramFiles:process.env.ProgramFiles,'ProgramFiles(x86)':process.env['ProgramFiles(x86)'],LOCALAPPDATA:process.env.LOCALAPPDATA};
    browserPath=mod.findSignInBrowser(env);
    capture=browserPath?{capture(url,options){return new mod.ChromeCapturer({browserPath,extraArgs:[`--disk-cache-dir=${options.cacheDir}`,'--disk-cache-size=1','--media-cache-size=1']}).capture(url,options);}}:undefined;
  }
  profileProcesses??=(await import(pathToFileURL(upstream+'devtools-browser.ts').href)).profileProcesses;
  launch??=async()=>{const child=spawn(browserPath,[`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-sync','--new-window','https://www.instagram.com/accounts/login/'],{shell:false,windowsHide:false,detached:true,stdio:'ignore'});await new Promise((ok,no)=>{child.once('spawn',ok);child.once('error',no);});child.unref();};
  if(ytDlp===undefined){ytDlp=process.env.RESEARCH_YTDLP_PATH||null;if(!ytDlp)try{ytDlp=(await run('where.exe',['yt-dlp'],{windowsHide:true})).stdout.trim().split(/\r?\n/)[0]||null;}catch{}}
  const readMeta=async()=>{try{return JSON.parse(await readFile(metaFile,'utf8'));}catch{return {};}};
  const save=async value=>writeFile(metaFile,JSON.stringify(value));
  const windowOpen=async()=>Boolean((await profileProcesses(profile)).all.length);
  async function locked(fn){
    let lock;
    try{lock=await open(lockFile,'wx');}catch(e){if(e.code!=='EEXIST')throw e;const pid=Number(await readFile(lockFile,'utf8'));let gone=false;try{process.kill(pid,0);}catch(err){gone=Number.isInteger(pid)&&pid>0&&err.code==='ESRCH';}if(!gone)throw problem('BROWSER_BUSY','Research Agent browser is busy. Close its sign-in window before processing.');await unlink(lockFile);lock=await open(lockFile,'wx');}
    await lock.writeFile(String(process.pid));try{return await fn();}finally{await lock.close();await unlink(lockFile);}
  }
  return {
    async collectSaved({known,active,collection,limit=30}){return locked(async()=>{if(!browserPath||!(await readMeta()).ownerConfirmed||await windowOpen())throw Error("Close the Research Agent sign-in browser and confirm sign-in first.");const {readSavedPage}=await import("./saved-page.mjs");const {startDevtoolsBrowser}=await import(pathToFileURL(upstream+"devtools-browser.ts").href);return readSavedPage({browserPath,profile,known,active,collection,limit,startBrowser:startDevtoolsBrowser});});},
    async referenceMetadata(url){return locked(async()=>{const source=new URL(url);if(source.protocol!=='https:'||source.username||source.password||source.port||!['instagram.com','www.instagram.com'].includes(source.hostname)||!/^\/(?:p|reels?)\/[A-Za-z0-9_-]+\/?$/.test(source.pathname))throw Error('Only Instagram post links are supported.');if(!browserPath||!(await readMeta()).ownerConfirmed||await windowOpen())throw Error('The Research Agent sign-in browser must be connected and closed.');const {readSavedPage}=await import('./saved-page.mjs');const {startDevtoolsBrowser}=await import(pathToFileURL(upstream+'devtools-browser.ts').href);return readSavedPage({browserPath,profile,postUrl:source.href,startBrowser:startDevtoolsBrowser});});},
    async captureReference(url){return locked(async()=>{if(!capture||!(await readMeta()).ownerConfirmed||await windowOpen())throw Error('The Research Agent sign-in browser must be connected and closed.');const {readSavedPage}=await import('./saved-page.mjs');const {startDevtoolsBrowser}=await import(pathToFileURL(upstream+'devtools-browser.ts').href);return readSavedPage({browserPath,profile,postUrl:url,captureVideo:true,startBrowser:startDevtoolsBrowser});});},
    async status(){return {available:Boolean(capture),ownerConfirmed:Boolean((await readMeta()).ownerConfirmed),windowOpen:await windowOpen(),ytDlpAvailable:Boolean(ytDlp)};},
    async connect(){return locked(async()=>{if(!capture||!browserPath)throw problem('BROWSER_UNAVAILABLE','No supported installed browser was found.');if(!await windowOpen())await launch();return {message:'Sign into Instagram yourself in the Research Agent browser. Close that window, then click “I signed in and closed the browser”.'};});},
    async confirm(){return locked(async()=>{if(await windowOpen())throw problem('BROWSER_BUSY','Close the Research Agent sign-in browser first.');await save({...await readMeta(),ownerConfirmed:true});return {message:'Your confirmation was saved. Session access will be tested during capture.'};});},
    async acquire({job,attemptPath,inputPath,signal}){return locked(async()=>{
      const source=new URL(job.url??job.sourceUrl);
      if(source.protocol!=='https:'||!['www.instagram.com','instagram.com'].includes(source.hostname)||source.port||source.username||source.password||!/^\/(p|reels?|tv)\/[A-Za-z0-9_-]+\/?$/.test(source.pathname))throw problem('INVALID_SOURCE','Only individual Instagram videos are supported.');
      source.search='';source.hash='';
      if(await windowOpen())throw problem('BROWSER_BUSY','Close the Research Agent sign-in browser before capture.');
      let meta=await readMeta();const gap=20_000-(now()-(meta.lastAttempt||0));if(gap>0)await wait(gap,undefined,{signal});
      const day=new Date(now()).toISOString().slice(0,10),count=meta.day===day?(meta.count||0):0;
      if(count>=40)throw problem('CAPTURE_DAILY_LIMIT','Daily capture limit reached; try tomorrow.');
      await save({...meta,day,count:count+1,lastAttempt:now()});
      if(ytDlp){
        try{
          await runner(ytDlp,['--ignore-config','--no-cache-dir','--no-playlist','--no-warnings','--no-part','--no-mtime','--max-filesize',String(MAX),'-f','bv*+ba/b','--merge-output-format','mp4','-o',join(attemptPath,'download.%(ext)s'),'--',source.href],{cwd:attemptPath,windowsHide:true,shell:false,timeout:60_000,maxBuffer:65536,signal});
          const files=(await readdir(attemptPath)).filter(x=>/^download\.(mp4|webm|mkv)$/.test(x));
          if(files.length===1){const file=join(attemptPath,files[0]);const size=(await stat(file)).size;if(size>0&&size<=MAX){await writeFile(inputPath,await readFile(file),{flag:'wx'});return {bytes:size,method:'yt-dlp'};}}
        }catch{signal?.throwIfAborted();}
      }
      if(!capture)throw problem('BROWSER_UNAVAILABLE','Cobalt failed and no supported browser is installed.');
      const anonymous=join(attemptPath,'anonymous-browser');await mkdir(anonymous);
      let media,method='browser_recording';
      try{media=await capture.capture(source.href,{want:'video',maxRecordMs:90_000,signal,cacheDir:join(attemptPath,'playback-cache'),profileDir:anonymous});}
      catch(error){
        signal?.throwIfAborted();
        if(!error.signInWall)throw problem('BROWSER_CAPTURE_FAILED','Anonymous browser capture could not access a playable video. No security checks were bypassed.');
        if(!meta.ownerConfirmed)throw problem('INSTAGRAM_LOGIN_REQUIRED','Connect Instagram using the dashboard, sign in manually, and close its browser.');
        method='browser_recording_signed_in';
        try{media=await capture.capture(source.href,{want:'video',maxRecordMs:90_000,signal,cacheDir:join(attemptPath,'playback-cache'),profileDir:profile});}
        catch{signal?.throwIfAborted();throw problem('SIGNED_IN_CAPTURE_FAILED','The Research Agent sign-in could not access this video. Reconnect Instagram or inspect the post manually.');}
      }
      signal?.throwIfAborted();
      if(media.kind!=='video'||media.partial||!media.bytes?.length||media.bytes.length>MAX)throw problem('CAPTURE_INCOMPLETE','Capture did not return a complete video within the size/time limits.');
      await writeFile(inputPath,media.bytes,{flag:'wx'});
      return {bytes:media.bytes.length,method};
    });}
  };
}

