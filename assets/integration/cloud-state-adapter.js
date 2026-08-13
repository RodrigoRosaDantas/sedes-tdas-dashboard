import {readModuleState,STORAGE_KEY as MODULE_STORAGE_KEY} from './module-store.js?v=2.1.0';
import {readProgressStore,writeProgressStore} from './daily-progress.js?v=1.0.0';

export const CLOUD_LOCAL_STATE_VERSION='1.0.0';

function resolveStorage(storage){
 const target=storage??globalThis.localStorage;
 if(!target||typeof target.getItem!=='function'||typeof target.setItem!=='function')throw new TypeError('Armazenamento local indisponível.');
 return target;
}

export function readCloudLocalState(storage){
 const target=resolveStorage(storage),module=readModuleState(target),daily=readProgressStore(target);
 return Object.freeze({
  kind:'tdas-local-backup',version:1,app:'sedes-tdas-dashboard',exportedAt:new Date().toISOString(),
  stores:{
   dailyExecution:{version:1,items:Object.fromEntries(Object.entries(daily.items||{}).map(([key,value])=>[key,{...value}]))},
   questionModule:{schemaVersion:module.schemaVersion,updatedAt:module.updatedAt,attempts:module.attempts.map(item=>({...item})),errors:module.errors.map(item=>({...item})),marked:module.marked.map(item=>({...item})),reviews:module.reviews.map(item=>({...item})),aiQueue:module.aiQueue.map(item=>({...item}))},
  },
 });
}

export function summarizeCloudLocalState(snapshot){
 const module=snapshot?.stores?.questionModule||{},daily=Object.values(snapshot?.stores?.dailyExecution?.items||{});
 return Object.freeze({
  peWithProgress:daily.filter(item=>item.material||item.questions||item.registered).length,
  attempts:Array.isArray(module.attempts)?module.attempts.length:0,
  errors:Array.isArray(module.errors)?module.errors.length:0,
  reviews:Array.isArray(module.reviews)?module.reviews.length:0,
  aiQueue:Array.isArray(module.aiQueue)?module.aiQueue.length:0,
 });
}

export function applyCloudLocalState(snapshot,storage){
 const target=resolveStorage(storage),module=snapshot?.stores?.questionModule,daily=snapshot?.stores?.dailyExecution;
 if(!module||module.schemaVersion!=='2.0.0'||!daily||daily.version!==1)throw new Error('Estado mesclado incompatível.');
 for(const key of ['attempts','errors','marked','reviews','aiQueue'])if(!Array.isArray(module[key]))throw new Error(`Coleção mesclada inválida: ${key}.`);
 const beforeModule=target.getItem(MODULE_STORAGE_KEY),beforeDaily=readProgressStore(target);
 try{
  target.setItem(MODULE_STORAGE_KEY,JSON.stringify(module));
  readModuleState(target);
  writeProgressStore(daily,target);
 }catch(error){
  try{if(beforeModule===null)target.removeItem?.(MODULE_STORAGE_KEY);else target.setItem(MODULE_STORAGE_KEY,beforeModule);writeProgressStore(beforeDaily,target)}catch{}
  throw new Error(`Mesclagem local revertida: ${error.message}`);
 }
 return summarizeCloudLocalState(readCloudLocalState(target));
}
