// Some export viewers display the same bad bytes as Windows-1252 punctuation.
const CP1252='€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ';
export function repairExportText(text){
 if(typeof text!=='string')return text;
 const points=Array.from(text),bytes=[];
 for(const char of points){const point=char.codePointAt(0);if(point<=255)bytes.push(point);else{const index=CP1252.indexOf(char);if(index<0)return text;bytes.push(128+index);}}
 try{return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(bytes));}catch{return text;}
}
export function repairTextTree(value){
 if(typeof value==='string')return repairExportText(value);
 if(Array.isArray(value))return value.map(repairTextTree);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,repairTextTree(item)]));
 return value;
}
