import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {buildDailyDiagnosticBudget} from '../assets/integration/home-diagnostic-budget.js';

const NOW=Date.parse('2026-08-16T12:00:00-03:00');
const plan={canonicalId:'TDAS202:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',suggestedCount:10,reason:'Sem aferição privada exata.',item:{canonicalId:'TDAS202:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',topic:'Tópico prioritário',discipline:'Português',code:'5.1'}};
const sequence={next:plan,ready:[plan]};
const baseHome={today:{pe:'PE91',status:'Não iniciada',title:'Estudo',meta:30,block:'Estudo'},overdue:[]};
const emptyState={attempts:[]};
const emptyModule={reviews:[]};

let budget=buildDailyDiagnosticBudget({home:{today:{pe:'PE91',status:'Descanso',title:'Descanso / Anki leve',meta:0,block:'Descanso'},overdue:[{pe:'PE90',title:'Revisão semanal da Semana 13',planned_questions:'55'}]},sequence,diagnosticState:emptyState,moduleState:emptyModule,primaryStage:'overdue',primaryLabel:'Retomar PE90',primaryHref:'/sedes-tdas-dashboard/estudar/?pe=PE90',now:NOW});
assert.equal(budget.status,'blocked-overdue','PE atrasado deve bloquear bateria diagnóstica mesmo em dia de descanso.');
assert.equal(budget.slots,0);
assert.match(budget.title,/PE90/);
assert.match(budget.detail,/55 questões/);

budget=buildDailyDiagnosticBudget({home:{...baseHome,overdue:[]},sequence,diagnosticState:emptyState,moduleState:{reviews:[{status:'pending',dueAt:NOW-1}]},primaryStage:'review',primaryLabel:'Fazer revisão D+1',primaryHref:'/sedes-tdas-dashboard/resolver/?review=r1',now:NOW});
assert.equal(budget.status,'blocked-review','Revisão vencida deve preceder diagnóstico.');
assert.equal(budget.href,'/sedes-tdas-dashboard/resolver/?review=r1');

budget=buildDailyDiagnosticBudget({home:{today:{pe:'PE91',status:'Descanso',title:'Descanso / Anki leve',meta:0,block:'Descanso'},overdue:[]},sequence,diagnosticState:emptyState,moduleState:emptyModule,primaryStage:'done',now:NOW});
assert.equal(budget.status,'blocked-rest','Dia de descanso deve permanecer sem bateria extra.');

budget=buildDailyDiagnosticBudget({home:baseHome,sequence,diagnosticState:emptyState,moduleState:emptyModule,primaryStage:'questions',primaryLabel:'Resolver questões do PE91',primaryHref:'/sedes-tdas-dashboard/resolver/?pe=PE91',now:NOW});
assert.equal(budget.status,'blocked-official','PE atual pendente deve preceder diagnóstico.');
assert.equal(budget.href,'/sedes-tdas-dashboard/resolver/?pe=PE91');

const intentToday={attemptId:'aux',target:{source:'edital'},measurementEligible:false,finishedAt:NOW-60_000};
budget=buildDailyDiagnosticBudget({home:{today:{pe:'PE91',status:'Concluído',title:'Estudo',meta:30,block:'Estudo'},overdue:[]},sequence,diagnosticState:{attempts:[intentToday]},moduleState:emptyModule,primaryStage:'next',now:NOW});
assert.equal(budget.status,'daily-cap','Qualquer bateria diagnóstica concluída deve consumir o limite diário, mesmo intent-only.');
assert.equal(budget.diagnosticsToday,1);

budget=buildDailyDiagnosticBudget({home:{today:{pe:'PE91',status:'Concluído',title:'Estudo',meta:30,block:'Estudo'},overdue:[]},sequence,diagnosticState:emptyState,moduleState:emptyModule,primaryStage:'next',now:NOW});
assert.equal(budget.status,'available','Após concluir o ciclo, sem revisão e sem bateria no dia, deve caber uma aferição.');
assert.equal(budget.slots,1);
assert.equal(budget.next.canonicalId,plan.canonicalId);
assert.match(budget.href,/count=10/);

budget=buildDailyDiagnosticBudget({home:{today:{pe:'PE91',status:'Concluído',title:'Estudo',meta:30,block:'Estudo'},overdue:[]},sequence:{ready:[],next:null},diagnosticState:emptyState,moduleState:emptyModule,primaryStage:'done',now:NOW});
assert.equal(budget.status,'no-queue','Sem item elegível a agenda não deve inventar bateria.');

const [homeHtml,pwa]=await Promise.all([fs.readFile('index.html','utf8'),fs.readFile('scripts/preserve-v27-pwa.mjs','utf8')]);
assert.match(homeHtml,/home-diagnostic-budget\.js\?v=1\.0\.0/,'Home perdeu o orçamento diário diagnóstico.');
assert.ok(pwa.includes('assets/integration/home-diagnostic-budget.js'),'PWA pode perder o orçamento diário na próxima sincronização.');
console.log('Orçamento diário diagnóstico validado: PE atrasado > revisão > execução oficial > descanso/cap diário > uma bateria opcional.');
