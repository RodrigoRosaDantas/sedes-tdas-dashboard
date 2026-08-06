import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const sw=read('sw.js');
const detail=read('assets/redaction-detail.js');
const common=read('assets/common.js');
const dashboardHtml=read('redacoes/index.html');
const detailHtml=read('redacoes/detalhe/index.html');
const packageData=JSON.parse(read('package.json'));
const version=packageData.version;

assert.match(sw,/USER_CACHE_PREFIXES=\['tdas-redactions-user-'\]/,'O service worker deve declarar a família de caches pessoais.');
assert.match(sw,/shouldPreserveCache/,'A ativação deve preservar caches pessoais.');
assert.match(sw,/filter\(key=>!shouldPreserveCache\(key\)\)/,'A limpeza de versões não pode apagar o cache de redações do usuário.');
assert.match(detail,/isSavedOffline/,'O estado offline deve ser conferido na Cache API.');
assert.match(detail,/cache\.match\(resource\)/,'O rótulo offline deve depender da existência real dos recursos.');
assert.match(detail,/import\.meta\.url/,'O módulo deve armazenar a URL versionada realmente carregada.');
assert.match(detail,/resources/, 'O índice local deve registrar os recursos efetivamente salvos.');
assert.doesNotMatch(common,/navigator\.onLine\?'Atualizado'/,'Voltar à internet não pode marcar a publicação como atualizada sem verificação.');
assert.match(common,/Verificação indisponível/,'Falhas de consulta devem ter estado próprio.');
assert.match(common,/Atualização atrasada/,'Snapshots antigos devem ser sinalizados.');
assert.match(common,/LAST_PUBLICATION_KEY/,'A última publicação válida deve ser preservada localmente.');
assert.match(common,/aria-controls/,'As abas devem ser associadas aos painéis.');
assert.match(common,/ArrowRight/,'As abas devem aceitar navegação por teclado.');
assert.match(common,new RegExp(`APP_SHELL_VERSION='${version.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}'`),'Common e package.json devem usar a mesma versão.');
for(const html of [dashboardHtml,detailHtml]){
 assert.ok(html.includes(`assets/styles.css?v=${version}`),'O CSS principal deve usar a versão consolidada.');
 assert.ok(html.includes(`assets/redactions-dashboard.css?v=${version}`),'O CSS discursivo deve usar a versão consolidada.');
 assert.ok(html.includes(`.js?v=${version}`),'O módulo de redações deve usar a versão consolidada.');
}
console.log(`Guardas P0.1 validadas: cache persistente, sincronização verificável, acessibilidade e versão ${version}.`);
