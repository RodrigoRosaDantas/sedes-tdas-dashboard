import {REVIEW_STAGES} from './contracts.js?v=1.0.0';

export const REVIEW_STAGE_OFFSETS = Object.freeze({'D0': 0, 'D+1': 1, 'D+7': 7, 'D+20': 20});
export const REVIEW_ELIGIBLE_CLASSIFICATIONS = Object.freeze([
  'incorrect_confirmed',
  'correct_with_doubt',
  'correct_by_guess',
  'marked',
]);

const DAY_MS = 86_400_000;

export function isReviewEligible(question) {
  return Boolean(question && REVIEW_ELIGIBLE_CLASSIFICATIONS.includes(question.classification));
}

export function buildReviewSchedule(attempt, {includeD0 = false} = {}) {
  if (!attempt || !attempt.id || !Array.isArray(attempt.questionResults)) throw new TypeError('Tentativa inválida para revisão.');
  const stages = includeD0 ? ['D0', ...REVIEW_STAGES] : [...REVIEW_STAGES];
  const reviews = [];
  for (const question of attempt.questionResults.filter(isReviewEligible)) {
    for (const stage of stages) {
      const offset = REVIEW_STAGE_OFFSETS[stage];
      if (!Number.isInteger(offset)) throw new TypeError(`Etapa de revisão inválida: ${stage}.`);
      reviews.push(Object.freeze({
        schemaVersion: '1.0.0',
        id: `review:${attempt.id}:${question.id}:${stage}`,
        sourceAttemptId: attempt.id,
        materialId: attempt.materialId,
        peId: attempt.peId,
        profileId: attempt.profileId,
        cargoCode: attempt.cargoCode,
        pilot: true,
        officialProgress: false,
        notionWriteback: false,
        questionId: question.id,
        numeroOriginal: question.numeroOriginal,
        assunto: question.assunto,
        subassunto: question.subassunto,
        sourceClassification: question.classification,
        stage,
        dueAt: attempt.finishedAt + offset * DAY_MS,
        status: 'pending',
        completedAt: null,
        reviewAttemptId: null,
        outcome: null,
      }));
    }
  }
  return Object.freeze(reviews.sort((a, b) => a.dueAt - b.dueAt || a.numeroOriginal - b.numeroOriginal));
}
