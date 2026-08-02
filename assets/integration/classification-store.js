import {isKnownResponseClassification, isValidPeId, STORAGE_KEYS} from './contracts.js?v=1.0.0';

const INDEX_SCHEMA_VERSION = '1.0.0';
const MAX_INDEX_ITEMS = 500;

function resolveStorage(storage) {
  const target = storage ?? globalThis.localStorage;
  if (!target || typeof target.getItem !== 'function' || typeof target.setItem !== 'function') {
    throw new TypeError('Armazenamento local indisponível.');
  }
  return target;
}

function validateIndexItem(item, key, label) {
  if (!item || typeof item !== 'object' || !item.id || !item.attemptId || !item.questionId) {
    throw new TypeError(`${label} local contém registro inválido.`);
  }
  if (item.profileId !== 'rodrigo' || item.cargoCode !== '202' || item.pilot !== true || !isValidPeId(item.peId)
    || item.officialProgress !== false || item.notionWriteback !== false || !Number.isFinite(item.createdAt)) {
    throw new TypeError(`${label} local contém registro fora do escopo piloto.`);
  }
  if (!String(item.selected ?? '').trim() || !isKnownResponseClassification(item.classification)) {
    throw new TypeError(`${label} local contém resposta ou classificação inválida.`);
  }
  if (key === STORAGE_KEYS.errors && (item.classification !== 'incorrect_confirmed'
    || item.issue === 'annulment_pending' || item.issue === 'source_error')) {
    throw new TypeError('Caderno de erros local contém registro que não é erro confirmado.');
  }
  if (key === STORAGE_KEYS.marked && item.marked !== true) {
    throw new TypeError('Índice de marcações contém registro não marcado.');
  }
  return item;
}

function readEnvelope(storage, key, label) {
  const target = resolveStorage(storage);
  const raw = target.getItem(key);
  if (!raw) return {target, items: []};
  let envelope;
  try { envelope = JSON.parse(raw); }
  catch { throw new Error(`${label} local corrompido.`); }
  if (!envelope || envelope.schemaVersion !== INDEX_SCHEMA_VERSION || !Array.isArray(envelope.items)) {
    throw new Error(`Estrutura do ${label.toLowerCase()} local inválida.`);
  }
  return {target, items: envelope.items.map(item => validateIndexItem(item, key, label))};
}

function writeEnvelope(target, key, items) {
  target.setItem(key, JSON.stringify({schemaVersion: INDEX_SCHEMA_VERSION, updatedAt: Date.now(), items}));
}

function mergeItems(current, incoming) {
  const incomingIds = new Set(incoming.map(item => item.id));
  return [...incoming, ...current.filter(item => !incomingIds.has(item.id))]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_INDEX_ITEMS);
}

function baseRecord(attempt, question) {
  return {
    attemptId: attempt.id,
    materialId: attempt.materialId,
    peId: attempt.peId,
    profileId: attempt.profileId,
    cargoCode: attempt.cargoCode,
    pilot: attempt.pilot,
    officialProgress: false,
    notionWriteback: false,
    questionId: question.id,
    numeroOriginal: question.numeroOriginal,
    assunto: question.assunto,
    subassunto: question.subassunto,
    selected: question.selected,
    correctAnswer: question.correctAnswer,
    classification: question.classification,
    confidence: question.confidence,
    issue: question.issue,
    marked: question.marked,
    createdAt: attempt.finishedAt,
  };
}

export function syncAttemptIndexes(attempt, storage) {
  if (!attempt || !Array.isArray(attempt.questionResults)) throw new TypeError('Tentativa inválida para indexação.');
  const errors = attempt.questionResults
    .filter(question => question.errorBookEligible === true && question.classification === 'incorrect_confirmed')
    .map(question => Object.freeze({id: `error:${attempt.id}:${question.id}`, ...baseRecord(attempt, question)}));
  const marked = attempt.questionResults
    .filter(question => question.marked === true)
    .map(question => Object.freeze({id: `marked:${attempt.id}:${question.id}`, ...baseRecord(attempt, question)}));

  const errorEnvelope = readEnvelope(storage, STORAGE_KEYS.errors, 'Caderno de erros');
  const markedEnvelope = readEnvelope(errorEnvelope.target, STORAGE_KEYS.marked, 'Itens marcados');
  const mergedErrors = mergeItems(errorEnvelope.items, errors);
  const mergedMarked = mergeItems(markedEnvelope.items, marked);
  writeEnvelope(errorEnvelope.target, STORAGE_KEYS.errors, mergedErrors);
  writeEnvelope(errorEnvelope.target, STORAGE_KEYS.marked, mergedMarked);
  return Object.freeze({errorsAdded: errors.length, markedAdded: marked.length, totalErrors: mergedErrors.length, totalMarked: mergedMarked.length});
}

export function readErrors(storage) {
  return Object.freeze(readEnvelope(storage, STORAGE_KEYS.errors, 'Caderno de erros').items);
}

export function readMarked(storage) {
  return Object.freeze(readEnvelope(storage, STORAGE_KEYS.marked, 'Itens marcados').items);
}

export function clearClassificationIndexes(storage) {
  const target = resolveStorage(storage);
  target.removeItem(STORAGE_KEYS.errors);
  target.removeItem(STORAGE_KEYS.marked);
}
