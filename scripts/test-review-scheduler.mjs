import assert from 'node:assert/strict';
import {buildReviewSchedule, isReviewEligible, REVIEW_STAGE_OFFSETS} from '../assets/integration/review-scheduler.js';

const finishedAt = Date.UTC(2026, 6, 31, 12, 0, 0);
const base = {numeroOriginal: 1, assunto: 'Teste', subassunto: 'Item'};
const question = (id, classification) => ({id, classification, ...base, numeroOriginal: Number(id)});
const attempt = {
  id: 'attempt:pilot:material:1000', materialId: 'material', peId: 'PE76', profileId: 'rodrigo', cargoCode: '202', finishedAt,
  questionResults: [
    question('1', 'incorrect_confirmed'),
    question('2', 'correct_with_doubt'),
    question('3', 'correct_by_guess'),
    question('4', 'marked'),
    question('5', 'correct_secure'),
    question('6', 'annulment_pending'),
    question('7', 'source_error'),
  ],
};

assert.equal(isReviewEligible(question('1', 'incorrect_confirmed')), true);
assert.equal(isReviewEligible(question('5', 'correct_secure')), false);
assert.equal(isReviewEligible(question('6', 'annulment_pending')), false);

const standard = buildReviewSchedule(attempt);
assert.equal(standard.length, 12);
assert.deepEqual([...new Set(standard.map(item => item.stage))], ['D+1', 'D+7', 'D+20']);
assert.equal(standard.some(item => item.stage === 'D0'), false);
for (const review of standard) {
  assert.equal(review.dueAt, finishedAt + REVIEW_STAGE_OFFSETS[review.stage] * 86_400_000);
  assert.equal(review.status, 'pending');
  assert.equal(review.pilot, true);
  assert.equal(review.officialProgress, false);
  assert.equal(review.notionWriteback, false);
}
assert.deepEqual([...new Set(standard.map(item => item.questionId))], ['1', '2', '3', '4']);

const withD0 = buildReviewSchedule(attempt, {includeD0: true});
assert.equal(withD0.length, 16);
assert.equal(withD0.filter(item => item.stage === 'D0').length, 4);
assert.equal(withD0.find(item => item.stage === 'D0').dueAt, finishedAt);
assert.equal(new Set(withD0.map(item => item.id)).size, 16);
assert.throws(() => buildReviewSchedule(null), /Tentativa inválida/);

console.log('Agenda de revisão testada: 4 itens elegíveis, 12 revisões padrão, 16 com D0 e datas exatas.');
