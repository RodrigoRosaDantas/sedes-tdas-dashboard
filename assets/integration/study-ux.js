const BASE='/sedes-tdas-dashboard/';
const MODULE_KEY='tdas.202.question-module.v2.state';
const CAUSE_KEY='tdas.202.error-causes.v1';
const STYLE_ID='tdas-study-ux-style';
const causes=[
 {id:'knowledge_gap',label:'Não sabia',hint:'Reforçar teoria antes de aumentar o volume.'},
 {id:'concept_confusion',label:'Confundi conceitos',hint:'Comparar conceitos próximos e registrar a diferença.'},
 {id:'forgot_rule',label:'Esqueci a regra',hint:'Criar uma revisão curta da regra ou artigo.'},
 {id:'misread',label:'Interpretei errado',hint:'Treinar leitura do comando e palavras-chave.'},
 {id:'rush',label:'Pressa',hint:'Reduzir velocidade e conferir o comando antes de marcar.'},
 {id:'trap',label:'Pegadinha',hint:'Catalogar o padrão de cobrança para reconhecê-lo mais cedo.'}
];
const causeById=new Map(causes.map(item=>[item.id,item]));
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const readJson=path=>fetch(BASE+path+'?ux='+Date.now(),{cache:'no-store'}).then(response=>response.ok?response.json():null).catch(()=>null);
const readModule=()=>{try{const parsed=JSON.parse(localStorage.getItem(MODULE_KEY)||'null');return parsed&&Array.isArray(parsed.attempts)?parsed:{attempts:[],errors:[],marked:[],reviews:[]}}catch{return{attempts:[],errors:[],marked:[],reviews:[]}}};
const readCauses=()=>{try{const parsed=JSON.parse(localStorage.getItem(CAUSE_KEY)||'null');return parsed?.schemaVersion==='1.0.0'&&parsed.causes&&typeof parsed.causes==='object'?parsed:{schemaVersion:'1.0.0',updatedAt:null,causes:{}}}catch{return{schemaVersion:'1.0.0',updatedAt:null,causes:{}}}};
const writeCause=(errorId,payload)=>{const state=readCauses();state.causes[errorId]={...state.causes[errorId],...payload,errorId,savedAt:Date.now()};state.updatedAt=Date.now();localStorage.setItem(CAUSE_KEY,JSON.stringify(state));return state};
const fmtDateTime=value=>{if(!value)return'—';const date=new Date(value);if(Number.isNaN(date.getTime()))return'—';return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(date).replace(',',' às')};
const completed=value=>/conclu|finaliz|feito|realiz/i.test(String(value||''));
const currentPath=()=>location.pathname.replace(/\/+$/,'/')||'/';

