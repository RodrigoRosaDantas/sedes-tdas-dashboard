import fs from 'node:fs/promises';
import path from 'node:path';
import { dateInTimeZone } from './notion/calendar-refresh.mjs';

const ROOT = process.cwd();
const readJson = async file => JSON.parse(await fs.readFile(path.join(ROOT, file), 'utf8'));
const required = (condition, message) => { if (!condition) throw new Error(message); };

const [home, today, agenda, state, actual1, actual2, actual3, future1, future2] = await Promise.all([
  readJson('data/home.json'),
  readJson('data/today.json'),
  readJson('data/agenda.json'),
  readJson('data/notion/state.json'),
  readJson('data/export/actual-01.json'),
  readJson('data/export/actual-02.json'),
  readJson('data/export/actual-03.json'),
  readJson('data/export/future-01.json'),
  readJson('data/export/future-02.json'),
]);

const snapshots = [home.meta?.snapshotDate, today.meta?.snapshotDate, agenda.meta?.snapshotDate, state.snapshotDate];
required(snapshots.every(value => /^\d{4}-\d{2}-\d{2}$/.test(value || '')), 'Há snapshot sem data válida.');
required(new Set(snapshots).size === 1, `Datas de snapshot divergentes: ${snapshots.join(', ')}.`);
required(today.current?.pe === home.today?.pe && agenda.current?.pe === home.today?.pe, 'PE atual diverge entre home, today e agenda.');

const snapshotDate = snapshots[0];
const controls = [...actual1, ...actual2, ...actual3, ...future1, ...future2];
const scheduled = controls.find(item => item.date === snapshotDate);
if (scheduled) required(today.current?.pe === scheduled.pe, `PE atual ${today.current?.pe} diverge do previsto ${scheduled.pe} para ${snapshotDate}.`);

if (process.env.REQUIRE_CURRENT_SNAPSHOT === 'true') {
  const currentDate = dateInTimeZone(process.env.NOW || new Date());
  required(snapshotDate === currentDate, `Snapshot vencido: ${snapshotDate}; data atual em Brasília: ${currentDate}.`);
  const currentScheduled = controls.find(item => item.date === currentDate);
  if (currentScheduled) required(today.current?.pe === currentScheduled.pe, `Virada diária incompleta: esperado ${currentScheduled.pe}, publicado ${today.current?.pe}.`);
}

console.log(`Snapshot diário validado: ${snapshotDate}, ${today.current?.pe}, fontes públicas consistentes${process.env.REQUIRE_CURRENT_SNAPSHOT === 'true' ? ' e data atual confirmada' : ''}.`);
