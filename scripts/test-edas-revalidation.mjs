import assert from 'node:assert/strict';

import {
  assertObservationMatchesSite,
  buildEdasRevalidation,
  computeEdasObservation,
} from './revalidate-edas.mjs';

const control = Array.from({ length: 42 }, (_, index) => ({
  id: `page-${index + 1}`,
  properties: {
    'Dia ID': `S${String(index + 1).padStart(2, '0')}`,
    'Bloco objetivo concluído?': index < 6,
    'Total do dia — feitas': index === 0 ? 205 : 0,
    'Acertos gerais oficiais': index === 0 ? 167 : 0,
  },
}));
const errors = Array.from({ length: 31 }, (_, index) => ({ id: `error-${index + 1}` }));
const cases = Array.from({ length: 12 }, (_, index) => ({ id: `case-${index + 1}` }));
const site = {
  meta: { version: '20260811.1', snapshotDate: '2026-08-24' },
  plan: { totalSprints: 42 },
  metrics: { completed: 6, questions: 205, correct: 167, accuracy: 81.46, errors: 38, casesTotal: 12 },
  errorCoverage: { loaded: 31 },
  today: { sprint: 'S08' },
};
const sources = { control: 'control-id', errors: 'errors-id', cases: 'cases-id' };

const observed = computeEdasObservation({ control, errors, cases });
assert.deepEqual(observed, {
  totalSprints: 42,
  completedSprints: 6,
  questions: 205,
  correct: 167,
  accuracy: 81.46,
  errorsAccumulated: 38,
  errorPages: 31,
  cases: 12,
});
assert.deepEqual(assertObservationMatchesSite(observed, site), observed);

const document = buildEdasRevalidation({ site, sources, observed, now: '2026-08-29T12:34:56Z' });
assert.equal(document.status, 'no_changes');
assert.equal(document.validatedAt, '2026-08-29T09:34:56-03:00');
assert.equal(document.validatedDate, '2026-08-29');
assert.equal(document.dataVersion, site.meta.version);
assert.equal(document.sprintId, 'S08');
assert.equal(document.sources.control, 'collection://control-id');
assert.match(document.note, /três fontes oficiais/);

assert.throws(
  () => computeEdasObservation({ control: control.slice(1), errors, cases }),
  /42 Sprints/,
);
assert.throws(
  () => computeEdasObservation({ control: control.map((row, index) => index === 41 ? { ...row, properties: { ...row.properties, 'Dia ID': 'S41' } } : row), errors, cases }),
  /duplicado/,
);
assert.throws(
  () => assertObservationMatchesSite({ ...observed, questions: 204 }, site),
  /diverge do snapshot/,
);

console.log('Revalidação EDAS: leitura integral, invariantes, divergência e documento seguro cobertos.');
