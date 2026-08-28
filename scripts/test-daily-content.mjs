import assert from 'node:assert/strict';
import {isAuxiliaryDailyPage, pageReferencesPe, parseDailyQuestions, peCode, renderMaterialMarkdown, selectDailyQuestionSource} from './notion/daily-content.mjs';

assert.equal(peCode('PE01 — 18/05/2026 — Virada pós-edital'), 'PE01');
assert.equal(peCode('PE78 — Revisão administrativa'), 'PE78');
assert.equal(peCode('PE01–PE07'), null);
assert.equal(peCode('PE01-07'), null);
assert.equal(peCode('PE01 — 07'), null);
assert.equal(peCode('01 — Micro PE01–PE07 | Semana 1'), null);
assert.equal(pageReferencesPe('✅ Bateria PE100 validada — 60 A–E', 'PE100'), true);
assert.equal(pageReferencesPe('✅ Bateria PE100 validada — 60 A–E', 'PE101'), false);
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
assert.equal(catalog.keyRef,`daily/${catalog.catalogId}`);
assert.match(catalog.keyPath,/question-keys\/pe78\.json$/);

const staleQuestionsOnRest=parseDailyQuestions(markdown,{pe:'PE84',title:'Descanso',expectedCount:0,sourcePageId:'rest'});
assert.equal(staleQuestionsOnRest.catalog.mode,'notion-daily-empty');
assert.equal(staleQuestionsOnRest.catalog.questionCount,0);
assert.deepEqual(staleQuestionsOnRest.catalog.questions,[]);
assert.equal(staleQuestionsOnRest.key,null);

const binaryMarkdown = `# 2. Questões
## Arquivologia — Questões 1 a 2
**1.** Documento arquivístico possui vínculo orgânico com a atividade do produtor.
A) Certo
B) Errado
**2.** Protocolo corresponde somente ao carimbo de entrada.
A) Certo
B) Errado
---
# 3. Gabarito
<table>
<tr><td>Questão</td><td>Gabarito</td></tr>
<tr><td>1</td><td>A</td></tr>
<tr><td>2</td><td>B</td></tr>
</table>
# 4. Comentários estratégicos
Não importar.`;
const {catalog:binaryCatalog,key:binaryKey}=parseDailyQuestions(binaryMarkdown,{pe:'PE79',title:'Arquivologia',expectedCount:2,sourcePageId:'def'});
assert.deepEqual(Object.keys(binaryCatalog.questions[0].alternativas),['A','B']);
assert.equal(binaryCatalog.questions[0].enunciado,'Documento arquivístico possui vínculo orgânico com a atividade do produtor.');
assert.equal(binaryKey.answers[0].gabarito,'A');
assert.equal(binaryKey.answers[1].gabarito,'B');
assert.ok(!JSON.stringify(binaryCatalog).includes('Gabarito'));

const postResultMarkdown = `# 2. Questões
**1.** Primeira questão válida do bloco.
A) Correta
B) Incorreta
**2.** Segunda questão válida do bloco.
A) Incorreta
B) Correta
# 3. Resultado e relatório pós-prova
**1.** Erro por interpretação registrado após a finalização.
A) Este item pertence ao relatório, não ao bloco de questões.
B) Este item também não deve ser importado.
**2.** Ponto de revisão do estudante.
A) Relatório posterior.
B) Relatório posterior.
**3.** Próxima providência de estudo.
A) Relatório posterior.
B) Relatório posterior.
# 4. Gabarito
1-A | 2-B
`;
const {catalog:postResultCatalog,key:postResultKey}=parseDailyQuestions(postResultMarkdown,{pe:'PE79',title:'Arquivologia',expectedCount:2,sourcePageId:'ghi'});
assert.equal(postResultCatalog.questionCount,2);
assert.deepEqual(postResultCatalog.questions.map(item=>item.numeroOriginal),[1,2]);
assert.equal(postResultKey.answers[0].gabarito,'A');
assert.equal(postResultKey.answers[1].gabarito,'B');
assert.ok(!JSON.stringify(postResultCatalog).includes('Erro por interpretação'));

