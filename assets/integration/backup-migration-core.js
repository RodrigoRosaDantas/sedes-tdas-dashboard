import {STORAGE_KEYS, isKnownResponseClassification, isValidPeId} from './contracts.js?v=1.0.0';
import {readAttempts} from './attempt-store.js?v=1.0.0';
import {readErrors, readMarked} from './classification-store.js?v=1.0.0';
import {readAllPeProgress} from './pe-progress-store.js?v=1.0.0';
import {readReviews} from './review-store.js?v=1.0.0';

export const BACKUP_SCHEMA_VERSION = '1.0.0';
export const LEGACY_MIGRATION_VERSION = '1.0.0';
export const LEGACY_KEYS = Object.freeze({
  activeProfile: 'sedes.questoes.activeProfile.v3',
  profiles: 'sedes.questoes.profiles.v3',
  history: 'sedes.questoes.rodrigo.history.v3',
  errors: 'sedes.questoes.rodrigo.errors.v3',
  marked: 'sedes.questoes.rodrigo.marked.v3',
});
const TDAS_KEYS = Object.freeze(Object.values(STORAGE_KEYS));
const LEGACY_STORAGE_KEYS = Object.freeze(Object.values(LEGACY_KEYS));

function resolveStorage(storage) {
  const target = storage ?? globalThis.localStorage;
  if (!target || typeof target.getItem !== 'function' || typeof target.setItem !== 'function' || typeof target.removeItem !== 'function') {
    throw new TypeError('Armazenamento local indisponível.');
  }
  return target;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function readRawMap(target, keys) {
  return Object.fromEntries(keys.map(key => [key, target.getItem(key)]));
}

function assertRawMap(map, label, expectedKeys) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) throw new TypeError(`${label} inválido.`);
  const actual = Object.keys(map).sort();
  const expected = [...expectedKeys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new TypeError(`${label} contém chaves ausentes ou não autorizadas.`);
  for (const value of Object.values(map)) {
    if (value !== null && typeof value !== 'string') throw new TypeError(`${label} contém valor inválido.`);
  }
}

function rawMapStorage(map) {
  return {
    getItem: key => Object.hasOwn(map, key) ? map[key] : null,
    setItem: () => { throw new Error('Validação de backup tentou escrever no armazenamento.'); },
    removeItem: () => { throw new Error('Validação de backup tentou remover dado do armazenamento.'); },
  };
}

function validateCriticalTdasState(map) {
  const storage = rawMapStorage(map);
  readAttempts(storage);
  readErrors(storage);
  readMarked(storage);
  readReviews(storage);
  readAllPeProgress(storage);
}

export async function createStudyBackup(storage, createdAt = Date.now()) {
  const target = resolveStorage(storage);
  const payload = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: Number(createdAt),
    scope: 'rodrigo-202-local',
    tdas: readRawMap(target, TDAS_KEYS),
    legacy: readRawMap(target, LEGACY_STORAGE_KEYS),
  };
  validateCriticalTdasState(payload.tdas);
  return Object.freeze({...payload, checksum: await sha256(canonical(payload))});
}

export async function validateStudyBackup(backup) {
  if (!backup || backup.schemaVersion !== BACKUP_SCHEMA_VERSION || backup.scope !== 'rodrigo-202-local') {
    throw new TypeError('Arquivo de backup incompatível.');
  }
  assertRawMap(backup.tdas, 'Namespace TDAS', TDAS_KEYS);
  assertRawMap(backup.legacy, 'Namespace legado', LEGACY_STORAGE_KEYS);
  if (!Number.isFinite(backup.createdAt)) throw new TypeError('Data do backup inválida.');
  const {checksum, ...payload} = backup;
  if (!/^[a-f0-9]{64}$/.test(String(checksum || ''))) throw new TypeError('Checksum ausente ou inválido.');
  if (await sha256(canonical(payload)) !== checksum) throw new Error('Checksum do backup divergente.');
  validateCriticalTdasState(backup.tdas);
  return Object.freeze(backup);
}

