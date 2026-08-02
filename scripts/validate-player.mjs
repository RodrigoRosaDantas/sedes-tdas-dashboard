import fs from 'node:fs/promises';

const read = file => fs.readFile(file, 'utf8');
const required = (condition, message) => { if (!condition) throw new Error(message); };
const [player, core, resolver, catalogUi, packageText] = await Promise.all([
  read('assets/integration/player.js'),
  read('assets/integration/player-core.js'),
  read('resolver/index.html'),
  read('assets/integration/pilot-catalog.js'),
  read('package.json'),
]);

for (const [name, content] of [['player.js', player], ['player-core.js', core]]) {
  required(!/localStorage|sessionStorage|indexedDB/.test(content), `${name} não pode acessar diretamente o armazenamento da sessão.`);
  required(!/notion\.com|api\.notion/i.test(content), `${name} não pode acessar o Notion.`);
  required(!/method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)/i.test(content), `${name} contém escrita por rede.`);
}

required(core.includes('Object.freeze'), 'O núcleo deve preservar imutabilidade.');
required(core.includes('Todas as questões devem ser respondidas'), 'O núcleo não bloqueia tentativa incompleta.');
required(player.includes("pe76-catalog.json"), 'O player não carrega o catálogo piloto.');
required((player.match(/pe76-key\.json/g) || []).length === 1, 'O caminho do gabarito deve aparecer uma única vez.');
const finishStart = player.indexOf('async function finishSession()');
const keyPosition = player.indexOf('pe76-key.json');
required(finishStart >= 0 && keyPosition > finishStart, 'O gabarito deve ser carregado somente dentro da finalização.');
required(!player.slice(0, finishStart).includes('pe76-key.json'), 'O gabarito é carregado antes da finalização.');
required(player.includes('if (!canFinish(state.session)) return;'), 'A interface não bloqueia finalização incompleta.');
required(/(?:Este resultado não foi enviado|Nenhum dado foi enviado) ao Notion (?:nem|ou) ao progresso oficial/.test(player), 'A interface não informa o isolamento do resultado.');

required(resolver.includes('/assets/integration/player.css'), 'A rota Resolver não carrega o CSS do player.');
required(resolver.includes('/assets/integration/player.js'), 'A rota Resolver não carrega o player.');
required(!resolver.includes('/assets/integration/navigation.js'), 'A rota Resolver ainda carrega a página estrutural antiga.');
required(catalogUi.includes('${BASE}resolver/?pilot=pe76'), 'O catálogo não oferece entrada para o player pela base oficial.');
required(packageText.includes('test:player') && packageText.includes('check:player'), 'Comandos do player ausentes do package.json.');

console.log('Player validado: sessão ativa em memória, gabarito tardio, rota funcional e ausência de writeback remoto.');
