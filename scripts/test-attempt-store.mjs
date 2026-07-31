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
console.log('Tentativas locais testadas: criação, isolamento, deduplicação, limite de 100, ordenação e proteção contra corrupção.');
