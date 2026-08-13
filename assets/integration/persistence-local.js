import {readModuleState} from './module-store.js?v=2.1.0';
import {readSessionDraft} from './session-draft.js?v=1.0.0';
import {buildAttemptExport} from './attempt-export.js?v=1.0.0';
import {dbGet,dbList,dbPut,STORES} from './history-db-core.js?v=1.0.0';
import {CURRENT_STORAGE_KEYS,getOrCreateDeviceId,inspectLocalStores,queueId,writeSyncMeta} from './persistence-contract.js?v=1.0.0';

const safeJson=(raw,fallback=null)=>{try{return raw?JSON.parse(raw):fallback}catch{return fallback}};
const asTime=value=>Number.isFinite(Number(value))?Number(value):Date.parse(String(value||''))||0;
export async function loadCurrentQuestionSource(base='/sedes-tdas-dashboard/'){
 const catalog=await fetch(base+'data/integration/question-catalog.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
 return catalog&&Array.isArray(catalog.questions)?catalog:null;
}
function snapshotMap(catalog){
 if(!catalog)return{};const source={catalogId:catalog.catalogId,peId:catalog.peId,authorizedSource:catalog.authorizedSource||null};
 return Object.fromEntries(catalog.questions.map(question=>[String(question.id),{...question,source}]));
}
function canEnrich(attempt,catalog){if(!catalog||!attempt)return false;if(attempt.catalogId===catalog.catalogId)return true;if(attempt.peId!==catalog.peId)return false;const ids=new Set(catalog.questions.map(q=>String(q.id)));return(attempt.questionResults||[]).every(q=>ids.has(String(q.id)))}
export async function archiveAttempt(attempt,{catalog=null,user={},deviceId=getOrCreateDeviceId()}={}){
 const questionsById=canEnrich(attempt,catalog)?snapshotMap(catalog):{};
 const exported=buildAttemptExport({attempt:{...attempt,deviceId},questionsById,user,source:Object.keys(questionsById).length?'local+catalog':'local'});
 const details={attemptId:attempt.id,peId:attempt.peId||null,finishedAt:Number(attempt.finishedAt||0),capturedAt:Date.now(),contentComplete:exported.questions.every(q=>q.enunciado&&q.alternativas),exported};
 await dbPut(STORES.details,details);
 await dbPut(STORES.queue,{opId:queueId('attempt',attempt.id),kind:'attempt',attemptId:attempt.id,status:'pending',retries:0,nextRetryAt:0,updatedAt:Date.now(),payload:exported});
 return details;
}
function queueStateRecord(type,id,payload,updatedAt){return dbPut(STORES.queue,{opId:queueId(`state:${type}`,id),kind:'state',recordType:type,recordId:String(id),status:'pending',retries:0,nextRetryAt:0,updatedAt:Number(updatedAt)||Date.now(),payload})}
export async function archiveLocalState({catalog=null,user={}}={}){
 const deviceId=getOrCreateDeviceId(),module=readModuleState(),details=[];
 for(const attempt of module.attempts)details.push(await archiveAttempt(attempt,{catalog,user,deviceId}));
 for(const item of module.errors)await queueStateRecord('error',item.id,item,item.createdAt);
 for(const item of module.marked)await queueStateRecord('marked',item.id,item,item.createdAt);
 for(const item of module.reviews)await queueStateRecord('review',item.id,item,Math.max(asTime(item.completedAt),asTime(item.dueAt),asTime(item.createdAt)));
 for(const item of module.aiQueue)await queueStateRecord('aiQueue',item.id,item,item.createdAt);
 const causes=safeJson(globalThis.localStorage?.getItem(CURRENT_STORAGE_KEYS.errorCauses),{causes:{}})?.causes||{};
 for(const [id,item] of Object.entries(causes))await queueStateRecord('errorCause',id,item,item.savedAt);
 const daily=safeJson(globalThis.localStorage?.getItem(CURRENT_STORAGE_KEYS.daily),{items:{}})?.items||{};
 for(const [pe,item] of Object.entries(daily))await queueStateRecord('dailyProgress',pe,item,asTime(item.updatedAt));
 const draft=readSessionDraft();
 if(draft){const draftId=`draft:${draft.catalogId}:${draft.session.startedAt}`,record={draftId,peId:draft.peId,catalogId:draft.catalogId,startedAt:draft.session.startedAt,updatedAt:draft.savedAt,deviceId,payload:draft};await dbPut(STORES.drafts,record);await dbPut(STORES.queue,{opId:queueId('draft',draftId),kind:'draft',draftId,status:'pending',retries:0,nextRetryAt:0,updatedAt:Date.now(),payload:record})}
 const pe88=module.attempts.find(item=>item.peId==='PE88'&&Number(item.total)===53)||null;
 const audit={schemaVersion:'1.0.0',migratedAt:Date.now(),deviceId,stores:inspectLocalStores(),attempts:module.attempts.length,details:details.length,queue:(await dbList(STORES.queue)).length,draft:Boolean(draft),pe88:pe88?{found:true,id:pe88.id,total:pe88.total,correct:pe88.correct,incorrect:pe88.incorrect,percent:pe88.percent,elapsedMs:pe88.elapsedMs,activeElapsedMs:pe88.activeElapsedMs,questionResults:pe88.questionResults?.length||0,revisitCount:pe88.revisitCount||0,answerChangeCount:pe88.answerChangeCount||0}: {found:false}};
 writeSyncMeta({migration:audit});return audit;
}
export async function readArchivedAttempt(attemptId){return dbGet(STORES.details,String(attemptId))}
export async function readArchivedAttempts(){return dbList(STORES.details)}
export async function readPendingQueue(){return(await dbList(STORES.queue)).filter(item=>item.status!=='synced')}
