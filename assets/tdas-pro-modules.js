import {readPeProgress,summarizeProgress} from './integration/daily-progress.js?v=1.0.0';

const BASE='/sedes-tdas-dashboard/';
const DRAFT_KEY='tdas.202.question-module.v2.draft';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmt=value=>new Intl.NumberFormat('pt-BR').format(Number(value||0));
const pct=value=>`${Number(value||0).toFixed(1).replace('.',',')}%`;
const peFromUrl=()=>{const raw=new URLSearchParams(location.search).get('pe');if(raw)return`PE${String(Number(String(raw).replace(/\D/g,''))||0).padStart(2,'0')}`;const text=document.querySelector('main .hero h1')?.textContent||'';const hit=text.match(/PE\d{1,3}/i)?.[0];return hit?`PE${String(Number(hit.replace(/\D/g,''))).padStart(2,'0')}`:null};
const pageKey=()=>{const path=location.pathname;if(path.startsWith(BASE+'resolver/'))return'resolver';if(path.startsWith(BASE+'revisar/'))return null;if(path.startsWith(BASE+'caderno-erros/'))return null;if(path.startsWith(BASE+'desempenho/'))return'desempenho';if(path.startsWith(BASE+'estudar/'))return'estudar';if(path.startsWith(BASE+'materias/'))return'materias';return null};
const config={
 resolver:{title:'Resolver questões',caption:'Sessão cega · correção ao finalizar',trail:[['1','Preparar','Ler o bloco'],['2','Resolver','Responder sem gabarito'],['3','Corrigir','Conferir a sessão atual']]},
 desempenho:{title:'Progresso',caption:'Indicadores oficiais · sem histórico pessoal do navegador',trail:[['1','Medir','Dados oficiais'],['2','Diagnosticar','Risco e cobertura'],['3','Agir','Próxima ação']]},
 estudar:{title:'Conteúdo',caption:'Executar · material antes da bateria',trail:[['1','Material','Teoria e lei seca'],['2','Questões','Aplicação cega'],['3','Fechar','Resultado da sessão']]},
 materias:{title:'Biblioteca',caption:'Conteúdo · diagnóstico por matéria',trail:[['1','Escolher','Matéria prioritária'],['2','Diagnosticar','Dados oficiais'],['3','Praticar','Questões']]}
};
function score(label,value,detail='',primary=false){return`<div class="tdas-module-score ${primary?'primary':''}"><small>${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(detail)}</span></div>`}
async function loadOfficialHome(){try{return await fetch(BASE+'data/home.json',{cache:'no-store'}).then(r=>r.ok?r.json():null)}catch{return null}}
async function buildScorecard(key){
 if(key==='resolver'){
  let catalog=null;try{catalog=await fetch(BASE+'data/integration/question-catalog.json',{cache:'no-store'}).then(r=>r.ok?r.json():null)}catch{}
  const draft=(()=>{try{return JSON.parse(localStorage.getItem(DRAFT_KEY)||'null')}catch{return null}})();
  return score('Questões',fmt(catalog?.questions?.length||0),catalog?.peId||'catálogo atual',true)+score('Sessão',draft?'Em andamento':'Pronta',draft?'rascunho local preservado':'nenhuma bateria iniciada')+score('Histórico pessoal','Desativado','resultado final não é acumulado')+score('Revisão','Externa','Prioridades apenas direciona');
 }
 if(key==='desempenho'){
  const home=await loadOfficialHome(),metrics=home?.metrics||{},questions=Number(metrics.resultQuestions??metrics.questions??0),correct=Number(metrics.correct||0),accuracy=metrics.accuracy==null?(questions?correct/questions*100:0):Number(metrics.accuracy||0);
  return score('Aproveitamento oficial',pct(accuracy),questions?`${fmt(correct)}/${fmt(questions)} corretas`:'sem resultado publicado',true)+score('Questões oficiais',fmt(questions),'snapshot validado')+score('Erros oficiais',fmt(metrics.errors||0),'fonte sincronizada')+score('Histórico local','Desativado','não acumula tentativas');
 }
 if(key==='estudar'){
  const pe=peFromUrl(),progress=pe?summarizeProgress(readPeProgress(pe)):null;
  return score('PE',pe||'—',progress?`${progress.completed}/3 etapas`:'ciclo diário',true)+score('Material',progress?.material?'Concluído':'Pendente','etapa 1')+score('Questões',progress?.questions?'Concluídas':'Pendentes','etapa 2')+score('Registro',progress?.registered?'Concluído':'Pendente','etapa 3');
 }
 if(key==='materias'){
  let subjects=[];try{subjects=(await fetch(BASE+'data/subjects.json',{cache:'no-store'}).then(r=>r.ok?r.json():null))?.subjects||[]}catch{}
  const errors=subjects.reduce((sum,item)=>sum+Number(item.errors||0),0),recurrent=subjects.reduce((sum,item)=>sum+Number(item.recurrent||0),0),critical=subjects.reduce((sum,item)=>sum+Number(item.high_critical||0),0);
  return score('Matérias',fmt(subjects.length),'monitoradas',true)+score('Erros',fmt(errors),'histórico oficial')+score('Reincidências',fmt(recurrent),'sinais oficiais')+score('Altos/críticos',fmt(critical),'prioridade');
 }
 return'';
}
function contextBar(key){const cfg=config[key],bar=document.createElement('div');bar.className='tdas-pro-contextbar';bar.dataset.proContext='';bar.innerHTML=`<div><i></i><b>${esc(cfg.title)}</b><span>${esc(cfg.caption)}</span></div><a href="${BASE}">← Faça agora</a>`;return bar}
function trailMarkup(key){return`<div class="tdas-module-trail" data-pro-trail>${config[key].trail.map(([n,title,detail],index)=>`<span class="${index===0?'active':''}"><i>${n}</i><span><b>${esc(title)}</b><small>${esc(detail)}</small></span></span>`).join('')}</div>`}
function crossNav(key){const items=[['resolver','Resolver','Executar questões'],['revisar','Prioridades','Escolher foco'],['caderno','Erros','Consultar registro oficial'],['desempenho','Progresso','Medir e agir']].filter(([id])=>id!==key);const href={resolver:'resolver/',revisar:'revisar/',caderno:'caderno-erros/',desempenho:'desempenho/'};return`<nav class="tdas-pro-crossnav" data-pro-crossnav aria-label="Atalhos do ciclo">${items.map(([id,title,detail])=>`<a href="${BASE}${href[id]}"><small>${esc(detail)}</small><b>${esc(title)} →</b></a>`).join('')}<a href="${BASE}"><small>Central de comando</small><b>Faça agora →</b></a></nav>`}
function nextCommand(key){
 if(key==='desempenho')return{title:'Seu dado já aponta uma prioridade',detail:'Use os indicadores oficiais para decidir o foco. O navegador não acumula tentativas pessoais nem cria fila de revisão.',href:`${BASE}revisar/`,label:'Ver prioridades'};
 if(key==='estudar')return{title:'Não administre o fluxo: execute a sequência',detail:'Material → questões → resultado. Apenas o progresso operacional e a bateria em andamento ficam no dispositivo.',href:`${BASE}resolver/?pe=${encodeURIComponent(peFromUrl()||'')}`,label:'Ir para questões'};
 if(key==='materias')return{title:'Use a biblioteca para decidir, não para passear',detail:'Abra a matéria com maior concentração de sinais oficiais e volte ao ciclo por questões ou prioridades.',href:`${BASE}riscos/`,label:'Ver maior risco'};
 if(key==='resolver')return{title:'Sessão cega preservada',detail:'Responda todo o bloco antes de carregar o gabarito. O rascunho da bateria fica somente neste dispositivo até a finalização.',href:null,label:null};
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
 const command=nextCommand(key);if(command&&!hero.querySelector('[data-pro-command]')){const block=document.createElement('div');block.className='tdas-module-command';block.dataset.proCommand='';block.innerHTML=`<div><small>Próxima ação</small><b>${esc(command.title)}</b><p>${esc(command.detail)}</p></div>${command.href?`<a class="btn primary" href="${command.href}">${esc(command.label)} →</a>`:''}`;hero.appendChild(block)}
 if(!main.querySelector('[data-pro-crossnav]')){const footer=main.querySelector('.footer');if(footer)footer.insertAdjacentHTML('beforebegin',crossNav(key));else main.insertAdjacentHTML('beforeend',crossNav(key))}
}
let scheduled=false;const schedule=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;decorate().catch(error=>console.error('TDAS PRO modules',error))})};
const observer=new MutationObserver(schedule);observer.observe(document.querySelector('main')||document.body,{childList:true,subtree:true});
schedule();
