import {createLocalBackup,restoreLocalBackup} from './local-backup.js?v=1.0.0';
import {backupToEvents,mergeBackupWithEvents,summarizeEventMerge} from './cloud-sync-core.js?v=1.0.0';

export const CLOUD_DEVICE_KEY='tdas.202.cloud.device.v1';
export const CLOUD_META_KEY='tdas.202.cloud.meta.v1';
export const CLOUD_AUTH_STORAGE_KEY='tdas.202.supabase.auth.v1';
export const CLOUD_TABLE='tdas_202_events';
const SUPABASE_URL='https://fqqkkyusnzhuuizahkww.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_GfoaAPKtYuSu_UY6wE8jMg_XsVjdWU7';
const SUPABASE_ESM='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/+esm';
const PAGE_SIZE=1000;
const INSERT_BATCH=200;
let clientPromise=null;

function resolveStorage(storage){
 const target=storage??globalThis.localStorage;
 if(!target||typeof target.getItem!=='function'||typeof target.setItem!=='function')throw new TypeError('Armazenamento local indisponível.');
 return target;
}

export function readCloudMeta(storage){
 const target=resolveStorage(storage);try{return JSON.parse(target.getItem(CLOUD_META_KEY)||'null')}catch{return null}
}

export function getOrCreateDeviceId(storage){
 const target=resolveStorage(storage),current=String(target.getItem(CLOUD_DEVICE_KEY)||'').trim();if(current)return current;
 const generated=globalThis.crypto?.randomUUID?.()||`device-${Date.now()}-${Math.random().toString(36).slice(2,12)}`;
 target.setItem(CLOUD_DEVICE_KEY,generated);return generated;
}

async function getClient(){
 if(!clientPromise)clientPromise=import(SUPABASE_ESM).then(({createClient})=>createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:CLOUD_AUTH_STORAGE_KEY},
 }));
 return clientPromise;
}

export async function getCloudSession(){
 const client=await getClient(),{data,error}=await client.auth.getSession();if(error)throw error;return data.session||null;
}

export async function signInCloudWithPassword(email,password){
 const client=await getClient(),{data,error}=await client.auth.signInWithPassword({email:String(email).trim(),password:String(password)});if(error)throw error;return data.session||null;
}

export async function sendCloudMagicLink(email,redirectTo=globalThis.location?.href){
 const client=await getClient(),options={shouldCreateUser:false};if(redirectTo)options.emailRedirectTo=String(redirectTo).split('#')[0];
 const {error}=await client.auth.signInWithOtp({email:String(email).trim(),options});if(error)throw error;return true;
}

export async function signOutCloud(){const client=await getClient(),{error}=await client.auth.signOut();if(error)throw error;return true}

async function fetchAllEvents(client,userId){
 const rows=[];let from=0;
 while(true){
  const {data,error}=await client.from(CLOUD_TABLE).select('event_id,collection,record_id,logical_clock,payload,source_device_id,occurred_at').eq('user_id',userId).order('logical_clock',{ascending:true}).order('event_id',{ascending:true}).range(from,from+PAGE_SIZE-1);
  if(error)throw error;const page=Array.isArray(data)?data:[];rows.push(...page);if(page.length<PAGE_SIZE)break;from+=PAGE_SIZE;
 }
 return rows;
}

async function insertMissingEvents(client,userId,events,remote){
 const existing=new Set(remote.map(item=>item.event_id));const missing=events.filter(item=>!existing.has(item.event_id));
 for(let index=0;index<missing.length;index+=INSERT_BATCH){
  const rows=missing.slice(index,index+INSERT_BATCH).map(event=>({user_id:userId,...event}));
  const {error}=await client.from(CLOUD_TABLE).insert(rows);if(error)throw error;
 }
 return missing.length;
}

export async function synchronizeCloud({storage}={}){
 const target=resolveStorage(storage),client=await getClient(),{data:{session},error:sessionError}=await client.auth.getSession();
 if(sessionError)throw sessionError;if(!session?.user?.id)throw new Error('Entre na sincronização privada antes de sincronizar.');
 const deviceId=getOrCreateDeviceId(target),localBackup=createLocalBackup(target),localEvents=backupToEvents(localBackup,deviceId);
 const before=await fetchAllEvents(client,session.user.id),uploaded=await insertMissingEvents(client,session.user.id,localEvents,before),remote=uploaded?await fetchAllEvents(client,session.user.id):before;
 const mergeSummary=summarizeEventMerge(localBackup,remote,deviceId),mergedBackup=mergeBackupWithEvents(localBackup,remote,deviceId),restored=restoreLocalBackup(mergedBackup,target);
 const meta={schemaVersion:'1.0.0',lastSyncAt:new Date().toISOString(),deviceId,userId:session.user.id,uploadedEvents:uploaded,remoteEvents:remote.length,mergedRecords:mergeSummary.mergedRecords};
 target.setItem(CLOUD_META_KEY,JSON.stringify(meta));
 return Object.freeze({meta:Object.freeze(meta),summary:Object.freeze(restored),localEvents:localEvents.length,remoteEvents:remote.length,uploadedEvents:uploaded,mergedRecords:mergeSummary.mergedRecords});
}
