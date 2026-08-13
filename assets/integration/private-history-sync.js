import {privateHistoryClient,getPrivateSession,privateHistoryEnabled} from './private-history-auth.js?v=1.0.0';
import {archiveLocalState,loadCurrentQuestionSource} from './persistence-local.js?v=1.0.0';
import {dbList,dbPut,STORES} from './history-db-core.js?v=1.0.0';
import {getOrCreateDeviceId,writeSyncMeta} from './persistence-contract.js?v=1.0.0';

const TABLES=Object.freeze({attempts:'tdas_attempts',questions:'tdas_attempt_questions',drafts:'tdas_session_drafts',state:'tdas_state_records'});
const delay=retries=>Math.min(300000,5000*2**Math.max(0,Number(retries)||0));
const ts=value=>new Date(Number(value)||Date.parse(String(value||''))||Date.now()).toISOString();
function attemptRows(exported,userId,deviceId){const a=exported.attempt;return{attempt:{user_id:userId,attempt_id:a.id,pe_id:a.peId,mode:a.mode==='simulation'?'simulation':a.mode,started_at:a.startedAt,finished_at:a.finishedAt,elapsed_ms:a.elapsedMs,active_elapsed_ms:a.activeElapsedMs,total:a.total,correct:a.correct,incorrect:a.incorrect,percent:a.percent,revisit_count:a.revisitCount,answer_change_count:a.answerChangeCount,device_id:deviceId,source:exported.source||'browser',schema_version:exported.schemaVersion,payload:exported},questions:exported.questions.map(q=>({user_id:userId,attempt_id:a.id,question_id:q.id,pe_id:a.peId,numero_original:q.numeroOriginal,materia:q.materia,assunto:q.assunto,subassunto:q.subassunto,enunciado:q.enunciado,texto_base:q.textoBase,alternativas:q.alternativas,selected:q.selected,correct_answer:q.correctAnswer,correct:q.correct,confidence:q.confidence,marked:q.marked,classification:q.classification,issue:q.issue,active_ms:q.activeMs,visits:q.visits,answer_changes:q.answerChanges,first_answer:q.firstAnswer,last_answer:q.lastAnswer,first_answered_at:q.firstAnsweredAt,last_answered_at:q.lastAnsweredAt,answer_history:q.answerHistory,history_complete:q.historyComplete===true,fundamento:q.fundamento,source:q.source,payload:q}))}}
async function upsert(client,table,rows,onConflict){const {error}=await client.from(table).upsert(rows,{onConflict});if(error)throw error}
async function sendItem(client,userId,deviceId,item){
 if(item.kind==='attempt'){const rows=attemptRows(item.payload,userId,deviceId);await upsert(client,TABLES.attempts,rows.attempt,'user_id,attempt_id');if(rows.questions.length)await upsert(client,TABLES.questions,rows.questions,'user_id,attempt_id,question_id');return}
 if(item.kind==='draft'){const r=item.payload;await upsert(client,TABLES.drafts,{user_id:userId,draft_id:r.draftId,pe_id:r.peId,catalog_id:r.catalogId,started_at:ts(r.startedAt),client_updated_at:ts(r.updatedAt),device_id:r.deviceId||deviceId,status:'active',payload:r.payload},'user_id,draft_id');return}
 if(item.kind==='state'){await upsert(client,TABLES.state,{user_id:userId,record_type:item.recordType,record_id:item.recordId,device_id:deviceId,client_updated_at:ts(item.updatedAt),payload:item.payload},'user_id,record_type,record_id')}
}
async function pullRemote(client,userId){
 const {data,error}=await client.from(TABLES.attempts).select('attempt_id,pe_id,finished_at,payload').eq('user_id',userId).order('finished_at',{ascending:false}).limit(500);if(error)throw error;
 for(const row of data||[])await dbPut(STORES.remote,{attemptId:row.attempt_id,peId:row.pe_id,finishedAt:Date.parse(row.finished_at),exported:row.payload,summary:row.payload?.attempt||null,syncedAt:Date.now()});
 const drafts=await client.from(TABLES.drafts).select('draft_id,pe_id,catalog_id,client_updated_at,device_id,status,payload').eq('user_id',userId).eq('status','active').order('client_updated_at',{ascending:false}).limit(20);if(drafts.error)throw drafts.error;
 for(const row of drafts.data||[])await dbPut(STORES.drafts,{draftId:row.draft_id,peId:row.pe_id,catalogId:row.catalog_id,updatedAt:Date.parse(row.client_updated_at),deviceId:row.device_id,payload:row.payload,remote:true});
 return{attempts:(data||[]).length,drafts:(drafts.data||[]).length};
}
export async function syncPrivateHistory(){
 if(!privateHistoryEnabled())return{status:'disabled',uploaded:0,remote:0};
 const catalog=await loadCurrentQuestionSource().catch(()=>null);await archiveLocalState({catalog});const session=await getPrivateSession();if(!session?.user?.id)return{status:'signed_out',uploaded:0,remote:0};
 const client=await privateHistoryClient(),deviceId=getOrCreateDeviceId(),queue=await dbList(STORES.queue),due=queue.filter(x=>x.status!=='synced'&&Number(x.nextRetryAt||0)<=Date.now()),now=Date.now();let uploaded=0,failed=0;
 for(const item of due){const saving={...item,status:'saving',lastAttemptAt:Date.now(),updatedAt:Date.now()};await dbPut(STORES.queue,saving);try{await sendItem(client,session.user.id,deviceId,saving);await dbPut(STORES.queue,{...saving,status:'synced',syncedAt:Date.now(),nextRetryAt:0,lastError:null,updatedAt:Date.now()});uploaded++}catch(error){const retries=(Number(saving.retries)||0)+1;await dbPut(STORES.queue,{...saving,status:'failed',retries,lastError:String(error?.message||error),nextRetryAt:Date.now()+delay(retries),updatedAt:Date.now()});failed++}}
 const pulled=await pullRemote(client,session.user.id);writeSyncMeta({lastSyncAt:new Date().toISOString(),deviceId,userId:session.user.id,uploaded,failed,remoteAttempts:pulled.attempts,remoteDrafts:pulled.drafts});return{status:failed?'partial':'synced',uploaded,failed,remote:pulled.attempts,drafts:pulled.drafts,finishedAt:now};
}
