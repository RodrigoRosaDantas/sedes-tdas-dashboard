import {buildReinforcementReview,normalizeReviewOutcome} from './review-engine.js';

const STORAGE_KEY = 'tdas.202.question-module.v2.state';
const SCHEMA_VERSION = '2.0.0';
const DAY_MS = 86_400_000;
const MAX_ATTEMPTS = 200;
const MAX_INDEX_ITEMS = 2000;
const SESSION_MODES = Object.freeze(['study', 'review', 'complement']);

const emptyState = () => ({
  schemaVersion: SCHEMA_VERSION,
  updatedAt: null,
  attempts: [],
  errors: [],
  marked: [],
  reviews: [],
  aiQueue: [],
});

function resolveStorage(storage) {
  const target = storage ?? globalThis.localStorage;
  if (!target || typeof target.getItem !== 'function' || typeof target.setItem !== 'function') {
    throw new TypeError('Armazenamento local indisponível.');
  }
  return target;
}

function validateState(state) {
  if (!state || state.schemaVersion !== SCHEMA_VERSION) throw new Error('Estado local do módulo incompatível.');
  for (const key of ['attempts', 'errors', 'marked', 'reviews', 'aiQueue']) {
    if (!Array.isArray(state[key])) throw new Error(`Coleção local inválida: ${key}.`);
  }
  return state;
}

function freezeState(state) {
  return Object.freeze({
    ...state,
    attempts: Object.freeze([...state.attempts]),
    errors: Object.freeze([...state.errors]),
    marked: Object.freeze([...state.marked]),
    reviews: Object.freeze([...state.reviews]),
    aiQueue: Object.freeze([...state.aiQueue]),
  });
}

export function readModuleState(storage) {
  const target = resolveStorage(storage);
  const raw = target.getItem(STORAGE_KEY);
  if (!raw) return freezeState(emptyState());
  try {
    return freezeState(validateState(JSON.parse(raw)));
  } catch (error) {
    throw new Error(`Dados locais do módulo corrompidos: ${error.message}`);
  }
}

function mergeUnique(incoming, current, limit = MAX_INDEX_ITEMS) {
  const ids = new Set(incoming.map(item => item.id));
  return [...incoming, ...current.filter(item => !ids.has(item.id))].slice(0, limit);
}

function classify(result, meta = {}) {
  const confidence = ['secure', 'doubt', 'guess'].includes(meta.confidence) ? meta.confidence : 'secure';
  const issue = ['none', 'annulment_pending', 'source_error'].includes(meta.issue) ? meta.issue : 'none';
  const marked = meta.marked === true;
  if (issue !== 'none') return {classification: issue, confidence, issue, marked};
  if (!result.correct) return {classification: 'incorrect_confirmed', confidence, issue, marked};
  if (marked) return {classification: 'marked', confidence, issue, marked};
  if (confidence === 'doubt') return {classification: 'correct_with_doubt', confidence, issue, marked};
  if (confidence === 'guess') return {classification: 'correct_by_guess', confidence, issue, marked};
  return {classification: 'correct_secure', confidence, issue, marked};
}

function questionRecord(attempt, question, result, meta) {
  const classified = classify(result, meta);
  return Object.freeze({
    id: question.id,
    numeroOriginal: question.numeroOriginal ?? question.numero_original ?? null,
    assunto: String(question.assunto || 'Sem assunto'),
    subassunto: String(question.subassunto || ''),
    selected: result.selected,
    correctAnswer: result.correctAnswer,
    correct: result.correct,
    ...classified,
  });
}

