import{loadData,setupShell,fmtNumber,fmtPct,fmtDate,metric,routes,countdown,setLoadingError,escapeHTML}from'./common.js?v=20260807.8';
try{
 const d=await loadData();setupShell('home',d.meta);const m=d.metrics,days=countdown(d.meta.examDate),remaining=Math.max(0,m.total-m.completed),progress=m.total?m.completed/m.total*100:0;
 document.querySelector('main').innerHTML=`
 <section class="home-intro"><span class="kicker">Plataforma guiada</span><h1>Início</h1><p>Seu próximo passo no EDAS.</p></section>
 <section class="hero home-guided-hero home-focus-hero">
  <div class="home-focus-head"><span class="home-pill">Próximo passo</span><span class="home-sprint-chip">${escapeHTML(d.today.sprint)}</span></div>
  <h1>${escapeHTML(d.today.sprint)} — ${escapeHTML(d.today.title)}</h1>
  <p class="home-focus-copy">${escapeHTML(d.today.block||'Execute o foco atual, corrija os erros e avance pelo ciclo oficial.')}</p>
  <div class="hero-actions home-focus-actions"><a class="btn primary" href="${routes.hoje}">Continuar ${escapeHTML(d.today.sprint)}</a><a class="btn" href="${routes.resolver}">Questões</a></div>
  <div class="home-quick-meta"><span>⏳ ${days} dias</span><span>${remaining} Sprints restantes</span><span>Prova ${fmtDate(d.meta.examDate)}</span></div>
 </section>
 <section class="grid metrics home-metrics">${metric('Ciclo',`${m.completed}/${m.total}`,`${progress.toFixed(1).replace('.',',')}% concluído`)}${metric('Aproveitamento',fmtPct(m.accuracy),`${fmtNumber(m.correct)}/${fmtNumber(m.questions)} acertos`)}${metric('Questões',fmtNumber(m.questions),'com resultado oficial')}${metric('Erros oficiais',fmtNumber(m.errors),'snapshot preservado')}</section>
 <section class="section home-next"><div class="section-head"><div><h2>Hoje</h2><p>Plano oficial do Sprint em uma única tela.</p></div><span class="stamp">${escapeHTML(d.today.sprint)}</span></div><a class="card home-today-card" href="${routes.hoje}"><div><span class="kicker">${escapeHTML(d.today.status)}</span><h2>${escapeHTML(d.today.title)}</h2><p>${escapeHTML(d.today.review||d.today.block)}</p></div><span class="btn primary">Abrir plano →</span></a></section>
 <section class="section home-shortcuts"><div class="section-head"><div><h2>Acesso rápido</h2><p>O restante da plataforma fica organizado no Menu.</p></div></div><div class="grid three"><a class="card portal compact-portal" href="${routes.revisar}"><small>Praticar</small><b>Revisões</b><span>Prioridade adaptativa e reforços.</span></a><a class="card portal compact-portal" href="${routes.caderno}"><small>Diagnóstico</small><b>Caderno de erros</b><span>Oficial e local separados.</span></a><a class="card portal compact-portal" href="${routes.config}"><small>Sistema</small><b>Configurações</b><span>Sincronização, aplicativo, conforto visual e backup.</span></a></div></section>
 <footer class="footer"><span>EDAS · Administração · Cargo 400</span><span><a href="${routes.config}">Status do sistema</a></span></footer>`;
}catch(error){setLoadingError(error)}
