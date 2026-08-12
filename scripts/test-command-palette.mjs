import assert from'node:assert/strict';
import fs from'node:fs/promises';
const read=file=>fs.readFile(file,'utf8');
const readJson=file=>fs.readFile(file,'utf8').then(JSON.parse);
const[palette,css,shell,sw,postprocess,version]=await Promise.all([
 read('assets/tdas-command-palette.js'),read('assets/tdas-command-palette.css'),read('assets/tdas-mobile-ux.js'),read('sw.js'),read('scripts/postprocess-v26.mjs'),readJson('data/platform-version.json')
]);
for(const label of ['Faça agora','Resolver questões','Revisões','Caderno de erros','Progresso','Check do Edital','Plano PE01–PE112','Biblioteca','Redações','Bancos de dados','Configurações'])assert.ok(palette.includes(label),`Palette deve indexar ${label}.`);
for(const marker of ['readSessionDraft','Continuar ${draft.peId','Revisar agora','Tratar ${errors.length','Array.from({length:112}','data/subjects.json','data/agenda.json','data/home.json'])assert.ok(palette.includes(marker),`Palette deve preservar ${marker}.`);
assert.match(palette,/event\.metaKey\|\|event\.ctrlKey/,'Palette deve aceitar Cmd/Ctrl+K.');
assert.match(palette,/event\.key==='\/'/,'Palette deve aceitar atalho /.');
assert.match(palette,/ArrowDown/,'Palette deve navegar por seta para baixo.');
assert.match(palette,/ArrowUp/,'Palette deve navegar por seta para cima.');
assert.match(palette,/event\.key==='Enter'/,'Palette deve abrir o item selecionado com Enter.');
assert.match(palette,/event\.key==='Escape'/,'Palette deve fechar com Escape.');
assert.match(palette,/tdas-player-focus/,'Palette deve respeitar o modo focado do player.');
assert.match(palette,/lastFocus/,'Palette deve restaurar foco ao fechar.');
assert.match(palette,/event\.key==='Tab'/,'Palette deve conter foco no diálogo.');
assert.ok(!palette.includes('api.notion.com'),'Palette não pode chamar a API do Notion diretamente.');
assert.ok(!palette.includes('question-keys'),'Palette não pode conhecer nem carregar caminho de gabarito.');
for(const marker of ['tdas-command-overlay','tdas-command-dialog','tdas-command-item','tdas-command-trigger','tdas-command-open'])assert.ok(css.includes(marker),`CSS deve conter ${marker}.`);
assert.match(shell,/tdas-command-palette\.css\?v=1/,'Shell deve carregar CSS da palette.');
assert.match(shell,/tdas-command-palette\.js\?v=1\.0\.0/,'Shell deve importar a palette.');
for(const item of ['assets/tdas-command-palette.css','assets/tdas-command-palette.js']){assert.ok(sw.includes(item),`PWA deve precachear ${item}.`);assert.ok(postprocess.includes(item),`Pós-processamento deve preservar ${item}.`)}
assert.match(version.serviceWorkerVersion,/pro4$/,'Manifesto deve usar cache PRO4.');
assert.match(sw,/pro4/,'Service worker deve usar cache PRO4.');
assert.ok(!sw.includes('question-keys/'),'Gabarito continua fora do precache inicial.');
console.log('Command Palette TDAS validada: ações, PE01–PE112, matérias, sessão/revisão local, teclado, foco, PWA e blindagem do gabarito.');
