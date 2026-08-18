import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const read=file=>fs.readFile(file,'utf8');
const readJson=file=>fs.readFile(file,'utf8').then(JSON.parse);
const [shell,css,proCss,moduleCss,moduleUx,errorBook,studyUx,homeModule,agendaModule,enhancements,settings,index,configHtml,more,sw,postprocess,platform,homeData,history,subjectsIndex,syncVersion]=await Promise.all([
 read('assets/tdas-mobile-ux.js'),read('assets/tdas-mobile-ux.css'),read('assets/tdas-pro-dashboard.css'),read('assets/tdas-pro-modules.css'),read('assets/tdas-pro-modules.js'),read('assets/integration/module-error-book-base.js'),read('assets/integration/study-ux.js'),read('assets/home-mobile.js'),read('assets/agenda.js'),read('assets/enhance-v20.js'),read('assets/settings.js'),read('index.html'),read('configuracoes/index.html'),read('assets/more.js'),read('sw.js'),read('scripts/postprocess-v26.mjs'),readJson('data/platform-version.json'),readJson('data/home.json'),readJson('data/sync-history.json'),read('assets/subjects-index.js'),read('scripts/sync-platform-version.mjs')
]);

for(const text of ['Hoje','Questões','Erros','Mentor','Mais'])assert.ok(shell.includes(`'${text}'`),`Barra mobile deve conter ${text}.`);
const navDefinition=shell.match(/const items=\[([\s\S]*?)\];nav\.innerHTML/)?.[1]||'';
assert.match(navDefinition,/\['home','Hoje'.*\['resolver','Questões'.*\['caderno','Erros'.*\['mentor','Mentor'.*\['mais','Mais'/s,'Barra inferior deve manter exatamente Hoje, Questões, Erros, Mentor e Mais.');
assert.ok(!navDefinition.includes("['revisar','Revisar'"),'Revisar não pode competir na navegação principal.');
for(const group of ['TDAS','Sistema'])assert.ok(shell.includes(`['${group}'`),`Drawer deve conter grupo ${group}.`);
for(const label of ['Hoje','Questões','Erros','Mentor','Check do Edital','Riscos','Plano PE01–PE112','Mais'])assert.ok(shell.includes(label),`Navegação canônica deve conter ${label}.`);
assert.ok(!shell.includes('Central de comando'),'Shell não deve reconstruir uma segunda identidade chamada Central de comando.');
assert.match(shell,/Navegação TDAS/,'Desktop deve usar um único rótulo de navegação.');
assert.match(shell,/Técnico Administrativo · Cargo 202/,'Cabeçalho deve identificar Cargo 202.');
assert.match(shell,/data-menu-toggle/,'Shell deve expor botão Menu.');
assert.match(shell,/Escape/,'Drawer deve fechar por Escape.');
assert.match(shell,/touchstart/,'Drawer deve possuir gesto touch.');
assert.match(shell,/study-ux\.js\?v=1\.0\.0/,'Shell deve carregar a camada de UX de estudo.');
assert.match(shell,/tdas-pro-modules\.js\?v=2\.0\.0/,'Shell deve carregar a convergência transversal sem cockpit concorrente.');
for(const state of ['Dados atualizados','Dados desatualizados','Offline','Verificação indisponível'])assert.ok(shell.includes(state),`Badge deve suportar estado ${state}.`);
assert.match(shell,/window\.addEventListener\('online',refreshPublication\)/,'Reconexão deve consultar novamente a publicação.');
assert.match(shell,/tdas\.202\.view-comfort\.v1/,'Modo confortável deve usar chave local isolada do Cargo 202.');
assert.match(shell,/tdas\.202\.font-scale\.v1/,'Texto ampliado deve usar chave local isolada do Cargo 202.');

assert.match(moduleUx,/removeLegacyDecorations/,'Convergência deve remover decorações antigas já renderizadas.');
assert.match(moduleUx,/renderReviewHandoff/,'Rota Revisar deve virar handoff explícito.');
assert.match(moduleUx,/A revisão pedagógica acontece no ChatGPT/,'Revisão deve declarar o papel do ChatGPT.');
assert.match(moduleUx,/Notion/,'Handoff deve declarar a consolidação no Notion.');
assert.match(moduleUx,/redirectLegacyReview/,'Links antigos de revisão devem ser interceptados.');
assert.ok(!moduleUx.includes('data-pro-scorecard'),'Camada transversal não pode voltar a injetar scorecard concorrente.');
assert.ok(!moduleUx.includes('data-pro-crossnav'),'Camada transversal não pode voltar a injetar segunda navegação interna.');
assert.ok(!moduleUx.includes('Feche a fila antes de aumentar o volume'),'Revisão interna não deve preemptar o fluxo principal.');
assert.ok(!moduleUx.includes('api.notion.com'),'Camada de UX não pode consultar diretamente a API do Notion.');

assert.match(errorBook,/Respostas divergentes/,'Caderno deve tratar divergência como evidência bruta.');
assert.match(errorBook,/classificação pedagógica acontece no ChatGPT/,'Caderno deve encaminhar análise pedagógica ao ChatGPT.');
assert.match(errorBook,/consolidação no Notion/,'Caderno deve explicitar destino consolidado.');
assert.ok(!/erros confirmados|erro confirmado/i.test(errorBook),'Caderno não pode classificar automaticamente resposta incorreta como erro pedagógico confirmado.');
assert.match(subjectsIndex,/setupShell\('materias',d\.meta\)/,'Matérias deve declarar sua própria rota ao shell.');
assert.ok(!subjectsIndex.includes("setupShell('riscos'"),'Matérias não pode selecionar Riscos como estado ativo.');

assert.match(css,/prefers-reduced-motion:reduce/,'CSS deve respeitar movimento reduzido.');
assert.match(css,/\.tdas-view-comfort/,'CSS deve implementar modo confortável.');
assert.match(css,/\.tdas-view-large-text/,'CSS deve implementar texto ampliado.');
for(const marker of ['Product Design System PRO','--pro-violet','tdas-hero-aside','tdas-pro-grid','tdas-insight-grid','tdas-result-ring'])assert.ok(css.includes(marker),`Design PRO deve preservar ${marker}.`);
for(const marker of ['tdas-command-search','tdas-performance-chart','tdas-week-strip','tdas-edital-summary','tdas-acervo-metrics','tdas-nav-copy'])assert.ok(proCss.includes(marker),`Componentes avançados devem preservar ${marker}.`);
for(const marker of ['tdas-pro-contextbar','tdas-module-scorecard','tdas-module-trail','tdas-module-command','tdas-pro-crossnav'])assert.ok(moduleCss.includes(marker),`CSS legado pode permanecer compatível com ${marker} sem que o JS o injete.`);

assert.match(studyUx,/tdas\.202\.error-causes\.v1/,'Diagnóstico de causa deve usar chave local isolada.');
for(const label of ['Não sabia','Confundi conceitos','Esqueci a regra','Interpretei errado','Pressa','Pegadinha'])assert.ok(studyUx.includes(label),`Diagnóstico deve oferecer ${label}.`);
assert.match(studyUx,/correção somente ao finalizar/i,'Player deve preservar correção cega até finalizar.');
assert.match(homeModule,/Próximo passo/,'Home deve começar pelo próximo passo.');
assert.match(homeModule,/d\.today\.pe/,'Home deve usar o PE oficial do snapshot.');
assert.match(homeModule,/resolver\/\?pe=/,'Home deve manter CTA de Questões.');
assert.match(agendaModule,/class="card timeline-item" href=/,'Cartões da Agenda devem permanecer ações diretas para o estudo.');
assert.match(enhancements,/item\.matches\('a\[href\]'\)/,'Agenda não pode receber link dentro de link.');
for(const label of ['Release técnica','Versão dos dados','Última execução real','Próxima janela','Service worker','Dados locais','Modo confortável','Texto ampliado','Fontes oficiais'])assert.ok(settings.includes(label),`Configurações deve conter ${label}.`);
assert.match(index,/home-mobile\.js/,'Home pública deve usar o módulo novo.');
assert.match(configHtml,/settings\.js/,'Rota Configurações deve carregar seu módulo.');
assert.match(more,/configuracoes\//,'Tela Mais deve encaminhar para Configurações.');

for(const item of ['configuracoes/','assets/home-mobile.js','assets/tdas-mobile-ux.js','assets/tdas-mobile-ux.css','assets/tdas-pro-dashboard.css','assets/tdas-pro-modules.css','assets/tdas-pro-modules.js','assets/tdas-command-palette.css','assets/tdas-command-palette.js','assets/settings.js','assets/integration/study-ux.js']){assert.ok(sw.includes(item),`PWA deve incluir ${item}.`);assert.ok(postprocess.includes(item),`Gerador do PWA deve preservar ${item}.`)}
assert.ok(!sw.includes('question-keys/'),'Gabarito não pode entrar no precache do TDAS.');
assert.match(syncVersion,/VISUAL_CACHE_REV='pro8'/,'Gerador do manifesto deve preservar a revisão visual PRO8.');
const lastValidSync=(history.entries||[]).find(item=>['success','no_changes'].includes(item?.status)&&item?.at)?.at;
assert.equal(platform.dataVersion,homeData.meta?.version,'dataVersion deve continuar derivada do snapshot oficial.');
assert.equal(platform.syncAt,lastValidSync,'syncAt deve continuar derivada da última sincronização real, não da release visual.');
assert.equal(platform.peId,homeData.today?.pe,'PE do manifesto deve continuar alinhado ao snapshot oficial.');
assert.match(platform.serviceWorkerVersion,/pro8$/,'Cache visual deve identificar a geração PRO8.');
console.log('UX TDAS validada: navegação única, Caderno como evidência bruta, revisão ChatGPT + Notion, Matérias sem estado Riscos e PWA PRO8.');