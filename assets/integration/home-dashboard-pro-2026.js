import { BASE, loadJSON, setupShell, fmtNumber, fmtPct, fmtDate, fmtDateTime, escapeHTML } from '../common.js?v=28.0.0';
import { loadDailyExecution, findDailyExecution, normalizePe } from './daily-execution.js?v=1.1.2';
import { readPeProgress, summarizeProgress } from './daily-progress.js?v=1.0.0';
import { readModuleState } from './module-store.js?v=2.1.0';
import { readSessionDraft } from './session-draft.js?v=1.0.0';
import { buildOfficialCycleTasks, selectPrimaryAction } from './daily-priorities.js?v=1.1.0';

const REPOSITORY = 'RodrigoRosaDantas/sedes-tdas-dashboard';
const WORKFLOW_URL = `https://github.com/${REPOSITORY}/actions/workflows/notion-sync.yml`;
const WORKFLOW_API = `https://api.github.com/repos/${REPOSITORY}/actions/workflows/notion-sync.yml/runs?per_page=1`;
const PLAN_KEY = 'tdas:dashboard-pro:available-minutes';
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const clamp = (value, min, max) => Math.max(min, Math.min(max, number(value)));
const completed = value => /conclu|finaliz|feito|realiz/i.test(String(value || ''));
const short = (value, size = 38) => String(value || '').length > size ? `${String(value).slice(0, size - 1)}…` : String(value || '');
const safeUrl = value => /^https:\/\//i.test(String(value || '')) ? String(value) : BASE;

function brasiliaParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = type => Number(parts.find(part => part.type === type)?.value || 0);
  return { year: get('year'), month: get('month'), day: get('day') };
}

function daysUntilExam(value) {
  const [year, month, day] = String(value || '').split('-').map(Number);
  if (![year, month, day].every(Number.isFinite)) return 0;
  const today = brasiliaParts();
  return Math.max(0, Math.ceil((Date.UTC(year, month - 1, day) - Date.UTC(today.year, today.month - 1, today.day)) / 86400000));
}

function metric(label, value, detail, tone = '') {
  return `<article class="pro26-metric ${tone}"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong><small>${escapeHTML(detail)}</small></article>`;
}

function horizontalBars(items = [], suffix = 'erros') {
  if (!items.length) return '<div class="pro26-empty">Ainda não há dados suficientes.</div>';
  const max = Math.max(...items.map(item => number(item.value)), 1);
  return `<div class="pro26-bars" role="img" aria-label="${escapeHTML(items.map(item => `${item.label}: ${item.value} ${suffix}`).join('; '))}">${items.map(item => `<div class="pro26-bar-row"><div><span title="${escapeHTML(item.label)}">${escapeHTML(short(item.label))}</span><strong>${suffix === '%' ? fmtPct(item.value) : fmtNumber(item.value)}</strong></div><i><b style="width:${Math.max(number(item.value) / max * 100, 3)}%"></b></i></div>`).join('')}</div>`;
}

function lineChart(rows = []) {
  const data = rows.slice(-10);
  if (!data.length) return '<div class="pro26-empty">Complete execuções para formar a curva.</div>';
  const width = 720, height = 220, padX = 38, padY = 28, min = 60, max = 100;
  const x = index => data.length === 1 ? width / 2 : padX + index * (width - padX * 2) / (data.length - 1);
  const y = value => height - padY - (clamp(value, min, max) - min) / (max - min) * (height - padY * 2);
  const points = data.map((item, index) => `${x(index).toFixed(1)},${y(item.accuracy).toFixed(1)}`).join(' ');
  const grid = [60, 70, 80, 90, 100].map(value => `<line x1="${padX}" x2="${width - padX}" y1="${y(value)}" y2="${y(value)}"></line>`).join('');
  const dots = data.map((item, index) => `<g><circle class="${number(item.accuracy) < 80 ? 'risk' : ''}" cx="${x(index)}" cy="${y(item.accuracy)}" r="4"><title>${escapeHTML(item.pe)} · ${fmtPct(item.accuracy)}</title></circle><text x="${x(index)}" y="${height - 7}">${escapeHTML(String(item.pe || '').replace('PE', ''))}</text></g>`).join('');
  return `<div class="pro26-chart-wrap"><svg class="pro26-line-chart tdas-performance-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Aproveitamento por execução">${grid}<line class="pro26-goal" x1="${padX}" x2="${width - padX}" y1="${y(80)}" y2="${y(80)}"></line><polyline points="${points}"></polyline>${dots}</svg><span class="pro26-goal-label">referência · 80%</span></div>`;
}

