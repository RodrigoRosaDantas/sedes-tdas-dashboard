import assert from'node:assert/strict';
import fs from'node:fs/promises';
import{buildOfficialMentorAnalysis,buildLocalMentorSignals}from'../assets/integration/mentor-engine.js';
const read=file=>fs.readFile(file,'utf8');
const json=file=>read(file).then(JSON.parse);
const[index,subjects,evolution,edital,page,script,css,shell,sw,postprocess]=await Promise.all([json('data/error-questions/index.json'),json('data/subjects.json'),json('data/evolution.json'),json('data/edital-status.json'),read('mentor/index.html'),read('assets/mentor.js'),read('assets/mentor.css'),read('assets/tdas-mobile-ux.js'),read('sw.js'),read('scripts/postprocess-v26.mjs')]);
const errors=(await Promise.all((index.parts||[]).map(part=>json(`data/error-questions/${part.file}`)))).flat();
const analysis=buildOfficialMentorAnalysis({errors,subjects,evolution,edital,snapshotDate:subjects.meta?.snapshotDate,examDate:subjects.meta?.examDate});
assert.equal(errors.length,index.total,'Mentor deve analisar todos os erros publicados.');
assert.equal(analysis.summary.totalErrors,index.total,'Resumo do Mentor deve fechar com o Caderno oficial.');
assert.ok(analysis.priorities.length>20,'Mentor deve agrupar fragilidades por tema/subtema.');
assert.ok(analysis.strengths.length>0,'Pontos fortes exigem evidência positiva, mas o histórico atual deve produzir ao menos um sinal.');
for(const item of analysis.strengths){assert.ok(item.days>=5,'Ponto forte oficial exige ao menos 5 execuções.');assert.ok(item.accuracy>=94,'Ponto forte oficial exige aproveitamento >=94%.');}
for(const item of analysis.priorities){
 const sum=Object.values(item.breakdown).reduce((total,factor)=>total+factor.points,0);assert.equal(item.score,Math.min(100,sum,item.errorCount===1&&item.recurrence===0?49:100),'Score deve ser soma explicável com teto conservador.');
 assert.deepEqual(item.dates,[...item.dates].sort(),'Datas do erro devem permanecer cronológicas.');
 if(item.errorCount===1&&item.recurrence===0)assert.ok(!['critical','high'].includes(item.severity),'Erro isolado não pode virar fragilidade alta/crítica.');
 assert.ok(item.action,'Toda fragilidade deve ter próxima ação.');
}
const fixture=buildOfficialMentorAnalysis({snapshotDate:'2026-08-13',examDate:'2026-09-06',errors:[
 {materia:'Português',tema:'Crase',subtema:'emprego da crase',data:'2026-08-02',gravidade:'Alta',reincidencia:0,revisado:false,padraoErro:['Lei seca']},
 {materia:'Português',tema:'Crase',subtema:'emprego da crase',data:'2026-08-09',gravidade:'Alta',reincidencia:1,revisado:false,padraoErro:['Lei seca']},
 {materia:'Português',tema:'Crase',subtema:'emprego da crase',data:'2026-08-12',gravidade:'Alta',reincidencia:2,revisado:false,padraoErro:['Lei seca']},
 {materia:'LC 840/2011',tema:'PAD',subtema:'prazo do PAD',data:'2026-08-12',gravidade:'Alta',reincidencia:0,revisado:false,padraoErro:['Decoreba']}
],subjects:{subjects:[]},evolution:{blocks:[{block:'Simulado',days:6,meta:300,errors:8,accuracy:97.3}]},edital:{topics:[{topic:'Emprego do sinal indicativo de crase.',discipline:'Português',risk:'critical',priority:'Alta',url:'#'}]}});
assert.equal(fixture.priorities[0].severity,'critical','Reincidência recente e crítica deve produzir prioridade crítica.');
const isolated=fixture.priorities.find(item=>item.subtema==='prazo do PAD');assert.equal(isolated.severity,'attention','Um erro isolado deve permanecer em Atenção.');assert.ok(isolated.score<=49,'Teto conservador deve ser <=49.');
const local=buildLocalMentorSignals({state:{attempts:[{finishedAt:6,questionResults:[{assunto:'Autotutela',correct:true}]},{finishedAt:5,questionResults:[{assunto:'Autotutela',correct:true}]},{finishedAt:4,questionResults:[{assunto:'Autotutela',correct:true}]},{finishedAt:3,questionResults:[{assunto:'Autotutela',correct:true}]},{finishedAt:2,questionResults:[{assunto:'Autotutela',correct:true}]}],errors:[],reviews:[]},causeState:{causes:{}}});
assert.equal(local.strengths[0]?.label,'Autotutela','Sinal local forte exige amostra mínima e três observações recentes corretas.');
for(const marker of ['Mentor TDAS','Pontos fortes','Pontos fracos','Linha do tempo dos erros','Como a gravidade é calculada'])assert.ok(script.includes(marker),`Página deve conter ${marker}.`);
for(const marker of ['mentor-priority','mentor-strength','mentor-timeline','mentor-formula','mentor-mini'])assert.ok(css.includes(marker),`CSS deve conter ${marker}.`);
assert.match(page,/assets\/mentor\.js/,'Rota Mentor deve carregar seu módulo.');
assert.match(shell,/mentor:BASE\+'mentor\/'/,'Shell deve reconhecer a rota Mentor.');
assert.match(shell,/\['mentor','Mentor TDAS'\]/,'Drawer deve expor Mentor.');
for(const item of ['mentor/','assets/mentor.js','assets/mentor.css','assets/integration/mentor-engine.js','assets/integration/mentor-ux.js']){assert.ok(sw.includes(item),`PWA deve incluir ${item}.`);assert.ok(postprocess.includes(item),`Gerador do PWA deve preservar ${item}.`)}
assert.ok(!script.includes('api.notion.com'),'Mentor não pode acessar API do Notion pelo navegador.');
console.log(`Mentor TDAS validado: ${analysis.summary.critical} críticos, ${analysis.summary.high} altos, ${analysis.summary.attention} em atenção, ${analysis.strengths.length} sinais oficiais de força e ${errors.length} erros analisados.`);
