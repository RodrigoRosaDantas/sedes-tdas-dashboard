import assert from'node:assert/strict';
import fs from'node:fs';
import{parseDailyQuestions}from'./notion/daily-content.mjs';

const source=`# PE88 — Questões
**1.** O SISAN é
A) benefício individual.
B) unidade de atendimento.
C) sistema de segurança alimentar.
D) modalidade de licitação.
E) programa exclusivo.
**2.** Na atuação administrativa, deve-se observar
A) escolhas pessoais.
B) critérios públicos.
C) divulgação ampla.
D) concessão automática.
E) preferência por atendimento informal sem registro.
## Gabarito — consultar somente após responder
<details>
<summary>Gabarito PE88</summary>
<table header-row="true">
<tr><td>Q</td><td>Resp.</td><td>Q</td><td>Resp.</td></tr>
<tr><td>1</td><td>C</td><td>2</td><td>B</td></tr>
</table>
</details>
Meta final: 2 questões em A–E.`;

const{catalog,key}=parseDailyQuestions(source,{pe:'PE88',title:'Teste de fronteira',expectedCount:2,sourcePageId:'teste'});
assert.equal(catalog.questionCount,2);
assert.equal(catalog.questions[0].enunciado,'O SISAN é');
assert.equal(catalog.questions[1].alternativas.E,'preferência por atendimento informal sem registro.');
assert.doesNotMatch(JSON.stringify(catalog),/Gabarito PE88|Q\s+Resp\.|consultar somente após responder|Meta final:/i,'O catálogo público não pode incorporar a seção de correção.');
assert.equal(key.answers.length,2,'O gabarito deve continuar sendo extraído para o arquivo separado.');
assert.equal(key.answers[0].gabarito,'C');
assert.equal(key.answers[1].gabarito,'B');

const player=fs.readFileSync(new URL('../assets/integration/module-player.js',import.meta.url),'utf8');
const keyFetch='loadAnswerKey(state.catalog';
const fetchPositions=[];
for(let offset=player.indexOf(keyFetch);offset>=0;offset=player.indexOf(keyFetch,offset+keyFetch.length))fetchPositions.push(offset);
assert.equal(fetchPositions.length,1,'O player deve possuir um único ponto de leitura da correção.');
const finishStart=player.indexOf('async function finishSession(){');
const finishEnd=player.indexOf('\nmain.addEventListener',finishStart);
assert.ok(finishStart>=0&&finishEnd>finishStart,'A fronteira finishSession precisa permanecer identificável para auditoria.');
assert.ok(fetchPositions[0]>finishStart&&fetchPositions[0]<finishEnd,'O gabarito só pode ser buscado dentro de finishSession.');
assert.match(player.slice(finishStart,finishEnd),/if\(!canFinish\(state\.session\)\)return;/,'A busca do gabarito deve continuar protegida por canFinish.');
assert.doesNotMatch(player.slice(0,finishStart),/loadAnswerKey\(state\.catalog/,'Nenhuma etapa anterior à finalização pode buscar a correção.');
assert.doesNotMatch(player.slice(finishEnd),/loadAnswerKey\(state\.catalog/,'Nenhuma rotina paralela pode buscar a correção fora da finalização.');

const publicCatalog=JSON.parse(fs.readFileSync(new URL('../data/integration/question-catalog.json',import.meta.url),'utf8'));
assert.doesNotMatch(JSON.stringify(publicCatalog),/"(?:gabarito|answers|comentarios|comentários|fundamentos|respostas)"\s*:/i,'O catálogo público não pode conter campos reservados de correção.');
const client=fs.readFileSync(new URL('../assets/integration/answer-key-client.js',import.meta.url),'utf8');
assert.match(client,/publicFallbackAllowed!==false/,'O modo privado deve falhar se o fallback público estiver habilitado.');
assert.match(client,/credentials:'omit'/,'A API privada não deve depender de cookie de terceiro domínio.');
assert.match(client,/Authorization:`Bearer/,'A API privada deve exigir uma sessão curta explícita.');
const service=JSON.parse(fs.readFileSync(new URL('../data/integration/answer-key-service.json',import.meta.url),'utf8'));
assert.equal(service.namespace,'tdas-cargo-202');
if(service.mode==='private'){
 assert.equal(service.publicFallbackAllowed,false,'A implantação privada não pode retornar ao arquivo público.');
 assert.match(service.apiBaseUrl||'',/^https:\/\//,'A implantação privada precisa declarar endpoint HTTPS.');
 assert.match(service.authBaseUrl||'',/^https:\/\//,'A implantação privada precisa declarar o endpoint de autenticação isolado.');
 assert.equal(fs.existsSync(new URL('../data/integration/question-keys',import.meta.url)),false,'Gabaritos não podem permanecer no GitHub Pages após a virada privada.');
}else assert.equal(service.mode,'legacy-public','A única transição admitida antes da implantação é o modo legado explícito.');
const serviceWorker=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const precacheLists=(serviceWorker.match(/const (?:ASSETS|DATA)=\[[^;]+/g)||[]).join('\n');
assert.doesNotMatch(precacheLists,/question-keys\//i,'Arquivos de gabarito não podem entrar no precache do PWA.');
assert.match(serviceWorker,/isPublicAnswerKey/,'O PWA deve reconhecer e desviar qualquer URL legada de gabarito.');
assert.match(serviceWorker,/purgePublicAnswerKeys/,'O PWA deve apagar gabaritos que tenham sido armazenados em caches antigos.');

console.log(`Fronteira questão/gabarito validada: catálogo limpo, cache purgado e correção ${service.mode} somente após canFinish.`);