export function saveCompletedAttempt({catalog, evaluation, responseMeta = {}, mode = 'study', reviewId = null, reviewOutcome = null}, storage) {
  if (!catalog || !evaluation || !SESSION_MODES.includes(mode)) throw new TypeError('Conclusão inválida.');
  if (mode === 'review' && !reviewId) throw new TypeError('Revisão de origem obrigatória.');
  const target = resolveStorage(storage);
  const before = target.getItem(STORAGE_KEY);
  const state = readModuleState(target);
  const byId = new Map(catalog.questions.map(question => [question.id, question]));
  const results = evaluation.results.map(result => {
    const question = byId.get(result.id);
    if (!question) throw new Error(`Questão ausente do catálogo: ${result.id}.`);
    return questionRecord(null, question, result, responseMeta[result.id]);
  });
  const resolvedReviewOutcome = mode === 'review' ? normalizeReviewOutcome(reviewOutcome, results[0]) : null;
  const attempt = Object.freeze({
    schemaVersion: '2.0.0',
    id: `attempt:${mode}:${catalog.catalogId}:${evaluation.session.startedAt}`,
    mode,
    reviewId: mode === 'review' ? String(reviewId) : null,
    reviewOutcome: resolvedReviewOutcome,
    catalogId: catalog.catalogId,
    peId: catalog.peId || null,
    startedAt: evaluation.session.startedAt,
    finishedAt: evaluation.session.finishedAt,
    elapsedMs: evaluation.elapsedMs,
    correct: evaluation.correct,
    incorrect: evaluation.incorrect,
    total: evaluation.total,
    percent: evaluation.percent,
    localOnly: true,
    notionWriteback: false,
    questionResults: Object.freeze(results),
  });

  const errors = results.filter(item => item.classification === 'incorrect_confirmed').map(item => ({
    ...item, id: `error:${attempt.id}:${item.id}`, attemptId: attempt.id, attemptMode: attempt.mode, peId: attempt.peId, createdAt: attempt.finishedAt,
  }));
  const marked = results.filter(item => item.marked).map(item => ({
    ...item, id: `marked:${attempt.id}:${item.id}`, attemptId: attempt.id, attemptMode: attempt.mode, peId: attempt.peId, createdAt: attempt.finishedAt,
  }));
  const aiQueue = results.filter(item => ['annulment_pending', 'source_error'].includes(item.classification)).map(item => ({
    ...item, id: `ai:${attempt.id}:${item.id}`, attemptId: attempt.id, attemptMode: attempt.mode, peId: attempt.peId, createdAt: attempt.finishedAt, status: 'pending',
  }));
  const eligible = results.filter(item => ['incorrect_confirmed', 'correct_with_doubt', 'correct_by_guess', 'marked'].includes(item.classification));
  const reviews = mode !== 'review' ? eligible.flatMap(item => [1, 7, 20].map(days => {
    const id=`review:${attempt.id}:${item.id}:D+${days}`;
    return{
      ...item,
      id,
      sourceAttemptId: attempt.id,
      sourceAttemptMode: attempt.mode,
      questionId: item.id,
      peId: attempt.peId,
      stage: `D+${days}`,
      dueAt: attempt.finishedAt + days * DAY_MS,
      status: 'pending',
      completedAt: null,
      reviewAttemptId: null,
      outcome: null,
      originReviewId: null,
      rootReviewId: id,
      recurrenceCount: 0,
      sourceOutcome: item.classification,
    };
  })) : [];

  let updatedReviews = mergeUnique(reviews, state.reviews);
  let reinforcement = null;
  if (mode === 'review') {
    const sourceReview=updatedReviews.find(review=>review.id===reviewId);
    if (!sourceReview) throw new Error('Revisão de origem não encontrada.');
    updatedReviews = updatedReviews.map(review => review.id !== reviewId ? review : ({
      ...review,
      status: 'completed',
      completedAt: attempt.finishedAt,
      reviewAttemptId: attempt.id,
      outcome: resolvedReviewOutcome,
      outcomeClassification: results[0]?.classification || null,
    }));
    reinforcement=buildReinforcementReview({sourceReview,item:results[0],attemptId:attempt.id,finishedAt:attempt.finishedAt,outcome:resolvedReviewOutcome});
    if(reinforcement)updatedReviews=mergeUnique([reinforcement],updatedReviews);
  }

  const next = {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: Date.now(),
    attempts: mergeUnique([attempt], state.attempts, MAX_ATTEMPTS),
    errors: mergeUnique(errors, state.errors),
    marked: mergeUnique(marked, state.marked),
    reviews: updatedReviews.slice(0, MAX_INDEX_ITEMS),
    aiQueue: mergeUnique(aiQueue, state.aiQueue),
  };
  try {
    target.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    try {
      if (before === null) target.removeItem?.(STORAGE_KEY);
      else target.setItem(STORAGE_KEY, before);
    } catch {}
    throw new Error(`Conclusão local revertida: ${error.message}`);
  }
  return Object.freeze({attempt, state: freezeState(next), reinforcement: reinforcement ? Object.freeze(reinforcement) : null});
}

export function clearModuleState(storage) {
  resolveStorage(storage).removeItem?.(STORAGE_KEY);
}

export {STORAGE_KEY};