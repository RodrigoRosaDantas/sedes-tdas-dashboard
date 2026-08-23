import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const read=file=>fs.readFile(file,'utf8');
const[homeHtml,resolverHtml,bootstrap,bank,player,continuity,homeV27,bridge,guard,archive,more,notionHome,sw,syncWorkflow,preserveV27,preserveHistory]=await Promise.all([
 'index.html','resolver/index.html','assets/integration/resolver-bootstrap.js','assets/integration/question-bank.js','assets/integration/question-bank-player.js','assets/integration/continuity-engine.js','assets/integration/home-v27.js','assets/integration/review-catalog-bridge.js','assets/integration/bank-draft-guard.js','assets/integration/question-catalog-archive.js','assets/more.js','assets/integration/home-notion-mirror.js','sw.js','.github/workflows/notion-sync.yml','scripts/preserve-v27-pwa.mjs','scripts/preserve-private-history-pwa.mjs'
].map(read));
assert.ok(homeHtml.includes('assets/v27.css')&&homeHtml.includes('home-v27.js'),'Home não carrega a experiência v27.');
assert.ok(resolverHtml.includes('assets/v27.css')&&resolverHtml.includes('resolver-bootstrap.js'),'Resolver não usa o bootstrap v27.');
assert.ok(!resolverHtml.includes('src="/sedes-tdas-dashboard/assets/integration/module-player.js'),'Player diário não pode ser carregado em paralelo ao roteador.');
assert.ok(bootstrap.includes("params.get('modo')==='banco'")&&bootstrap.includes('question-bank-player.js'),'Modo Banco não está roteado.');
assert.ok((bootstrap.includes('bank-draft-guard.js')&&bootstrap.includes('data.bankSwitch'))||bootstrap.includes('bankSwitch'),'Resolver diário precisa expor o Banco e proteger o rascunho.');
assert.ok(bootstrap.includes("dataset.questionMode='review-handoff'")&&bootstrap.includes("target=new URL(BASE+'revisar/'")&&!bootstrap.includes('installReviewCatalogBridge'),'Links históricos de revisão devem sair do player e fazer handoff para Prioridades.');
assert.ok(bank.includes('loadAllCatalogs')&&bank.includes('buildMergedBankKey')&&bank.includes('sourceKeyPath'),'Banco precisa usar acervo autorizado e manter origem do gabarito.');
assert.ok(player.includes('loadMergedBankKey')&&player.includes('data-module-finish')&&player.includes('A última questão encerra a navegação'),'Player do Banco precisa corrigir só no fechamento e não repetir a primeira questão.');
assert.ok(player.includes('data-bank-available')&&player.includes('data-bank-count'),'Quantidade disponível e tamanho da bateria precisam ser visíveis.');
assert.ok(guard.includes('stopImmediatePropagation')&&guard.includes('Continuar sessão do PE'),'Uma bateria nova não pode apagar rascunho silenciosamente.');
assert.ok(continuity.includes("startsWith('tdas-bank-')")&&continuity.includes('dueSignals')&&continuity.includes("kind:'priorities'")&&!continuity.includes("priority:80,label:`Revisar"),'Continuidade deve distinguir Banco e sinais de prioridade sem preempção por revisão interna.');
assert.ok(homeV27.includes('Continuar de onde parei')&&homeV27.includes('v27Primary')&&homeV27.includes('prioridades para o fluxo externo'),'Home precisa promover a próxima ação local e tratar revisão apenas como direcionamento externo.');
assert.ok(bridge.includes('loadCatalogForQuestion')&&bridge.includes('question-catalog.json'),'Bridge histórico deve permanecer disponível apenas para compatibilidade de dados antigos.');
assert.ok(archive.includes('loadAllCatalogs')&&archive.includes('loadCatalogForQuestion'),'Arquivo de catálogos precisa expor leitura agregada.');
assert.ok(more.includes("title:'Banco de questões'")&&more.includes('resolver/?modo=banco'),'Banco precisa ser descoberto em Mais.');
assert.ok(more.includes("title:'Prioridades'")&&more.includes('revisar/'),'Prioridades externas precisam ser descobertas em Mais.');
assert.ok(notionHome.includes("main.querySelector('[data-v27-continuity]')")&&notionHome.includes('continuity.after(s)'),'Espelho do Notion deve vir depois da fila de execução quando a v27 estiver ativa.');
const v27Assets=['assets/v27.css','assets/integration/question-bank.js','assets/integration/question-bank-player.js','assets/integration/bank-draft-guard.js','assets/integration/review-catalog-bridge.js','assets/integration/resolver-bootstrap.js','assets/integration/continuity-engine.js','assets/integration/home-v27.js'];
for(const asset of v27Assets){assert.ok(sw.includes(`"${asset}"`),`${asset} precisa estar no precache.`);assert.ok(preserveV27.includes(`'${asset}'`),`${asset} precisa estar blindado contra regeneração do PWA.`)}
assert.ok(!/question-keys\//.test((sw.match(/const (?:ASSETS|DATA)=\[[^;]+/g)||[]).join('\n')),'Gabaritos não podem entrar no precache inicial.');
assert.ok(!/question-keys\//.test(preserveV27),'Preservação v27 não pode adicionar gabaritos ao PWA.');
assert.ok(preserveHistory.includes('REMOVE_ASSETS')&&preserveHistory.includes('firebase-history-store.js')&&preserveHistory.includes('local-only-result-policy.js'),'Guarda pós-sync deve remover histórico pessoal da nuvem e preservar apenas a política local-only.');
const postprocessIndex=syncWorkflow.indexOf('node scripts/postprocess-v26.mjs');
const platformIndex=syncWorkflow.indexOf('node scripts/sync-platform-version.mjs');
const historyIndex=syncWorkflow.indexOf('node scripts/preserve-private-history-pwa.mjs');
const telemetryIndex=syncWorkflow.indexOf('node scripts/preserve-local-telemetry-pwa.mjs');
const notionIndex=syncWorkflow.indexOf('node scripts/preserve-notion-mirror-pwa.mjs');
const v27Index=syncWorkflow.indexOf('node scripts/preserve-v27-pwa.mjs');
const checkIndex=syncWorkflow.indexOf('npm run check');
assert.ok(postprocessIndex>=0&&platformIndex>postprocessIndex&&historyIndex>platformIndex&&telemetryIndex>historyIndex&&notionIndex>telemetryIndex&&v27Index>notionIndex&&checkIndex>v27Index,'Sync operacional deve regenerar/versionar, reaplicar todas as preservações e só depois validar.');
console.log('TDAS v27: contrato estrutural, prioridades externas e persistência local-only validados.');
