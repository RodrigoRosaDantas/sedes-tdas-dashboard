import{loadData,setupShell,fmtNumber,fmtPct,fmtDate,metric,routes,countdown,setLoadingError,escapeHTML}from'./common.js?v=20260807.7';
try{
 const d=await loadData();setupShell('home',d.meta);const m=d.metrics,days=countdown(d.meta.examDate),remaining=Math.max(0,m.total-m.completed),progress=m.total?m.completed/m.total*100:0;
 document.querySelector('main').innerHTML=`
 <section class="home-intro"><span class="kicker">Plataforma guiada</span><h1>Início</h1><p>Visão geral do estudo e próximo passo.</p></section>
 <section class="hero home-guided-hero">
  <span class="home-pill">SEDES/DF · Cargo 400</span>
  <h1>Avance um Sprint de cada vez.</h1>
  <p>Use o EDAS para executar o foco atual, revisar erros e acompanhar desempenho sem misturar planejamento com resultado oficial.</p>
  <div class="home-focus-line">Continue pelo <b>${escapeHTML(d.today.sprint)} — ${escapeHTML(d.today.title)}</b>.</div>
  <div class="hero-actions"><a class="btn primary" href="${routes.hoje}">Continuar estudo</a><a class="btn" href="${routes.resolver}">Responder questões</a></div>
  <div class="home-quick-meta"><span>⏳ ${days} dias para a prova</span><span>${remaining} Sprints restantes</span><span>${fmtDate(d.meta.examDate)}</span></div>
 </section>
 <section class="grid metrics home-metrics">${metric('Sprint atual',`${d.today.sprint} · ${m.completed}/${m.total}`,`${progress.toFixed(1).replace('.',',')}% do ciclo objetivo`)}${metric('Questões',fmtNumber(m.questions),'com resultado oficial')}${metric('Acertos',fmtNumber(m.correct),`${fmtPct(m.accuracy)} de aproveitamento`)}${metric('Erros oficiais',fmtNumber(m.errors),'total preservado no snapshot')}</section>
 <section class="section home-next"><div class="section-head"><div><h2>Hoje</h2><p>Resumo do plano oficial, sem informações técnicas do sistema.</p></div><span class="stamp">${escapeHTML(d.today.sprint)}</span></div><a class="card home-today-card" href="${routes.hoje}"><div><span class="kicker">${escapeHTML(d.today.status)}</span><h2>${escapeHTML(d.today.title)}</h2><p>${escapeHTML(d.today.block)}</p></div><span class="btn primary">Abrir plano →</span></a></section>
 <section class="section home-shortcuts"><div class="section-head"><div><h2>Acesso rápido</h2><p>Os demais módulos ficam organizados no Menu.</p></div></div><div class="grid three"><a class="card portal compact-portal" href="${routes.revisar}"><small>Praticar</small><b>Revisões</b><span>Prioridade adaptativa e reforços.</span></a><a class="card portal compact-portal" href="${routes.caderno}"><small>Diagnóstico</small><b>Caderno de erros</b><span>Oficial e local separados.</span></a><a class="card portal compact-portal" href="${routes.config}"><small>Sistema</small><b>Configurações</b><span>Sincronização, aplicativo, fontes e backup.</span></a></div></section>
 <footer class="footer"><span>EDAS · Administração · Cargo 400</span><span><a href="${routes.config}">Status do sistema</a></span></footer>`;
}catch(error){setLoadingError(error)}
