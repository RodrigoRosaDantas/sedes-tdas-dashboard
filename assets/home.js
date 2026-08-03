import{loadJSON,setupShell,fmtNumber,fmtPct,fmtDate,metric,alertCard,setLoadingError,routes}from'./common.js?v=26.1';

const STUDY_BASE='/sedes-tdas-dashboard/';

function examCountdown(examDate){
 const [year,month,day]=examDate.split('-').map(Number);
 const now=new Date();
 const todayUTC=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
 const examUTC=Date.UTC(year,month-1,day);
 const days=Math.max(0,Math.ceil((examUTC-todayUTC)/86400000));
 const weeks=Math.floor(days/7);
 const extraDays=days%7;
 const parts=[];
 if(weeks)parts.push(`${weeks} ${weeks===1?'semana':'semanas'}`);
 if(extraDays||!weeks)parts.push(`${extraDays} ${extraDays===1?'dia':'dias'}`);
 return{days,detail:parts.join(' e '),headline:days===0?'A prova é hoje':`Faltam ${days} ${days===1?'dia':'dias'} para a prova`};
}

try{
 const d=await loadJSON('data/home.json');
 setupShell('home',d.meta);
 const m=d.metrics;
 const countdown=examCountdown(d.meta.examDate);
 const resultQuestions=m.resultQuestions??m.questions;
 const rdTag=d.today.rd?`<span class="tag">${d.today.rd}</span>`:'';
 document.querySelector('main').innerHTML=`
 <section class="hero">
  <span class="kicker">Plataforma de preparação</span>
  <h1>TDAS — Técnico Administrativo | SEDES/DF</h1>
  <p>Cada ciclo concluído aproxima você da aprovação e da estabilidade que está construindo para sua família. Continue avançando com constância, foco e estratégia.</p>
  <div class="tags" aria-label="Contagem regressiva para a prova">
   <span class="tag">⏳ ${countdown.headline}</span>
   <span class="tag">${countdown.detail}</span>
   <span class="tag">Prova: ${fmtDate(d.meta.examDate)}</span>
  </div>
  <div class="hero-actions"><a class="btn primary" href="${routes.hoje}">Abrir foco de hoje</a><a class="btn" href="${STUDY_BASE}estudar/">Estudar questões</a><a class="btn" href="${routes.evolucao}">Ver evolução</a></div>
  <div class="install-banner" data-install><span><b>Instale como aplicativo</b><br>Abra mais rápido e consulte o último snapshot mesmo sem conexão.</span><button class="btn" data-install-button>Instalar</button></div>
 </section>
 <section class="grid metrics">
  ${metric('PE atual',`${d.today.number}/${m.totalPE}`,`${m.completed} ciclos anteriores cumpridos · hoje é ${d.today.pe}`)}
  ${metric('Questões com resultado',fmtNumber(resultQuestions),'volume efetivamente respondido e lançado')}
  ${metric('Acertos registrados',fmtNumber(m.correct),`${fmtNumber(resultQuestions)} questões com resultado`)}
  ${metric('Aproveitamento',fmtPct(m.accuracy),'somente questões com resultado')}
 </section>
 <section class="section">
  <div class="section-head"><div><h2>Hoje</h2><p>Uma única tela para saber exatamente o que executar.</p></div><span class="stamp">${fmtDate(d.today.date)} · ${d.today.pe}</span></div>
  <div class="grid two">
   <a class="card focus-main" href="${routes.hoje}"><span class="kicker">${d.today.status}</span><h2>${d.today.title}</h2><div class="tags"><span class="tag">${d.today.meta} questões</span><span class="tag">${d.today.block}</span>${rdTag}</div><span class="btn primary">Abrir plano do dia →</span></a>
   <article class="card target"><div><small>Tempo até a prova</small><strong>${countdown.days}</strong><span>${countdown.days===1?'dia restante':'dias restantes'}<br>${countdown.detail} · ${fmtDate(d.meta.examDate)}</span></div></article>
  </div>
 </section>
 <section class="section"><div class="section-head"><div><h2>Áreas da plataforma</h2><p>Os detalhes ficam em páginas independentes e mais leves.</p></div><span class="stamp">Navegação direta</span></div><div class="grid portal-grid"><a class="card portal" href="${STUDY_BASE}estudar/"><small>Módulo de questões</small><b>Estudar</b><span>Resolver, revisar, classificar erros e acompanhar desempenho, sem conteúdo de exemplo.</span><em>Abrir →</em></a><a class="card portal" href="${routes.evolucao}"><small>Desempenho</small><b>Evolução</b><span>Filtros por período e bloco, semanas e simulados.</span><em>Abrir →</em></a><a class="card portal" href="${routes.riscos}"><small>Diagnóstico</small><b>Riscos e erros</b><span>Pareto, reincidências e alertas inteligentes.</span><em>Abrir →</em></a><a class="card portal" href="${routes.agenda}"><small>Execução</small><b>Agenda</b><span>Próximos PE e projeção do ritmo necessário.</span><em>Abrir →</em></a><a class="card portal" href="${routes.redacoes}"><small>Discursiva</small><b>Redações</b><span>Temas, semanas e ritmo de produção.</span><em>Abrir →</em></a><a class="card portal" href="${routes.auditoria}"><small>Governança</small><b>Auditoria</b><span>Qualidade, fontes e downloads reais.</span><em>Abrir →</em></a></div></section>
 <section class="section"><div class="section-head"><div><h2>Alertas prioritários</h2><p>Problema, impacto e próximo passo.</p></div></div><div class="grid three">${d.alerts.map(alertCard).join('')}</div></section>
 <section class="section"><div class="section-head"><div><h2>Projeções transparentes</h2><p>Nenhum índice oculto: a fórmula aparece junto ao resultado.</p></div></div><div class="grid three">${d.projections.map(x=>`<article class="card formula"><small>${x.label}</small><strong>${x.value}</strong><code>${x.formula}</code></article>`).join('')}</div></section>
 <footer class="footer"><span>TDAS · Plataforma v${d.meta.version}</span><span>Sincronização: <span data-sync></span></span></footer>`;
}catch(e){setLoadingError(e)}
