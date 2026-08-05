const VERSION='edas-20260805.3';
const BASE='/sedes-tdas-dashboard/edas-administracao/';
const CORE=[
 BASE,BASE+'hoje/',BASE+'evolucao/',BASE+'riscos/',BASE+'agenda/',BASE+'estudos-caso/',BASE+'auditoria/',BASE+'mais/',
 BASE+'estudar/',BASE+'resolver/',BASE+'revisar/',BASE+'caderno-erros/',BASE+'desempenho/',BASE+'fila-ia/',
 BASE+'sprints/',BASE+'sprint/',BASE+'materias/',BASE+'materia/',BASE+'historico/',
 BASE+'offline.html',BASE+'manifest.webmanifest',BASE+'data/site.json',BASE+'data/sync-history.json',BASE+'data/integration/question-catalog.json',BASE+'data/integration/daily-material.json',BASE+'data/integration/daily-contract.json',BASE+'data/integration/navigation.json',
 BASE+'assets/common.js',BASE+'assets/home.js',BASE+'assets/today.js',BASE+'assets/evolution.js',BASE+'assets/risks.js',BASE+'assets/agenda.js',BASE+'assets/cases.js',BASE+'assets/audit.js',BASE+'assets/more.js',BASE+'assets/sprints.js',BASE+'assets/sprint.js',BASE+'assets/subjects-index.js',BASE+'assets/subject.js',BASE+'assets/history.js',BASE+'assets/edas.css',
 BASE+'assets/integration/command-center.css',BASE+'assets/integration/home-command-center.js',BASE+'assets/integration/today-execution.js',BASE+'assets/integration/module.css',BASE+'assets/integration/module-store.js',BASE+'assets/integration/module-dashboard.js',BASE+'assets/integration/module-player.js',BASE+'assets/integration/module-reviews.js',BASE+'assets/integration/module-error-book.js',BASE+'assets/integration/module-performance.js',BASE+'assets/integration/module-ai-queue.js',
 BASE+'icons/icon.svg',BASE+'icons/maskable.svg','/sedes-tdas-dashboard/assets/styles.css?v=26.1','/sedes-tdas-dashboard/assets/v20.css?v=26.1'
];
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(VERSION);await Promise.allSettled(CORE.map(url=>cache.add(url)));await self.skipWaiting()})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith('edas-')&&key!==VERSION).map(key=>caches.delete(key)));await self.clients.claim()})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;const url=new URL(event.request.url);if(url.origin!==self.location.origin)return;
 if(event.request.mode==='navigate'){event.respondWith((async()=>{try{const fresh=await fetch(event.request);const cache=await caches.open(VERSION);cache.put(event.request,fresh.clone());return fresh}catch{return(await caches.match(event.request))||(await caches.match(BASE))||(await caches.match(BASE+'offline.html'))}})());return}
 if(url.pathname===BASE+'data/site.json'){event.respondWith((async()=>{try{const fresh=await fetch(event.request,{cache:'no-store'});const cache=await caches.open(VERSION);cache.put(BASE+'data/site.json',fresh.clone());return fresh}catch{return(await caches.match(event.request))||(await caches.match(BASE+'data/site.json'))}})());return}
 event.respondWith((async()=>{const cached=await caches.match(event.request);if(cached)return cached;try{const fresh=await fetch(event.request);const cache=await caches.open(VERSION);cache.put(event.request,fresh.clone());return fresh}catch{return cached||Response.error()}})());
});
