import assert from 'node:assert/strict';
import {isAuxiliaryDailyPage, parseDailyQuestions, peCode, renderMaterialMarkdown} from './notion/daily-content.mjs';

assert.equal(peCode('PE01 — 18/05/2026 — Virada pós-edital'), 'PE01');
assert.equal(peCode('PE78 — Revisão administrativa'), 'PE78');
assert.equal(peCode('PE01–PE07'), null);
assert.equal(peCode('PE01-07'), null);
assert.equal(peCode('PE01 — 07'), null);
assert.equal(peCode('01 — Micro PE01–PE07 | Semana 1'), null);
assert.equal(isAuxiliaryDailyPage('PE27 — Auditoria do simulado parcial 1 + RD08'), true);
assert.equal(isAuxiliaryDailyPage('PE27 — Simulado parcial 1 + RD08'), false);

const markdown = `# 1. Dia localizado
PE78
# 3. Questões
## Questão 1
A Administração identificou uma ilegalidade. A providência correta é
A) revogar o ato ilegal sem fundamento.
B) anular o ato ilegal com fundamento na autotutela.
C) convalidar qualquer vício.
D) aguardar resposta judicial.
E) manter o ato por eficiência.
## Questão 2
No atendimento ao público, o servidor deve considerar o comentário do usuário e
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
assert.equal(catalog.questions[0].alternativas.B,'anular o ato ilegal com fundamento na autotutela.');
assert.match(catalog.questions[1].enunciado,/comentário do usuário/);
assert.equal(key.answers[1].gabarito,'D');
assert.ok(!('answers' in catalog));
assert.ok(!('gabarito' in catalog));
assert.ok(!JSON.stringify(catalog).includes('1-B | 2-D'));
assert.match(catalog.keyPath,/question-keys\/pe78\.json$/);

const html=renderMaterialMarkdown(`# Material\n## Objetivo\n**Estudar** com clareza.\n- Primeiro item\n- Segundo item\n<table header-row="true"><tr><td>Campo</td><td>Valor</td></tr><tr><td>PE</td><td>78</td></tr></table>`);
assert.match(html,/<h2>Material<\/h2>/);
assert.match(html,/<strong>Estudar<\/strong>/);
assert.match(html,/<ul>/);
assert.match(html,/<table>/);
assert.ok(!html.includes('<script'));
console.log('Conteúdo diário testado: texto legítimo preservado, estrutura pública restrita e correção separada.');
