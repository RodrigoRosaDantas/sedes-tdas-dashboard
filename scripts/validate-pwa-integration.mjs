import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const BASE = '/sedes-tdas-dashboard/';
const read = file => fs.readFile(path.join(ROOT, file), 'utf8');
const exists = file => fs.access(path.join(ROOT, file)).then(() => true).catch(() => false);
const required = (condition, message) => { if (!condition) throw new Error(`PWA da integração: ${message}`); };

const sw = await read('sw.js');
const manifest = JSON.parse(await read('manifest.webmanifest'));
const resolver = await read('resolver/index.html');
const packageData = JSON.parse(await read('package.json'));

const stringArray = name => {
  const match = sw.match(new RegExp(`const ${name}=\\[([\\s\\S]*?)\\];`));
  required(match, `lista ${name} ausente no service worker`);
  return [...match[1].matchAll(/(['"])(.*?)\1/g)].map(item => item[2]);
};

const routes = stringArray('CORE_ROUTES');
const assets = stringArray('ASSETS');
const data = stringArray('DATA');
const version = sw.match(/const VERSION=['"]([^'"]+)['"]/u)?.[1] || '';

const requiredRoutes = ['estudar/','resolver/','revisar/','caderno-erros/','desempenho/','fila-ia/'];
const requiredAssets = [
  'assets/integration/contracts.js',
  'assets/integration/navigation.js',
  'assets/integration/pilot-catalog.js',
  'assets/integration/player-core.js',
  'assets/integration/player.js',
  'assets/integration/player.css',
  'assets/integration/attempt-store.js',
  'assets/integration/response-classification.js',
  'assets/integration/classification-store.js',
  'assets/integration/completion-transaction.js',
  'assets/integration/review-scheduler.js',
  'assets/integration/review-store.js',
  'assets/integration/reviews.js',
  'assets/integration/error-book.js',
  'assets/integration/pe-progress-store.js',
  'assets/integration/pe-pilot-status.js',
  'assets/integration/performance-metrics.js',
  'assets/integration/performance.js',
  'assets/integration/backup-migration-core.js',
  'assets/integration/backup-migration-ui.js',
];
const requiredData = [
  'data/integration/navigation.json',
  'data/integration/pilot/pe76-catalog.json',
  'data/integration/pilot/pe76-key.json',
];

required(/^tdas-v26-\d{8}-questions\d+$/.test(version), `versão de cache inválida: ${version}`);
for (const route of requiredRoutes) {
  required(routes.includes(route), `rota fora do precache: ${route}`);
  required(await exists(`${route}index.html`), `HTML da rota ausente: ${route}`);
}
for (const asset of requiredAssets) {
  required(assets.includes(asset), `módulo fora do precache: ${asset}`);
  required(await exists(asset), `módulo inexistente: ${asset}`);
}
for (const file of requiredData) {
  required(data.includes(file), `dado fora do precache: ${file}`);
  required(await exists(file), `dado inexistente: ${file}`);
}

required(new Set(routes).size === routes.length, 'rotas duplicadas no precache');
required(new Set(assets).size === assets.length, 'assets duplicados no precache');
required(new Set(data).size === data.length, 'dados duplicados no precache');
required(sw.includes("caches.match(request,{ignoreSearch:true})"), 'cache não ignora parâmetros de versão');
required(sw.includes("matchCache(BASE+'offline.html')"), 'fallback offline de navegação ausente');
required(!/notion\.com|api\.notion|method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)/iu.test(sw), 'service worker contém acesso externo ou escrita de rede');

required(manifest.start_url === BASE && manifest.scope === BASE, 'escopo do manifesto divergente');
const shortcutUrls = (manifest.shortcuts || []).map(item => item.url);
const expectedShortcuts = [`${BASE}estudar/`, `${BASE}revisar/`, `${BASE}caderno-erros/`, `${BASE}desempenho/`];
required(JSON.stringify(shortcutUrls) === JSON.stringify(expectedShortcuts), 'atalhos do manifesto divergentes');
required(new Set(shortcutUrls).size === shortcutUrls.length, 'atalhos duplicados no manifesto');
required((manifest.shortcuts || []).every(item => item.name && item.short_name && item.description), 'atalho incompleto no manifesto');
required(resolver.includes('catálogo e gabarito disponíveis no cache local'), 'mensagem offline do player desatualizada');
required(packageData.scripts?.['check:pwa'] === 'node scripts/validate-pwa-integration.mjs', 'comando check:pwa ausente');
required(String(packageData.scripts?.check || '').includes('node scripts/validate-pwa-integration.mjs'), 'gate PWA fora do npm run check');

console.log(`PWA validado: ${requiredRoutes.length} rotas, ${requiredAssets.length} módulos e ${requiredData.length} arquivos de dados disponíveis offline.`);
