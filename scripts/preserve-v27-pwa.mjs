import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.cwd();
const REQUIRED=['assets/v27.css','assets/integration/question-bank.js','assets/integration/question-bank-player.js','assets/integration/master-bank-ui.js','assets/integration/bank-draft-guard.js','assets/integration/review-catalog-bridge.js','assets/integration/resolver-bootstrap.js','assets/integration/continuity-engine.js','assets/integration/attempt-diagnostics.js','assets/integration/attempt-diagnostics.css','assets/integration/edital-diagnostic.js','assets/integration/edital-diagnostic.css','assets/integration/edital-evidence-runtime.js','assets/edital-simple.js','assets/edital-simple.css','assets/edital-verticalized-access.js','assets/dashboard-pro-2026.css','assets/integration/home-dashboard-pro-2026.js','assets/site-parity-v11.css','assets/site-parity-v11-fixes.css','assets/site-shell-boot.css','assets/integration/site-parity-v11.js'];
const RUNTIME_ONLY_DATA=['data/integration/master-question-bank.json'];

function ensureArrayEntry(source,name,value){const pattern=new RegExp(`const ${name}=(\\[[^;]*\\]);`),match=source.match(pattern);if(!match)throw new Error(`TDAS PWA: lista ${name} ausente.`);const list=JSON.parse(match[1]);if(!list.includes(value))list.push(value);return source.replace(pattern,`const ${name}=${JSON.stringify(list)};`)}
function removeArrayEntry(source,name,value){const pattern=new RegExp(`const ${name}=(\\[[^;]*\\]);`),match=source.match(pattern);if(!match)throw new Error(`TDAS PWA: lista ${name} ausente.`);const list=JSON.parse(match[1]).filter(item=>item!==value);return source.replace(pattern,`const ${name}=${JSON.stringify(list)};`)}

function ensureReplacement(source,before,after,label){
 if(source.includes(after))return source;
 if(!source.includes(before))throw new Error(`TDAS PWA: contrato de ${label} não encontrado.`);
 return source.replace(before,after);
}

function preserveFreshNetwork(source){
 let updated=source;
 if(!updated.includes("const fetchAndCache=(request,{fresh=false}={})=>"))updated=ensureReplacement(
   updated,
   "const fetchAndCache=request=>fetch(request).then(response=>",
   "const fetchAndCache=(request,{fresh=false}={})=>fetch(fresh?new Request(request,{cache:'no-store'}):request).then(response=>",
   'fetch sem cache HTTP'
  );
 if(!updated.includes("fetchAndCache(event.request,{fresh:true})"))updated=ensureReplacement(
   updated,
   "if(event.request.mode==='navigate'){event.respondWith(fetchAndCache(event.request).catch(",
   "if(event.request.mode==='navigate'){event.respondWith(fetchAndCache(event.request,{fresh:true}).catch(",
   'navegação fresca'
  );
 if(updated.includes("if(url.search||url.pathname.includes('/data/')){"))updated=updated.replace(
   "if(url.search||url.pathname.includes('/data/')){",
   "if(url.pathname.includes('/data/')){"
  );
 if(!updated.includes("if(url.pathname.includes('/data/')){"))throw new Error('TDAS PWA: contrato de dados frescos não encontrado.');
 return updated;
}

const swPath=path.join(ROOT,'sw.js');
let sw=await fs.readFile(swPath,'utf8');
for(const asset of REQUIRED)sw=ensureArrayEntry(sw,'ASSETS',asset);
for(const dataFile of RUNTIME_ONLY_DATA)sw=removeArrayEntry(sw,'DATA',dataFile);
sw=preserveFreshNetwork(sw);
await fs.writeFile(swPath,sw,'utf8');
for(const file of REQUIRED)await fs.access(path.join(ROOT,file));
if(/question-keys\//.test((sw.match(/const (?:ASSETS|DATA)=\[[^;]+/g)||[]).join('\n')))throw new Error('TDAS PWA: gabarito detectado no precache.');
console.log(`TDAS v27/v28 + shell de paridade preservados no PWA: ${REQUIRED.length} assets essenciais, Banco Mestre sob demanda, rede fresca e zero gabarito no precache.`);
