import test from 'node:test';import assert from 'node:assert/strict';
import {savedRecipes,parseIngredient,groceryList,groceryText,ingredientGroup,loadShopping,saveShopping} from '../public/recipes.mjs';
const recipe=(id,ingredients,fullRecipeShown=true)=>({id,title:'Sample '+id,url:'https://www.instagram.com/p/'+id+'/',recipe:{ingredients,instructions:['Use only the saved steps.'],fullRecipeShown}});
const video=(id,ingredients)=>({id,title:id,url:'https://www.instagram.com/p/'+id+'/',collections:['food'],result:{summary:'Saved food post',recipe:recipe(id,ingredients).recipe}});
test('recipe view includes saved recipes and analyzed food; never invents missing details',()=>{
 const old={...video('old',[]),collections:[' Food '],result:{summary:'An older food summary'}};
 const fixture=video('fixture',['1 cup rice']);fixture.result.extraction={fixture:true};const excluded=video('excluded',['1 egg']);excluded.collections=['food','reference'];
 const rows=savedRecipes([video('new',['1 cup rice']),old,fixture,excluded,{...old,id:'pending',result:null}],['reference']);assert.deepEqual(rows.map(r=>r.id),['new','old']);assert.deepEqual(rows[0].recipe.ingredients,['1 cup rice']);assert.equal(rows[1].missing,true);assert.deepEqual(rows[1].recipe,{ingredients:[],instructions:[],fullRecipeShown:false});
});
test('matching units add exact amounts; different units, qualifiers and unknown amounts stay separate',()=>{
 const recipes=[recipe('a',['1 cup rice','1/2 cup milk','Salt to taste','1 cup brown rice']),recipe('b',['1 cup rice','2 tbsp rice','½ cup milk','Salt to taste'])];const before=JSON.stringify(recipes);const items=groceryList(recipes,['a','b']);
 assert.ok(items.some(i=>i.label==='2 cups rice'));assert.ok(items.some(i=>i.label==='1 cup milk'));assert.ok(items.some(i=>i.label==='2 tbsp rice'));assert.equal(items.filter(i=>i.label==='Salt to taste').length,2);assert.ok(items.some(i=>i.label==='1 cup brown rice'));assert.equal(JSON.stringify(recipes),before);assert.deepEqual(groceryList(recipes,[]),[]);
});
test('fractions, decimals and unit aliases combine without converting units or inventing amounts',()=>{
 const rows=groceryList([recipe('a',['1½ cups rice','0.5 cup rice','1 tablespoon oil','2 tbsp oil','1 g salt','1 kg salt','2 eggs']),recipe('b',['3 eggs'])],['a','b']);
 for(const line of ['2 cups rice','3 tbsp oil','1 g salt','1 kg salt','5 eggs'])assert.ok(rows.some(i=>i.label===line),line);
 for(const line of ['Rice','Rice (amount not given)','1-2 cups rice','1/0 cup rice','about 1 cup rice','1 scoop rice','1 cup optional rice','0 cups rice','2 cups rice or quinoa'])assert.equal(parseIngredient(line),null,line);
});
test('grouping uses known food words and leaves unknown ingredients in Other',()=>{
 assert.equal(ingredientGroup('2 tomatoes'),'Produce');assert.equal(ingredientGroup('chicken breast'),'Meat');assert.equal(ingredientGroup('milk'),'Dairy');assert.equal(ingredientGroup('coconut milk'),'Pantry');assert.equal(ingredientGroup('bell peppers'),'Produce');assert.equal(ingredientGroup('mystery ingredient'),'Other');
});
test('shopping checks remain stable across source ordering and reset for changed amounts',()=>{
 const a=recipe('a',['1 cup rice']),b=recipe('b',['1 cup rice']);const first=groceryList([a,b],['a','b'])[0],reversed=groceryList([b,a],['b','a'])[0];assert.equal(first.key,reversed.key);assert.notEqual(first.key,groceryList([a],['a'])[0].key);
 assert.equal(groceryText([first],[first.key]),'Pantry\n[x] 2 cups rice');assert.equal(groceryText([first]),'Pantry\n[ ] 2 cups rice');
});
test('shopping selections/checkmarks survive reload; blocked or malformed storage is safe',()=>{
 let data;const storage={getItem:()=>data,setItem:(_k,v)=>{data=v;}};const shopping={selected:new Set(['a']),checked:new Set(['rice'])};assert.equal(saveShopping(storage,shopping),true);assert.deepEqual(loadShopping(storage),shopping);data='{broken';assert.deepEqual([...loadShopping(storage).selected],[]);assert.deepEqual([...loadShopping(undefined).checked],[]);assert.equal(saveShopping(undefined,shopping),false);
});
import {LibraryStore} from '../src/store.mjs';
import {ResearchQueue} from '../src/queue.mjs';
import {createApp} from '../src/server.mjs';
test('Recipes tab and modules are served locally without enabling analysis',async()=>{
 const store=new LibraryStore(':memory:');const queue=new ResearchQueue(store,async()=>{throw Error('No processing allowed');});const server=createApp({store,queue});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 try{const page=await fetch(base).then(r=>r.text());assert.match(page,/href="#recipes"/);assert.match(page,/id="grocery-items"/);for(const file of ['recipes.mjs','recipes-view.mjs']){const response=await fetch(base+'/'+file);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/javascript/);}assert.equal(queue.status().active,0);}finally{await queue.stop();await new Promise(resolve=>server.close(resolve));store.close();}
});
import {mountRecipes} from '../public/recipes-view.mjs';
function fakeDocument(){const ids=new Map();function node(tag){return {tag,children:[],textContent:'',classList:{toggle(){}},append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;},setAttribute(){},focus(){this.focused=true;},select(){this.selected=true;}};}return {createElement:node,getElementById(id){if(!ids.has(id))ids.set(id,node('div'));return ids.get(id);}};}
test('recipe controls build and copy the checked shopping list; fallback exposes copyable text',async()=>{
 const document=fakeDocument(),data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};let copied;
 const render=mountRecipes({document,storage,copy:async text=>{copied=text;}});render([video('a',['1 cup rice']),video('b',['1 cup rice'])]);
 const cards=document.getElementById('recipe-list').children;for(const card of cards){const box=card.children.find(n=>n.tag==='label').children[0];box.checked=true;box.onchange();}
 const pantry=document.getElementById('grocery-items').children.find(n=>n.children[0].textContent==='Pantry');const box=pantry.children[1].children[0].children[0].children[0];box.checked=true;box.onchange();await document.getElementById('copy-groceries').onclick();assert.equal(copied,'Pantry\n[x] 2 cups rice');assert.match(document.getElementById('grocery-count').textContent,/0 items left/);
 const reload=fakeDocument();mountRecipes({document:reload,storage,copy:async()=>{throw Error('blocked');}})([video('a',['1 cup rice']),video('b',['1 cup rice'])]);assert.match(reload.getElementById('grocery-count').textContent,/2 recipes selected · 0 items left/);await reload.getElementById('copy-groceries').onclick();const text=reload.getElementById('grocery-items').children.at(-1);assert.equal(text.tag,'textarea');assert.equal(text.value,'Pantry\n[x] 2 cups rice');assert.equal(text.selected,true);
});
