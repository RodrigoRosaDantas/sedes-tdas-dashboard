import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {TDAS_SOURCE_MANIFEST} from './notion/source-manifest.mjs';
import {buildEditalStatus} from './notion/edital-status.mjs';

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
const measuredCurrent=data.topics.filter(item=>Number(item.questions)>0).length;
assert.equal(Number(data.summary.questionItems||0),measuredCurrent,'Resumo de aferição não coincide com tópicos que possuem Questões.');
assert.equal(measuredCurrent+(data.topics.length-measuredCurrent),Number(data.summary.total),'Partição aferidos/sem bateria não fecha o edital.');
for(const item of data.topics){
 assert.ok(String(item.topic||'').trim(),'Há item do edital sem tópico.');
 assert.ok(String(item.discipline||'').trim(),'Há item do edital sem disciplina.');
 assert.ok(String(item.risk||'').trim(),'Há item do edital sem classificação de risco.');
 if(!(Number(item.questions)>0))assert.ok(item.accuracy==null||Number(item.accuracy)===0,'Snapshot legado sem bateria contém percentual inesperado.');
 assert.doesNotMatch(`${item.topic||''} ${item.discipline||''} ${item.block||''}`,/EDAS|Cargo\s*400/i,'Conteúdo do Cargo 400 apareceu no feed do Cargo 202.');
}
assert.match(String(data?.source?.checkUrl||''),/3b8cf5a2673181c4a724c9e4afc7d49d/i,'Fonte da página Check do Edital não está rastreada.');
assert.match(String(data?.source?.dataSourceId||''),/24c1299f-10a5-4125-b7f6-c19846d8aa52/i,'Data source do checklist não está rastreado.');
assert.match(String(TDAS_SOURCE_MANIFEST.editalChecklist.viewUrl||''),/a358acb16705463aba60838c24c3c80e/i,'View fornecida do banco do edital não está preservada no manifesto.');

const fixture=buildEditalStatus([
 {id:'11111111-1111-1111-1111-111111111111',url:'https://notion.test/1',last_edited_time:'2026-08-15T12:00:00.000Z',properties:{'Código':'T01','Tópico':'Tópico sem bateria','Disciplina':'Português','Bloco':'Geral','Cobertura de estudo':'Estudado','Prioridade edital/ciclo':'Alta','Evidência de estudo':'Revisado no PE10 e citado em PE11/Q2','Questões':null,'Acertos':null,'Aproveitamento':0,'Raio-X automático':'⚪ Sem aferição','Próxima ação automática':'Aferir'}},
 {id:'22222222-2222-2222-2222-222222222222',url:'https://notion.test/2',last_edited_time:'2026-08-15T13:00:00.000Z',properties:{'Código':'T02','Tópico':'Tópico aferido','Disciplina':'Arquivologia','Bloco':'Específico Cargo 202','Cobertura de estudo':'Estudado','Prioridade edital/ciclo':'Alta','Evidência de estudo':'Erro em PE12/Q3','Questões':2,'Acertos':1,'Aproveitamento':50,'Raio-X automático':'🔴 Crítico','Próxima ação automática':'Revisar'}}
],'2026-08-15T10:00:00-03:00');
assert.equal(fixture.schemaVersion,'1.1.0','Contrato analítico do edital não foi versionado.');
assert.equal(fixture.analyticsPolicy.missingEvidence,'null-not-zero','Política sem bateria ≠ 0% não está declarada.');
assert.equal(fixture.summary.evidence.measured,1,'Fixture deveria ter um tópico aferido.');
assert.equal(fixture.summary.evidence.unmeasured,1,'Fixture deveria ter um tópico sem bateria.');
assert.deepEqual(fixture.summary.granular,{questions:2,correct:1,errors:1,accuracy:50},'Resumo granular da fixture divergiu.');
assert.equal(fixture.topics[0].accuracy,null,'Tópico sem bateria recebeu percentual artificial.');
assert.equal(fixture.topics[0].measurement.correct,null,'Tópico sem bateria recebeu acertos artificiais na camada analítica.');
assert.equal(fixture.topics[0].measurement.errors,null,'Tópico sem bateria recebeu erros artificiais na camada analítica.');
assert.match(fixture.topics[0].canonicalId,/^TDAS202:[a-f0-9]{32}$/,'ID canônico não é estável por página do Notion.');
assert.deepEqual(fixture.topics[0].references.pes,['PE10','PE11'],'Referências explícitas de PE não foram extraídas corretamente.');
assert.deepEqual(fixture.topics[0].references.questions,['PE11/Q2'],'Referência explícita PE/Q não foi extraída corretamente.');
assert.equal(fixture.topics[1].measurement.errors,1,'Erros da bateria tópica foram calculados incorretamente.');

