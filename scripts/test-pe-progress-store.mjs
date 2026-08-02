import assert from 'node:assert/strict';
import {clearPeProgress, readAllPeProgress, readPeProgress, recordAttemptPeProgress} from '../assets/integration/pe-progress-store.js';

class MemoryStorage {
  #items = new Map();
  getItem(key) { return this.#items.has(key) ? this.#items.get(key) : null; }
  setItem(key, value) { this.#items.set(key, String(value)); }
  removeItem(key) { this.#items.delete(key); }
}

const storage = new MemoryStorage();
const attempt = (id, mode, finishedAt, percent, correct, total = 10, extra = {}) => ({
  id, mode, sourceReviewId: mode === 'review' ? `review:${id}` : null, peId: 'PE76', pilot: true, officialProgress: false, notionWriteback: false,
  finishedAt, percent, correct, incorrect: total - correct, total, ...extra,
});

assert.equal(readPeProgress('PE76', storage), null);
const first = recordAttemptPeProgress(attempt('a1', 'pilot', 1_000, 80, 8), storage);
assert.equal(first.pilotAttempts, 1);
assert.equal(first.reviewAttempts, 0);
assert.equal(first.bestPercent, 80);
assert.equal(first.latestPercent, 80);
assert.equal(first.totalQuestionsAnswered, 10);
assert.equal(first.officialCompleted, false);
assert.equal(first.officialStatus, 'not_modified');
assert.equal(first.notionWriteback, false);

const duplicate = recordAttemptPeProgress(attempt('a1', 'pilot', 1_000, 80, 8), storage);
assert.equal(duplicate.pilotAttempts, 1);
assert.equal(duplicate.totalQuestionsAnswered, 10);

const second = recordAttemptPeProgress(attempt('a2', 'pilot', 2_000, 90, 9), storage);
assert.equal(second.pilotAttempts, 2);
assert.equal(second.bestPercent, 90);
assert.equal(second.latestPercent, 90);
assert.equal(second.totalCorrect, 17);

const review = recordAttemptPeProgress(attempt('r1', 'review', 3_000, 100, 1, 1), storage);
assert.equal(review.pilotAttempts, 2);
assert.equal(review.reviewAttempts, 1);
assert.equal(review.totalQuestionsAnswered, 21);
assert.equal(review.latestAttemptId, 'r1');
assert.deepEqual(Object.keys(readAllPeProgress(storage)), ['PE76']);

assert.throws(() => recordAttemptPeProgress(attempt('x', 'pilot', 4_000, 50, 1, 2, {peId: 'PE113'}), storage), /inválida/);
assert.throws(() => recordAttemptPeProgress(attempt('x', 'pilot', 4_000, 50, 1, 2, {officialProgress: true}), storage), /fora do escopo/);

const corrupt = new MemoryStorage();
corrupt.setItem('tdas.202.study.v1.peProgress', '{');
assert.throws(() => readPeProgress('PE76', corrupt), /corrompido/);
assert.throws(() => recordAttemptPeProgress(attempt('a1', 'pilot', 1_000, 80, 8), corrupt), /corrompido/);
assert.equal(corrupt.getItem('tdas.202.study.v1.peProgress'), '{');

clearPeProgress(storage);
assert.equal(readPeProgress('PE76', storage), null);
console.log('Progresso local do PE testado: piloto, revisão, deduplicação, melhores resultados, PE113 rejeitado e corrupção protegida.');
