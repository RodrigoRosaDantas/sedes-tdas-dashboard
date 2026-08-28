import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.cwd();
const REQUIRED=['assets/v27.css','assets/integration/question-bank.js','assets/integration/question-bank-player.js','assets/integration/master-bank-ui.js','assets/integration/bank-draft-guard.js','assets/integration/review-catalog-bridge.js','assets/integration/resolver-bootstrap.js','assets/integration/continuity-engine.js','assets/integration/home-v27.js','assets/integration/attempt-diagnostics.js','assets/integration/attempt-diagnostics.css','assets/v28-home.css','assets/integration/home-v28.js','assets/integration/edital-diagnostic.js','assets/integration/edital-diagnostic.css','assets/integration/edital-evidence-runtime.js','assets/edital-simple.js','assets/edital-simple.css','assets/edital-verticalized-access.js','assets/dashboard-pro-2026.css','assets/integration/home-dashboard-pro-2026.js','assets/site-parity-v11.css','assets/site-parity-v11-fixes.css','assets/site-shell-boot.css','assets/integration/site-parity-v11.js'];
const OPTIONAL_DATA=['data/integration/master-question-bank.json'];
REQUIRED.push('assets/integration/answer-key-client.js');
OPTIONAL_DATA.push('data/integration/answer-key-service.json');

function ensureArrayEntry(source,name,value){const pattern=new RegExp(`const ${name}=(\\[[^;]*\\]);`),match=source.match(pattern);if(!match)throw new Error(`TDAS PWA: lista ${name} ausente.`);const list=JSON.parse(match[1]);if(!list.includes(value))list.push(value);return source.replace(pattern,`const ${name}=${JSON.stringify(list)};`)}

function ensureReplacement(source,before,after,label){
 if(source.includes(after))return source;
 if(!source.includes(before))throw new Error(`TDAS PWA: contrato de ${label} não encontrado.`);
 return source.replace(before,after);
}

function preserveFreshNetwork(source){
 let updated=source;
 updated=ensureReplacement(
  updated,
  "const fetchAndCache=request=>fetch(request).then(response=>",
  "const fetchAndCache=(request,{fresh=false}={})=>fetch(fresh?new Request(request,{cache:'no-store'}):request).then(response=>",
  'fetch sem cache HTTP'
 );
 updated=ensureReplacement(
  updated,
  "if(event.request.mode==='navigate'){event.respondWith(fetchAndCache(event.request).catch(",
  "if(event.request.mode==='navigate'){event.respondWith(fetchAndCache(event.request,{fresh:true}).catch(",
  'navegação fresca'
 );
 updated=ensureReplacement(
  updated,
  "if(url.search||url.pathname.includes('/data/')){event.respondWith(fetchAndCache(event.request).catch(",
  "if(url.search||url.pathname.includes('/data/')){event.respondWith(fetchAndCache(event.request,{fresh:true}).catch(",
  'recurso versionado fresco'
 );
 return updated;
}

function preservePrivateCorrections(source){
 let updated=source;
 if(!updated.includes('const isPublicAnswerKey='))updated=ensureReplacement(
  updated,
  "const matchCached=request=>caches.match(request).then(cached=>cached||caches.match(request,{ignoreSearch:true}));",
  "const matchCached=request=>caches.match(request).then(cached=>cached||caches.match(request,{ignoreSearch:true}));\nconst isPublicAnswerKey=request=>new URL(request.url).pathname.includes('/data/integration/question-keys/');\nconst purgePublicAnswerKeys=()=>caches.keys().then(keys=>Promise.all(keys.map(async key=>{const cache=await caches.open(key),requests=await cache.keys();await Promise.all(requests.filter(isPublicAnswerKey).map(request=>cache.delete(request)))})));",
  'purga de gabaritos públicos'
 );
 updated=ensureReplacement(
  updated,
  "self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>!shouldPreserveCache(key)).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));",
  "self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>!shouldPreserveCache(key)).map(key=>caches.delete(key)))).then(()=>purgePublicAnswerKeys()).then(()=>self.clients.claim())));",
  'ativação sem gabarito em cache'
 );
 updated=ensureReplacement(
  updated,
  "if(url.origin!==location.origin)return;if(event.request.mode==='navigate')",
  "if(url.origin!==location.origin)return;if(isPublicAnswerKey(event.request)){event.respondWith(fetch(new Request(event.request,{cache:'no-store'})));return}if(event.request.mode==='navigate')",
  'bypass de cache para gabarito legado'
 );
 return updated;
}

const swPath=path.join(ROOT,'sw.js');
let sw=await fs.readFile(swPath,'utf8');
for(const asset of REQUIRED)sw=ensureArrayEntry(sw,'ASSETS',asset);
let dataAdded=0;
for(const dataFile of OPTIONAL_DATA){
 if(await fs.access(path.join(ROOT,dataFile)).then(()=>true).catch(()=>false)){
  sw=ensureArrayEntry(sw,'DATA',dataFile);
  dataAdded++;
 }
}
sw=preservePrivateCorrections(preserveFreshNetwork(sw));
await fs.writeFile(swPath,sw,'utf8');
for(const file of REQUIRED)await fs.access(path.join(ROOT,file));
if(/question-keys\//.test((sw.match(/const (?:ASSETS|DATA)=\[[^;]+/g)||[]).join('\n')))throw new Error('TDAS PWA: gabarito detectado no precache.');
console.log(`TDAS v27/v28 + shell de paridade preservados no PWA: ${REQUIRED.length} assets + ${dataAdded} índice(s) público(s), rede fresca e zero gabarito no precache.`);
