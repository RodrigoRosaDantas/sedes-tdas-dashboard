import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const read = file => fs.readFile(path.join(ROOT, file), 'utf8');
const json = async file => JSON.parse(await read(file));
const exists = file => fs.access(path.join(ROOT, file)).then(() => true).catch(() => false);
const required = (condition, message) => { if (!condition) throw new Error(message); };

const routes = {
  estudar: await read('estudar/index.html'),
  resolver: await read('resolver/index.html'),
  revisar: await read('revisar/index.html'),
  caderno: await read('caderno-erros/index.html'),
  desempenho: await read('desempenho/index.html'),
  fila: await read('fila-ia/index.html'),
};
const scripts = {
  dashboard: await read('assets/integration/module-dashboard.js'),
  player: await read('assets/integration/module-player.js'),
  store: await read('assets/integration/module-store.js'),
  reviews: await read('assets/integration/module-reviews.js'),
  errors: await read('assets/integration/module-error-book.js'),
  performance: await read('assets/integration/module-performance.js'),
  queue: await read('assets/integration/module-ai-queue.js'),
};
const catalog = await json('data/integration/question-catalog.json');
const navigation = await json('data/integration/navigation.json');
const manifest = await json('manifest.webmanifest');
const packageData = await json('package.json');
const sw = await read('sw.js');
const postprocess = await read('scripts/postprocess-v26.mjs');
const home = await read('assets/home.js');
const more = await read('assets/more.js');

const expectedScripts = {
  estudar: 'module-dashboard.js',
  resolver: 'module-player.js',
  revisar: 'module-reviews.js',
  caderno: 'module-error-book.js',
  desempenho: 'module-performance.js',
  fila: 'module-ai-queue.js',
};
for (const [key, filename] of Object.entries(expectedScripts)) {
  required(routes[key].includes(filename), `${key}: script real ausente.`);
  required(!/http-equiv="refresh"|location\.replace/.test(routes[key]), `${key}: rota ainda é redirecionamento.`);
}
required(catalog.mode === 'operational-empty', 'Catálogo não está no estado operacional vazio.');
required(catalog.questionCount === 0 && Array.isArray(catalog.questions) && catalog.questions.length === 0, 'Catálogo vazio contém questões.');
required(catalog.keyPath === null && catalog.authorizedSource === null && catalog.peId === null, 'Catálogo vazio contém gabarito, fonte ou PE.');
required(navigation.mode === 'module-ready-empty' && navigation.routes.length === 6, 'Navegação do módulo divergente.');
for (const invariant of ['no-example-question-bank','no-master-bank-runtime-read','authorized-catalog-only','local-storage-v2-only','no-notion-writeback']) {
  required(navigation.invariants.includes(invariant), `Invariante ausente: ${invariant}.`);
}
required(scripts.store.includes("tdas.202.question-module.v2.state"), 'Namespace local v2 ausente.');
required(scripts.player.includes("data/integration/question-catalog.json"), 'Player não carrega o catálogo autorizado.');
required(scripts.player.includes('safeKeyPath') && scripts.player.includes('question-keys'), 'Player não restringe o caminho do gabarito.');
const finishPosition = scripts.player.indexOf('async function finishSession');
const keyFetchPosition = scripts.player.indexOf('state.catalog.keyPath');
required(finishPosition >= 0 && keyFetchPosition > finishPosition, 'Gabarito pode ser solicitado antes da finalização.');
required(!/localStorage|sessionStorage|indexedDB/.test(scripts.player), 'Player acessa armazenamento diretamente.');
required(!/notion\.com|api\.notion|method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)/i.test(Object.values(scripts).join('\n')), 'Módulo contém writeback ou acesso ao Notion.');
required(home.includes('Estudar questões') && home.includes('sem conteúdo de exemplo'), 'Início não apresenta corretamente o módulo.');
for (const label of ['Resolver questões','Revisar','Caderno de erros','Desempenho','Fila de IA']) required(more.includes(label), `Menu Mais não preserva ${label}.`);
required(manifest.shortcuts.map(item => item.url).join('|') === ['/sedes-tdas-dashboard/estudar/','/sedes-tdas-dashboard/revisar/','/sedes-tdas-dashboard/caderno-erros/','/sedes-tdas-dashboard/desempenho/'].join('|'), 'Atalhos do manifesto divergentes.');
for (const route of ['estudar/','resolver/','revisar/','caderno-erros/','desempenho/','fila-ia/']) {
  required(sw.includes(`'${route}'`) && postprocess.includes(`'${route}'`), `Rota fora do PWA: ${route}.`);
}
for (const asset of ['module-dashboard.js','module-player.js','module-store.js','module-reviews.js','module-error-book.js','module-performance.js','module-ai-queue.js','player-core.js','player.css']) {
  required(sw.includes(asset) && postprocess.includes(asset), `Asset fora do PWA: ${asset}.`);
}
required(sw.includes('data/integration/question-catalog.json') && postprocess.includes('data/integration/question-catalog.json'), 'Catálogo autorizado fora do PWA.');
const activeSurface = [...Object.values(routes), ...Object.values(scripts), home, more, JSON.stringify(manifest), JSON.stringify(navigation), sw, postprocess].join('\n');
for (const forbidden of ['pe76-catalog','pe76-key','pilot-catalog','real-study','?pilot=pe76','a1d5fc8f8e434105861faba90dc156d9','RodrigoRosaDantas/sedes-df-questoes']) {
  required(!activeSurface.includes(forbidden), `Superfície ativa contém referência proibida: ${forbidden}.`);
}
for (const removed of ['assets/integration/pilot-catalog.js','assets/integration/player.js','assets/integration/pe-pilot-status.js','data/integration/pilot/pe76-catalog.json','data/integration/pilot/pe76-key.json']) {
  required(!(await exists(removed)), `Arquivo de exemplo ainda presente: ${removed}.`);
}
required(packageData.scripts?.check?.includes('validate-question-module.mjs') && packageData.scripts?.check?.includes('test-question-module.mjs'), 'Validação do módulo fora do gate principal.');
console.log('Módulo validado: seis rotas funcionais, armazenamento v2, catálogo vazio e nenhum arquivo de exemplo ativo.');
