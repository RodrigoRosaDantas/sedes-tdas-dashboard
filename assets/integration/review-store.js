import {STORAGE_KEYS} from './contracts.js?v=1.0.0';
import {buildReviewSchedule} from './review-scheduler.js?v=1.0.0';

const REVIEW_ENVELOPE_VERSION = '1.0.0';
const MAX_REVIEW_ITEMS = 2000;

function resolveStorage(storage) {
  const target = storage ?? globalThis.localStorage;
  if (!target || typeof target.getItem !== 'function' || typeof target.setItem !== 'function') {
    throw new TypeError('Armazenamento local indisponível.');
  }
  return target;
}

function validateReview(review) {
  if (!review || review.schemaVersion !== '1.0.0' || !review.id || !review.questionId) throw new TypeError('Revisão inválida.');
  if (!['D0','D+1','D+7','D+20'].includes(review.stage)) throw new TypeError('Etapa de revisão inválida.');
  if (!['pending','completed'].includes(review.status)) throw new TypeError('Estado de revisão inválido.');
  if (review.officialProgress !== false || review.notionWriteback !== false || review.pilot !== true) {
    throw new TypeError('Revisão fora do isolamento local.');
  }
  return review;
}

function readEnvelope(storage) {
  const target = resolveStorage(storage);
  const raw = target.getItem(STORAGE_KEYS.reviews);
  if (!raw) return {target, reviews: []};
  let envelope;
  try { envelope = JSON.parse(raw); }
  catch { throw new Error('Agenda local de revisões corrompida.'); }
  if (!envelope || envelope.schemaVersion !== REVIEW_ENVELOPE_VERSION || !Array.isArray(envelope.reviews)) {
    throw new Error('Estrutura da agenda local de revisões inválida.');
  }
  return {target, reviews: envelope.reviews.map(validateReview)};
}

function writeReviews(target, reviews) {
  target.setItem(STORAGE_KEYS.reviews, JSON.stringify({
    schemaVersion: REVIEW_ENVELOPE_VERSION,
    updatedAt: Date.now(),
    reviews: reviews.slice(0, MAX_REVIEW_ITEMS),
  }));
}

export function readReviews(storage) {
  return Object.freeze(readEnvelope(storage).reviews);
}

export function getReviewById(reviewId, storage) {
  return readReviews(storage).find(review => review.id === reviewId) || null;
}

export function scheduleAttemptReviews(attempt, storage, options = {}) {
  const envelope = readEnvelope(storage);
  const incoming = buildReviewSchedule(attempt, options);
  const incomingIds = new Set(incoming.map(review => review.id));
  const reviews = [...incoming, ...envelope.reviews.filter(review => !incomingIds.has(review.id))]
    .sort((a, b) => a.dueAt - b.dueAt || a.numeroOriginal - b.numeroOriginal)
    .slice(0, MAX_REVIEW_ITEMS);
  writeReviews(envelope.target, reviews);
  return Object.freeze({added: incoming.length, total: reviews.length, stages: Object.freeze([...new Set(incoming.map(review => review.stage))])});
}

export function readDueReviews(now = Date.now(), storage) {
  return Object.freeze(readReviews(storage).filter(review => review.status === 'pending' && review.dueAt <= Number(now)));
}

export function completeReview(reviewId, {reviewAttemptId, outcome, completedAt = Date.now()} = {}, storage) {
  if (!reviewAttemptId || !outcome) throw new TypeError('Resultado da revisão incompleto.');
  const envelope = readEnvelope(storage);
  let found = false;
  const reviews = envelope.reviews.map(review => {
    if (review.id !== reviewId) return review;
    found = true;
    return validateReview({...review, status: 'completed', completedAt: Number(completedAt), reviewAttemptId, outcome});
  });
  if (!found) throw new RangeError('Revisão não encontrada.');
  writeReviews(envelope.target, reviews);
  return reviews.find(review => review.id === reviewId);
}

export function clearReviews(storage) {
  resolveStorage(storage).removeItem(STORAGE_KEYS.reviews);
}
