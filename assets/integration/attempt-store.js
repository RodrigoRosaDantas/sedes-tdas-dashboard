import {STORAGE_KEYS} from './contracts.js?v=1.0.0';

export const ATTEMPT_SCHEMA_VERSION = '1.0.0';
export const ATTEMPT_ENVELOPE_VERSION = '1.0.0';
export const MAX_LOCAL_ATTEMPTS = 100;

function resolveStorage(storage) {
  const target = storage ?? globalThis.localStorage;
  if (!target || typeof target.getItem !== 'function' || typeof target.setItem !== 'function') {
    throw new TypeError('Armazenamento local indisponível.');
  }
  return target;
}

function validateAttempt(attempt) {
  if (!attempt || typeof attempt !== 'object' || Array.isArray(attempt)) throw new TypeError('Tentativa inválida.');
  if (attempt.schemaVersion !== ATTEMPT_SCHEMA_VERSION) throw new TypeError('Versão da tentativa inválida.');
  if (!attempt.id || !attempt.materialId || !attempt.peId) throw new TypeError('Identificação da tentativa incompleta.');
  if (attempt.profileId !== 'rodrigo' || attempt.cargoCode !== '202') throw new TypeError('Perfil ou cargo incompatível.');
  if (attempt.pilot !== true || attempt.officialProgress !== false || attempt.notionWriteback !== false) {
    throw new TypeError('Tentativa fora do isolamento do piloto.');
  }
  if (!Array.isArray(attempt.questionResults) || attempt.questionResults.length !== attempt.total) {
    throw new TypeError('Resultados individuais da tentativa inválidos.');
  }
  return attempt;
}

export function createAttemptRecord({catalog, evaluation, savedAt = Date.now()}) {
  if (!catalog || catalog.id !== evaluation?.session?.materialId) throw new TypeError('Catálogo e avaliação incompatíveis.');
  const questions = new Map(catalog.questoes.map(question => [question.id, question]));
  const questionResults = evaluation.results.map(result => {
    const question = questions.get(result.id);
    if (!question) throw new TypeError(`Questão ausente do catálogo: ${result.id}.`);
    return Object.freeze({
      id: result.id,
      numeroOriginal: question.numero_original,
      assunto: question.assunto,
      subassunto: question.subassunto,
      selected: result.selected,
      correctAnswer: result.correctAnswer,
      correct: result.correct,
    });
  });
  const record = Object.freeze({
    schemaVersion: ATTEMPT_SCHEMA_VERSION,
    id: `attempt:${catalog.id}:${evaluation.session.startedAt}`,
    profileId: 'rodrigo',
    cargoCode: '202',
    mode: 'pilot',
    pilot: true,
    officialProgress: false,
    notionWriteback: false,
    materialId: catalog.id,
    peId: 'PE76',
    startedAt: evaluation.session.startedAt,
    finishedAt: evaluation.session.finishedAt,
    savedAt: Number(savedAt),
    correct: evaluation.correct,
    incorrect: evaluation.incorrect,
    total: evaluation.total,
    percent: evaluation.percent,
    elapsedMs: evaluation.elapsedMs,
    questionResults: Object.freeze(questionResults),
  });
  return validateAttempt(record);
}

export function readAttempts(storage) {
  const target = resolveStorage(storage);
  const raw = target.getItem(STORAGE_KEYS.attempts);
  if (!raw) return Object.freeze([]);
  let envelope;
  try { envelope = JSON.parse(raw); }
  catch { throw new Error('Histórico local de tentativas corrompido.'); }
  if (!envelope || envelope.schemaVersion !== ATTEMPT_ENVELOPE_VERSION || !Array.isArray(envelope.attempts)) {
    throw new Error('Estrutura do histórico local de tentativas inválida.');
  }
  return Object.freeze(envelope.attempts.map(validateAttempt));
}

export function saveAttempt(attempt, storage) {
  const target = resolveStorage(storage);
  const valid = validateAttempt(attempt);
  const current = [...readAttempts(target)];
  const withoutDuplicate = current.filter(item => item.id !== valid.id);
  const attempts = [valid, ...withoutDuplicate]
    .sort((a, b) => b.finishedAt - a.finishedAt)
    .slice(0, MAX_LOCAL_ATTEMPTS);
  const envelope = {schemaVersion: ATTEMPT_ENVELOPE_VERSION, updatedAt: Date.now(), attempts};
  target.setItem(STORAGE_KEYS.attempts, JSON.stringify(envelope));
  return Object.freeze({attempt: valid, totalStored: attempts.length, storageKey: STORAGE_KEYS.attempts});
}

export function clearAttempts(storage) {
  const target = resolveStorage(storage);
  target.removeItem(STORAGE_KEYS.attempts);
}
