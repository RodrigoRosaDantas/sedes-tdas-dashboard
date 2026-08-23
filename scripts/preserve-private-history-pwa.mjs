import fs from 'node:fs/promises';
import path from 'node:path';
const ROOT=process.cwd();
const retired=[
 'assets/integration/private-history-config.js','assets/integration/private-history-auth.js','assets/integration/firebase-history-store.js',
 'assets/integration/private-history-sync.js','assets/integration/private-history-sync-v2.js','assets/integration/private-history-sync-v3.js',
 'assets/integration/private-history-runtime.js','assets/integration/private-history-runtime-v2.js','assets/integration/private-history-runtime-v3.js',
 'assets/integration/private-history-materialize.js','assets/integration/private-history-login.js','assets/integration/private-history-page.js',
 'assets/integration/result-persistence-links.js','assets/integration/result-persistence-links-v2.js'
];
const localOnlyAssets=['assets/integration/module-error-book-v3.js','assets/integration/module-error-book-base.js','assets/integration/module-performance-v6.js','assets/integration/attempt-diagnostics.js','assets/integration/attempt-diagnostics.css'];
function rewriteList(source,name,mutate){const pattern=new RegExp(`const ${name}=(\\[[^;]*\\]);`),match=source.match(pattern);if(!match)throw new Error(`Persistência local-only: lista ${name} ausente.`);const list=mutate(JSON.parse(match[1]));return source.replace(pattern,`const ${name}=${JSON.stringify(list)};`)}
const swPath=path.join(ROOT,'sw.js');let sw=await fs.readFile(swPath,'utf8');
sw=rewriteList(sw,'ASSETS',list=>[...new Set([...list.filter(item=>!retired.includes(item)),...localOnlyAssets])]);
await fs.writeFile(swPath,sw,'utf8');
for(const asset of retired){try{await fs.access(path.join(ROOT,asset));throw new Error(`Persistência pessoal aposentada ainda presente: ${asset}`)}catch(error){if(error?.code!=='ENOENT')throw error}}
for(const asset of localOnlyAssets)await fs.access(path.join(ROOT,asset));
if(/firebase-history|private-history-(?:auth|sync|runtime|materialize|login|page|config)|result-persistence-links/i.test(sw))throw new Error('Service worker ainda referencia persistência pessoal aposentada.');
console.log('Contrato local-only validado: PWA preserva somente sessão/diagnóstico efêmero, sem histórico pessoal, links de persistência ou Firebase.');
