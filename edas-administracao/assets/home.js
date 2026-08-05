import{loadData,setupShell,fmtNumber,fmtPct,fmtDate,metric,alertCard,routes,countdown,setLoadingError,escapeHTML}from'./common.js?v=20260804.1';
try{
 const d=await loadData();setupShell('home',d.meta);const m=d.metrics,days=countdown(d.meta.examDate),remaining=Math.max(0,m.total-m.completed),progress=m.total?m.completed/m.total*100:0;
 document.querySelector('main').innerHTML=`
 <section class="hero">
  <span class="kicker">Plataforma de preparação</span>
  <h1>EDAS — Administração, Cargo 400 | SEDES/DF</h1>
  <p>Cada Sprint concluído fortalece a preparação para a aprovação e a estabilidade que você está construindo para sua família. Continue avançando com constância, foco e estratégia.</p>
  <div class="tags"><span class="tag">⏳ Faltam ${days} dias para a prova</span><span class="tag">Prova: ${fmtDate(d.meta.examDate)}</span><span class="tag">${remaining} Sprints restantes</span></div>
  <div class="hero-actions"><a class="btn primary" href="${routes.hoje}">Abrir foco de hoje</a><a class="btn" href="${routes.estudar}">Estudar</a><a class="btn" href="${routes.evolucao}">Ver evolução</a></div>
  <div class="install-banner" data-install><span><b>Instale como aplicativo</b><br>Abra mais rápido e consulte o último snapshot mesmo sem conexão.</span><button class="btn" data-install-button>Instalar</button></div>
 </section>
 <section class="grid metrics">
  ${metric('Sprint atual',`${d.today.sprint} · ${m.completed}/${m.total}`,`${progress.toFixed(1).replace('.',',')}% do ciclo objetivo`)}
  ${metric('Questões com resultado',fmtNumber(m.questions),'volume efetivamente respondido e lançado')}
  ${metric('Acertos registrados',fmtNumber(m.correct),`${fmtNumber(m.questions)} questões com resultado`)}
  ${metric('Aproveitamento',fmtPct(m.accuracy),'somente questões com resultado')}
 </section>
 <section class="section"><div class="section-head"><div><h2>Hoje</h2><p>Uma única tela para saber exatamente o que executar.</p></div><span class="stamp">${fmtDate(d.today.scheduledDate)} · ${escapeHTML(d.today.sprint)}</span></div><div class="grid two"><a class="card focus-main" href="${routes.hoje}"><span class="kicker">${escapeHTML(d.today.status)}</span><h2>${escapeHTML(d.today.title)}</h2><div class="tags"><span class="tag">até ${fmtNumber(d.today.planned)} questões</span><span class="tag">${escapeHTML(d.today.block)}</span><span class="tag">${escapeHTML(d.today.review)}</span></div><span class="btn primary">Abrir plano do dia →</span></a><article class="card target"><div><small>Tempo até a prova</small><strong>${days}</strong><span>dias restantes<br>${fmtDate(d.meta.examDate)}</span></div></article></div></section>
 <section class="section"><div class="section-head"><div><h2>Áreas da plataforma</h2><p>O fluxo do TDAS foi trazido para o EDAS com dados próprios.</p></div><span class="stamp">Navegação direta</span></div><div class="grid portal-grid"><a class="card portal" href="${routes.estudar}"><small>Módulo operacional</small><b>Estudar</b><span>Material do Sprint, sequência de execução e acesso às questões oficiais.</span><em>Abrir →</em></a><a class="card portal" href="${routes.evolucao}"><small>Desempenho</small><b>Evolução</b><span>Planejado x cumprido, blocos e aproveitamento.</span><em>Abrir →</em></a><a class="card portal" href="${routes.riscos}"><small>Diagnóstico</small><b>Riscos e erros</b><span>Pareto, gravidade, temas e próximos passos.</span><em>Abrir →</em></a><a class="card portal" href="${routes.agenda}"><small>Execução</small><b>Agenda</b><span>S01–S42, atrasos e ritmo necessário.</span><em>Abrir →</em></a><a class="card portal" href="${routes.casos}"><small>Discursiva</small><b>Estudos de caso</b><span>SEC01–SEC12, prontidão e D+1.</span><em>Abrir →</em></a><a class="card portal" href="${routes.auditoria}"><small>Governança</small><b>Auditoria</b><span>Qualidade, fontes, PWA e downloads.</span><em>Abrir →</em></a></div></section>
 <section class="section"><div class="section-head"><div><h2>Alertas prioritários</h2><p>Problema, impacto e próximo passo.</p></div></div><div class="grid three">${(d.alerts||[]).map(alertCard).join('')}</div></section>
 <section class="section"><div class="section-head"><div><h2>Projeções transparentes</h2><p>Nenhum índice oculto: a fórmula aparece junto ao resultado.</p></div></div><div class="grid three">${(d.projections||[]).map(item=>`<article class="card formula"><small>${escapeHTML(item.label)}</small><strong>${escapeHTML(item.value)}</strong><code>${escapeHTML(item.formula)}</code></article>`).join('')}</div></section>
 <footer class="footer"><span>EDAS · Plataforma v${escapeHTML(d.meta.version||'20260804.1')}</span><span>Sincronização: <span data-sync></span></span></footer>`;
}catch(error){setLoadingError(error)}
