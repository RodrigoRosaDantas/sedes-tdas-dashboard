const VERSION='tdas-v26-20260801-questions1';
const BASE='/sedes-tdas-dashboard/';
const CORE_ROUTES=['','hoje/','evolucao/','riscos/','agenda/','redacoes/','auditoria/','mais/','questoes-erros/','pe/','materias/','estudar/','resolver/','revisar/','caderno-erros/','desempenho/','fila-ia/','offline.html','manifest.webmanifest'];
const ASSETS=['assets/styles.css','assets/v20.css','assets/common.js','assets/home.js','assets/today.js','assets/evolution.js','assets/risks.js','assets/agenda.js','assets/redactions.js','assets/audit.js','assets/more.js','assets/pe.js','assets/subject.js','assets/subjects-index.js','assets/error-questions.js','assets/enhance-v20.js','assets/integration/contracts.js','assets/integration/navigation.js','assets/integration/pilot-catalog.js','assets/integration/player-core.js','assets/integration/player.js','assets/integration/player.css','assets/integration/attempt-store.js','assets/integration/response-classification.js','assets/integration/classification-store.js','assets/integration/completion-transaction.js','assets/integration/review-scheduler.js','assets/integration/review-store.js','assets/integration/reviews.js','assets/integration/error-book.js','assets/integration/pe-progress-store.js','assets/integration/pe-pilot-status.js','assets/integration/performance-metrics.js','assets/integration/performance.js','assets/integration/backup-migration-core.js','assets/integration/backup-migration-ui.js'];
const DATA=['data/home.json','data/today.json','data/evolution.json','data/risks.json','data/agenda.json','data/redactions.json','data/audit.json','data/more.json','data/subjects.json','data/sync-history.json','data/live.json','data/live-v23.json','data/live-v24.json','data/error-questions/index.json','data/integration/navigation.json','data/integration/pilot/pe76-catalog.json','data/integration/pilot/pe76-key.json'];
const ICONS=['icons/icon.svg','icons/maskable.svg','icons/icon-192.png','icons/icon-512.png'];
const SUBJECTS=['portugues','assistencia-social','lc-840-2011','arquivologia','direito-administrativo','lei-7-484-2024','materiais-e-patrimonio','primeiros-socorros','lei-maria-da-penha','redacao','atualidades-df-ride-pdpm','compras-publicas-lei-14-133','direito-constitucional'];
const PRECACHE=[
 ...CORE_ROUTES.map(path=>BASE+path),
 ...ASSETS.map(path=>BASE+path),
 ...DATA.map(path=>BASE+path),
 ...ICONS.map(path=>BASE+path),
 ...Array.from({length:112},(_,index)=>BASE+`pe/${index+1}/`),
 ...SUBJECTS.map(slug=>BASE+`materias/${slug}/`),
 ...Array.from({length:10},(_,index)=>BASE+`data/error-questions/part-${String(index+1).padStart(2,'0')}.json`)
];
const matchCache=request=>caches.match(request,{ignoreSearch:true});
self.addEventListener('install',event=>event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(PRECACHE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==VERSION).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.origin!==location.origin)return;
 if(event.request.mode==='navigate'){
  event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(VERSION).then(cache=>cache.put(event.request,copy));return response}).catch(()=>matchCache(event.request).then(cached=>cached||matchCache(BASE+'offline.html'))));
  return;
 }
 if(url.pathname.includes('/data/')){
  event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(VERSION).then(cache=>cache.put(event.request,copy));return response}).catch(()=>matchCache(event.request)));
  return;
 }
 event.respondWith(matchCache(event.request).then(cached=>cached||fetch(event.request).then(response=>{const copy=response.clone();caches.open(VERSION).then(cache=>cache.put(event.request,copy));return response})));
});
