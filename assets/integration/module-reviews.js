import {BASE,escapeHTML,loadJSON,setupShell} from '../common.js?v=24.1';
import {readModuleState} from './module-store.js?v=2.1.0';

const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const topicLabel=item=>String(item?.subassunto||item?.assunto||'Sem assunto').trim()||'Sem assunto';
const subjectLabel=item=>String(item?.materia||'Matéria não informada').trim()||'Matéria não informada';
const signalKind=item=>{
 const classification=String(item?.classification||item?.sourceOutcome||'');
 if(classification==='incorrect_confirmed'||classification==='wrong_again'||item?.correct===false)return'error';
 if(classification==='correct_with_doubt'||classification==='correct_by_guess'||item?.confidence==='doubt'||item?.confidence==='guess')return'uncertainty';
 if(classification==='marked'||item?.marked===true)return'marked';
 return null;
};
const matchesFocus=(group,focus)=>!focus||normalize(`${group.subject} ${group.topic}`).includes(normalize(focus))||normalize(focus).split(' ').filter(Boolean).some(token=>normalize(`${group.subject} ${group.topic}`).includes(token));

function collectSignals(state){
 const attempts=[...(state.attempts||[])].filter(item=>item?.mode==='study').sort((a,b)=>Number(b.finishedAt||0)-Number(a.finishedAt||0)).slice(0,60);
 const signals=[];
 for(const attempt of attempts){
  for(const result of attempt.questionResults||[]){const kind=signalKind(result);if(kind)signals.push({...result,kind,peId:attempt.peId||result.peId||null,at:attempt.finishedAt||0})}
 }
 if(!signals.length){
  for(const item of state.errors||[])signals.push({...item,kind:'error',at:item.createdAt||0});
  for(const item of state.marked||[])signals.push({...item,kind:signalKind(item)||'marked',at:item.createdAt||0});
  const unique=new Set();
  for(const item of state.reviews||[]){
   if(item?.status!=='pending')continue;
   const id=`${item.sourceAttemptId||''}:${item.questionId||item.id||''}`;
   if(unique.has(id))continue;unique.add(id);
   const kind=signalKind(item);if(kind)signals.push({...item,kind,at:item.createdAt||0});
  }
 }
 return signals;
}

function groupSignals(signals){
 const groups=new Map();
 for(const item of signals){
  const topic=topicLabel(item),subject=subjectLabel(item),key=`${normalize(subject)}|${normalize(topic)}`;
  const group=groups.get(key)||{subject,topic,total:0,errors:0,uncertainty:0,marked:0,recurrent:0,lastAt:0,pes:new Set()};
  group.total+=1;group.lastAt=Math.max(group.lastAt,Number(item.at||item.createdAt||0));if(item.peId)group.pes.add(item.peId);
  if(item.kind==='error')group.errors+=1;else if(item.kind==='uncertainty')group.uncertainty+=1;else if(item.kind==='marked')group.marked+=1;
  groups.set(key,group);
 }
 return [...groups.values()].map(group=>({...group,recurrent:Math.max(0,group.errors-1),score:group.errors*4+group.uncertainty*2+group.marked+Math.max(0,group.errors-1)*3})).sort((a,b)=>b.score-a.score||b.errors-a.errors||b.uncertainty-a.uncertainty||b.lastAt-a.lastAt);
}

function reasons(group){const out=[];if(group.errors)out.push(`${group.errors} erro${group.errors===1?'':'s'}`);if(group.recurrent)out.push(`${group.recurrent} reincidência${group.recurrent===1?'':'s'}`);if(group.uncertainty)out.push(`${group.uncertainty} dúvida/chute${group.uncertainty===1?'':'s'}`);if(group.marked)out.push(`${group.marked} marcação${group.marked===1?'':'ões'}`);return out}
function card(group,index){const why=reasons(group);return `<article class="card panel review-card" data-priority-rank="${index+1}"><small>Prioridade ${index+1} · ${escapeHTML(group.subject)}</small><h3>${escapeHTML(group.topic)}</h3><div class="tags">${why.map(item=>`<span class="tag">${escapeHTML(item)}</span>`).join('')}</div><p>${group.recurrent?'Reincidência elevou este assunto na ordem de atenção.':'Prioridade calculada pelos sinais reais das sessões locais.'}</p><p><strong>Próximo passo:</strong> revise este tópico no seu fluxo externo e depois volte às questões para validar a retenção.</p></article>`}

