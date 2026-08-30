import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read=file=>fs.readFile(file,'utf8');
const [engine,runner,front,html,homeHtml,more,syncWorkflow,publishWorkflow,guard,pwaPreserver,sw,indexRaw,parity]=await Promise.all([
  'scripts/notion/mirror.mjs',
  'scripts/sync-notion-mirror.mjs',
  'assets/notion-mirror.js',
  'notion/index.html',
  'index.html',
  'assets/more.js',
  '.github/workflows/notion-sync.yml',
  '.github/workflows/notion-mirror-publish.yml',
  '.github/workflows/tdas-telemetry-pwa-preserve.yml',
  'scripts/preserve-notion-mirror-pwa.mjs',
  'sw.js',
  'data/notion-mirror/index.json',
  'assets/integration/site-parity-v11.js'
].map(read));
const index=JSON.parse(indexRaw);
const syncWorkflowName=syncWorkflow.match(/^name:\s*(.+)$/m)?.[1]?.trim();
assert.ok(syncWorkflowName,'Sincronização operacional precisa declarar nome de workflow.');
assert.equal(index.rootId,'363cf5a2-6731-816e-a702-c9a8c6ea11dc');
assert.ok(engine.includes('child_page')&&engine.includes('child_database'),'Crawler precisa descobrir páginas e bancos.');
assert.ok(engine.includes('PROTECTED_SUBTREES=new Map'),'Mapa público precisa definir fronteiras protegidas explícitas.');
assert.ok(engine.includes("['366cf5a2-6731-819d-acd6-d7e5b51b1339'"),'Bancos operacionais precisam permanecer protegidos.');
assert.ok(engine.includes("['364cf5a2-6731-8105-abdb-ce6966704b5d'"),'Questões Diárias precisam permanecer protegidas.');
assert.ok(engine.includes("visibility:'metadata-only'")&&engine.includes('recordCount:null')&&engine.includes('shards:[]'),'Bancos públicos devem ser somente metadados, sem linhas ou shards.');
assert.ok(!engine.includes('queryDataSource('),'Gerador público não pode consultar linhas de bancos do Notion.');
assert.ok(engine.includes("ctx.files.set('summary.json',summary)")&&engine.includes("ctx.files.set('search.json',search)"),'Gerador precisa separar resumo e índice textual.');
assert.ok(engine.includes("PRIVATE_PROPERTY_TYPES=new Set(['email','phone_number','people'])"),'Mapa público precisa suprimir propriedades pessoais tipadas.');
assert.ok(engine.includes('SECRET_PATTERNS')&&engine.includes('assertPublicSafe'),'Publisher precisa bloquear padrões de segredo de alta confiança.');
assert.ok(engine.includes('Gabarito correto')&&engine.includes('Você marcou:'),'Publisher precisa bloquear respostas/gabaritos por defesa em profundidade.');
assert.ok(engine.includes("publicScope:'safe'"),'Snapshot precisa declarar escopo público seguro.');
assert.ok(runner.includes('buildNotionMirror')&&runner.includes('writeNotionMirror'));
assert.ok(!syncWorkflow.includes('node scripts/sync-notion-mirror.mjs'),'Sincronização operacional não deve executar o crawler do mapa.');
assert.ok(publishWorkflow.includes('node scripts/sync-notion-mirror.mjs'),'Workflow dedicado precisa executar o mapa seguro.');
assert.ok(publishWorkflow.includes(`workflows: ['${syncWorkflowName}']`),'Mapa precisa iniciar após a sincronização operacional vigente.');
assert.ok(guard.includes(`workflows: ['${syncWorkflowName}']`),'Guard pós-sync precisa observar a sincronização operacional vigente.');
assert.ok(publishWorkflow.includes("index.publicScope!=='safe'")&&publishWorkflow.includes('index.recordCount!==0'),'Publicação precisa bloquear escopo inseguro e linhas públicas.');
assert.ok(publishWorkflow.includes('timeout-minutes: 60'),'Mapa precisa ter janela própria de execução.');
assert.ok(guard.includes('preserve-notion-mirror-pwa.mjs'),'Guard pós-sync não preserva o mapa.');
assert.ok(pwaPreserver.includes("const ROUTE = 'notion/'"),'Preservador PWA precisa manter a rota do mapa.');
assert.ok(pwaPreserver.includes("HEAVY_DATA_FILE = 'data/notion-mirror/index.json'")&&pwaPreserver.includes('remove:[HEAVY_DATA_FILE,SUMMARY_FILE]'),'Índice estrutural não pode voltar ao precache.');
assert.ok(sw.includes('const CORE_ROUTES=')&&sw.includes('const ASSETS=')&&sw.includes('const DATA='),'Service Worker precisa expor as listas preserváveis pelo guard.');
assert.ok(!sw.includes('data/notion-mirror/index.json'),'Índice do Notion não pode permanecer no precache do PWA.');
assert.ok(html.includes('assets/notion-mirror.js?v=1.2.0'));
assert.ok(homeHtml.includes('home-dashboard-pro-2026.js?v=30.0.1'),'Home operacional precisa usar a experiência consolidada.');
assert.ok(!homeHtml.includes('home-notion-mirror.js'),'Home consolidada não deve reempilhar o antigo bloco visual do mapa do Notion.');
assert.ok(parity.includes('Abrir espelho do Notion')&&parity.includes('notion/'),'Shell v11 precisa manter acesso explícito ao espelho seguro do Notion.');
assert.ok(more.includes("title:'Meu Notion'")&&more.includes("href:`${BASE}notion/`"),'Mais precisa manter acesso ao mapa.');
assert.ok(front.includes('protectedView')&&front.includes('Banco referenciado'),'Front precisa representar páginas e bancos protegidos sem linhas.');
assert.ok(front.includes('data/notion-mirror/search.json')&&front.includes('loadSearchIndex'),'Busca deve continuar sob demanda.');
assert.ok(!/NOTION_TOKEN|api\.notion\.com/i.test(front+html+more+parity),'O navegador não pode conter token nem chamar a API do Notion.');
if(!index.quarantined){
 assert.equal(index.publicScope,'safe','Snapshot real publicado precisa declarar publicScope=safe.');
 assert.equal(index.recordCount,0,'Snapshot público não pode conter linhas de banco.');
 assert.ok((index.pages||[]).every(page=>typeof page.protected==='boolean'),'Índice precisa classificar páginas públicas/protegidas.');
 assert.ok((index.databases||[]).every(db=>db.protected&&!(db.shards||[]).length),'Bancos publicados precisam estar protegidos e sem shards.');
}
console.log('Mapa seguro do Notion validado: rota explícita no shell v11, zero linhas de banco, busca sob demanda, PWA leve e triggers pós-sync alinhados.');