const responseTableMarkdown = `# 2. Questões
**1.** Primeira questão válida.
A) Correta
B) Incorreta
**2.** Segunda questão válida.
A) Incorreta
B) Correta
# 3. Resultado e fundamentos da correção
<table>
<tr><td>Questão</td><td>Resposta</td><td>Fundamento sintético</td></tr>
<tr><td>1</td><td>A</td><td>Fundamento da primeira.</td></tr>
<tr><td>2</td><td>B</td><td>Fundamento da segunda.</td></tr>
</table>
`;
const {catalog:responseTableCatalog,key:responseTableKey}=parseDailyQuestions(responseTableMarkdown,{pe:'PE79',title:'Arquivologia',expectedCount:2,sourcePageId:'jkl'});
assert.equal(responseTableCatalog.questionCount,2);
assert.equal(responseTableKey.answers[0].gabarito,'A');
assert.equal(responseTableKey.answers[1].gabarito,'B');
assert.ok(!JSON.stringify(responseTableCatalog).includes('Fundamento da primeira'));

const formattedAnswerTableMarkdown = `# 2. Questões
**1.** Primeira questão válida.
A) Correta
B) Incorreta
**2.** Segunda questão válida.
A) Incorreta
B) Correta
# 3. Resultado e fundamentos
<table header-row="true">
<tr><td>Questão</td><td>Resposta correta</td><td>Fundamento sintético</td></tr>
<tr><td>1</td><td>**A**</td><td>Fundamento um.</td></tr>
<tr><td>2</td><td><strong>B</strong></td><td>Fundamento dois.</td></tr>
</table>
`;
const {key:formattedAnswerTableKey}=parseDailyQuestions(formattedAnswerTableMarkdown,{pe:'PE79',title:'Arquivologia',expectedCount:2,sourcePageId:'mno'});
assert.equal(formattedAnswerTableKey.answers[0].gabarito,'A');
assert.equal(formattedAnswerTableKey.answers[1].gabarito,'B');

const pipeAnswerTableMarkdown = `# 2. Questões
**1.** Primeira questão válida.
A) Correta
B) Incorreta
**2.** Segunda questão válida.
A) Incorreta
B) Correta
# 3. Resultado e fundamentos
| Questão | Resposta | Fundamento sintético |
| 1 | A | Fundamento um. |
| 2 | **B** | Fundamento dois. |
`;
const {key:pipeAnswerTableKey}=parseDailyQuestions(pipeAnswerTableMarkdown,{pe:'PE79',title:'Arquivologia',expectedCount:2,sourcePageId:'pqr'});
assert.equal(pipeAnswerTableKey.answers[0].gabarito,'A');
assert.equal(pipeAnswerTableKey.answers[1].gabarito,'B');

const compactKeyMarkdown = `# 2. Questões
**1.** Primeira questão válida.
A) Correta
B) Incorreta
**2.** Segunda questão válida.
A) Incorreta
B) Correta
## 3.2 Gabarito definitivo
1A, 2B.
# 4. Correção detalhada dos erros reais
## Questão 1 — Exemplo posterior
**Resposta marcada:** B
**Gabarito:** A
`;
const {catalog:compactKeyCatalog,key:compactKey}=parseDailyQuestions(compactKeyMarkdown,{pe:'PE79',title:'Arquivologia',expectedCount:2,sourcePageId:'stu'});
assert.equal(compactKeyCatalog.questionCount,2);
assert.equal(compactKey.answers.length,2);
assert.equal(compactKey.answers[0].gabarito,'A');
assert.equal(compactKey.answers[1].gabarito,'B');
assert.ok(!JSON.stringify(compactKeyCatalog).includes('Gabarito definitivo'));

const compactLayoutMarkdown = `# 2. Questões
**1.** O SISAN é
A) benefício individual. B) unidade do SUAS. C) sistema de segurança alimentar e nutricional. D) modalidade de licitação. E) programa previdenciário.
**2.** O SUAS é
A) benefício individual. B) sistema de organização e gestão da assistência social. C) órgão de controle externo. D) unidade física. E) modalidade de licitação.
# 3. Gabarito
<table header-row="true">
<tr><td>Q</td><td>Resp.</td><td>Q</td><td>Resp.</td></tr>
<tr><td>1</td><td>C</td><td>2</td><td>B</td></tr>
</table>`;
const {catalog:compactLayoutCatalog,key:compactLayoutKey}=parseDailyQuestions(compactLayoutMarkdown,{pe:'PE90',title:'Revisão semanal',expectedCount:2,sourcePageId:'compact'});
assert.equal(compactLayoutCatalog.questions[0].enunciado,'O SISAN é');
assert.deepEqual(Object.keys(compactLayoutCatalog.questions[0].alternativas),['A','B','C','D','E']);
assert.equal(compactLayoutCatalog.questions[0].alternativas.C,'sistema de segurança alimentar e nutricional.');
assert.equal(compactLayoutKey.answers.length,2);
assert.equal(compactLayoutKey.answers[0].gabarito,'C');
assert.equal(compactLayoutKey.answers[1].gabarito,'B');