function updateHero(groups,signals,focus){
 const hero=document.querySelector('[data-review-priorities]');if(!hero)return;
 hero.dataset.uxReviewToday='1';
 const heading=hero.querySelector('h1');if(heading)heading.textContent=focus?`Prioridade: ${focus}`:'Prioridades para revisar';
 const copy=hero.querySelector('p');if(copy)copy.textContent=focus?'O Mentor definiu este foco. O TDAS mostra apenas os sinais que justificam a prioridade; a revisão continua fora do site.':'O TDAS não executa mais a revisão. Ele organiza erros, reincidências, dúvidas e marcações para indicar onde concentrar sua revisão fora do site.';
 let tags=hero.querySelector('.tags');if(!tags){tags=document.createElement('div');tags.className='tags';hero.querySelector('.hero-actions')?.before(tags)}
 const errors=signals.filter(item=>item.kind==='error').length,uncertainty=signals.filter(item=>item.kind==='uncertainty').length,recurrent=groups.reduce((sum,item)=>sum+item.recurrent,0);
 tags.innerHTML=`<span class="tag">${groups.length} assunto${groups.length===1?'':'s'} priorizado${groups.length===1?'':'s'}</span><span class="tag">${errors} erro${errors===1?'':'s'}</span><span class="tag">${uncertainty} dúvida/chute${uncertainty===1?'':'s'}</span>${recurrent?`<span class="tag">${recurrent} reincidência${recurrent===1?'':'s'}</span>`:''}`;
}

function render(groups,focus){
 const root=document.querySelector('[data-review-priority-list]');if(!root)return;
 if(!groups.length){root.innerHTML=`<div class="section-head"><div><h2>${focus?'Sem sinal local compatível':'Nenhuma prioridade local relevante'}</h2><p>${focus?'Não há evidência local suficiente para este foco. O TDAS não inventa uma fila de revisão.':'Quando surgirem erros, dúvidas, chutes ou marcações, eles aparecerão aqui como sinais de prioridade — sem criar uma sessão de revisão.'}</p></div></div><article class="card panel"><div class="hero-actions"><a class="btn primary" href="${BASE}mentor/">Abrir Mentor</a><a class="btn" href="${BASE}resolver/">Resolver questões</a></div></article>`;return}
 root.innerHTML=`<div class="section-head"><div><span class="kicker">Prioridade pedagógica</span><h2>${focus?`Sinais relacionados a ${escapeHTML(focus)}`:'O que merece atenção'}</h2><p>Ordenação por erro, reincidência, dúvida/chute e marcação. Não existe botão de “iniciar revisão” porque a revisão não é executada no TDAS.</p></div>${focus?`<a class="btn" href="${BASE}revisar/">Ver todas</a>`:''}</div><div class="grid two">${groups.slice(0,12).map(card).join('')}</div>`;
}

try{
 document.documentElement.dataset.reviewMode='priorities-only';
 const shell=await loadJSON('data/more.json');setupShell('mais',shell.meta);
 const params=new URLSearchParams(location.search),focus=(params.get('mentor')||params.get('subject')||'').trim();
 const state=readModuleState(),signals=collectSignals(state),allGroups=groupSignals(signals),groups=focus?allGroups.filter(group=>matchesFocus(group,focus)):allGroups;
 updateHero(groups,signals,focus);render(groups,focus);
}catch(error){
 console.warn('TDAS Prioridades: dados locais indisponíveis; fallback estático preservado.',error);
 const root=document.querySelector('[data-review-priority-list]');if(root)root.innerHTML='<article class="card panel"><h2>Prioridades locais indisponíveis</h2><p>O site não abriu uma sessão de revisão. Use o Mentor ou o Caderno de erros para escolher o foco e siga a revisão fora do TDAS.</p></article>';
}
