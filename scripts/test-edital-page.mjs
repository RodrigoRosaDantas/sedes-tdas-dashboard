import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.cwd();
const read=async file=>fs.readFile(path.join(ROOT,file),'utf8');
const data=JSON.parse(await read('data/edital-status.json'));
const html=await read('edital/index.html');
const script=await read('assets/edital.js');
const more=await read('assets/more.js');
const sw=await read('sw.js');

assert.ok(Number(data?.summary?.total)>=80,'Checklist do edital retornou menos de 80 tópicos.');
assert.ok(Array.isArray(data?.topics),'Feed do edital não contém lista de tópicos.');
assert.equal(data.topics.length,Number(data.summary.total),'Quantidade detalhada diverge do resumo do edital.');
assert.equal(Object.values(data.summary.coverage||{}).reduce((sum,value)=>sum+Number(value||0),0),Number(data.summary.total),'Buckets de cobertura não fecham com o total.');
assert.equal(Object.values(data.summary.risk||{}).reduce((sum,value)=>sum+Number(value||0),0),Number(data.summary.total),'Buckets de risco não fecham com o total.');
for(const item of data.topics){
 assert.ok(String(item.topic||'').trim(),'Há item do edital sem tópico.');
 assert.ok(String(item.discipline||'').trim(),'Há item do edital sem disciplina.');
 assert.ok(String(item.risk||'').trim(),'Há item do edital sem classificação de risco.');
 assert.doesNotMatch(`${item.topic||''} ${item.discipline||''} ${item.block||''}`,/EDAS|Cargo\s*400/i,'Conteúdo do Cargo 400 apareceu no feed do Cargo 202.');
}
assert.match(String(data?.source?.checkUrl||''),/3b8cf5a2673181c4a724c9e4afc7d49d/i,'Fonte da página Check do Edital não está rastreada.');
assert.match(String(data?.source?.dataSourceId||''),/24c1299f-10a5-4125-b7f6-c19846d8aa52/i,'Data source do checklist não está rastreado.');
assert.match(html,/assets\/edital\.css/,'Página do edital não carrega seu CSS.');
assert.match(html,/assets\/edital\.js/,'Página do edital não carrega seu controlador.');
assert.match(script,/data\/edital-status\.json/,'Página não consome o snapshot oficial do edital.');
assert.match(script,/Sem aferição/,'Página perdeu a distinção de tópicos sem aferição granular.');
assert.match(script,/edital-discipline/,'Página perdeu filtro por disciplina.');
assert.match(script,/edital-risk/,'Página perdeu filtro por risco.');
assert.match(more,/\$\{BASE\}edital\//,'Edital não está acessível pela navegação complementar.');
assert.match(sw,/"edital\/"/,'Rota do edital está fora do precache PWA.');
assert.match(sw,/"assets\/edital\.js"/,'Script do edital está fora do precache PWA.');
assert.match(sw,/"assets\/edital\.css"/,'CSS do edital está fora do precache PWA.');
assert.match(sw,/"data\/edital-status\.json"/,'Feed do edital está fora do precache PWA.');
assert.doesNotMatch(sw,/question-keys\//,'Gabaritos individuais não podem entrar no precache ao adicionar a página do edital.');

console.log(`Página do Edital validada: ${data.summary.total} tópicos; ${data.summary.risk.critical||0} críticos; ${data.summary.risk.attention||0} em atenção; ${data.summary.risk.no_evidence||0} sem aferição.`);
