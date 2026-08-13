import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {TDAS_SOURCE_MANIFEST} from './notion/source-manifest.mjs';

const ROOT=process.cwd();
const read=async file=>fs.readFile(path.join(ROOT,file),'utf8');
const data=JSON.parse(await read('data/edital-status.json'));
const html=await read('edital/index.html');
const script=await read('assets/edital.js');
const mobileUx=await read('assets/tdas-mobile-ux.js');
const more=await read('assets/more.js');
const generator=await read('scripts/notion/edital-status.mjs');
const sw=await read('sw.js');
const pwaGenerator=await read('scripts/postprocess-v26.mjs');
const expected=Number(TDAS_SOURCE_MANIFEST.editalChecklist.expectedItems||0);

assert.ok(expected>0,'Manifesto não define a quantidade canônica do checklist.');
assert.equal(Number(data?.summary?.total),expected,`Checklist do edital deve conter exatamente ${expected} tópicos.`);
assert.ok(Array.isArray(data?.topics),'Feed do edital não contém lista de tópicos.');
assert.equal(data.topics.length,Number(data.summary.total),'Quantidade detalhada diverge do resumo do edital.');
assert.equal(Object.values(data.summary.coverage||{}).reduce((sum,value)=>sum+Number(value||0),0),Number(data.summary.total),'Buckets de cobertura não fecham com o total.');
assert.equal(Object.values(data.summary.risk||{}).reduce((sum,value)=>sum+Number(value||0),0),Number(data.summary.total),'Buckets de risco não fecham com o total.');
assert.equal(Number(data.summary.coverage?.unknown||0),0,'Há tópico com cobertura desconhecida; o painel não pode tratá-lo como coberto.');
for(const item of data.topics){
 assert.ok(String(item.topic||'').trim(),'Há item do edital sem tópico.');
 assert.ok(String(item.discipline||'').trim(),'Há item do edital sem disciplina.');
 assert.ok(String(item.risk||'').trim(),'Há item do edital sem classificação de risco.');
 assert.doesNotMatch(`${item.topic||''} ${item.discipline||''} ${item.block||''}`,/EDAS|Cargo\s*400/i,'Conteúdo do Cargo 400 apareceu no feed do Cargo 202.');
}
assert.match(String(data?.source?.checkUrl||''),/3b8cf5a2673181c4a724c9e4afc7d49d/i,'Fonte da página Check do Edital não está rastreada.');
assert.match(String(data?.source?.dataSourceId||''),/24c1299f-10a5-4125-b7f6-c19846d8aa52/i,'Data source do checklist não está rastreado.');
assert.match(String(TDAS_SOURCE_MANIFEST.editalChecklist.viewUrl||''),/a358acb16705463aba60838c24c3c80e/i,'View fornecida do banco do edital não está preservada no manifesto.');
assert.match(generator,/status\.summary\.total===expectedItems/,'Sincronizador não exige a quantidade canônica exata do checklist.');
assert.match(generator,/coverageBucket==='studied'\|\|item\.coverageBucket==='review'/,'Cobertura por disciplina ainda aceita estados desconhecidos como cobertos.');
assert.match(generator,/coverage\.unknown/,'Lacunas do edital não consideram cobertura desconhecida.');
assert.match(html,/assets\/edital\.css/,'Página do edital não carrega seu CSS.');
assert.match(html,/assets\/edital\.js/,'Página do edital não carrega seu controlador.');
assert.doesNotMatch(html,/assets\/(?:edital\.js|edital\.css|styles\.css|v20\.css)\?/, 'Dependência essencial do Edital usa query incompatível com o precache frio.');
assert.match(script,/from'\.\/common\.js'/,'Controlador do Edital deve importar common.js pela mesma chave do precache.');
assert.doesNotMatch(script,/common\.js\?/, 'Import de common.js usa query incompatível com o precache frio.');
assert.match(script,/source\.viewUrl\|\|source\.url/,'Botão do banco não prioriza a view exata fornecida.');
assert.match(script,/data\/edital-status\.json/,'Página não consome o snapshot oficial do edital.');
assert.match(script,/Sem aferição/,'Página perdeu a distinção de tópicos sem aferição granular.');
assert.match(script,/edital-discipline/,'Página perdeu filtro por disciplina.');
assert.match(script,/edital-risk/,'Página perdeu filtro por risco.');
assert.match(script,/edital-block/,'Página perdeu filtro por bloco.');
assert.match(script,/edital-search/,'Página perdeu busca textual.');
assert.match(more,/\$\{BASE\}edital\//,'Edital não está acessível pela navegação complementar.');
assert.match(mobileUx,/edital:BASE\+'edital\/'/,'Navegação global não reconhece a rota do Edital.');
assert.match(mobileUx,/\['edital','Edital'\]/,'Drawer não expõe o Edital em Progresso.');
assert.match(mobileUx,/\['edital','Edital','Raio-X'\]/,'Navegação desktop não aponta para a página do Edital.');
assert.match(mobileUx,/active==='edital'\?'edital'/,'Edital não recebe estado ativo correto no desktop.');
for(const source of[sw,pwaGenerator]){
 assert.match(source,/"edital\/"/,'Rota do edital está fora do PWA ou de seu gerador.');
 assert.match(source,/"assets\/edital\.js"/,'Script do edital está fora do PWA ou de seu gerador.');
 assert.match(source,/"assets\/edital\.css"/,'CSS do edital está fora do PWA ou de seu gerador.');
 assert.match(source,/"data\/edital-status\.json"/,'Feed do edital está fora do PWA ou de seu gerador.');
 assert.doesNotMatch(source,/question-keys\//,'Gabaritos individuais não podem entrar no precache ao adicionar a página do edital.');
}

console.log(`Página do Edital validada: ${data.summary.total}/${expected} tópicos; ${data.summary.risk.critical||0} críticos; ${data.summary.risk.attention||0} em atenção; ${data.summary.risk.no_evidence||0} sem aferição; navegação e precache frio blindados.`);
