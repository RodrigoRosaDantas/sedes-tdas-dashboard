import fs from 'node:fs/promises';
import path from 'node:path';
const ROOT=process.cwd();
const REQUIRED=[
 'assets/v27.css',
 'assets/integration/question-bank.js',
 'assets/integration/question-bank-player.js',
 'assets/integration/bank-draft-guard.js',
 'assets/integration/review-catalog-bridge.js',
 'assets/integration/resolver-bootstrap.js',
 'assets/integration/continuity-engine.js',
 'assets/integration/home-v27.js'
];
const OPTIONAL_DATA=['data/integration/master-question-bank.json'];
function ensureArrayEntry(source,name,value){
 const pattern=new RegExp(`const ${name}=(\\[[^;]*\\]);`),match=source.match(pattern);
 if(!match)throw new Error(`TDAS v27 PWA: lista ${name} ausente.`);
 const list=JSON.parse(match[1]);
 if(!list.includes(value))list.push(value);
 return source.replace(pattern,`const ${name}=${JSON.stringify(list)};`);
}
const swPath=path.join(ROOT,'sw.js');
let sw=await fs.readFile(swPath,'utf8');
for(const asset of REQUIRED)sw=ensureArrayEntry(sw,'ASSETS',asset);
let dataAdded=0;
for(const dataFile of OPTIONAL_DATA){if(await fs.access(path.join(ROOT,dataFile)).then(()=>true).catch(()=>false)){sw=ensureArrayEntry(sw,'DATA',dataFile);dataAdded++}}
await fs.writeFile(swPath,sw,'utf8');
for(const file of REQUIRED)await fs.access(path.join(ROOT,file));
if(/question-keys\//.test((sw.match(/const (?:ASSETS|DATA)=\[[^;]+/g)||[]).join('\n')))throw new Error('TDAS v27 PWA: gabarito detectado no precache.');
console.log(`TDAS v27 preservada no PWA: ${REQUIRED.length} assets + ${dataAdded} catálogo(s) público(s), sem gabaritos no precache.`);