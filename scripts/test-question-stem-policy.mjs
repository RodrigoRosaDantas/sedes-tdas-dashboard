import assert from'node:assert/strict';
import{isValidQuestionStem}from'./question-stem-policy.mjs';

assert.equal(isValidQuestionStem('O SISAN é'),true,'Enunciado curto legítimo do PE88 deve ser aceito.');
assert.equal(isValidQuestionStem('O SUAS é'),true,'Enunciado curto com múltiplas palavras deve ser aceito.');
assert.equal(isValidQuestionStem('Digitalização'),true,'Enunciado nominal substantivo deve ser aceito.');
assert.equal(isValidQuestionStem(''),false,'Enunciado vazio deve ser rejeitado.');
assert.equal(isValidQuestionStem('Q51'),false,'Identificador isolado não é enunciado suficiente.');
assert.equal(isValidQuestionStem('???'),false,'Pontuação isolada não é enunciado suficiente.');

console.log('Política de enunciado validada: frases curtas legítimas preservadas sem aceitar vazio ou identificador isolado.');
