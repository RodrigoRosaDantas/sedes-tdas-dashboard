import assert from 'node:assert/strict';
import {clearReviews, completeReview, getReviewById, readDueReviews, readReviews, scheduleAttemptReviews} from '../assets/integration/review-store.js';

class MemoryStorage {
  #items = new Map();
  getItem(key) { return this.#items.has(key) ? this.#items.get(key) : null; }
  setItem(key, value) { this.#items.set(key, String(value)); }
  removeItem(key) { this.#items.delete(key); }
}

const storage = new MemoryStorage();
const finishedAt = Date.UTC(2026, 6, 31, 12, 0, 0);
const attempt = {
  id: 'attempt:pilot:material:1000', materialId: 'material', peId: 'PE76', profileId: 'rodrigo', cargoCode: '202', finishedAt,
  questionResults: [
    {id: 'q1', numeroOriginal: 1, assunto: 'A', subassunto: 'A1', classification: 'incorrect_confirmed'},
    {id: 'q2', numeroOriginal: 2, assunto: 'B', subassunto: 'B1', classification: 'correct_with_doubt'},
    {id: 'q3', numeroOriginal: 3, assunto: 'C', subassunto: 'C1', classification: 'correct_secure'},
  ],
};

assert.deepEqual(readReviews(storage), []);
const scheduled = scheduleAttemptReviews(attempt, storage);
assert.deepEqual(scheduled, {added: 6, total: 6, stages: ['D+1', 'D+7', 'D+20']});
assert.equal(readReviews(storage).length, 6);
assert.equal(scheduleAttemptReviews(attempt, storage).total, 6, 'Revisões duplicadas foram criadas.');

assert.equal(readDueReviews(finishedAt, storage).length, 0);
assert.equal(readDueReviews(finishedAt + 86_400_000, storage).length, 2);
assert.equal(readDueReviews(finishedAt + 7 * 86_400_000, storage).length, 4);
assert.equal(readDueReviews(finishedAt + 20 * 86_400_000, storage).length, 6);

const target = readReviews(storage).find(review => review.questionId === 'q1' && review.stage === 'D+1');
assert.equal(getReviewById(target.id, storage).status, 'pending');
const completed = completeReview(target.id, {reviewAttemptId: 'attempt:review:material:2000', outcome: 'correct_secure', completedAt: finishedAt + 90_000_000}, storage);
assert.equal(completed.status, 'completed');
assert.equal(completed.reviewAttemptId, 'attempt:review:material:2000');
assert.equal(completed.outcome, 'correct_secure');
assert.equal(readDueReviews(finishedAt + 20 * 86_400_000, storage).length, 5);
assert.throws(() => completeReview('missing', {reviewAttemptId: 'x', outcome: 'correct_secure'}, storage), /não encontrada/);
assert.throws(() => completeReview(target.id, {}, storage), /incompleto/);

const withD0Storage = new MemoryStorage();
assert.deepEqual(scheduleAttemptReviews(attempt, withD0Storage, {includeD0: true}).stages, ['D0', 'D+1', 'D+7', 'D+20']);
assert.equal(readDueReviews(finishedAt, withD0Storage).length, 2);

const corrupt = new MemoryStorage();
corrupt.setItem('tdas.202.study.v1.reviews', '{');
assert.throws(() => readReviews(corrupt), /corrompida/);
assert.throws(() => scheduleAttemptReviews(attempt, corrupt), /corrompida/);
assert.equal(corrupt.getItem('tdas.202.study.v1.reviews'), '{');

clearReviews(storage);
assert.deepEqual(readReviews(storage), []);
console.log('Agenda local testada: criação, deduplicação, vencimento, D0 opt-in, conclusão e corrupção protegida.');
