import assert from 'node:assert/strict';
import {
  BACKUP_KIND,
  DAILY_STORAGE_KEY,
  MODULE_STORAGE_KEY,
  createLocalBackup,
  parseLocalBackup,
  restoreLocalBackup,
} from '../assets/integration/local-backup.js';

class MemoryStorage {
  constructor(entries = {}) { this.map = new Map(Object.entries(entries)); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}

const daily = {
  version: 1,
  items: {
    PE01: {material: true, questions: true, registered: false, updatedAt: '2026-08-03T04:00:00.000Z'},
    PE02: {material: true, questions: false, registered: false, updatedAt: '2026-08-03T04:10:00.000Z'},
  },
};
const moduleState = {
  schemaVersion: '2.0.0',
  updatedAt: 1785730200000,
  attempts: [{id: 'attempt:1'}],
  errors: [{id: 'error:1'}],
  marked: [],
  reviews: [{id: 'review:1'}],
  aiQueue: [],
};
const source = new MemoryStorage({
  [DAILY_STORAGE_KEY]: JSON.stringify(daily),
  [MODULE_STORAGE_KEY]: JSON.stringify(moduleState),
});

const backup = createLocalBackup(source, '2026-08-03T04:30:00.000Z');
assert.equal(backup.kind, BACKUP_KIND);
assert.deepEqual(backup.summary, {
  peWithProgress: 2,
  completedSteps: 3,
  attempts: 1,
  errors: 1,
  reviews: 1,
  aiQueue: 0,
});

const parsed = parseLocalBackup(JSON.stringify(backup));
const target = new MemoryStorage();
const restoredSummary = restoreLocalBackup(parsed, target);
assert.deepEqual(restoredSummary, backup.summary);
assert.deepEqual(JSON.parse(target.getItem(DAILY_STORAGE_KEY)), daily);
assert.deepEqual(JSON.parse(target.getItem(MODULE_STORAGE_KEY)), moduleState);

assert.throws(() => parseLocalBackup('{'), /JSON válido/);
assert.throws(() => parseLocalBackup(JSON.stringify({kind: 'outro', version: 1, stores: {}})), /não é um backup compatível/);
assert.throws(() => parseLocalBackup(JSON.stringify({kind: BACKUP_KIND, version: 1, stores: {dailyExecution: {version: 1, items: {PE999: {}}}, questionModule: null}})), /Progresso diário inválido/);

const emptyBackup = parseLocalBackup(JSON.stringify({kind: BACKUP_KIND, version: 1, stores: {dailyExecution: null, questionModule: null}}));
restoreLocalBackup(emptyBackup, target);
assert.equal(target.getItem(DAILY_STORAGE_KEY), null);
assert.equal(target.getItem(MODULE_STORAGE_KEY), null);

class FailingStorage extends MemoryStorage {
  constructor(entries) { super(entries); this.fail = false; }
  setItem(key, value) {
    if (this.fail && key === MODULE_STORAGE_KEY) throw new Error('quota simulada');
    super.setItem(key, value);
  }
}
const previousDaily = JSON.stringify({version: 1, items: {PE03: {material: true, questions: false, registered: false, updatedAt: null}}});
const previousModule = JSON.stringify({...moduleState, attempts: [{id: 'anterior'}]});
const failing = new FailingStorage({[DAILY_STORAGE_KEY]: previousDaily, [MODULE_STORAGE_KEY]: previousModule});
failing.fail = true;
assert.throws(() => restoreLocalBackup(parsed, failing), /restauração foi revertida/);
assert.equal(failing.getItem(DAILY_STORAGE_KEY), previousDaily);
assert.equal(failing.getItem(MODULE_STORAGE_KEY), previousModule);

console.log('Backup local testado: exportação, validação, restauração, remoção e rollback atômico.');
