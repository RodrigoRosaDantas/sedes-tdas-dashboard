import {isKnownResponseClassification, isValidPeId, STORAGE_KEYS} from './contracts.js?v=1.0.0';
import {classifyQuestionResult} from './response-classification.js?v=1.0.0';

export const ATTEMPT_SCHEMA_VERSION = '1.2.0';
export const ATTEMPT_ENVELOPE_VERSION = '1.0.0';
export const MAX_LOCAL_ATTEMPTS = 100;
export const ATTEMPT_MODES = Object.freeze(['pilot', 'review', 'legacy']);
const INTERACTIVE_ATTEMPT_MODES = Object.freeze(['pilot', 'review']);
const CORRECT_CLASSIFICATIONS = Object.freeze(['correct_secure', 'correct_with_doubt', 'correct_by_guess', 'marked']);

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
  if (!attempt.id || !attempt.materialId || !isValidPeId(attempt.peId)) throw new TypeError('Identificação da tentativa incompleta ou inválida.');
  if (!ATTEMPT_MODES.includes(attempt.mode)) throw new TypeError('Modo da tentativa inválido.');
  if (attempt.mode === 'review' && !attempt.sourceReviewId) throw new TypeError('Tentativa de revisão sem item de origem.');
  if (attempt.mode !== 'review' && attempt.sourceReviewId !== null) throw new TypeError('Tentativa sem revisão não pode referenciar item de origem.');
  if (attempt.profileId !== 'rodrigo' || attempt.cargoCode !== '202') throw new TypeError('Perfil ou cargo incompatível.');
  if (attempt.officialProgress !== false || attempt.notionWriteback !== false) throw new TypeError('Tentativa fora do isolamento local.');
  if (attempt.mode === 'legacy') {
    if (attempt.pilot !== false || attempt.sourceSystem !== 'sedes-df-questoes') throw new TypeError('Tentativa legada sem procedência válida.');
  } else if (attempt.pilot !== true) {
    throw new TypeError('Tentativa do módulo deve permanecer piloto.');
  }
  if (!Array.isArray(attempt.questionResults) || attempt.questionResults.length !== attempt.total) {
    throw new TypeError('Resultados individuais da tentativa inválidos.');
  }
  if (!Number.isInteger(attempt.total) || attempt.total < 1 || !Number.isInteger(attempt.correct) || !Number.isInteger(attempt.incorrect)
    || attempt.correct < 0 || attempt.incorrect < 0 || attempt.correct + attempt.incorrect !== attempt.total) {
    throw new TypeError('Totais da tentativa inválidos.');
  }
  if (![attempt.startedAt, attempt.finishedAt, attempt.savedAt, attempt.elapsedMs, attempt.percent].every(Number.isFinite)
    || attempt.finishedAt < attempt.startedAt || attempt.elapsedMs < 0 || attempt.percent < 0 || attempt.percent > 100) {
    throw new TypeError('Tempos ou percentual da tentativa inválidos.');
  }
  const questionIds = new Set();
  for (const question of attempt.questionResults) {
    if (!question?.id || questionIds.has(question.id)) throw new TypeError('Questão ausente ou duplicada na tentativa.');
    questionIds.add(question.id);
    if (!String(question.selected ?? '').trim()) throw new TypeError(`Resposta em branco em ${question.id}.`);
    if (typeof question.correct !== 'boolean') throw new TypeError(`Resultado objetivo inválido em ${question.id}.`);
    if (!isKnownResponseClassification(question.classification)) throw new TypeError(`Classificação inválida em ${question.id}.`);
    if (question.errorBookEligible !== (question.classification === 'incorrect_confirmed')) {
      throw new TypeError(`Elegibilidade inconsistente em ${question.id}.`);
    }
    if (question.classification === 'incorrect_confirmed' && question.correct !== false) {
      throw new TypeError(`Erro confirmado incompatível com o resultado em ${question.id}.`);
    }
    if (CORRECT_CLASSIFICATIONS.includes(question.classification) && question.correct !== true) {
      throw new TypeError(`Classificação de acerto incompatível com o resultado em ${question.id}.`);
    }
    if (question.classification === 'annulment_pending' && question.issue !== 'annulment_pending') {
      throw new TypeError(`Possível anulação sem ressalva correspondente em ${question.id}.`);
    }
    if (question.classification === 'source_error' && question.issue !== 'source_error') {
      throw new TypeError(`Erro da fonte sem ressalva correspondente em ${question.id}.`);
    }
    if (question.classification === 'marked' && question.marked !== true) {
      throw new TypeError(`Classificação de marcação inconsistente em ${question.id}.`);
    }
  }
  if (attempt.questionResults.filter(question => question.correct).length !== attempt.correct) throw new TypeError('Total de acertos divergente.');
  const expectedPercent = attempt.correct / attempt.total * 100;
  if (Math.abs(attempt.percent - expectedPercent) > 1e-9) throw new TypeError('Percentual da tentativa divergente.');
  return attempt;
}

export function createAttemptRecord({catalog, evaluation, responseMeta = {}, mode = 'pilot', sourceReviewId = null, savedAt = Date.now()}) {
  if (!catalog || catalog.id !== evaluation?.session?.materialId) throw new TypeError('Catálogo e avaliação incompatíveis.');
  if (!INTERACTIVE_ATTEMPT_MODES.includes(mode)) throw new TypeError('Modo interativo da tentativa inválido.');
  if (mode === 'review' && !sourceReviewId) throw new TypeError('Revisão de origem obrigatória.');
  const questions = new Map(catalog.questoes.map(question => [question.id, question]));
  const questionResults = evaluation.results.map(result => {
    const question = questions.get(result.id);
    if (!question) throw new TypeError(`Questão ausente do catálogo: ${result.id}.`);
    const classification = classifyQuestionResult(result, responseMeta[result.id]);
    return Object.freeze({
      id: result.id,
      numeroOriginal: question.numero_original,
      assunto: question.assunto,
      subassunto: question.subassunto,
      selected: result.selected,
      correctAnswer: result.correctAnswer,
      correct: result.correct,
      confidence: classification.confidence,
      marked: classification.marked,
      issue: classification.issue,
      classification: classification.classification,
      errorBookEligible: classification.errorBookEligible,
    });
  });
  const classificationSummary = questionResults.reduce((summary, question) => {
    summary[question.classification] = (summary[question.classification] || 0) + 1;
    return summary;
  }, {});
  const record = Object.freeze({
    schemaVersion: ATTEMPT_SCHEMA_VERSION,
    id: `attempt:${mode}:${catalog.id}:${evaluation.session.startedAt}`,
    profileId: 'rodrigo',
    cargoCode: '202',
    mode,
    sourceReviewId: mode === 'review' ? String(sourceReviewId) : null,
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
    classificationSummary: Object.freeze(classificationSummary),
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
