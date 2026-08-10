import assert from 'node:assert/strict';
import { build } from './notion/build.mjs';

const control = ({ pe, date, status, meta = 0, attempted = 0, acertos = null, typ = 'Estudo', title = pe }) => ({
  pe,
  date,
  status,
  meta,
  attempted,
  acertos,
  qg: 0,
  qe: 0,
  ag: null,
  ae: null,
  block: typ,
  typ,
  source: 'Teste',
  rd: '',
  redacao: false,
  review24: false,
  review72: false,
  efficiency: '',
  action: '',
  title,
  url: `https://example.test/${pe}`
});

const controls = [
  control({ pe: 'PE01', date: '2026-07-31', status: 'Concluído', meta: 10, attempted: 10, acertos: 9 }),
  control({ pe: 'PE02', date: '2026-08-01', status: 'Descanso', typ: 'Descanso', title: 'Descanso / Anki leve' }),
  control({ pe: 'PE03', date: '2026-08-02', status: 'Pendente', meta: 20, title: 'Atividade passada pendente' }),
  control({ pe: 'PE04', date: '2026-08-03', status: 'Não iniciada', meta: 35, title: 'Atividade de hoje' }),
  control({ pe: 'PE05', date: '2026-08-04', status: 'Não iniciada', meta: 40, title: 'Atividade de amanhã' })
];

const result = build(controls, [], [], '2026-08-03', '2026-08-03T09:00:00-03:00');
const futureIds = result.agenda.allFuture.map(item => item.pe);
const actualIds = [
  ...result.exports.actual1,
  ...result.exports.actual2,
  ...result.exports.actual3
].map(item => item.pe);

assert.deepEqual(futureIds, ['PE04', 'PE05'], 'A agenda deve conter somente hoje e datas posteriores.');
assert.deepEqual(result.agenda.next.map(item => item.pe), ['PE04', 'PE05']);
assert.ok(result.agenda.allFuture.every(item => item.date >= '2026-08-03'));
assert.deepEqual(result.agenda.overdue.map(item => item.pe), ['PE03'], 'PE vencido e não concluído deve permanecer explícito como atraso.');
assert.deepEqual(result.home.overdue.map(item => item.pe), ['PE03']);
assert.equal(result.agenda.summary.remainingPE, 3);
assert.equal(result.agenda.summary.overduePE, 1);
assert.equal(result.agenda.summary.plannedQuestionsMidpoint, 95);
assert.equal(result.agenda.current.pe, 'PE04');
assert.equal(result.agenda.latestCompleted.pe, 'PE01');
assert.deepEqual(actualIds, ['PE01', 'PE02', 'PE03'], 'Registros passados devem permanecer no histórico operacional.');
assert.equal(result.home.metrics.completed, 2, 'PE concluído e descanso passado devem contar como etapas cumpridas.');
assert.equal(result.audit.summary.rest_days, 1);
assert.match(result.home.projections[0].formula, /^3 PE pendentes \(1 atrasado\)/);
assert.equal(result.exports.summary.meta.actual_records, 3);
assert.equal(result.exports.summary.meta.future_records, 2);

const inProgressControls = controls.map(item => item.pe === 'PE04' ? { ...item, status: 'Em andamento', attempted: 5 } : item);
const inProgress = build(inProgressControls, [], [], '2026-08-03', '2026-08-03T10:00:00-03:00');
assert.deepEqual(inProgress.agenda.allFuture.map(item => item.pe), ['PE05'], 'PE atual iniciado deve migrar para a execução real, sem duplicar o planejamento futuro.');
assert.equal(inProgress.agenda.summary.remainingPE, 3, 'PE atual iniciado continua pendente até a conclusão oficial.');
assert.equal(inProgress.agenda.summary.plannedQuestionsMidpoint, 95, 'Estimativa deve incluir também o PE atual em andamento.');
assert.deepEqual(inProgress.agenda.overdue.map(item => item.pe), ['PE03']);

const inProgressWithResultControls = controls.map(item => item.pe === 'PE04' ? { ...item, status: 'Em andamento', attempted: 5, acertos: 4 } : item);
const inProgressWithResult = build(inProgressWithResultControls, [], [], '2026-08-03', '2026-08-03T10:30:00-03:00');
assert.equal(inProgressWithResult.home.metrics.questions, 15, 'Questões já respondidas em PE em andamento devem entrar em Questões com resultado.');
assert.equal(inProgressWithResult.home.metrics.correct, 13);
assert.equal(inProgressWithResult.evolution.weekly.find(item => item.week === 1)?.meta_with_result, 15);

const currentRestControls = controls.map(item => item.pe === 'PE04' ? { ...item, status: 'Descanso', typ: 'Descanso', title: 'Descanso planejado', meta: 0, attempted: 0, acertos: 0 } : item);
const currentRest = build(currentRestControls, [], [], '2026-08-03', '2026-08-03T11:00:00-03:00');
assert.equal(currentRest.home.metrics.completed, 3, 'Descanso planejado no próprio dia do snapshot deve contar como etapa cumprida.');
assert.equal(currentRest.agenda.current.pe, 'PE04');
assert.deepEqual(currentRest.agenda.allFuture.map(item => item.pe), ['PE05']);
assert.equal(currentRest.agenda.summary.remainingPE, 2);
assert.equal(currentRest.audit.summary.rest_days, 2);

console.log('Agenda particionada por data: histórico preservado, atraso explícito, descanso atual contado e resultados em andamento incorporados.');
