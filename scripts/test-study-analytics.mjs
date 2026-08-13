import assert from 'node:assert/strict';
import {buildStudyAnalytics} from '../assets/integration/study-analytics.js';
import {backupToEvents,mergeBackupWithEvents,reduceEvents,stableStringify} from '../assets/integration/cloud-sync-core.js';

const now=Date.parse('2026-08-13T12:00:00-03:00');
const attempts=[
 {id:'a1',mode:'study',peId:'PE88',finishedAt:Date.parse('2026-08-13T10:00:00-03:00'),elapsedMs:1200000,total:10,correct:8,questionResults:[{id:'q1',assunto:'Arquivologia',correct:false,classification:'incorrect_confirmed',confidence:'secure'}]},
 {id:'a2',mode:'study',peId:'PE87',finishedAt:Date.parse('2026-08-12T10:00:00-03:00'),elapsedMs:1800000,total:20,correct:18,questionResults:[{id:'q2',assunto:'Arquivologia',correct:true,classification:'correct_by_guess',confidence:'guess'}]},
 {id:'a3',mode:'review',reviewOutcome:'mastered',peId:'PE86',finishedAt:Date.parse('2026-08-11T10:00:00-03:00'),elapsedMs:240000,total:1,correct:1,questionResults:[{id:'q3',assunto:'Arquivologia',correct:true,classification:'correct_secure',confidence:'secure'}]},
 {id:'a4',mode:'study',peId:'PE81',finishedAt:Date.parse('2026-08-06T10:00:00-03:00'),elapsedMs:1500000,total:10,correct:6,questionResults:[]}
];
const reviews=[{id:'r1',status:'pending',dueAt:Date.parse('2026-08-12T10:00:00-03:00'),sourceOutcome:'incorrect_confirmed'}];
const result=buildStudyAnalytics({attempts,reviews,now});
assert.equal(result.total.questions,41);
assert.equal(result.last7.questions,31);
assert.equal(result.previous7.questions,10);
assert.equal(result.streak.current,3);
assert.equal(result.review.masteredRate,100);
assert.equal(result.review.criticalDue,1);
assert.equal(result.topics[0].riskScore,6);
assert.ok(result.total.questionsPerHour>20);

const state=(attemptList,reviewList,updatedAt,questions)=>({stores:{questionModule:{attempts:attemptList,errors:[],marked:[],reviews:reviewList,aiQueue:[]},dailyExecution:{items:{PE88:{material:true,questions,registered:false,updatedAt}}}}});
const pending={id:'review:sync',sourceAttemptId:'sync-source',status:'pending',completedAt:null,outcome:null};
const completed={...pending,status:'completed',completedAt:3000,outcome:'mastered'};
const local=state([{id:'sync-source',finishedAt:1000},{id:'local-only',finishedAt:2000}],[pending],'2026-08-13T10:00:00Z',false);
const remote=state([{id:'sync-source',finishedAt:1000},{id:'remote-only',finishedAt:3000}],[completed],'2026-08-13T12:00:00Z',true);
const localEvents=backupToEvents(local,'device-a'),remoteEvents=backupToEvents(remote,'device-b');
assert.equal(stableStringify(localEvents),stableStringify(backupToEvents(local,'device-a')));
const merged=mergeBackupWithEvents(local,remoteEvents,'device-a');
assert.ok(merged.stores.questionModule.attempts.some(item=>item.id==='local-only'));
assert.ok(merged.stores.questionModule.attempts.some(item=>item.id==='remote-only'));
assert.equal(merged.stores.questionModule.reviews.find(item=>item.id==='review:sync').status,'completed');
assert.equal(merged.stores.dailyExecution.items.PE88.questions,true);
assert.equal(stableStringify(reduceEvents([...localEvents,...remoteEvents])),stableStringify(reduceEvents([...remoteEvents,...localEvents])));
console.log('Motor analítico e sincronização multi-dispositivo validados.');
