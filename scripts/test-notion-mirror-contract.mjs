import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read=file=>fs.readFile(file,'utf8');
const [engine,runner,front,home,html,coreWorkflow,mirrorWorkflow,guard,sw,indexRaw]=await Promise.all([
  'scripts/notion/mirror.mjs','scripts/sync-notion-mirror.mjs','assets/notion-mirror.js','assets/integration/home-notion-mirror.js','notion/index.html','.github/workflows/notion-sync.yml','.github/workflows/notion-mirror-sync.yml','.github/workflows/tdas-telemetry-pwa-preserve.yml','sw.js','data/notion-mirror/index.json'
].map(read));
const index=JSON.parse(indexRaw);
assert.equal(index.rootId,'363cf5a2-6731-816e-a702-c9a8c6ea11dc');
assert.ok(engine.includes('child_page')&&engine.includes('child_database'),'Crawler precisa descobrir páginas e bancos.');
assert.ok(engine.includes('/data_sources/')&&engine.includes('SHARD_SIZE'),'Bancos precisam ser consultados e fracionados.');
assert.ok(runner.includes('buildNotionMirror')&&runner.includes('writeNotionMirror'));
assert.ok(!coreWorkflow.includes('node scripts/sync-notion-mirror.mjs'),'Sync operacional não deve aguardar a varredura profunda.');
assert.ok(mirrorWorkflow.includes('node scripts/sync-notion-mirror.mjs')&&mirrorWorkflow.includes('Sincronizar Plataforma TDAS v26'),'Pipeline independente não está ligado ao sync operacional.');
assert.ok(mirrorWorkflow.includes('timeout-minutes: 90')&&mirrorWorkflow.includes('data/notion-mirror'),'Pipeline profundo precisa de janela e publicação isoladas.');
assert.ok(guard.includes('preserve-notion-mirror-pwa.mjs'),'Guard pós-sync não preserva o espelho.');
assert.ok(sw.includes('"notion/"')&&sw.includes('assets/notion-mirror.js')&&sw.includes('data/notion-mirror/index.json'));
assert.ok(html.includes('assets/notion-mirror.js')&&home.includes('Explorar meu Notion'));
assert.ok(front.includes('data/notion-mirror/index.json')&&front.includes('notion/?id=')&&front.includes('notion/?db='));
assert.ok(!/NOTION_TOKEN|api\.notion\.com/i.test(front+home+html),'O navegador não pode conter token nem chamar a API do Notion.');
console.log('Espelho Notion validado: pipeline isolado, leitura server-side, árvore recursiva, bancos, Home e PWA.');
