import {failedReason,hasDeepSeekResult} from './result-view.mjs';
import {isRecipeResult} from './recipes.mjs';
export function lastRunOutcome(video,{active=false,label,reason}={}){
 if(video?.status==='running')return {status:'Still running',reason:'This post is being processed.'};
 if(video?.status==='failed')return {status:'Failed',reason:failedReason(video)};
 if(video?.status==='skipped')return {status:'Skipped',reason:video.result?.classificationReason||video.result?.extraction?.reason||video.result?.summary||'This post was skipped.'};
 if(video?.result&&(hasDeepSeekResult(video)||video.result.summary?.trim()))return {status:'Done',href:'#'+(isRecipeResult(video)?'recipe-':'result-')+encodeURIComponent(video.id)};
 if(active&&['pending','retry_wait'].includes(video?.status))return {status:'Still running',reason:'Waiting its turn in the current run.'};
 if(video?.status==='needs_analysis'||label==='Failed')return {status:'Failed',reason:reason||'The video was read, but no usable analysis was saved.'};
 return {status:'Skipped',reason:reason||'This post was not processed before the run stopped.'};
}
