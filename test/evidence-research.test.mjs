import test from 'node:test';
import assert from 'node:assert/strict';
import {createEvidenceResearch,rankRecommendations} from '../src/evidence-research.mjs';
test('evidence fallback keeps actual excerpts and source links without inventing verification',async()=>{
 const research=createEvidenceResearch({retrieve:async claims=>claims.map(x=>({...x,sources:[{url:'https://www.sqlite.org/about.html'}]}))});
 const result=await research({job:{title:'test',url:'https://www.instagram.com/p/Test/',collections:['Pennywise']},transcript:'SQLite can store research records.',ocr:[]});
 assert.match(result.summary,/SQLite can store research records/);assert.equal(result.claims[0].sources.length,1);assert.equal(result.verification,'NOT VERIFIED');assert.equal(result.provenance.independentVerification,false);assert.equal(result.recommendations[0].project,'Pennywise');assert.equal(result.recommendations[0].rankingBasis.usefulness,'unknown');
});
test('no project match or research is invented when evidence is absent',async()=>{
 const research=createEvidenceResearch({retrieve:async claims=>claims});await assert.rejects(research({job:{},ocr:[]}),/No transcript/);
 const result=await research({job:{},transcript:'A landscape with trees.'});assert.equal(result.recommendations.length,0);assert.equal(result.claims.length,0);
});
test('ranker rewards usefulness and lower cost/risk while penalizing uncertainty',()=>{
 const results=rankRecommendations([{application:'unknown'},{application:'costly',usefulness:'high',costLevel:'high',riskLevel:'high'},{application:'small safe experiment',usefulness:'high',costLevel:'free',riskLevel:'low'}]);
 assert.equal(results[0].application,'small safe experiment');assert.equal(results[0].score,10);assert.equal(results.at(-1).application,'unknown');assert.equal(results.at(-1).priority,'low');
});
