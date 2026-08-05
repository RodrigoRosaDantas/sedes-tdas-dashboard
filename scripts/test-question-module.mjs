import assert from 'node:assert/strict';
import {createSession, evaluateSession, selectAnswer} from '../assets/integration/player-core.js';
import {readModuleState, saveCompletedAttempt, STORAGE_KEY} from '../assets/integration/module-store.js';
import {REVIEW_OUTCOMES} from '../assets/integration/review-engine.js';

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

const wrongSource=saved.state.reviews.find(item=>item.questionId==='q2'&&item.stage==='D+1');
const wrongCatalog={...catalog,catalogId:`${catalog.catalogId}:review:${wrongSource.id}`,questions:[catalog.questions[1]]};
let wrongSession=createSession({id:wrongCatalog.catalogId,questoes:wrongCatalog.questions},100_000);
wrongSession=selectAnswer(wrongSession,'q2','C',101_000);
const wrongEvaluation=evaluateSession(wrongSession,{material_id:wrongCatalog.catalogId,answers:[{id:'q2',gabarito:'B'}]},110_000);
const wrongSaved=saveCompletedAttempt({catalog:wrongCatalog,evaluation:wrongEvaluation,mode:'review',reviewId:wrongSource.id,reviewOutcome:REVIEW_OUTCOMES.WRONG_AGAIN},storage);
assert.equal(wrongSaved.attempt.reviewOutcome,REVIEW_OUTCOMES.WRONG_AGAIN);
assert.equal(wrongSaved.state.errors.length,2);
assert.equal(wrongSaved.state.reviews.length,7);
assert.equal(wrongSaved.state.reviews.find(item=>item.id===wrongSource.id).status,'completed');
assert.equal(wrongSaved.reinforcement.stage,'Reforço 24h');
assert.equal(wrongSaved.reinforcement.recurrenceCount,1);
assert.equal(wrongSaved.reinforcement.originReviewId,wrongSource.id);

const masteredSource=wrongSaved.state.reviews.find(item=>item.questionId==='q1'&&item.stage==='D+1'&&item.status==='pending');
const masteredCatalog={...catalog,catalogId:`${catalog.catalogId}:review:${masteredSource.id}`,questions:[catalog.questions[0]]};
let masteredSession=createSession({id:masteredCatalog.catalogId,questoes:masteredCatalog.questions},200_000);
masteredSession=selectAnswer(masteredSession,'q1','A',201_000);
const masteredEvaluation=evaluateSession(masteredSession,{material_id:masteredCatalog.catalogId,answers:[{id:'q1',gabarito:'A'}]},210_000);
const masteredSaved=saveCompletedAttempt({catalog:masteredCatalog,evaluation:masteredEvaluation,mode:'review',reviewId:masteredSource.id,reviewOutcome:REVIEW_OUTCOMES.MASTERED},storage);
assert.equal(masteredSaved.attempt.reviewOutcome,REVIEW_OUTCOMES.MASTERED);
assert.equal(masteredSaved.reinforcement,null);
assert.equal(masteredSaved.state.reviews.length,7);
assert.equal(masteredSaved.state.reviews.find(item=>item.id===masteredSource.id).outcome,REVIEW_OUTCOMES.MASTERED);

const restored = readModuleState(storage);
assert.equal(restored.attempts.length,3);
assert.equal(restored.attempts[0].mode,'review');
assert.equal(restored.attempts[0].reviewOutcome,REVIEW_OUTCOMES.MASTERED);
assert.equal(restored.errors[0].questionResults, undefined);
console.log('Módulo testado: estudo, correção separada, decisão pedagógica, reforço adaptativo e persistência local sem writeback.');
