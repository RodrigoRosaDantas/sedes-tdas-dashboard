import fs from 'node:fs/promises';
import path from 'node:path';
import { fulfilledCount, isCompletedStatus, isRest } from './notion/progress.mjs';

const ROOT = process.cwd();
const read = async file => JSON.parse(await fs.readFile(path.join(ROOT, file), 'utf8'));
const write = async (file, value) => {
  const target = path.join(ROOT, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(value)}\n`, 'utf8');
};

const [home, agenda, audit, summary, actual1, actual2, actual3, future1, future2] = await Promise.all([
  read('data/home.json'),
  read('data/agenda.json'),
  read('data/audit.json'),
  read('data/export/summary.json'),
  read('data/export/actual-01.json'),
  read('data/export/actual-02.json'),
  read('data/export/actual-03.json'),
  read('data/export/future-01.json'),
  read('data/export/future-02.json')
]);

const actual = [...actual1, ...actual2, ...actual3];
const future = [...future1, ...future2];
const snapshotDate = home.meta?.snapshotDate || agenda.meta?.snapshotDate;
const fulfilled = fulfilledCount(actual, snapshotDate);
const restDays = actual.filter(isRest).length;
const codeNumber = value => Number(String(value || '').replace(/\D/g, '')) || 0;
const byDate = (a, b) => String(a.date || '').localeCompare(String(b.date || '')) || codeNumber(a.pe) - codeNumber(b.pe);
const publicPending = item => ({
  pe: item.pe,
  number: codeNumber(item.pe),
  week: item.week || Math.ceil(codeNumber(item.pe) / 7) || null,
  date: item.date,
  title: item.title,
  planned_questions: item.meta == null ? '' : String(item.meta),
  rd: item.rd,
  status: item.status,
  type: item.type || item.typ || item.block,
  source: item.source,
  url: item.url
});
const overdue = actual
  .filter(item => Boolean(item.date && item.date < snapshotDate) && !isCompletedStatus(item.status) && !isRest(item))
  .sort(byDate)
  .map(publicPending);
const pendingActual = actual
  .filter(item => !isCompletedStatus(item.status) && !Boolean(item.date && item.date <= snapshotDate && isRest(item)))
  .map(publicPending);
const remaining = pendingActual.length + future.length;
const days = Number(agenda.summary?.operationalDays || home.metrics?.operationalDays || home.metrics?.calendarDays || 1);
const pace = Number((remaining / Math.max(1, days)).toFixed(2));
const plannedQuestionsMidpoint = [...pendingActual, ...future].reduce((sum, item) => sum + (Number(item.planned_questions) || 0), 0);

home.metrics.completed = fulfilled;
home.overdue = overdue;
home.projections = (home.projections || []).map(item => item.label === 'Ritmo de PE'
  ? { ...item, value: `${pace.toFixed(2)} PE/dia`, formula: `${remaining} PE pendentes (${overdue.length} atrasado${overdue.length === 1 ? '' : 's'}) ÷ ${days} dias operacionais inclusivos` }
  : item
);

agenda.latestCompleted = home.latest || agenda.latestCompleted || null;
agenda.overdue = overdue;
agenda.summary = {
  ...agenda.summary,
  remainingPE: remaining,
  overduePE: overdue.length,
  operationalDays: days,
  pace,
  plannedQuestionsMidpoint
};

audit.summary = {
  ...audit.summary,
  completed: fulfilled,
  rest_days: restDays,
  remaining_pe: remaining,
  overdue_pe: overdue.length
};

summary.meta = {
  ...summary.meta,
  actual_records: actual.length,
  completed_records: fulfilled,
  future_records: future.length
};
summary.summary = {
  ...summary.summary,
  completed: fulfilled,
  rest_days: restDays,
  remaining_pe: remaining,
  overdue_pe: overdue.length
};

await Promise.all([
  write('data/home.json', home),
  write('data/agenda.json', agenda),
  write('data/audit.json', audit),
  write('data/export/summary.json', summary),
  write('data/live-v24.json', {})
]);

console.log(JSON.stringify({
  version: '24.1-compat',
  mode: 'snapshot-only',
  current: home.today?.pe || agenda.current?.pe || '',
  fulfilled,
  restDays,
  remaining,
  overdue: overdue.length,
  days,
  pace
}));
