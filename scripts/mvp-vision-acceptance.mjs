import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,writeFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createLocalResearch} from '../src/research.mjs';
const run=promisify(execFile),image=resolve('.test-artifacts/mvp-vision/shapes.png');
await mkdir(resolve('.test-artifacts/mvp-vision'),{recursive:true});
const drawing=`Add-Type -AssemblyName System.Drawing; $image=[Drawing.Bitmap]::new(640,360);$g=[Drawing.Graphics]::FromImage($image);try{$g.Clear([Drawing.Color]::White);$g.FillEllipse([Drawing.Brushes]::Red,60,90,180,180);$g.FillRectangle([Drawing.Brushes]::Blue,380,90,180,180);$image.Save($env:RESEARCH_VISION_FIXTURE,[Drawing.Imaging.ImageFormat]::Png)}finally{$g.Dispose();$image.Dispose()}`;
await run('powershell.exe',['-NoProfile','-NonInteractive','-Command',drawing],{env:{...process.env,RESEARCH_VISION_FIXTURE:image},windowsHide:true,timeout:15000});
const start=Date.now();let report;
try{
 const result=await createLocalResearch({model:'qwen3-vl-2b-instruct'})({job:{title:'Known geometric-shape test',url:'https://www.instagram.com/p/SyntheticVisionFixture/',collections:[]},frames:[{path:image,timeSeconds:0}],transcript:null,ocr:[]});
 const observed=[result.summary,...result.visualFindings].join(' ');
 report={scope:'SYNTHETIC visual-only image, no transcript, written labels or OCR hints',seconds:(Date.now()-start)/1000,redCircle:/red/i.test(observed)&&/circl|circular/i.test(observed),blueSquare:/blue/i.test(observed)&&/square/i.test(observed),inventedProject:/Sims|Pennywise|Personafy|Dev Squad/i.test(observed),structuredFindings:result.visualFindings.length>0,parsed:true,result,paidCalls:0};
 if(!report.redCircle||!report.blueSquare||report.inventedProject||!report.structuredFindings)process.exitCode=1;
}catch(e){report={scope:'SYNTHETIC local vision test',error:e.message,seconds:(Date.now()-start)/1000,paidCalls:0};process.exitCode=1;}
finally{await unlink(image);}
await writeFile('docs/MVP_VISION_ACCEPTANCE.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
