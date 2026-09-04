import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = file => fs.readFileSync(file, 'utf8');
const collectFiles = dir => fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  const target=path.join(dir,entry.name);
  return entry.isDirectory()?collectFiles(target):[target];
});
const packageData = JSON.parse(read('package.json'));
const syncWorkflow = read('.github/workflows/notion-sync.yml');
const publicationWatchdog = read('.github/workflows/tdas-publication-watchdog.yml');
const redactionsWatchdog = read('.github/workflows/tdas-redactions-watchdog.yml');
const notionMirrorPublish = read('.github/workflows/notion-mirror-publish.yml');
const telemetryPwaPreserve = read('.github/workflows/tdas-telemetry-pwa-preserve.yml');
const redactionsBrowser = read('.github/workflows/redactions-browser.yml');
const tdasMobileBrowser = read('.github/workflows/tdas-mobile-browser.yml');
const liveMonitor = read('scripts/monitor-live-site.mjs');
const documentation = read('docs/OPERACAO_SITE_TDAS.md');
const readme = read('README.md');

const scripts = packageData.scripts || {};
const expectedCommands = {
  'check:site': 'node scripts/validate-platform-version.mjs && node scripts/validate-pwa-integration.mjs && node scripts/validate-redactions-publication.mjs',
  'check:operations': 'node scripts/test-site-operations.mjs',
  'monitor:publication': 'node scripts/monitor-tdas-publication.mjs',
  'monitor:redactions': 'node scripts/test-redactions-operational.mjs && node scripts/validate-redactions-publication.mjs',
  'monitor:live-site': 'node scripts/monitor-live-site.mjs',
  'ops:check': 'npm run check:operations && npm run check:site',
  'ops:full': 'npm run check && npm run monitor:live-site'
};

for (const [name, command] of Object.entries(expectedCommands)) assert.equal(scripts[name], command, `O comando ${name} deve permanecer padronizado.`);
assert.match(scripts.check, /test-site-operations\.mjs/, 'A auditoria operacional deve fazer parte do gate integral.');
assert.match(scripts.check, /test-tdas-mobile-ux\.mjs/, 'A UX mobile TDAS deve fazer parte do gate integral.');
assert.equal(scripts['test:tdas-mobile-browser'],'node scripts/test-tdas-mobile-browser.mjs','O browser smoke mobile TDAS deve ter comando oficial.');

for (const dependency of ['scripts/postprocess-v23.mjs','scripts/postprocess-v24.mjs','scripts/postprocess-v26.mjs','scripts/postprocess-redactions.mjs','scripts/record-sync-error.mjs','scripts/test-site-operations.mjs']) assert.ok(syncWorkflow.includes(`- '${dependency}'`), `A sincronização deve reagir a mudanças em ${dependency}.`);

const syncWorkflowName = syncWorkflow.match(/^name:\s*(.+)$/m)?.[1]?.trim();
assert.ok(syncWorkflowName, 'A sincronização vigente deve declarar um nome de workflow.');
const postSyncConsumers = [
  ['watchdog de publicação', publicationWatchdog],
  ['watchdog discursivo', redactionsWatchdog],
  ['publicação do mapa seguro do Notion', notionMirrorPublish],
  ['preservação de telemetria/PWA', telemetryPwaPreserve]
];
for (const [label, workflow] of postSyncConsumers) {
  assert.match(workflow, /workflow_run:/, `${label} deve executar após a sincronização.`);
  assert.ok(workflow.includes(`workflows: ['${syncWorkflowName}']`), `${label} deve observar exatamente o nome do workflow de sincronização vigente.`);
}
const legacySyncWorkflowName='Sincronizar Plataforma TDAS '+'v26';
const operationalFiles=[...collectFiles('.github/workflows'),...collectFiles('scripts')]
  .filter(file=>/\.(?:ya?ml|mjs|js)$/i.test(file));
const staleWorkflowReferences=operationalFiles.filter(file=>read(file).includes(legacySyncWorkflowName));
assert.deepEqual(staleWorkflowReferences,[],`Referências operacionais ao workflow legado encontradas: ${staleWorkflowReferences.join(', ')}`);

assert.match(publicationWatchdog, /\n  push:\n/, 'O watchdog deve se autoverificar após mudanças no próprio monitor integradas à main.');
for (const dependency of ['.github/workflows/tdas-publication-watchdog.yml','scripts/monitor-tdas-publication.mjs','scripts/monitor-live-site.mjs','scripts/test-site-operations.mjs']) {
  const occurrences = publicationWatchdog.split(`- '${dependency}'`).length - 1;
  assert.ok(occurrences >= 2, `O watchdog deve cobrir ${dependency} em PR e push.`);
}
assert.match(publicationWatchdog, /monitor:publication/, 'O watchdog deve usar o comando oficial de publicação.');
assert.match(publicationWatchdog, /monitor:live-site/, 'O watchdog deve conferir o GitHub Pages implantado.');
assert.match(publicationWatchdog, /LIVE_SITE_REPORT_PATH/, 'O relatório do site implantado deve ser persistido no workflow.');
assert.match(publicationWatchdog, /issues: write/, 'O watchdog deve poder manter um incidente técnico único.');
assert.match(publicationWatchdog, /MAX_SYNC_AGE_MINUTES:\s*\$\{\{\s*github\.event_name == 'push' && '480' \|\| '180'\s*\}\}/, 'Push técnico deve tolerar a janela entre sincronizações sem enfraquecer o gate agendado de 180 minutos.');

