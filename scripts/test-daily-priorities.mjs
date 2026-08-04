import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildOfficialCycleTasks,selectPrimaryAction} from '../assets/integration/daily-priorities.js';

const today=JSON.parse(fs.readFileSync('data/today.json','utf8'));
const nextPe={pe:'PE80',title:'Cargo 202 completo: materiais e estoque'};
const base='/sedes-tdas-dashboard/';
const tasks=buildOfficialCycleTasks({today,nextPe,base});
const redaction=tasks.find(item=>item.id==='redaction');
const reviews=tasks.find(item=>item.id==='official-reviews');
const next=tasks.find(item=>item.id==='next');

assert.equal(today.current.pe,'PE79');
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

console.log('Prioridades diárias validadas: sessão interrompida e revisão vencida prevalecem; PE concluído mantém RD23 antes do PE80, sem writeback.');
