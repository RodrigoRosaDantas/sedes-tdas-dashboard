import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const read = file => fs.readFile(path.join(ROOT, file), 'utf8');
const readJson = async file => JSON.parse(await read(file));
const required = (condition, message) => { if (!condition) throw new Error(message); };

const files = {
  study: await read('estudar/index.html'),
  resolver: await read('resolver/index.html'),
  review: await read('revisar/index.html'),
  errorBook: await read('caderno-erros/index.html'),
  performance: await read('desempenho/index.html'),
  auditAlias: await read('fila-ia/index.html'),
  realStudy: await read('assets/integration/real-study.js'),
  home: await read('assets/home.js'),
  more: await read('assets/more.js'),
  manifest: await read('manifest.webmanifest'),
  postprocess: await read('scripts/postprocess-v26.mjs'),
  sw: await read('sw.js'),
};

required(files.study.includes('assets/integration/real-study.js'), 'A Central de estudo não carrega o módulo de operação real.');
required(!files.study.includes('pilot-catalog.js') && !files.study.includes('player.js'), 'A Central de estudo ainda referencia código do piloto.');
required(files.resolver.includes('/sedes-tdas-dashboard/hoje/'), 'A rota Resolver não aponta para Hoje.');
required(files.review.includes('/sedes-tdas-dashboard/questoes-erros/'), 'A rota Revisar não aponta para o caderno oficial.');
required(files.errorBook.includes('/sedes-tdas-dashboard/questoes-erros/'), 'A rota Caderno de erros não aponta para o caderno oficial.');
required(files.performance.includes('/sedes-tdas-dashboard/evolucao/'), 'A rota Desempenho não aponta para Evolução.');
required(files.auditAlias.includes('/sedes-tdas-dashboard/auditoria/'), 'A antiga Fila de IA não aponta para Auditoria.');

required(files.realStudy.includes("loadJSON('data/home.json')"), 'A Central de estudo não lê home.json.');
required(files.realStudy.includes("loadJSON('data/today.json')"), 'A Central de estudo não lê today.json.');
required(files.realStudy.includes("loadJSON('data/more.json')"), 'A Central de estudo não lê as fontes oficiais.');
required(!/pe76-catalog|pe76-key|pilot-catalog|player-core|data\/integration\/pilot/i.test(files.realStudy), 'A Central de estudo tenta ler o catálogo de exemplo.');

required(files.home.includes('Central de estudo'), 'A página inicial não anuncia a operação real.');
required(!files.home.includes('Estudar questões'), 'A página inicial ainda anuncia o catálogo de questões.');
required(!/Resolver questões|catálogo, sessões|revisões D\+1/i.test(files.more), 'O menu Mais ainda anuncia funções do piloto.');

const navigation = await readJson('data/integration/navigation.json');
required(navigation.mode === 'real-operations', 'A navegação não está no modo real-operations.');
required(navigation.invariants.includes('no-question-bank-read'), 'A governança técnica não proíbe leitura do banco de questões.');
required(navigation.invariants.includes('official-notion-sources-only'), 'A governança técnica não restringe as fontes aos bancos oficiais.');

const manifest = JSON.parse(files.manifest);
required(manifest.description.includes('Controle de Questões'), 'O manifesto não descreve as fontes reais.');
required(manifest.shortcuts.some(item => item.url === '/sedes-tdas-dashboard/estudar/'), 'O manifesto não possui atalho para a Central de estudo.');
required(!manifest.shortcuts.some(item => /catálogo local|revisões locais|desempenho local/i.test(item.description)), 'O manifesto ainda contém atalhos do piloto.');

for (const route of ['estudar/','resolver/','revisar/','caderno-erros/','desempenho/','fila-ia/']) {
  required(files.postprocess.includes(`'${route}'`), `O gerador do service worker não preserva a rota ${route}.`);
  required(files.sw.includes(`'${route}'`), `O service worker atual não preserva a rota ${route}.`);
}
required(files.postprocess.includes("'assets/integration/real-study.js'"), 'O gerador do service worker não inclui a operação real.');
required(files.sw.includes("'assets/integration/real-study.js'"), 'O service worker atual não inclui a operação real.');

const activeSurface = Object.values(files).join('\n');
for (const forbidden of [
  'a1d5fc8f8e434105861faba90dc156d9',
  'sedes-df-questoes',
  'data/integration/pilot/pe76-catalog.json',
  'data/integration/pilot/pe76-key.json',
]) {
  required(!activeSurface.includes(forbidden), `A superfície operacional referencia fonte proibida: ${forbidden}.`);
}

console.log('Operação real validada: três bancos oficiais, zero leitura do banco de questões e zero carregamento do piloto.');
