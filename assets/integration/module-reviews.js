import {BASE,escapeHTML,loadJSON,setupShell} from '../common.js?v=24.1';
import {readModuleState} from './module-store.js?v=2.1.0';

const HANDOFF_TITLE='A revisão pedagógica acontece no ChatGPT.';
const HANDOFF_FLOW='TDAS → ChatGPT → Notion';
const MENTOR_CONTEXT_LABEL='Contexto preservado do Mentor';
const NOTION_HANDOFF_NOTE='O TDAS preserva a evidência, o ChatGPT faz a análise pedagógica e consolida no Notion somente o que precisa permanecer.';
const clean=value=>String(value??'').trim();
const number=value=>Number.isFinite(Number(value))?Number(value):0;
const formatDate=value=>{if(!value)return'—';const date=new Date(Number(value)||value);return Number.isNaN(date.getTime())?'—':new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(date)};
const latestAttempt=attempts=>[...(attempts||[])].sort((a,b)=>Number(b.finishedAt||b.updatedAt||b.createdAt||0)-Number(a.finishedAt||a.updatedAt||a.createdAt||0))[0]||null;
const exportHref=attempt=>attempt?.id?`${BASE}exportar-tentativa/?id=${encodeURIComponent(attempt.id)}`:`${BASE}exportar-tentativa/`;
const evidenceLabel=item=>clean(item?.subassunto||item?.assunto||item?.peId||'Evidência local');

document.documentElement.dataset.reviewHandoff='chatgpt-notion';
const handoff=document.querySelector('[data-review-handoff]');
if(handoff){handoff.dataset.reviewReady='1';handoff.dataset.reviewFlow=HANDOFF_FLOW;const title=handoff.querySelector('h1');if(title&&!clean(title.textContent))title.textContent=HANDOFF_TITLE;}

const params=new URLSearchParams(location.search),legacyReviewId=clean(params.get('review')),mentorFocus=clean(params.get('mentor')),subject=clean(params.get('subject')),focus=mentorFocus||subject;
const contextNode=document.querySelector('[data-review-context]');
const evidenceNode=document.querySelector('[data-review-evidence]');

try{
 const shell=await loadJSON('data/more.json');
 setupShell('mais',shell.meta);
}catch(error){console.warn('TDAS Revisar: shell dinâmico indisponível; fallback estático preservado.',error)}

try{
 const local=readModuleState()||{},reviews=Array.isArray(local.reviews)?local.reviews:[],errors=Array.isArray(local.errors)?local.errors:[],marked=Array.isArray(local.marked)?local.marked:[],attempts=Array.isArray(local.attempts)?local.attempts:[];
 const pending=reviews.filter(item=>item?.status==='pending'),due=pending.filter(item=>number(item.dueAt)<=Date.now()),attempt=latestAttempt(attempts);
 const recent=[...errors].sort((a,b)=>number(b.createdAt)-number(a.createdAt)).slice(0,6);
 if(contextNode){
  contextNode.innerHTML=`<div class="section-head"><div><span class="kicker">${escapeHTML(focus?MENTOR_CONTEXT_LABEL:'Contexto preservado')}</span><h2>${escapeHTML(focus||'Evidências para análise')}</h2><p>${focus?'O foco vindo do Mentor foi preservado para a análise no ChatGPT.':NOTION_HANDOFF_NOTE}</p></div></div><div class="grid metrics"><article class="card metric"><small>Respostas divergentes</small><strong>${errors.length}</strong><span>evidências brutas</span></article><article class="card metric"><small>Marcações</small><strong>${marked.length}</strong><span>itens sinalizados</span></article><article class="card metric"><small>Sinais locais vencidos</small><strong>${due.length}</strong><span>preservados, não preemptivos</span></article></div>${focus?`<article class="card panel"><h3>Levar ao ChatGPT: ${escapeHTML(focus)}</h3><p>${subject&&mentorFocus?`${escapeHTML(subject)} · `:''}Compare respostas divergentes, recorrência e regra envolvida. Classifique a causa real e decida se a intervenção é teoria, lei seca ou nova bateria. ${escapeHTML(NOTION_HANDOFF_NOTE)}</p><div class="hero-actions"><a class="btn primary" href="${attempt?exportHref(attempt):`${BASE}caderno-erros/`}">${attempt?'Preparar última tentativa':'Abrir evidências'}</a><a class="btn" href="${BASE}mentor/">Voltar ao Mentor</a></div></article>`:''}${legacyReviewId?`<p class="muted">Origem legada preservada: ${escapeHTML(legacyReviewId)}.</p>`:''}`;
 }
 if(evidenceNode&&recent.length){
  evidenceNode.hidden=false;
  evidenceNode.innerHTML=`<div class="section-head"><div><h2>Evidências recentes</h2><p>Registros brutos para análise; divergência de gabarito não vira diagnóstico pedagógico automaticamente.</p></div><a class="btn" href="${BASE}caderno-erros/">Ver todas</a></div><div class="grid two">${recent.map(item=>`<article class="card panel"><small>${escapeHTML(item.peId||'Sessão local')} · questão ${escapeHTML(item.numeroOriginal??'—')}${item.createdAt?` · ${escapeHTML(formatDate(item.createdAt))}`:''}</small><h3>${escapeHTML(evidenceLabel(item))}</h3><p>Selecionada: <strong>${escapeHTML(item.selected??'—')}</strong> · gabarito: <strong>${escapeHTML(item.correctAnswer??'—')}</strong></p></article>`).join('')}</div>`;
 }
}catch(error){console.warn('TDAS Revisar: contexto local indisponível; handoff estático preservado.',error)}
