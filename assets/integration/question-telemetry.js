const STORAGE_KEY='tdas.202.question-module.v2.telemetry';
const SCHEMA_VERSION='1.0.0';
const MAX_COMPLETED=12;
const OPTIONS=new Set(['A','B','C','D','E']);

function storageTarget(storage){
 const target=storage??globalThis.localStorage;
 if(!target||typeof target.getItem!=='function'||typeof target.setItem!=='function')throw new TypeError('Armazenamento local de telemetria indisponível.');
 return target;
}
const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const cleanOption=value=>OPTIONS.has(String(value||''))?String(value):null;
const emptyStore=()=>({schemaVersion:SCHEMA_VERSION,active:null,completed:[]});
function emptyQuestion(id){return{id:String(id),firstSeenAt:null,lastSeenAt:null,activeMs:0,visits:0,answerChanges:0,firstAnswer:null,lastAnswer:null,firstAnsweredAt:null,lastAnsweredAt:null}}
function cleanQuestion(value,id){const source=value&&typeof value==='object'?value:{};return{id:String(id),firstSeenAt:source.firstSeenAt==null?null:finite(source.firstSeenAt),lastSeenAt:source.lastSeenAt==null?null:finite(source.lastSeenAt),activeMs:Math.max(0,finite(source.activeMs)),visits:Math.max(0,Math.floor(finite(source.visits))),answerChanges:Math.max(0,Math.floor(finite(source.answerChanges))),firstAnswer:cleanOption(source.firstAnswer),lastAnswer:cleanOption(source.lastAnswer),firstAnsweredAt:source.firstAnsweredAt==null?null:finite(source.firstAnsweredAt),lastAnsweredAt:source.lastAnsweredAt==null?null:finite(source.lastAnsweredAt)}}
function cleanSession(value,{completed=false}={}){
 if(!value||value.schemaVersion!==SCHEMA_VERSION||!value.catalogId||!Array.isArray(value.questionIds)||!value.questionIds.length)return null;
 const ids=value.questionIds.map(String);if(new Set(ids).size!==ids.length)return null;
 const index=Math.min(ids.length-1,Math.max(0,Math.floor(finite(value.currentIndex))));
 const questions={};for(const id of ids)questions[id]=cleanQuestion(value.questions?.[id],id);
 const currentQuestionId=ids.includes(String(value.currentQuestionId||''))?String(value.currentQuestionId):ids[index];
 return{schemaVersion:SCHEMA_VERSION,catalogId:String(value.catalogId),startedAt:finite(value.startedAt),updatedAt:finite(value.updatedAt)||finite(value.startedAt),questionIds:ids,currentIndex:index,currentQuestionId,active:completed?false:value.active===true,activeSince:completed||value.activeSince==null?null:finite(value.activeSince),finalizedAt:value.finalizedAt==null?null:finite(value.finalizedAt),questions};
}
function sanitizeStore(value){
 if(!value||value.schemaVersion!==SCHEMA_VERSION)return emptyStore();
 const active=cleanSession(value.active);
 const completed=(Array.isArray(value.completed)?value.completed:[]).map(item=>cleanSession(item,{completed:true})).filter(Boolean).slice(0,MAX_COMPLETED);
 return{schemaVersion:SCHEMA_VERSION,active,completed};
}
function readStore(storage){const target=storageTarget(storage),raw=target.getItem(STORAGE_KEY);if(!raw)return emptyStore();try{return sanitizeStore(JSON.parse(raw))}catch{return emptyStore()}}
function writeStore(store,storage){const target=storageTarget(storage),clean=sanitizeStore(store);target.setItem(STORAGE_KEY,JSON.stringify(clean));return clean}
function accrue(session,now){
 const timestamp=finite(now)||Date.now();if(!session.active||session.activeSince==null)return session;
 const id=session.currentQuestionId,question=session.questions[id];if(!question)return{...session,activeSince:timestamp,updatedAt:timestamp};
 const delta=Math.max(0,timestamp-finite(session.activeSince));
 return{...session,updatedAt:timestamp,activeSince:timestamp,questions:{...session.questions,[id]:{...question,activeMs:question.activeMs+delta,lastSeenAt:timestamp}}};
}
function visit(session,index,now){
 const timestamp=finite(now)||Date.now(),target=Math.min(session.questionIds.length-1,Math.max(0,Math.floor(finite(index)))),id=session.questionIds[target];
 if(id===session.currentQuestionId)return{...session,currentIndex:target,updatedAt:timestamp};
 const accrued=accrue(session,timestamp),question=accrued.questions[id]||emptyQuestion(id);
 return{...accrued,currentIndex:target,currentQuestionId:id,updatedAt:timestamp,activeSince:accrued.active?timestamp:null,questions:{...accrued.questions,[id]:{...question,visits:question.visits+1,firstSeenAt:question.firstSeenAt??timestamp,lastSeenAt:timestamp}}};
}
function answer(session,id,option,now){
 const questionId=String(id),selected=cleanOption(option);if(!selected||!session.questionIds.includes(questionId))return session;
 const timestamp=finite(now)||Date.now(),question=session.questions[questionId]||emptyQuestion(questionId),previous=question.lastAnswer;
 const changed=previous!==null&&previous!==selected;
 return{...session,updatedAt:timestamp,questions:{...session.questions,[questionId]:{...question,firstAnswer:question.firstAnswer??selected,lastAnswer:selected,answerChanges:question.answerChanges+(changed?1:0),firstAnsweredAt:question.firstAnsweredAt??timestamp,lastAnsweredAt:timestamp}}};
}
function begin({catalogId,questionIds,currentIndex=0,startedAt=Date.now(),answers={}},now=Date.now()){
 const ids=(questionIds||[]).map(String);if(!catalogId||!ids.length||new Set(ids).size!==ids.length)throw new TypeError('Sessão de telemetria inválida.');
 const timestamp=finite(now)||Date.now(),index=Math.min(ids.length-1,Math.max(0,Math.floor(finite(currentIndex)))),currentQuestionId=ids[index],questions={};for(const id of ids)questions[id]=emptyQuestion(id);
 questions[currentQuestionId]={...questions[currentQuestionId],visits:1,firstSeenAt:timestamp,lastSeenAt:timestamp};
 let session={schemaVersion:SCHEMA_VERSION,catalogId:String(catalogId),startedAt:finite(startedAt)||timestamp,updatedAt:timestamp,questionIds:ids,currentIndex:index,currentQuestionId,active:true,activeSince:timestamp,finalizedAt:null,questions};
 for(const[id,option]of Object.entries(answers||{}))session=answer(session,id,option,timestamp);
 return session;
}
function sameSession(session,{catalogId,startedAt},toleranceMs=2500){return!!session&&session.catalogId===String(catalogId)&&Math.abs(finite(session.startedAt)-finite(startedAt))<=toleranceMs}

