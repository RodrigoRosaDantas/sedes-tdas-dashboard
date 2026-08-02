import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {canFinish, createSession, evaluateSession, formatElapsed, moveToQuestion, selectAnswer, sessionProgress} from '../assets/integration/player-core.js';

const catalog = JSON.parse(await fs.readFile('data/integration/pilot/pe76-catalog.json', 'utf8'));
const key = JSON.parse(await fs.readFile('data/integration/pilot/pe76-key.json', 'utf8'));
const answers = new Map(key.answers.map(item => [item.id, item.gabarito]));

let session = createSession(catalog, 1_000);
assert.deepEqual(sessionProgress(session), {answered: 0, total: 10, remaining: 10, percent: 0});
assert.equal(canFinish(session), false);

const initial = session;
for (const questionId of session.questionIds) session = selectAnswer(session, questionId, answers.get(questionId), 2_000);
assert.notEqual(session, initial);
assert.equal(Object.keys(initial.answers).length, 0, 'A sessão original foi mutada.');
assert.deepEqual(sessionProgress(session), {answered: 10, total: 10, remaining: 0, percent: 100});
assert.equal(canFinish(session), true);

const perfect = evaluateSession(session, key, 61_000);
assert.equal(perfect.correct, 10);
assert.equal(perfect.incorrect, 0);
assert.equal(perfect.percent, 100);
assert.equal(perfect.elapsedMs, 60_000);
assert.equal(formatElapsed(perfect.elapsedMs), '01:00');

let oneWrong = createSession(catalog, 10_000);
for (const questionId of oneWrong.questionIds) oneWrong = selectAnswer(oneWrong, questionId, answers.get(questionId), 11_000);
const firstId = oneWrong.questionIds[0];
oneWrong = selectAnswer(oneWrong, firstId, answers.get(firstId) === 'A' ? 'B' : 'A', 12_000);
const evaluatedWrong = evaluateSession(oneWrong, key, 70_000);
assert.equal(evaluatedWrong.correct, 9);
assert.equal(evaluatedWrong.incorrect, 1);
assert.equal(evaluatedWrong.percent, 90);

const incomplete = selectAnswer(createSession(catalog, 1_000), catalog.questoes[0].id, 'A', 2_000);
assert.throws(() => evaluateSession(incomplete, key, 3_000), /Todas as questões/);
assert.throws(() => selectAnswer(incomplete, 'inexistente', 'A'), /Questão ausente/);
assert.throws(() => selectAnswer(incomplete, catalog.questoes[0].id, 'F'), /Alternativa inválida/);
assert.throws(() => moveToQuestion(incomplete, 10), /Índice de questão inválido/);
assert.equal(moveToQuestion(incomplete, 9, 4_000).currentIndex, 9);
assert.equal(formatElapsed(3_661_000), '01:01:01');

console.log('Player piloto testado: sessão imutável, progresso, navegação, 10/10, 9/10 e bloqueio de tentativa incompleta.');
