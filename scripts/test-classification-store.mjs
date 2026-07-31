import assert from 'node:assert/strict';
import {clearClassificationIndexes, readErrors, readMarked, syncAttemptIndexes} from '../assets/integration/classification-store.js';

class MemoryStorage {
  #items = new Map();
  getItem(key) { return this.#items.has(key) ? this.#items.get(key) : null; }
  setItem(key, value) { this.#items.set(key, String(value)); }
  removeItem(key) { this.#items.delete(key); }
}

const storage = new MemoryStorage();
const base = {
  attemptId: 'attempt:pilot:1000', materialId: 'pilot-pe76-2026-tdas', peId: 'PE76', profileId: 'rodrigo', cargoCode: '202', pilot: true,
  correctAnswer: 'A', confidence: 'secure', issue: 'none', createdAt: 10_000,
};
const question = (id, classification, extra = {}) => ({
  id, numeroOriginal: Number(id), assunto: 'Teste', subassunto: `Questão ${id}`, selected: 'B', correct: false,
  classification, errorBookEligible: classification === 'incorrect_confirmed', marked: false, ...extra,
});
const attempt = {
  id: base.attemptId,
  materialId: base.materialId,
  peId: base.peId,
  profileId: base.profileId,
  cargoCode: base.cargoCode,
  pilot: true,
  finishedAt: base.createdAt,
  questionResults: [
    question('1', 'incorrect_confirmed'),
    question('2', 'annulment_pending', {issue: 'annulment_pending'}),
    question('3', 'source_error', {issue: 'source_error'}),
    question('4', 'marked', {correct: true, selected: 'A', marked: true}),
    question('5', 'incorrect_confirmed', {marked: true}),
    question('6', 'correct_with_doubt', {correct: true, selected: 'A', confidence: 'doubt'}),
  ],
};

const first = syncAttemptIndexes(attempt, storage);
assert.deepEqual(first, {errorsAdded: 2, markedAdded: 2, totalErrors: 2, totalMarked: 2});
assert.deepEqual(readErrors(storage).map(item => item.questionId), ['1', '5']);
assert.deepEqual(readMarked(storage).map(item => item.questionId), ['4', '5']);
assert.equal(readErrors(storage).some(item => ['annulment_pending', 'source_error'].includes(item.classification)), false);

const second = syncAttemptIndexes(attempt, storage);
assert.equal(second.totalErrors, 2);
assert.equal(second.totalMarked, 2);

const corrupt = new MemoryStorage();
corrupt.setItem('tdas.202.study.v1.errors', '{');
assert.throws(() => readErrors(corrupt), /corrompido/);
assert.throws(() => syncAttemptIndexes(attempt, corrupt), /corrompido/);
assert.equal(corrupt.getItem('tdas.202.study.v1.errors'), '{');

clearClassificationIndexes(storage);
assert.deepEqual(readErrors(storage), []);
assert.deepEqual(readMarked(storage), []);
console.log('Índices de classificação testados: só erros confirmados, marcações independentes, deduplicação e corrupção protegida.');
