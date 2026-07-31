import {isErrorBookEligible, isKnownResponseClassification} from './contracts.js?v=1.0.0';

export const CONFIDENCE_LEVELS = Object.freeze(['secure', 'doubt', 'guess']);
export const ISSUE_FLAGS = Object.freeze(['none', 'annulment_pending', 'source_error']);

export function normalizeResponseMeta(meta = {}) {
  const confidence = CONFIDENCE_LEVELS.includes(meta.confidence) ? meta.confidence : 'secure';
  const issue = ISSUE_FLAGS.includes(meta.issue) ? meta.issue : 'none';
  return Object.freeze({confidence, issue, marked: meta.marked === true});
}

export function classifyQuestionResult(result, meta = {}) {
  if (!result || typeof result !== 'object' || typeof result.correct !== 'boolean') {
    throw new TypeError('Resultado individual inválido.');
  }
  if (!String(result.selected || '').trim()) throw new TypeError('Resposta em branco não pode ser classificada.');
  const normalized = normalizeResponseMeta(meta);
  let classification;
  if (normalized.issue === 'source_error') classification = 'source_error';
  else if (normalized.issue === 'annulment_pending') classification = 'annulment_pending';
  else if (!result.correct) classification = 'incorrect_confirmed';
  else if (normalized.marked) classification = 'marked';
  else if (normalized.confidence === 'guess') classification = 'correct_by_guess';
  else if (normalized.confidence === 'doubt') classification = 'correct_with_doubt';
  else classification = 'correct_secure';
  if (!isKnownResponseClassification(classification)) throw new TypeError(`Classificação desconhecida: ${classification}.`);
  return Object.freeze({
    ...normalized,
    classification,
    errorBookEligible: isErrorBookEligible(classification),
  });
}

export function classifyEvaluation(evaluation, responseMeta = {}) {
  if (!evaluation || !Array.isArray(evaluation.results)) throw new TypeError('Avaliação inválida.');
  return Object.freeze(evaluation.results.map(result => Object.freeze({
    id: result.id,
    ...classifyQuestionResult(result, responseMeta[result.id]),
  })));
}
