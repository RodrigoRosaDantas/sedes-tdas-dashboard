import assert from 'node:assert/strict';
import {buildContinuity} from '../assets/integration/continuity-engine.js';

const now=1_800_000_000_000;
const fallback={label:'Continuar PE89',href:'/sedes-tdas-dashboard/estudar/?pe=PE89',detail:'Plano oficial'};
const daily=buildContinuity({now,fallback,draft:{catalogId:'tdas-pe89-x',peId:'PE89',session:{currentIndex:4,questionIds:Array.from({length:24},(_,i)=>`Q${i+1}`),answers:{Q1:'A',Q2:'B'}}},moduleState:{reviews:[],errors:[]}});
assert.equal(daily.primary.kind,'session');assert.equal(daily.primary.label,'Continuar questão 5 de 24');assert.equal(daily.primary.href,'/sedes-tdas-dashboard/resolver/?resume=1');
const bank=buildContinuity({now,fallback,draft:{catalogId:'tdas-bank-abc',peId:'BANCO',session:{currentIndex:9,questionIds:Array.from({length:20},(_,i)=>`B${i+1}`),answers:{B1:'A'}}},moduleState:{reviews:[{id:'R1',status:'pending',dueAt:now-1}],errors:[]}});
assert.equal(bank.primary.href,'/sedes-tdas-dashboard/resolver/?modo=banco&resume=1');assert.equal(bank.queue[1].kind,'plan');assert.equal(bank.queue[2].kind,'priorities');
const priorities=buildContinuity({now,fallback,moduleState:{reviews:[{id:'R1',status:'pending',dueAt:now-10},{id:'R2',status:'pending',dueAt:now+10},{id:'R3',status:'completed',dueAt:now-10}],errors:[{id:'E1'}]}});
assert.equal(priorities.primary.kind,'plan','Sinal de revisão não pode preemptar o plano oficial.');assert.equal(priorities.dueSignals,1);assert.equal(priorities.dueReviews,1,'Alias histórico deve permanecer para compatibilidade.');assert.equal(priorities.queue[1].kind,'priorities');assert.equal(priorities.queue[1].href,'/sedes-tdas-dashboard/revisar/');assert.match(priorities.queue[1].detail,/fluxo externo/i);assert.equal(priorities.queue[2].kind,'errors');
const reviewFallback=buildContinuity({now,fallback:{label:'Ver prioridades',href:'/sedes-tdas-dashboard/revisar/',detail:'Fechamento'},moduleState:{reviews:[{id:'R1',status:'pending',dueAt:now-10}],errors:[]}});assert.equal(reviewFallback.queue.length,1,'Fallback de Prioridades não deve duplicar sinais locais.');assert.equal(reviewFallback.primary.kind,'plan');
const withErrors=buildContinuity({now,fallback,moduleState:{reviews:[],errors:[{id:'E1'}]}});assert.equal(withErrors.primary.kind,'plan');assert.equal(withErrors.queue[1].kind,'errors');
const plain=buildContinuity({now,fallback,moduleState:{reviews:[],errors:[]}});assert.equal(plain.primary.kind,'plan');
console.log('TDAS v27: motor de continuidade validado sem revisão interna ou preempção do plano oficial.');
