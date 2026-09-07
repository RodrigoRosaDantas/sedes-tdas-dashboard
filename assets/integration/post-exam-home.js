import {BASE,loadJSON,setupShell,fmtNumber,fmtPct,fmtDate,fmtDateTime,escapeHTML} from '../common.js?v=28.0.0';

const REPOSITORY='RodrigoRosaDantas/sedes-tdas-dashboard';
const WORKFLOW_URL=`https://github.com/${REPOSITORY}/actions/workflows/notion-sync.yml`;
const WORKFLOW_API=`https://api.github.com/repos/${REPOSITORY}/actions/workflows/notion-sync.yml/runs?per_page=1`;
const TRANSITION_PLAN='https://app.notion.com/p/239cf5a2673180a1a2a2df40b502a899';
const number=value=>Number.isFinite(Number(value))?Number(value):0;

function metric(label,value,detail,href=''){
 const content=`<span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong><small>${escapeHTML(detail)}</small>`;
 return href?`<a class="post26-metric" href="${escapeHTML(href)}">${content}<b>›</b></a>`:`<article class="post26-metric">${content}</article>`;
}

function timelineStep(index,title,detail,state='future'){
 const stateLabel=state==='done'?'Concluído':state==='current'?'Próximo':'Depois';
 return `<article class="post26-step ${state}"><div class="post26-step-index">${state==='done'?'✓':String(index).padStart(2,'0')}</div><div><span>${stateLabel}</span><h3>${escapeHTML(title)}</h3><p>${escapeHTML(detail)}</p></div></article>`;
}

function archiveLink(icon,title,detail,href,external=false){
 return `<a class="post26-archive-link" href="${escapeHTML(href)}"${external?' target="_blank" rel="noopener noreferrer"':''}><i>${icon}</i><span><strong>${escapeHTML(title)}</strong><small>${escapeHTML(detail)}</small></span><b>${external?'↗':'›'}</b></a>`;
}

function workflowInfo(run,publishedAt=''){
 const publishedTime=Date.parse(publishedAt||'');
 const runTime=Date.parse(run?.updated_at||run?.run_started_at||run?.created_at||'');
 const hasSnapshot=Number.isFinite(publishedTime);
 if(!run)return hasSnapshot
  ?{tone:'success',title:'Snapshot publicado',detail:`Dados validados em ${fmtDateTime(publishedAt)}.`}
  :{tone:'neutral',title:'Publicação não verificada',detail:'O último snapshot local continua disponível.'};
 if(run.status!=='completed')return{tone:'running',title:'Atualização em andamento',detail:'O GitHub está validando o novo snapshot.'};
 if(run.conclusion==='success')return{tone:'success',title:'Sincronização validada',detail:`Concluída ${fmtDateTime(run.updated_at)}.`};
 if(hasSnapshot&&Number.isFinite(runTime)&&runTime<=publishedTime)return{tone:'success',title:'Snapshot publicado',detail:`Dados validados em ${fmtDateTime(publishedAt)}.`};
 if(hasSnapshot)return{tone:'warning',title:'Snapshot preservado',detail:`A última tentativa não foi promovida; dados de ${fmtDateTime(publishedAt)} continuam ativos.`};
 return{tone:'error',title:'Atualização não promovida',detail:'O snapshot anterior foi preservado.'};
}

function setupSyncStatus(publishedAt=''){
 const root=document.querySelector('[data-post26-sync]');
 const status=root?.querySelector('[data-post26-sync-status]');
 const checkButton=root?.querySelector('[data-post26-sync-check]');
 const openButton=root?.querySelector('[data-post26-sync-open]');
 const guide=root?.querySelector('[data-post26-sync-guide]');
 if(!root||!status)return;
 let timer=0;
 const paint=run=>{
  const info=workflowInfo(run,publishedAt);
  status.dataset.tone=info.tone;
  status.innerHTML=`<i></i><span><strong>${escapeHTML(info.title)}</strong><small>${escapeHTML(info.detail)}</small></span>`;
  return run;
 };
 const check=async()=>{
  try{
   const response=await fetch(`${WORKFLOW_API}&t=${Date.now()}`,{cache:'no-store',headers:{Accept:'application/vnd.github+json'}});
   if(!response.ok)throw new Error(String(response.status));
   const run=(await response.json()).workflow_runs?.[0]||null;
   paint(run);
   if(run?.status==='completed')clearInterval(timer);
   return run;
  }catch{
   paint(null);
   return null;
  }
 };
 checkButton?.addEventListener('click',check);
 openButton?.addEventListener('click',()=>{
  window.open(WORKFLOW_URL,'_blank','noopener,noreferrer');
  if(guide){guide.hidden=false;guide.innerHTML='<strong>Atualização aberta no GitHub.</strong><span>Use <b>Run workflow</b> na branch <b>main</b>. Ao voltar, o site verifica se um novo snapshot foi publicado.</span>';}
  clearInterval(timer);timer=setInterval(check,15000);setTimeout(check,1200);
 });
 window.addEventListener('focus',()=>{if(!document.hidden)check();});
 check();
}

