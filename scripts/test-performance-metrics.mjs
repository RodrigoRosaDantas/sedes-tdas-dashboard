import assert from 'node:assert/strict';
import {buildPerformanceSnapshot} from '../assets/integration/performance-metrics.js';

const question = (id, assunto, correct, confidence, classification) => ({
  id, assunto, subassunto: `${assunto} ${id}`, correct, confidence, classification,
});
const attempts = [
  {
    id: 'pilot-1', mode: 'pilot', finishedAt: 1_000, percent: 50, correct: 1, total: 2, elapsedMs: 2_000,
    questionResults: [question('q1','Assistência Social',true,'secure','correct_secure'), question('q2','Assistência Social',false,'doubt','incorrect_confirmed')],
  },
  {
    id: 'pilot-2', mode: 'pilot', finishedAt: 2_000, percent: 100, correct: 2, total: 2, elapsedMs: 2_000,
    questionResults: [question('q3','Língua Portuguesa',true,'guess','correct_by_guess'), question('q4','Língua Portuguesa',true,'secure','marked')],
  },
  {
    id: 'review-1', mode: 'review', finishedAt: 3_000, percent: 0, correct: 0, total: 1, elapsedMs: 1_000,
    questionResults: [question('q5','Assistência Social',false,'secure','incorrect_confirmed')],
  },
];
const reviews = [
  {status: 'pending', dueAt: 1_500},
  {status: 'pending', dueAt: 5_000},
  {status: 'completed', dueAt: 1_000},
];
const pe = {peId: 'PE76', pilotAttempts: 2, reviewAttempts: 1, bestPercent: 100};
const snapshot = buildPerformanceSnapshot(attempts, reviews, pe, 2_000);

assert.equal(snapshot.scope, 'local-study');
assert.equal(snapshot.attempts, 3);
assert.equal(snapshot.pilotAttempts, 2);
assert.equal(snapshot.reviewAttempts, 1);
assert.equal(snapshot.legacyAttempts, 0);
assert.equal(snapshot.questions, 5);
assert.equal(snapshot.correct, 3);
assert.equal(snapshot.incorrect, 2);
assert.equal(snapshot.accuracy, 60);
assert.equal(snapshot.elapsedMs, 5_000);
assert.equal(snapshot.averageQuestionMs, 1_000);
assert.equal(snapshot.bestPilotPercent, 100);
assert.equal(snapshot.latestPercent, 0);
assert.equal(snapshot.classifications.incorrect_confirmed, 2);
assert.equal(snapshot.classifications.correct_by_guess, 1);
assert.equal(snapshot.classifications.marked, 1);
assert.deepEqual(snapshot.confidence.secure, {questions: 3, correct: 2, accuracy: 66.67});
assert.deepEqual(snapshot.confidence.doubt, {questions: 1, correct: 0, accuracy: 0});
assert.deepEqual(snapshot.confidence.guess, {questions: 1, correct: 1, accuracy: 100});
assert.deepEqual(snapshot.subjects.map(item => [item.subject, item.questions, item.accuracy]), [
  ['Assistência Social', 3, 33.33],
  ['Língua Portuguesa', 2, 100],
]);
assert.deepEqual(snapshot.reviews, {due: 1, pending: 2, completed: 1});
assert.equal(snapshot.trend.length, 3);
assert.equal(snapshot.trend[0].id, 'pilot-1');
assert.equal(snapshot.trend.at(-1).id, 'review-1');
assert.equal(snapshot.peProgress.peId, 'PE76');

const withLegacy = buildPerformanceSnapshot([...attempts, {
  id: 'legacy-1', mode: 'legacy', finishedAt: 4_000, percent: 100, correct: 1, total: 1, elapsedMs: 500,
  questionResults: [question('q6','Legado',true,'secure','correct_secure')],
}], reviews, pe, 2_000);
assert.equal(withLegacy.legacyAttempts, 1);
assert.equal(withLegacy.attempts, 4);
assert.equal(withLegacy.questions, 6);
assert.equal(withLegacy.trend.at(-1).mode, 'legacy');
assert.equal(withLegacy.bestPilotPercent, 100, 'Histórico legado não pode alterar o melhor piloto.');

const empty = buildPerformanceSnapshot([], [], null, 0);
assert.equal(empty.attempts, 0);
assert.equal(empty.questions, 0);
assert.equal(empty.legacyAttempts, 0);
assert.equal(empty.accuracy, 0);
assert.equal(empty.bestPilotPercent, null);
assert.equal(empty.latestPercent, null);
assert.deepEqual(empty.subjects, []);
assert.throws(() => buildPerformanceSnapshot(null), /Tentativas inválidas/);
assert.throws(() => buildPerformanceSnapshot([{mode: 'invalid', questionResults: []}]), /incompatível/);

console.log('Desempenho testado: piloto/revisão/legado, confiança, assuntos, tempo, tendência, agenda e cenário vazio.');
