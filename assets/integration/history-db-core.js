export const DB_NAME='tdas-202-history-v1';
export const DB_VERSION=1;
export const STORES=Object.freeze({details:'attemptDetails',remote:'remoteAttempts',queue:'queue',drafts:'drafts',meta:'meta'});
let promise=null;
export function openHistoryDb(){
 if(typeof indexedDB==='undefined')return Promise.reject(new Error('IndexedDB indisponível.'));
 if(promise)return promise;
 promise=new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB_NAME,DB_VERSION);
  request.onupgradeneeded=()=>{
   const db=request.result;
   if(!db.objectStoreNames.contains(STORES.details))db.createObjectStore(STORES.details,{keyPath:'attemptId'});
   if(!db.objectStoreNames.contains(STORES.remote))db.createObjectStore(STORES.remote,{keyPath:'attemptId'});
   if(!db.objectStoreNames.contains(STORES.queue))db.createObjectStore(STORES.queue,{keyPath:'opId'});
   if(!db.objectStoreNames.contains(STORES.drafts))db.createObjectStore(STORES.drafts,{keyPath:'draftId'});
   if(!db.objectStoreNames.contains(STORES.meta))db.createObjectStore(STORES.meta,{keyPath:'key'});
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||new Error('Falha ao abrir IndexedDB.'));
 });
 return promise;
}
function requestResult(request){return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('Falha no IndexedDB.'))})}
async function operation(storeName,mode,action){
 const db=await openHistoryDb();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(storeName,mode),store=tx.objectStore(storeName);let value;
  try{value=action(store)}catch(error){reject(error);return}
  Promise.resolve(value).then(result=>{tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error||new Error('Falha de transação.'));tx.onabort=()=>reject(tx.error||new Error('Transação abortada.'))}).catch(reject);
 });
}
export const dbPut=(store,value)=>operation(store,'readwrite',target=>requestResult(target.put(value)));
export const dbGet=(store,key)=>operation(store,'readonly',target=>requestResult(target.get(key)));
export const dbList=store=>operation(store,'readonly',target=>requestResult(target.getAll()));
export const dbDelete=(store,key)=>operation(store,'readwrite',target=>requestResult(target.delete(key)));
