export const BASE='/sedes-tdas-dashboard/edas-administracao/';
export const routes={home:BASE,hoje:BASE+'hoje/',evolucao:BASE+'evolucao/',riscos:BASE+'riscos/',agenda:BASE+'agenda/',casos:BASE+'estudos-caso/',auditoria:BASE+'auditoria/',mais:BASE+'mais/'};
const icons={home:'⌂',hoje:'◎',evolucao:'↗',riscos:'!',agenda:'◷',casos:'✎',auditoria:'✓',mais:'•••'};
const labels={home:'Início',hoje:'Hoje',evolucao:'Evolução',riscos:'Riscos',agenda:'Agenda',casos:'Estudos de caso',auditoria:'Auditoria',mais:'Mais'};
let installPrompt=null;

window.addEventListener('beforeinstallprompt',event=>{
 event.preventDefault();
 installPrompt=event;
 updateInstallButtons();
});
window.addEventListener('appinstalled',()=>{
 installPrompt=null;
 localStorage.setItem('edas-installed','1');
 updateInstallButtons();
});

export async function loadData(){
 const r=await fetch(BASE+'data/site.json?v=2',{cache:'no-store'});
 if(!r.ok)throw new Error('Falha ao carregar dados ('+r.status+')');
 return r.json();
}
export function fmtNumber(v){return new Intl.NumberFormat('pt-BR').format(v)}
export function fmtPct(v,d=2){return new Intl.NumberFormat('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d}).format(v)+'%'}
export function fmtDate(iso){if(!iso)return'—';const[y,m,d]=iso.split('-').map(Number);return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(y,m-1,d))}
export function escapeHTML(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
export function metric(label,value,detail){return`<article class="card metric"><small>${escapeHTML(label)}</small><strong>${escapeHTML(value)}</strong><span>${escapeHTML(detail)}</span></article>`}
export function alertCard(a){return`<article class="card alert" data-level="${escapeHTML(a.level)}"><span class="alert-icon">${a.level==='critical'?'!':a.level==='warning'?'△':'i'}</span><div><b>${escapeHTML(a.title)}</b><p>${escapeHTML(a.detail)}</p></div>${a.href?`<a href="${a.href}">${escapeHTML(a.action||'Abrir')} →</a>`:''}</article>`}

function isStandalone(){
 return window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
}
function ensureInstallUI(){
 const actions=document.querySelector('.actions');
 if(actions&&!actions.querySelector('[data-install-button]')){
  const button=document.createElement('button');
  button.type='button';
  button.className='btn install-btn';
  button.dataset.installButton='';
  button.textContent='Instalar';
  actions.appendChild(button);
 }
 if(!document.querySelector('#edas-install-fab')){
  const style=document.createElement('style');
  style.textContent='#edas-install-fab{display:none;position:fixed;left:14px;right:14px;bottom:calc(78px + env(safe-area-inset-bottom));z-index:90;align-items:center;justify-content:space-between;gap:12px;padding:12px 13px;border:1px solid color-mix(in srgb,var(--green) 48%,var(--line));border-radius:16px;background:color-mix(in srgb,var(--surface) 96%,transparent);box-shadow:0 16px 45px rgba(0,0,0,.32);backdrop-filter:blur(18px)}#edas-install-fab.show{display:flex}#edas-install-fab span{font-size:11px;color:var(--muted);line-height:1.35}#edas-install-fab b{display:block;color:var(--text);font-size:12px}@media(min-width:781px){#edas-install-fab{display:none!important}}';
  document.head.appendChild(style);
  const banner=document.createElement('div');
  banner.id='edas-install-fab';
  banner.dataset.install='';
  banner.innerHTML='<span><b>Instalar EDAS no celular</b>Acesso rápido e último snapshot disponível offline.</span><button type="button" class="btn primary" data-install-button>Instalar</button>';
  document.body.appendChild(banner);
 }
 updateInstallButtons();
}
function updateInstallButtons(){
 const installed=isStandalone()||localStorage.getItem('edas-installed')==='1';
 document.querySelectorAll('[data-install-button]').forEach(button=>{
  if(installed){button.textContent='Instalado';button.disabled=true;button.hidden=true;return}
  button.hidden=false;
  button.disabled=false;
  button.textContent=installPrompt?'Instalar aplicativo':'Instalar no celular';
 });
 document.querySelectorAll('[data-install]').forEach(banner=>banner.classList.toggle('show',!installed));
}
async function runInstall(){
 if(isStandalone())return;
 if(installPrompt){
  const prompt=installPrompt;
  installPrompt=null;
  prompt.prompt();
  await prompt.userChoice;
  updateInstallButtons();
  return;
 }
 const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
 if(ios){
  alert('No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.');
 }else{
  alert('No Chrome, abra o menu ⋮ e toque em “Instalar app” ou “Adicionar à tela inicial”.');
 }
}
function updateOnline(){document.querySelector('#offline')?.classList.toggle('show',!navigator.onLine)}

export function setupShell(page,meta){
 const desktop=['home','hoje','evolucao','riscos','agenda','casos','auditoria'];
 const mobile=['home','hoje','evolucao','riscos','mais'];
 document.querySelector('#desktop-nav').innerHTML='<div class="nav-label">Plataforma de estudo</div>'+desktop.map(k=>`<a href="${routes[k]}" class="${k===page?'active':''}"><span class="nav-icon">${icons[k]}</span>${labels[k]}</a>`).join('');
 const mobileActive=['agenda','casos','auditoria'].includes(page)?'mais':page;
 document.querySelector('#mobile-nav').innerHTML=mobile.map(k=>`<a href="${routes[k]}" class="${k===mobileActive?'active':''}"><span>${icons[k]}</span><span>${labels[k]}</span></a>`).join('');
 document.querySelectorAll('[data-snapshot]').forEach(el=>el.textContent=fmtDate(meta.snapshotDate));
 document.querySelectorAll('[data-sync]').forEach(el=>el.textContent=meta.syncTimes.join(' · '));
 const stored=localStorage.getItem('edas-theme');if(stored)document.documentElement.dataset.theme=stored;
 ensureInstallUI();
 setTimeout(updateInstallButtons,0);
 if(!document.documentElement.dataset.edasControlsReady){
  document.documentElement.dataset.edasControlsReady='1';
  document.addEventListener('click',event=>{
   const theme=event.target.closest('[data-theme-toggle]');
   if(theme){const next=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=next;localStorage.setItem('edas-theme',next);return}
   const install=event.target.closest('[data-install-button]');
   if(install){runInstall();return}
   const dl=event.target.closest('[data-download]');
   if(dl)download(dl.dataset.download,window.__EDAS_DATA__);
  });
  window.addEventListener('online',updateOnline);
  window.addEventListener('offline',updateOnline);
 }
 updateOnline();
 if('serviceWorker'in navigator){
  navigator.serviceWorker.register(BASE+'sw.js?v=2',{scope:BASE}).then(registration=>registration.update()).catch(console.error);
 }
}
function toCSV(rows){if(!rows.length)return'';const keys=[...new Set(rows.flatMap(Object.keys))];const q=v=>`"${String(v??'').replace(/"/g,'""')}"`;return [keys.map(q).join(','),...rows.map(r=>keys.map(k=>q(r[k])).join(','))].join('\n')}
function download(type,d){
 if(!d)return;
 let name='edas-snapshot.json',mime='application/json;charset=utf-8',content=JSON.stringify(d,null,2);
 if(type==='sprints'){name='edas-sprints.csv';mime='text/csv;charset=utf-8';content=toCSV([{sprint:'S01',data:'2026-07-27',status:'Concluído',questoes:35,acertos:27,aproveitamento:77.14},{sprint:'S02',data:'2026-07-28',status:'Não iniciada',questoes:0,acertos:'',aproveitamento:''}])}
 if(type==='erros'){name='edas-erros.csv';mime='text/csv;charset=utf-8';content=toCSV(d.errorsByBlock||[])}
 if(type==='casos'){name='edas-estudos-de-caso.csv';mime='text/csv;charset=utf-8';content=toCSV(d.cases||[])}
 if(type==='qualidade'){name='edas-qualidade.csv';mime='text/csv;charset=utf-8';content=toCSV(d.quality||[])}
 const blob=new Blob(['\ufeff'+content],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function countdown(iso){const[y,m,d]=iso.split('-').map(Number),now=new Date(),days=Math.max(0,Math.ceil((Date.UTC(y,m-1,d)-Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()))/86400000));return days}
export function setLoadingError(e){document.querySelector('main').innerHTML=`<section class="card panel"><h1>Não foi possível carregar esta página.</h1><p>${escapeHTML(e.message)}</p><a class="btn" href="${routes.home}">Voltar ao início</a></section>`}
