const BASE='/sedes-tdas-dashboard/';
let currentPromise=null,indexPromise=null;
const archiveCache=new Map();
const json=url=>fetch(url,{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
export async function loadCurrentCatalog(){if(!currentPromise)currentPromise=json(BASE+'data/integration/question-catalog.json');return currentPromise}
async function loadArchiveIndex(){if(!indexPromise)indexPromise=json(BASE+'data/integration/question-archive/index.json').then(x=>x&&x.catalogs?x:{catalogs:{}});return indexPromise}
export async function loadCatalogById(catalogId){
 const id=String(catalogId||'').trim();if(!id)return null;
 const current=await loadCurrentCatalog();if(current?.catalogId===id)return current;
 const index=await loadArchiveIndex(),entry=index.catalogs?.[id];if(!entry?.path)return null;
 if(!archiveCache.has(id))archiveCache.set(id,json(BASE+entry.path));return archiveCache.get(id);
}
export async function resolveAttemptCatalog(attempt,{fallbackCurrent=true}={}){
 const exact=await loadCatalogById(attempt?.catalogId||attempt?.materialId);if(exact)return exact;
 if(!fallbackCurrent)return null;const current=await loadCurrentCatalog();if(!current||current.peId!==attempt?.peId)return null;
 const ids=new Set((current.questions||[]).map(q=>String(q.id)));return(attempt?.questionResults||[]).every(q=>ids.has(String(q.id)))?current:null;
}
