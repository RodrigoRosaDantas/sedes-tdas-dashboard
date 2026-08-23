import {readModuleState} from './module-store.js?v=2.1.0';
import {readSessionDraft} from './session-draft.js?v=1.0.0';
import {dbGet,dbList,STORES} from './history-db-core.js?v=1.0.0';
import {getOrCreateDeviceId,inspectLocalStores,writeSyncMeta} from './persistence-contract.js?v=1.0.0';
import {loadCurrentCatalog} from './question-catalog-archive.js?v=1.0.0';

export const loadCurrentQuestionSource=()=>loadCurrentCatalog();

export async function archiveAttempt(attempt){
 return {attemptId:attempt?.id||null,peId:attempt?.peId||null,catalogId:attempt?.catalogId||null,finishedAt:Number(attempt?.finishedAt||0),capturedAt:Date.now(),persisted:false,cloudSync:false,exported:null};
}

export async function archiveLocalState(){
 const state=readModuleState(),draft=readSessionDraft(),audit={schemaVersion:'2.0.0-local-only',auditedAt:Date.now(),deviceId:getOrCreateDeviceId(),stores:inspectLocalStores(),legacyAttempts:state.attempts.length,legacyErrors:state.errors.length,legacyMarked:state.marked.length,legacyReviews:state.reviews.length,legacyAiQueue:state.aiQueue.length,draft:Boolean(draft),persisted:false,queued:0,cloudSync:false};
 writeSyncMeta({persistenceMode:'local-only',cloudSync:false,lastLocalAuditAt:new Date().toISOString()});
 return audit;
}

export const readArchivedAttempt=id=>dbGet(STORES.details,String(id));
export const readArchivedAttempts=()=>dbList(STORES.details);
export async function readPendingQueue(){return[]}
