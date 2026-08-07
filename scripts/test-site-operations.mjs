import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const packageData = JSON.parse(read('package.json'));
const syncWorkflow = read('.github/workflows/notion-sync.yml');
const publicationWatchdog = read('.github/workflows/tdas-publication-watchdog.yml');
const redactionsWatchdog = read('.github/workflows/tdas-redactions-watchdog.yml');
const redactionsBrowser = read('.github/workflows/redactions-browser.yml');
const liveMonitor = read('scripts/monitor-live-site.mjs');
const documentation = read('docs/OPERACAO_SITE_TDAS.md');
const readme = read('README.md');

const scripts = packageData.scripts || {};
const expectedCommands = {
  'check:site': 'node scripts/validate-platform-version.mjs && node scripts/validate-pwa-integration.mjs && node scripts/validate-redactions-publication.mjs && node scripts/monitor-edas-publication.mjs',
  'check:operations': 'node scripts/test-site-operations.mjs && node scripts/test-edas-operations.mjs',
  'monitor:publication': 'node scripts/monitor-tdas-publication.mjs',
  'monitor:redactions': 'node scripts/test-redactions-operational.mjs && node scripts/validate-redactions-publication.mjs',
  'monitor:live-site': 'node scripts/monitor-live-site.mjs',
  'monitor:edas': 'node scripts/monitor-edas-publication.mjs',
  'monitor:edas-live': 'node scripts/monitor-edas-live-site.mjs',
  'ops:check': 'npm run check:operations && npm run check:site',
  'ops:full': 'npm run check && npm run monitor:live-site && npm run monitor:edas-live'
};

for (const [name, command] of Object.entries(expectedCommands)) {
  assert.equal(scripts[name], command, `O comando ${name} deve permanecer padronizado.`);
}
assert.match(scripts.check, /test-site-operations\.mjs/, 'A auditoria operacional deve fazer parte do gate integral.');
assert.match(scripts.check, /test-edas-operations\.mjs/, 'A auditoria operacional EDAS deve fazer parte do gate integral.');

for (const dependency of [
  'scripts/postprocess-v23.mjs',
  'scripts/postprocess-v24.mjs',
  'scripts/postprocess-v26.mjs',
  'scripts/postprocess-redactions.mjs',
  'scripts/record-sync-error.mjs',
  'scripts/test-site-operations.mjs'
]) {
  assert.ok(syncWorkflow.includes(`- '${dependency}'`), `A sincronização deve reagir a mudanças em ${dependency}.`);
}

assert.match(publicationWatchdog, /workflow_run:/, 'O watchdog de publicação deve executar após a sincronização.');
assert.match(publicationWatchdog, /monitor:publication/, 'O watchdog deve usar o comando oficial de publicação.');
assert.match(publicationWatchdog, /monitor:live-site/, 'O watchdog deve conferir o GitHub Pages implantado.');
assert.match(publicationWatchdog, /LIVE_SITE_REPORT_PATH/, 'O relatório do site implantado deve ser persistido no workflow.');
assert.match(publicationWatchdog, /issues: write/, 'O watchdog deve poder manter um incidente técnico único.');

for (const dependency of [
  'scripts/test-redactions-operational.mjs',
  'scripts/test-redactions-browser.mjs',
  'scripts/postprocess-v26.mjs',
  'scripts/monitor-live-site.mjs',
  'data/platform-version.json',
  'sw.js'
]) {
  assert.ok(redactionsWatchdog.includes(`- '${dependency}'`), `O monitor discursivo deve reagir a ${dependency}.`);
}
assert.match(redactionsWatchdog, /monitor:redactions/, 'O monitor discursivo deve usar o comando oficial.');
assert.match(redactionsBrowser, /workflow_dispatch:/, 'O teste dedicado deve permitir execução manual.');
assert.match(redactionsBrowser, /schedule:/, 'O teste dedicado deve ter uma execução preventiva diária.');
assert.match(redactionsBrowser, /cron: '35 10 \* \* \*'/, 'O teste discursivo diário deve rodar às 07h35 de Brasília.');

assert.match(liveMonitor, /data\/platform-version\.json/, 'O monitor implantado deve comparar o manifesto público.');
assert.match(liveMonitor, /data\/redactions\.json/, 'O monitor implantado deve comparar o contrato discursivo.');
assert.match(liveMonitor, /BLIND_APPLICATION_LEAK/, 'O monitor implantado deve proteger a aplicação cega.');
assert.match(liveMonitor, /LIVE_SITE_MAX_ATTEMPTS/, 'O monitor implantado deve tolerar o tempo de propagação do deploy.');

for (const command of Object.keys(expectedCommands)) {
  assert.ok(documentation.includes(`npm run ${command}`), `O manual deve documentar npm run ${command}.`);
}
assert.match(documentation, /00h50/, 'O manual deve registrar os horários de sincronização.');
assert.match(documentation, /GitHub Pages/, 'O manual deve explicar a validação do site implantado.');
assert.match(documentation, /EDAS/, 'O manual deve cobrir o Cargo 400.');
assert.match(readme, /OPERACAO_SITE_TDAS\.md/, 'O README deve apontar para o manual operacional.');
assert.match(readme, /monitor:edas/, 'O README deve expor o monitor operacional do EDAS.');

console.log('Rotinas operacionais validadas: TDAS, Banco Discursivo, EDAS, watchdogs, navegadores e GitHub Pages alinhados.');
