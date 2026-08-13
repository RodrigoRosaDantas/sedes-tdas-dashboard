export const CLOUD_SYNC_SCHEMA_VERSION='1.0.0';
export const CLOUD_COLLECTIONS=Object.freeze(['attempts','errors','marked','reviews','aiQueue','dailyExecution']);
const MODULE_COLLECTIONS=CLOUD_COLLECTIONS.filter(item=>item!=='dailyExecution');
const MODULE_SCHEMA='2.0.0';
const BACKUP_KIND='tdas-local-backup';
const BACKUP_VERSION=1;

const isObject=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const asFinite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const asTime=value=>{if(Number.isFinite(Number(value)))return Number(value);const parsed=Date.parse(String(value||''));return Number.isFinite(parsed)?parsed:0};
const normalizePe=value=>{const number=Number(String(value??'').replace(/\D/g,''));return Number.isInteger(number)&&number>=1&&number<=112?`PE${String(number).padStart(2,'0')}`:null};

function stableValue(value){
 if(Array.isArray(value))return value.map(stableValue);
 if(isObject(value))return Object.keys(value).sort().reduce((out,key)=>{out[key]=stableValue(value[key]);return out},{});
 return value;
}
export const stableStringify=value=>JSON.stringify(stableValue(value));

export function hashText(input){
 let hash=0x811c9dc5;
 for(const char of String(input)){hash^=char.charCodeAt(0);hash=Math.imul(hash,0x01000193)>>>0}
 return hash.toString(16).padStart(8,'0');
}

function recordClock(collection,record,attemptsById){
 if(collection==='attempts')return Math.max(asTime(record.finishedAt),asTime(record.savedAt),asTime(record.startedAt));
 if(['errors','marked','aiQueue'].includes(collection))return Math.max(asTime(record.createdAt),asTime(attemptsById.get(record.attemptId)?.finishedAt));
 if(collection==='reviews'){
  if(record.status==='completed')return Math.max(asTime(record.completedAt),asTime(attemptsById.get(record.reviewAttemptId)?.finishedAt),asTime(attemptsById.get(record.sourceAttemptId)?.finishedAt));
  return Math.max(asTime(attemptsById.get(record.sourceAttemptId)?.finishedAt),asTime(record.createdAt));
 }
 return 0;
}

function eventFrom({collection,recordId,payload,clock,deviceId}){
 const cleanPayload=stableValue(payload),logicalClock=Math.max(0,Math.trunc(asFinite(clock,0)));
 const fingerprint=hashText(stableStringify(cleanPayload));
 return Object.freeze({
  event_id:`tdas202:${collection}:${encodeURIComponent(recordId)}:${logicalClock}:${fingerprint}`,
  collection,
  record_id:String(recordId),
  logical_clock:logicalClock,
  payload:cleanPayload,
  source_device_id:String(deviceId),
  occurred_at:new Date(logicalClock||0).toISOString(),
 });
}

export function backupToEvents(backup,deviceId){
 if(!isObject(backup?.stores)||!deviceId)throw new TypeError('Backup ou dispositivo inválido para sincronização.');
 const module=backup.stores.questionModule,events=[];
 const attempts=Array.isArray(module?.attempts)?module.attempts:[];
 const attemptsById=new Map(attempts.map(item=>[item.id,item]));
 for(const collection of MODULE_COLLECTIONS){
  const records=Array.isArray(module?.[collection])?module[collection]:[];
  for(const record of records){
   if(!isObject(record)||!record.id)continue;
   events.push(eventFrom({collection,recordId:record.id,payload:record,clock:recordClock(collection,record,attemptsById),deviceId}));
  }
 }
 for(const [key,record] of Object.entries(backup.stores.dailyExecution?.items||{})){
  const pe=normalizePe(key);if(!pe||!isObject(record))continue;
  events.push(eventFrom({collection:'dailyExecution',recordId:pe,payload:{...record},clock:asTime(record.updatedAt),deviceId}));
 }
 return Object.freeze(events.sort((a,b)=>a.logical_clock-b.logical_clock||a.event_id.localeCompare(b.event_id)));
}

function normalizeEvent(event){
 if(!isObject(event)||!CLOUD_COLLECTIONS.includes(event.collection)||!event.record_id||!isObject(event.payload))return null;
 return Object.freeze({
  event_id:String(event.event_id||''),collection:event.collection,record_id:String(event.record_id),
  logical_clock:Math.max(0,Math.trunc(asFinite(event.logical_clock,0))),payload:stableValue(event.payload),
  source_device_id:String(event.source_device_id||''),occurred_at:String(event.occurred_at||''),
 });
}

function winner(left,right){
 if(!left)return right;if(!right)return left;
 if(right.logical_clock!==left.logical_clock)return right.logical_clock>left.logical_clock?right:left;
 const leftId=left.event_id||`local:${hashText(stableStringify(left.payload))}`;
 const rightId=right.event_id||`local:${hashText(stableStringify(right.payload))}`;
 return rightId.localeCompare(leftId)>0?right:left;
}

export function reduceEvents(events=[]){
 const byRecord=new Map();
 for(const raw of events){const event=normalizeEvent(raw);if(!event)continue;const key=`${event.collection}\u0000${event.record_id}`;byRecord.set(key,winner(byRecord.get(key),event))}
 return Object.freeze([...byRecord.values()].sort((a,b)=>a.collection.localeCompare(b.collection)||a.record_id.localeCompare(b.record_id)));
}

export function mergeBackupWithEvents(localBackup,remoteEvents=[],deviceId='local'){
 if(!isObject(localBackup?.stores))throw new TypeError('Backup local inválido para mesclagem.');
 const combined=[...backupToEvents(localBackup,deviceId),...remoteEvents];
 const reduced=reduceEvents(combined);
 const module={schemaVersion:MODULE_SCHEMA,updatedAt:null,attempts:[],errors:[],marked:[],reviews:[],aiQueue:[]};
 const daily={version:1,items:{}};
 let latest=0;
 for(const event of reduced){
  latest=Math.max(latest,event.logical_clock);
  if(event.collection==='dailyExecution'){
   const pe=normalizePe(event.record_id);if(pe)daily.items[pe]={...event.payload};
  }else if(MODULE_COLLECTIONS.includes(event.collection))module[event.collection].push({...event.payload});
 }
 module.attempts.sort((a,b)=>asTime(b.finishedAt)-asTime(a.finishedAt)||String(a.id).localeCompare(String(b.id)));
 for(const key of ['errors','marked','reviews','aiQueue'])module[key].sort((a,b)=>asTime(b.createdAt||b.completedAt)-asTime(a.createdAt||a.completedAt)||String(a.id).localeCompare(String(b.id)));
 module.updatedAt=latest||null;
 return Object.freeze({
  kind:BACKUP_KIND,version:BACKUP_VERSION,app:'sedes-tdas-dashboard',exportedAt:new Date().toISOString(),
  stores:{dailyExecution:daily,questionModule:module},
 });
}

export function summarizeEventMerge(localBackup,remoteEvents=[],deviceId='local'){
 const local=backupToEvents(localBackup,deviceId),remote=remoteEvents.map(normalizeEvent).filter(Boolean),merged=reduceEvents([...local,...remote]);
 return Object.freeze({localEvents:local.length,remoteEvents:remote.length,mergedRecords:merged.length});
}
