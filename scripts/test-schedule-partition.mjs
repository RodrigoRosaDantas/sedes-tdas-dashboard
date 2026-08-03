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
assert.equal(result.agenda.summary.remainingPE, 2);
assert.equal(result.agenda.summary.plannedQuestionsMidpoint, 75);
assert.equal(result.agenda.current.pe, 'PE04');
assert.deepEqual(actualIds, ['PE01', 'PE02', 'PE03'], 'Registros passados devem permanecer no histórico operacional.');
assert.equal(result.audit.summary.rest_days, 1);
assert.match(result.home.projections[0].formula, /^2 PE não iniciados/);
assert.equal(result.exports.summary.meta.actual_records, 3);
assert.equal(result.exports.summary.meta.future_records, 2);

console.log('Agenda particionada por data: histórico preservado; somente hoje e próximos PE permanecem no planejamento.');
