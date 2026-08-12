import { loadJSON, setupShell, fmtNumber, fmtPct, fmtDate, metric, setLoadingError, routes, escapeHTML } from './common.js?v=26.16.1';
import { readPeProgress, summarizeProgress } from './integration/daily-progress.js?v=1.0.0';
import { readModuleState } from './integration/module-store.js?v=2.1.0';
import { readSessionDraft } from './integration/session-draft.js?v=1.0.0';

const BASE = '/sedes-tdas-dashboard/';
const completed = value => /conclu|finaliz|feito|realiz/i.test(String(value || ''));
const normalizePe = value => `PE${String(Number(String(value || '').replace(/\D/g, '')) || 0).padStart(2, '0')}`;
const safeNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const normalizeSearch = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function examCountdown(examDate) {
  const [year, month, day] = examDate.split('-').map(Number);
  const now = new Date();
  return Math.max(0, Math.ceil((Date.UTC(year, month - 1, day) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000));
}
const fmtShortDate = value => value ? new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',timeZone:'America/Sao_Paulo'}).format(new Date(`${value}T12:00:00-03:00`)) : '—';
const nextItem = item => `<a class="tdas-next-item" href="${BASE}estudar/?pe=${encodeURIComponent(normalizePe(item.pe))}"><span class="tdas-next-id">${escapeHTML(normalizePe(item.pe))}</span><span><b>${escapeHTML(item.title || 'Atividade programada')}</b><small>${escapeHTML(fmtShortDate(item.date))} · ${escapeHTML(item.planned_questions || 0)} questões${item.rd ? ` · ${escapeHTML(item.rd)}` : ''}</small></span><span>›</span></a>`;
const checklistItem = item => `<div class="tdas-checkitem ${item.done ? 'done' : ''}"><span class="tdas-checkmark">${item.done ? '✓' : ''}</span><span><b>${escapeHTML(item.title)}</b><small>${escapeHTML(item.detail || '')}</small></span></div>`;
const healthItem = item => `<div class="tdas-health-item" data-level="${escapeHTML(item.level || 'info')}"><i></i><span><b>${escapeHTML(item.title)}</b><span>${escapeHTML(item.detail || '')}</span></span><a href="${escapeHTML(item.href || routes.riscos || BASE+'riscos/')}">${escapeHTML(item.action || 'Abrir')} →</a></div>`;
const errorItem = item => `<a href="${BASE}caderno-erros/?origem=${encodeURIComponent(item.origin || '')}"><b>${escapeHTML(item.title)}</b><span>${escapeHTML(item.subject || 'Caderno de erros')} · ${escapeHTML(item.severity || 'revisar')}</span></a>`;

function performanceSvg(rows=[]){
  const data=rows.slice(-12);if(!data.length)return'<div class="empty">Sem execuções mensuráveis.</div>';
  const W=720,H=240,left=38,right=18,top=18,bottom=36,min=70,max=100;
  const x=i=>data.length===1?W/2:left+(i*(W-left-right)/(data.length-1));
  const y=value=>top+((max-Math.max(min,Math.min(max,safeNumber(value))))/(max-min))*(H-top-bottom);
  const points=data.map((row,i)=>`${x(i).toFixed(1)},${y(row.accuracy).toFixed(1)}`).join(' ');
  const area=`${left},${H-bottom} ${points} ${x(data.length-1).toFixed(1)},${H-bottom}`;
  const grid=[100,90,80,70].map(v=>`<line x1="${left}" y1="${y(v)}" x2="${W-right}" y2="${y(v)}" class="tdas-chart-grid"/><text x="${left-7}" y="${y(v)+3}" text-anchor="end" class="tdas-chart-axis">${v}%</text>`).join('');
  const dots=data.map((row,i)=>`<circle cx="${x(i)}" cy="${y(row.accuracy)}" r="4" class="tdas-chart-point ${safeNumber(row.accuracy)<85?'risk':''}"><title>${escapeHTML(row.pe)} · ${fmtPct(row.accuracy)}</title></circle><text x="${x(i)}" y="${H-12}" text-anchor="middle" class="tdas-chart-label">${escapeHTML(row.pe.replace('PE',''))}</text>`).join('');
  return `<svg class="tdas-performance-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Aproveitamento das últimas 12 execuções"><defs><linearGradient id="tdasGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--pro-violet)"/><stop offset="1" stop-color="var(--pro-violet)" stop-opacity="0"/></linearGradient></defs>${grid}<polygon points="${area}" class="tdas-chart-area"/><polyline points="${points}" class="tdas-chart-line"/>${dots}</svg>`;
}
function weekStrip(currentWeek,weekly=[]){
  const completedWeeks=new Set(weekly.filter(item=>safeNumber(item.completed)>=7).map(item=>safeNumber(item.week)));
  return Array.from({length:16},(_,index)=>{const week=index+1,klass=week===safeNumber(currentWeek)?'active':completedWeeks.has(week)?'done':'';return`<span class="tdas-week-cell ${klass}" title="Semana ${week}">S${String(week).padStart(2,'0')}${klass==='done'?' ✓':klass==='active'?' •':''}</span>`}).join('');
}
function setupSearch(items){
  const input=document.querySelector('[data-pro-search]'),results=document.querySelector('[data-pro-search-results]');if(!input||!results)return;
  let matches=[];let selected=0;
  const render=()=>{const query=normalizeSearch(input.value.trim());if(!query){results.hidden=true;results.innerHTML='';matches=[];return}matches=items.filter(item=>item.search.includes(query)).slice(0,8);selected=0;if(!matches.length){results.innerHTML='<div class="tdas-search-result"><i>⌕</i><span><b>Nenhum resultado direto</b><small>Tente PE88, Português, revisão, redação ou edital.</small></span><span></span></div>';results.hidden=false;return}results.innerHTML=matches.map((item,index)=>`<a class="tdas-search-result ${index===0?'active':''}" href="${item.href}" data-search-index="${index}"><i>${item.icon}</i><span><b>${escapeHTML(item.label)}</b><small>${escapeHTML(item.meta)}</small></span><span>›</span></a>`).join('');results.hidden=false};
  const select=index=>{selected=Math.max(0,Math.min(matches.length-1,index));results.querySelectorAll('[data-search-index]').forEach((node,i)=>node.classList.toggle('active',i===selected));results.querySelector(`[data-search-index="${selected}"]`)?.scrollIntoView({block:'nearest'})};
  input.addEventListener('input',render);input.addEventListener('focus',render);
  input.addEventListener('keydown',event=>{if(event.key==='ArrowDown'&&matches.length){event.preventDefault();select(selected+1)}else if(event.key==='ArrowUp'&&matches.length){event.preventDefault();select(selected-1)}else if(event.key==='Enter'&&matches[selected]){event.preventDefault();location.href=matches[selected].href}else if(event.key==='Escape'){results.hidden=true;input.blur()}});
  document.addEventListener('click',event=>{if(!event.target.closest('.tdas-command-search'))results.hidden=true});
  document.addEventListener('keydown',event=>{if(event.key==='/'&&!/input|textarea|select/i.test(document.activeElement?.tagName||'')){event.preventDefault();input.focus()}});
}

try {
  const [d, todayData, agenda, evolution, edital, subjectsData] = await Promise.all([
    loadJSON('data/home.json'),
    loadJSON('data/today.json'),
    loadJSON('data/agenda.json'),
    loadJSON('data/evolution.json'),
    loadJSON('data/edital-status.json'),
    loadJSON('data/subjects.json')
  ]);
  setupShell('home', d.meta);
  const metrics = d.metrics;
  const days = examCountdown(d.meta.examDate);
  const todayPe = normalizePe(d.today.pe);
  const progress = summarizeProgress(readPeProgress(todayPe));
  const local = readModuleState();
  const draft = readSessionDraft();
  const attempt = (local.attempts || []).find(item => normalizePe(item.peId) === todayPe && item.mode === 'study');
  const currentStarted = Boolean((draft && normalizePe(draft.peId) === todayPe) || attempt || progress.material || progress.questions || progress.registered);
  const overdue = !completed(d.today.status) && !currentStarted && Array.isArray(d.overdue) ? d.overdue[0] : null;
  const focus = overdue || d.today;
  const focusPe = normalizePe(focus.pe);
  const focusQuestions = focus.planned_questions || focus.meta || 0;
  const remaining = Math.max(0, Number(metrics.totalPE || 0) - Number(metrics.completed || 0));
  const todayDone = completed(d.today.status);
  const primaryHref = overdue
    ? `${BASE}estudar/?pe=${encodeURIComponent(focusPe)}`
    : todayDone
      ? `${BASE}revisar/?pe=${encodeURIComponent(todayPe)}`
      : `${BASE}estudar/?pe=${encodeURIComponent(todayPe)}`;
  const primaryLabel = overdue ? `Retomar ${focusPe}` : todayDone ? `Revisar ${todayPe}` : `Continuar ${todayPe}`;
  const secondaryHref = overdue ? `${BASE}estudar/?pe=${encodeURIComponent(todayPe)}` : `${BASE}resolver/?pe=${encodeURIComponent(todayPe)}`;
  const secondaryLabel = overdue ? `Ver ${todayPe}` : 'Questões';
  const statusCopy = overdue
    ? `${focusPe} venceu em ${fmtDate(focus.date)} e ainda está pendente. O progresso iniciado no PE atual continua preservado.`
    : todayDone
      ? `${todayPe} foi concluído. O foco agora é transformar os erros do bloco em revisão útil antes de avançar.`
      : `Material e bateria programados para hoje. Continue exatamente do ponto em que parou no ${todayPe}.`;
  const headline = overdue
    ? `${focusPe} está esperando você. Retome sem reconstruir o contexto.`
    : todayDone
      ? `${todayPe} concluído. Agora feche o aprendizado, não só a tarefa.`
      : `Seu estudo de hoje já sabe qual é o próximo passo.`;
  const completedPct = metrics.totalPE ? Math.min(100, Math.round((safeNumber(metrics.completed) / safeNumber(metrics.totalPE)) * 1000) / 10) : 0;
  const currentAccuracy = safeNumber(d.today.accuracy || (safeNumber(d.today.attempted) ? safeNumber(d.today.acertos) / safeNumber(d.today.attempted) * 100 : 0));
  const upcoming = Array.isArray(agenda.next) ? agenda.next.slice(0,4) : [];
  const checklist = Array.isArray(todayData.checklist) ? todayData.checklist.slice(0,5) : [];
  const alerts = Array.isArray(d.alerts) ? d.alerts.slice(0,3) : [];
  const recentErrors = Array.isArray(todayData.recentErrors) ? todayData.recentErrors.slice(0,3) : [];
  const editalSummary=edital.summary||{};
  const studied=safeNumber(editalSummary.coverage?.studied),totalTopics=safeNumber(editalSummary.total),editalPct=totalTopics?Math.round(studied/totalTopics*100):0;
  const subjectCount=Array.isArray(subjectsData.subjects)?subjectsData.subjects.length:0;
  const currentWeek=safeNumber(d.today.week)||1;

  document.querySelector('main').innerHTML = `
    <section class="tdas-command-search" aria-label="Busca rápida"><div class="tdas-search-shell"><span>⌕</span><input data-pro-search autocomplete="off" placeholder="Buscar PE, matéria, revisão, redação ou área do site…" aria-label="Buscar no TDAS"><kbd>/</kbd></div><div class="tdas-search-results" data-pro-search-results hidden></div></section>

    <section class="hero tdas-home-focus">
      <div class="tdas-home-focus-head"><span class="kicker">Próximo passo</span><span class="tdas-pe-chip">${escapeHTML(focusPe)}</span></div>
      <h1>${escapeHTML(headline)}</h1>
      <p class="tdas-home-focus-copy">${escapeHTML(statusCopy)}</p>
      <div class="hero-actions tdas-home-actions"><a class="btn primary" href="${primaryHref}">${escapeHTML(primaryLabel)}</a><a class="btn" href="${secondaryHref}">${escapeHTML(secondaryLabel)}</a></div>
      <div class="tdas-home-quick"><span>${escapeHTML(focus.status)}</span><span>${escapeHTML(focusQuestions)} questões</span><span>${escapeHTML(focus.type || focus.block || 'Ciclo oficial')}</span><span>Notion → validação GitHub → site</span></div>
      <aside class="tdas-hero-aside" aria-label="Reta final"><small>Prova oficial</small><strong>${fmtNumber(days)}</strong><span>${days === 0 ? 'prova hoje' : `dias · ${fmtDate(d.meta.examDate)}`}</span><div class="tdas-hero-progress"><i style="width:${completedPct}%"></i></div><span>${fmtNumber(metrics.completed)} de ${fmtNumber(metrics.totalPE)} PE concluídos · ${String(completedPct).replace('.',',')}%</span></aside>
    </section>

    <section class="tdas-dashboard-section"><div class="section-head"><div><span class="kicker">Histórico oficial do projeto</span><h2>Dados consolidados do Notion</h2><p>Indicadores de acervo e execução publicados pelo pipeline oficial.</p></div><span class="stamp">Snapshot ${escapeHTML(d.meta.snapshotDate)}</span></div>
      <div class="grid metrics tdas-home-metrics" aria-label="Indicadores principais">
        ${metric('PE concluídos', fmtNumber(metrics.completed), `${remaining} pendentes · ${metrics.totalPE} no ciclo`)}
        ${metric('Questões acumuladas', fmtNumber(metrics.questions), `${fmtNumber(metrics.correct)} acertos registrados`)}
        ${metric('Aproveitamento global', fmtPct(metrics.accuracy), 'média das execuções com resultado')}
        ${metric('Erros catalogados', fmtNumber(metrics.errors), 'base para revisão e risco')}
        ${metric('Redações no banco', fmtNumber(metrics.redactions || 0), 'produção discursiva publicada')}
      </div>
    </section>

    <section class="tdas-dashboard-section"><div class="section-head"><div><h2>Hoje e próximo passo</h2><p>Execução atual à esquerda; sequência imediata do ciclo à direita.</p></div><span class="stamp">Semana ${escapeHTML(d.today.week || '—')} · ${escapeHTML(todayPe)}</span></div>
      <div class="tdas-pro-grid">
        <article class="card tdas-today-card">
          <div class="tdas-today-top"><div class="tdas-today-copy"><span class="kicker">Etapa em foco · ${escapeHTML(fmtDate(d.today.date))}</span><h3>${escapeHTML(d.today.title)}</h3><p>${escapeHTML(d.today.block || '')} · ${escapeHTML(d.today.type || '')}</p><div class="tdas-chip-row"><span class="tdas-chip ${todayDone ? 'good' : ''}">${escapeHTML(d.today.status)}</span><span class="tdas-chip">Meta ${fmtNumber(d.today.attempted || d.today.qe || d.today.meta || 0)}</span><span class="tdas-chip ${safeNumber(d.today.errors) ? 'warn' : 'good'}">${fmtNumber(d.today.errors || 0)} erros</span>${d.today.efficiency ? `<span class="tdas-chip">${escapeHTML(d.today.efficiency)}</span>` : ''}</div></div>
          <div class="tdas-result-ring" style="--value:${Math.max(0,Math.min(100,currentAccuracy))}"><div><strong>${currentAccuracy ? fmtPct(currentAccuracy) : '—'}</strong><span>resultado</span></div></div></div>
          <div class="tdas-checklist">${checklist.length ? checklist.map(checklistItem).join('') : '<div class="tdas-checkitem"><span class="tdas-checkmark"></span><span><b>Execução em andamento</b><small>O progresso local aparece aqui conforme as etapas forem concluídas.</small></span></div>'}</div>
        </article>
        <aside class="card tdas-next-card"><small>Próximos passos</small><div class="tdas-next-list">${upcoming.length ? upcoming.map(nextItem).join('') : '<div class="empty">Nenhuma atividade futura publicada.</div>'}</div></aside>
      </div>
    </section>

    <section class="tdas-dashboard-section"><div class="section-head"><div><h2>Desempenho e cobertura</h2><p>Últimas execuções e posição real dentro das 16 semanas do ciclo.</p></div><a class="stamp" href="${routes.evolucao}">Ver evolução →</a></div>
      <div class="tdas-reference-grid">
        <article class="card tdas-performance-card"><div class="tdas-card-kicker"><div><h3>Últimas 12 execuções</h3><p>Aproveitamento por PE; quedas abaixo de 85% ficam destacadas.</p></div><a href="${routes.evolucao}">Detalhar →</a></div><div class="tdas-performance-chart">${performanceSvg(evolution.actual || [])}</div></article>
        <article class="card tdas-coverage-card"><div class="tdas-card-kicker"><div><h3>16 semanas</h3><p>Cobertura do ciclo oficial.</p></div><span>${currentWeek}/16</span></div><div class="tdas-week-strip">${weekStrip(currentWeek,evolution.weekly || [])}</div><div class="tdas-coverage-summary"><strong>${currentWeek}/16</strong><span>Semana ${currentWeek} em andamento. O histórico concluído fica verde; a semana atual permanece em violeta.</span></div></article>
      </div>
    </section>

    <section class="tdas-dashboard-section"><div class="section-head"><div><h2>Check do Edital e acervo</h2><p>O que já foi coberto, onde existe risco e quais centrais estão disponíveis.</p></div></div>
      <div class="tdas-strategy-grid">
        <article class="card tdas-edital-card"><div class="tdas-card-kicker"><div><h3>Check do Edital · Cargo 202</h3><p>Cobertura concluída; agora o foco é risco de errar.</p></div><a href="${routes.riscos}">Abrir raio-X →</a></div><div class="tdas-edital-progress"><i style="width:${editalPct}%"></i></div><div class="tdas-edital-summary"><div class="tdas-edital-stat"><span>Tópicos</span><strong>${fmtNumber(totalTopics)}</strong></div><div class="tdas-edital-stat"><span>Estudados</span><strong>${fmtNumber(studied)}</strong></div><div class="tdas-edital-stat critical"><span>Críticos</span><strong>${fmtNumber(editalSummary.risk?.critical || 0)}</strong></div><div class="tdas-edital-stat attention"><span>Atenção</span><strong>${fmtNumber(editalSummary.risk?.attention || 0)}</strong></div></div></article>
        <article class="card tdas-acervo-card"><div class="tdas-card-kicker"><div><h3>Acervo operacional</h3><p>Conteúdo, planejamento e registros do TDAS em uma navegação única.</p></div><a href="${BASE}materias/">Explorar →</a></div><div class="tdas-acervo-metrics"><div class="tdas-acervo-metric"><strong>112</strong><span>PE no ciclo</span></div><div class="tdas-acervo-metric"><strong>${fmtNumber(subjectCount)}</strong><span>matérias monitoradas</span></div><div class="tdas-acervo-metric"><strong>${fmtNumber(totalTopics)}</strong><span>tópicos do edital</span></div><div class="tdas-acervo-metric"><strong>${fmtNumber(metrics.errors)}</strong><span>erros catalogados</span></div></div><div class="tdas-acervo-actions"><a class="btn" href="${BASE}materias/">Biblioteca</a><a class="btn" href="${BASE}auditoria/">Bancos de dados</a></div></article>
      </div>
    </section>

    <section class="tdas-dashboard-section"><div class="section-head"><div><h2>O que merece atenção</h2><p>Sinais acionáveis do snapshot oficial e dos erros mais recentes.</p></div></div>
      <div class="tdas-insight-grid">
        <article class="card tdas-insight-card"><h3>Leitura de risco</h3><p>Prioridades derivadas dos dados oficiais publicados.</p><div class="tdas-health-list">${alerts.length ? alerts.map(healthItem).join('') : '<div class="empty">Nenhum alerta prioritário.</div>'}</div></article>
        <article class="card tdas-insight-card"><h3>Erros recentes</h3><p>Últimos pontos que podem voltar em revisão.</p><div class="tdas-error-mini">${recentErrors.length ? recentErrors.map(errorItem).join('') : '<div class="empty">Nenhum erro recente no PE atual.</div>'}</div></article>
      </div>
    </section>

    <section class="section tdas-home-shortcuts"><div class="section-head"><div><h2>Centrais de trabalho</h2><p>Abra só quando precisar aprofundar. A Home continua sendo o ponto de partida.</p></div></div><div class="grid three"><a class="card portal tdas-compact-portal" href="${BASE}revisar/"><small>Praticar</small><b>Revisões</b><span>D+1, D+7, D+20 e reforços pendentes.</span><em>Abrir →</em></a><a class="card portal tdas-compact-portal" href="${routes.redacoes}"><small>Discursiva</small><b>Redações</b><span>Produção, correção e prioridades do Banco Discursivo.</span><em>Abrir →</em></a><a class="card portal tdas-compact-portal" href="${BASE}desempenho/"><small>Analisar</small><b>Progresso</b><span>Desempenho, padrões de erro e tendência do ciclo.</span><em>Abrir →</em></a></div></section>
    <footer class="footer"><span>TDAS · Cargo 202 · central operacional</span><span>Última sincronização <span data-sync></span></span></footer>`;

  const searchItems=[
    {label:'Faça agora',meta:'Central de comando',href:BASE,icon:'⌂'},
    {label:'Resolver questões',meta:'Executar sessão',href:BASE+'resolver/',icon:'▶'},
    {label:'Revisões',meta:'D+1, D+7, D+20 e reforços',href:BASE+'revisar/',icon:'↻'},
    {label:'Caderno de erros',meta:'Corrigir e classificar',href:BASE+'caderno-erros/',icon:'!'},
    {label:'Check do Edital',meta:'Raio-X do Cargo 202',href:BASE+'riscos/',icon:'✓'},
    {label:'Plano PE01–PE112',meta:'Ciclo oficial',href:BASE+'agenda/',icon:'↗'},
    {label:'Biblioteca',meta:'Matérias e conteúdo',href:BASE+'materias/',icon:'▤'},
    {label:'Bancos de dados',meta:'Auditoria e registros',href:BASE+'auditoria/',icon:'▦'},
    {label:'Redações',meta:'Banco discursivo',href:BASE+'redacoes/',icon:'✎'},
    ...(subjectsData.subjects||[]).map(item=>({label:item.subject,meta:`Matéria · ${item.errors} erros catalogados`,href:`${BASE}materias/${item.slug}/`,icon:'▤'})),
    ...Array.from({length:112},(_,index)=>({label:`PE${String(index+1).padStart(2,'0')}`,meta:'Plano de execução',href:`${BASE}estudar/?pe=PE${String(index+1).padStart(2,'0')}`,icon:'◎'})),
    ...(agenda.allFuture||[]).map(item=>({label:`${normalizePe(item.pe)} · ${item.title}`,meta:`${fmtShortDate(item.date)} · ${item.type || 'atividade'}`,href:`${BASE}estudar/?pe=${normalizePe(item.pe)}`,icon:'↗'})),
    ...recentErrors.map(item=>({label:item.title,meta:`Erro · ${item.subject || item.origin}`,href:`${BASE}caderno-erros/?origem=${encodeURIComponent(item.origin||'')}`,icon:'!'}))
  ].map(item=>({...item,search:normalizeSearch(`${item.label} ${item.meta}`)}));
  setupSearch(searchItems);
} catch (error) {
  setLoadingError(error);
}
