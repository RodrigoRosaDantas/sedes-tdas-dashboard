import assert from'node:assert/strict';
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

console.log('Fronteira questão/gabarito validada: correção separada sem contaminar a última alternativa.');
