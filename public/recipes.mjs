import {normalizeRecipe} from './answer-format.mjs';
import {dashboardVideos,collectionExcluded,visualReference} from './result-view.mjs';
export const GROCERY_GROUPS=['Produce','Meat','Dairy','Pantry','Other'];
export function savedRecipes(videos,excluded=[]){return dashboardVideos(videos).filter(v=>!collectionExcluded(v,excluded)&&!visualReference(v)&&v.status!=='skipped').flatMap(video=>{
 const recipe=normalizeRecipe(video.result?.recipe),food=video.collections?.some(name=>name.trim().toLowerCase()==='food');
 if(!recipe&&!(food&&video.result?.summary?.trim()))return [];
 return [{id:video.id,title:video.result?.title||video.title,url:video.url,recipe:recipe||{ingredients:[],instructions:[],fullRecipeShown:false},missing:!recipe}];
});}
const units={cup:['cup','cups'],tbsp:['tbsp','tbsp'],tsp:['tsp','tsp'],g:['g','g'],kg:['kg','kg'],mg:['mg','mg'],ml:['ml','ml'],l:['l','l'],oz:['oz','oz'],lb:['lb','lb'],clove:['clove','cloves'],can:['can','cans']};
const aliases={cups:'cup',tablespoon:'tbsp',tablespoons:'tbsp',teaspoon:'tsp',teaspoons:'tsp',grams:'g',gram:'g',kilogram:'kg',kilograms:'kg',milligram:'mg',milligrams:'mg',milliliter:'ml',milliliters:'ml',litre:'l',litres:'l',liter:'l',liters:'l',ounce:'oz',ounces:'oz',pound:'lb',pounds:'lb',cloves:'clove',cans:'can'};
const fractions={'¼':'1/4','½':'1/2','¾':'3/4','⅓':'1/3','⅔':'2/3','⅛':'1/8','⅜':'3/8','⅝':'5/8','⅞':'7/8'};
const gcd=(a,b)=>b?gcd(b,a%b):a;
function fraction(n,d=1){if(!Number.isSafeInteger(n)||!Number.isSafeInteger(d)||n<=0||d<=0||n>1e9||d>1e6)return null;const f=gcd(n,d);return {n:n/f,d:d/f};}
function quantity(text){const mixed=text.match(/^(\d+)\s+(\d+)\/(\d+)$/);if(mixed)return fraction(+mixed[1]*+mixed[3]+ +mixed[2],+mixed[3]);const ratio=text.match(/^(\d+)\/(\d+)$/);if(ratio)return fraction(+ratio[1],+ratio[2]);const [whole,decimal='']=text.split('.');return fraction(Number(whole+decimal),10**decimal.length);}
function formatQuantity({n,d}){if(d===1)return String(n);const whole=Math.floor(n/d),rest=n%d;return (whole?whole+' ':'')+rest+'/'+d;}
export function ingredientGroup(text){const name=text.toLowerCase();
 if(/\b(?:coconut milk|almond milk|oat milk|peanut butter|cocoa butter|broth|stock)\b/.test(name))return 'Pantry';
 if(/\b(?:chicken|beef|pork|turkey|lamb|bacon|sausage|salmon|tuna|fish|shrimp|prawns)\b/.test(name))return 'Meat';
 if(/\b(?:bell peppers?|green peppers?|red peppers?)\b/.test(name))return 'Produce';
 if(/\b(?:milk|cheese|butter|cream|yogurt|yoghurt|eggs?|mozzarella|parmesan)\b/.test(name))return 'Dairy';
 if(/\b(?:rice|pasta|noodles|flour|sugar|salt|pepper|oil|vinegar|sauce|beans|lentils|oats|spice|cumin|paprika|cinnamon|yeast|honey|baking powder)\b/.test(name))return 'Pantry';
 if(/\b(?:onions?|garlic|tomatoes|tomato|carrots?|potatoes|potato|lemons?|limes?|apples?|bananas?|avocados?|spinach|lettuce|broccoli|cabbage|ginger|cilantro|parsley|basil|cucumbers?|mushrooms?|zucchini|peppers?)\b/.test(name))return 'Produce';
 return 'Other';
}
/** Conservative parser: no inferred amounts, conversions, or fuzzy ingredient matching. */
export function parseIngredient(original){
 const text=original.trim().replace(/(\d)?([¼½¾⅓⅔⅛⅜⅝⅞])/g,(_m,whole,part)=>(whole?whole+' ':'')+fractions[part]);
 const match=text.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d{1,4})?)\s+(.+)$/u);if(!match)return null;
 const amount=quantity(match[1]);if(!amount)return null;
 let name=match[2].trim(),unit='';const first=name.match(/^([a-z]+)\.?\s+(.+)$/i);
 if(first){const key=first[1].toLowerCase();const canonical=aliases[key]||key;if(units[canonical]){unit=canonical;name=first[2].replace(/^of\s+/i,'').trim();}}
 if(!/^[\p{L}]/u.test(name))return null;
 // Counted whole ingredients are safe; an unknown word after a number may be an unknown unit.
 if(!unit&&!/^(?:eggs?|onions?|carrots?|tomatoes|potatoes|lemons?|limes?|apples?|bananas?|avocados?)$/i.test(name))return null;
 // Qualifiers after amounts can change the quantity (heaped, optional, divided): keep them separate.
 if(/\b(?:heaped|heaping|scant|optional|divided|or|about|approximately)\b/i.test(name))return null;
 return {amount,unit,name,key:name.toLowerCase().replace(/\s+/g,' ')};
}
export function groceryList(recipes,selectedIds){const selected=new Set(selectedIds),merged=new Map(),items=[];
 for(const source of recipes.filter(r=>selected.has(r.id))){for(const [index,original] of source.recipe.ingredients.entries()){
  const parsed=parseIngredient(original);if(!parsed){items.push({key:JSON.stringify(['original',source.id,index,original]),label:original,group:ingredientGroup(original),sources:[source.id]});continue;}
  const mergeKey=JSON.stringify([parsed.key,parsed.unit]);const previous=merged.get(mergeKey);
  const sum=previous?fraction(previous.amount.n*parsed.amount.d+parsed.amount.n*previous.amount.d,previous.amount.d*parsed.amount.d):parsed.amount;
  if(previous&&sum){previous.amount=sum;if(!previous.sources.includes(source.id))previous.sources.push(source.id);}
  else if(previous){items.push({key:JSON.stringify(['original',source.id,index,original]),label:original,group:ingredientGroup(original),sources:[source.id]});}
  else {const item={...parsed,amount:sum||parsed.amount,group:ingredientGroup(parsed.name),sources:[source.id],mergeKey};items.push(item);if(!previous)merged.set(mergeKey,item);}
 }}
 return items.map(item=>{if(!item.amount)return item;const unit=item.unit?units[item.unit][item.amount.n<=item.amount.d?0:1]+' ':'';return {...item,key:JSON.stringify([item.mergeKey,item.amount]),label:formatQuantity(item.amount)+' '+unit+item.name};}).sort((a,b)=>GROCERY_GROUPS.indexOf(a.group)-GROCERY_GROUPS.indexOf(b.group)||a.label.localeCompare(b.label));
}
export function groceryText(items,checked=[]){const done=new Set(checked);return GROCERY_GROUPS.flatMap(group=>{const rows=items.filter(i=>i.group===group);return rows.length?[group,...rows.map(i=>`${done.has(i.key)?'[x]':'[ ]'} ${i.label}`),'']:[];}).join('\n').trim();}
export function loadShopping(storage){try{const value=JSON.parse(storage.getItem('research-agent-shopping-v1'));return {selected:new Set(Array.isArray(value?.selected)?value.selected.filter(x=>typeof x==='string').slice(0,2000):[]),checked:new Set(Array.isArray(value?.checked)?value.checked.filter(x=>typeof x==='string').slice(0,5000):[])};}catch{return {selected:new Set(),checked:new Set()};}}
export function saveShopping(storage,{selected,checked}){try{storage.setItem('research-agent-shopping-v1',JSON.stringify({selected:[...selected],checked:[...checked]}));return true;}catch{return false;}}
