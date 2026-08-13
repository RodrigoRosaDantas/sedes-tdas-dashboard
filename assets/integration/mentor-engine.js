const DAY_MS=86_400_000;
const GRAVITY_POINTS={critica:15,critico:15,alta:12,media:8,baixa:4};
const RISK_POINTS={critical:15,attention:9,no_evidence:3,stable:0,strong:0,unknown:0};
const STOPWORDS=new Set(['a','as','o','os','de','da','das','do','dos','e','em','no','na','nos','nas','para','por','com','sem','um','uma','ao','aos','que','lei','decreto','portaria','artigo','arts','inciso','incisos','sobre','entre','sua','seu','seus','suas']);
const SUBJECT_DISCIPLINES={
 'portugues':['Português'],
 'assistencia social':['SUAS / PNAS / NOB','Programas DF','Gerais DF e Legislação'],
 'lc 840/2011':['Direito Administrativo / LC 840'],
 'arquivologia':['Atendimento / Arquivologia'],
 'direito administrativo':['Direito Administrativo / LC 840'],
 'materiais e patrimonio':['Materiais / Patrimônio / Compras'],
 'compras publicas / lei 14.133':['Materiais / Patrimônio / Compras'],
 'direito constitucional':['Direito Constitucional'],
 'atualidades / df-ride / pdpm':['Gerais DF e Legislação'],
 'lei 7.484/2024':['Gerais DF e Legislação'],
 'lei maria da penha':['Gerais DF e Legislação'],
 'primeiros socorros':['Gerais DF e Legislação']
};
export const CAUSE_META={
 knowledge_gap:{label:'Não sabia',hint:'Reforçar teoria antes de aumentar o volume.'},
 concept_confusion:{label:'Confundi conceitos',hint:'Comparar conceitos próximos e registrar a diferença.'},
 forgot_rule:{label:'Esqueci a regra',hint:'Retomar regra, artigo, prazo ou exceção.'},
 misread:{label:'Interpretei errado',hint:'Treinar comando, restrições e palavras-chave.'},
 rush:{label:'Pressa',hint:'Reduzir velocidade e checar o comando antes de marcar.'},
 trap:{label:'Pegadinha',hint:'Catalogar o padrão de cobrança e reconhecer o distrator.'}
};
export const normalizeText=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const toDate=value=>{const date=new Date(String(value||'').length===10?`${value}T12:00:00-03:00`:value);return Number.isNaN(date.getTime())?null:date};
const daysBetween=(from,to)=>{const a=toDate(from),b=toDate(to);if(!a||!b)return null;return Math.max(0,Math.floor((b-a)/DAY_MS))};
const severityLabel=score=>score>=75?'critical':score>=50?'high':score>=25?'attention':'controlled';
const gravityNorm=value=>normalizeText(value).replace(/\s+/g,'');
const maxGravity=errors=>errors.reduce((best,item)=>Math.max(best,GRAVITY_POINTS[gravityNorm(item.gravidade)]||0),0);
const uniq=items=>[...new Set(items.filter(Boolean))];
const tokens=value=>new Set(normalizeText(value).split(/\s+/).filter(token=>token.length>=3&&!STOPWORDS.has(token)));
function editorialMatch(group,edital={}){
 const allowed=SUBJECT_DISCIPLINES[normalizeText(group.materia)]||null;
 const candidates=(edital.topics||edital.priorityTopics||[]).filter(item=>!allowed||allowed.includes(item.discipline));
 const source=tokens(`${group.tema} ${group.subtema}`);if(!source.size)return null;
 let best=null;
 for(const item of candidates){
  const target=tokens(item.topic);const shared=[...source].filter(token=>target.has(token));
  if(!shared.length)continue;
  const ratio=shared.length/Math.max(1,Math.min(source.size,target.size));
  const uniqueLong=shared.some(token=>token.length>=6);
  if(shared.length<2&&!uniqueLong)continue;
  const confidence=Math.min(1,ratio+(shared.length>=2?.2:0));
  if(!best||confidence>best.confidence)best={topic:item.topic,risk:item.risk||'unknown',priority:item.priority||'',url:item.url||'',confidence};
 }
 return best;
}
function recurrencePoints(value){return value>=4?25:value===3?22:value===2?16:value===1?9:0}
function recencyPoints(days){if(days==null)return 0;if(days<=2)return 20;if(days<=7)return 16;if(days<=14)return 12;if(days<=30)return 7;if(days<=60)return 3;return 0}
function trendData(dates,referenceDate){
 const ages=dates.map(date=>daysBetween(date,referenceDate)).filter(value=>value!=null);
 const recent=ages.filter(age=>age<=14).length,previous=ages.filter(age=>age>14&&age<=28).length;
 if(recent>=2&&recent>previous)return{label:'piorando',points:15,recent,previous};
 if(recent>=1&&previous>=1&&recent===previous)return{label:'recorrente',points:8,recent,previous};
 if(recent>=1&&recent<previous)return{label:'recuando',points:4,recent,previous};
 if(recent===1&&previous===0)return{label:'erro recente isolado',points:6,recent,previous};
 if(!recent&&previous)return{label:'sem erro nas últimas 2 semanas',points:1,recent,previous};
 return{label:'sem série recente',points:0,recent,previous};
}
function actionFor(item){
 const pattern=normalizeText((item.patterns||[]).join(' '));
 if(item.severity==='critical')return pattern.includes('lei seca')||pattern.includes('decoreba')?'Hoje: releitura literal da regra + 8–12 questões dirigidas; refazer o erro em 24h.':'Hoje: revisão conceitual curta + 8–12 questões dirigidas; refazer o erro em 24h.';
 if(item.severity==='high')return pattern.includes('interpretacao')||pattern.includes('atencao')?'Em 24–48h: refazer os erros lentamente + 6–8 questões com foco no comando.':'Em 24–48h: revisar a regra/conceito + 6–8 questões do mesmo subtema.';
 if(item.severity==='attention')return'Fazer o conteúdo reaparecer em até 3 dias ou no próximo PE relacionado; 4–6 questões são suficientes.';
 return'Manter na revisão programada; não gastar bloco extra enquanto não surgir nova evidência.';
}
function buildTopicGroups(errors=[],referenceDate,edital){
 const groups=new Map();
 for(const error of errors){
  const materia=String(error.materia||'Sem matéria'),tema=String(error.tema||'Sem tema'),subtema=String(error.subtema||'').trim();
  const key=normalizeText(`${materia}|${tema}|${subtema||tema}`);
  const group=groups.get(key)||{id:key,materia,tema,subtema:subtema||tema,errors:[]};group.errors.push(error);groups.set(key,group);
 }
 return[...groups.values()].map(group=>{
  const sorted=[...group.errors].sort((a,b)=>String(a.data||'').localeCompare(String(b.data||'')));
  const dates=uniq(sorted.map(item=>item.data)).sort();
  const lastErrorDate=dates.at(-1)||'',firstErrorDate=dates[0]||'';
  const recurrence=Math.max(sorted.length-1,...sorted.map(item=>Number(item.reincidencia||0)));
  const recurrenceScore=recurrencePoints(recurrence),daysSinceLast=daysBetween(lastErrorDate,referenceDate),recencyScore=recencyPoints(daysSinceLast),gravityScore=maxGravity(sorted),trend=trendData(dates,referenceDate),match=editorialMatch(group,edital),editalScore=RISK_POINTS[match?.risk||'unknown']||0;
  const latest=sorted.at(-1)||{},reviewScore=latest.revisado===false?10:0;
  let score=Math.min(100,recurrenceScore+recencyScore+gravityScore+trend.points+editalScore+reviewScore);
  if(sorted.length===1&&recurrence===0)score=Math.min(score,49);
  const severity=severityLabel(score);
  const patterns=uniq(sorted.flatMap(item=>item.padraoErro||[]));
  const result={id:group.id,materia:group.materia,tema:group.tema,subtema:group.subtema,label:group.subtema||group.tema,errorCount:sorted.length,recurrence,dates,firstErrorDate,lastErrorDate,daysSinceLast,patterns,latestReviewed:latest.revisado===true,edital:match,trend,score,severity,breakdown:{recurrence:{points:recurrenceScore,max:25},recency:{points:recencyScore,max:20},gravity:{points:gravityScore,max:15},trend:{points:trend.points,max:15},edital:{points:editalScore,max:15},review:{points:reviewScore,max:10}}};
  return{...result,action:actionFor(result)};
 }).sort((a,b)=>b.score-a.score||b.recurrence-a.recurrence||String(b.lastErrorDate).localeCompare(String(a.lastErrorDate)));
}
function strengthBlocks(evolution={}){
 return(evolution.blocks||[]).filter(item=>Number(item.days||0)>=5&&Number(item.accuracy||0)>=94).map(item=>({type:'official_block',label:item.block,accuracy:Number(item.accuracy||0),days:Number(item.days||0),questions:Number(item.meta||0),errors:Number(item.errors||0),level:Number(item.accuracy)>=96?'strong':'stable',evidence:`${item.days} execuções · ${item.meta} questões · ${Number(item.accuracy).toFixed(2)}%`})).sort((a,b)=>b.accuracy-a.accuracy||b.days-a.days);
}
function subjectRisk(subjects={},referenceDate){
 return(subjects.subjects||[]).map(item=>{const latest=item.latest_date||'',age=daysBetween(latest,referenceDate),recent=(item.timeline||[]).filter(row=>{const d=daysBetween(row.date,referenceDate);return d!=null&&d<=14}).reduce((sum,row)=>sum+Number(row.count||0),0);const score=Math.min(100,Number(item.high_critical||0)*4+Number(item.recurrent||0)*3+recent*2+(age!=null&&age<=7?8:0));return{subject:item.subject,errors:Number(item.errors||0),recurrent:Number(item.recurrent||0),highCritical:Number(item.high_critical||0),lastErrorDate:latest,recentErrors:recent,score,topPatterns:(item.top_patterns||[]).slice(0,4),recommendation:item.recommendation||''}}).sort((a,b)=>b.score-a.score||b.errors-a.errors);
}
export function buildOfficialMentorAnalysis({errors=[],subjects={},evolution={},edital={},snapshotDate,examDate}={}){
 const referenceDate=snapshotDate||subjects.meta?.snapshotDate||evolution.meta?.snapshotDate||new Date().toISOString().slice(0,10),exam=examDate||subjects.meta?.examDate||evolution.meta?.examDate||'';
 const priorities=buildTopicGroups(errors,referenceDate,edital),strengths=strengthBlocks(evolution),subjectsRisk=subjectRisk(subjects,referenceDate),daysToExam=exam?daysBetween(referenceDate,exam):null;
 const critical=priorities.filter(item=>item.severity==='critical').length,high=priorities.filter(item=>item.severity==='high').length,attention=priorities.filter(item=>item.severity==='attention').length;
 const timeline=[...errors].filter(item=>item.data).sort((a,b)=>String(b.data).localeCompare(String(a.data))).slice(0,40).map(item=>({date:item.data,materia:item.materia||'Sem matéria',tema:item.tema||'',subtema:item.subtema||'',gravity:item.gravidade||'Sem gravidade',recurrence:Number(item.reincidencia||0),origin:item.origem||'',url:item.url||''}));
 return{schemaVersion:'1.0.0',referenceDate,examDate:exam,daysToExam,methodology:{severity:'0–100 = reincidência 25 + recência 20 + gravidade registrada 15 + tendência 15 + relevância no Edital 15 + revisão pendente 10. Um único erro sem reincidência é limitado a Atenção.',strength:'Ponto forte exige evidência positiva: bloco oficial com pelo menos 5 execuções e aproveitamento ≥94%, ou sinal local com amostra mínima e sequência recente consistente.'},summary:{critical,high,attention,controlled:priorities.filter(item=>item.severity==='controlled').length,strengths:strengths.length,totalTopicGroups:priorities.length,totalErrors:errors.length,topPriority:priorities[0]||null},priorities,strengths,subjects:subjectsRisk,timeline};
}
export function buildLocalMentorSignals({state={},causeState={},now=Date.now()}={}){
 const attempts=[...(state.attempts||[])].sort((a,b)=>Number(b.finishedAt||0)-Number(a.finishedAt||0)),groups=new Map();
 for(const attempt of attempts)for(const result of attempt.questionResults||[]){const label=String(result.subassunto||result.assunto||'Sem assunto'),key=normalizeText(label),row=groups.get(key)||{label,total:0,correct:0,errors:0,uncertain:0,events:[]};row.total++;if(result.correct)row.correct++;if(result.classification==='incorrect_confirmed')row.errors++;if(['correct_with_doubt','correct_by_guess','marked'].includes(result.classification)||['doubt','guess'].includes(result.confidence))row.uncertain++;row.events.push({correct:Boolean(result.correct),at:Number(attempt.finishedAt||0)});groups.set(key,row)}
 const strengths=[...groups.values()].map(row=>{const recent=[...row.events].sort((a,b)=>b.at-a.at).slice(0,3),accuracy=row.total?row.correct/row.total*100:0;return{...row,accuracy,recentClean:recent.length>=3&&recent.every(item=>item.correct)}}).filter(row=>row.total>=5&&row.accuracy>=85&&row.recentClean&&row.uncertain<=1).sort((a,b)=>b.accuracy-a.accuracy||b.total-a.total).slice(0,6);
 const risks=[...groups.values()].map(row=>({...row,accuracy:row.total?row.correct/row.total*100:0,score:row.errors*4+row.uncertain*2})).filter(row=>row.score>0).sort((a,b)=>b.score-a.score||a.accuracy-b.accuracy).slice(0,8);
 const dueReviews=(state.reviews||[]).filter(item=>item.status==='pending'&&Number(item.dueAt||0)<=now);
 const causeLookup=causeState?.causes||{},counts=new Map();for(const error of state.errors||[]){const cause=causeLookup[error.id]?.cause;if(cause&&CAUSE_META[cause])counts.set(cause,(counts.get(cause)||0)+1)}
 const causes=[...counts.entries()].map(([id,count])=>({id,count,...CAUSE_META[id]})).sort((a,b)=>b.count-a.count);
 return{attempts:attempts.length,dueReviews:dueReviews.length,criticalDue:dueReviews.filter(item=>Number(item.recurrenceCount||0)>0||['incorrect_confirmed','wrong_again'].includes(item.sourceOutcome||item.outcome||item.classification)).length,strengths,risks,causes};
}
