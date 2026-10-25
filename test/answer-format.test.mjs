import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAnswers,validBullet} from '../public/answer-format.mjs';
import {answerSections,resultAnswers} from '../public/result-view.mjs';
const sample=()=>Object.fromEntries(['what','why','next'].map(key=>[key,{bullets:['The video describes a possible tool to try.','Its benefits have not been checked yet.'],explanation:`The longer ${key} explanation stays available in full.`}]));
test('direct model bullets and all longer explanations survive unchanged',()=>{
 const answers=sample();answers.what.bullets.push('Read its source before deciding.');
 assert.deepEqual(normalizeAnswers(answers),answers);assert.deepEqual(answerSections({result:{answers}}),answers);
 assert.deepEqual(resultAnswers({result:{answers}}),Object.fromEntries(Object.entries(answers).map(([key,value])=>[key,value.explanation])));
});
test('bullet limits reject paragraphs, 15 words, multiple sentences and common jargon',()=>{
 assert.equal(validBullet(Array(14).fill('word').join(' ')),true);assert.equal(validBullet(Array(15).fill('word').join(' ')),false);
 for(const value of ['First sentence. Second sentence.','Use the API pipeline.','First line\nSecond line',''])assert.equal(validBullet(value),false);
 for(const count of [1,4]){const value=sample();value.what.bullets=Array(count).fill('One short sentence.');assert.equal(normalizeAnswers(value),undefined);}
 const missing=sample();delete missing.next.explanation;assert.equal(normalizeAnswers(missing),undefined);
});
test('older saved records keep their full paragraphs without inventing model-written bullets',()=>{
 const video={result:{summary:'An earlier saved explanation.',recommendations:[]}};
 const original=JSON.stringify(video);const displayed=answerSections(video);
 assert.ok(normalizeAnswers(displayed));assert.equal(JSON.stringify(video),original);assert.equal(displayed.what.explanation,'An earlier saved explanation.');
 for(const value of Object.values(displayed)){assert.equal(value.bullets.length,2);assert.ok(value.bullets.every(validBullet));}
});
