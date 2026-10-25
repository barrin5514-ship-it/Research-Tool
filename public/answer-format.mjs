export const ANSWER_KEYS=['what','why','next'];
export function validBullet(value){
 return typeof value==='string'&&value.trim().split(/\s+/u).length<15&&value.trim().length>0
  &&!/[\r\n]|[.!?]\s+\S/u.test(value)
  &&!/(?:\b(?:API|MCP|LLM|RAG|SDK|inference|orchestration|pipeline|latency|hyperparameters)\b)/iu.test(value);
}
/** Validate, never summarize or truncate model-written bullets. */
export function normalizeAnswers(value){
 if(!value||!ANSWER_KEYS.every(key=>{
  const part=value[key];return part&&Array.isArray(part.bullets)&&part.bullets.length>=2&&part.bullets.length<=3
   &&part.bullets.every(validBullet)&&typeof part.explanation==='string'&&part.explanation.trim()&&part.explanation.length<=5000;
 }))return undefined;
 return Object.fromEntries(ANSWER_KEYS.map(key=>[key,{bullets:[...value[key].bullets],explanation:value[key].explanation}]));
}
