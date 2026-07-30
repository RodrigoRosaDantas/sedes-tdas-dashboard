import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const VERSION = '24.0';
const read = async file => JSON.parse(await fs.readFile(path.join(ROOT, file), 'utf8'));
const write = async (file, value) => {
  const target = path.join(ROOT, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(value)}\n`, 'utf8');
};
const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const isRest = row => /descanso|pausa/.test(norm(`${row?.title} ${row?.status} ${row?.type} ${row?.typ} ${row?.block}`));
const localIso = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(new Date());
  const get = type => parts.find(part => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}-03:00`;
};

const [home, audit, agenda, errorIndex, future1, future2] = await Promise.all([
  read('data/home.json'), read('data/audit.json'), read('data/agenda.json'),
  read('data/error-questions/index.json'), read('data/export/future-01.json'), read('data/export/future-02.json')
]);

const snapshotDate = home.meta?.snapshotDate;
const future = [...future1, ...future2];
const pastRests = future.filter(row => isRest(row) && row.date && row.date <= snapshotDate);
const restIds = pastRests.map(row => row.pe);
const fulfilled = Number(home.metrics?.completed || 0) + pastRests.length;
const remaining = Math.max(0, Number(home.metrics?.totalPE || 0) - fulfilled);
const days = Number(home.metrics?.operationalDays || home.metrics?.calendarDays || agenda.summary?.operationalDays || 1);
const resultQuestions = Number(audit.summary?.meta_with_result || home.metrics?.questions || 0);
const correct = Number(audit.summary?.correct || home.metrics?.correct || 0);
const accuracy = resultQuestions ? Number((correct / resultQuestions * 100).toFixed(2)) : 0;
const restActual = pastRests.map(row => ({
  pe: row.pe, number: row.number, week: row.week, date: row.date, title: row.title,
  status: row.status || 'Descanso', meta: 0, qg: 0, qe: 0, ag: 0, ae: 0,
  acertos: null, attempted: 0, errors: 0, block: 'Descanso', typ: row.type || 'Descanso',
  type: row.type || 'Descanso', source: row.source || '', rd: row.rd || '', redacao: false,
  review24: false, review72: false, efficiency: '', action: '', url: row.url,
  accuracy: null, quality_flags: [], layer: 'Execução operacional — Notion'
}));

const metaPatch = { version: VERSION };
const summaryPatch = {
  completed: fulfilled,
  result_days: Number(audit.summary?.result_days || 0),
  missing_result_days: Number(audit.summary?.missing_result_days || 0),
  rest_days: pastRests.length,
  meta_completed: resultQuestions,
  meta_with_result: resultQuestions,
  correct,
  accuracy_result_days: accuracy,
  conservative_index: accuracy
};
const overlay = {
  'data/home.json': {
    meta: metaPatch,
    metrics: {
      completed: fulfilled, questions: resultQuestions, resultQuestions, correct, accuracy,
      calendarDays: days, operationalDays: days
    },
    projections: { $replace: [
      { label: 'Ritmo de PE', value: `${(remaining / days).toFixed(2).replace('.', ',')} PE/dia`, formula: `${remaining} PE não iniciados ÷ ${days} dias operacionais inclusivos` },
      ...(home.projections || []).filter(item => item.label !== 'Ritmo de PE' && item.label !== 'Questões com resultado'),
      { label: 'Questões com resultado', value: resultQuestions.toLocaleString('pt-BR'), formula: `${correct.toLocaleString('pt-BR')} acertos ÷ ${resultQuestions.toLocaleString('pt-BR')} questões com resultado = ${accuracy.toFixed(2).replace('.', ',')}%` }
    ] }
  },
  'data/today.json': { meta: metaPatch },
  'data/evolution.json': { meta: metaPatch },
  'data/risks.json': { meta: metaPatch },
  'data/agenda.json': {
    meta: metaPatch,
    next: { $remove: restIds, $key: 'pe' },
    allFuture: { $remove: restIds, $key: 'pe' },
    summary: { remainingPE: remaining, operationalDays: days, pace: Number((remaining / days).toFixed(2)) }
  },
  'data/redactions.json': { meta: metaPatch },
  'data/audit.json': { meta: metaPatch, summary: summaryPatch },
  'data/more.json': { meta: metaPatch },
  'data/subjects.json': { meta: metaPatch },
  'data/error-questions/index.json': { meta: metaPatch },
  'data/export/actual-01.json': { $prepend: restActual, $key: 'pe', $sortBy: 'number' },
  'data/export/future-01.json': { $remove: restIds, $key: 'pe' },
  'data/export/future-02.json': { $remove: restIds, $key: 'pe' },
  'data/export/summary.json': {
    meta: { version: VERSION, actual_records: fulfilled, completed_records: fulfilled, future_records: remaining },
    summary: summaryPatch
  },
  'data/notion/state.json': { schemaVersion: VERSION },
  'data/sync-history.json': {
    meta: metaPatch,
    entries: { $prepend: [{
      at: localIso(), kind: process.env.SYNC_KIND === 'schedule' ? 'Sincronização automática' : 'Execução manual', status: 'success',
      summary: `Plataforma TDAS v${VERSION} sincronizada`,
      detail: `${home.today?.pe || home.latest?.pe || 'PE atual'}; ${fulfilled}/${home.metrics?.totalPE || 112} PE cumpridos incluindo ${pastRests.length} descansos; ${resultQuestions.toLocaleString('pt-BR')} questões com resultado; ${errorIndex.total} erros publicados integralmente em ${errorIndex.parts?.length || 0} lotes.`
    }], $key: 'at', $limit: 40 }
  }
};

await write('data/live-v24.json', overlay);

const swPath = path.join(ROOT, 'sw.js');
let sw = await fs.readFile(swPath, 'utf8');
sw = sw.replace(/const VERSION='[^']+';/, `const VERSION='tdas-v24-${String(snapshotDate || '').replaceAll('-', '')}-official';`);
sw = sw.replaceAll('data/live-v23.json', 'data/live-v24.json');
const livePath = "/sedes-tdas-dashboard/data/live-v24.json";
if (!sw.includes(livePath)) {
  const marker = "/sedes-tdas-dashboard/data/sync-history.json";
  sw = sw.includes(marker) ? sw.replace(marker, `${marker}","${livePath}`) : sw;
}
await fs.writeFile(swPath, sw, 'utf8');

console.log(JSON.stringify({ version: VERSION, fulfilled, rests: restIds, remaining, resultQuestions, correct, accuracy, errors: errorIndex.total, parts: errorIndex.parts?.length || 0 }));