function errorDonut(correct, wrong) {
  const total = correct + wrong;
  const share = total ? correct / total * 100 : 0;
  return `<div class="pro26-donut-layout"><div class="pro26-donut" data-pro26-pie role="img" aria-label="${fmtNumber(correct)} acertos e ${fmtNumber(wrong)} erros" style="--share:${share}%"><div><strong>${fmtPct(share)}</strong><span>acertos</span></div></div><div class="pro26-legend"><span><i class="hit"></i><b>${fmtNumber(correct)}</b> acertos</span><span><i class="miss"></i><b>${fmtNumber(wrong)}</b> erros</span></div></div>`;
}

function aggregatePatterns(subjects = []) {
  const values = new Map();
  subjects.forEach(subject => (subject.top_patterns || []).forEach(item => values.set(item.pattern, (values.get(item.pattern) || 0) + number(item.count))));
  return [...values.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 7);
}

function workflowLabel(run) {
  if (!run) return { tone: 'neutral', title: 'Status indisponível', detail: 'O último snapshot válido continua ativo.' };
  if (run.status !== 'completed') return { tone: 'running', title: 'Atualização em andamento', detail: 'O GitHub está validando o novo snapshot.' };
  if (run.conclusion === 'success') return { tone: 'success', title: 'Sincronização validada', detail: `Concluída ${fmtDateTime(run.updated_at)}.` };
  return { tone: 'error', title: 'Atualização não promovida', detail: `Resultado ${run.conclusion || 'inconclusivo'}; snapshot anterior preservado.` };
}

function setupWorkflowStatus() {
  const root = document.querySelector('[data-pro26-sync]');
  const openButton = root?.querySelector('[data-pro26-sync-open]');
  const checkButton = root?.querySelector('[data-pro26-sync-check]');
  const status = root?.querySelector('[data-pro26-sync-status]');
  const guide = root?.querySelector('[data-pro26-sync-guide]');
  if (!root || !status) return;
  let baseline = 0;
  let timer = 0;

  const paint = run => {
    const info = workflowLabel(run);
    status.dataset.tone = info.tone;
    status.innerHTML = `<i></i><span><strong>${escapeHTML(info.title)}</strong><small>${escapeHTML(info.detail)}</small></span>`;
    return run;
  };
  const check = async () => {
    try {
      const response = await fetch(`${WORKFLOW_API}&t=${Date.now()}`, { cache: 'no-store', headers: { Accept: 'application/vnd.github+json' } });
      if (!response.ok) throw new Error(`GitHub ${response.status}`);
      const run = (await response.json()).workflow_runs?.[0] || null;
      paint(run);
      if (baseline && run?.id > baseline && run.status === 'completed') {
        clearInterval(timer);
        guide.hidden = false;
        guide.innerHTML = run.conclusion === 'success'
          ? '<strong>Dados publicados.</strong><span>Recarregue para ler o novo snapshot.</span><button type="button" data-pro26-reload>Recarregar</button>'
          : `<strong>Snapshot preservado.</strong><span>A validação não promoveu os dados novos.</span><a href="${WORKFLOW_URL}" target="_blank" rel="noopener noreferrer">Ver diagnóstico</a>`;
        guide.querySelector('[data-pro26-reload]')?.addEventListener('click', () => location.reload());
      }
      return run;
    } catch {
      status.dataset.tone = 'neutral';
      status.innerHTML = '<i></i><span><strong>Status temporariamente indisponível</strong><small>A atualização autenticada continua no GitHub.</small></span>';
      return null;
    }
  };

  openButton?.addEventListener('click', async () => {
    const last = await check();
    baseline = number(last?.id);
    guide.hidden = false;
    guide.innerHTML = `<strong>GitHub aberto.</strong><span>Use <b>Run workflow</b> na branch <b>main</b>. O site acompanha o resultado quando você voltar.</span><a href="${WORKFLOW_URL}" target="_blank" rel="noopener noreferrer">Abrir novamente</a>`;
    window.open(WORKFLOW_URL, '_blank', 'noopener,noreferrer');
    clearInterval(timer);
    timer = setInterval(check, 15000);
  });
  checkButton?.addEventListener('click', check);
  window.addEventListener('focus', () => { if (!document.hidden) check(); });
  check();
}

