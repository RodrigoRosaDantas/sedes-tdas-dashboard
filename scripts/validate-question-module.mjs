import fs from 'node:fs/promises';
import path from 'node:path';
const ROOT=process.cwd(),read=file=>fs.readFile(path.join(ROOT,file),'utf8'),json=async file=>JSON.parse(await read(file)),exists=file=>fs.access(path.join(ROOT,file)).then(()=>true).catch(()=>false),required=(condition,message)=>{if(!condition)throw new Error(message)};
const routes={estudar:await read('estudar/index.html'),resolver:await read('resolver/index.html'),revisar:await read('revisar/index.html'),caderno:await read('caderno-erros/index.html'),desempenho:await read('desempenho/index.html'),fila:await read('fila-ia/index.html')};
const scripts={dashboard:await read('assets/integration/module-dashboard.js'),player:await read('assets/integration/module-player.js'),store:await read('assets/integration/module-store.js'),reviewEngine:await read('assets/integration/review-engine.js'),reviews:await read('assets/integration/module-reviews.js'),errors:await read('assets/integration/module-error-book.js'),performance:await read('assets/integration/module-performance.js'),queue:await read('assets/integration/module-ai-queue.js'),daily:await read('assets/integration/daily-execution.js'),todayDaily:await read('assets/integration/today-execution.js'),questionDaily:await read('assets/integration/daily-question-page.js'),bootstrap:await read('assets/integration/resolver-bootstrap.js'),bank:await read('assets/integration/question-bank.js'),bankPlayer:await read('assets/integration/question-bank-player.js'),reviewBridge:await read('assets/integration/review-catalog-bridge.js'),masterUi:await read('assets/integration/master-bank-ui.js')};
const catalog=await json('data/integration/question-catalog.json'),material=await json('data/integration/daily-material.json'),daily=await json('data/integration/daily-execution.json'),navigation=await json('data/integration/navigation.json'),manifest=await json('manifest.webmanifest'),packageData=await json('package.json');
const sw=await read('sw.js'),postprocess=await read('scripts/postprocess-v26.mjs'),preserveV27=await read('scripts/preserve-v27-pwa.mjs'),preserveHistory=await read('scripts/preserve-private-history-pwa.mjs'),pipeline=await read('scripts/notion/daily-content.mjs'),sync=await read('scripts/sync-notion.mjs'),home=await read('assets/home.js'),more=await read('assets/more.js'),morePage=await read('mais/index.html'),enhance=await read('assets/enhance-v20.js');

const expectedScripts={estudar:'module-dashboard.js',resolver:'resolver-bootstrap.js?v=1.0.0',revisar:'module-reviews.js',caderno:'module-error-book.js',desempenho:'module-performance.js',fila:'module-ai-queue.js'};
for(const[key,filename]of Object.entries(expectedScripts)){required(routes[key].includes(filename),`${key}: script real ausente.`);required(!/http-equiv="refresh"|location\.replace/.test(routes[key]),`${key}: rota ainda é redirecionamento.`)}
required(routes.estudar.includes('daily-content.css'),'Estudar não carrega os estilos do material diário.');
required(routes.resolver.includes('player.css?v=1.1.0'),'Resolver não carrega o CSS atual do player.');
required(scripts.bootstrap.includes("document.documentElement.dataset.questionMode='daily'")&&scripts.bootstrap.includes('module-player.js?v=2.1.0')&&scripts.bootstrap.includes('daily-question-page.js?v=1.0.2'),'Modo diário do Resolver não preserva player e contexto diário.');
required(scripts.bootstrap.includes("params.get('modo')==='banco'")&&scripts.bootstrap.includes('question-bank-player.js?v=1.0.0')&&scripts.bootstrap.includes('master-bank-ui.js?v=1.0.0'),'Modo Banco não está isolado ou não carrega o resumo do acervo.');
required(scripts.bootstrap.includes("dataset.questionMode='review-handoff'")&&scripts.bootstrap.includes("target=new URL(BASE+'revisar/'")&&scripts.bootstrap.includes('location.replace(target.href)'),'Links legados de revisão ainda podem abrir uma sessão dentro do Resolver.');
required(!scripts.bootstrap.includes('installReviewCatalogBridge'),'Bootstrap não pode reinstalar execução interna de revisão.');
required(routes.revisar.includes('module-reviews.js?v=3.0.0'),'Prioridades não carregam o módulo diagnóstico atual.');
required(routes.revisar.includes('data-ux-review-today="1"')&&routes.revisar.includes('O TDAS não executa mais a revisão'),'Rota de prioridades não declara explicitamente a revisão externa.');
required(scripts.reviews.includes("dataset.reviewMode='priorities-only'")&&scripts.reviews.includes('O TDAS não executa mais a revisão'),'Módulo de prioridades não preserva o contrato sem execução interna.');
required(!scripts.reviews.includes('resolver/?review=')&&!scripts.reviews.includes('Iniciar revisão'),'Módulo de prioridades recriou uma sessão de revisão interna.');