export function startTelemetrySession(input,storage,now=Date.now()){
 const store=readStore(storage),session=begin(input,now);writeStore({...store,active:session},storage);return session;
}
export function syncTelemetrySession(input,storage,now=Date.now()){
 const target=storageTarget(storage),store=readStore(target);let session=store.active;
 if(!sameSession(session,input))session=begin(input,now);
 else{
  if(Number(input.currentIndex)!==session.currentIndex)session=visit(session,input.currentIndex,now);
  for(const[id,option]of Object.entries(input.answers||{}))session=answer(session,id,option,now);
 }
 writeStore({...store,active:session},target);return session;
}
export function recordTelemetryAnswer({catalogId,startedAt,questionId,option},storage,now=Date.now()){
 const target=storageTarget(storage),store=readStore(target);if(!sameSession(store.active,{catalogId,startedAt}))return null;
 const session=answer(store.active,questionId,option,now);writeStore({...store,active:session},target);return session;
}
export function setTelemetryActive(active,storage,now=Date.now()){
 const target=storageTarget(storage),store=readStore(target);if(!store.active)return null;const timestamp=finite(now)||Date.now();
 let session=store.active;
 if(active){if(!session.active)session={...session,active:true,activeSince:timestamp,updatedAt:timestamp};}
 else if(session.active){session=accrue(session,timestamp);session={...session,active:false,activeSince:null,updatedAt:timestamp};}
 writeStore({...store,active:session},target);return session;
}
export function summarizeTelemetry(session){
 const clean=cleanSession(session,{completed:session?.finalizedAt!=null});if(!clean)return null;const items=clean.questionIds.map(id=>clean.questions[id]);
 return{schemaVersion:SCHEMA_VERSION,catalogId:clean.catalogId,startedAt:clean.startedAt,finalizedAt:clean.finalizedAt,activeElapsedMs:items.reduce((sum,item)=>sum+item.activeMs,0),measuredQuestions:items.filter(item=>item.visits>0).length,revisitedQuestions:items.filter(item=>item.visits>1).length,revisitEvents:items.reduce((sum,item)=>sum+Math.max(0,item.visits-1),0),changedAnswerQuestions:items.filter(item=>item.answerChanges>0).length,answerChanges:items.reduce((sum,item)=>sum+item.answerChanges,0),questions:Object.fromEntries(items.map(item=>[item.id,{...item}]))};
}
export function finalizeTelemetrySession({catalogId,startedAt},storage,now=Date.now()){
 const target=storageTarget(storage),store=readStore(target);if(!sameSession(store.active,{catalogId,startedAt}))return null;
 let session=accrue(store.active,now);session={...session,active:false,activeSince:null,updatedAt:finite(now)||Date.now(),finalizedAt:finite(now)||Date.now()};
 const completed=[session,...store.completed.filter(item=>!(item.catalogId===session.catalogId&&item.startedAt===session.startedAt))].slice(0,MAX_COMPLETED);writeStore({...store,active:null,completed},target);return summarizeTelemetry(session);
}
export function consumeCompletedTelemetry({catalogId,startedAt,toleranceMs=2500},storage){
 const target=storageTarget(storage),store=readStore(target),matches=store.completed.map((item,index)=>({item,index,distance:Math.abs(finite(item.startedAt)-finite(startedAt))})).filter(entry=>entry.item.catalogId===String(catalogId)&&entry.distance<=toleranceMs).sort((a,b)=>a.distance-b.distance);
 if(!matches.length)return null;const match=matches[0],completed=store.completed.filter((_,index)=>index!==match.index);writeStore({...store,completed},target);return summarizeTelemetry(match.item);
}
export function readTelemetryState(storage){return readStore(storage)}
export function clearTelemetryState(storage){storageTarget(storage).removeItem?.(STORAGE_KEY)}
export {STORAGE_KEY,SCHEMA_VERSION};
