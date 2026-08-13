import assert from 'node:assert/strict';
import {answerHistoryForAttempt,ensureAnswerHistorySession,recordAnswerChange} from '../assets/integration/answer-history.js';
class Store{constructor(){this.m=new Map()}getItem(k){return this.m.has(k)?this.m.get(k):null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}}
const s=new Store(),a={catalogId:'c1',startedAt:1000};ensureAnswerHistorySession({...a,answers:{}},s,1000);for(const[answer,at]of[['B',1100],['C',1200],['B',1300],['B',1400]])recordAnswerChange({...a,questionId:'q1',option:answer},s,at);const q=answerHistoryForAttempt(a,s).q1;assert.deepEqual(q.answerHistory.map(x=>x.answer),['B','C','B']);assert.equal(q.historyComplete,true);
const r=new Store();ensureAnswerHistorySession({catalogId:'c2',startedAt:2000,answers:{q2:'A'}},r,2100);recordAnswerChange({catalogId:'c2',startedAt:2000,questionId:'q2',option:'D'},r,2200);const q2=answerHistoryForAttempt({catalogId:'c2',startedAt:2000},r).q2;assert.deepEqual(q2.answerHistory.map(x=>x.answer),['A','D']);assert.equal(q2.historyComplete,false);
console.log('Sequência de respostas validada.');