required(['operational-empty','notion-daily','notion-daily-empty'].includes(catalog.mode),`Modo de catálogo inválido: ${catalog.mode}.`);
if(catalog.mode==='operational-empty'){
 required(catalog.questionCount===0&&Array.isArray(catalog.questions)&&catalog.questions.length===0,'Catálogo de preparação contém questões.');
 required(catalog.keyPath===null&&catalog.authorizedSource===null&&catalog.peId===null,'Catálogo de preparação contém fonte, correção ou PE.');
 required(material.mode==='operational-empty','Material de preparação inválido.');
}else{
 required(/^PE\d+$/.test(catalog.peId||''),'Catálogo diário sem PE.');
 required(catalog.questionCount===catalog.questions.length,'Total do catálogo diário não fecha.');
 required(catalog.authorizedSource?.type==='notion-daily-child-page','Fonte diária não autorizada.');
 if(catalog.mode==='notion-daily')required(/^data\/integration\/question-keys\/pe\d+\.json$/i.test(catalog.keyPath||''),'Caminho da correção inválido.');
}
required(['1.0.0','1.1.0'].includes(daily.schemaVersion)&&daily.mode==='daily-execution-contract'&&daily.materialPageIds.length===112&&daily.questionPageIds.length===112,'Contrato diário ausente ou incompleto.');
required(navigation.mode==='daily-execution-local-session-only'&&navigation.routes.length===6,'Navegação do módulo divergente.');
for(const invariant of ['daily-execution-pe-links','theory-and-questions-separated','no-example-question-bank','master-bank-local-snapshot-only','no-master-bank-remote-runtime-read','active-session-draft-local-only','no-completed-attempt-history','no-personal-cloud-sync','no-internal-review-session','no-notion-writeback'])required(navigation.invariants.includes(invariant),`Invariante ausente: ${invariant}.`);

required(scripts.store.includes("tdas.202.question-module.v2.state"),'Namespace de compatibilidade local ausente.');
required(scripts.store.includes('persistent:false')&&scripts.store.includes('cloudSync:false'),'Tentativa concluída precisa ser explicitamente efêmera e sem nuvem.');
required(scripts.store.includes("mode!=='study'")&&scripts.store.includes('não executa nem persiste revisão interna'),'Store precisa bloquear execução de revisão interna.');
required(!scripts.store.includes('buildReinforcementReview')&&!scripts.store.includes('setItem(STORAGE_KEY'),'Store não pode gerar reforço adaptativo nem persistir tentativa concluída.');
required(!scripts.player.includes('review-engine.js')&&!scripts.player.includes('data-review-outcome')&&!scripts.player.includes("mode:'review'")&&!scripts.player.includes('Reforçar em 3 dias')&&!scripts.player.includes('Reforçar em 24 horas'),'Player ativo ainda contém execução interna de revisão.');
required(scripts.player.includes('Rascunho neste dispositivo')&&scripts.player.includes('não foi salvo como histórico pessoal'),'Player deve distinguir rascunho ativo de resultado efêmero.');
required(scripts.player.includes('data/integration/question-catalog.json'),'Player não carrega o catálogo diário.');
required(scripts.player.includes('safeKeyPath')&&scripts.player.includes('question-keys'),'Player não restringe o caminho da correção.');
const finishPosition=scripts.player.indexOf('async function finishSession'),keyFetchPosition=scripts.player.indexOf('state.catalog.keyPath',finishPosition),savePosition=scripts.player.indexOf("mode:'study'",finishPosition);
required(finishPosition>=0&&keyFetchPosition>finishPosition,'Correção diária pode ser solicitada antes da finalização.');
required(savePosition>finishPosition,'Resultado de estudo não é finalizado pelo store efêmero.');
required(!/localStorage|sessionStorage|indexedDB/.test(scripts.player),'Player acessa armazenamento diretamente.');

