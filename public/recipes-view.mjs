import {thumbnailNode} from './thumbnail-view.mjs';
import {savedRecipes,groceryList,groceryText,GROCERY_GROUPS,loadShopping,saveShopping} from './recipes.mjs';
export function mountRecipes({document,storage,copy,onOpen}){
 const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 const shopping=loadShopping(storage);let fingerprint='',recipes=[];
 const status=document.getElementById('grocery-status');
 function persist(){if(!saveShopping(storage,shopping))status.textContent='Changes last for this visit only; browser storage is unavailable.';}
 function groceries(){const items=groceryList(recipes,shopping.selected),host=document.getElementById('grocery-items');host.replaceChildren();
  document.getElementById('grocery-count').textContent=`${recipes.filter(r=>shopping.selected.has(r.id)).length} recipes selected · ${items.filter(i=>!shopping.checked.has(i.key)).length} items left`;
  if(!items.length)host.append(node('p','Choose recipes with saved ingredients to build your grocery list.'));
  for(const group of GROCERY_GROUPS){const rows=items.filter(i=>i.group===group);if(!rows.length)continue;const section=node('section');section.append(node('h4',group));const list=node('ul');for(const item of rows){const row=node('li'),label=node('label'),box=node('input');box.type='checkbox';box.checked=shopping.checked.has(item.key);box.onchange=()=>{if(box.checked)shopping.checked.add(item.key);else shopping.checked.delete(item.key);row.classList.toggle('grocery-done',box.checked);document.getElementById('grocery-count').textContent=`${recipes.filter(r=>shopping.selected.has(r.id)).length} recipes selected · ${items.filter(i=>!shopping.checked.has(i.key)).length} items left`;persist();};row.classList.toggle('grocery-done',box.checked);label.append(box,node('span',item.label));row.append(label);list.append(row);}section.append(list);host.append(section);}
  const button=document.getElementById('copy-groceries');button.disabled=!items.length;button.onclick=async()=>{try{await copy(groceryText(items,shopping.checked));status.textContent='Grocery list copied.';}catch{status.textContent='Copy is unavailable. Select and copy the list below.';const text=document.createElement('textarea');text.value=groceryText(items,shopping.checked);text.readOnly=true;text.setAttribute('aria-label','Grocery list to copy');host.append(text);text.focus();text.select();}};
 }
 return function render(videos,excluded=[]){const next=savedRecipes(videos,excluded),key=JSON.stringify(next);if(key===fingerprint)return;fingerprint=key;recipes=next;
  const host=document.getElementById('recipe-list');host.replaceChildren();document.getElementById('recipe-count').textContent=`${recipes.length} saved ${recipes.length===1?'recipe':'recipes'}`;
  if(!recipes.length)host.append(node('p','No analyzed food recipes yet. Recipes will appear here when food posts have saved analysis.'));
  for(const source of recipes){const card=node('article');card.className='panel saved-recipe';card.id='recipe-'+encodeURIComponent(source.id);card.append(thumbnailNode(document,source.thumbnailUrl),node('h3',source.title));if(onOpen){const open=node('button','Open recipe');open.className='secondary';open.onclick=()=>onOpen(source);const tag=node('span','Food'),badge=node('span',source.recipe.fullRecipeShown?'Recipe saved':'Recipe incomplete');tag.className='project-tag';badge.className='pill';card.append(tag,badge,open);card.onclick=event=>{if(!event.target.closest('a,button,input,label,details,summary'))onOpen(source);};}const label=node('label'),select=node('input');select.type='checkbox';select.checked=shopping.selected.has(source.id);select.disabled=!source.recipe.ingredients.length;select.onchange=()=>{if(select.checked)shopping.selected.add(source.id);else shopping.selected.delete(source.id);status.textContent='';persist();groceries();};label.append(select,node('span','Add to grocery list'));card.append(label);
   card.append(node('h4','Ingredients'));const ingredients=node('ul');for(const ingredient of source.recipe.ingredients)ingredients.append(node('li',ingredient));card.append(ingredients);if(!source.recipe.ingredients.length)card.append(node('p','No ingredients saved.'));
   card.append(node('h4','Instructions'));const steps=node('ol');for(const step of source.recipe.instructions)steps.append(node('li',step));card.append(steps);if(!source.recipe.instructions.length)card.append(node('p','No steps saved.'));
   if(source.skipReason==='insufficient_content')card.append(node('p',source.classificationReason));
   if(!source.recipe.fullRecipeShown)card.append(node('p','Full recipe not shown'));if(source.missing)card.append(node('p','This older result has no saved recipe details. Nothing has been guessed.'));
   const link=node('a','Original Instagram post');link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';card.append(link);host.append(card);
  }
  groceries();
 };
}
