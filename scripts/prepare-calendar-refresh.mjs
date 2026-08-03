import fs from 'node:fs/promises';
import path from 'node:path';
import { dateInTimeZone, prepareCalendarState } from './notion/calendar-refresh.mjs';

const ROOT = process.cwd();
const FILE = path.join(ROOT, 'data/notion/state.json');
let state = {};
try { state = JSON.parse(await fs.readFile(FILE, 'utf8')); } catch {}

const currentDate = dateInTimeZone(process.env.NOW || new Date());
const prepared = prepareCalendarState(state, currentDate);
if (prepared.changed) {
  await fs.writeFile(FILE, `${JSON.stringify(prepared.state)}\n`, 'utf8');
}

console.log(JSON.stringify({
  currentDate,
  previousSnapshotDate: state.snapshotDate || null,
  calendarRefresh: prepared.changed,
}));
