export const BASE='/sedes-tdas-dashboard/';
export const routes={home:BASE,hoje:BASE+'hoje/',estudar:BASE+'estudar/',resolver:BASE+'resolver/',desempenho:BASE+'desempenho/',evolucao:BASE+'evolucao/',riscos:BASE+'riscos/',agenda:BASE+'agenda/',redacoes:BASE+'redacoes/',auditoria:BASE+'auditoria/',mais:BASE+'mais/',pe:BASE+'pe/',materias:BASE+'materias/',questoesErros:BASE+'questoes-erros/'};
const icons={home:'⌂',hoje:'◎',estudar:'▤',resolver:'?',desempenho:'▥',evolucao:'↗',riscos:'!',agenda:'◷',redacoes:'✎',auditoria:'✓',mais:'☰'};
const labels={home:'Início',hoje:'Hoje',estudar:'Estudar',resolver:'Questões',desempenho:'Desempenho',evolucao:'Evolução',riscos:'Riscos',agenda:'Agenda',redacoes:'Redações',auditoria:'Auditoria',mais:'Mais'};
const APP_SHELL_VERSION='26.16.1';
const LAST_PUBLICATION_KEY='tdas-last-publication-meta-v1';
const MAX_PUBLICATION_AGE_MS=8*60*60*1000;
let patchesPromise=null;
let publicationVerified=false;
let verifiedPublication=null;

