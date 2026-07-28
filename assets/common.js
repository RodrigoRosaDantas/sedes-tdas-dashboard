
export const BASE='/sedes-tdas-dashboard/';
export const routes={home:BASE,hoje:BASE+'hoje/',evolucao:BASE+'evolucao/',riscos:BASE+'riscos/',agenda:BASE+'agenda/',redacoes:BASE+'redacoes/',auditoria:BASE+'auditoria/',mais:BASE+'mais/'};
const icons={home:'⌂',hoje:'◎',evolucao:'↗',riscos:'!',agenda:'◷',redacoes:'✎',auditoria:'✓',mais:'•••'};
const labels={home:'Início',hoje:'Hoje',evolucao:'Evolução',riscos:'Riscos',agenda:'Agenda',redacoes:'Redações',auditoria:'Auditoria',mais:'Mais'};
export async function loadJSON(path){const r=await fetch(BASE+path,{cache:'no-store'});if(!r.ok)throw new Error('Falha ao carregar dados ('+r.status+')');return r.json()}
export function fmtNumber(v){return new Intl.NumberFormat('pt-BR').format(v)}
export function fmtPct(v,d=2){return new Intl.NumberFormat('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d}).format(v)+'%'}
export function fmtDate(iso){if(!iso)return '—';const [y,m,d]=iso.split('-').map(Number);return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(y,m-1,d))}
export function escapeHTML(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
export function setupShell(page,meta){
 const desktop=['home','hoje','evolucao','riscos','agenda','redacoes','auditoria'];
 const mobile=['home','hoje','evolucao','riscos','mais'];
 document.querySelector('#desktop-nav').innerHTML='<div class="nav-label">Plataforma de estudo</div>'+desktop.map(k=>`<a href="${routes[k]}" class="${k===page?'active':''}"><span class="nav-icon">${icons[k]}</span>${labels[k]}</a>`).join('');
 const mobileActive=['agenda','redacoes','auditoria'].includes(page)?'mais':page;
 document.querySelector('#mobile-nav').innerHTML=mobile.map(k=>`<a href="${routes[k]}" class="${k===mobileActive?'active':''}"><span>${icons[k]}</span><span>${labels[k]}</span></a>`).join('');
 document.querySelectorAll('[data-snapshot]').forEach(el=>el.textContent=fmtDate(meta.snapshotDate));
 document.querySelectorAll('[data-sync]').forEach(el=>el.textContent=meta.syncTimes.join(' · '));
 const stored=localStorage.getItem('tdas-theme');if(stored)document.documentElement.dataset.theme=stored;
 if(!document.documentElement.dataset.controlsReady){document.documentElement.dataset.controlsReady='1';document.addEventListener('click',e=>{const theme=e.target.closest('[data-theme-toggle]');if(theme){const next=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=next;localStorage.setItem('tdas-theme',next);theme.setAttribute('aria-label','Alternar para tema '+(next==='light'?'escuro':'claro'));return}const install=e.target.closest('[data-install-button]');if(install)runInstall()})}
 window.addEventListener('online',updateOnline);window.addEventListener('offline',updateOnline);updateOnline();
 if('serviceWorker'in navigator)navigator.serviceWorker.register(BASE+'sw.js?v=19').catch(console.error);
 setupInstall();
}
function updateOnline(){document.querySelector('#offline')?.classList.toggle('show',!navigator.onLine)}
let installPrompt=null;
function setupInstall(){window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;document.querySelectorAll('[data-install]').forEach(x=>x.classList.add('show'))},{once:true})}
async function runInstall(){if(!installPrompt){alert('No navegador, use o menu e escolha “Adicionar à tela inicial” quando essa opção estiver disponível.');return}installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;document.querySelectorAll('[data-install]').forEach(x=>x.classList.remove('show'))}
export function renderLineChart(el,rows,{x='pe',y='accuracy',label='Aproveitamento'}={}){
 if(!rows.length){el.innerHTML='<div class="empty">Sem dados para o filtro selecionado.</div>';return}
 const W=900,H=300,p=42;const vals=rows.map(r=>Number(r[y]));const min=Math.max(0,Math.floor(Math.min(...vals)-5));const max=Math.min(100,Math.ceil(Math.max(...vals)+3));const sx=i=>p+i*(W-2*p)/Math.max(1,rows.length-1);const sy=v=>H-p-(v-min)*(H-2*p)/Math.max(1,max-min);
 const points=rows.map((r,i)=>`${sx(i)},${sy(Number(r[y]))}`).join(' ');
 const grids=[min,(min+max)/2,max].map(v=>`<line x1="${p}" y1="${sy(v)}" x2="${W-p}" y2="${sy(v)}" stroke="var(--line)"/><text x="8" y="${sy(v)+4}" fill="var(--muted)" font-size="12">${v.toFixed(0)}%</text>`).join('');
 const dots=rows.map((r,i)=>`<circle cx="${sx(i)}" cy="${sy(Number(r[y]))}" r="4" fill="var(--green)"><title>${escapeHTML(r[x])}: ${Number(r[y]).toFixed(2)}%</title></circle>`).join('');
 el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHTML(label)}"><title>${escapeHTML(label)}</title>${grids}<polyline fill="none" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" points="${points}"/>${dots}</svg><div class="chart-summary">${rows.length} resultados exibidos. Mínimo ${Math.min(...vals).toFixed(2)}%, máximo ${Math.max(...vals).toFixed(2)}%.</div>`;
}
export function renderBars(el,rows,{labelKey='subject',valueKey='errors',suffix='',maxValue=null}={}){if(!rows.length){el.innerHTML='<div class="empty">Sem dados.</div>';return}const max=maxValue||Math.max(...rows.map(r=>Number(r[valueKey])));el.innerHTML='<div class="bars">'+rows.map(r=>`<div class="bar-row"><span>${escapeHTML(r[labelKey])}</span><div class="bar-track" aria-hidden="true"><div class="bar-fill" style="width:${Math.max(2,Number(r[valueKey])/max*100)}%"></div></div><strong class="bar-value">${escapeHTML(r[valueKey])}${suffix}</strong></div>`).join('')+'</div>'}
export function metric(label,value,detail){return `<article class="card metric"><small>${escapeHTML(label)}</small><strong>${escapeHTML(value)}</strong><span>${escapeHTML(detail)}</span></article>`}
export function alertCard(a){return `<article class="card alert" data-level="${escapeHTML(a.level)}"><span class="alert-icon">${a.level==='critical'?'!':a.level==='warning'?'△':'i'}</span><div><b>${escapeHTML(a.title)}</b><p>${escapeHTML(a.detail)}</p></div>${a.href?`<a href="${a.href}">${escapeHTML(a.action||'Abrir')} →</a>`:''}</article>`}
export function setLoadingError(err){document.querySelector('main').innerHTML=`<section class="card panel"><h1>Não foi possível carregar esta página.</h1><p>${escapeHTML(err.message)}</p><a class="btn" href="${routes.home}">Voltar ao início</a></section>`}