function setupTabs() {
  const buttons = [...document.querySelectorAll('[data-pro26-tab]')];
  const panels = [...document.querySelectorAll('[data-pro26-panel]')];
  const activate = id => {
    buttons.forEach(button => {
      const active = button.dataset.pro26Tab === id;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    panels.forEach(panel => { panel.hidden = panel.dataset.pro26Panel !== id; });
  };
  buttons.forEach((button, index) => {
    button.addEventListener('click', () => activate(button.dataset.pro26Tab));
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'ArrowRight' ? (index + 1) % buttons.length : (index - 1 + buttons.length) % buttons.length;
      buttons[next].focus(); buttons[next].click();
    });
  });
  activate('errors');
}

function setupPlan() {
  const presets = { 30: [8, 17, 5, 10], 60: [15, 35, 10, 20], 90: [20, 55, 15, 30] };
  const buttons = [...document.querySelectorAll('[data-pro26-minutes]')];
  const apply = value => {
    const minutes = presets[value] ? value : 60;
    localStorage.setItem(PLAN_KEY, String(minutes));
    document.querySelector('[data-pro26-plan-current]')?.replaceChildren(`${minutes} min`);
    buttons.forEach(button => {
      const active = Number(button.dataset.pro26Minutes) === minutes;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('[data-plan-value]').forEach(node => node.textContent = String(presets[minutes][Number(node.dataset.planValue)]));
  };
  buttons.forEach(button => button.addEventListener('click', () => apply(Number(button.dataset.pro26Minutes))));
  apply(Number(localStorage.getItem(PLAN_KEY)) || 60);
}

function setupClock() {
  const node = document.querySelector('[data-pro26-clock]');
  if (!node) return;
  const formatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const update = () => { node.textContent = `${formatter.format(new Date())} · Brasília`; };
  update();
  setInterval(update, 1000);
}

function setupSearch(currentPe) {
  const input = document.querySelector('[data-pro26-search]');
  const results = document.querySelector('[data-pro26-search-results]');
  if (!input || !results) return;
  const items = [
    ['Continuar execução', `${BASE}estudar/?pe=${encodeURIComponent(currentPe)}`, `${currentPe} · ciclo oficial`],
    ['Resolver questões', `${BASE}resolver/?pe=${encodeURIComponent(currentPe)}`, 'Banco Mestre e sessão cega'],
    ['Caderno de Erros', `${BASE}caderno-erros/`, 'Padrões, causas e recorrência'],
    ['Check do Edital', `${BASE}edital/`, 'Cobertura e risco'],
    ['Desempenho', `${BASE}desempenho/`, 'Histórico e aproveitamento'],
    ['Mentor TDAS', `${BASE}mentor/`, 'Diagnóstico e direcionamento'],
    ['Redações', `${BASE}redacoes/`, 'Banco discursivo'],
    ['Meu Notion', `${BASE}notion/`, 'Mapa seguro da fonte oficial']
  ];
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const render = () => {
    const query = normalize(input.value.trim());
    if (!query) { results.hidden = true; results.innerHTML = ''; return; }
    const matches = items.filter(item => normalize(item.join(' ')).includes(query)).slice(0, 6);
    results.innerHTML = matches.length ? matches.map(([label, href, meta]) => `<a href="${href}"><strong>${escapeHTML(label)}</strong><small>${escapeHTML(meta)}</small><span>→</span></a>`).join('') : '<div class="pro26-empty">Nenhum atalho encontrado.</div>';
    results.hidden = false;
  };
  input.addEventListener('input', render);
  input.addEventListener('keydown', event => { if (event.key === 'Escape') { results.hidden = true; input.blur(); } });
  document.addEventListener('keydown', event => { if (event.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName || '')) { event.preventDefault(); input.focus(); } });
  document.addEventListener('click', event => { if (!event.target.closest('.pro26-search')) results.hidden = true; });
}

try {
  const [home, today, evolution, subjectsData, edital, platform, syncHistory, audit, agenda, notionMirror, contract] = await Promise.all([
    loadJSON('data/home.json'),
    loadJSON('data/today.json'),
    loadJSON('data/evolution.json'),
    loadJSON('data/subjects.json'),
    loadJSON('data/edital-status.json'),
    loadJSON('data/platform-version.json'),
    loadJSON('data/sync-history.json'),
    loadJSON('data/audit.json'),
    loadJSON('data/agenda.json'),
    loadJSON('data/notion-mirror/summary.json').catch(() => null),
    loadDailyExecution().catch(() => null)
  ]);

  setupShell('home', home.meta || {});
  document.querySelectorAll('[data-platform-version]').forEach(node => { node.textContent = `v${platform.platformVersion}`; });

  const main = document.querySelector('main');
  if (!main) throw new Error('Área principal não encontrada.');
  const metrics = home.metrics || {};
  const current = today.current || home.today || {};
  const pe = normalizePe(current.pe || home.today?.pe || platform.peId || 'PE01');
  const local = readModuleState();
  const draft = readSessionDraft();
  const progress = summarizeProgress(readPeProgress(pe));
  const officialCompleted = completed(home.today?.status || current.status);
  const attempt = (local.attempts || []).find(item => normalizePe(item.peId) === pe && item.mode === 'study') || null;
  const nextNumber = Math.min(112, number(String(pe).replace(/\D/g, '')) + 1);
  const nextPe = contract && nextNumber > number(String(pe).replace(/\D/g, '')) ? findDailyExecution(contract, `PE${String(nextNumber).padStart(2, '0')}`) : null;
  const effective = officialCompleted
    ? { ...progress, material: true, questions: true, registered: true, completed: 3, total: 3, percent: 100, done: true }
    : { ...progress, questions: progress.questions || Boolean(attempt) };
  const currentStarted = Boolean((draft && normalizePe(draft.peId) === pe) || attempt || progress.material || progress.questions || progress.registered);
  const overduePe = !officialCompleted && !currentStarted ? (home.overdue || [])[0] : null;
  const officialTasks = buildOfficialCycleTasks({ today, nextPe, base: BASE });
  const action = selectPrimaryAction({ pe, progress: effective, draft, attempt, nextPe, overduePe, officialCompleted, officialTasks, base: BASE });
  const pendingOfficial = officialCompleted ? officialTasks.filter(item => item.id !== 'next' && !item.done) : [];
  const cycleClosure = officialCompleted && officialTasks.length > 0;

  const subjects = [...(subjectsData.subjects || [])].sort((a, b) => number(b.errors) - number(a.errors));
  const topSubject = subjects[0] || {};
  const topPattern = topSubject.top_patterns?.[0]?.pattern || 'erros recorrentes';
  const patterns = aggregatePatterns(subjects);
  const recent = evolution.actual || [];
  const last = recent.at(-1) || {};
  const previous = recent.at(-2) || {};
  const delta = number(last.accuracy) - number(previous.accuracy);
  const totalResults = number(metrics.resultQuestions || metrics.questions);
  const correct = number(metrics.correct);
  const wrong = Math.max(totalResults - correct, 0);
  const completedPes = number(metrics.completed);
  const totalPes = number(metrics.totalPE || 112);
  const remainingPes = Math.max(totalPes - completedPes, 0);
  const cyclePct = totalPes ? completedPes / totalPes * 100 : 0;
  const examDate = home.meta?.examDate || today.meta?.examDate || '2026-09-06';
  const examDays = daysUntilExam(examDate);
  const editalSummary = edital.summary || {};
  const editalTotal = number(editalSummary.total || 82);
  const editalStudied = number(editalSummary.coverage?.studied);
  const editalPct = editalTotal ? editalStudied / editalTotal * 100 : 0;
  const critical = number(editalSummary.risk?.critical);
  const attention = number(editalSummary.risk?.attention);
  const recommendation = edital.priorityTopics?.[0];
  const priorityTitle = recommendation?.topic || `${topPattern} · ${topSubject.subject || 'Caderno de Erros'}`;
  const priorityReason = recommendation?.evidence || topSubject.recommendation || home.alerts?.[0]?.detail || 'Ataque primeiro o padrão de erro que mais se repete.';
  const latestHistory = syncHistory.entries?.[0] || {};
  const sourceSync = platform.syncAt || latestHistory.at || home.meta?.snapshotDate;
  const sourceCommit = platform.sourceCommit === 'unknown' ? 'local' : String(platform.sourceCommit || 'local').slice(0, 7);
  const notionUrl = safeUrl(today.notionUrl || current.url);
  const subjectBars = subjects.slice(0, 7).map(item => ({ label: item.subject, value: number(item.errors) }));
  const blockBars = [...(evolution.blocks || [])].sort((a, b) => number(a.accuracy) - number(b.accuracy)).slice(0, 7).map(item => ({ label: item.block, value: number(item.accuracy) }));
  const unlinked = Math.max(0, number(metrics.errors) - number(audit.summary?.linked_error_records));
  const upcoming = (agenda.next || agenda.items || []).slice(0, 4);
  const mirrorCount = number(notionMirror?.pageCount);
  const protectedCount = number(notionMirror?.protectedPageCount);

  document.documentElement.dataset.dashboardPro2026 = '1';
  document.body.classList.add('tdas-dashboard-pro-2026');

  main.innerHTML = `<div class="pro26-dashboard" data-pro-dashboard>
    <section class="pro26-utility-row">
      <div class="pro26-search"><span>⌕</span><input data-pro26-search autocomplete="off" aria-label="Buscar atalho" placeholder="Buscar ação, módulo ou dado…"><kbd>/</kbd><div class="pro26-search-results" data-pro26-search-results hidden></div></div>
      <div class="pro26-sync-mini" data-pro26-sync><div class="pro26-sync-state" data-pro26-sync-status data-tone="neutral"><i></i><span><strong>Consultando sincronização…</strong><small>Notion → validação GitHub → site</small></span></div><button type="button" data-pro26-sync-check>Verificar</button><button class="primary" type="button" data-pro26-sync-open>↻ Atualizar dados</button><div class="pro26-sync-guide" data-pro26-sync-guide hidden></div></div>
    </section>

    <section class="pro26-decision-grid">
      <article class="pro26-decision tdas-home-focus" data-pro-next>
        <div class="pro26-decision-head"><div><span class="pro26-kicker">Central de execução</span><span class="pro26-pe">${escapeHTML(pe)}</span></div><span class="pro26-stage">${escapeHTML(action.stage)}</span></div>
        <div class="pro26-command"><span>PRÓXIMA AÇÃO</span><h1>${escapeHTML(action.label)}</h1><p>${escapeHTML(action.detail)}</p><a class="pro26-btn primary" data-continue-action href="${escapeHTML(action.href)}">${escapeHTML(action.button || 'Continuar estudo')} →</a></div>
        <div class="pro26-priority"><span>ORIENTAÇÃO DE HOJE</span><h2 data-pro26-today-label>${escapeHTML(priorityTitle)}</h2><p class="tdas-home-focus-copy" data-pro26-today-reason>${escapeHTML(priorityReason)}</p><div class="tdas-home-actions"><a href="${BASE}caderno-erros/">Caderno de Erros</a><a href="${BASE}resolver/?pe=${encodeURIComponent(pe)}">Controle de questões</a><a href="${BASE}edital/">Check do Edital</a></div></div>
        <div class="tdas-home-quick"><span>${escapeHTML(current.status || 'Em andamento')}</span><span>${fmtNumber(current.meta || current.planned_questions || 0)} questões previstas</span><span>${escapeHTML(current.block || current.type || 'Ciclo oficial')}</span></div>
      </article>

      <aside class="pro26-pulse tdas-hero-aside">
        <div class="pro26-pulse-top"><span data-pro26-clock>Horário de Brasília</span><b>Reta final</b></div>
        <div class="pro26-countdown" data-pro26-countdown><strong>${fmtNumber(examDays)}</strong><span>${examDays === 1 ? 'dia' : 'dias'} para a prova</span><small data-pro26-deadline>${fmtDate(examDate)} · SEDES/DF</small></div>
        <div class="pro26-progress-block"><div><span>Ciclo PE01–PE112</span><strong>${fmtNumber(completedPes)}/${fmtNumber(totalPes)}</strong></div><i><b style="width:${clamp(cyclePct, 0, 100)}%"></b></i><small>${fmtPct(cyclePct, 1)} concluído · ${fmtNumber(remainingPes)} PE pendentes</small></div>
        <div class="pro26-progress-block" data-pro26-question-progress><div><span>Check do Edital</span><strong>${fmtNumber(editalStudied)}/${fmtNumber(editalTotal)}</strong></div><i><b style="width:${clamp(editalPct, 0, 100)}%"></b></i><small>${fmtNumber(critical)} críticos · ${fmtNumber(attention)} em atenção</small></div>
        <div class="pro26-pulse-chart"><span>Aproveitamento recente</span>${lineChart(recent.slice(-6))}<small class="${delta < 0 ? 'negative' : ''}">${delta >= 0 ? '↑' : '↓'} ${delta >= 0 ? '+' : ''}${fmtPct(delta)} vs. execução anterior</small></div>
      </aside>
    </section>

    <section class="pro26-operational-bridge" data-operational-center data-command-center="${escapeHTML(pe)}" data-primary-stage="${escapeHTML(action.stage)}" data-last-sync-at="${escapeHTML(platform.syncAt || '')}" data-ux-home-summary>
      <div><span>Plataforma ${escapeHTML(platform.platformVersion || '—')}</span><span>publicação ${escapeHTML(sourceCommit)}</span><span>Última sincronização ${escapeHTML(fmtDateTime(sourceSync))}</span><span>${escapeHTML(unlinked)} erros sem origem confirmada</span>${cycleClosure ? '<span>Fechamento e continuidade</span>' : ''}</div>
      ${pendingOfficial.length ? `<small>${pendingOfficial.length} pendência${pendingOfficial.length > 1 ? 's' : ''} oficial${pendingOfficial.length > 1 ? 'is' : ''} depois do PE.</small>` : '<small>Fluxo oficial e progresso local reconciliados.</small>'}
    </section>
    <span data-v27-continuity hidden aria-hidden="true"></span>

    <section class="pro26-metrics" aria-label="Indicadores principais">
      ${metric('Questões', fmtNumber(metrics.questions), `${fmtNumber(correct)} acertos publicados`, 'blue')}
      ${metric('Aproveitamento', fmtPct(metrics.accuracy || 0), `${fmtNumber(evolution.summary?.resultDays || 0)} dias com resultado`, 'green')}
      ${metric('Erros catalogados', fmtNumber(metrics.errors), `${fmtNumber(topSubject.recurrent || 0)} reincidências no maior foco`, 'orange')}
      ${metric('Cobertura do edital', fmtPct(editalPct, 1), `${fmtNumber(critical)} tópicos críticos`, 'violet')}
    </section>

    <section class="pro26-plan" data-pro26-study>
      <header><div><span class="pro26-kicker">PLANO ENXUTO</span><h2>Use o tempo que você realmente tem.</h2><p>Uma sequência única: revisar → praticar → consolidar.</p></div><div class="pro26-plan-controls"><span data-pro26-plan-current>60 min</span><div class="pro26-time-picker">${[30, 60, 90].map(value => `<button type="button" data-pro26-minutes="${value}" aria-pressed="false">${value}</button>`).join('')}</div></div></header>
      <div class="pro26-plan-steps"><article><b>01</b><span>REVISAR · <em data-plan-value="0">15</em> MIN</span><h3>${escapeHTML(topPattern)}</h3><p>Volte ao padrão que mais cobra pontos.</p><a href="${BASE}caderno-erros/">Abrir erros →</a></article><article><b>02</b><span>PRATICAR · <em data-plan-value="1">35</em> MIN</span><h3><em data-plan-value="3">20</em> questões dirigidas</h3><p>Execute no resolvedor e mantenha a correção cega.</p><a href="${BASE}resolver/?pe=${encodeURIComponent(pe)}">Resolver →</a></article><article><b>03</b><span>CONSOLIDAR · <em data-plan-value="2">10</em> MIN</span><h3>Fechar o ciclo</h3><p>Registre o resultado na fonte oficial.</p><a href="${escapeHTML(notionUrl)}" target="_blank" rel="noopener noreferrer">Abrir Notion ↗</a></article></div>
    </section>

    <section class="pro26-analytics" data-pro26-analytics>
      <header><div><span class="pro26-kicker">LEITURA DE DADOS</span><h2>Dashboard para decidir o próximo bloco.</h2><p>Menos painéis concorrendo; três leituras que mudam sua ação.</p></div></header>
      <nav class="pro26-tabs" role="tablist"><button role="tab" type="button" data-pro26-tab="errors">Caderno de Erros</button><button role="tab" type="button" data-pro26-tab="questions">Controle de questões</button><button role="tab" type="button" data-pro26-tab="readiness">Reta final</button></nav>
      <div class="pro26-panel" data-pro26-panel="errors"><div class="pro26-chart-grid"><article class="pro26-chart-card"><header><h3>Erros por matéria</h3><p>Onde a revisão deve começar.</p></header>${horizontalBars(subjectBars)}</article><article class="pro26-chart-card" data-pro26-difficulty-list><header><h3>Padrões de erro</h3><p>O que está voltando.</p></header>${horizontalBars(patterns, 'sinais')}</article></div></div>
      <div class="pro26-panel" data-pro26-panel="questions" hidden><div class="pro26-chart-grid wide"><article class="pro26-chart-card"><header><h3>Aproveitamento por execução</h3><p>Últimos resultados com referência em 80%.</p></header>${lineChart(recent)}</article><article class="pro26-chart-card"><header><h3>Acertos x erros</h3><p>Distribuição publicada.</p></header>${errorDonut(correct, wrong)}</article><article class="pro26-chart-card"><header><h3>Aproveitamento por bloco</h3><p>Blocos mais frágeis primeiro.</p></header>${horizontalBars(blockBars, '%')}</article></div></div>
      <div class="pro26-panel" data-pro26-panel="readiness" hidden><div class="pro26-readiness-grid"><article><span>PROVA</span><strong>${fmtNumber(examDays)} dias</strong><p>Priorize recorrência e recuperação de pontos.</p></article><article><span>CICLO</span><strong>${fmtPct(cyclePct, 1)}</strong><p>${fmtNumber(remainingPes)} PE ainda pendentes.</p></article><article><span>EDITAL</span><strong>${fmtPct(editalPct, 1)}</strong><p>${fmtNumber(critical)} críticos · ${fmtNumber(attention)} atenção.</p></article><article><span>MAIOR RISCO</span><strong>${escapeHTML(short(topSubject.subject || '—', 22))}</strong><p>${fmtNumber(topSubject.errors || 0)} erros catalogados.</p></article></div></div>
    </section>

    <section class="pro26-lower-grid">
      <article class="pro26-list-card" data-pro26-recent-list><header><div><span class="pro26-kicker">RETORNO RÁPIDO</span><h2>Erros recentes</h2></div><a href="${BASE}caderno-erros/">Ver todos →</a></header><div>${(today.recentErrors || []).slice(0, 5).map(item => `<a href="${BASE}caderno-erros/?origem=${encodeURIComponent(item.origin || '')}"><span>${escapeHTML(item.subject || 'Questão')}</span><strong>${escapeHTML(item.title || 'Erro registrado')}</strong><small>${escapeHTML(item.origin || '')} · ${escapeHTML(item.severity || 'revisar')}</small></a>`).join('') || '<div class="pro26-empty">Nenhum erro recente publicado.</div>'}</div></article>
      <article class="pro26-list-card" data-pro26-task><header><div><span class="pro26-kicker">AGENDA</span><h2>Próximos passos</h2></div><a href="${BASE}agenda/">Plano completo →</a></header><div data-pro26-calendar>${upcoming.map(item => `<a href="${BASE}estudar/?pe=${encodeURIComponent(item.pe || '')}"><span>${escapeHTML(item.pe || 'PE')}</span><strong>${escapeHTML(item.title || 'Atividade programada')}</strong><small>${escapeHTML(item.date || '')} · ${fmtNumber(item.planned_questions || item.meta || 0)} questões</small></a>`).join('') || '<div class="pro26-empty">Sem próximos itens publicados.</div>'}</div></article>
      <article class="pro26-source-card"><span class="pro26-kicker">FONTE OFICIAL</span><h2>Notion sem invadir a execução.</h2><p>${mirrorCount ? `${fmtNumber(mirrorCount)} páginas mapeadas · ${fmtNumber(protectedCount)} áreas protegidas.` : 'Mapa seguro disponível para consulta estrutural.'} O site lê o snapshot publicado; credenciais não vão para o navegador.</p><div><a class="pro26-btn" href="${BASE}notion/">Abrir mapa do Notion</a><a class="pro26-btn" href="${BASE}auditoria/">Abrir auditoria</a></div><small>Snapshot ${escapeHTML(home.meta?.snapshotDate || '—')} · ${escapeHTML(platform.publicationId || '')}</small></article>
    </section>

    <div class="pro26-contract" hidden aria-hidden="true"><span data-pro26-bank>${fmtNumber(metrics.questions)}</span><span data-pro26-accuracy>${fmtPct(metrics.accuracy || 0)}</span><span data-pro26-week-status>${escapeHTML(String(current.week || ''))}</span><span data-pro26-study-date>${escapeHTML(current.date || '')}</span><span data-pro26-study-status>${escapeHTML(current.status || '')}</span><span data-pro26-study-sub>${escapeHTML(current.title || '')}</span><span data-pro26-task-summary>${escapeHTML(action.label)}</span><span data-pro26-task-list>${officialTasks.length}</span></div>
  </div>`;

  setupClock();
  setupPlan();
  setupTabs();
  setupWorkflowStatus();
  setupSearch(pe);
  document.querySelector('.pro26-pulse-chart button,[data-pro26-open-questions]')?.addEventListener('click', () => document.querySelector('[data-pro26-tab="questions"]')?.click());
} catch (error) {
  console.error('Dashboard PRO 2026 indisponível', error);
  const main = document.querySelector('main');
  if (main) main.innerHTML = `<section class="card panel"><h1>Não foi possível carregar esta página.</h1><p>${escapeHTML(error.message)}</p><button class="btn" type="button" onclick="location.reload()">Tentar novamente</button></section>`;
}
