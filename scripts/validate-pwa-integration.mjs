import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.cwd();
const BASE='/sedes-tdas-dashboard/';
const read=file=>fs.readFile(path.join(ROOT,file),'utf8');
const exists=file=>fs.access(path.join(ROOT,file)).then(()=>true).catch(()=>false);
const required=(condition,message)=>{if(!condition)throw new Error(`PWA da execução diária: ${message}`)};
const sw=await read('sw.js');
const postprocess=await read('scripts/postprocess-v26.mjs');
const preserve=await read('scripts/preserve-v27-pwa.mjs');
const versionSync=await read('scripts/sync-platform-version.mjs');
const common=await read('assets/common.js');
const manifest=JSON.parse(await read('manifest.webmanifest'));
const packageData=JSON.parse(await read('package.json'));
const platformVersion=JSON.parse(await read('data/platform-version.json'));
const list=name=>{const match=sw.match(new RegExp(`const ${name}=\\[([\\s\\S]*?)\\];`));required(match,`lista ${name} ausente`);return[...match[1].matchAll(/(['"])(.*?)\1/g)].map(item=>item[2])};
const routes=list('CORE_ROUTES');
const assets=list('ASSETS');
const data=list('DATA');
const icons=list('ICONS');
const version=sw.match(/const VERSION=['"]([^'"]+)['"]/u)?.[1]||'';
const visualCacheRev=versionSync.match(/const VISUAL_CACHE_REV=['"]([^'"]+)['"]/u)?.[1]||'';

const requiredRoutes=['configuracoes/','dados-locais/','estudar/','resolver/','revisar/','caderno-erros/','desempenho/','fila-ia/','mentor/'];
const requiredAssets=['assets/tdas-mobile-ux.js','assets/tdas-mobile-ux.css','assets/tdas-pro-modules.css','assets/tdas-pro-modules.js','assets/tdas-command-palette.css','assets/tdas-command-palette.js','assets/mentor.js','assets/mentor.css','assets/settings.js','assets/integration/daily-execution.js','assets/integration/daily-law.js','assets/integration/today-execution.js','assets/integration/daily-question-page.js','assets/integration/daily-progress.js','assets/integration/local-backup.js','assets/integration/daily-content.css','assets/integration/audit-unlinked-errors.js','assets/integration/session-draft.js','assets/integration/module-dashboard.js','assets/integration/module-player.js','assets/integration/module-store.js','assets/integration/module-reviews.js','assets/integration/module-error-book.js','assets/integration/module-performance.js','assets/integration/module-ai-queue.js','assets/integration/player-core.js','assets/integration/player.css','assets/integration/study-ux.js','assets/integration/mentor-engine.js','assets/integration/mentor-ux.js','assets/dashboard-pro-2026.css','assets/integration/home-dashboard-pro-2026.js'];
const requiredData=['data/integration/navigation.json','data/integration/question-catalog.json','data/integration/daily-execution.json','data/integration/daily-material.json','data/platform-version.json'];
const retired=['assets/home-mobile.js','assets/home-mobile-hotfix.css','assets/tdas-pro-dashboard.css','assets/integration/command-center.css','assets/integration/home-command-center.js','assets/integration/home-v27.js','assets/integration/home-v28.js','assets/v28-home.css','assets/integration/home-notion-mirror.js'];

required(version===platformVersion.serviceWorkerVersion,`versão do cache diverge do manifesto: ${version}`);
for(const route of requiredRoutes){required(routes.includes(route),`rota fora do cache: ${route}`);required(await exists(`${route}index.html`),`rota ausente: ${route}`);required(postprocess.includes(`"${route}"`),`gerador pode remover a rota: ${route}`)}
for(const asset of requiredAssets){required(assets.includes(asset),`asset fora do cache: ${asset}`);required(await exists(asset),`asset ausente: ${asset}`);required(postprocess.includes(`"${asset}"`)||preserve.includes(`'${asset}'`),`geradores podem remover o asset: ${asset}`)}
for(const file of requiredData){required(data.includes(file),`dado fora do cache: ${file}`);required(await exists(file),`dado ausente: ${file}`);if(file==='data/platform-version.json')required(versionSync.includes(file),'sincronizador pode remover o manifesto de versão');else required(postprocess.includes(`"${file}"`),`gerador pode remover o dado: ${file}`)}
for(const file of retired){required(!assets.includes(file),`camada aposentada ainda está no precache: ${file}`);required(!await exists(file),`camada aposentada ainda está publicada: ${file}`)}

required(!data.some(file=>file.includes('question-keys/'))&&!sw.includes('question-keys/'),'correção foi pré-carregada antes da finalização');
required(!data.includes('data/integration/master-question-bank.json'),'Banco Mestre de vários MB não pode bloquear o install do PWA');
required(!sw.includes("Array.from({length:112}")&&!sw.includes("SUBJECTS.map(slug=>BASE+'materias/'")&&!sw.includes("data/error-questions/part-"),'páginas históricas ou partições grandes ainda são baixadas no install');
required(versionSync.includes("replaceConstant(sw,'VERSION'")&&versionSync.includes("ensureArrayEntry(sw,'DATA','data/platform-version.json')"),'sincronizador não governa versão e precache');
required(/pro12$/u.test(visualCacheRev),`revisão visual do cache deve permanecer na geração PRO12: ${visualCacheRev||'ausente'}`);
required(sw.includes("if(event.request.mode==='navigate')")&&sw.includes("fetchAndCache(event.request,{fresh:true})"),'navegação não força HTML atualizado');
required(sw.includes("if(url.pathname.includes('/data/'))")&&sw.includes("matchCached(event.request,{ignoreSearch:true})"),'dados não possuem rede fresca com fallback offline');
required(sw.includes("url.pathname.startsWith(BASE+'assets/')")&&sw.includes('matchCached(event.request).then(cached=>cached||fetchAndCache(event.request)'),'assets versionados não reutilizam o cache exato');
required(!sw.includes("if(url.search||url.pathname.includes('/data/'))"),'query string ainda força rede em todo CSS/JS');
required(preserve.includes('preserveFreshNetwork')&&preserve.includes("cache:'no-store'")&&preserve.includes("if(url.pathname.includes('/data/'))"),'preservador pode restaurar a estratégia lenta após sincronização');
required(common.includes("navigator.serviceWorker.register(script,{updateViaCache:'none'})"),'shell não solicita a versão mais recente do service worker');
required(!common.includes('registration.update()'),'shell não deve repetir a atualização do service worker e gerar erro no navegador');
required(manifest.start_url===BASE&&manifest.scope===BASE,'escopo do manifesto divergente');
required(packageData.scripts?.['check:pwa']==='node scripts/validate-pwa-integration.mjs','comando check:pwa ausente');

const localPath=item=>{if(item==='')return'index.html';if(item.endsWith('/'))return`${item}index.html`;return item};
let installBytes=0;
for(const item of [...routes,...assets,...data,...icons]){const file=localPath(item);required(await exists(file),`item de install ausente: ${file}`);installBytes+=(await fs.stat(path.join(ROOT,file))).size}
required(installBytes<=2_500_000,`install inicial ultrapassou 2,5 MB (${installBytes} bytes)`);

console.log(`PWA validado: ${routes.length} rotas, ${assets.length} assets, install de ${Math.round(installBytes/1024)} KiB, Banco Mestre e histórico sob demanda, cache exato de CSS/JS e HTML fresco.`);
await import('./audit-site-integrity.mjs');
