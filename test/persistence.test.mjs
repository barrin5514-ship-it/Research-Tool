import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir,mkdtemp,rm } from 'node:fs/promises';
import { resolve,join,relative,isAbsolute } from 'node:path';
import { LibraryStore } from '../src/store.mjs';

test('SQLite reopening preserves completed results and resumes interrupted work',async()=>{
  const root=resolve('.test-artifacts');await mkdir(root,{recursive:true});const directory=await mkdtemp(join(root,'persistence-'));const file=join(directory,'library.sqlite');let store;
  try{store=new LibraryStore(file);store.import(['aaa','bbb'].map(shortcode=>({shortcode,url:`https://www.instagram.com/p/${shortcode}/`,title:shortcode,collections:['Tech']})));
    const first=store.claim();store.finish(first.id,{status:'completed',result:{summary:'Saved research',provenance:{provider:'fixture'}}});const running=store.claim();store.close();store=undefined;
    store=new LibraryStore(file);assert.equal(store.recover(),1);assert.equal(store.get(first.id).result.summary,'Saved research');assert.equal(store.claim().id,running.id);assert.equal(store.claim(),undefined);
  }finally{if(store)store.close();const child=relative(root,resolve(directory));assert.ok(child&&!child.startsWith('..')&&!isAbsolute(child)&&child.startsWith('persistence-'));await rm(directory,{recursive:true,force:true});}
});