// O motor antigo pode permanecer como artefato de compatibilidade, mas não pode voltar à superfície ativa.
required(scripts.reviewEngine.includes("MASTERED:'mastered'")&&scripts.reviewEngine.includes("UNSURE:'unsure'")&&scripts.reviewEngine.includes("WRONG_AGAIN:'wrong_again'"),'Artefato histórico de revisão perdeu compatibilidade de leitura.');
const activeReviewSurface=[scripts.player,scripts.bootstrap,scripts.store,scripts.reviews].join('\n');
required(!activeReviewSurface.includes("from './review-engine.js")&&!activeReviewSurface.includes('buildReinforcementReview'),'Motor histórico de revisão reapareceu na execução ativa.');

const bankFinish=scripts.bankPlayer.indexOf('async function finishSession'),bankKey=scripts.bankPlayer.indexOf('loadMergedBankKey(state.catalog',bankFinish);
required(bankFinish>=0&&bankKey>bankFinish,'Banco pode solicitar gabarito antes da finalização.');
required(scripts.bank.includes('safeKeyPath')&&scripts.bank.includes('question-keys'),'Banco não restringe as origens de gabarito.');
required(scripts.bank.includes('master-question-bank.json')&&scripts.bank.includes("sourceKind:'master-bank'"),'Banco não lê o snapshot local publicado do Banco Mestre.');
required(scripts.bankPlayer.includes('saveCompletedAttempt')&&scripts.bankPlayer.includes('writeSessionDraft'),'Banco não usa o rascunho local e o resultado efêmero oficiais.');
required(scripts.reviewBridge.includes('loadCatalogForQuestion')&&scripts.reviewBridge.includes('question-catalog.json'),'Compatibilidade histórica não recupera catálogo de forma controlada.');
required(scripts.reviewBridge.includes('loadMasterQuestionBank')&&scripts.reviewBridge.includes("mode:'master-review'"),'Compatibilidade histórica não recupera questões do Banco Mestre pelo snapshot local.');
required(scripts.masterUi.includes('snapshot.questionCount')&&scripts.masterUi.includes('snapshot.materialCount'),'Resumo do acervo não usa os dados reais do snapshot.');
required(!/api\.notion|method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)/i.test(Object.values(scripts).join('\n')),'Módulo contém writeback ou acesso direto à API do Notion.');
required(scripts.dashboard.includes('daily-material.json')&&scripts.dashboard.includes('daily-material-content'),'Estudar não renderiza o material incorporado.');
required(scripts.questionDaily.includes('question-catalog.json')&&scripts.questionDaily.includes('Correção separada'),'Questões do dia não validam o catálogo incorporado.');
required(pipeline.includes('discoverDailyPages')&&pipeline.includes('parseDailyQuestions')&&sync.includes('prepareDailyContent'),'Pipeline automático das páginas filhas ausente.');
required(scripts.daily.includes('daily-execution.json')&&scripts.dashboard.includes('materialUrl')&&scripts.questionDaily.includes('questionsUrl'),'Fluxo diário não mantém rastreabilidade às páginas de origem.');
required(enhance.includes('dailyPeExecution')&&enhance.includes('daily-execution.js'),'PE individual não carrega a execução diária.');
required(home.includes('Estudar questões')&&home.includes('sem conteúdo de exemplo'),'Início não apresenta corretamente o módulo.');
for(const label of ['Resolver questões','Banco de questões','Prioridades','Caderno de erros','Desempenho','Fila de IA'])required(more.includes(label),`Menu Mais não preserva ${label}.`);
required(manifest.shortcuts.map(item=>item.url).join('|')===['/sedes-tdas-dashboard/estudar/','/sedes-tdas-dashboard/revisar/','/sedes-tdas-dashboard/caderno-erros/','/sedes-tdas-dashboard/desempenho/'].join('|'),'Atalhos do manifesto divergentes.');
for(const route of ['estudar/','resolver/','revisar/','caderno-erros/','desempenho/','fila-ia/'])required(sw.includes(route)&&postprocess.includes(route),`Rota fora do PWA: ${route}.`);
for(const asset of ['daily-execution.js','daily-law.js','today-execution.js','daily-question-page.js','daily-progress.js','local-backup.js','daily-content.css','module-dashboard.js','module-player.js','module-store.js','module-reviews.js','module-error-book.js','module-performance.js','module-ai-queue.js','player-core.js','player.css'])required(sw.includes(asset)&&postprocess.includes(asset),`Asset operacional fora do PWA: ${asset}.`);
for(const asset of ['assets/v27.css','assets/integration/question-bank.js','assets/integration/question-bank-player.js','assets/integration/master-bank-ui.js','assets/integration/bank-draft-guard.js','assets/integration/review-catalog-bridge.js','assets/integration/resolver-bootstrap.js','assets/integration/continuity-engine.js'])required(sw.includes(asset)&&preserveV27.includes(`'${asset}'`),`Asset v27/v28 sem blindagem PWA: ${asset}.`);
required(preserveV27.includes('data/integration/master-question-bank.json'),'Snapshot público do Banco Mestre não está sob preservação PWA.');
required(preserveHistory.includes('const retired=[')&&preserveHistory.includes('private-history-sync-v3.js')&&!preserveHistory.includes('question-archive/index.json'),'Guard local-only do PWA não protege corretamente a retirada do histórico pessoal.');
for(const dataFile of ['data/integration/navigation.json','data/integration/question-catalog.json','data/integration/daily-execution.json','data/integration/daily-material.json'])required(sw.includes(dataFile)&&postprocess.includes(dataFile),`Dado fora do PWA: ${dataFile}.`);
required(!sw.includes('question-keys/')&&!postprocess.includes('question-keys/')&&!preserveV27.includes("'data/integration/question-keys/"),'Correção foi incluída no precache.');
required(!morePage.includes('backup-migration-ui.js'),'Tela Mais ainda carrega a migração do piloto.');
const activeSurface=[...Object.values(routes),...Object.values(scripts),home,more,morePage,JSON.stringify(manifest),JSON.stringify(navigation),sw,postprocess,preserveV27].join('\n');
for(const forbidden of ['pe76-catalog','pe76-key','pilot-catalog','real-study','?pilot=pe76','a1d5fc8f8e434105861faba90dc156d9','RodrigoRosaDantas/sedes-df-questoes'])required(!activeSurface.includes(forbidden),`Superfície ativa contém referência proibida: ${forbidden}.`);
for(const removed of ['assets/integration/pilot-catalog.js','assets/integration/player.js','assets/integration/pe-pilot-status.js','data/integration/pilot/pe76-catalog.json','data/integration/pilot/pe76-key.json'])required(!(await exists(removed)),`Arquivo de exemplo ainda presente: ${removed}.`);
required(packageData.scripts?.check?.includes('validate-daily-content.mjs')&&packageData.scripts?.check?.includes('validate-question-module.mjs')&&packageData.scripts?.check?.includes('test-review-engine.mjs')&&packageData.scripts?.check?.includes('test-question-module.mjs'),'Validação integral fora do gate principal.');
console.log(`Módulo validado: conteúdo diário ${catalog.mode}, seis rotas, Banco Mestre local, sessão ativa local-only, resultado efêmero, revisão externa por Prioridades e correção carregada somente ao finalizar.`);
