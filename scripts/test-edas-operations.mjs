import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read=file=>fs.readFile(file,'utf8');
const [pkgText,watchdog,browser,sw,player,docs,siteText,catalogText,keyText]=await Promise.all([
 read('package.json'),read('.github/workflows/edas-publication-watchdog.yml'),read('.github/workflows/edas-browser-smoke.yml'),read('edas-administracao/sw.js'),read('edas-administracao/assets/integration/module-player.js'),read('docs/OPERACAO_SITE_TDAS.md'),read('edas-administracao/data/site.json'),read('edas-administracao/data/integration/question-catalog.json'),read('edas-administracao/data/integration/answer-key.json')
]);
const pkg=JSON.parse(pkgText),site=JSON.parse(siteText),catalog=JSON.parse(catalogText),key=JSON.parse(keyText);
const coreStart=sw.indexOf('const CORE=['),coreEnd=sw.indexOf('];',coreStart),core=coreStart>=0&&coreEnd>coreStart?sw.slice(coreStart,coreEnd):'';
for(const command of ['check:edas','test:edas-operations','test:edas-browser','monitor:edas','monitor:edas-live'])assert.ok(pkg.scripts?.[command],`Comando ausente: ${command}`);
assert.match(pkg.scripts.check,/test-edas-operations\.mjs/,'Gate integral deve validar rotinas EDAS.');
assert.match(pkg.scripts['ops:check'],/check:edas/,'ops:check deve incluir o EDAS.');
assert.match(pkg.scripts['ops:full'],/monitor:edas-live/,'ops:full deve validar o EDAS implantado.');
for(const token of ["'edas-administracao/**'","scripts/monitor-edas-publication.mjs","scripts/monitor-edas-live-site.mjs","scripts/test-edas-operations.mjs"])assert.ok(watchdog.includes(token),`Watchdog EDAS não cobre ${token}`);
assert.match(watchdog,/cron: '45 4,10,16,22 \* \* \*'/,'Watchdog EDAS deve rodar após as quatro janelas oficiais.');
assert.ok(browser.includes("'edas-administracao/**'"),'Browser dedicado deve reagir a qualquer alteração do EDAS.');
assert.match(browser,/cron: '50 10 \* \* \*'/,'Browser EDAS deve executar diariamente às 07h50 de Brasília.');
assert.ok(core&&!core.includes('answer-key.json'),'Gabarito EDAS não pode permanecer no bloco CORE do precache.');
assert.ok(sw.includes("url.pathname.startsWith(BASE+'data/')"),'Dados EDAS devem permanecer network-first.');
assert.ok(sw.includes('RESERVED_DATA'),'Service worker deve remover cópias antigas do gabarito durante atualização.');
assert.ok(player.includes("fetch('../data/integration/answer-key.json"),'Player deve carregar a correção somente por recurso separado.');
assert.ok(player.indexOf('readAnswerKey(catalog)')>player.indexOf('const finish=async'),'Carga da correção deve ocorrer somente no fechamento.');
assert.equal(key.catalogId,catalog.catalogId,'Ficha reservada deve corresponder ao catálogo.');
assert.equal(key.sprintId,catalog.sprintId,'Ficha reservada deve corresponder ao Sprint do catálogo.');
assert.equal(Object.keys(key.answers||{}).length,(catalog.questions||[]).length,'Ficha reservada deve cobrir todas as questões.');
assert.equal((catalog.questions||[]).some(q=>Object.hasOwn(q,'gabarito')||Object.hasOwn(q,'justificativa')),false,'Catálogo público não pode conter respostas.');
assert.equal(String(site.today?.sprint||''),String(catalog.sprintId||''),'No estado íntegro atual, Sprint e catálogo devem estar alinhados.');
for(const phrase of ['EDAS','monitor:edas','monitor:edas-live','answer-key','07h50'])assert.ok(docs.includes(phrase),`Manual operacional não documenta ${phrase}`);
console.log('Rotinas EDAS auditadas: comandos, watchdog, navegador, gabarito reservado, PWA e documentação cobertos.');
