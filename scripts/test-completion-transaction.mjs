import assert from 'node:assert/strict';
import {commitCompletedAttempt, transactionKeys} from '../assets/integration/completion-transaction.js';
import {readAttempts} from '../assets/integration/attempt-store.js';
import {readErrors} from '../assets/integration/classification-store.js';
import {readPeProgress} from '../assets/integration/pe-progress-store.js';
import {readReviews} from '../assets/integration/review-store.js';

class MemoryStorage {
  constructor({failOnceOnKey = null} = {}) { this.items = new Map(); this.failOnceOnKey = failOnceOnKey; this.failed = false; }
  getItem(key) { return this.items.has(key) ? this.items.get(key) : null; }
  setItem(key, value) {
    if (key === this.failOnceOnKey && !this.failed) { this.failed = true; throw new Error(`Falha simulada em ${key}`); }
    this.items.set(key, String(value));
  }
  removeItem(key) { this.items.delete(key); }
}

const question = (id, classification, correct = classification !== 'incorrect_confirmed') => ({
  id, numeroOriginal: Number(id.replace(/\D/g, '')) || 1, assunto: 'Teste', subassunto: `Item ${id}`,
  selected: correct ? 'A' : 'B', correctAnswer: 'A', correct, confidence: 'secure', marked: false, issue: 'none',
  classification, errorBookEligible: classification === 'incorrect_confirmed',
});
const pilotAttempt = {
  schemaVersion: '1.2.0', id: 'attempt:pilot:material:1000', profileId: 'rodrigo', cargoCode: '202', mode: 'pilot', sourceReviewId: null,
  pilot: true, officialProgress: false, notionWriteback: false, materialId: 'material', peId: 'PE76', startedAt: 1_000, finishedAt: 61_000, savedAt: 62_000,
  correct: 1, incorrect: 1, total: 2, percent: 50, elapsedMs: 60_000, classificationSummary: {incorrect_confirmed: 1, correct_secure: 1},
  questionResults: [question('q1', 'incorrect_confirmed', false), question('q2', 'correct_secure', true)],
};

const storage = new MemoryStorage();
const committed = commitCompletedAttempt(pilotAttempt, {storage});
assert.equal(committed.committed, true);
assert.equal(committed.savedAttempt.totalStored, 1);
assert.equal(committed.indexes.totalErrors, 1);
assert.equal(committed.reviews.added, 3);
assert.equal(committed.peProgress.pilotAttempts, 1);
assert.equal(readAttempts(storage).length, 1);
assert.equal(readErrors(storage).length, 1);
assert.equal(readReviews(storage).length, 3);
assert.equal(readPeProgress('PE76', storage).pilotAttempts, 1);

const reviewSource = readReviews(storage).find(item => item.questionId === 'q1' && item.stage === 'D+1');
const reviewAttempt = {
  schemaVersion: '1.2.0', id: 'attempt:review:material:2000', profileId: 'rodrigo', cargoCode: '202', mode: 'review', sourceReviewId: reviewSource.id,
  pilot: true, officialProgress: false, notionWriteback: false, materialId: 'material', peId: 'PE76', startedAt: 2_000, finishedAt: 3_000, savedAt: 4_000,
  correct: 1, incorrect: 0, total: 1, percent: 100, elapsedMs: 1_000, classificationSummary: {correct_secure: 1}, questionResults: [question('q1', 'correct_secure', true)],
};
const reviewCommitted = commitCompletedAttempt(reviewAttempt, {storage});
assert.equal(reviewCommitted.reviews.status, 'completed');
assert.equal(reviewCommitted.reviews.reviewAttemptId, reviewAttempt.id);
assert.equal(readReviews(storage).length, 3, 'Revisão criou agenda recursiva.');
assert.equal(readPeProgress('PE76', storage).reviewAttempts, 1);
assert.equal(readAttempts(storage).length, 2);

const failing = new MemoryStorage({failOnceOnKey: 'tdas.202.study.v1.peProgress'});
assert.throws(() => commitCompletedAttempt(pilotAttempt, {storage: failing}), error => error.rolledBack === true && /revertida/.test(error.message));
for (const key of transactionKeys()) assert.equal(failing.getItem(key), null, `Rollback não restaurou ${key}.`);

assert.deepEqual(transactionKeys(), [
  'tdas.202.study.v1.attempts',
  'tdas.202.study.v1.errors',
  'tdas.202.study.v1.marked',
  'tdas.202.study.v1.reviews',
  'tdas.202.study.v1.peProgress',
]);
console.log('Transação testada: commit integral, revisão sem recursão e rollback total após falha simulada no progresso do PE.');
