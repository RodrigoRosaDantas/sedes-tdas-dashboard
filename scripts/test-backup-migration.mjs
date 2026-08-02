import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {readAttempts, saveAttempt} from '../assets/integration/attempt-store.js';
import {STORAGE_KEYS} from '../assets/integration/contracts.js';
import {
  applyLegacyMigration,
  createStudyBackup,
  LEGACY_KEYS,
  previewLegacyMigration,
  restoreStudyBackup,
  validateStudyBackup,
} from '../assets/integration/backup-migration-core.js';

class MemoryStorage {
  constructor(failKey = null) { this.items = new Map(); this.failKey = failKey; }
  getItem(key) { return this.items.has(key) ? this.items.get(key) : null; }
  setItem(key, value) { if (key === this.failKey) throw new Error('quota simulada'); this.items.set(key, String(value)); }
  removeItem(key) { this.items.delete(key); }
  key(index) { return [...this.items.keys()][index] ?? null; }
  get length() { return this.items.size; }
}

const canonical = value => Array.isArray(value)
  ? `[${value.map(canonical).join(',')}]`
  : value && typeof value === 'object'
    ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
    : JSON.stringify(value);
const resign = value => {
  const {checksum: _checksum, ...payload} = value;
  return {...payload, checksum: crypto.createHash('sha256').update(canonical(payload)).digest('hex')};
};

const compatibleLegacy = {
  profileId: 'rodrigo',
  cargoCode: '202',
  peId: 'PE10',
  materialId: 'legacy-material-1',
  startedAt: 1_000,
  finishedAt: 61_000,
  questionResults: [
    {id: 'legacy-q1', answer: 'A', correct: true, assunto: 'Português'},
    {id: 'legacy-q2', answer: 'B', correct: false, assunto: 'SUAS'},
  ],
};
const blockedCargo = {...compatibleLegacy, cargoCode: '400', materialId: 'legacy-material-2'};
const blockedIncomplete = {...compatibleLegacy, materialId: 'legacy-material-3', questionResults: [{id: 'x', correct: true}]};

const storage = new MemoryStorage();
storage.setItem('tdas.202.study.v1.meta', '{"version":1}');
storage.setItem(LEGACY_KEYS.activeProfile, 'rodrigo');
storage.setItem(LEGACY_KEYS.history, JSON.stringify([compatibleLegacy, blockedCargo, blockedIncomplete]));

const backup = await createStudyBackup(storage, 123_000);
assert.equal(backup.createdAt, 123_000);
assert.equal(backup.tdas['tdas.202.study.v1.meta'], '{"version":1}');
assert.equal(backup.tdas['tdas.202.study.v1.attempts'], null);
assert.equal((await validateStudyBackup(backup)).checksum, backup.checksum);

const tampered = {...backup, tdas: {...backup.tdas, 'tdas.202.study.v1.meta': 'alterado'}};
await assert.rejects(() => validateStudyBackup(tampered), /Checksum/);

const unexpectedKey = resign({...backup, tdas: {...backup.tdas, 'sedes.official.progress': '{"completed":true}'}});
await assert.rejects(() => validateStudyBackup(unexpectedKey), /chaves ausentes ou não autorizadas/);

const invalidErrorItem = {
  id: 'error:attempt:1:q1', attemptId: 'attempt:1', materialId: 'pilot-pe76-2026-tdas', peId: 'PE76', profileId: 'rodrigo', cargoCode: '202',
  pilot: true, officialProgress: false, notionWriteback: false, questionId: 'q1', numeroOriginal: 1, assunto: 'Teste', subassunto: 'Teste',
  selected: 'A', correctAnswer: 'B', classification: 'source_error', confidence: 'secure', issue: 'source_error', marked: false, createdAt: 1,
};
const invalidErrorBackup = resign({...backup, tdas: {...backup.tdas, [STORAGE_KEYS.errors]: JSON.stringify({schemaVersion: '1.0.0', updatedAt: 1, items: [invalidErrorItem]})}});
await assert.rejects(() => validateStudyBackup(invalidErrorBackup), /não é erro confirmado/);

storage.setItem('tdas.202.study.v1.meta', 'temporário');
const restored = await restoreStudyBackup(backup, storage);
assert.equal(restored.restoredLegacyKeys, 0);
assert.equal(storage.getItem('tdas.202.study.v1.meta'), '{"version":1}');
assert.equal(storage.getItem(LEGACY_KEYS.history), JSON.stringify([compatibleLegacy, blockedCargo, blockedIncomplete]));

const plan = previewLegacyMigration(storage);
assert.equal(plan.total, 3);
assert.equal(plan.compatible.length, 1);
assert.equal(plan.blocked.length, 2);
assert.deepEqual(plan.blocked.map(item => item.reason), ['cargo-not-202', 'question-result-incomplete']);
assert.equal(plan.compatible[0].mode, 'legacy');
assert.equal(plan.compatible[0].pilot, false);
assert.equal(plan.compatible[0].sourceSystem, 'sedes-df-questoes');
assert.equal(plan.compatible[0].questionResults[1].classification, 'incorrect_confirmed');

const blankAttempt = {...plan.compatible[0], questionResults: plan.compatible[0].questionResults.map((item, index) => index === 1 ? {...item, selected: ''} : item)};
const blankAttemptBackup = resign({...backup, tdas: {...backup.tdas, [STORAGE_KEYS.attempts]: JSON.stringify({schemaVersion: '1.0.0', updatedAt: 1, attempts: [blankAttempt]})}});
await assert.rejects(() => validateStudyBackup(blankAttemptBackup), /Resposta em branco/);

const migrated = applyLegacyMigration(plan, readAttempts, saveAttempt, storage);
assert.equal(migrated.imported, 1);
assert.equal(migrated.blocked, 2);
assert.equal(migrated.sourcePreserved, true);
assert.equal(readAttempts(storage)[0].mode, 'legacy');
assert.equal(applyLegacyMigration(plan, readAttempts, saveAttempt, storage).totalStored, 1, 'Migração não foi idempotente.');

const wrongProfile = new MemoryStorage();
wrongProfile.setItem(LEGACY_KEYS.activeProfile, 'amanda');
wrongProfile.setItem(LEGACY_KEYS.history, JSON.stringify([compatibleLegacy]));
assert.equal(previewLegacyMigration(wrongProfile).compatible.length, 0);
assert.equal(previewLegacyMigration(wrongProfile).blocked[0].reason, 'profile-not-rodrigo');

const corrupt = new MemoryStorage();
corrupt.setItem(LEGACY_KEYS.history, '{');
assert.throws(() => previewLegacyMigration(corrupt), /corrompido/);

const rollback = new MemoryStorage('tdas.202.study.v1.attempts');
rollback.setItem(LEGACY_KEYS.activeProfile, 'rodrigo');
rollback.setItem(LEGACY_KEYS.history, JSON.stringify([compatibleLegacy]));
const rollbackPlan = previewLegacyMigration(rollback);
assert.throws(() => applyLegacyMigration(rollbackPlan, readAttempts, saveAttempt, rollback), /revertida/);
assert.equal(rollback.getItem('tdas.202.study.v1.attempts'), null);
assert.notEqual(rollback.getItem(LEGACY_KEYS.history), null);

console.log('Backup e migração testados: checksum, chaves autorizadas, validação semântica, restauração, filtros, idempotência, corrupção, preservação e rollback.');
