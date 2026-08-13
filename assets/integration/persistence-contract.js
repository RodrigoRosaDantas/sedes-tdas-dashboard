import {STORAGE_KEYS} from './contracts.js?v=1.0.0';
export const PERSISTENCE_SCHEMA='1.0.0';
export const DEVICE_KEY='tdas.202.persistence.v1.device';
export const SYNC_META_KEY='tdas.202.persistence.v1.meta';
export const AUTH_STORAGE_KEY='tdas.202.persistence.auth.v1';
export const CURRENT_STORAGE_KEYS=Object.freeze({module:'tdas.202.question-module.v2.state',draft:'tdas.202.question-module.v2.draft',telemetry:'tdas.202.question-module.v2.telemetry',daily:'tdas.202.daily-execution.v1',errorCauses:'tdas.202.error-causes.v1'});
export const LEGACY_STORAGE_KEYS=Object.freeze({activeProfile:'sedes.questoes.activeProfile.v3',profiles:'sedes.questoes.profiles.v3',history:'sedes.questoes.rodrigo.history.v3',errors:'sedes.questoes.rodrigo.errors.v3',marked:'sedes.questoes.rodrigo.marked.v3'});
export const STORAGE_REGISTRY=Object.freeze([...Object.values(CURRENT_STORAGE_KEYS),...Object.values(STORAGE_KEYS),...Object.values(LEGACY_STORAGE_KEYS),DEVICE_KEY,SYNC_META_KEY,AUTH_STORAGE_KEY]);
export function getOrCreateDeviceId(storage=globalThis.localStorage){const current=String(storage?.getItem?.(DEVICE_KEY)||'').trim();if(current)return current;const id=globalThis.crypto?.randomUUID?.()||`tdas-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;storage?.setItem?.(DEVICE_KEY,id);return id}
export function inspectLocalStores(storage=globalThis.localStorage){return STORAGE_REGISTRY.map(key=>{const raw=storage?.getItem?.(key)??null;return{key,present:raw!==null,bytes:raw===null?0:new Blob([raw]).size}})}
export function readSyncMeta(storage=globalThis.localStorage){try{return JSON.parse(storage?.getItem?.(SYNC_META_KEY)||'null')}catch{return null}}
export function writeSyncMeta(value,storage=globalThis.localStorage){const next={schemaVersion:PERSISTENCE_SCHEMA,...value,updatedAt:Date.now()};storage?.setItem?.(SYNC_META_KEY,JSON.stringify(next));return next}
export function queueId(kind,id){return`tdas202:${kind}:${encodeURIComponent(String(id))}`}
export function attemptStatus(attempt,remoteIds=new Set(),pendingIds=new Set()){if(remoteIds.has(attempt.id))return'synced';if(pendingIds.has(attempt.id))return'pending';return'local'}
