import {readDiagnosticState} from './edital-diagnostic.js?v=1.0.0';
import {buildDiagnosticSequence,diagnosticUrlForTopic} from './edital-evidence-runtime.js?v=1.1.0';
import {readModuleState} from './module-store.js?v=2.1.0';

const BASE='/sedes-tdas-dashboard/';
const text=value=>String(value??'').trim();
const safe=value=>text(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const completed=value=>/conclu|finaliz|feito|realiz/i.test(text(value));
const restDay=today=>/descanso|folga/i.test(`${text(today?.status)} ${text(today?.title)} ${text(today?.block)}`);
const dayKey=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
const waitFor=(selector,timeout=15000)=>new Promise(resolve=>{const found=document.querySelector(selector);if(found)return resolve(found);const observer=new MutationObserver(()=>{const node=document.querySelector(selector);if(node){observer.disconnect();resolve(node)}});observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>{observer.disconnect();resolve(null)},timeout)});

export function buildDailyDiagnosticBudget({home={},sequence={},diagnosticState={attempts:[]},moduleState={reviews:[]},primaryStage='',primaryLabel='',primaryHref='',now=Date.now()}={}){
 const today=home.today||{},overdue=Array.isArray(home.overdue)?home.overdue[0]||null:null;
 const dueReviews=(moduleState.reviews||[]).filter(item=>item?.status==='pending'&&Number(item.dueAt||0)<=now).length;
 const todayKey=dayKey(now),diagnosticsToday=(diagnosticState.attempts||[]).filter(item=>item?.target?.source==='edital'&&Number(item.finishedAt||0)>0&&dayKey(item.finishedAt)===todayKey).length;
 const next=sequence.next||sequence.ready?.[0]||null;
 const blockedStages=new Set(['material','questions','registered','review','redaction','official-reviews','overdue']);
 const href=primaryHref||`${BASE}estudar/?pe=${encodeURIComponent(text(overdue?.pe||today.pe))}`;
 if(overdue)return Object.freeze({status:'blocked-overdue',allowed:false,slots:0,title:`${text(overdue.pe)||'PE atrasado'} vem antes de bateria extra`,detail:`${text(overdue.title)||'Há uma atividade oficial atrasada.'}${overdue.planned_questions?` · ${overdue.planned_questions} questões previstas.`:''}`,action:text(primaryLabel)||`Retomar ${text(overdue.pe)}`,href,next,diagnosticsToday,dueReviews,overduePe:text(overdue.pe)});
 if(dueReviews)return Object.freeze({status:'blocked-review',allowed:false,slots:0,title:`${dueReviews} revisão${dueReviews===1?'':'ões'} antes de nova bateria`,detail:'A fila diagnóstica fica preservada; primeiro feche as revisões já vencidas.',action:text(primaryLabel)||'Abrir revisões',href:primaryStage==='review'&&primaryHref?primaryHref:`${BASE}revisar/`,next,diagnosticsToday,dueReviews,overduePe:null});
 if(restDay(today))return Object.freeze({status:'blocked-rest',allowed:false,slots:0,title:'Preserve o descanso programado',detail:`${text(today.pe)||'Hoje'} · ${text(today.title)||'descanso previsto no ciclo'}. Nenhuma bateria diagnóstica adicional é necessária.`,action:'Ver sequência futura',href:`${BASE}edital/`,next,diagnosticsToday,dueReviews,overduePe:null});
 if(blockedStages.has(primaryStage)||(!completed(today.status)&&Number(today.meta||0)>0))return Object.freeze({status:'blocked-official',allowed:false,slots:0,title:'Conclua a ação oficial antes de diagnosticar',detail:text(primaryLabel)||`${text(today.pe)||'PE atual'} ainda possui execução pendente.`,action:text(primaryLabel)||'Continuar estudo',href,next,diagnosticsToday,dueReviews,overduePe:null});
 if(diagnosticsToday>=1)return Object.freeze({status:'daily-cap',allowed:false,slots:0,title:'Bateria diagnóstica do dia já realizada',detail:'Limite operacional: uma bateria diagnóstica por dia. A sequência continua preservada para o próximo dia útil.',action:'Ver sequência futura',href:`${BASE}edital/`,next,diagnosticsToday,dueReviews,overduePe:null});
 if(!next)return Object.freeze({status:'no-queue',allowed:false,slots:0,title:'Nenhuma bateria diagnóstica necessária hoje',detail:'A fila está em cooldown ou já possui amostra privada suficiente neste momento.',action:'Ver evidências',href:`${BASE}edital/`,next:null,diagnosticsToday,dueReviews,overduePe:null});
 return Object.freeze({status:'available',allowed:true,slots:1,title:'1 bateria diagnóstica cabe hoje',detail:`${text(next.item?.topic)} · ${next.suggestedCount} questões. ${text(next.reason)}`,action:`Aferir ${next.suggestedCount} questões`,href:diagnosticUrlForTopic(next.item,next.suggestedCount),next,diagnosticsToday,dueReviews,overduePe:null});
}

async function loadJSON(path){const response=await fetch(BASE+path,{cache:'no-store'});if(!response.ok)throw new Error(`Falha ao carregar ${path}`);return response.json()}

async function mount(){
 const section=await waitFor('[data-edital-evidence-home]');
 const center=await waitFor('[data-command-center]');
 if(!section||!center||section.dataset.dailyDiagnosticBudget)return;
 const [home,edital]=await Promise.all([loadJSON('data/home.json'),loadJSON('data/edital-status.json')]);
 const diagnosticState=readDiagnosticState(),moduleState=readModuleState(),sequence=buildDiagnosticSequence({edital,diagnosticState});
 const action=center.querySelector('[data-continue-action]');
 const budget=buildDailyDiagnosticBudget({home,sequence,diagnosticState,moduleState,primaryStage:center.dataset.primaryStage||'',primaryLabel:text(action?.textContent).replace(/\s*→\s*$/,''),primaryHref:action?.href||''});
 const next=budget.next,after=sequence.ready.filter(row=>row.canonicalId!==next?.canonicalId).slice(0,2);
 section.dataset.dailyDiagnosticBudget=budget.status;
 section.innerHTML=`<div class="section-head"><div><span class="kicker">Agenda diagnóstica de hoje</span><h2>${safe(budget.title)}</h2><p>${safe(budget.detail)}</p>${!budget.allowed&&next?`<small>Quando liberar: ${safe(next.item.topic)} · ${next.suggestedCount} questões.</small>`:after.length?`<small>Depois: ${after.map(row=>safe(row.item.topic)).join(' · ')}</small>`:''}</div><div class="hero-actions"><a class="btn ${budget.allowed?'primary':''}" href="${safe(budget.href)}">${safe(budget.action)}${budget.allowed?' →':''}</a><a class="btn" href="${BASE}edital/">Ver sequência</a></div></div>`;
}

if(typeof window!=='undefined'&&typeof document!=='undefined')mount().catch(error=>console.warn('Orçamento diário diagnóstico indisponível:',error));