for (const dependency of ['scripts/test-redactions-operational.mjs','scripts/test-redactions-browser.mjs','scripts/postprocess-v26.mjs','scripts/monitor-live-site.mjs','data/platform-version.json','sw.js']) assert.ok(redactionsWatchdog.includes(`- '${dependency}'`), `O monitor discursivo deve reagir a ${dependency}.`);
assert.match(redactionsWatchdog, /monitor:redactions/, 'O monitor discursivo deve usar o comando oficial.');
assert.match(redactionsBrowser, /workflow_dispatch:/, 'O teste dedicado deve permitir execução manual.');
assert.match(redactionsBrowser, /schedule:/, 'O teste dedicado deve ter uma execução preventiva diária.');
assert.match(redactionsBrowser, /cron: '35 10 \* \* \*'/, 'O teste discursivo diário deve rodar às 07h35 de Brasília.');

assert.match(tdasMobileBrowser, /name: Validar UX mobile TDAS no navegador/, 'A UX mobile TDAS deve ter workflow dedicado.');
assert.match(tdasMobileBrowser, /pull_request:/, 'O browser mobile TDAS deve validar pull requests.');
assert.match(tdasMobileBrowser, /push:/, 'O browser mobile TDAS deve se revalidar após merge na main.');
assert.match(tdasMobileBrowser, /schedule:/, 'O browser mobile TDAS deve possuir revalidação preventiva diária.');
assert.match(tdasMobileBrowser, /npm run test:tdas-mobile-ux/, 'O workflow mobile deve validar o contrato estrutural.');
assert.match(tdasMobileBrowser, /npm run test:tdas-mobile-browser/, 'O workflow mobile deve executar Chrome real.');
for (const dependency of ['assets/tdas-mobile-ux.js','assets/tdas-mobile-ux.css','assets/dashboard-pro-2026.css','assets/integration/home-dashboard-pro-2026.js','assets/settings.js','assets/integration/study-ux.js','configuracoes/**']) assert.ok(tdasMobileBrowser.includes(`- '${dependency}'`), `Browser mobile deve reagir a ${dependency}.`);

assert.match(liveMonitor, /data\/platform-version\.json/, 'O monitor implantado deve comparar o manifesto público.');
assert.match(liveMonitor, /data\/redactions\.json/, 'O monitor implantado deve comparar o contrato discursivo.');
assert.match(liveMonitor, /assets\/common\.js/, 'O monitor implantado deve validar o motor runtime da home.');
assert.match(liveMonitor, /HOME_RUNTIME_VERSION_MISMATCH/, 'O monitor deve detectar divergência da versão runtime da home.');
assert.match(liveMonitor, /HOME_SYNC_HOOK_MISSING/, 'O monitor deve exigir o hook estático de sincronização da home.');
assert.match(liveMonitor, /BLIND_APPLICATION_LEAK/, 'O monitor implantado deve proteger a aplicação cega.');
assert.match(liveMonitor, /LIVE_SITE_MAX_ATTEMPTS/, 'O monitor implantado deve tolerar o tempo de propagação do deploy.');

for (const command of Object.keys(expectedCommands)) assert.ok(documentation.includes(`npm run ${command}`), `O manual deve documentar npm run ${command}.`);
assert.match(documentation, /00h50/, 'O manual deve registrar os horários de sincronização.');
assert.match(documentation, /GitHub Pages/, 'O manual deve explicar a validação do site implantado.');
assert.match(documentation, /\*\*Hoje, Questões, Erros, Mentor e Mais\*\*/, 'O manual deve refletir a barra mobile vigente.');
assert.doesNotMatch(documentation, /\*\*Hoje, Questões, Revisar, Erros e Mais\*\*/, 'O manual não pode restaurar a navegação de revisão interna legada.');
assert.match(documentation, /\*\*Prioridades\*\* é diagnóstico\/direcionamento para revisão externa/, 'O manual deve registrar que Prioridades é diagnóstico, não execução de revisão.');
assert.match(documentation, /push[^\n]*480 minutos/, 'O manual deve explicar a tolerância de frescor específica do push técnico.');
assert.match(readme, /OPERACAO_SITE_TDAS\.md/, 'O README deve apontar para o manual operacional.');

const retiredProjectPattern = /\bEDAS\b|Cargo 400|edas-administracao|monitor:edas|test:edas|check:edas/i;
assert.doesNotMatch(JSON.stringify(packageData), retiredProjectPattern, 'O package.json não pode manter comandos do projeto removido.');
assert.doesNotMatch(readme, retiredProjectPattern, 'O README não pode manter referências ao projeto removido.');
assert.doesNotMatch(documentation, retiredProjectPattern, 'O manual TDAS não pode manter referências ao projeto removido.');

console.log('Rotinas operacionais validadas: TDAS, UX mobile, Prioridades externas, Banco Discursivo, consumidores pós-sync v28, ausência de referências v26 e do projeto removido, navegadores e GitHub Pages alinhados.');