try{
 const[home,edital,subjectsData,platform,syncHistory]=await Promise.all([
  loadJSON('data/home.json'),
  loadJSON('data/edital-status.json'),
  loadJSON('data/subjects.json'),
  loadJSON('data/platform-version.json'),
  loadJSON('data/sync-history.json').catch(()=>({entries:[]}))
 ]);
 setupShell('home',home.meta||{});
 const main=document.querySelector('main');
 if(!main)throw new Error('Área principal não encontrada.');

 const metrics=home.metrics||{};
 const editalSummary=edital.summary||{};
 const editalTotal=number(editalSummary.total||82);
 const editalStudied=number(editalSummary.coverage?.studied);
 const editalPct=editalTotal?editalStudied/editalTotal*100:0;
 const subjects=[...(subjectsData.subjects||[])].sort((a,b)=>number(b.errors)-number(a.errors));
 const topSubject=subjects[0]||{};
 const latestSync=platform.syncAt||syncHistory.entries?.[0]?.at||home.meta?.snapshotDate||'';
 const sourceCommit=platform.sourceCommit&&platform.sourceCommit!=='unknown'?String(platform.sourceCommit).slice(0,7):'—';
 const examDate=home.meta?.examDate||'2026-09-06';
 const completedPes=number(metrics.completed);
 const totalPes=number(metrics.totalPE||112);
 const redactions=number(metrics.redactions);
 const errors=number(metrics.errors);

 document.documentElement.dataset.tdasPhase='post-exam';
 document.documentElement.dataset.postExamHome='2';
 document.body.classList.remove('tdas-dashboard-pro-2026');
 document.body.classList.add('tdas-post-exam-home');

 main.innerHTML=`<div class="post26-home">
  <section class="post26-hero" aria-labelledby="post26-title">
   <div class="post26-hero-copy">
    <span class="post26-eyebrow">SEDES/DF 2026 · TÉCNICO ADMINISTRATIVO · CARGO 202</span>
    <div class="post26-status-pill"><i></i><span>Prova realizada</span><b>${escapeHTML(fmtDate(examDate))}</b></div>
    <h1 id="post26-title">O ciclo terminou. Agora é acompanhar o concurso.</h1>
    <p>A preparação foi encerrada em 06/09/2026. O site agora preserva sua trajetória e acompanha os próximos atos sem transformar PEs, revisões ou erros antigos em novas pendências.</p>
    <div class="post26-hero-actions"><a class="btn primary" href="${BASE}desempenho/">Ver histórico do ciclo</a><a class="btn" href="${TRANSITION_PLAN}" target="_blank" rel="noopener noreferrer">Plano de transição ↗</a></div>
   </div>
   <aside class="post26-next" aria-label="Próximo marco do concurso">
    <div class="post26-next-head"><span>PRÓXIMO MARCO</span><b>Aguardando</b></div>
    <div class="post26-next-number">02</div>
    <h2>Gabarito preliminar</h2>
    <p>Quando houver publicação oficial, o fluxo avança para correção da prova, análise de recursos e resultados.</p>
    <div class="post26-next-note"><i></i><span>Sem data oficial cadastrada. O site não inventa prazo.</span></div>
   </aside>
  </section>

  <section class="post26-summary" aria-label="Fotografia final do ciclo">
   ${metric('PEs concluídos',`${fmtNumber(completedPes)}/${fmtNumber(totalPes)}`,'Ciclo PE01–PE112 encerrado',`${BASE}agenda/`)}
   ${metric('Questões',fmtNumber(metrics.questions||0),'Questões registradas no ciclo',`${BASE}desempenho/`)}
   ${metric('Aproveitamento',fmtPct(metrics.accuracy||0,2),'Indicador histórico publicado',`${BASE}desempenho/`)}
   ${metric('Edital',`${fmtNumber(editalStudied)}/${fmtNumber(editalTotal)}`,`${fmtPct(editalPct,1)} de cobertura`,`${BASE}edital/`)}
  </section>

  <section class="post26-section">
   <header class="post26-section-head"><div><span>LINHA DO TEMPO</span><h2>O que acontece agora</h2><p>O TDAS só muda de etapa quando houver um novo marco oficial.</p></div><a href="${TRANSITION_PLAN}" target="_blank" rel="noopener noreferrer">Ver plano completo ↗</a></header>
   <div class="post26-timeline">
    ${timelineStep(1,'Prova realizada','06/09/2026 · ciclo de preparação encerrado','done')}
    ${timelineStep(2,'Gabarito preliminar','Aguardar publicação oficial para iniciar a correção','current')}
    ${timelineStep(3,'Correção e recursos','Registrar nota estimada e analisar questões recorríveis')}
    ${timelineStep(4,'Gabarito definitivo','Recalcular a prova após alterações ou anulações')}
    ${timelineStep(5,'Resultados','Objetiva e discursiva entram no histórico do concurso')}
    ${timelineStep(6,'Classificação e convocações','Acompanhar posição, chamadas, nomeação e posse')}
   </div>
  </section>

  <section class="post26-lower">
   <article class="post26-final-card">
    <div class="post26-card-head"><div><span>FOTOGRAFIA FINAL</span><h2>O que ficou do ciclo</h2></div><a href="${BASE}desempenho/">Detalhar desempenho →</a></div>
    <p class="post26-lead">Os números abaixo são memória de preparação. Eles servem para analisar a prova e alimentar ciclos futuros — não para criar obrigação de estudo depois da prova.</p>
    <div class="post26-facts">
     <div><span>Erros catalogados</span><strong>${fmtNumber(errors)}</strong><small>Histórico preservado</small></div>
     <div><span>Redações registradas</span><strong>${fmtNumber(redactions)}</strong><small>Banco discursivo do TDAS</small></div>
     <div><span>Maior concentração histórica</span><strong>${escapeHTML(topSubject.subject||'—')}</strong><small>${fmtNumber(topSubject.errors||0)} erros catalogados</small></div>
     <div><span>Snapshot final</span><strong>${escapeHTML(fmtDate(home.meta?.snapshotDate))}</strong><small>Fonte oficial preservada</small></div>
    </div>
    <div class="post26-inline-actions"><a href="${BASE}caderno-erros/">Consultar caderno de erros</a><a href="${BASE}evolucao/">Ver evolução</a></div>
   </article>

   <article class="post26-archive">
    <div class="post26-card-head"><div><span>ARQUIVO DO CICLO</span><h2>Tudo continua acessível</h2></div></div>
    <p class="post26-lead">As ferramentas antigas saíram do centro da Home, mas nada foi apagado.</p>
    <div class="post26-archive-list">
     ${archiveLink('↗','Plano PE01–PE112','Agenda e histórico dos PEs',`${BASE}agenda/`)}
     ${archiveLink('✓','Check do Edital','Cobertura e evidências do Cargo 202',`${BASE}edital/`)}
     ${archiveLink('✎','Redações','Banco discursivo preservado',`${BASE}redacoes/`)}
     ${archiveLink('▤','Biblioteca','Matérias, leis e materiais',`${BASE}materias/`)}
     ${archiveLink('▦','Dados do ciclo','Registros locais e persistência',`${BASE}dados-locais/`)}
     ${archiveLink('◉','Operações','Auditoria, publicação e Notion',`${BASE}auditoria/`)}
    </div>
   </article>
  </section>

  <section class="post26-system" data-post26-sync>
   <div class="post26-system-meta"><span>PUBLICAÇÃO TDAS</span><strong>Snapshot ${escapeHTML(fmtDate(home.meta?.snapshotDate))}</strong><small>Última sincronização: ${escapeHTML(fmtDateTime(latestSync))} · commit ${escapeHTML(sourceCommit)}</small></div>
   <div class="post26-sync-state" data-post26-sync-status data-tone="neutral"><i></i><span><strong>Verificando publicação…</strong><small>Notion → GitHub → site</small></span></div>
   <div class="post26-system-actions"><button type="button" data-post26-sync-check>Verificar</button><button class="primary" type="button" data-post26-sync-open>↻ Atualizar dados</button></div>
   <div class="post26-sync-guide" data-post26-sync-guide hidden></div>
  </section>
 </div>`;

 setupSyncStatus(latestSync);
}catch(error){
 console.error('Home pós-prova TDAS indisponível',error);
 const main=document.querySelector('main');
 if(main)main.innerHTML=`<section class="card panel"><h1>Não foi possível carregar o pós-prova.</h1><p>${escapeHTML(error.message)}</p><button class="btn" type="button" onclick="location.reload()">Tentar novamente</button></section>`;
}
