import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read=file=>fs.readFile(file,'utf8');
const [engine,runner,front,home,html,homeHtml,more,syncWorkflow,publishWorkflow,guard,pwaPreserver,sw,indexRaw]=await Promise.all([
  'scripts/notion/mirror.mjs',
  'scripts/sync-notion-mirror.mjs',
  'assets/notion-mirror.js',
  'assets/integration/home-notion-mirror.js',
  'notion/index.html',
  'index.html',
  'assets/more.js',
  '.github/workflows/notion-sync.yml',
  '.github/workflows/notion-mirror-publish.yml',
  '.github/workflows/tdas-telemetry-pwa-preserve.yml',
  'scripts/preserve-notion-mirror-pwa.mjs',
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
assert.ok(publishWorkflow.includes('timeout-minutes: 60'),'Espelho precisa ter janela própria de execução.');
assert.ok(publishWorkflow.includes('index.bootstrap'),'Publicação precisa bloquear snapshot bootstrap.');
assert.ok(guard.includes('preserve-notion-mirror-pwa.mjs'),'Guard pós-sync não preserva o espelho.');
assert.ok(pwaPreserver.includes("const ROUTE = 'notion/'"),'Preservador PWA precisa manter a rota do espelho.');
assert.ok(pwaPreserver.includes("const ASSET = 'assets/notion-mirror.js'"),'Preservador PWA precisa manter o JS do espelho.');
assert.ok(pwaPreserver.includes("'assets/notion-mirror.css'"),'Preservador PWA precisa manter o CSS do espelho.');
assert.ok(pwaPreserver.includes("'assets/integration/home-notion-mirror.js'"),'Preservador PWA precisa manter a integração da Home.');
assert.ok(pwaPreserver.includes("const DATA_FILE = 'data/notion-mirror/index.json'"),'Preservador PWA precisa manter o índice do espelho.');
assert.ok(pwaPreserver.includes("fs.writeFile('sw.js'"),'Preservador PWA precisa efetivamente atualizar o Service Worker.');
assert.ok(sw.includes('const CORE_ROUTES=')&&sw.includes('const ASSETS=')&&sw.includes('const DATA='),'Service Worker precisa expor as listas preserváveis pelo guard.');
assert.ok(html.includes('assets/notion-mirror.js')&&home.includes('Meu Notion dentro do TDAS'));
assert.ok(home.includes("main.querySelector('.tdas-home-focus')")&&home.includes('hero.after(s)'),'A entrada do Notion precisa ficar logo após o foco principal da Home.');
assert.ok(home.includes('data.notionHeroAction')||home.includes('notionHeroAction'),'A Home precisa expor botão direto para o Notion.');
assert.ok(homeHtml.includes('home-notion-mirror.js?v=1.1.0'),'A Home precisa carregar explicitamente a integração visual atualizada.');
assert.ok(more.includes("title:'Meu Notion'")&&more.includes("href:`${BASE}notion/`"),'Mais precisa manter um acesso permanente ao espelho do Notion.');
assert.ok(front.includes('data/notion-mirror/index.json')&&front.includes('notion/?id=')&&front.includes('notion/?db='));
assert.ok(!/NOTION_TOKEN|api\.notion\.com/i.test(front+home+html+more),'O navegador não pode conter token nem chamar a API do Notion.');
console.log('Espelho Notion validado: pipeline desacoplado, preservação PWA determinística, leitura server-side, árvore recursiva, bancos, busca e acesso visível na Home/Mais.');
