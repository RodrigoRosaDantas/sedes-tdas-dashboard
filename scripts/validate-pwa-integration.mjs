import fs from 'node:fs/promises';
import path from 'node:path';
const ROOT=process.cwd(),BASE='/sedes-tdas-dashboard/',read=file=>fs.readFile(path.join(ROOT,file),'utf8'),exists=file=>fs.access(path.join(ROOT,file)).then(()=>true).catch(()=>false),required=(condition,message)=>{if(!condition)throw new Error(`PWA da execução diária: ${message}`)};
const sw=await read('sw.js'),postprocess=await read('scripts/postprocess-v26.mjs'),manifest=JSON.parse(await read('manifest.webmanifest')),packageData=JSON.parse(await read('package.json'));
const list=name=>{const match=sw.match(new RegExp(`const ${name}=\\[([\\s\\S]*?)\\];`));required(match,`lista ${name} ausente`);return[...match[1].matchAll(/(['"])(.*?)\1/g)].map(item=>item[2])};
const routes=list('CORE_ROUTES'),assets=list('ASSETS'),data=list('DATA'),version=sw.match(/const VERSION=['"]([^'"]+)['"]/u)?.[1]||'';
const requiredRoutes=['dados-locais/','estudar/','resolver/','revisar/','caderno-erros/','desempenho/','fila-ia/'];
const requiredAssets=['assets/integration/daily-execution.js','assets/integration/daily-law.js','assets/integration/today-execution.js','assets/integration/daily-question-page.js','assets/integration/daily-progress.js','assets/integration/local-backup.js','assets/integration/daily-content.css','assets/integration/module-dashboard.js','assets/integration/module-player.js','assets/integration/module-store.js','assets/integration/module-reviews.js','assets/integration/module-error-book.js','assets/integration/module-performance.js','assets/integration/module-ai-queue.js','assets/integration/player-core.js','assets/integration/player.css'];
const requiredData=['data/integration/navigation.json','data/integration/question-catalog.json','data/integration/daily-execution.json','data/integration/daily-material.json'];
required(/^tdas-v26-daily-\d{8}-notion-daily-content(?:-[a-z0-9-]+)?$/.test(version),`versão inválida: ${version}`);
for(const route of requiredRoutes){required(routes.includes(route),`rota fora do cache: ${route}`);required(await exists(`${route}index.html`),`rota ausente: ${route}`);required(postprocess.includes(`\"${route}\"`),`gerador pode remover a rota: ${route}`)}
for(const asset of requiredAssets){required(assets.includes(asset),`asset fora do cache: ${asset}`);required(await exists(asset),`asset ausente: ${asset}`);required(postprocess.includes(`\"${asset}\"`),`gerador pode remover o asset: ${asset}`)}
for(const file of requiredData){required(data.includes(file),`dado fora do cache: ${file}`);required(await exists(file),`dado ausente: ${file}`);required(postprocess.includes(`\"${file}\"`),`gerador pode remover o dado: ${file}`)}
required(!data.some(file=>file.includes('question-keys/'))&&!sw.includes('question-keys/'),'correção foi pré-carregada antes da finalização');
required(postprocess.includes('-notion-daily-content'),'Gerador do PWA não preserva a versão do conteúdo diário.');
required(!data.some(file=>/pe76|pilot/i.test(file))&&!assets.some(file=>/pilot-catalog|real-study|pe-pilot-status/i.test(file)),'PWA ainda inclui conteúdo de exemplo.');
required(manifest.start_url===BASE&&manifest.scope===BASE,'escopo do manifesto divergente');
required(packageData.scripts?.['check:pwa']==='node scripts/validate-pwa-integration.mjs','comando check:pwa ausente');
console.log(`PWA validado: ${requiredRoutes.length} rotas críticas, ${requiredAssets.length} módulos, material diário offline e correção fora do precache.`);
