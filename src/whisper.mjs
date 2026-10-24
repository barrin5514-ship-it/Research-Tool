import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
const runDefault=promisify(execFile);
export const WHISPER_MODEL=fileURLToPath(new URL('../.research-data/tools/whisper/ggml-tiny.en.bin',import.meta.url));
export const WHISPER_BINARY=fileURLToPath(new URL('../.research-data/tools/whisper/v1.8.3/Release/whisper-cli.exe',import.meta.url));
export async function transcribeWhisper(audioPath,{signal,run=runDefault}={}){
 const {stdout}=await run(WHISPER_BINARY,['-m',WHISPER_MODEL,'-f',audioPath,'-t','2','-p','1','-l','en','-ng','-nt','-np'],{signal,timeout:120000,maxBuffer:512000,windowsHide:true});
 return stdout.trim().slice(0,40000);
}
