import{buildReinforcementReview,normalizeReviewOutcome}from'./review-engine.js?v=20260807.2';
const STORAGE_KEY='edas.400.question-module.v2.state';
const SCHEMA_VERSION='2.0.0';
const DAY_MS=86_400_000;
const MAX_ATTEMPTS=200;
const MAX_INDEX_ITEMS=2000;
const emptyState=()=>({schemaVersion:SCHEMA_VERSION,updatedAt:null,attempts:[],errors:[],marked:[],reviews:[],aiQueue:[]});
function storage(target){const value=target??globalThis.localStorage;if(!value||typeof value.getItem!=='function'||typeof value.setItem!=='function')throw new TypeError('Armazenamento local indisponível.');return value;}
function validate(state){if(!state||state.schemaVersion!==SCHEMA_VERSION)throw new Error('Estado local incompatível.');for(const key of['attempts','errors','marked','reviews','aiQueue'])if(!Array.isArray(state[key]))throw new Error(`Coleção inválida: ${key}.`);return state;}
function freeze(state){return Object.freeze({...state,attempts:Object.freeze([...state.attempts]),errors:Object.freeze([...state.errors]),marked:Object.freeze([...state.marked]),reviews:Object.freeze([...state.reviews]),aiQueue:Object.freeze([...state.aiQueue])});}
export function readModuleState(target){const store=storage(target),raw=store.getItem(STORAGE_KEY);if(!raw)return freeze(emptyState());try{return freeze(validate(JSON.parse(raw)))}catch(error){throw new Error(`Dados locais corrompidos: ${error.message}`)}}
const merge=(incoming,current,limit=MAX_INDEX_ITEMS)=>{const ids=new Set(incoming.map(item=>item.id));return[...incoming,...current.filter(item=>!ids.has(item.id))].slice(0,limit)};
function classify(result,meta={}){const confidence=['secure','doubt','guess'].includes(meta.confidence)?meta.confidence:'secure',issue=['none','annulment_pending','source_error'].includes(meta.issue)?meta.issue:'none',marked=meta.marked===true;if(issue!=='none')return{classification:issue,confidence,issue,marked};if(!result.correct)return{classification:'incorrect_confirmed',confidence,issue,marked};if(marked)return{classification:'marked',confidence,issue,marked};if(confidence==='doubt')return{classification:'correct_with_doubt',confidence,issue,marked};if(confidence==='guess')return{classification:'correct_by_guess',confidence,issue,marked};return{classification:'correct_secure',confidence,issue,marked};}
export function saveCompletedAttempt({catalog,evaluation,responseMeta={},mode='study',reviewId=null,reviewOutcome=null},target){
 if(!catalog||!evaluation||!['study','review'].includes(mode))throw new TypeError('Conclusão inválida.');if(mode==='review'&&!reviewId)throw new TypeError('Revisão de origem obrigatória.');
 const store=storage(target),before=store.getItem(STORAGE_KEY),state=readModuleState(store),questions=new Map((catalog.questions||[]).map(question=>[question.id,question]));
 const results=evaluation.results.map(result=>{const question=questions.get(result.id);if(!question)throw new Error(`Questão ausente: ${result.id}`);return{id:question.id,numeroOriginal:question.numero_original??null,assunto:String(question.assunto||'Sem assunto'),subassunto:String(question.subassunto||''),selected:result.selected,correctAnswer:result.correctAnswer,correct:result.correct,...classify(result,responseMeta[result.id])};});
 const resolvedReviewOutcome=mode==='review'?normalizeReviewOutcome(reviewOutcome,results[0]):null;
 const sprintId=catalog.sprintId||catalog.peId||null;
 const attempt={schemaVersion:SCHEMA_VERSION,id:`attempt:${mode}:${catalog.catalogId}:${evaluation.session.startedAt}`,mode,reviewId:mode==='review'?String(reviewId):null,reviewOutcome:resolvedReviewOutcome,catalogId:catalog.catalogId,sprintId,peId:sprintId,startedAt:evaluation.session.startedAt,finishedAt:evaluation.session.finishedAt,elapsedMs:evaluation.elapsedMs,correct:evaluation.correct,incorrect:evaluation.incorrect,total:evaluation.total,percent:evaluation.percent,localOnly:true,notionWriteback:false,questionResults:results};
 const errors=results.filter(item=>item.classification==='incorrect_confirmed').map(item=>({...item,id:`error:${attempt.id}:${item.id}`,attemptId:attempt.id,sprintId,peId:sprintId,createdAt:attempt.finishedAt}));
 const marked=results.filter(item=>item.marked).map(item=>({...item,id:`marked:${attempt.id}:${item.id}`,attemptId:attempt.id,sprintId,createdAt:attempt.finishedAt}));
 const aiQueue=results.filter(item=>['annulment_pending','source_error'].includes(item.classification)).map(item=>({...item,id:`ai:${attempt.id}:${item.id}`,attemptId:attempt.id,sprintId,createdAt:attempt.finishedAt,status:'pending'}));
 const eligible=results.filter(item=>['incorrect_confirmed','correct_with_doubt','correct_by_guess','marked'].includes(item.classification));
 const reviews=mode==='study'?eligible.flatMap(item=>[1,7,20].map(days=>{const id=`review:${attempt.id}:${item.id}:D+${days}`;return{...item,id,sourceAttemptId:attempt.id,questionId:item.id,sprintId,peId:sprintId,stage:`D+${days}`,dueAt:attempt.finishedAt+days*DAY_MS,status:'pending',completedAt:null,reviewAttemptId:null,outcome:null,originReviewId:null,rootReviewId:id,recurrenceCount:0,sourceOutcome:item.classification};})):[];
 let updated=merge(reviews,state.reviews),reinforcement=null;
 if(mode==='review'){
  const sourceReview=updated.find(review=>review.id===reviewId);if(!sourceReview)throw new Error('Revisão de origem não encontrada.');
  updated=updated.map(item=>item.id!==reviewId?item:{...item,status:'completed',completedAt:attempt.finishedAt,reviewAttemptId:attempt.id,outcome:resolvedReviewOutcome,outcomeClassification:results[0]?.classification||null});
  reinforcement=buildReinforcementReview({sourceReview,item:results[0],attemptId:attempt.id,finishedAt:attempt.finishedAt,outcome:resolvedReviewOutcome});if(reinforcement)updated=merge([reinforcement],updated);
 }
 const next={schemaVersion:SCHEMA_VERSION,updatedAt:Date.now(),attempts:merge([attempt],state.attempts,MAX_ATTEMPTS),errors:merge(errors,state.errors),marked:merge(marked,state.marked),reviews:updated.slice(0,MAX_INDEX_ITEMS),aiQueue:merge(aiQueue,state.aiQueue)};
 try{store.setItem(STORAGE_KEY,JSON.stringify(next));}catch(error){try{if(before===null)store.removeItem?.(STORAGE_KEY);else store.setItem(STORAGE_KEY,before)}catch{}throw new Error(`Conclusão local revertida: ${error.message}`)}
 return{attempt,state:freeze(next),reinforcement:reinforcement?Object.freeze(reinforcement):null};
}
export function exportModuleState(target){return JSON.stringify(readModuleState(target),null,2)}
export function clearModuleState(target){storage(target).removeItem?.(STORAGE_KEY)}
export{STORAGE_KEY};
