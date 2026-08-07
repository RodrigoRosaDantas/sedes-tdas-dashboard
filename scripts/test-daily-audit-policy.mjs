import assert from 'node:assert/strict';
import {canUseHistoricalExecution,correctionPolicy} from './notion/daily-audit-policy.mjs';

const completed={date:'2026-08-06',status:'Concluído',expectedCount:35,attempted:35,correct:33};
assert.equal(canUseHistoricalExecution(completed,'2026-08-07'),true,'Dia passado concluído integralmente deve admitir validação pelo controle oficial.');
assert.equal(correctionPolicy({control:completed,answerCount:0,today:'2026-08-07'}).mode,'historical-execution');
assert.equal(correctionPolicy({control:{...completed,date:'2026-08-07'},answerCount:0,today:'2026-08-07'}).accepted,false,'Dia atual sem chave deve continuar bloqueado.');
assert.equal(correctionPolicy({control:{...completed,date:'2026-08-08',status:'Não iniciada',attempted:0,correct:0},answerCount:0,today:'2026-08-07'}).accepted,false,'Dia futuro sem chave deve continuar bloqueado.');
assert.equal(correctionPolicy({control:{...completed,attempted:34},answerCount:0,today:'2026-08-07'}).accepted,false,'Histórico com execução incompleta não pode ser liberado.');
assert.equal(correctionPolicy({control:{...completed,status:'Não iniciada'},answerCount:0,today:'2026-08-07'}).accepted,false,'Histórico sem conclusão oficial não pode ser liberado.');
assert.equal(correctionPolicy({control:{...completed,date:'2026-08-08',status:'Não iniciada',attempted:0,correct:0},answerCount:35,today:'2026-08-07'}).mode,'answer-key','Chave integral continua sendo a regra normal, inclusive no futuro.');
console.log('Política do ciclo diário validada: histórico concluído pode usar execução oficial; atual/futuro permanecem estritos.');
