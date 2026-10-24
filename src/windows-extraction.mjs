import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import {existsSync} from 'node:fs';
import {transcribeWhisper,WHISPER_BINARY,WHISPER_MODEL} from './whisper.mjs';
const execute=promisify(execFile);
const script=fileURLToPath(new URL('../scripts/windows-extract.ps1',import.meta.url));
export function createWindowsExtraction({run=execute,whisper=run===execute&&existsSync(WHISPER_BINARY)&&existsSync(WHISPER_MODEL)?transcribeWhisper:undefined}={}){
  const extract=async(mode,input,signal)=>{
    const {stdout}=await run('powershell.exe',['-NoProfile','-NonInteractive','-File',script,'-Mode',mode,'-InputPath',input],{windowsHide:true,timeout:60000,maxBuffer:512000,signal});
    return JSON.parse(stdout.trim().replace(/^\uFEFF/,''));
  };
  return async({audioPath,frames,signal})=>{
    let transcript=null;const ocr=[],warnings=[];
    if(audioPath && whisper)try{transcript=await whisper(audioPath,{signal});}catch{if(signal?.aborted)throw signal.reason;warnings.push('Whisper failed; trying installed Windows speech recognition.');}
    if(audioPath && !transcript)try{transcript=(await extract('speech',audioPath,signal)).text||null;}catch{warnings.push('Installed Windows speech recognition was unavailable or failed.');}
    for(const frame of frames.slice(0,6))try{const value=await extract('ocr',frame.path,signal);if(value.text)ocr.push({text:value.text,timeSeconds:frame.timeSeconds});}catch{warnings.push('Windows OCR failed for a sampled frame.');break;}
    return {transcript,ocr,warnings};
  };
}
