import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const read=file=>fs.readFile(file,'utf8');
const[homeHtml,resolverHtml,bootstrap,bank,player,continuity,homeV27,bridge,guard,archive,more,notionHome,sw]=await Promise.all([
 'index.html','resolver/index.html','assets/integration/resolver-bootstrap.js','assets/integration/question-bank.js','assets/integration/question-bank-player.js','assets/integration/continuity-engine.js','assets/integration/home-v27.js','assets/integration/review-catalog-bridge.js','assets/integration/bank-draft-guard.js','assets/integration/question-catalog-archive.js','assets/more.js','assets/integration/home-notion-mirror.js','sw.js'
].map(read));
assert.ok(homeHtml.includes('assets/v27.css')&&homeHtml.includes('home-v27.js'),'Home não carrega a experiência v27.');
assert.ok(resolverHtml.includes('assets/v27.css')&&resolverHtml.includes('resolver-bootstrap.js'),'Resolver não usa o bootstrap v27.');
assert.ok(!resolverHtml.includes('src="/sedes-tdas-dashboard/assets/integration/module-player.js'),'Player diário não pode ser carregado em paralelo ao roteador.');
assert.ok(bootstrap.includes("params.get('modo')==='banco'")&&bootstrap.includes('question-bank-player.js'),'Modo Banco não está roteado.');
assert.ok(bootstrap.includes('bank-draft-guard.js')&&bootstrap.includes('data.bankSwitch')||bootstrap.includes('bankSwitch'),'Resolver diário precisa expor o Banco e proteger o rascunho.');
assert.ok(bootstrap.includes('review-catalog-bridge.js')&&!bootstrap.match(/review[\s\S]{0,300}daily-question-page\.js/),'Revisão histórica deve ficar isolada da sobreposição diária.');
assert.ok(bank.includes('loadAllCatalogs')&&bank.includes('buildMergedBankKey')&&bank.includes('sourceKeyPath'),'Banco precisa usar acervo autorizado e manter origem do gabarito.');
assert.ok(player.includes('loadMergedBankKey')&&player.includes('data-module-finish')&&player.includes('A última questão encerra a navegação'),'Player do Banco precisa corrigir só no fechamento e não repetir a primeira questão.');
assert.ok(player.includes('data-bank-available')&&player.includes('data-bank-count'),'Quantidade disponível e tamanho da bateria precisam ser visíveis.');
assert.ok(guard.includes('stopImmediatePropagation')&&guard.includes('Continuar sessão do PE'),'Uma bateria nova não pode apagar rascunho silenciosamente.');
assert.ok(continuity.includes("startsWith('tdas-bank-')")&&continuity.includes('dueReviews'),'Continuidade precisa distinguir Banco e revisões vencidas.');
assert.ok(homeV27.includes('Continuar de onde parei')&&homeV27.includes('v27Primary'),'Home precisa promover a próxima ação local.');
assert.ok(bridge.includes('loadCatalogForQuestion')&&bridge.includes('question-catalog.json'),'Revisão precisa recuperar catálogo histórico.');
assert.ok(archive.includes('loadAllCatalogs')&&archive.includes('loadCatalogForQuestion'),'Arquivo de catálogos precisa expor leitura agregada.');
assert.ok(more.includes("title:'Banco de questões'")&&more.includes('resolver/?modo=banco'),'Banco precisa ser descoberto em Mais.');
assert.ok(notionHome.includes("main.querySelector('[data-v27-continuity]')")&&notionHome.includes('continuity.after(s)'),'Espelho do Notion deve vir depois da fila de execução quando a v27 estiver ativa.');
for(const asset of['assets/v27.css','assets/integration/question-bank.js','assets/integration/question-bank-player.js','assets/integration/bank-draft-guard.js','assets/integration/review-catalog-bridge.js','assets/integration/resolver-bootstrap.js','assets/integration/continuity-engine.js','assets/integration/home-v27.js'])assert.ok(sw.includes(`"${asset}"`),`${asset} precisa estar no precache.`);
assert.ok(!/question-keys\//.test((sw.match(/const (?:ASSETS|DATA)=\[[^;]+/g)||[]).join('\n')),'Gabaritos não podem entrar no precache inicial.');
console.log('TDAS v27: contrato estrutural validado.');
