const STORAGE_KEY='tdas.202.question-module.v2.draft';
const SCHEMA_VERSION='1.0.0';
const OPTIONS=new Set(['A','B','C','D','E']);

function storageTarget(storage){
 const target=storage??globalThis.localStorage;
 if(!target||typeof target.getItem!=='function'||typeof target.setItem!=='function')throw new TypeError('Armazenamento local indisponível.');
 return target;
}
function cleanMeta(value){
 const source=value&&typeof value==='object'?value:{};
 const result={};
 for(const[id,item]of Object.entries(source)){
  if(!item||typeof item!=='object')continue;
  result[id]={
   confidence:['secure','doubt','guess'].includes(item.confidence)?item.confidence:'secure',
   marked:item.marked===true,
   issue:['none','annulment_pending','source_error'].includes(item.issue)?item.issue:'none'
  };
 }
 return result;
}
function cleanSession(value){
 if(!value||value.schemaVersion!=='1.0.0'||!Array.isArray(value.questionIds)||!value.questionIds.length)return null;
 const ids=value.questionIds.map(String);
 if(new Set(ids).size!==ids.length)return null;
 const answers={};
 for(const[id,option]of Object.entries(value.answers||{}))if(ids.includes(id)&&OPTIONS.has(option))answers[id]=option;
 const index=Number(value.currentIndex);
 return{
  schemaVersion:'1.0.0',
  materialId:String(value.materialId||''),
  questionIds:ids,
  answers,
  currentIndex:Number.isInteger(index)&&index>=0&&index<ids.length?index:0,
  startedAt:Number(value.startedAt)||Date.now(),
  updatedAt:Number(value.updatedAt)||Date.now(),
  finishedAt:null
 };
}
function sanitize(value){
 if(!value||value.schemaVersion!==SCHEMA_VERSION)return null;
 const session=cleanSession(value.session);
 if(!session||!value.catalogId)return null;
 return{
  schemaVersion:SCHEMA_VERSION,
  catalogId:String(value.catalogId),
  peId:value.peId?String(value.peId):null,
  savedAt:Number(value.savedAt)||session.updatedAt,
  session,
  responseMeta:cleanMeta(value.responseMeta)
 };
}
export function readSessionDraft(storage){
 const target=storageTarget(storage),raw=target.getItem(STORAGE_KEY);
 if(!raw)return null;
 try{return sanitize(JSON.parse(raw))}catch{return null}
}
export function writeSessionDraft({catalogId,peId=null,session,responseMeta={}},storage){
 const target=storageTarget(storage),clean=cleanSession(session);
 if(!catalogId||!clean)throw new TypeError('Rascunho de sessão inválido.');
 const draft={schemaVersion:SCHEMA_VERSION,catalogId:String(catalogId),peId:peId?String(peId):null,savedAt:Date.now(),session:clean,responseMeta:cleanMeta(responseMeta)};
 target.setItem(STORAGE_KEY,JSON.stringify(draft));
 return draft;
}
export function matchingSessionDraft(catalog,storage){
 const draft=readSessionDraft(storage);
 if(!draft||!catalog||draft.catalogId!==String(catalog.catalogId))return null;
 const ids=(catalog.questions||[]).map(item=>String(item.id));
 return ids.length===draft.session.questionIds.length&&ids.every((id,index)=>id===draft.session.questionIds[index])?draft:null;
}
export function clearSessionDraft(storage){storageTarget(storage).removeItem?.(STORAGE_KEY)}
export {STORAGE_KEY};