function applyRawMap(target, map) {
  for (const [key, value] of Object.entries(map)) {
    if (value === null) target.removeItem(key);
    else target.setItem(key, value);
  }
}

export async function restoreStudyBackup(backup, storage, {includeLegacy = false} = {}) {
  const target = resolveStorage(storage);
  const valid = await validateStudyBackup(backup);
  const affected = [...Object.keys(valid.tdas), ...(includeLegacy ? Object.keys(valid.legacy) : [])];
  const before = readRawMap(target, affected);
  try {
    applyRawMap(target, valid.tdas);
    if (includeLegacy) applyRawMap(target, valid.legacy);
  } catch (error) {
    try {
      applyRawMap(target, before);
    } catch (rollbackError) {
      const aggregate = new AggregateError([error, rollbackError], 'Falha na restauração e no rollback local.');
      aggregate.cause = error;
      throw aggregate;
    }
    throw new Error(`Restauração revertida: ${error.message}`);
  }
  return Object.freeze({
    restoredTdasKeys: Object.keys(valid.tdas).length,
    restoredLegacyKeys: includeLegacy ? Object.keys(valid.legacy).length : 0,
    checksum: valid.checksum,
  });
}

function parseJson(raw, fallback, label) {
  if (!raw) return fallback;
  try { return JSON.parse(raw); }
  catch { throw new Error(`${label} corrompido.`); }
}

function cargoCodeOf(attempt) {
  return String(attempt?.cargoCode ?? attempt?.codigo_cargo ?? attempt?.role ?? attempt?.cargo ?? '');
}

function profileIdOf(attempt) {
  return String(attempt?.profileId ?? attempt?.profile ?? 'rodrigo').toLowerCase();
}

function selectedOf(result) {
  return result?.selected ?? result?.answer ?? result?.resposta ?? null;
}

function correctAnswerOf(result) {
  return result?.correctAnswer ?? result?.gabarito ?? null;
}

function normalizeLegacyMeta(result) {
  if (typeof result?.correct !== 'boolean') return null;
  const original = isKnownResponseClassification(result.classification) ? result.classification : null;
  const marked = result.marked === true || original === 'marked';
  if (original === 'source_error') return {classification: 'source_error', confidence: 'secure', issue: 'source_error', marked};
  if (original === 'annulment_pending') return {classification: 'annulment_pending', confidence: 'secure', issue: 'annulment_pending', marked};
  if (!result.correct) return {classification: 'incorrect_confirmed', confidence: 'secure', issue: 'none', marked};
  if (marked) return {classification: 'marked', confidence: 'secure', issue: 'none', marked: true};
  if (original === 'correct_by_guess') return {classification: 'correct_by_guess', confidence: 'guess', issue: 'none', marked: false};
  if (original === 'correct_with_doubt') return {classification: 'correct_with_doubt', confidence: 'doubt', issue: 'none', marked: false};
  return {classification: 'correct_secure', confidence: 'secure', issue: 'none', marked: false};
}

function block(index, reason) {
  return Object.freeze({index, reason});
}

