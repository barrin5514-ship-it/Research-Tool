import test from 'node:test';
import assert from 'node:assert/strict';
import {repairExportText,repairTextTree} from '../src/export-text.mjs';
import {parseExport} from '../src/importer.mjs';
import {dashboardVideos} from '../public/result-view.mjs';
test('Latin-1 export bytes repair punctuation and emoji without losing valid Unicode',()=>{
 const correct='Let’s explore together 🌎';const broken=Buffer.from(correct,'utf8').toString('latin1');assert.equal(repairExportText(broken),correct);
 assert.equal(repairExportText('Letâ€™s explore together ðŸŒŽ'),correct);
 for(const value of ['Letâ€™s explore together ðŸŒ','Already correct 🌎','Café','中文','plain ASCII'])assert.equal(repairExportText(value),value);
 assert.equal(repairExportText(repairExportText(broken)),correct);
 const parsed=parseExport(JSON.stringify({saved_saved_media:[{caption:broken,string_map_data:{'Saved on':{href:'https://www.instagram.com/p/Example001/'}}}]}),{filename:'saved_posts.json'});assert.equal(parsed.items[0].title,correct);
 assert.deepEqual(repairTextTree({title:broken,nested:[{text:broken}],number:7}),{title:correct,nested:[{text:correct}],number:7});
});
test('dashboard hides fixtures and their ideas without deleting stored records',()=>{
 const videos=[{id:'real',title:'Real post'},{id:'test',title:'TEST FIXTURE: test'},{id:'nested',result:{title:'TEST FIXTURE: DeepSeek text-only synthetic research'}},{id:'flagged',result:{extraction:{fixture:true}}}];const before=JSON.stringify(videos);assert.deepEqual(dashboardVideos(videos).map(v=>v.id),['real']);assert.equal(JSON.stringify(videos),before);
});

import {mkdtempSync,mkdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {LibraryStore} from '../src/store.mjs';
test('stored text migration backs up first and preserves processing state and IDs',()=>{
 const dir=mkdtempSync(join(tmpdir(),'export-repair-'));mkdirSync(join(dir,'.research-data'));const file=join(dir,'.research-data/library.sqlite');
 try{const store=new LibraryStore(file);const broken=Buffer.from('Let’s explore together 🌎','utf8').toString('latin1');store.import([{shortcode:'Preserve001',url:'https://www.instagram.com/p/Preserve001/',title:broken,collections:['Tech']}]);store.claim();store.finish('Preserve001',{status:'needs_analysis',result:{summary:broken,transcript:'Correct 🌎',provenance:{provider:'deepseek'}}});const before=store.db.prepare('SELECT * FROM videos').get();store.close();
 execFileSync(process.execPath,[resolve('scripts/repair-export-text.mjs')],{cwd:dir,windowsHide:true,stdio:'pipe'});
 const report=JSON.parse(readFileSync(join(dir,'.research-data/text-repair-report.json'),'utf8'));const db=new DatabaseSync(file),backup=new DatabaseSync(report.backup,{readOnly:true});try{const after=db.prepare('SELECT * FROM videos').get();assert.equal(after.title,'Let’s explore together 🌎');assert.equal(JSON.parse(after.result_json).summary,'Let’s explore together 🌎');assert.deepEqual({...after,title:before.title,result_json:before.result_json},{...before});assert.deepEqual({...backup.prepare('SELECT * FROM videos').get()},{...before});assert.equal(report.integrity,'ok');}finally{db.close();backup.close();}
 }finally{rmSync(dir,{recursive:true,force:true});}
});
