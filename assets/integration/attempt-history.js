import {readModuleState} from './module-store.js?v=2.1.0';
import {buildAttemptExport,buildChatGptSummary,validateAttemptExport} from './attempt-export.js?v=1.0.0';
import {dbGet,dbList,STORES} from './history-db-core.js?v=1.0.0';
import {archiveAttempt,loadCurrentQuestionSource} from './persistence-local.js?v=1.0.0';

export async function getAttemptExport(attemptId,{catalog=null}={}){
 const id=String(attemptId),remote=await dbGet(STORES.remote,id).catch(()=>null);if(remote?.exported)return validateAttemptExport(remote.exported);
 const archived=await dbGet(STORES.details,id).catch(()=>null);if(archived?.exported)return validateAttemptExport(archived.exported);
 const attempt=readModuleState().attempts.find(item=>item.id===id);if(!attempt)return null;
 const current=catalog||await loadCurrentQuestionSource().catch(()=>null),details=await archiveAttempt(attempt,{catalog:current}).catch(()=>null);return details?.exported||buildAttemptExport({attempt});
}
export async function listAttemptHistory(){
 const local=readModuleState().attempts.map(attempt=>({attemptId:attempt.id,attempt,source:'local'})),remote=(await dbList(STORES.remote).catch(()=>[])).map(item=>({attemptId:item.attemptId,attempt:item.summary||item.exported?.attempt,exported:item.exported,source:'synced'}));
 const map=new Map();for(const item of local)map.set(item.attemptId,item);for(const item of remote)map.set(item.attemptId,{...(map.get(item.attemptId)||{}),...item,source:'synced'});return[...map.values()].sort((a,b)=>Date.parse(b.attempt?.finishedAt||0)-Date.parse(a.attempt?.finishedAt||0)||Number(b.attempt?.finishedAt||0)-Number(a.attempt?.finishedAt||0));
}
export function downloadAttemptExport(exported){const data=validateAttemptExport(exported),blob=new Blob([`${JSON.stringify(data,null,2)}\n`],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`tdas-${data.attempt.peId||'tentativa'}-${String(data.attempt.id).replace(/[^a-z0-9_-]+/gi,'-')}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),0)}
export async function copyAttemptSummary(exported,options={}){const text=buildChatGptSummary(exported,options);await navigator.clipboard.writeText(text);return text}
