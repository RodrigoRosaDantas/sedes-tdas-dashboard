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
 current:{
  pe:'PE79',
  rd:'RD23',
  review24:false,
  review72:false,
  action:'Revisar em 24h'
 },
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
assert.match(reviews?.detail||'',/revis/i);
assert.equal(next?.label,'Preparar PE80');

const defaultAction=selectPrimaryAction({pe:'PE79',progress:{material:true,questions:true,registered:true},draft:null,attempt:null,nextPe,dueReview:null,officialCompleted:true,officialTasks:tasks,base});
assert.equal(defaultAction.stage,'redaction');
assert.equal(defaultAction.label,'Produzir RD23');
assert.equal(defaultAction.button,'Abrir redação');

const draftAction=selectPrimaryAction({pe:'PE79',progress:{},draft:{peId:'PE79',session:{currentIndex:2,questionIds:['a','b','c','d']}},attempt:null,nextPe,dueReview:null,officialCompleted:true,officialTasks:tasks,base});
assert.equal(draftAction.stage,'questions');
assert.equal(draftAction.label,'Continuar questão 3 de 4');

const reviewAction=selectPrimaryAction({pe:'PE79',progress:{},draft:null,attempt:null,nextPe,dueReview:{id:'rev-1',stage:'D+1'},officialCompleted:true,officialTasks:tasks,base});
assert.equal(reviewAction.stage,'review');

const completedToday=structuredClone(today);
completedToday.checklist=completedToday.checklist.map(item=>/^Produzir\s+RD/i.test(item.title)?{...item,done:true}:item);
const completedTasks=buildOfficialCycleTasks({today:completedToday,nextPe,base});
const nextAction=selectPrimaryAction({pe:'PE79',progress:{material:true,questions:true,registered:true},draft:null,attempt:null,nextPe,dueReview:null,officialCompleted:true,officialTasks:completedTasks,base});
assert.equal(nextAction.stage,'next');
assert.equal(nextAction.label,'Preparar PE80');

console.log(`Prioridades diárias validadas no snapshot ${publishedPe}: sessão interrompida e revisão vencida prevalecem; o cenário unitário preserva RD23 antes do PE80, sem depender do PE publicado.`);
