import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isAbsolute, join } from 'node:path';
import { mkdir } from 'node:fs/promises';
const execute = promisify(execFile);

// Deliberate allowlist: never inherit cloud keys, cookies, NODE_OPTIONS or user config.
export function analyzerEnvironment(parent, directory) {
  const env = {};
  for (const key of ['PATH','Path','SystemRoot','WINDIR','COMSPEC','PATHEXT']) if(parent[key])env[key]=parent[key];
  Object.assign(env,{HOME:directory,USERPROFILE:directory,APPDATA:directory,LOCALAPPDATA:directory,TEMP:directory,TMP:directory,MCP_CACHE_DIR:join(directory,'cache'),PYTHONUTF8:'1'});
  return env;
}
export function createAnalyzer({entry,run=execute}={}) {
  if(!entry||!isAbsolute(entry)||!entry.endsWith('.js'))throw Error('Select an installed analyzer dist/index.js using an absolute path');
  return async ({inputPath,attemptPath,signal})=>{
    const directory=join(attemptPath,'analyzer');await mkdir(directory,{recursive:true});
    const {stdout}=await run(process.execPath,[entry,'analyze',inputPath,'--out',join(directory,'frames'),'--max-frames','6','--max-width','640','--ocr-language','eng','--force-refresh'],{cwd:directory,env:analyzerEnvironment(process.env,directory),signal,timeout:120000,maxBuffer:2*1024*1024,windowsHide:true});
    const doc=JSON.parse(stdout);
    const transcript=Array.isArray(doc.transcript)?doc.transcript.map(x=>typeof x?.text==='string'?x.text:'').filter(Boolean).join(' '):typeof doc.transcript==='string'?doc.transcript:typeof doc.transcript?.text==='string'?doc.transcript.text:null;
    return {transcript:transcript?.slice(0,40000)||null,ocr:(Array.isArray(doc.ocrResults)?doc.ocrResults:[]).slice(0,100).map(x=>({text:typeof x.text==='string'?x.text.slice(0,2000):'',confidence:Number(x.confidence)||0})),warnings:(Array.isArray(doc.warnings)?doc.warnings:[]).map(()=> 'Analyzer reported partial extraction; inspect transcript and OCR completeness.'),provider:'mcp-video-analyzer'};
  };
}
