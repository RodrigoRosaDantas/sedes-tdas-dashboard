const VERSION='edas-20260801.3';
const BASE='/sedes-tdas-dashboard/edas-administracao/';
const CORE=[
 BASE,BASE+'hoje/',BASE+'evolucao/',BASE+'riscos/',BASE+'agenda/',BASE+'estudos-caso/',BASE+'auditoria/',BASE+'mais/',
 BASE+'offline.html',BASE+'manifest.webmanifest?v=20260801.3',BASE+'icons/icon.svg',BASE+'icons/maskable.svg',
 BASE+'assets/app.css?v=20260801.3',BASE+'assets/common.js?v=20260801.3',BASE+'assets/app.js?v=20260801.3',BASE+'data/site.json?v=20260801.3'
];
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(VERSION);await cache.addAll(CORE);await self.skipWaiting()})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith('edas-')&&key!==VERSION).map(key=>caches.delete(key)));await self.clients.claim()})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
async function networkFirst(request,fallback){const cache=await caches.open(VERSION);try{const response=await fetch(request,{cache:'no-store'});if(response.ok)cache.put(request,response.clone());return response}catch{return(await caches.match(request,{ignoreSearch:true}))||(fallback?await caches.match(fallback,{ignoreSearch:true}):undefined)}}
async function staleWhileRevalidate(request){const cache=await caches.open(VERSION),cached=await caches.match(request,{ignoreSearch:true});const fresh=fetch(request).then(response=>{if(response.ok)cache.put(request,response.clone());return response}).catch(()=>null);return cached||await fresh}
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const url=new URL(event.request.url);if(url.origin!==location.origin||!url.pathname.startsWith(BASE))return;if(event.request.mode==='navigate'){event.respondWith(networkFirst(event.request,BASE+'offline.html'));return}if(url.pathname.includes('/data/')){event.respondWith(networkFirst(event.request,BASE+'data/site.json?v=20260801.3'));return}event.respondWith(staleWhileRevalidate(event.request))});