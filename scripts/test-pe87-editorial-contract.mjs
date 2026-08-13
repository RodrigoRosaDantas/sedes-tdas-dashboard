import assert from 'node:assert/strict';
import {validatePe87EditorialContract} from './notion/pe87-editorial-contract.mjs';

const catalog={
  peId:'PE87',
  questions:[{
    id:'PE87-Q020',
    numeroOriginal:20,
    enunciado:'Assinale a associação normativa correta referente ao Cartão Prato Cheio.',
    alternativas:{
      A:'Lei Distrital nº 7.009/2021 e Decreto Distrital nº 42.873/2021.',
      B:'Decreto Distrital nº 40.783/2020 e Portaria nº 40/2020.'
    }
  }]
};
const valid={answers:[{id:'PE87-Q020',gabarito:'B'}]};
const invalid={answers:[{id:'PE87-Q020',gabarito:'A'}]};
assert.deepEqual(validatePe87EditorialContract({catalog,key:valid}),{applicable:true,questionId:'PE87-Q020',answer:'B'});
assert.throws(()=>validatePe87EditorialContract({catalog,key:invalid}),/Q20 do Cartão Prato Cheio exige gabarito B/);
assert.equal(validatePe87EditorialContract({catalog:{...catalog,peId:'PE88'},key:invalid}).applicable,false);
assert.equal(validatePe87EditorialContract({catalog:{...catalog,questions:[{...catalog.questions[0],enunciado:'Outra questão'}]},key:invalid}).applicable,false,'Contrato não deve bloquear uma futura Q20 editorialmente diferente.');
console.log('Contrato editorial PE87 validado: Q20 atual do Prato Cheio exige B e futuras versões diferentes não ficam hardcoded.');
