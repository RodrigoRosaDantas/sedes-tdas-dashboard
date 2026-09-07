import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read=file=>fs.readFile(file,'utf8');
const[index,postExam,shell,palette,sw,preserve,versionSync,platform]=await Promise.all([
 read('index.html'),
 read('assets/integration/post-exam-home.js'),
 read('assets/integration/site-parity-v11.js'),
 read('assets/tdas-command-palette.js'),
 read('sw.js'),
 read('scripts/preserve-v27-pwa.mjs'),
 read('scripts/sync-platform-version.mjs'),
 read('data/platform-version.json').then(JSON.parse)
]);

assert.match(index,/data-post-exam-home="2"/,'A Home deve declarar o contrato pós-prova nativo.');
assert.match(index,/post-exam-home\.js\?v=2\.0\.0/,'A Home deve carregar o renderer pós-prova nativo.');
assert.match(index,/site-parity-v11\.js\?v=1\.2\.0/,'A Home deve carregar o shell pós-prova atual.');
assert.doesNotMatch(index,/home-dashboard-pro-2026\.js|dashboard-pro-2026\.css/,'A Home pós-prova não pode reconstruir o dashboard de reta final.');
assert.doesNotMatch(index,/edital-evidence-runtime\.js|update-button-mobile-fix\.js/,'A Home não deve carregar runtimes sem uso funcional.');
const activeRefs=[...index.matchAll(/(?:src|href)="([^"]+)"/g)].map(match=>match[1]);
for(const legacy of['home-mobile.js','home-study-intelligence.js','home-command-center.js','home-v27.js','home-v28.js','home-notion-mirror.js','command-center.css','tdas-pro-dashboard.css','home-mobile-hotfix.css','v27.css','v28-home.css'])assert.ok(!activeRefs.some(ref=>ref.includes(legacy)),`A Home não deve reempilhar a camada legada ${legacy}.`);

assert.match(postExam,/setupShell\('home'/,'A Home pós-prova deve inicializar o shell e a publicação existentes.');
for(const source of['data/home.json','data/edital-status.json','data/subjects.json','data/platform-version.json','data/sync-history.json'])assert.ok(postExam.includes(source),`Home pós-prova deve consumir ${source}.`);
for(const marker of[
 'O ciclo terminou. Agora é acompanhar o concurso.',
 'Gabarito preliminar',
 'Sem data oficial cadastrada. O site não inventa prazo.',
 'O que acontece agora',
 'Correção e recursos',
 'Gabarito definitivo',
 'Classificação e convocações',
 'FOTOGRAFIA FINAL',
 'ARQUIVO DO CICLO',
 'Atualizar dados'
])assert.ok(postExam.includes(marker),`Home pós-prova perdeu ${marker}.`);
for(const forbidden of['ORIENTAÇÃO DE HOJE','Reta final','Use o tempo que você realmente tem.','Dashboard para decidir o próximo bloco.','dias para a prova','Continuar estudo'])assert.ok(!postExam.includes(forbidden),`Home pós-prova não pode reintroduzir linguagem pré-prova: ${forbidden}.`);
assert.doesNotMatch(postExam,/readSessionDraft|selectPrimaryAction|buildOfficialCycleTasks|setupPlan|daysUntilExam/,'Home pós-prova não deve recalcular obrigação diária ou plano de estudo.');

assert.match(postExam,/actions\/workflows\/notion-sync\.yml/,'Atualização deve continuar usando o workflow Notion existente.');
assert.match(postExam,/api\.github\.com\/repos\/\$\{REPOSITORY\}\/actions\/workflows\/notion-sync\.yml\/runs/,'Home deve consultar somente o status público do workflow.');
assert.match(postExam,/Run workflow/,'Interface deve explicar a atualização autenticada no GitHub.');
assert.match(postExam,/function workflowInfo\(run,publishedAt=''/,'Status deve considerar o snapshot publicado.');
assert.doesNotMatch(postExam,/api\.notion\.com|Authorization\s*:|Bearer\s+|ghp_[A-Za-z0-9]|github_pat_/,'O navegador não pode receber credenciais nem chamar o Notion diretamente.');

for(const marker of['Pós-prova','Histórico','Check do Edital','Redações','Arquivo do ciclo','Operações'])assert.ok(shell.includes(marker),`Shell pós-prova deve preservar ${marker}.`);
assert.ok(!/\{id:'execute',label:'Resolver questões'/.test(shell),'Resolver questões não deve ocupar navegação principal pós-prova.');
assert.ok(!/\{id:'reviews',label:'Revisões'/.test(shell),'Revisões não devem ocupar navegação principal pós-prova.');
assert.match(palette,/group:'Agora'.*label:'Pós-prova'/s,'Busca global deve priorizar o pós-prova.');
assert.match(palette,/group:'Arquivo'.*label:'Resolver questões'/s,'Resolver deve permanecer acessível como arquivo opcional.');

for(const marker of['.post26-hero','.post26-summary','.post26-timeline','.post26-lower','.post26-system','@media(max-width:1100px)','@media(max-width:780px)','@media(max-width:430px)','@media(prefers-reduced-motion:reduce)'])assert.ok(index.includes(marker),`Camada pós-prova responsiva deve conter ${marker}.`);

for(const asset of['assets/integration/post-exam-home.js','assets/integration/site-parity-v11.js']){
 assert.ok(sw.includes(asset),`Service worker deve precachear ${asset}.`);
 assert.ok(preserve.includes(asset),`Overlay PWA deve preservar ${asset}.`);
}
assert.match(preserve,/preservePostExamRuntime/,'PWA deve manter runtime pós-prova em rede fresca com fallback.');
assert.match(versionSync,/VISUAL_CACHE_REV='cachefix7-postexam-pro12'/,'Gerador deve manter a revisão pós-prova PRO12.');
assert.match(platform.serviceWorkerVersion,/cachefix7-postexam-pro12$/,'Manifesto deve manter a invalidação do cache pré-prova.');
assert.match(sw,/cachefix7-postexam-pro12/,'Service worker deve usar a revisão pós-prova PRO12.');
assert.ok(!sw.includes('question-keys/'),'Gabaritos devem continuar fora do precache.');

console.log('Home TDAS pós-prova v2 validada: próximo marco, linha do tempo, memória do ciclo, arquivo preservado, navegação enxuta e PWA protegido.');
