import assert from 'node:assert/strict';
import {parseDailyQuestions, renderMaterialMarkdown} from './notion/daily-content.mjs';

const markdown = `# 1. Dia localizado
PE78
# 3. Questões
## Questão 1
A Administração identificou uma ilegalidade. A providência correta é
A) revogar o ato ilegal.
B) anular o ato ilegal.
C) convalidar qualquer vício.
D) aguardar decisão judicial.
E) manter o ato por eficiência.
## Questão 2
No atendimento ao público, o servidor deve
A) prometer resultado.
B) ignorar o registro.
C) dispensar requisito legal.
D) acolher, orientar e registrar.
E) divulgar dados pessoais.
# 6. Gabarito
<details>
<summary>Não abrir</summary>
1-B | 2-D
</details>
# 7. Comentários estratégicos
Não importar.
`;
const {catalog,key}=parseDailyQuestions(markdown,{pe:'PE78',title:'Revisão administrativa',expectedCount:2,sourcePageId:'abc'});
assert.equal(catalog.mode,'notion-daily');
assert.equal(catalog.questionCount,2);
assert.equal(catalog.questions[0].alternativas.B,'anular o ato ilegal.');
assert.equal(key.answers[1].gabarito,'D');
assert.ok(!/comentário|fundamento|1-B|2-D/i.test(JSON.stringify(catalog)));
assert.match(catalog.keyPath,/question-keys\/pe78\.json$/);

const html=renderMaterialMarkdown(`# Material\n## Objetivo\n**Estudar** com clareza.\n- Primeiro item\n- Segundo item\n<table header-row="true"><tr><td>Campo</td><td>Valor</td></tr><tr><td>PE</td><td>78</td></tr></table>`);
assert.match(html,/<h2>Material<\/h2>/);
assert.match(html,/<strong>Estudar<\/strong>/);
assert.match(html,/<ul>/);
assert.match(html,/<table>/);
assert.ok(!html.includes('<script'));
console.log('Conteúdo diário testado: material seguro, questões estruturadas e correção separada.');
