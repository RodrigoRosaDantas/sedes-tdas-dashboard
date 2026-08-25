import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read = file => fs.readFile(file, 'utf8');
const [index, dashboard, css, sw, postprocess, preserve, versionSync, platform] = await Promise.all([
  read('index.html'),
  read('assets/integration/home-dashboard-pro-2026.js'),
  read('assets/dashboard-pro-2026.css'),
  read('sw.js'),
  read('scripts/postprocess-v26.mjs'),
  read('scripts/preserve-v27-pwa.mjs'),
  read('scripts/sync-platform-version.mjs'),
  read('data/platform-version.json').then(JSON.parse)
]);

assert.match(index, /dashboard-pro-2026\.css\?v=29\.0\.0/, 'A Home deve carregar a camada visual Dashboard PRO.');
assert.match(index, /home-dashboard-pro-2026\.js\?v=29\.0\.0/, 'A Home deve carregar o módulo operacional Dashboard PRO.');
assert.ok(index.indexOf('home-dashboard-pro-2026.js') > index.indexOf('home-v28.js'), 'O Dashboard PRO deve ser a última camada da Home.');

for (const source of [
  'data/home.json',
  'data/today.json',
  'data/evolution.json',
  'data/subjects.json',
  'data/edital-status.json',
  'data/platform-version.json',
  'data/sync-history.json'
]) assert.ok(dashboard.includes(source), `Dashboard deve consumir ${source}.`);

for (const marker of [
  'ORIENTAÇÃO DE HOJE',
  'Atualizar dados',
  'Caderno de Erros',
  'Controle de questões',
  'Reta final',
  'Aproveitamento por execução',
  'Padrões de erro',
  'Check do Edital',
  'Central de execução',
  'Notion → validação GitHub → site'
]) assert.ok(dashboard.includes(marker), `Dashboard deve preservar ${marker}.`);

for (const contract of ['data-command-center', 'data-primary-stage', 'data-last-sync-at', 'data-continue-action', 'data-v27-continuity', 'data-ux-home-summary', 'tdas-home-focus', 'tdas-home-focus-copy', 'tdas-home-actions', 'tdas-home-quick', 'tdas-hero-aside', 'tdas-performance-svg']) assert.ok(dashboard.includes(contract), `Dashboard deve preservar o contrato operacional ${contract}.`);
assert.match(dashboard, /readSessionDraft/, 'A Central portada deve preservar a retomada da sessão local.');
assert.match(dashboard, /Continuar questão/, 'A Central portada deve apresentar posição e total da sessão interrompida.');

assert.match(dashboard, /actions\/workflows\/notion-sync\.yml/, 'Atualização deve abrir o workflow Notion existente.');
assert.match(dashboard, /api\.github\.com\/repos\/\$\{REPOSITORY\}\/actions\/workflows\/notion-sync\.yml\/runs/, 'Dashboard deve acompanhar o status público do workflow.');
assert.match(dashboard, /Run workflow/, 'A interface deve explicar a confirmação autenticada no GitHub.');
assert.doesNotMatch(dashboard, /api\.notion\.com|Authorization\s*:|Bearer\s+|ghp_[A-Za-z0-9]|github_pat_/, 'O navegador não pode receber credenciais nem chamar o Notion diretamente.');

for (const marker of [
  '.pro26-decision',
  '.pro26-line-chart',
  '.pro26-donut',
  '.pro26-volume',
  '.pro26-tabs',
  '@media(orientation:portrait) and (min-width:781px) and (max-width:1024px)',
  '@media(max-width:780px)',
  '@media(max-width:430px)',
  'env(safe-area-inset-bottom)',
  '@media(prefers-reduced-motion:reduce)'
]) assert.ok(css.includes(marker), `Camada responsiva deve conter ${marker}.`);

for (const asset of ['assets/dashboard-pro-2026.css', 'assets/integration/home-dashboard-pro-2026.js']) {
  assert.ok(sw.includes(asset), `Service worker deve precachear ${asset}.`);
  assert.ok(postprocess.includes(asset), `Sincronizador deve preservar ${asset}.`);
  assert.ok(preserve.includes(asset), `Overlay PWA deve exigir ${asset}.`);
}

assert.match(versionSync, /VISUAL_CACHE_REV='cachefix1-pro8'/, 'Gerador deve usar a revisão visual PRO8.');
assert.match(platform.serviceWorkerVersion, /cachefix1-pro8$/, 'Manifesto publicado deve invalidar o cache anterior.');
assert.match(sw, /cachefix1-pro8/, 'Service worker deve usar a revisão visual PRO8.');
assert.ok(!sw.includes('question-keys/'), 'Gabaritos devem continuar fora do precache.');

console.log('Dashboard PRO 2026 validado: dados oficiais, gráficos, atualização segura, PWA PRO8 e responsividade mobile/iPad preservados.');
