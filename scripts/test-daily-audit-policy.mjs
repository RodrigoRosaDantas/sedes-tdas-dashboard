import assert from 'node:assert/strict';
import {auditFailurePolicy,canUseHistoricalExecution,correctionPolicy} from './notion/daily-audit-policy.mjs';
import {parseDailyQuestions} from './notion/daily-content.mjs';

const completed={date:'2026-08-06',status:'Concluído',expectedCount:35,attempted:35,correct:33,errors:2,accuracy:94.29};
assert.equal(canUseHistoricalExecution(completed,'2026-08-07'),true,'Dia passado concluído integralmente deve admitir validação pelo controle oficial.');
assert.equal(correctionPolicy({control:completed,answerCount:0,today:'2026-08-07'}).mode,'historical-execution');
assert.equal(canUseHistoricalExecution({...completed,attempted:0},'2026-08-07'),true,'Acertos + erros podem comprovar execução histórica quando tentadas não estiver materializado.');
assert.equal(canUseHistoricalExecution({...completed,attempted:0,errors:0},'2026-08-07'),true,'Percentual oficial pode comprovar que os acertos foram calculados sobre a meta histórica integral.');
assert.equal(correctionPolicy({control:{...completed,date:'2026-08-07'},answerCount:0,today:'2026-08-07'}).accepted,false,'Dia atual sem chave deve continuar bloqueado.');
assert.equal(correctionPolicy({control:{...completed,date:'2026-08-08',status:'Não iniciada',attempted:0,correct:0,errors:0,accuracy:0},answerCount:0,today:'2026-08-07'}).accepted,false,'Dia futuro sem chave deve continuar bloqueado.');
assert.equal(correctionPolicy({control:{...completed,attempted:34,correct:32,errors:2,accuracy:80},answerCount:0,today:'2026-08-07'}).accepted,false,'Histórico que não fecha a meta por nenhuma prova não pode ser liberado.');
assert.equal(correctionPolicy({control:{...completed,status:'Não iniciada'},answerCount:0,today:'2026-08-07'}).accepted,false,'Histórico sem conclusão oficial não pode ser liberado.');
assert.equal(correctionPolicy({control:{...completed,date:'2026-08-08',status:'Não iniciada',attempted:0,correct:0,errors:0,accuracy:0},answerCount:35,today:'2026-08-07'}).mode,'answer-key','Chave integral continua sendo a regra normal, inclusive no futuro.');

const futureControl={...completed,date:'2026-08-08',status:'Não iniciada',attempted:0,correct:0,errors:0,accuracy:0};
assert.deepEqual(
 auditFailurePolicy({control:futureControl,error:new Error('PE101: foram reconhecidas 40 questões; meta oficial 60.'),today:'2026-08-07'}),
 {mode:'future-editorial-pending',blocking:false,reason:'PE101: foram reconhecidas 40 questões; meta oficial 60.'},
 'Complemento adaptativo de um dia futuro deve ser visível como pendência, sem derrubar a auditoria inteira.'
);
assert.equal(auditFailurePolicy({control:{...futureControl,date:'2026-08-07'},error:new Error('PE100: gabarito possui 0 respostas para 60 questões.'),today:'2026-08-07'}).blocking,true,'O PE atual continua bloqueado quando a chave está incompleta.');
assert.equal(auditFailurePolicy({control:futureControl,error:new Error('PE101: mais de uma fonte de questões válida com a mesma prioridade.'),today:'2026-08-07'}).blocking,true,'Ambiguidade estrutural futura continua sendo falha real.');

const operationalKeyFixture=`# PE00 — Questões\n**1.** Primeira questão válida?\nA) Sim.\nB) Não.\n**2.** Segunda questão válida?\nA) Não.\nB) Sim.\n---\n## GABARITO OPERACIONAL — NÃO CONSULTAR ANTES DE CONCLUIR\n1A, 2B`;
const parsed=parseDailyQuestions(operationalKeyFixture,{pe:'PE01',title:'Teste de gabarito operacional',expectedCount:2,sourcePageId:'fixture'});
assert.equal(parsed.catalog.questionCount,2,'Catálogo público deve manter apenas as questões.');
assert.equal(parsed.key.answers.length,2,'Seção GABARITO OPERACIONAL deve produzir chave integral separada.');
assert.deepEqual(parsed.key.answers.map(item=>item.gabarito),['A','B']);
assert.ok(parsed.catalog.questions.every(question=>!Object.keys(question).some(key=>/gabarito|resposta|fundamento/i.test(key))),'Gabarito operacional não pode vazar para o catálogo público.');

console.log('Política do ciclo diário validada: histórico concluído pode usar execução oficial; atual permanece estrito; complemento futuro adaptativo vira pendência; GABARITO OPERACIONAL gera chave separada.');
