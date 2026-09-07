import assert from'node:assert/strict';
import fs from'node:fs/promises';
const read=file=>fs.readFile(file,'utf8');
const readJson=file=>fs.readFile(file,'utf8').then(JSON.parse);
const[palette,css,shell,sw,postprocess,version]=await Promise.all([
 read('assets/tdas-command-palette.js'),read('assets/tdas-command-palette.css'),read('assets/integration/site-parity-v11.js'),read('sw.js'),read('scripts/postprocess-v26.mjs'),readJson('data/platform-version.json')
]);
for(const label of ['Pós-prova','Resolver questões','Prioridades','Caderno de erros','Progresso','Check do Edital','Plano PE01–PE112','Biblioteca','Redações','Bancos de dados','Configurações'])assert.ok(palette.includes(label),`Palette deve indexar ${label}.`);
for(const marker of ['readSessionDraft','Rascunho salvo · ${draft.peId','Prioridades preservadas','Erros locais · ${errors.length','Array.from({length:112},','data/subjects.json','data/agenda.json','data/home.json','Snapshot final · ${home.today.pe}'])assert.ok(palette.includes(marker),`Palette deve preservar ${marker}.`);
assert.ok(!palette.includes("label:'Faça agora'"),'Palette não pode reconstruir a ação principal pré-prova.');
assert.ok(!palette.includes('PE de hoje ·'),'Snapshot encerrado não pode reaparecer como obrigação do dia.');
assert.ok(!palette.includes("group:'Próximos PE'"),'PEs do ciclo encerrado não podem reaparecer como próximos PE.');
assert.ok(!palette.includes("group:'Continuar'"),'Rascunhos e diagnósticos não podem dominar a busca como obrigação atual.');
assert.ok(!palette.includes('resolver/?review='),'Palette não pode abrir sessão interna de revisão.');
assert.match(palette,/href:`\$\{BASE\}revisar\/`/,'Sinais locais devem encaminhar para Prioridades.');
assert.match(palette,/event\.metaKey\|\|event\.ctrlKey/,'Palette deve aceitar Cmd/Ctrl+K.');
assert.match(palette,/event\.key==='\/'/,'Palette deve aceitar atalho /.');
assert.match(palette,/ArrowDown/,'Palette deve navegar por seta para baixo.');
assert.match(palette,/ArrowUp/,'Palette deve navegar por seta para cima.');
assert.match(palette,/event\.key==='Enter'/,'Palette deve abrir o item selecionado com Enter.');
assert.match(palette,/event\.key==='Escape'/,'Palette deve fechar com Escape.');
assert.match(palette,/tdas-player-focus/,'Palette deve respeitar o modo focado do player.');
assert.match(palette,/lastFocus/,'Palette deve restaurar foco ao fechar.');
assert.match(palette,/event\.key==='Tab'/,'Palette deve conter foco no diálogo.');
assert.match(palette,/document\.querySelector\('\[data-site-search\]'\)/,'Palette não deve duplicar o acionador quando o shell global já oferece busca.');
assert.ok(!palette.includes('api.notion.com'),'Palette não pode chamar a API do Notion diretamente.');
assert.ok(!palette.includes('question-keys'),'Palette não pode conhecer nem carregar caminho de gabarito.');
for(const marker of ['tdas-command-overlay','tdas-command-dialog','tdas-command-item','tdas-command-trigger','tdas-command-open'])assert.ok(css.includes(marker),`CSS deve conter ${marker}.`);
assert.match(shell,/tdas-command-palette\.js\?v=1\.0\.2/,'Shell deve importar a palette pós-prova com revisão explícita.');
for(const item of ['assets/tdas-command-palette.css','assets/tdas-command-palette.js']){assert.ok(sw.includes(item),`PWA deve precachear ${item}.`);assert.ok(postprocess.includes(item),`Pós-processamento deve preservar ${item}.`)}
assert.match(version.serviceWorkerVersion,/postexam-pro12$/,'Manifesto deve invalidar o cache pré-prova e manter geração PRO12.');
assert.match(sw,/postexam-pro12/,'Service worker deve invalidar o cache pré-prova e manter geração PRO12.');
assert.ok(!sw.includes('question-keys/'),'Gabarito continua fora do precache inicial.');
console.log('Command Palette TDAS pós-prova validada: ações atuais, PE01–PE112 históricos, rascunhos sem preempção, teclado, foco, PWA PRO12 e blindagem do gabarito.');