function injectStyle(){
 if(document.getElementById(STYLE_ID))return;
 const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
 .ux-action-strip{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(260px,.65fr);gap:14px;margin-top:14px}.ux-action-card{padding:18px}.ux-action-card h3{margin:.35rem 0}.ux-action-card p{margin:.35rem 0;color:var(--muted)}.ux-action-card .tags{margin-top:.8rem}.ux-sync-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.ux-sync-row .btn{white-space:nowrap}.ux-risk-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:12px}.ux-risk-item{padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--surface)}.ux-risk-item small,.ux-risk-item strong{display:block}.ux-risk-item strong{font-size:1.25rem;margin-top:.2rem}.ux-cause-panel{margin-top:1rem}.ux-cause-list{display:grid;gap:12px}.ux-cause-item{padding:16px;border:1px solid var(--line);border-radius:14px;background:var(--surface)}.ux-cause-item h3{margin:.3rem 0}.ux-cause-buttons{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.ux-cause-buttons .btn{white-space:normal}.ux-cause-buttons .btn.active{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 24%,transparent);background:color-mix(in srgb,var(--accent) 10%,var(--surface))}.ux-cause-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.ux-cause-summary article{padding:14px;border:1px solid var(--line);border-radius:12px;background:var(--surface)}.ux-cause-summary strong{display:block;font-size:1.4rem;margin:.2rem 0}.ux-review-today{margin-top:12px}.ux-review-today .tags{margin-top:.7rem}.tdas-player-focus .sidebar,.tdas-player-focus .topbar,.tdas-player-focus #mobile-nav{display:none!important}.tdas-player-focus .app,.tdas-player-focus .shell{display:block!important;min-height:100vh}.tdas-player-focus .content{width:min(100%,980px);max-width:none;margin:0 auto;padding:clamp(12px,3vw,30px)!important}.tdas-player-focus .pilot-question h1{font-size:clamp(1.15rem,2.3vw,1.65rem);line-height:1.45}.tdas-player-focus .pilot-option{min-height:52px}.tdas-player-focus .pilot-actions{position:sticky;bottom:0;z-index:30;padding:12px;margin:0 -4px;background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(12px);border-top:1px solid var(--line)}.tdas-player-focus .pilot-toolbar{position:sticky;top:0;z-index:20;padding:10px 0;background:color-mix(in srgb,var(--bg) 94%,transparent);backdrop-filter:blur(10px)}.ux-player-save-note{display:block;color:var(--muted);font-size:.82rem;text-align:center;margin-top:.35rem}
 @media(max-width:820px){.ux-action-strip{grid-template-columns:1fr}.ux-risk-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.ux-cause-summary{grid-template-columns:1fr}.ux-cause-buttons .btn{flex:1 1 calc(50% - 8px);min-height:44px}.tdas-player-focus .pilot-actions{padding-bottom:max(12px,env(safe-area-inset-bottom))}}
 @media(max-width:520px){.ux-risk-grid{grid-template-columns:1fr}.ux-cause-buttons .btn{flex-basis:100%}}
 `;document.head.appendChild(style)
}

function latestStudyAttempt(){return [...(readModule().attempts||[])].filter(item=>item.mode==='study').sort((a,b)=>Number(b.finishedAt||0)-Number(a.finishedAt||0))[0]||null}
function errorIdFor(attempt,item){return`error:${attempt.id}:${item.id}`}
function causeStats(){const values=Object.values(readCauses().causes||{}).filter(item=>causeById.has(item.cause));const counts=new Map(causes.map(item=>[item.id,0]));for(const item of values)counts.set(item.cause,(counts.get(item.cause)||0)+1);return{total:values.length,counts,top:[...counts.entries()].sort((a,b)=>b[1]-a[1])[0]||null}}
function causeSummaryMarkup(limit=6){const stats=causeStats();const rows=causes.map(item=>({...item,count:stats.counts.get(item.id)||0})).filter(item=>item.count>0).sort((a,b)=>b.count-a.count).slice(0,limit);if(!rows.length)return'';return`<div class="ux-cause-summary">${rows.map(item=>`<article><small>${esc(item.label)}</small><strong>${item.count}</strong><span>${esc(item.hint)}</span></article>`).join('')}</div>`}

function enhancePlayer(){
 const question=document.querySelector('.pilot-question'),result=document.querySelector('.pilot-result');
 document.documentElement.classList.toggle('tdas-player-focus',Boolean(question));
 if(question&&!question.dataset.uxFocused){
  question.dataset.uxFocused='1';
  const labels={secure:'Sei',doubt:'Tenho dúvida',guess:'Chute'};
  document.querySelectorAll('input[name="module-confidence"]').forEach(input=>{const label=input.closest('label');if(label){const text=[...label.childNodes].find(node=>node.nodeType===Node.TEXT_NODE);if(text)text.textContent=' '+(labels[input.value]||input.value)}});
  const next=document.querySelector('[data-module-next]');if(next)next.textContent='Salvar e próxima →';
  const actions=document.querySelector('.pilot-actions');if(actions&&!actions.querySelector('.ux-player-save-note'))actions.insertAdjacentHTML('afterend','<small class="ux-player-save-note">Resposta e confiança são salvas automaticamente neste dispositivo · correção somente ao finalizar.</small>');
 }
 if(result)enhanceStudyResult(result)
}
function enhanceStudyResult(result){
 if(result.dataset.uxCauses)return;
 const kicker=result.querySelector('.kicker')?.textContent||'';if(!/Resultado local/i.test(kicker))return;
 const attempt=latestStudyAttempt();if(!attempt||!Array.isArray(attempt.questionResults))return;
 const wrong=attempt.questionResults.filter(item=>!item.correct);if(!wrong.length)return;
 result.dataset.uxCauses='1';
 const stored=readCauses().causes||{};
 const section=document.createElement('section');section.className='section ux-cause-panel';section.dataset.errorCausePanel='';
 section.innerHTML=`<div class="section-head"><div><span class="kicker">Diagnóstico do erro</span><h2>Por que você errou?</h2><p>Classifique rapidamente cada erro. Isso não altera o gabarito nem o Notion; serve para descobrir se o problema é conteúdo, confusão, leitura ou execução.</p></div><span class="stamp">${wrong.length} erro${wrong.length===1?'':'s'}</span></div><div class="ux-cause-list">${wrong.map(item=>{const errorId=errorIdFor(attempt,item),selected=stored[errorId]?.cause||'';return`<article class="ux-cause-item" data-error-id="${esc(errorId)}"><small>Questão ${item.numeroOriginal??'—'} · ${esc(attempt.peId||'sessão local')}</small><h3>${esc(item.subassunto||item.assunto||'Sem assunto')}</h3><p>Você marcou <strong>${esc(item.selected||'—')}</strong> · gabarito <strong>${esc(item.correctAnswer||'—')}</strong></p><div class="ux-cause-buttons">${causes.map(cause=>`<button class="btn ${selected===cause.id?'active':''}" type="button" data-error-cause="${cause.id}" data-error-id="${esc(errorId)}" data-attempt-id="${esc(attempt.id)}" data-pe-id="${esc(attempt.peId||'')}" data-question-id="${esc(item.id)}">${esc(cause.label)}</button>`).join('')}</div></article>`}).join('')}</div>`;
 result.after(section)
}

async function enhanceHome(){
 const center=document.querySelector('[data-command-center]');if(!center||center.dataset.uxSummary)return;center.dataset.uxSummary='1';
 const[home,edital,platform]=await Promise.all([readJson('data/home.json'),readJson('data/edital-status.json'),readJson('data/platform-version.json')]);if(!home)return;
 const local=readModule(),now=Date.now(),due=(local.reviews||[]).filter(item=>item.status==='pending'&&Number(item.dueAt)<=now),todayErrors=Math.max(0,Number(home.today?.errors||0)),risk=edital?.summary?.risk||{};
 const officialCompleted=completed(home.today?.status),reviewHint=officialCompleted&&todayErrors?`${todayErrors} erro${todayErrors===1?'':'s'} no ${home.today.pe} · ${home.today.action||'revisão prevista'}`:due.length?`${due.length} revisão${due.length===1?'':'ões'} disponível${due.length===1?'':'is'} neste dispositivo`:'Nenhuma revisão local vencida agora';
 const strip=document.createElement('div');strip.className='ux-action-strip';strip.dataset.uxHomeSummary='';strip.innerHTML=`<article class="card ux-action-card"><small>Risco que merece atenção</small><h3>${esc(reviewHint)}</h3><p>O resumo rápido fica aqui; a análise completa continua em Riscos e Desempenho.</p><div class="ux-risk-grid"><div class="ux-risk-item"><small>Críticos no edital</small><strong>${Number(risk.critical||0)}</strong></div><div class="ux-risk-item"><small>Em atenção</small><strong>${Number(risk.attention||0)}</strong></div><div class="ux-risk-item"><small>Erros do PE</small><strong>${todayErrors}</strong></div><div class="ux-risk-item"><small>Revisões vencidas</small><strong>${due.length}</strong></div></div><div class="hero-actions"><a class="btn primary" href="${todayErrors?`${BASE}questoes-erros/`:`${BASE}revisar/`}">${todayErrors?'Revisar erros':'Abrir revisões'}</a><a class="btn" href="${BASE}riscos/">Ver diagnóstico completo</a></div></article><article class="card ux-action-card"><div class="ux-sync-row"><div><small>Dados oficiais</small><h3>Notion → validação GitHub → site</h3></div><span class="status" data-ux-sync-state>Publicado</span></div><p>Última sincronização efetiva: <strong data-ux-sync-at>${esc(fmtDateTime(platform?.syncAt))}</strong>.</p><p>“Verificar publicação” consulta apenas a versão já publicada; não faz writeback nem expõe token do Notion no navegador.</p><button class="btn" type="button" data-ux-refresh-publication>↻ Verificar publicação</button></article>`;
 center.appendChild(strip)
}

function enhanceReviews(){
 if(!currentPath().startsWith(BASE+'revisar/'))return;const hero=document.querySelector('main .hero');if(!hero||hero.dataset.uxReviewToday)return;hero.dataset.uxReviewToday='1';
 const state=readModule(),now=Date.now(),due=(state.reviews||[]).filter(item=>item.status==='pending'&&Number(item.dueAt)<=now),minutes=Math.max(1,Math.ceil(due.length*1.5));
 const errors=due.filter(item=>['wrong_again','incorrect_confirmed'].includes(item.sourceOutcome||item.outcome||item.classification)).length;
 const uncertainty=due.filter(item=>['unsure','correct_with_doubt','correct_by_guess'].includes(item.sourceOutcome||item.outcome||item.classification)||['doubt','guess'].includes(item.confidence)).length;
 const recurrent=due.filter(item=>Number(item.recurrenceCount||0)>0).length;
 const heading=hero.querySelector('h1');if(heading)heading.textContent=due.length?'Revisão de hoje':'Revisar';
 const primary=hero.querySelector('.hero-actions .btn.primary');if(primary&&due.length)primary.textContent='Iniciar revisão';
 if(due.length){const summary=document.createElement('article');summary.className='card ux-action-card ux-review-today';summary.innerHTML=`<small>Fila montada automaticamente</small><h3>${due.length} ${due.length===1?'item':'itens'} · ~${minutes} min</h3><div class="tags"><span class="tag">${errors} erro/reincidência</span><span class="tag">${uncertainty} dúvida/chute</span><span class="tag">${recurrent} reforço${recurrent===1?'':'s'}</span></div><p>Você não precisa escolher a origem: a fila já respeita atraso, reincidência e risco local.</p>`;hero.appendChild(summary)}
}

function enhanceCauseAnalytics(){
 const path=currentPath(),isBook=path.startsWith(BASE+'caderno-erros/'),isPerformance=path.startsWith(BASE+'desempenho/');if(!isBook&&!isPerformance)return;
 const main=document.querySelector('main'),hero=main?.querySelector('.hero');if(!hero||main.querySelector('[data-cause-analytics]'))return;
 const stats=causeStats();if(!stats.total)return;
 const topId=stats.top?.[1]>0?stats.top[0]:null,top=topId?causeById.get(topId):null;
 const section=document.createElement('section');section.className='section';section.dataset.causeAnalytics='';section.innerHTML=`<div class="section-head"><div><span class="kicker">Causa do erro</span><h2>${isBook?'Por que os erros aconteceram':'Padrão de execução'}</h2><p>Diagnóstico baseado apenas nas classificações que você registrou neste dispositivo.</p></div><span class="stamp">${stats.total} classificado${stats.total===1?'':'s'}</span></div>${causeSummaryMarkup()}${top?`<article class="card ux-action-card"><small>Principal causa registrada</small><h3>${esc(top.label)}</h3><p>${esc(top.hint)}</p></article>`:''}`;hero.after(section)
}

async function refreshPublishedState(button){
 const status=document.querySelector('[data-ux-sync-state]'),time=document.querySelector('[data-ux-sync-at]');if(button){button.disabled=true;button.textContent='Verificando…'}if(status)status.textContent='Verificando';
 const platform=await readJson('data/platform-version.json');if(platform){if(status)status.textContent='Publicado';if(time)time.textContent=fmtDateTime(platform.syncAt)}else if(status)status.textContent=navigator.onLine?'Indisponível':'Offline';if(button){button.disabled=false;button.textContent='↻ Verificar publicação'}
}

let scheduled=false;function enhance(){scheduled=false;injectStyle();enhancePlayer();enhanceReviews();enhanceCauseAnalytics();enhanceHome().catch(error=>console.error('UX Home',error))}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(enhance)}
document.addEventListener('click',event=>{const cause=event.target.closest('[data-error-cause]');if(cause){const errorId=cause.dataset.errorId,def=causeById.get(cause.dataset.errorCause);if(!errorId||!def)return;writeCause(errorId,{cause:def.id,label:def.label,attemptId:cause.dataset.attemptId||'',peId:cause.dataset.peId||'',questionId:cause.dataset.questionId||''});cause.closest('.ux-cause-buttons')?.querySelectorAll('[data-error-cause]').forEach(button=>button.classList.toggle('active',button===cause));return}const refresh=event.target.closest('[data-ux-refresh-publication]');if(refresh)refreshPublishedState(refresh)});
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});window.addEventListener('online',schedule);window.addEventListener('offline',schedule);schedule();
