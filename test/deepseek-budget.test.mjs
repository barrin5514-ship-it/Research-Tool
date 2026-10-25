import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {budgetedFetch} from '../src/deepseek-budget.mjs';
import {DEEPSEEK_ENDPOINT} from '../src/deepseek.mjs';
import {LibraryStore} from '../src/store.mjs';
test('paid reservations survive failures and restrict URLs, repeats and total calls',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'research-budget-')),file=join(dir,'budget.json');let calls=0;
 try{await writeFile(file,JSON.stringify({active:true,videos:[1,2,3,4].map(id=>({id,url:`https://www.instagram.com/p/${id}/`})),requests:[]}));
 const request=budgetedFetch(file,async()=>{calls++;throw Error('Stand-in failure');});
 const options=id=>({body:JSON.stringify({model:'deepseek-flash',max_tokens:1200,messages:[{}, {content:JSON.stringify({sourceUrl:`https://www.instagram.com/p/${id}/`})}]})});
 await assert.rejects(request('https://example.com',options(1)));assert.equal(calls,0);
 for(const id of [1,2,3])await assert.rejects(request(DEEPSEEK_ENDPOINT,options(id)),/Stand-in failure/);
 await assert.rejects(request(DEEPSEEK_ENDPOINT,options(1)));await assert.rejects(request(DEEPSEEK_ENDPOINT,options(4)));assert.equal(calls,3);assert.equal(JSON.parse(await readFile(file)).requests.length,3);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('September labels preserve existing records and exclude October overlap',()=>{const store=new LibraryStore(':memory:');try{store.import(['old','both','new','unknown'].map(shortcode=>({shortcode,url:`https://www.instagram.com/p/${shortcode}/`,collections:[]})));store.setExportPresence(new Set(['old','both']),new Set(['both','new']));assert.deepEqual(store.list().filter(v=>v.septemberOnly).map(v=>v.id),['old']);assert.ok(store.list().every(v=>v.status==='pending'&&v.attempts===0));}finally{store.close();}});
