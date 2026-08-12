import { loadJSON, setupShell, fmtNumber, fmtPct, fmtDate, metric, setLoadingError, routes, escapeHTML } from './common.js?v=26.16.1';
import { readPeProgress, summarizeProgress } from './integration/daily-progress.js?v=1.0.0';
import { readModuleState } from './integration/module-store.js?v=2.1.0';
import { readSessionDraft } from './integration/session-draft.js?v=1.0.0';

const BASE = '/sedes-tdas-dashboard/';
const completed = value => /conclu|finaliz|feito|realiz/i.test(String(value || ''));
const normalizePe = value => `PE${String(Number(String(value || '').replace(/\D/g, '')) || 0).padStart(2, '0')}`;
const safeNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;
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

try {
  const [d, todayData, agenda] = await Promise.all([
    loadJSON('data/home.json'),
    loadJSON('data/today.json'),
    loadJSON('data/agenda.json')
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

  document.querySelector('main').innerHTML = `
    <section class="hero tdas-home-focus">
      <div class="tdas-home-focus-head"><span class="kicker">Próximo passo</span><span class="tdas-pe-chip">${escapeHTML(focusPe)}</span></div>
      <h1>${escapeHTML(headline)}</h1>
      <p class="tdas-home-focus-copy">${escapeHTML(statusCopy)}</p>
      <div class="hero-actions tdas-home-actions"><a class="btn primary" href="${primaryHref}">${escapeHTML(primaryLabel)}</a><a class="btn" href="${secondaryHref}">${escapeHTML(secondaryLabel)}</a></div>
      <div class="tdas-home-quick"><span>${escapeHTML(focus.status)}</span><span>${escapeHTML(focusQuestions)} questões</span><span>${escapeHTML(focus.type || focus.block || 'Ciclo oficial')}</span><span>Notion → validação GitHub → site</span></div>
      <aside class="tdas-hero-aside" aria-label="Reta final"><small>Até a prova</small><strong>${fmtNumber(days)}</strong><span>${days === 0 ? 'prova hoje' : `dias · ${fmtDate(d.meta.examDate)}`}</span><div class="tdas-hero-progress"><i style="width:${completedPct}%"></i></div><span>${fmtNumber(metrics.completed)} de ${fmtNumber(metrics.totalPE)} PE concluídos · ${String(completedPct).replace('.',',')}%</span></aside>
    </section>

    <section class="grid metrics tdas-home-metrics" aria-label="Indicadores principais">
      ${metric('PE concluídos', fmtNumber(metrics.completed), `${remaining} pendentes · ${metrics.totalPE} no ciclo`)}
      ${metric('Questões', fmtNumber(metrics.questions), 'volume acumulado com resultado')}
      ${metric('Aproveitamento', fmtPct(metrics.accuracy), `${fmtNumber(metrics.correct)} acertos registrados`)}
      ${metric('Erros catalogados', fmtNumber(metrics.errors), 'base para revisão e risco')}
      ${metric('PE atual', todayPe, `${escapeHTML(d.today.status)} · ${fmtNumber(d.today.meta)} previstas`)}
    </section>

    <section class="tdas-dashboard-section"><div class="section-head"><div><h2>Hoje e próximo passo</h2><p>Execução atual à esquerda; sequência imediata do ciclo à direita.</p></div><span class="stamp">Semana ${escapeHTML(d.today.week || '—')} · ${escapeHTML(todayPe)}</span></div>
      <div class="tdas-pro-grid">
        <article class="card tdas-today-card">
          <div class="tdas-today-top"><div class="tdas-today-copy"><span class="kicker">${escapeHTML(d.today.type || 'Execução')}</span><h3>${escapeHTML(d.today.title)}</h3><p>${escapeHTML(d.today.block || '')} · ${escapeHTML(d.today.source || '')}</p><div class="tdas-chip-row"><span class="tdas-chip ${todayDone ? 'good' : ''}">${escapeHTML(d.today.status)}</span><span class="tdas-chip">${fmtNumber(d.today.attempted || d.today.qe || 0)} respondidas</span><span class="tdas-chip ${safeNumber(d.today.errors) ? 'warn' : 'good'}">${fmtNumber(d.today.errors || 0)} erros</span>${d.today.efficiency ? `<span class="tdas-chip">${escapeHTML(d.today.efficiency)}</span>` : ''}</div></div>
          <div class="tdas-result-ring" style="--value:${Math.max(0,Math.min(100,currentAccuracy))}"><div><strong>${currentAccuracy ? fmtPct(currentAccuracy) : '—'}</strong><span>aproveitamento</span></div></div></div>
          <div class="tdas-checklist">${checklist.length ? checklist.map(checklistItem).join('') : '<div class="tdas-checkitem"><span class="tdas-checkmark"></span><span><b>Execução em andamento</b><small>O progresso local aparece aqui conforme as etapas forem concluídas.</small></span></div>'}</div>
        </article>
        <aside class="card tdas-next-card"><small>Próximos PE</small><div class="tdas-next-list">${upcoming.length ? upcoming.map(nextItem).join('') : '<div class="empty">Nenhuma atividade futura publicada.</div>'}</div></aside>
      </div>
    </section>

    <section class="tdas-dashboard-section"><div class="section-head"><div><h2>O que merece atenção</h2><p>O dashboard não mostra risco para decorar a tela; cada sinal leva a uma ação.</p></div></div>
      <div class="tdas-insight-grid">
        <article class="card tdas-insight-card"><h3>Leitura de risco</h3><p>Prioridades derivadas dos dados oficiais publicados.</p><div class="tdas-health-list">${alerts.length ? alerts.map(healthItem).join('') : '<div class="empty">Nenhum alerta prioritário.</div>'}</div></article>
        <article class="card tdas-insight-card"><h3>Erros recentes</h3><p>Últimos pontos que podem voltar em revisão.</p><div class="tdas-error-mini">${recentErrors.length ? recentErrors.map(errorItem).join('') : '<div class="empty">Nenhum erro recente no PE atual.</div>'}</div></article>
      </div>
    </section>

    <section class="section tdas-home-shortcuts"><div class="section-head"><div><h2>Centrais de trabalho</h2><p>Abra só quando precisar aprofundar. A Home continua sendo o ponto de partida.</p></div></div><div class="grid three"><a class="card portal tdas-compact-portal" href="${BASE}revisar/"><small>Praticar</small><b>Revisões</b><span>D+1, D+7, D+20 e reforços pendentes.</span><em>Abrir →</em></a><a class="card portal tdas-compact-portal" href="${routes.redacoes}"><small>Discursiva</small><b>Redações</b><span>Produção, correção e prioridades do Banco Discursivo.</span><em>Abrir →</em></a><a class="card portal tdas-compact-portal" href="${BASE}desempenho/"><small>Analisar</small><b>Progresso</b><span>Desempenho, padrões de erro e tendência do ciclo.</span><em>Abrir →</em></a></div></section>
    <footer class="footer"><span>TDAS · Cargo 202 · central operacional</span><span>Última sincronização <span data-sync></span></span></footer>`;
} catch (error) {
  setLoadingError(error);
}
