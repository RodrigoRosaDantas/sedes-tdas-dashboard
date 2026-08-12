import {readModuleState} from './integration/module-store.js?v=2.1.0';
import {readPeProgress,summarizeProgress} from './integration/daily-progress.js?v=1.0.0';

const BASE='/sedes-tdas-dashboard/';
const CAUSE_KEY='tdas.202.error-causes.v1';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmt=value=>new Intl.NumberFormat('pt-BR').format(Number(value||0));
const pct=value=>`${Number(value||0).toFixed(1).replace('.',',')}%`;
const peFromUrl=()=>{const raw=new URLSearchParams(location.search).get('pe');if(raw)return`PE${String(Number(String(raw).replace(/\D/g,''))||0).padStart(2,'0')}`;const text=document.querySelector('main .hero h1')?.textContent||'';const hit=text.match(/PE\d{1,3}/i)?.[0];return hit?`PE${String(Number(hit.replace(/\D/g,''))).padStart(2,'0')}`:null};
const pageKey=()=>{const path=location.pathname;if(path.startsWith(BASE+'resolver/'))return'resolver';if(path.startsWith(BASE+'revisar/'))return'revisar';if(path.startsWith(BASE+'caderno-erros/'))return'caderno';if(path.startsWith(BASE+'desempenho/'))return'desempenho';if(path.startsWith(BASE+'estudar/'))return'estudar';if(path.startsWith(BASE+'materias/'))return'materias';return null};
const config={
 resolver:{title:'Resolver questões',caption:'Sessão cega · correção ao finalizar',trail:[['1','Preparar','Ler o bloco'],['2','Resolver','Responder sem gabarito'],['3','Corrigir','Classificar e revisar']]},
 revisar:{title:'Revisões',caption:'Reter · priorizar reincidência e atraso',trail:[['1','Fila','Ordenar por risco'],['2','Resolver','Recuperação ativa'],['3','Consolidar','Dominei, dúvida ou novo erro']]},
 caderno:{title:'Caderno de erros',caption:'Corrigir · transformar erro em decisão',trail:[['1','Detectar','Erro confirmado'],['2','Classificar','Causa e reincidência'],['3','Reforçar','Voltar no tempo certo']]},
 desempenho:{title:'Progresso',caption:'Analisar · risco antes de volume',trail:[['1','Medir','Sessões reais'],['2','Diagnosticar','Erro e incerteza'],['3','Agir','Próxima ação']]},
 estudar:{title:'Conteúdo',caption:'Executar · material antes da bateria',trail:[['1','Material','Teoria e lei seca'],['2','Questões','Aplicação cega'],['3','Fechar','Resultado e revisão']]},
 materias:{title:'Biblioteca',caption:'Conteúdo · diagnóstico por matéria',trail:[['1','Escolher','Matéria prioritária'],['2','Revisar','Padrões e conteúdo'],['3','Praticar','Questões e erros']]}
};
function readCauses(){try{const parsed=JSON.parse(localStorage.getItem(CAUSE_KEY)||'null');return parsed?.causes&&typeof parsed.causes==='object'?parsed.causes:{}}catch{return{}}}
function recurrentTopics(errors=[]){const groups=new Map();for(const item of errors){const topic=String(item?.subassunto||item?.assunto||'Sem assunto').trim();const key=topic.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();groups.set(key,(groups.get(key)||0)+1)}return[...groups.values()].filter(count=>count>=2).length}
function dueReviews(state,now=Date.now()){return(state.reviews||[]).filter(item=>item.status==='pending'&&Number(item.dueAt)<=now)}
function completedReviews(state){return(state.reviews||[]).filter(item=>item.status==='completed')}
function attemptStats(state){const attempts=state.attempts||[],questions=attempts.reduce((sum,item)=>sum+Number(item.total||0),0),correct=attempts.reduce((sum,item)=>sum+Number(item.correct||0),0);return{attempts,questions,correct,accuracy:questions?correct/questions*100:0}}
function score(label,value,detail='',primary=false){return`<div class="tdas-module-score ${primary?'primary':''}"><small>${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(detail)}</span></div>`}
async function buildScorecard(key){
 const state=readModuleState(),due=dueReviews(state),completed=completedReviews(state),causes=Object.values(readCauses()),stats=attemptStats(state);
 if(key==='resolver'){
  let catalog=null;try{catalog=await fetch(BASE+'data/integration/question-catalog.json',{cache:'no-store'}).then(r=>r.ok?r.json():null)}catch{}
  const draft=(()=>{try{return JSON.parse(localStorage.getItem('tdas.202.session-draft.v1')||'null')}catch{return null}})();
  return score('Questões',fmt(catalog?.questions?.length||0),catalog?.peId||'catálogo atual',true)+score('Sessão',draft?'Em andamento':'Pronta',draft?'continuidade preservada':'sem resposta iniciada')+score('Tentativas',fmt(stats.attempts.filter(item=>item.mode==='study').length),'neste dispositivo')+score('Revisões vencidas',fmt(due.length),'fila local');
 }
 if(key==='revisar'){
  const future=(state.reviews||[]).filter(item=>item.status==='pending'&&Number(item.dueAt)>Date.now());
  return score('Agora',fmt(due.length),due.length?`~${Math.max(1,Math.ceil(due.length*1.5))} min`:'fila zerada',true)+score('Futuras',fmt(future.length),'já agendadas')+score('Concluídas',fmt(completed.length),'resultado pedagógico')+score('Reincidentes',fmt(due.filter(item=>Number(item.recurrenceCount||0)>0).length),'prioridade maior');
 }
 if(key==='caderno'){
  const errors=state.errors||[],classified=causes.filter(item=>item?.cause).length;
  return score('Erros locais',fmt(errors.length),'confirmados no player',true)+score('Reincidências',fmt(recurrentTopics(errors)),'tópicos repetidos')+score('Causas',fmt(classified),errors.length?`${Math.round(classified/errors.length*100)}% classificados`:'sem erros')+score('Marcações',fmt((state.marked||[]).length),'para revisar');
 }
 if(key==='desempenho')return score('Aproveitamento',pct(stats.accuracy),`${fmt(stats.correct)}/${fmt(stats.questions)} corretas`,true)+score('Tentativas',fmt(stats.attempts.length),'estudo + revisão')+score('Questões',fmt(stats.questions),'respondidas localmente')+score('Revisões vencidas',fmt(due.length),'próxima ação');
 if(key==='estudar'){
  const pe=peFromUrl(),progress=pe?summarizeProgress(readPeProgress(pe)):null,attempt=(state.attempts||[]).find(item=>item.peId===pe&&item.mode==='study');
  return score('PE',pe||'—',progress?`${progress.completed}/3 etapas`:'ciclo diário',true)+score('Material',progress?.material?'Concluído':'Pendente','etapa 1')+score('Questões',progress?.questions||attempt?'Concluídas':'Pendentes','etapa 2')+score('Registro',progress?.registered?'Concluído':'Pendente','etapa 3');
 }
 if(key==='materias'){
  let subjects=[];try{subjects=(await fetch(BASE+'data/subjects.json',{cache:'no-store'}).then(r=>r.ok?r.json():null))?.subjects||[]}catch{}
  const errors=subjects.reduce((sum,item)=>sum+Number(item.errors||0),0),recurrent=subjects.reduce((sum,item)=>sum+Number(item.recurrent||0),0),critical=subjects.reduce((sum,item)=>sum+Number(item.high_critical||0),0);
  return score('Matérias',fmt(subjects.length),'monitoradas',true)+score('Erros',fmt(errors),'histórico oficial')+score('Reincidências',fmt(recurrent),'sinais repetidos')+score('Altos/críticos',fmt(critical),'prioridade');
 }
 return'';
}
function contextBar(key){const cfg=config[key],bar=document.createElement('div');bar.className='tdas-pro-contextbar';bar.dataset.proContext='';bar.innerHTML=`<div><i></i><b>${esc(cfg.title)}</b><span>${esc(cfg.caption)}</span></div><a href="${BASE}">← Faça agora</a>`;return bar}
function trailMarkup(key){return`<div class="tdas-module-trail" data-pro-trail>${config[key].trail.map(([n,title,detail],index)=>`<span class="${index===0?'active':''}"><i>${n}</i><span><b>${esc(title)}</b><small>${esc(detail)}</small></span></span>`).join('')}</div>`}
function crossNav(key){const items=[['resolver','Resolver','Executar questões'],['revisar','Revisar','Fechar retenção'],['caderno','Erros','Entender reincidência'],['desempenho','Progresso','Medir e agir']].filter(([id])=>id!==key);const href={resolver:'resolver/',revisar:'revisar/',caderno:'caderno-erros/',desempenho:'desempenho/'};return`<nav class="tdas-pro-crossnav" data-pro-crossnav aria-label="Atalhos do ciclo">${items.map(([id,title,detail])=>`<a href="${BASE}${href[id]}"><small>${esc(detail)}</small><b>${esc(title)} →</b></a>`).join('')}<a href="${BASE}"><small>Central de comando</small><b>Faça agora →</b></a></nav>`}
function nextCommand(key,state){
 const due=dueReviews(state),errors=state.errors||[];
 if(key==='revisar'&&due.length)return{title:'Feche a fila antes de aumentar o volume',detail:`Há ${due.length} revisão${due.length===1?'':'ões'} disponível${due.length===1?'':'is'} agora.`,href:`${BASE}resolver/?review=${encodeURIComponent(due[0].id)}`,label:'Iniciar revisão'};
 if(key==='caderno'&&recurrentTopics(errors)>0)return{title:'Ataque reincidências antes de seguir',detail:`${recurrentTopics(errors)} tópico${recurrentTopics(errors)===1?'':'s'} reapareceu mais de uma vez neste dispositivo.`,href:`${BASE}revisar/`,label:'Abrir revisões'};
 if(key==='desempenho'&&due.length)return{title:'Seu dado já aponta uma ação',detail:`${due.length} revisão${due.length===1?'':'ões'} vencida${due.length===1?'':'s'} merece${due.length===1?'':'m'} prioridade sobre novas questões.`,href:`${BASE}revisar/`,label:'Resolver pendências'};
 if(key==='estudar')return{title:'Não administre o fluxo: execute a sequência',detail:'Material → questões → resultado. O progresso fica salvo localmente entre as etapas.',href:`${BASE}resolver/?pe=${encodeURIComponent(peFromUrl()||'')}`,label:'Ir para questões'};
 if(key==='materias')return{title:'Use a biblioteca para decidir, não para passear',detail:'Abra a matéria com maior concentração de erros e volte ao ciclo por questões ou revisão.',href:`${BASE}riscos/`,label:'Ver maior risco'};
 if(key==='resolver')return{title:'Sessão cega preservada',detail:'Responda todo o bloco antes de carregar o gabarito. Resposta e confiança são salvas durante a execução.',href:null,label:null};
 return null;
}
async function decorate(){
 const key=pageKey();if(!key)return;document.documentElement.dataset.proModule=key;
 const main=document.querySelector('main');if(!main)return;const hero=main.querySelector('.hero');if(!hero||/Carregando/i.test(main.textContent))return;
 const playerActive=key==='resolver'&&Boolean(main.querySelector('.pilot-question'));
 document.documentElement.classList.toggle('tdas-pro-session',playerActive);
 if(playerActive)return;
 if(!main.querySelector('[data-pro-context]'))main.prepend(contextBar(key));
 if(!hero.querySelector('[data-pro-scorecard]')){const card=document.createElement('div');card.className='tdas-module-scorecard';card.dataset.proScorecard='';card.innerHTML=await buildScorecard(key);if(card.innerHTML.trim())hero.appendChild(card)}
 if(!hero.querySelector('[data-pro-trail]'))hero.insertAdjacentHTML('beforeend',trailMarkup(key));
 const state=readModuleState(),command=nextCommand(key,state);if(command&&!hero.querySelector('[data-pro-command]')){const block=document.createElement('div');block.className='tdas-module-command';block.dataset.proCommand='';block.innerHTML=`<div><small>Próxima ação</small><b>${esc(command.title)}</b><p>${esc(command.detail)}</p></div>${command.href?`<a class="btn primary" href="${command.href}">${esc(command.label)} →</a>`:''}`;hero.appendChild(block)}
 if(!main.querySelector('[data-pro-crossnav]')){const footer=main.querySelector('.footer');if(footer)footer.insertAdjacentHTML('beforebegin',crossNav(key));else main.insertAdjacentHTML('beforeend',crossNav(key))}
}
let scheduled=false;const schedule=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;decorate().catch(error=>console.error('TDAS PRO modules',error))})};
const observer=new MutationObserver(schedule);observer.observe(document.querySelector('main')||document.body,{childList:true,subtree:true});
schedule();
