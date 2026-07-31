import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {clearAttempts, createAttemptRecord, MAX_LOCAL_ATTEMPTS, readAttempts, saveAttempt} from '../assets/integration/attempt-store.js';
import {createSession, evaluateSession, selectAnswer} from '../assets/integration/player-core.js';

class MemoryStorage {
  #items = new Map();
  getItem(key) { return this.#items.has(key) ? this.#items.get(key) : null; }
  setItem(key, value) { this.#items.set(key, String(value)); }
  removeItem(key) { this.#items.delete(key); }
}

const catalog = JSON.parse(await fs.readFile('data/integration/pilot/pe76-catalog.json', 'utf8'));
const key = JSON.parse(await fs.readFile('data/integration/pilot/pe76-key.json', 'utf8'));
const answerMap = new Map(key.answers.map(item => [item.id, item.gabarito]));
const storage = new MemoryStorage();

function completedEvaluation(startedAt, finishedAt = startedAt + 60_000) {
  let session = createSession(catalog, startedAt);
  for (const id of session.questionIds) session = selectAnswer(session, id, answerMap.get(id), startedAt + 1_000);
  return evaluateSession(session, key, finishedAt);
}

const evaluation = completedEvaluation(1_000, 61_000);
const attempt = createAttemptRecord({catalog, evaluation, savedAt: 62_000});
assert.equal(attempt.id, `attempt:${catalog.id}:1000`);
assert.equal(attempt.profileId, 'rodrigo');
assert.equal(attempt.cargoCode, '202');
assert.equal(attempt.peId, 'PE76');
assert.equal(attempt.pilot, true);
assert.equal(attempt.officialProgress, false);
assert.equal(attempt.notionWriteback, false);
assert.equal(attempt.questionResults.length, 10);
assert.equal(attempt.questionResults.every(item => item.classification === 'correct_secure'), true);
assert.deepEqual(attempt.classificationSummary, {correct_secure: 10});

let mixedSession = createSession(catalog, 200_000);
for (const id of mixedSession.questionIds) mixedSession = selectAnswer(mixedSession, id, answerMap.get(id), 201_000);
const [first, second, third, fourth, fifth, sixth] = mixedSession.questionIds;
mixedSession = selectAnswer(mixedSession, first, answerMap.get(first) === 'A' ? 'B' : 'A', 202_000);
const mixedEvaluation = evaluateSession(mixedSession, key, 260_000);
const mixedAttempt = createAttemptRecord({
  catalog,
  evaluation: mixedEvaluation,
  responseMeta: {
    [first]: {marked: true},
    [second]: {confidence: 'doubt'},
    [third]: {confidence: 'guess'},
    [fourth]: {marked: true},
    [fifth]: {issue: 'annulment_pending'},
    [sixth]: {issue: 'source_error'},
  },
  savedAt: 261_000,
});
const mixedById = new Map(mixedAttempt.questionResults.map(item => [item.id, item]));
assert.equal(mixedById.get(first).classification, 'incorrect_confirmed');
assert.equal(mixedById.get(first).errorBookEligible, true);
assert.equal(mixedById.get(first).marked, true);
assert.equal(mixedById.get(second).classification, 'correct_with_doubt');
assert.equal(mixedById.get(third).classification, 'correct_by_guess');
assert.equal(mixedById.get(fourth).classification, 'marked');
assert.equal(mixedById.get(fifth).classification, 'annulment_pending');
assert.equal(mixedById.get(fifth).errorBookEligible, false);
assert.equal(mixedById.get(sixth).classification, 'source_error');
assert.equal(mixedById.get(sixth).errorBookEligible, false);

assert.deepEqual(readAttempts(storage), []);
assert.equal(saveAttempt(attempt, storage).totalStored, 1);
assert.equal(readAttempts(storage).length, 1);
assert.equal(saveAttempt(attempt, storage).totalStored, 1, 'Tentativa duplicada não foi substituída.');

for (let index = 2; index <= 105; index += 1) {
  const next = createAttemptRecord({catalog, evaluation: completedEvaluation(index * 1_000), savedAt: index * 1_000 + 70_000});
  saveAttempt(next, storage);
}
const limited = readAttempts(storage);
assert.equal(limited.length, MAX_LOCAL_ATTEMPTS);
assert.equal(limited[0].startedAt, 105_000);
assert.equal(limited.at(-1).startedAt, 6_000);

const corruptStorage = new MemoryStorage();
corruptStorage.setItem('tdas.202.study.v1.attempts', '{');
assert.throws(() => readAttempts(corruptStorage), /corrompido/);
assert.throws(() => saveAttempt(attempt, corruptStorage), /corrompido/);
assert.equal(corruptStorage.getItem('tdas.202.study.v1.attempts'), '{', 'Histórico corrompido foi sobrescrito silenciosamente.');

clearAttempts(storage);
assert.deepEqual(readAttempts(storage), []);
console.log('Tentativas locais testadas: criação, classificações, deduplicação, limite de 100, ordenação e proteção contra corrupção.');
