import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildOfficialCycleTasks,selectPrimaryAction} from '../assets/integration/daily-priorities.js';

const publishedToday=JSON.parse(fs.readFileSync('data/today.json','utf8'));
const publishedPe=String(publishedToday.current?.pe||'');
const publishedNextRecord=publishedToday.next?.[0]||publishedToday.allFuture?.[0]||null;
const publishedNext=publishedNextRecord?{pe:publishedNextRecord.pe,title:publishedNextRecord.title}:null;
const base='/sedes-tdas-dashboard/';

assert.match(publishedPe,/^PE\d+$/,'O snapshot vigente deve possuir PE atual válido.');
const publishedTasks=buildOfficialCycleTasks({today:publishedToday,nextPe:publishedNext,base});
if(publishedNext){
 const publishedNextTask=publishedTasks.find(item=>item.id==='next');
 assert.equal(publishedNextTask?.label,`Preparar ${publishedNext.pe}`);
 assert.equal(publishedNextTask?.href,`${base}estudar/?pe=${publishedNext.pe}`);
}

const today={
 current:{pe:'PE79',rd:'RD23',review24:false,review72:false,action:'Revisar em 24h'},
 checklist:[
  {title:'Produzir RD23',detail:'RD23',done:false},
  {title:'Programar revisão em 24h e 72h',detail:'Marque as revisões somente quando forem executadas.',done:false}
 ]
};
const nextPe={pe:'PE80',title:'Cargo 202 completo: materiais e estoque'};
const tasks=buildOfficialCycleTasks({today,nextPe,base});
const redaction=tasks.find(item=>item.id==='redaction');
const reviews=tasks.find(item=>item.id==='official-reviews');
const next=tasks.find(item=>item.id==='next');

assert.equal(redaction?.label,'Produzir RD23');
assert.equal(redaction?.done,false);
assert.equal(redaction?.href,'/sedes-tdas-dashboard/redacoes/?rd=RD23&pe=PE79');
assert.equal(reviews?.done,false);
assert.equal(reviews?.label,'Prioridade de revisão externa');
assert.equal(reviews?.href,'/sedes-tdas-dashboard/revisar/');
assert.match(reviews?.detail||'',/fora do TDAS/i);
assert.equal(next?.label,'Preparar PE80');

const defaultAction=selectPrimaryAction({pe:'PE79',progress:{material:true,questions:true,registered:true},draft:null,attempt:null,nextPe,officialCompleted:true,officialTasks:tasks,base});
assert.equal(defaultAction.stage,'redaction');
assert.equal(defaultAction.label,'Produzir RD23');
assert.equal(defaultAction.button,'Abrir redação');

const pendingPeAction=selectPrimaryAction({pe:'PE79',progress:{material:false,questions:false,registered:false},draft:null,attempt:null,nextPe,officialCompleted:false,officialTasks:tasks,base});
assert.equal(pendingPeAction.stage,'material','Redação vinculada não deve virar ação primária antes da conclusão oficial do PE.');
assert.equal(pendingPeAction.label,'Começar material do PE79');

const draftAction=selectPrimaryAction({pe:'PE79',progress:{},draft:{peId:'PE79',session:{currentIndex:2,questionIds:['a','b','c','d']}},attempt:null,nextPe,officialCompleted:true,officialTasks:tasks,base});
assert.equal(draftAction.stage,'questions');
assert.equal(draftAction.label,'Continuar questão 3 de 4');

const reviewIgnoredAction=selectPrimaryAction({pe:'PE79',progress:{material:false,questions:false,registered:false},draft:null,attempt:null,nextPe,dueReview:{id:'rev-1',stage:'D+1'},officialCompleted:false,officialTasks:[],base});
assert.equal(reviewIgnoredAction.stage,'material','Sinal local de revisão não pode preemptar a execução diária.');
assert.ok(!String(reviewIgnoredAction.href).includes('?review='),'Ação primária não pode abrir revisão interna.');

const completedToday=structuredClone(today);
completedToday.checklist=completedToday.checklist.map(item=>/^Produzir\s+RD/i.test(item.title)?{...item,done:true}:item);
const completedTasks=buildOfficialCycleTasks({today:completedToday,nextPe,base});
const nextAction=selectPrimaryAction({pe:'PE79',progress:{material:true,questions:true,registered:true},draft:null,attempt:null,nextPe,officialCompleted:true,officialTasks:completedTasks,base});
assert.equal(nextAction.stage,'next');
assert.equal(nextAction.label,'Preparar PE80');

const overduePe={pe:'PE78',date:'2026-08-05',title:'Atividade oficial atrasada',status:'Não iniciada'};
const overdueAction=selectPrimaryAction({pe:'PE79',progress:{material:false,questions:false,registered:false},draft:null,attempt:null,nextPe,overduePe,officialCompleted:false,officialTasks:tasks,base});
assert.equal(overdueAction.stage,'overdue');
assert.equal(overdueAction.label,'Retomar PE78 — Atividade oficial atrasada');
assert.equal(overdueAction.href,'/sedes-tdas-dashboard/estudar/?pe=PE78');
assert.equal(overdueAction.button,'Retomar PE atrasado');

const startedCurrentAction=selectPrimaryAction({pe:'PE79',progress:{material:true,questions:false,registered:false},draft:null,attempt:null,nextPe,overduePe,officialCompleted:false,officialTasks:tasks,base});
assert.equal(startedCurrentAction.stage,'questions','Progresso local no PE atual não pode ser interrompido automaticamente pelo atraso anterior.');

console.log(`Prioridades diárias validadas no snapshot ${publishedPe}: sessão preservada, revisão externa não preempta, redação aguarda fechamento oficial, atraso não some e progresso local iniciado é preservado.`);
