const VERSION='tdas-v22-20260729a';
const BASE='/sedes-tdas-dashboard/';
const PRECACHE=[
 BASE,BASE+'hoje/',BASE+'evolucao/',BASE+'riscos/',BASE+'agenda/',BASE+'provas/',BASE+'simulados/',BASE+'resolver/',BASE+'redacoes/',BASE+'auditoria/',BASE+'mais/',BASE+'questoes-erros/',BASE+'pe/',BASE+'pe/72/',BASE+'materias/',BASE+'materias/portugues/',BASE+'offline.html',BASE+'manifest.webmanifest',
 BASE+'assets/styles.css',BASE+'assets/v20.css',BASE+'assets/common.js',BASE+'assets/home.js',BASE+'assets/catalog.js',BASE+'assets/resolver.js',BASE+'assets/questoes.css',BASE+'assets/today.js',BASE+'assets/evolution.js',BASE+'assets/risks.js',BASE+'assets/agenda.js',BASE+'assets/redactions.js',BASE+'assets/audit.js',BASE+'assets/more.js',BASE+'assets/pe.js',BASE+'assets/subject.js',BASE+'assets/subjects-index.js',BASE+'assets/error-questions.js',
 BASE+'data/home.json',BASE+'data/questoes.json',BASE+'data/today.json',BASE+'data/evolution.json',BASE+'data/risks.json',BASE+'data/agenda.json',BASE+'data/redactions.json',BASE+'data/audit.json',BASE+'data/more.json',BASE+'data/subjects.json',BASE+'data/sync-history.json',BASE+'data/live.json',
 BASE+'icons/icon.svg',BASE+'icons/maskable.svg',BASE+'icons/icon-192.png',BASE+'icons/icon-512.png'
];
self.addEventListener('install',event=>event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(PRECACHE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==VERSION).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);if(url.origin!==location.origin)return;
 if(event.request.mode==='navigate'){
  event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(VERSION).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match(event.request).then(response=>response||caches.match(BASE+'offline.html'))));return;
 }
 if(url.pathname.includes('/data/')){
  event.respondWith(caches.match(event.request).then(cached=>{const network=fetch(event.request).then(response=>{caches.open(VERSION).then(cache=>cache.put(event.request,response.clone()));return response}).catch(()=>cached);return cached||network}));return;
 }
 event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{caches.open(VERSION).then(cache=>cache.put(event.request,response.clone()));return response})));
});
