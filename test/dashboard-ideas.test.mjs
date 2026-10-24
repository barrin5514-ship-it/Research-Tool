import test from 'node:test';
import assert from 'node:assert/strict';
import {shortSummary,collectNewIdeas} from '../public/result-view.mjs';
import {normalizeResearch,PROJECT_CONTEXT} from '../src/research.mjs';
import {createEvidenceResearch} from '../src/evidence-research.mjs';
test('short summaries are bounded and unprocessed posts never claim analysis',()=>{
 assert.match(shortSummary({status:'pending'}),/not been processed/);
 assert.ok(shortSummary({result:{summary:'A useful idea. '.repeat(100)}}).length<=260);
 assert.equal(shortSummary({result:{summary:'Short summary.'}}),'Short summary.');
});
test('unmatched useful recommendations stay New ideas, while Dev Squad AI remains an explicit project',()=>{
 const result=normalizeResearch({summary:'Test',recommendations:[{project:'Other',application:'An accessibility experiment'},{project:'Dev Squad AI',application:'Compare code review workflows'}]},{job:{title:'Test'}});
 assert.equal(result.recommendations[0].project,'New ideas');assert.equal(result.recommendations[1].project,'Dev Squad AI');
 const ideas=collectNewIdeas([{id:'test',result}]);assert.equal(ideas.length,1);assert.equal(ideas[0].recommendation.application,'An accessibility experiment');assert.match(PROJECT_CONTEXT['Dev Squad AI'],/Codex builds, Claude reviews/);
});
test('local recommendations match developer workflows without using collection membership as proof',async()=>{
 const research=createEvidenceResearch({retrieve:async claims=>claims});
 const result=await research({job:{collections:['Pennywise']},transcript:'AI coding agents can assist with code review and prompting.'});
 assert.deepEqual(result.recommendations.map(x=>x.project),['Dev Squad AI']);assert.equal(result.verification,'NOT VERIFIED');
 const unmatched=await research({job:{collections:['Personafy']},transcript:'A landscape with trees.'});assert.deepEqual(unmatched.recommendations,[]);
});

test('Sims 4 is an independent recommendation project, with no collection prerequisite',async()=>{
 assert.match(PROJECT_CONTEXT['Sims 4 Upgrades'],/every video/);
 assert.match(PROJECT_CONTEXT['Sims 4 Upgrades'],/concrete Sims 4 application/);
 const result=normalizeResearch({summary:'A proposed application',recommendations:[{project:'Sims 4 Upgrades',application:'Evaluate a texture tool for custom content with license and game compatibility checks.'}]},{job:{collections:['Tech']}});
 assert.equal(result.recommendations[0].project,'Sims 4 Upgrades');assert.deepEqual(collectNewIdeas([{result}]),[]);
 const research=createEvidenceResearch({retrieve:async claims=>claims});
 const explicit=await research({job:{collections:[]},transcript:'The Sims 4 mods can improve gameplay.'});assert.equal(explicit.recommendations[0].project,'Sims 4 Upgrades');
 const crossProject=await research({job:{collections:['Tech']},transcript:'Blender supports 3D modeling and texture creation.'});assert.equal(crossProject.recommendations[0].project,'Sims 4 Upgrades');assert.match(crossProject.recommendations[0].application,/Sims 4 custom content/);
 const generic=await research({job:{collections:[]},transcript:'A generic AI tool can automate things.'});assert.deepEqual(generic.recommendations,[]);
});
