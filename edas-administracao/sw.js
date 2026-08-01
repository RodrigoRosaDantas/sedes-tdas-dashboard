const VERSION='edas-pwa-v2-20260801c';
const BASE='/sedes-tdas-dashboard/edas-administracao/';
const ESSENTIAL=[
 BASE,
 BASE+'offline.html',
 BASE+'manifest.webmanifest',
 BASE+'assets/common.js?v=1',
 BASE+'assets/common.js?v=2',
 BASE+'assets/app.js?v=1',
 BASE+'assets/app.js?v=2',
 BASE+'data/site.json?v=1',
 BASE+'data/site.json?v=2'
];
const OPTIONAL=[
 BASE+'hoje/',
 BASE+'evolucao/',
 BASE+'riscos/',
 BASE+'agenda/',
 BASE+'estudos-caso/',
 BASE+'auditoria/',
 BASE+'mais/',
 BASE+'icons/icon.svg',
 BASE+'icons/maskable.svg',
 '/sedes-tdas-dashboard/assets/styles.css?v=20',
 '/sedes-tdas-dashboard/assets/v20.css?v=20'
];
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(VERSION);
  await cache.addAll(ESSENTIAL);
  await Promise.allSettled(OPTIONAL.map(url=>cache.add(url)));
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith('edas-')&&key!==VERSION).map(key=>caches.delete(key)));
  await self.clients.claim();
 })());
});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin)return;
 if(event.request.mode==='navigate'){
  event.respondWith((async()=>{
   try{
    const fresh=await fetch(event.request);
    const cache=await caches.open(VERSION);
    cache.put(event.request,fresh.clone());
    return fresh;
   }catch{
    return (await caches.match(event.request))||(await caches.match(BASE))||(await caches.match(BASE+'offline.html'));
   }
  })());
  return;
 }
 const isLiveData=url.pathname.startsWith(BASE+'data/');
 if(isLiveData){
  event.respondWith((async()=>{
   try{
    const fresh=await fetch(event.request,{cache:'no-store'});
    const cache=await caches.open(VERSION);
    cache.put(event.request,fresh.clone());
    return fresh;
   }catch{
    return (await caches.match(event.request))||(await caches.match(BASE+'data/site.json?v=2'))||(await caches.match(BASE+'data/site.json?v=1'));
   }
  })());
  return;
 }
 event.respondWith((async()=>{
  const cached=await caches.match(event.request);
  if(cached)return cached;
  try{
   const fresh=await fetch(event.request);
   const cache=await caches.open(VERSION);
   cache.put(event.request,fresh.clone());
   return fresh;
  }catch{
   return cached;
  }
 })());
});