async function loadPatches(){
 if(!patchesPromise)patchesPromise=Promise.all([
  fetch(BASE+'data/live-v23.json?v='+APP_SHELL_VERSION,{cache:'no-store'}).then(r=>r.ok?r.json():{}).catch(()=>({})),
  fetch(BASE+'data/live-v24.json?v='+APP_SHELL_VERSION,{cache:'no-store'}).then(r=>r.ok?r.json():{}).catch(()=>({}))
 ]);
 return patchesPromise;
}
function patchValue(base,patch){
 if(patch===undefined)return base;
 if(patch===null||typeof patch!=='object')return patch;
 if(Object.prototype.hasOwnProperty.call(patch,'$replace'))return patch.$replace;
 if(Array.isArray(base)){
  let out=[...base],key=patch.$key||'id';
  if(patch.$remove){const remove=new Set(patch.$remove);out=out.filter(item=>!remove.has(item?.[key]));}
  const mergeItems=items=>{for(const item of items||[]){const i=out.findIndex(x=>x&&item&&x[key]===item[key]);if(i>=0)out[i]=patchValue(out[i],item);else out.push(item);}};
  if(patch.$upsert)mergeItems(patch.$upsert);
  if(patch.$prepend){const prepend=[];for(const item of patch.$prepend){const i=out.findIndex(x=>x&&item&&x[key]===item[key]);if(i>=0)out.splice(i,1);prepend.push(item);}out=[...prepend,...out];}
  if(patch.$append)mergeItems(patch.$append);
  if(patch.$sortBy)out.sort((a,b)=>String(a?.[patch.$sortBy]??'').localeCompare(String(b?.[patch.$sortBy]??''),undefined,{numeric:true}));
  if(patch.$takeLast)out=out.slice(-Number(patch.$takeLast));
  if(patch.$limit)out=out.slice(0,Number(patch.$limit));
  return out;
 }
 if(Array.isArray(patch))return patch;
 const out=base&&typeof base==='object'&&!Array.isArray(base)?{...base}:{};
 for(const[k,v]of Object.entries(patch))if(!k.startsWith('$'))out[k]=patchValue(out[k],v);
 return out;
}
export async function loadJSON(path){const r=await fetch(BASE+path,{cache:'no-store'});if(!r.ok)throw new Error('Falha ao carregar dados ('+r.status+')');const data=await r.json();if(path==='data/live-v23.json'||path==='data/live-v24.json')return data;const[legacy,current]=await loadPatches();return patchValue(patchValue(data,legacy[path]),current[path]);}
export function fmtNumber(v){return new Intl.NumberFormat('pt-BR').format(v);}
export function fmtPct(v,d=2){return new Intl.NumberFormat('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d}).format(v)+'%';}
export function fmtDate(iso){if(!iso)return'—';const[y,m,d]=String(iso).slice(0,10).split('-').map(Number);return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(y,m-1,d));}
export function fmtDateTime(iso){if(!iso)return'—';const date=new Date(iso);if(Number.isNaN(date.getTime()))return'—';return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'America/Sao_Paulo'}).format(date).replace(',', ' às');}
export function escapeHTML(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function setText(selector,value){document.querySelectorAll(selector).forEach(el=>el.textContent=value);}
function readStoredPublication(){try{return JSON.parse(localStorage.getItem(LAST_PUBLICATION_KEY)||'null');}catch{return null;}}
function saveStoredPublication(publication){try{localStorage.setItem(LAST_PUBLICATION_KEY,JSON.stringify({syncAt:publication.syncAt||'',platformVersion:publication.platformVersion||'',serviceWorkerVersion:publication.serviceWorkerVersion||''}));}catch{}}
function publicationAge(syncAt){const value=Date.parse(syncAt||'');return Number.isNaN(value)?Infinity:Math.max(0,Date.now()-value);}
function statusForPublication(publication){return publicationAge(publication?.syncAt)<=MAX_PUBLICATION_AGE_MS?'Atualizado':'Atualização atrasada';}
function fallbackTimestamp(meta={}){return fmtDateTime(meta.generatedAt)||'—';}
function applyPublication(publication,{verified=true}={}){
 const syncAt=publication?.syncAt||'';
 setText('[data-last-sync]',syncAt?fmtDateTime(syncAt):'—');
 setText('[data-sync]',syncAt?fmtDateTime(syncAt):'—');
 setText('[data-publication-status]',verified?statusForPublication(publication):navigator.onLine?'Verificação indisponível':'Snapshot offline');
 if(publication?.platformVersion)document.querySelector('.brand small')?.replaceChildren(`SEDES/DF · v${publication.platformVersion}`);
}
function applyOfflinePublication(meta={}){
 const stored=readStoredPublication();
 const fallback=stored?.syncAt?stored:{syncAt:meta.generatedAt||'',platformVersion:stored?.platformVersion||''};
 applyPublication(fallback,{verified:false});
 setText('[data-publication-status]','Snapshot offline');
}
async function refreshPublicationMeta(meta={}){
 setText('[data-publication-status]','Verificando');
 try{
  const response=await fetch(BASE+'data/platform-version.json?v='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw new Error(String(response.status));
  const publication=await response.json();
  if(!publication.syncAt||Number.isNaN(Date.parse(publication.syncAt)))throw new Error('syncAt inválido');
  publicationVerified=true;
  verifiedPublication=publication;
  saveStoredPublication(publication);
  applyPublication(publication,{verified:true});
  if('serviceWorker'in navigator){const version=encodeURIComponent(publication.serviceWorkerVersion||publication.platformVersion||APP_SHELL_VERSION);navigator.serviceWorker.register(BASE+'sw.js?v='+version).catch(console.error);}
 }catch(error){
  publicationVerified=false;
  const stored=readStoredPublication();
  if(stored?.syncAt)applyPublication(stored,{verified:false});
  else{
   const generated=meta.generatedAt||'';
   setText('[data-last-sync]',generated?fmtDateTime(generated):'Verificação indisponível');
   setText('[data-sync]',generated?fmtDateTime(generated):'Verificação indisponível');
   setText('[data-publication-status]',navigator.onLine?'Verificação indisponível':'Snapshot offline');
  }
  if('serviceWorker'in navigator)navigator.serviceWorker.register(BASE+'sw.js?v='+APP_SHELL_VERSION).catch(console.error);
 }
}
function enhanceTabs(root=document){
 const navs=root.matches?.('.rd-tabs:not([data-a11y-ready])')?[root]:[...(root.querySelectorAll?.('.rd-tabs:not([data-a11y-ready])')||[])];
 for(const nav of navs){
  nav.dataset.a11yReady='1';
  const buttons=[...nav.querySelectorAll('[role="tab"][data-tab]')];
  buttons.forEach((button,index)=>{
   const name=button.dataset.tab;const panel=document.querySelector(`[data-panel="${name}"]`);
   const tabId=button.id||`rd-tab-${name}`;const panelId=panel?.id||`rd-panel-${name}`;
   button.id=tabId;button.setAttribute('aria-controls',panelId);
   if(panel){panel.id=panelId;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tabId);panel.tabIndex=-1;}
   button.addEventListener('keydown',event=>{
    const keys=['ArrowLeft','ArrowRight','Home','End'];if(!keys.includes(event.key))return;event.preventDefault();
    let target=index;if(event.key==='ArrowLeft')target=(index-1+buttons.length)%buttons.length;if(event.key==='ArrowRight')target=(index+1)%buttons.length;if(event.key==='Home')target=0;if(event.key==='End')target=buttons.length-1;
    buttons[target].focus();buttons[target].click();
   });
  });
 }
}
function setupTabAccessibility(){
 enhanceTabs();
 if(document.documentElement.dataset.tabObserverReady)return;
 document.documentElement.dataset.tabObserverReady='1';
 new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1)enhanceTabs(node);}).observe(document.body,{childList:true,subtree:true});
}
export function setupShell(page,meta={}){
 const desktop=['home','hoje','evolucao','riscos','agenda','redacoes','auditoria'];
 const mobile=['home','estudar','resolver','desempenho','mais'];
 const active=page==='pe'?'agenda':page==='subject'?'riscos':page;
 document.querySelector('.brand small')?.replaceChildren(`SEDES/DF · v${APP_SHELL_VERSION}`);
 document.querySelector('#desktop-nav').innerHTML='<div class="nav-label">Plataforma de estudo</div>'+desktop.map(k=>`<a href="${routes[k]}" class="${k===active?'active':''}"><span class="nav-icon">${icons[k]}</span>${labels[k]}</a>`).join('');
 const mobileActive=['hoje','agenda','pe','subject'].includes(active)?'estudar':['redacoes'].includes(active)?'resolver':['evolucao','riscos'].includes(active)?'desempenho':['auditoria'].includes(active)?'mais':active;
 document.querySelector('#mobile-nav').innerHTML=mobile.map(k=>`<a href="${routes[k]}" class="${k===mobileActive?'active':''}"><span>${icons[k]}</span><span>${labels[k]}</span></a>`).join('');
 setText('[data-snapshot]',fmtDate(meta.snapshotDate));
 const stored=readStoredPublication();
 const initial=stored?.syncAt?fmtDateTime(stored.syncAt):fallbackTimestamp(meta);
 setText('[data-sync]',initial);
 setText('[data-last-sync]',initial);
 const storedTheme=localStorage.getItem('tdas-theme');if(storedTheme)document.documentElement.dataset.theme=storedTheme;
 if(!document.documentElement.dataset.controlsReady){
  document.documentElement.dataset.controlsReady='1';
  document.addEventListener('click',e=>{
   const theme=e.target.closest('[data-theme-toggle]');
   if(theme){const next=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=next;localStorage.setItem('tdas-theme',next);theme.setAttribute('aria-label','Alternar para tema '+(next==='light'?'escuro':'claro'));return;}
   const install=e.target.closest('[data-install-button]');if(install)runInstall();
  });
 }
 window.addEventListener('online',()=>refreshPublicationMeta(meta));
 window.addEventListener('offline',()=>applyOfflinePublication(meta));
 if(!navigator.onLine)applyOfflinePublication(meta);else refreshPublicationMeta(meta);
 setupInstall();loadV20Enhancements();setupTabAccessibility();
}
function loadV20Enhancements(){if(!document.querySelector('link[data-v20]')){const l=document.createElement('link');l.rel='stylesheet';l.href=BASE+'assets/v20.css?v='+APP_SHELL_VERSION;l.dataset.v20='1';document.head.appendChild(l);}import(BASE+'assets/enhance-v20.js?v='+APP_SHELL_VERSION).catch(console.error);}
let installPrompt=null;
function setupInstall(){window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;document.querySelectorAll('[data-install]').forEach(x=>x.classList.add('show'));},{once:true});}
async function runInstall(){if(!installPrompt){alert('No navegador, use o menu e escolha “Adicionar à tela inicial” quando essa opção estiver disponível.');return;}installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;document.querySelectorAll('[data-install]').forEach(x=>x.classList.remove('show'));}
export function renderLineChart(el,rows,{x='pe',y='accuracy',label='Aproveitamento'}={}){
 if(!rows.length){el.innerHTML='<div class="empty">Sem dados para o filtro selecionado.</div>';return;}
 const W=900,H=300,p=42;const vals=rows.map(r=>Number(r[y]));const min=Math.max(0,Math.floor(Math.min(...vals)-5));const max=Math.min(100,Math.ceil(Math.max(...vals)+3));const sx=i=>p+i*(W-2*p)/Math.max(1,rows.length-1);const sy=v=>H-p-(v-min)*(H-2*p)/Math.max(1,max-min);
 const points=rows.map((r,i)=>`${sx(i)},${sy(Number(r[y]))}`).join(' ');
 const grids=[min,(min+max)/2,max].map(v=>`<line x1="${p}" y1="${sy(v)}" x2="${W-p}" y2="${sy(v)}" stroke="var(--line)"/><text x="8" y="${sy(v)+4}" fill="var(--muted)" font-size="12">${v.toFixed(0)}%</text>`).join('');
 const dots=rows.map((r,i)=>`<circle cx="${sx(i)}" cy="${sy(Number(r[y]))}" r="4" fill="var(--green)"><title>${escapeHTML(r[x])}: ${Number(r[y]).toFixed(2)}%</title></circle>`).join('');
 el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHTML(label)}"><title>${escapeHTML(label)}</title>${grids}<polyline fill="none" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" points="${points}"/>${dots}</svg><div class="chart-summary">${rows.length} resultados exibidos. Mínimo ${Math.min(...vals).toFixed(2)}%, máximo ${Math.max(...vals).toFixed(2)}%.</div>`;
}
export function renderBars(el,rows,{labelKey='subject',valueKey='errors',suffix='',maxValue=null}={}){if(!rows.length){el.innerHTML='<div class="empty">Sem dados.</div>';return;}const max=maxValue||Math.max(...rows.map(r=>Number(r[valueKey])));el.innerHTML='<div class="bars">'+rows.map(r=>`<div class="bar-row"><span>${escapeHTML(r[labelKey])}</span><div class="bar-track" aria-hidden="true"><div class="bar-fill" style="width:${Math.max(2,Number(r[valueKey])/max*100)}%"></div></div><strong class="bar-value">${escapeHTML(r[valueKey])}${suffix}</strong></div>`).join('')+'</div>';}
export function metric(label,value,detail){return`<article class="card metric"><small>${escapeHTML(label)}</small><strong>${escapeHTML(value)}</strong><span>${escapeHTML(detail)}</span></article>`;}
export function alertCard(a){return`<article class="card alert" data-level="${escapeHTML(a.level)}"><span class="alert-icon">${a.level==='critical'?'!':a.level==='warning'?'△':'i'}</span><div><b>${escapeHTML(a.title)}</b><p>${escapeHTML(a.detail)}</p></div>${a.href?`<a href="${a.href}">${escapeHTML(a.action||'Abrir')} →</a>`:''}</article>`;}
export function setLoadingError(err){document.querySelector('main').innerHTML=`<section class="card panel"><h1>Não foi possível carregar esta página.</h1><p>${escapeHTML(err.message)}</p><a class="btn" href="${routes.home}">Voltar ao início</a></section>`;}
