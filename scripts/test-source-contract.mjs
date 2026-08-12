import assert from'node:assert/strict';
import{buildContractAssessment,matchesExpectation,parseMicroMarkdown}from'./notion/source-contract-policy.mjs';
const micro=`## PE87 — 12/08/2026 — Bloco cronometrado de Específicos TDAS
**Tema principal:** PNAS, SUAS e programas sociais.
**Bloco predominante:** Específicos comuns TDAS.
**Tipo:** treino cronometrado.
### Bateria do dia
<table><tr><td>Questões do tema principal — Específicos TDAS cronometrados</td><td>35</td></tr><tr><td>Microdose Português — pontuação</td><td>6</td></tr><tr><td>Microdose Específicos peso 2 — LC 840</td><td>7</td></tr><tr><td>**Total estimado**</td><td>**48**</td></tr></table>
## PE91 — 16/08/2026 — Descanso / Anki leve
**Obrigatório:** descanso.`;
const days=parseMicroMarkdown(micro,13);assert.equal(days.length,2);assert.deepEqual(days[0].expectation,{mode:'strict',min:48,max:48});assert.equal(days[0].mainQuestions,35);assert.equal(days[0].portugueseDose,6);assert.equal(days[0].specificDose,7);assert.deepEqual(days[1].expectation,{mode:'rest',min:0,max:0});assert.equal(matchesExpectation(48,days[0].expectation),true);assert.equal(matchesExpectation(30,days[0].expectation),false);
const assessment=buildContractAssessment({controls:[{pe:'PE87',date:'2026-08-12',planned_questions:'30',status:'Não iniciada'}],microDays:days,catalog:{questionCount:30,authorizedSource:{url:'https://example.test/pe87'}},currentPe:'PE87',snapshotDate:'2026-08-12'});assert.equal(assessment.status,'blocked');assert.deepEqual(assessment.current.conflicts.map(item=>item.code).sort(),['catalog_vs_micro','control_vs_micro']);
const healthy=buildContractAssessment({controls:[{pe:'PE87',date:'2026-08-12',planned_questions:'48'}],microDays:days,catalog:{questionCount:48},currentPe:'PE87',snapshotDate:'2026-08-12'});assert.equal(healthy.status,'ready');
const ranged=parseMicroMarkdown(`## PE92 — 17/08/2026 — Reincidências do Caderno de Erros PRO
<table><tr><td>Questões do tema principal</td><td>30 a 40</td></tr><tr><td>Microdose Português</td><td>8</td></tr><tr><td>Microdose Específicos peso 2</td><td>8</td></tr><tr><td>Total estimado</td><td>46 a 56</td></tr></table>`,14);assert.equal(ranged.length,1);assert.deepEqual(ranged[0].expectation,{mode:'strict',min:46,max:56});assert.equal(matchesExpectation(46,ranged[0].expectation),true);assert.equal(matchesExpectation(51,ranged[0].expectation),true);assert.equal(matchesExpectation(56,ranged[0].expectation),true);assert.equal(matchesExpectation(45,ranged[0].expectation),false);assert.equal(matchesExpectation(57,ranged[0].expectation),false);
const rangedHealthy=buildContractAssessment({controls:[{pe:'PE92',date:'2026-08-17',planned_questions:'46'}],microDays:ranged,catalog:{questionCount:46},currentPe:'PE92',snapshotDate:'2026-08-17'});assert.equal(rangedHealthy.status,'ready');
const finalWeek=parseMicroMarkdown(`## PE106 — 31/08/2026 — Revisão final
<table><tr><td>Total estimado</td><td>25 a 35</td></tr></table>
## PE111 — 05/09/2026 — Descanso estratégico
**Obrigatório:** descanso.
## PE112 — 06/09/2026 — Prova oficial`,16);assert.equal(finalWeek[0].expectation.mode,'adaptive');assert.equal(finalWeek[1].expectation.mode,'rest');assert.equal(finalWeek[2].expectation.mode,'official_exam');
console.log('Contrato multifornte TDAS validado.');