const sourceFixture = count => `# Questões
${Array.from({length:count},(_,index)=>`**${index+1}.** Questão válida número ${index+1}.
A) Alternativa correta ou plausível A.
B) Alternativa correta ou plausível B.`).join('\n')}
# Gabarito
${Array.from({length:count},(_,index)=>`${index+1}-${index%2?'B':'A'}`).join('; ')}
`;
const canonicalSource = selectDailyQuestionSource([
  {id:'parent-pe100',title:'PE100 — página principal histórica',markdown:sourceFixture(1),isPrimary:true},
  {id:'historical-pe100',title:'Bateria PE100 anterior — 2 A–E',markdown:sourceFixture(2),isPrimary:false},
  {id:'child-pe100',title:'✅ Bateria PE100 validada — 2 A–E',markdown:sourceFixture(2),isPrimary:false}
],{pe:'PE100',title:'Português',expectedCount:2});
assert.equal(canonicalSource.id,'child-pe100','A subpágina canônica deve prevalecer quando a página-pai contém uma bateria histórica incompleta.');
assert.equal(canonicalSource.parsed.catalog.questionCount,2);

const preferredFinalSource = selectDailyQuestionSource([
  {id:'parent-pe102',title:'PE102 — página principal',markdown:sourceFixture(2),isPrimary:true},
  {id:'final-pe102',title:'✅ Bateria FINAL auditada — PE102 — 2 A–E',markdown:sourceFixture(2),isPrimary:false}
],{pe:'PE102',title:'Jurídico-administrativo',expectedCount:2});
assert.equal(preferredFinalSource.id,'final-pe102','Uma subpágina FINAL validada deve prevalecer sobre uma bateria histórica também completa.');

assert.throws(()=>selectDailyQuestionSource([
  {id:'final-a',title:'Bateria FINAL PE103 A',markdown:sourceFixture(2),isPrimary:false},
  {id:'final-b',title:'Bateria FINAL PE103 B',markdown:sourceFixture(2),isPrimary:false}
],{pe:'PE103',title:'Cargo 202',expectedCount:2}),/mais de uma fonte de questões válida/,'Duas fontes finais equivalentes devem bloquear a publicação por ambiguidade.');

const contextualDetailsMarkdown = `## Texto — questões 1 a 2
O atendimento público exige informação clara, registro adequado e respeito aos limites legais.
**1.** A ideia central do texto é
A) informação e registro integram um atendimento responsável.
B) limites legais podem ser afastados por conveniência.
**2.** Segundo o texto, o registro
A) é incompatível com informação clara.
B) integra o atendimento responsável.
<details>
<summary>Gabarito — abrir somente após concluir</summary>
1-A; 2-B.
</details>
## Registro pós-bateria
Este conteúdo não pertence à alternativa B da questão 2.`;
const {catalog:contextualCatalog,key:contextualKey}=parseDailyQuestions(contextualDetailsMarkdown,{pe:'PE100',title:'Português',expectedCount:2,sourcePageId:'details'});
assert.match(contextualCatalog.questions[0].enunciado,/Texto-base: O atendimento público exige informação clara/,'O texto compartilhado deve acompanhar as questões que dependem dele.');
assert.match(contextualCatalog.questions[1].enunciado,/Texto-base: O atendimento público exige informação clara/);
assert.equal(contextualCatalog.questions[1].alternativas.B,'integra o atendimento responsável.','Seções pós-bateria não podem contaminar a última alternativa.');
assert.deepEqual(contextualKey.answers.map(item=>item.gabarito),['A','B'],'Gabarito recolhido em details deve continuar separado do catálogo público.');

const html=renderMaterialMarkdown(`# Material\n## Objetivo\n**Estudar** com clareza.\n- Primeiro item\n- Segundo item\n<table header-row="true"><tr><td>Campo</td><td>Valor</td></tr><tr><td>PE</td><td>78</td></tr></table>`);
assert.match(html,/<h2>Material<\/h2>/);
assert.match(html,/<strong>Estudar<\/strong>/);
assert.match(html,/<ul>/);
assert.match(html,/<table>/);
assert.ok(!html.includes('<script'));
console.log('Conteúdo diário testado: texto legítimo preservado, formato A–E compacto aceito, gabarito multipar completo, meta zero prevalece e correção separada.');
