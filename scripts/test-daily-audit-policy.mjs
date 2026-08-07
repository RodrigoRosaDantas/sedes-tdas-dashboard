import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {canUseHistoricalExecution,correctionPolicy} from './notion/daily-audit-policy.mjs';

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

const actual=JSON.parse(await fs.readFile('data/export/actual-03.json','utf8'));
const pe81=actual.find(item=>item.pe==='PE81');
assert.ok(pe81,'PE81 deve existir no snapshot atual.');
console.log('PE81_CONTROL',JSON.stringify({date:pe81.date,status:pe81.status,meta:pe81.meta,planned_questions:pe81.planned_questions,attempted:pe81.attempted,acertos:pe81.acertos,errors:pe81.errors,accuracy:pe81.accuracy}));
console.log('Política do ciclo diário validada: histórico concluído pode usar execução oficial; atual/futuro permanecem estritos.');