assert.match(generator,/status\.summary\.total===expectedItems/,'Sincronizador não exige a quantidade canônica exata do checklist.');
assert.match(generator,/canonicalId/,'Sincronizador perdeu a identidade canônica por tópico.');
assert.match(generator,/missingEvidence:'null-not-zero'/,'Sincronizador não blinda ausência de bateria contra percentual 0%.');
assert.match(generator,/measurement:\{state:measured\?'measured':'unmeasured'/,'Sincronizador não separa tópicos aferidos dos sem bateria.');
assert.match(generator,/coverageBucket==='studied'\|\|item\.coverageBucket==='review'/,'Cobertura por disciplina ainda aceita estados desconhecidos como cobertos.');
assert.match(generator,/coverage\.unknown/,'Lacunas do edital não consideram cobertura desconhecida.');
assert.match(html,/assets\/edital\.css/,'Página do edital não carrega seu CSS.');
assert.match(html,/assets\/edital\.js/,'Página do edital não carrega seu controlador.');
assert.doesNotMatch(html,/assets\/(?:edital\.js|edital\.css|styles\.css|v20\.css)\?/, 'Dependência essencial do Edital usa query incompatível com o precache frio.');
assert.match(script,/from'\.\/common\.js'/,'Controlador do Edital deve importar common.js pela mesma chave do precache.');
assert.doesNotMatch(script,/common\.js\?/, 'Import de common.js usa query incompatível com o precache frio.');
assert.match(script,/source\.viewUrl\|\|source\.url/,'Botão do banco não prioriza a view exata fornecida.');
assert.match(script,/data\/edital-status\.json/,'Página não consome o snapshot oficial do edital.');
assert.match(script,/Sem bateria/,'Página perdeu a distinção de tópicos sem bateria granular.');
assert.match(script,/Aferidos/,'Página perdeu a contagem independente de tópicos aferidos.');
assert.match(script,/measurementOf/,'Página deixou de tratar a aferição como dimensão independente.');
assert.match(script,/canonicalId/,'Página perdeu a identidade canônica dos tópicos.');
assert.match(script,/viewMatch/,'Página perdeu as visões rápidas analíticas.');
assert.match(script,/edital-discipline/,'Página perdeu filtro por disciplina.');
assert.match(script,/edital-risk/,'Página perdeu filtro por risco.');
assert.match(script,/edital-block/,'Página perdeu filtro por bloco.');
assert.match(script,/edital-search/,'Página perdeu busca textual.');
assert.match(more,/\$\{BASE\}edital\//,'Edital não está acessível pela navegação complementar.');
assert.match(mobileUx,/edital:BASE\+'edital\/'/,'Navegação global não reconhece a rota do Edital.');
assert.match(mobileUx,/\['edital','Check do Edital','Cobertura',routes\.edital\]/,'Navegação canônica não aponta para a página do Edital.');
assert.match(mobileUx,/\['riscos','Riscos','Pareto',routes\.riscos\]/,'Correção do Edital não pode remover Riscos da navegação canônica.');
assert.match(mobileUx,/path\.startsWith\(routes\.edital\)\)return'edital'/,'Edital não recebe estado ativo correto.');
assert.match(mobileUx,/path\.startsWith\(routes\.riscos\)\)return'riscos'/,'Riscos não recebe estado ativo correto.');
assert.match(mobileUx,/\['TDAS',primary\.map/,'Drawer deve expor a navegação canônica TDAS, incluindo Check do Edital.');
for(const source of[sw,pwaGenerator]){
 assert.match(source,/"edital\/"/,'Rota do edital está fora do PWA ou de seu gerador.');
 assert.match(source,/"assets\/edital\.js"/,'Script do edital está fora do PWA ou de seu gerador.');
 assert.match(source,/"assets\/edital\.css"/,'CSS do edital está fora do PWA ou de seu gerador.');
 assert.match(source,/"data\/edital-status\.json"/,'Feed do edital está fora do PWA ou de seu gerador.');
 assert.doesNotMatch(source,/question-keys\//,'Gabaritos individuais não podem entrar no precache ao adicionar a página do edital.');
}

console.log(`Página do Edital validada: ${data.summary.total}/${expected} tópicos; ${measuredCurrent} aferidos; ${data.summary.total-measuredCurrent} sem bateria; ${data.summary.risk.critical||0} críticos; ${data.summary.risk.attention||0} em atenção; navegação canônica, contrato analítico e precache frio blindados.`);
