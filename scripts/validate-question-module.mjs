import fs from 'node:fs/promises';
const read=file=>fs.readFile(file,'utf8');
const required=(condition,message)=>{if(!condition)throw new Error(`Módulo de questões: ${message}`)};
const pages={
 estudar:await read('estudar/index.html'),resolver:await read('resolver/index.html'),revisar:await read('revisar/index.html'),
 erros:await read('caderno-erros/index.html'),desempenho:await read('desempenho/index.html'),fila:await read('fila-ia/index.html')
};
const bootstrap=await read('assets/integration/resolver-bootstrap.js');
const expectedScripts={estudar:'module-dashboard.js',resolver:'resolver-bootstrap.js?v=1.0.0',revisar:'module-reviews.js',erros:'module-error-book.js',desempenho:'module-performance.js',fila:'module-ai-queue.js'};
for(const[key,script]of Object.entries(expectedScripts))required(pages[key].includes(script),`${key} não carrega ${script}.`);
required(pages.resolver.includes('assets/integration/player.css'),'Resolver não carrega CSS do player.');
required(bootstrap.includes("document.documentElement.dataset.questionMode='daily'")&&bootstrap.includes('module-player.js?v=2.1.0'),'Modo diário não carrega o player oficial.');
required(bootstrap.includes("params.get('modo')==='banco'")&&bootstrap.includes('question-bank-player.js?v=1.0.0'),'Modo Banco não está isolado no roteador.');
required(bootstrap.includes('review-catalog-bridge.js?v=1.0.0'),'Revisões históricas não passam pela ponte de catálogo.');
const catalog=JSON.parse(await read('data/integration/question-catalog.json'));
required(catalog.schemaVersion==='2.1.0','catálogo deve usar schema 2.1.0.');
required(['operational','operational-empty'].includes(catalog.mode),'catálogo deve estar em modo operacional.');
required(Array.isArray(catalog.questions),'catálogo sem questions.');
if(catalog.mode==='operational')required(catalog.questionCount===catalog.questions.length,'questionCount divergente.');
else required(catalog.questionCount===0&&catalog.questions.length===0,'catálogo vazio incoerente.');
for(const question of catalog.questions){required(question.id&&question.enunciado,'questão incompleta.');required(question.alternativas&&typeof question.alternativas==='object','alternativas ausentes.');required(!('gabarito'in question)&&!('justificativa'in question),'catálogo público contém correção.');}
required(typeof catalog.keyPath==='string'&&catalog.keyPath.startsWith('data/integration/question-keys/'),'keyPath inválido.');
const key=JSON.parse(await read(catalog.keyPath));
required(key.material_id===catalog.catalogId,'gabarito não corresponde ao catálogo.');
required(Array.isArray(key.answers)&&key.answers.length===catalog.questions.length,'gabarito incompleto.');
for(const answer of key.answers)required(['A','B','C','D','E'].includes(answer.gabarito),'gabarito inválido.');
const nav=JSON.parse(await read('data/integration/navigation.json'));
for(const route of ['estudar/','resolver/','revisar/','caderno-erros/','desempenho/','fila-ia/'])required(nav.routes.some(item=>item.href.includes(route)),`navegação não contém ${route}.`);
const player=await read('assets/integration/module-player.js');
required(player.includes('fetch(catalog.keyPath')||player.includes('fetch(BASE+catalog.keyPath'),'player não carrega correção somente quando necessário.');
required(player.includes('data-module-finish'),'player não oferece finalização.');
required(player.includes('canFinish(state.session)'),'player não exige sessão completa.');
required(player.includes('evaluateSession'),'player não usa avaliação separada.');
required(player.includes('saveCompletedAttempt'),'player não salva tentativa concluída.');
required(player.includes('readSessionDraft')&&player.includes('writeSessionDraft'),'player não persiste rascunho.');
const bankPlayer=await read('assets/integration/question-bank-player.js');
required(bankPlayer.includes('loadMergedBankKey')&&bankPlayer.indexOf('loadMergedBankKey')>bankPlayer.indexOf('async function finishSession'),'Banco deve buscar gabaritos somente no fechamento.');
required(bankPlayer.includes('saveCompletedAttempt'),'Banco não grava a tentativa no mesmo histórico local.');
const store=await read('assets/integration/module-store.js');
for(const token of ['tdas.202.question-module.v2','errors','reviews','attempts'])required(store.includes(token),`store sem ${token}.`);
const review=await read('assets/integration/review-engine.js');
for(const label of ['D+1','D+7','D+20'])required(review.includes(label),`motor de revisão sem ${label}.`);
const sw=await read('sw.js');
for(const asset of ['assets/integration/module-player.js','assets/integration/module-store.js','assets/integration/review-engine.js','assets/integration/resolver-bootstrap.js','assets/integration/question-bank.js','assets/integration/question-bank-player.js','assets/integration/review-catalog-bridge.js'])required(sw.includes(asset),`PWA sem ${asset}.`);
required(!sw.includes('data/integration/question-keys/'),'gabarito não pode entrar no precache inicial.');
console.log(`Módulo de questões validado: ${catalog.questionCount} questões no catálogo diário, Banco isolado, correção cega, persistência local e revisão espaçada preservadas.`);
