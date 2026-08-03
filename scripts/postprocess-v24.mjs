import fs from 'node:fs/promises';
import path from 'node:path';
import { fulfilledCount, isRest } from './notion/progress.mjs';

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
const remaining = future.length;
const days = Number(agenda.summary?.operationalDays || home.metrics?.operationalDays || home.metrics?.calendarDays || 1);
const pace = Number((remaining / Math.max(1, days)).toFixed(2));

home.metrics.completed = fulfilled;
home.projections = (home.projections || []).map(item => item.label === 'Ritmo de PE'
  ? { ...item, value: `${pace.toFixed(2)} PE/dia`, formula: `${remaining} PE não iniciados ÷ ${days} dias operacionais inclusivos` }
  : item
);

agenda.summary = {
  ...agenda.summary,
  remainingPE: remaining,
  operationalDays: days,
  pace
};

audit.summary = {
  ...audit.summary,
  completed: fulfilled,
  rest_days: restDays
};

summary.meta = {
  ...summary.meta,
  actual_records: actual.length,
  completed_records: fulfilled,
  future_records: remaining
};
summary.summary = {
  ...summary.summary,
  completed: fulfilled,
  rest_days: restDays
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
  days,
  pace
}));
