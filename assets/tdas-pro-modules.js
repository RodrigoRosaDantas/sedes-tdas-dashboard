import {readModuleState} from './integration/module-store.js?v=2.1.0';

const BASE='/sedes-tdas-dashboard/';
const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
const fold=value=>clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const path=location.pathname;
const state=()=>{try{return readModuleState()||{}}catch{return{}}};
const latestAttempt=()=>{const items=[...(state().attempts||[])];return items.sort((a,b)=>Number(b.finishedAt||b.updatedAt||b.createdAt||0)-Number(a.finishedAt||a.updatedAt||a.createdAt||0))[0]||null};
const exportHref=attempt=>attempt?.id?`${BASE}exportar-tentativa/?id=${encodeURIComponent(attempt.id)}`:`${BASE}exportar-tentativa/`;

function removeLegacyDecorations(root=document){
 root.querySelectorAll?.('[data-pro-context],[data-pro-scorecard],[data-pro-trail],[data-pro-command],[data-pro-crossnav]').forEach(node=>node.remove());
 document.documentElement.classList.remove('tdas-pro-session');
 delete document.documentElement.dataset.proModule;
}
function replaceText(root,replacements){
 if(!root)return;const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
 for(const node of nodes){let next=node.nodeValue;for(const[rx,value]of replacements)next=next.replace(rx,value);if(next!==node.nodeValue)node.nodeValue=next}
}
function normalizeErrorBook(){
 if(!path.startsWith(BASE+'caderno-erros/'))return;const main=document.querySelector('main');if(!main)return;
 removeLegacyDecorations(main);
 replaceText(main,[
  [/Erros confirmados e questões marcadas nas sessões reais deste módulo\./gi,'Respostas divergentes e questões marcadas nas sessões deste módulo. Valide no ChatGPT antes de consolidar no Notion.'],
  [/(\d+)\s+erros confirmados/gi,'$1 respostas para validar'],
  [/Erros confirmados locais/gi,'Respostas divergentes locais'],
  [/erro(s)? confirmado(s)?/gi,'resposta$1 divergente$2'],
  [/confirmados no player/gi,'registradas no player'],
  [/Próxima ação sugerida/gi,'Próxima análise sugerida'],
  [/Abrir revisões/gi,'Levar ao ChatGPT']
 ]);
 const attempt=latestAttempt();
 main.querySelectorAll('a,button').forEach(el=>{if(/levar ao chatgpt|abrir revis/i.test(clean(el.textContent))){el.textContent='Levar ao ChatGPT →';if(el.tagName==='A')el.href=exportHref(attempt)}});
}
function normalizeHome(){
 if(!(path===BASE||path===BASE+'index.html'||path.startsWith(BASE+'hoje/')))return;const main=document.querySelector('main');if(!main)return;removeLegacyDecorations(main);
 replaceText(main,[
  [/REVISÕES VENCIDAS/g,'RESPOSTAS PARA VALIDAR'],
  [/Revisões vencidas/gi,'Respostas para validar'],
  [/prioridade antes de avançar/gi,'evidência local para análise'],
  [/Há uma revisão local vencida ou disponível\./gi,'Há evidência local pronta para análise no ChatGPT.']
 ]);
 const attempt=latestAttempt();
 main.querySelectorAll('a,button').forEach(el=>{
  const text=clean(el.textContent),href=el.tagName==='A'?el.getAttribute('href')||'':'';
  if(/revisar pe\d+|iniciar revisão|abrir revisões/i.test(text)||/\/revisar\//.test(href)){
   el.textContent=attempt?'Levar ao ChatGPT':'Ver evidências';
   if(el.tagName==='A')el.href=attempt?exportHref(attempt):`${BASE}caderno-erros/`;
  }
 });
}
function normalizeSubjects(){
 if(!path.startsWith(BASE+'materias/'))return;const main=document.querySelector('main');if(!main)return;removeLegacyDecorations(main);
 main.querySelectorAll('[data-pro-scorecard],[data-pro-trail],[data-pro-command],[data-pro-crossnav],[data-pro-context]').forEach(node=>node.remove());
}
function renderReviewHandoff(){
 if(!path.startsWith(BASE+'revisar/'))return;const main=document.querySelector('main');if(!main||main.dataset.tdasReviewHandoff==='1')return;removeLegacyDecorations(main);
 const attempt=latestAttempt();main.dataset.tdasReviewHandoff='1';
 main.innerHTML=`<section class="hero"><span class="kicker">ChatGPT + Notion</span><h1>A revisão pedagógica acontece no ChatGPT.</h1><p>O TDAS executa questões e preserva a evidência bruta. No ChatGPT você classifica a causa, decide o que realmente precisa revisar e consolida o resultado no Notion.</p><div class="hero-actions">${attempt?`<a class="btn primary" href="${exportHref(attempt)}">Analisar última tentativa →</a>`:`<a class="btn primary" href="${BASE}resolver/">Resolver questões →</a>`}<a class="btn" href="${BASE}caderno-erros/">Ver evidências locais</a><a class="btn" href="${BASE}notion/">Ver dados do Notion</a></div></section>`;
}
function redirectLegacyReview(){if(path.startsWith(BASE+'resolver/')&&new URLSearchParams(location.search).has('review'))location.replace(`${BASE}revisar/?origem=legado`)}
function run(){removeLegacyDecorations();normalizeHome();normalizeErrorBook();normalizeSubjects();renderReviewHandoff()}
redirectLegacyReview();
let timer=null;const schedule=()=>{clearTimeout(timer);timer=setTimeout(run,60)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
const target=document.querySelector('main')||document.body;new MutationObserver(schedule).observe(target,{childList:true,subtree:true});
setTimeout(run,350);setTimeout(run,1200);