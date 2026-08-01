import {STORAGE_KEYS} from './contracts.js?v=1.0.0';

const PE_PROGRESS_SCHEMA_VERSION = '1.0.0';
const MAX_ATTEMPT_IDS = 100;
const MAX_REVIEW_IDS = 500;

function resolveStorage(storage) {
  const target = storage ?? globalThis.localStorage;
  if (!target || typeof target.getItem !== 'function' || typeof target.setItem !== 'function') {
    throw new TypeError('Armazenamento local indisponível.');
  }
  return target;
}

function validateEntry(entry) {
  if (!entry || entry.schemaVersion !== '1.0.0' || !/^PE(?:0[1-9]|[1-9]\d|1[01]\d|112)$/.test(entry.peId)) {
    throw new TypeError('Progresso local do PE inválido.');
  }
  if (entry.scope !== 'pilot-local' || entry.officialCompleted !== false || entry.notionWriteback !== false) {
    throw new TypeError('Progresso local misturado ao estado oficial.');
  }
  if (!Array.isArray(entry.attemptIds) || !Array.isArray(entry.completedReviewIds)) throw new TypeError('Índices do progresso local inválidos.');
  return entry;
}

function readEnvelope(storage) {
  const target = resolveStorage(storage);
  const raw = target.getItem(STORAGE_KEYS.peProgress);
  if (!raw) return {target, byPe: {}};
  let envelope;
  try { envelope = JSON.parse(raw); }
  catch { throw new Error('Progresso local dos PE corrompido.'); }
  if (!envelope || envelope.schemaVersion !== PE_PROGRESS_SCHEMA_VERSION || !envelope.byPe || typeof envelope.byPe !== 'object') {
    throw new Error('Estrutura do progresso local dos PE inválida.');
  }
  const byPe = Object.fromEntries(Object.entries(envelope.byPe).map(([peId, entry]) => [peId, validateEntry(entry)]));
  return {target, byPe};
}

function writeEnvelope(target, byPe) {
  target.setItem(STORAGE_KEYS.peProgress, JSON.stringify({schemaVersion: PE_PROGRESS_SCHEMA_VERSION, updatedAt: Date.now(), byPe}));
}

function emptyEntry(peId) {
  return {
    schemaVersion: '1.0.0',
    peId,
    scope: 'pilot-local',
    officialCompleted: false,
    officialStatus: 'not_modified',
    notionWriteback: false,
    attemptIds: [],
    completedReviewIds: [],
    pilotAttempts: 0,
    reviewAttempts: 0,
    latestAttemptAt: null,
    latestAttemptId: null,
    bestPercent: null,
    latestPercent: null,
    totalQuestionsAnswered: 0,
    totalCorrect: 0,
    totalIncorrect: 0,
  };
}

export function readPeProgress(peId, storage) {
  const envelope = readEnvelope(storage);
  const entry = envelope.byPe[peId];
  return entry ? Object.freeze(validateEntry(entry)) : null;
}

export function readAllPeProgress(storage) {
  const envelope = readEnvelope(storage);
  return Object.freeze(Object.fromEntries(Object.entries(envelope.byPe).map(([peId, entry]) => [peId, Object.freeze(entry)])));
}

export function recordAttemptPeProgress(attempt, storage) {
  if (!attempt || !attempt.id || !attempt.peId || !['pilot','review'].includes(attempt.mode)) throw new TypeError('Tentativa inválida para o progresso do PE.');
  if (attempt.officialProgress !== false || attempt.notionWriteback !== false || attempt.pilot !== true) throw new TypeError('Tentativa fora do escopo local.');
  const envelope = readEnvelope(storage);
  const current = envelope.byPe[attempt.peId] ? {...validateEntry(envelope.byPe[attempt.peId])} : emptyEntry(attempt.peId);
  const isReview = attempt.mode === 'review';
  const indexName = isReview ? 'completedReviewIds' : 'attemptIds';
  const alreadyRecorded = current[indexName].includes(attempt.id);
  if (!alreadyRecorded) {
    current[indexName] = [attempt.id, ...current[indexName]].slice(0, isReview ? MAX_REVIEW_IDS : MAX_ATTEMPT_IDS);
    if (isReview) current.reviewAttempts += 1;
    else current.pilotAttempts += 1;
    current.totalQuestionsAnswered += attempt.total;
    current.totalCorrect += attempt.correct;
    current.totalIncorrect += attempt.incorrect;
  }
  if (current.latestAttemptAt === null || attempt.finishedAt >= current.latestAttemptAt) {
    current.latestAttemptAt = attempt.finishedAt;
    current.latestAttemptId = attempt.id;
    current.latestPercent = attempt.percent;
  }
  current.bestPercent = current.bestPercent === null ? attempt.percent : Math.max(current.bestPercent, attempt.percent);
  current.officialCompleted = false;
  current.officialStatus = 'not_modified';
  current.notionWriteback = false;
  current.scope = 'pilot-local';
  const validated = validateEntry(current);
  const byPe = {...envelope.byPe, [attempt.peId]: validated};
  writeEnvelope(envelope.target, byPe);
  return Object.freeze(validated);
}

export function clearPeProgress(storage) {
  resolveStorage(storage).removeItem(STORAGE_KEYS.peProgress);
}
