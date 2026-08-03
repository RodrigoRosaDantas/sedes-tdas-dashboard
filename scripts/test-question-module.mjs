import assert from 'node:assert/strict';
import {createSession, evaluateSession, selectAnswer} from '../assets/integration/player-core.js';
import {readModuleState, saveCompletedAttempt, STORAGE_KEY} from '../assets/integration/module-store.js';

class MemoryStorage {
  constructor() { this.items = new Map(); }
  getItem(key) { return this.items.has(key) ? this.items.get(key) : null; }
  setItem(key, value) { this.items.set(key, String(value)); }
  removeItem(key) { this.items.delete(key); }
}
const catalog = {
  catalogId: 'authorized-test-catalog',
  peId: 'PE88',
  questions: [
    {id: 'q1', numero_original: 1, assunto: 'Teste', subassunto: 'A', enunciado: 'Q1', alternativas: {A:'a',B:'b',C:'c',D:'d',E:'e'}},
    {id: 'q2', numero_original: 2, assunto: 'Teste', subassunto: 'B', enunciado: 'Q2', alternativas: {A:'a',B:'b',C:'c',D:'d',E:'e'}},
  ],
};
const key = {material_id: catalog.catalogId, answers: [{id:'q1',gabarito:'A'},{id:'q2',gabarito:'B'}]};
let session = createSession({id: catalog.catalogId, questoes: catalog.questions}, 1_000);
session = selectAnswer(session, 'q1', 'A', 2_000);
session = selectAnswer(session, 'q2', 'C', 3_000);
const evaluation = evaluateSession(session, key, 61_000);
const storage = new MemoryStorage();
const saved = saveCompletedAttempt({catalog, evaluation, responseMeta: {q1:{confidence:'doubt'}, q2:{marked:true}}}, storage);
assert.equal(saved.attempt.mode, 'study');
assert.equal(saved.attempt.peId, 'PE88');
assert.equal(saved.attempt.localOnly, true);
assert.equal(saved.attempt.notionWriteback, false);
assert.equal(saved.state.attempts.length, 1);
assert.equal(saved.state.errors.length, 1);
assert.equal(saved.state.marked.length, 1);
assert.equal(saved.state.reviews.length, 6);
assert.equal(saved.state.aiQueue.length, 0);
assert.ok(storage.getItem(STORAGE_KEY));
const restored = readModuleState(storage);
assert.equal(restored.attempts[0].catalogId, 'authorized-test-catalog');
assert.equal(restored.errors[0].questionResults, undefined);
console.log('Módulo testado com catálogo sintético: correção, tentativa, erro, marcação e revisões, sem conteúdo de exemplo.');
