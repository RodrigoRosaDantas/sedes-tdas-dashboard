import assert from 'node:assert/strict';
import { dateInTimeZone, prepareCalendarState, requiresCalendarRefresh } from './notion/calendar-refresh.mjs';

assert.equal(dateInTimeZone('2026-08-03T02:30:00Z'), '2026-08-02');
assert.equal(dateInTimeZone('2026-08-03T03:30:00Z'), '2026-08-03');

const current = { snapshotDate: '2026-08-03', semanticHash: 'abc' };
assert.equal(requiresCalendarRefresh(current, '2026-08-03'), false);
assert.deepEqual(prepareCalendarState(current, '2026-08-03'), { changed: false, state: current });

const previous = { snapshotDate: '2026-08-02', semanticHash: 'abc', counts: { controls: 112 } };
const refreshed = prepareCalendarState(previous, '2026-08-03');
assert.equal(refreshed.changed, true);
assert.equal(refreshed.state.snapshotDate, '2026-08-02');
assert.equal(refreshed.state.semanticHash, 'calendar-refresh:2026-08-03:abc');
assert.deepEqual(previous, { snapshotDate: '2026-08-02', semanticHash: 'abc', counts: { controls: 112 } });

const empty = prepareCalendarState({}, '2026-08-03');
assert.equal(empty.changed, true);
assert.equal(empty.state.semanticHash, 'calendar-refresh:2026-08-03:missing');

console.log('Virada diária testada: fuso de Brasília, estabilidade no mesmo dia e invalidação controlada no dia seguinte.');