export function previewLegacyMigration(storage) {
  const target = resolveStorage(storage);
  const activeProfile = String(target.getItem(LEGACY_KEYS.activeProfile) || 'rodrigo').toLowerCase();
  const history = parseJson(target.getItem(LEGACY_KEYS.history), [], 'Histórico legado');
  if (!Array.isArray(history)) throw new Error('Histórico legado deve ser uma lista.');
  const compatible = [];
  const blocked = [];

  history.forEach((attempt, index) => {
    if (activeProfile !== 'rodrigo' || profileIdOf(attempt) !== 'rodrigo') {
      blocked.push(block(index, 'profile-not-rodrigo'));
      return;
    }
    if (cargoCodeOf(attempt) !== '202') {
      blocked.push(block(index, 'cargo-not-202'));
      return;
    }
    if (!isValidPeId(attempt.peId)) {
      blocked.push(block(index, 'pe-missing-or-invalid'));
      return;
    }
    if (!attempt.materialId || !Array.isArray(attempt.questionResults) || !attempt.questionResults.length) {
      blocked.push(block(index, 'question-results-missing'));
      return;
    }

    const normalized = [];
    for (const result of attempt.questionResults) {
      const selected = selectedOf(result);
      const correctAnswer = correctAnswerOf(result);
      const meta = normalizeLegacyMeta(result);
      if (!result?.id || !String(selected ?? '').trim() || !meta) {
        normalized.length = 0;
        break;
      }
      normalized.push({
        id: String(result.id),
        numeroOriginal: Number(result.numeroOriginal ?? result.numero_original ?? 0) || null,
        assunto: String(result.assunto ?? result.discipline ?? 'Legado'),
        subassunto: String(result.subassunto ?? ''),
        selected: String(selected),
        correctAnswer: correctAnswer === null ? null : String(correctAnswer),
        correct: result.correct,
        confidence: meta.confidence,
        marked: meta.marked,
        issue: meta.issue,
        classification: meta.classification,
        errorBookEligible: meta.classification === 'incorrect_confirmed',
      });
    }
    if (!normalized.length) {
      blocked.push(block(index, 'question-result-incomplete'));
      return;
    }

    const startedAt = Number(attempt.startedAt ?? Date.parse(attempt.started_at ?? ''));
    const finishedAt = Number(attempt.finishedAt ?? Date.parse(attempt.finished_at ?? ''));
    if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt) || finishedAt < startedAt) {
      blocked.push(block(index, 'timestamps-invalid'));
      return;
    }

    const correct = normalized.filter(item => item.correct).length;
    compatible.push(Object.freeze({
      schemaVersion: '1.2.0',
      id: `attempt:legacy:${attempt.materialId}:${startedAt}`,
      profileId: 'rodrigo',
      cargoCode: '202',
      mode: 'legacy',
      sourceReviewId: null,
      pilot: false,
      officialProgress: false,
      notionWriteback: false,
      sourceSystem: 'sedes-df-questoes',
      materialId: String(attempt.materialId),
      peId: String(attempt.peId),
      startedAt,
      finishedAt,
      savedAt: Date.now(),
      correct,
      incorrect: normalized.length - correct,
      total: normalized.length,
      percent: normalized.length ? correct / normalized.length * 100 : 0,
      elapsedMs: Math.max(0, Number(attempt.elapsedMs ?? attempt.elapsed ?? finishedAt - startedAt)),
      classificationSummary: normalized.reduce((summary, item) => {
        summary[item.classification] = (summary[item.classification] || 0) + 1;
        return summary;
      }, {}),
      questionResults: normalized,
    }));
  });

  return Object.freeze({
    schemaVersion: LEGACY_MIGRATION_VERSION,
    sourceKey: LEGACY_KEYS.history,
    activeProfile,
    total: history.length,
    compatible: Object.freeze(compatible),
    blocked: Object.freeze(blocked),
    destructive: false,
  });
}

export function applyLegacyMigration(plan, readAttempts, saveAttempt, storage) {
  const target = resolveStorage(storage);
  if (!plan || plan.schemaVersion !== LEGACY_MIGRATION_VERSION || plan.destructive !== false || !Array.isArray(plan.compatible)) {
    throw new TypeError('Plano de migração inválido.');
  }
  const before = target.getItem(STORAGE_KEYS.attempts);
  try {
    for (const attempt of plan.compatible) saveAttempt(attempt, target);
  } catch (error) {
    try {
      if (before === null) target.removeItem(STORAGE_KEYS.attempts);
      else target.setItem(STORAGE_KEYS.attempts, before);
    } catch (rollbackError) {
      const aggregate = new AggregateError([error, rollbackError], 'Falha na migração e no rollback local.');
      aggregate.cause = error;
      throw aggregate;
    }
    throw new Error(`Migração revertida: ${error.message}`);
  }
  return Object.freeze({
    imported: plan.compatible.length,
    blocked: plan.blocked.length,
    totalStored: readAttempts(target).length,
    sourcePreserved: target.getItem(plan.sourceKey) !== null,
  });
}
