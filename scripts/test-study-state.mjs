import assert from 'node:assert/strict';
import {buildAiStudySummary,buildStudyState} from '../assets/integration/study-state.js';

const now=Date.parse('2026-08-13T12:00:00-03:00');
const state=buildStudyState({
 home:{meta:{snapshotDate:'2026-08-13',examDate:'2026-09-06',version:'26'},metrics:{totalPE:112,completed:87,questions:1000,correct:800,errors:200,operationalDays:24},today:{pe:'PE88',title:'Treino',status:'Em andamento'}},
 platform:{peId:'PE88',platformVersion:'26.17.0',dataVersion:'26',syncAt:'2026-08-13T09:50:00-03:00',sourceCommit:'abc'},
 local:{updatedAt:now,attempts:[{id:'a1',mode:'study',peId:'PE88',finishedAt:now-60000,elapsedMs:600000,total:10,correct:8,percent:80,questionResults:[{id:'q1',assunto:'Arquivologia',correct:false,classification:'incorrect_confirmed'}]}],errors:[{}],marked:[],reviews:[{id:'r1',status:'pending',dueAt:now-1000,sourceOutcome:'incorrect_confirmed'}],aiQueue:[]},
 draft:{peId:'PE88',savedAt:now,session:{questionIds:['q1','q2'],answers:{q1:'A'},currentIndex:1}},
 audit:{summary:{linked_error_records:150}},now
});
assert.equal(state.schemaVersion,'1.0.0');
assert.equal(state.official.currentPe,'PE88');
assert.equal(state.official.completedPe,87);
assert.equal(state.local.questions,10);
assert.equal(state.local.reviews.criticalDue,1);
assert.equal(state.local.draft.answered,1);
assert.equal(state.topicRisks[0].riskScore,4);
assert.equal(state.quality.unlinkedOfficialErrors,50);
const summary=buildAiStudySummary(state);
assert.match(summary,/OFICIAL \/ NOTION PUBLICADO/);
assert.match(summary,/LOCAL \/ ESTE DISPOSITIVO/);
console.log('Estado unificado validado: oficial e local separados, revisão, risco, rascunho e resumo para IA.');
