import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read=file=>fs.readFile(file,'utf8');
const [engine,runner,front,home,html,syncWorkflow,publishWorkflow,guard,sw,indexRaw]=await Promise.all([
  'scripts/notion/mirror.mjs',
  'scripts/sync-notion-mirror.mjs',
  'assets/notion-mirror.js',
  'assets/integration/home-notion-mirror.js',
  'notion/index.html',
  '.github/workflows/notion-sync.yml',
  '.github/workflows/notion-mirror-publish.yml',
  '.github/workflows/tdas-telemetry-pwa-preserve.yml',
  'sw.js',
  'data/notion-mirror/index.json'
].map(read));
const index=JSON.parse(indexRaw);
assert.equal(index.rootId,'363cf5a2-6731-816e-a702-c9a8c6ea11dc');
assert.ok(engine.includes('child_page')&&engine.includes('child_database'),'Crawler precisa descobrir páginas e bancos.');
assert.ok(engine.includes('/data_sources/')&&engine.includes('SHARD_SIZE'),'Bancos precisam ser consultados e fracionados.');
assert.ok(runner.includes('buildNotionMirror')&&runner.includes('writeNotionMirror'));
assert.ok(!syncWorkflow.includes('node scripts/sync-notion-mirror.mjs'),'Sincronização operacional não deve voltar a executar o espelho pesado.');
assert.ok(publishWorkflow.includes('node scripts/sync-notion-mirror.mjs'),'Workflow dedicado não executa o espelho.');
assert.ok(publishWorkflow.includes("workflows: ['Sincronizar Plataforma TDAS v26']"),'Espelho precisa iniciar após sincronização operacional bem-sucedida.');
assert.ok(publishWorkflow.includes('push:')&&publishWorkflow.includes("'scripts/notion/mirror.mjs'"),'Motor do espelho precisa poder disparar publicação independente.');
assert.ok(publishWorkflow.includes("github.event_name == 'push'"),'Job dedicado precisa aceitar o gatilho independente por push.');
assert.ok(publishWorkflow.includes('timeout-minutes: 60'),'Espelho precisa ter janela própria de execução.');
assert.ok(publishWorkflow.includes('index.bootstrap'),'Publicação precisa bloquear snapshot bootstrap.');
assert.ok(guard.includes('preserve-notion-mirror-pwa.mjs'),'Guard pós-sync não preserva o espelho.');
assert.ok(sw.includes('"notion/"')&&sw.includes('assets/notion-mirror.js')&&sw.includes('data/notion-mirror/index.json'));
assert.ok(html.includes('assets/notion-mirror.js')&&home.includes('Explorar meu Notion'));
assert.ok(front.includes('data/notion-mirror/index.json')&&front.includes('notion/?id=')&&front.includes('notion/?db='));
assert.ok(!/NOTION_TOKEN|api\.notion\.com/i.test(front+home+html),'O navegador não pode conter token nem chamar a API do Notion.');
console.log('Espelho Notion validado: pipeline desacoplado, gatilho independente, leitura server-side, árvore recursiva, bancos, busca, Home e PWA.');
