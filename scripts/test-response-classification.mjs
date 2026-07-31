import assert from 'node:assert/strict';
import {classifyQuestionResult, normalizeResponseMeta} from '../assets/integration/response-classification.js';

const correct = {selected: 'A', correct: true};
const incorrect = {selected: 'B', correct: false};

assert.deepEqual(normalizeResponseMeta(), {confidence: 'secure', issue: 'none', marked: false});
assert.equal(classifyQuestionResult(correct).classification, 'correct_secure');
assert.equal(classifyQuestionResult(correct, {confidence: 'doubt'}).classification, 'correct_with_doubt');
assert.equal(classifyQuestionResult(correct, {confidence: 'guess'}).classification, 'correct_by_guess');
assert.equal(classifyQuestionResult(correct, {marked: true}).classification, 'marked');

const definitive = classifyQuestionResult(incorrect, {confidence: 'doubt'});
assert.equal(definitive.classification, 'incorrect_confirmed');
assert.equal(definitive.errorBookEligible, true);

const annulment = classifyQuestionResult(incorrect, {issue: 'annulment_pending', marked: true});
assert.equal(annulment.classification, 'annulment_pending');
assert.equal(annulment.errorBookEligible, false);
assert.equal(annulment.marked, true);

const sourceError = classifyQuestionResult(incorrect, {issue: 'source_error'});
assert.equal(sourceError.classification, 'source_error');
assert.equal(sourceError.errorBookEligible, false);
assert.throws(() => classifyQuestionResult({selected: '', correct: false}), /Resposta em branco/);
assert.throws(() => classifyQuestionResult(null), /Resultado individual inválido/);

console.log('Classificação testada: acerto seguro, dúvida, chute, marcação, erro confirmado, possível anulação e erro da fonte.');
