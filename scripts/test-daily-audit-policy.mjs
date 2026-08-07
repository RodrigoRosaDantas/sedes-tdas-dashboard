import assert from 'node:assert/strict';
import {canUseHistoricalExecution,correctionPolicy} from './notion/daily-audit-policy.mjs';

const completed={date:'2026-08-06',status:'Concluído',expectedCount:35,attempted:35,correct:33,errors:2};
assert.equal(canUseHistoricalExecution(completed,'2026-08-07'),true,'Dia passado concluído integralmente deve admitir validação pelo controle oficial.');
assert.equal(correctionPolicy({control:completed,answerCount:0,today:'2026-08-07'}).mode,'historical-execution');
assert.equal(canUseHistoricalExecution({...completed,attempted:0},'2026-08-07'),true,'Acertos + erros podem comprovar execução histórica quando tentadas não estiver materializado.');
assert.equal(correctionPolicy({control:{...completed,date:'2026-08-07'},answerCount:0,today:'2026-08-07'}).accepted,false,'Dia atual sem chave deve continuar bloqueado.');
assert.equal(correctionPolicy({control:{...completed,date:'2026-08-08',status:'Não iniciada',attempted:0,correct:0,errors:0},answerCount:0,today:'2026-08-07'}).accepted,false,'Dia futuro sem chave deve continuar bloqueado.');
assert.equal(correctionPolicy({control:{...completed,attempted:34,correct:32,errors:2},answerCount:0,today:'2026-08-07'}).accepted,false,'Histórico que não fecha a meta por nenhuma prova não pode ser liberado.');
assert.equal(correctionPolicy({control:{...completed,status:'Não iniciada'},answerCount:0,today:'2026-08-07'}).accepted,false,'Histórico sem conclusão oficial não pode ser liberado.');
assert.equal(correctionPolicy({control:{...completed,date:'2026-08-08',status:'Não iniciada',attempted:0,correct:0,errors:0},answerCount:35,today:'2026-08-07'}).mode,'answer-key','Chave integral continua sendo a regra normal, inclusive no futuro.');
console.log('Política do ciclo diário validada: histórico concluído pode usar execução oficial; atual/futuro permanecem estritos.');
