import { loadJSON, fmtNumber, fmtPct, fmtDate, escapeHTML } from '../common.js?v=28.0.0';
import { readSessionDraft } from './session-draft.js?v=1.0.0';

const BASE = '/sedes-tdas-dashboard/';
const REPOSITORY = 'RodrigoRosaDantas/sedes-tdas-dashboard';
const WORKFLOW_URL = `https://github.com/${REPOSITORY}/actions/workflows/notion-sync.yml`;
const WORKFLOW_API = `https://api.github.com/repos/${REPOSITORY}/actions/workflows/notion-sync.yml/runs?per_page=1`;
const PLAN_KEY = 'tdas:dashboard-pro:available-minutes';
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const clamp = (value, min, max) => Math.max(min, Math.min(max, number(value)));
const completed = value => /conclu|finaliz|feito|realiz/i.test(String(value || ''));
const short = (value, size = 34) => String(value || '').length > size ? `${String(value).slice(0, size - 1)}…` : String(value || '');
const safeUrl = value => /^https:\/\//i.test(String(value || '')) ? String(value) : BASE;

async function waitForLegacyCenter(timeout = 4000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const center = document.querySelector('[data-command-center]');
    const continuity = document.querySelector('[data-v27-continuity]');
    const v28 = document.querySelector('[data-v28-block]');
    if (center && continuity && v28) return center;
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  return null;
}

function brasiliaParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const get = type => Number(parts.find(part => part.type === type)?.value || 0);
  return { year: get('year'), month: get('month'), day: get('day') };
}

function daysUntilExam(value) {
  const [year, month, day] = String(value || '').split('-').map(Number);
  if (![year, month, day].every(Number.isFinite)) return 0;
  const today = brasiliaParts();
  return Math.max(0, Math.ceil((Date.UTC(year, month - 1, day) - Date.UTC(today.year, today.month - 1, today.day)) / 86400000));
}

function formatSync(value) {
  if (!value) return 'aguardando registro';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
  }).format(parsed);
}

function metric(label, value, detail, tone = '') {
  return `<article class="pro26-metric metric ${tone}"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong><small>${escapeHTML(detail)}</small></article>`;
}

function horizontalBars(items = [], suffix = 'erros') {
  const max = Math.max(...items.map(item => number(item.value)), 1);
  if (!items.length) return '<div class="pro26-empty">Ainda não há dados suficientes para este gráfico.</div>';
  return `<div class="pro26-bars" role="img" aria-label="${escapeHTML(items.map(item => `${item.label}: ${item.value} ${suffix}`).join('; '))}">${items.map(item => `
    <div class="pro26-bar-row"><div><span title="${escapeHTML(item.label)}">${escapeHTML(short(item.label))}</span><strong>${fmtNumber(item.value)}</strong></div><i><b style="width:${Math.max(number(item.value) / max * 100, 2)}%"></b></i></div>`).join('')}</div>`;
}

function percentBars(items = []) {
  if (!items.length) return '<div class="pro26-empty">Ainda não há blocos mensuráveis.</div>';
  return `<div class="pro26-bars pro26-percent-bars" role="img" aria-label="${escapeHTML(items.map(item => `${item.label}: ${item.value}%`).join('; '))}">${items.map(item => `
    <div class="pro26-bar-row"><div><span title="${escapeHTML(item.label)}">${escapeHTML(short(item.label))}</span><strong>${fmtPct(item.value)}</strong></div><i><b style="width:${clamp(item.value, 0, 100)}%"></b></i></div>`).join('')}</div>`;
}

function lineChart(rows = []) {
  const data = rows.slice(-12);
  if (!data.length) return '<div class="pro26-empty">Complete execuções para formar a curva de aproveitamento.</div>';
  const width = 760, height = 236, padX = 38, padY = 28, min = 70, max = 100;
  const x = index => data.length === 1 ? width / 2 : padX + index * (width - padX * 2) / (data.length - 1);
  const y = value => height - padY - (clamp(value, min, max) - min) / (max - min) * (height - padY * 2);
  const points = data.map((item, index) => `${x(index).toFixed(1)},${y(item.accuracy).toFixed(1)}`).join(' ');
  const area = `${padX},${height - padY} ${points} ${x(data.length - 1).toFixed(1)},${height - padY}`;
  const grid = [70, 80, 90, 100].map(value => `<line x1="${padX}" x2="${width - padX}" y1="${y(value)}" y2="${y(value)}"></line><text class="pro26-axis-y" x="${padX - 8}" y="${y(value) + 3}">${value}%</text>`).join('');
  const dots = data.map((item, index) => `<g><circle class="${number(item.accuracy) < 80 ? 'risk' : ''}" cx="${x(index)}" cy="${y(item.accuracy)}" r="5"><title>${escapeHTML(item.pe)} · ${fmtPct(item.accuracy)}</title></circle><text x="${x(index)}" y="${height - 7}">${escapeHTML(item.pe)}</text></g>`).join('');
  return `<div class="pro26-chart-wrap"><svg class="pro26-line-chart tdas-performance-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Aproveitamento das últimas execuções"><defs><linearGradient id="pro26-trend-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#89b82c" stop-opacity=".35"></stop><stop offset="1" stop-color="#89b82c" stop-opacity="0"></stop></linearGradient></defs>${grid}<line class="pro26-goal" x1="${padX}" x2="${width - padX}" y1="${y(80)}" y2="${y(80)}"></line><polygon points="${area}" class="pro26-chart-area"></polygon><polyline points="${points}"></polyline>${dots}</svg><span class="pro26-goal-label">meta visual · 80%</span></div>`;
}

function volumeChart(rows = []) {
  const data = rows.slice(-8);
  const max = Math.max(...data.map(item => number(item.meta_completed || item.meta)), 1);
  if (!data.length) return '<div class="pro26-empty">O histórico semanal ainda não está disponível.</div>';
  return `<div class="pro26-volume" role="img" aria-label="Volume de questões por semana">${data.map(item => {
    const total = number(item.meta_completed || item.meta);
    const hits = number(item.correct);
    const errors = number(item.linked_errors || item.errors || Math.max(total - hits, 0));
    const height = Math.max(total / max * 100, 8);
    const hitShare = total ? clamp(hits / total * 100, 0, 100) : 0;
    return `<div class="pro26-volume-column"><span>${fmtNumber(total)}</span><div class="pro26-volume-track" style="height:${height}%"><i class="hits" style="height:${hitShare}%"></i><i class="errors" style="height:${Math.min(100 - hitShare, errors / Math.max(total, 1) * 100)}%"></i></div><strong>${fmtPct(item.accuracy || (total ? hits / total * 100 : 0))}</strong><small>S${String(item.week || '').padStart(2, '0')}</small></div>`;
  }).join('')}</div>`;
}

function aggregatePatterns(subjects = []) {
  const values = new Map();
  subjects.forEach(subject => (subject.top_patterns || []).forEach(item => values.set(item.pattern, (values.get(item.pattern) || 0) + number(item.count))));
  return [...values.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 7);
}

function errorDonut(correct, wrong) {
  const total = correct + wrong;
  const share = total ? correct / total * 100 : 0;
  return `<div class="pro26-donut-layout"><div class="pro26-donut" role="img" aria-label="${fmtNumber(correct)} acertos e ${fmtNumber(wrong)} erros" style="--share:${share}%"><div><strong>${fmtPct(share)}</strong><span>acertos</span></div></div><div class="pro26-legend"><span><i class="hit"></i><b>${fmtNumber(correct)}</b> acertos</span><span><i class="miss"></i><b>${fmtNumber(wrong)}</b> erros</span><p>Volume calculado somente nas execuções com resultado publicado.</p></div></div>`;
}

function priorityCards(items = []) {
  if (!items.length) return '<div class="pro26-empty">Nenhum tópico crítico publicado.</div>';
  return items.slice(0, 5).map((item, index) => `<a class="pro26-priority-item" href="${escapeHTML(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer"><b>${index + 1}</b><span><small>${escapeHTML(item.discipline || 'Edital')}</small><strong>${escapeHTML(item.topic || 'Tópico prioritário')}</strong><em>${escapeHTML(item.nextAction || item.strategicAction || 'Revisar')}</em></span><i>↗</i></a>`).join('');
}

function workflowLabel(run) {
  if (!run) return { tone: 'neutral', title: 'Status do GitHub indisponível', detail: 'O snapshot publicado continua preservado.' };
  if (run.status !== 'completed') return { tone: 'running', title: 'Atualização em andamento', detail: `Execução iniciada em ${formatSync(run.run_started_at || run.created_at)}.` };
  if (run.conclusion === 'success') return { tone: 'success', title: 'Última atualização concluída', detail: `GitHub confirmou a publicação em ${formatSync(run.updated_at)}.` };
  return { tone: 'error', title: 'Última atualização exige atenção', detail: `Resultado: ${run.conclusion || 'não concluído'} · o snapshot anterior foi preservado.` };
}

function setupTabs() {
  const buttons = [...document.querySelectorAll('[data-pro26-tab]')];
  const panels = [...document.querySelectorAll('[data-pro26-panel]')];
  const activate = id => {
    buttons.forEach(button => { const active = button.dataset.pro26Tab === id; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)); });
    panels.forEach(panel => { panel.hidden = panel.dataset.pro26Panel !== id; });
  };
  buttons.forEach(button => button.addEventListener('click', () => activate(button.dataset.pro26Tab)));
  activate('errors');
}

function setupPlan() {
  const presets = { 30: [10, 15, 5, 10], 60: [20, 30, 10, 20], 90: [30, 45, 15, 30] };
  const buttons = [...document.querySelectorAll('[data-pro26-minutes]')];
  const apply = value => {
    const minutes = presets[value] ? value : 60;
    localStorage.setItem(PLAN_KEY, String(minutes));
    buttons.forEach(button => { const active = Number(button.dataset.pro26Minutes) === minutes; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
    document.querySelectorAll('[data-plan-value]').forEach(node => { const index = Number(node.dataset.planValue); node.textContent = String(presets[minutes][index]); });
  };
  buttons.forEach(button => button.addEventListener('click', () => apply(Number(button.dataset.pro26Minutes))));
  apply(Number(localStorage.getItem(PLAN_KEY)) || 60);
}

function setupClock() {
  const node = document.querySelector('[data-pro26-clock]');
  if (!node) return;
  const format = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const update = () => { node.textContent = `${format.format(new Date())} · Brasília`; };
  update();
  setInterval(update, 1000);
}

function setupWorkflowStatus() {
  const openButton = document.querySelector('[data-pro26-sync-open]');
  const checkButton = document.querySelector('[data-pro26-sync-check]');
  const status = document.querySelector('[data-pro26-sync-status]');
  const guide = document.querySelector('[data-pro26-sync-guide]');
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
      const payload = await response.json();
      const run = payload.workflow_runs?.[0] || null;
      paint(run);
      if (baseline && run?.id > baseline && run.status === 'completed') {
        clearInterval(timer);
        if (run.conclusion === 'success') guide.innerHTML = '<strong>Dados publicados.</strong><span>O workflow terminou com sucesso. Recarregue a página para ler o novo snapshot.</span><button type="button" data-pro26-reload>Recarregar dados</button>';
        else guide.innerHTML = '<strong>Atualização não publicada.</strong><span>O GitHub preservou o último snapshot íntegro. Abra a execução para ver o diagnóstico.</span><a href="' + WORKFLOW_URL + '" target="_blank" rel="noopener noreferrer">Ver diagnóstico</a>';
        guide.hidden = false;
        guide.querySelector('[data-pro26-reload]')?.addEventListener('click', () => location.reload());
      }
      return run;
    } catch (error) {
      status.dataset.tone = 'neutral';
      status.innerHTML = '<i></i><span><strong>Status público temporariamente indisponível</strong><small>O botão seguro do GitHub continua acessível.</small></span>';
      return null;
    }
  };

  openButton?.addEventListener('click', async () => {
    const last = await check();
    baseline = number(last?.id);
    guide.hidden = false;
    guide.innerHTML = '<strong>Etapa segura aberta no GitHub.</strong><span>Toque em <b>Run workflow</b> e confirme a branch <b>main</b>. Ao voltar, este painel acompanha a execução.</span><a href="' + WORKFLOW_URL + '" target="_blank" rel="noopener noreferrer">Abrir novamente</a>';
    window.open(WORKFLOW_URL, '_blank', 'noopener,noreferrer');
    clearInterval(timer);
    timer = setInterval(check, 15000);
  });
  checkButton?.addEventListener('click', check);
  window.addEventListener('focus', () => { if (!document.hidden) check(); });
  check();
}

try {
  const [home, today, evolution, subjectsData, edital, platform, syncHistory] = await Promise.all([
    loadJSON('data/home.json'), loadJSON('data/today.json'), loadJSON('data/evolution.json'), loadJSON('data/subjects.json'),
    loadJSON('data/edital-status.json'), loadJSON('data/platform-version.json'), loadJSON('data/sync-history.json')
  ]);
  const main = document.querySelector('main');
  if (!main) throw new Error('Área principal não encontrada.');
  const legacyCenter = await waitForLegacyCenter();
  const metrics = home.metrics || {};
  const current = today.current || home.today || {};
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
  const examDays = daysUntilExam(home.meta?.examDate || today.meta?.examDate || '2026-09-06');
  const editalSummary = edital.summary || {};
  const editalTotal = number(editalSummary.total || 82);
  const editalStudied = number(editalSummary.coverage?.studied);
  const critical = number(editalSummary.risk?.critical);
  const attention = number(editalSummary.risk?.attention);
  const latestHistory = syncHistory.entries?.[0] || {};
  const recommendation = edital.priorityTopics?.[0];
  const todayDone = completed(current.status);
  const notionUrl = safeUrl(today.notionUrl || current.url);
  const sourceSync = platform.syncAt || latestHistory.at || home.meta?.snapshotDate;
  const legacyAction = legacyCenter?.querySelector('[data-continue-action]');
  const draft = readSessionDraft();
  const currentPe = String(current.pe || home.today?.pe || 'TDAS');
  const matchingDraft = draft && String(draft.peId || '') === currentPe ? draft : null;
  const overdueFallback = !matchingDraft && (home.overdue || [])[0];
  let operationalHref = legacyAction?.getAttribute('href') || `${BASE}resolver/?pe=${encodeURIComponent(currentPe)}`;
  let operationalLabel = legacyAction?.textContent?.replace(/\s*→\s*$/u, '').trim() || 'Continuar estudo';
  let operationalTitle = legacyCenter?.querySelector('.command-primary h2')?.textContent?.trim() || legacyCenter?.querySelector('.section-head h2')?.textContent?.trim() || 'Continuar o ciclo oficial';
  let operationalStage = legacyCenter?.dataset.primaryStage || 'questions';
  if (!legacyAction && matchingDraft) {
    operationalHref = `${BASE}resolver/`;
    operationalLabel = `Continuar questão ${number(matchingDraft.session?.currentIndex) + 1} de ${number(matchingDraft.session?.questionIds?.length)}`;
    operationalTitle = operationalLabel;
    operationalStage = 'resume';
  } else if (!legacyAction && overdueFallback?.pe) {
    operationalHref = `${BASE}estudar/?pe=${encodeURIComponent(overdueFallback.pe)}`;
    operationalLabel = `Retomar ${overdueFallback.pe}`;
    operationalTitle = `${overdueFallback.pe} atrasado · retomar agora`;
    operationalStage = 'overdue';
  }
  const operationalPe = (() => { try { return new URL(operationalHref, location.origin).searchParams.get('pe') || matchingDraft?.peId || currentPe; } catch { return matchingDraft?.peId || currentPe; } })();
  const operationalItem = (home.overdue || []).find(item => String(item.pe || item.id || '') === operationalPe) || current;
  const operationalFocus = operationalItem.title || operationalItem.label || 'próxima ação do ciclo';
  const sourceCommit = String(platform.sourceCommit || 'local').slice(0, 7);
  const cycleClosure = legacyCenter?.textContent?.includes('Fechamento e continuidade') || false;
  const subjectBars = subjects.slice(0, 7).map(item => ({ label: item.subject, value: number(item.errors) }));
  const blockBars = [...(evolution.blocks || [])].sort((a, b) => number(a.accuracy) - number(b.accuracy)).map(item => ({ label: item.block, value: number(item.accuracy) }));

  document.documentElement.dataset.dashboardPro2026 = '1';
  document.documentElement.dataset.homeV28 = '1';
  document.body.classList.add('tdas-dashboard-pro-2026');
  main.innerHTML = `<div class="pro26-dashboard">
    <header class="pro26-top"><div><span class="pro26-kicker">DASHBOARD PRO · CARGO 202</span><h2>Hoje, sem ruído.</h2><p>Dados do Notion transformados em decisão: o que revisar, quanto praticar e onde você ainda pode perder ponto.</p></div><div class="pro26-top-side"><span data-pro26-clock>Horário de Brasília</span><strong>Prova em ${fmtNumber(examDays)} dia${examDays === 1 ? '' : 's'}</strong><small>${fmtDate(home.meta?.examDate || '2026-09-06')} · SEDES/DF</small></div></header>

    <section class="pro26-sync-card" aria-label="Atualização dos dados"><div class="pro26-sync-copy"><span class="pro26-kicker">NOTION → GITHUB → SITE</span><h2>Dados oficiais e atualização segura</h2><p>Último snapshot do site: <strong>${escapeHTML(formatSync(sourceSync))}</strong>. O token do Notion permanece somente nos Secrets do GitHub.</p></div><div class="pro26-sync-state" data-pro26-sync-status data-tone="neutral"><i></i><span><strong>Consultando o GitHub…</strong><small>Verificando a última execução do sincronizador.</small></span></div><div class="pro26-sync-actions"><button class="pro26-btn primary" type="button" data-pro26-sync-open><b>↻</b> Atualizar dados</button><button class="pro26-btn ghost" type="button" data-pro26-sync-check>Verificar status</button></div><div class="pro26-sync-guide" data-pro26-sync-guide hidden></div></section>

    <section class="pro26-operational-bridge" data-command-center="${escapeHTML(operationalPe)}" data-primary-stage="${escapeHTML(operationalStage)}" data-publication-id="${escapeHTML(platform.publicationId || '')}" data-last-sync-at="${escapeHTML(platform.syncAt || '')}" data-ux-home-summary><div class="pro26-operational-copy"><span class="pro26-kicker">Central de execução</span><strong>${escapeHTML(operationalTitle)}</strong><small>${escapeHTML(operationalPe)} · ${escapeHTML(operationalFocus)}</small></div><div class="pro26-operational-meta"><span>Plataforma ${escapeHTML(platform.platformVersion || '—')}</span><span>publicação ${escapeHTML(sourceCommit)}</span><span>Última sincronização ${escapeHTML(formatSync(platform.syncAt || sourceSync))}</span><span>Notion → validação GitHub → site</span>${cycleClosure ? '<span>Fechamento e continuidade</span>' : ''}</div><a class="pro26-btn primary" data-continue-action href="${escapeHTML(operationalHref)}">${escapeHTML(operationalLabel)} →</a></section>

    <section class="pro26-decision-grid"><article class="pro26-decision tdas-home-focus"><div class="pro26-orbit"><i></i><i></i><i></i></div><div class="pro26-mode tdas-home-quick"><span>MODO RETA FINAL</span><span>${escapeHTML(current.pe || 'TDAS')}</span><span>${escapeHTML(current.status || 'Em andamento')}</span></div><span class="pro26-eyebrow">ORIENTAÇÃO DE HOJE</span><h1><small>Prioridade:</small> ${escapeHTML(recommendation?.topic || `${topPattern} em ${topSubject.subject || 'seu Caderno de Erros'}`)}</h1><p class="tdas-home-focus-copy">${escapeHTML(recommendation?.evidence || topSubject.recommendation || home.alerts?.[0]?.detail || 'Comece pelo erro mais recorrente, pratique e registre o resultado no Notion.')}</p><div class="pro26-why"><span>POR QUE ISSO VEM PRIMEIRO</span><p>${fmtNumber(topSubject.errors || metrics.errors)} erros em ${escapeHTML(topSubject.subject || 'áreas monitoradas')} · ${fmtNumber(topSubject.recurrent || 0)} reincidências · ${fmtNumber(critical)} tópicos críticos no edital.</p></div><div class="pro26-decision-actions tdas-home-actions"><a class="pro26-btn lime" href="${BASE}caderno-erros/">Abrir Caderno de Erros</a><a class="pro26-btn lime btn primary" href="${escapeHTML(operationalHref)}">${escapeHTML(operationalLabel)}</a><a class="pro26-btn dark" href="${escapeHTML(notionUrl)}" target="_blank" rel="noopener noreferrer">Registrar no Notion ↗</a></div></article><aside class="pro26-pulse tdas-hero-aside tdas-performance-card"><header><div><span>PULSO RECENTE</span><strong>${escapeHTML(last.pe || 'Últimas execuções')}</strong></div><b>${last.accuracy ? fmtPct(last.accuracy) : '—'}</b></header>${lineChart(recent.slice(-8))}<div class="pro26-delta ${delta < 0 ? 'negative' : ''}"><span>${delta < 0 ? '↓' : '↑'}</span><p><strong>${delta >= 0 ? '+' : ''}${fmtPct(delta)}</strong> em relação à execução anterior.</p></div><button type="button" data-pro26-open-questions>Painel completo abaixo ↓</button></aside></section>

    <section class="pro26-metrics tdas-home-metrics" aria-label="Indicadores principais">
      ${metric('Questões', fmtNumber(metrics.questions), `${fmtNumber(correct)} acertos publicados`, 'blue')}
      ${metric('Aproveitamento', fmtPct(metrics.accuracy || 0), `${fmtNumber(evolution.summary?.resultDays || 0)} dias com resultado`, 'green')}
      ${metric('Caderno de erros', fmtNumber(metrics.errors), `${fmtNumber(topSubject.recurrent || 0)} reincidências na maior matéria`, 'orange')}
      ${metric('Ciclo', `${fmtNumber(completedPes)}/${fmtNumber(totalPes)}`, `${fmtNumber(remainingPes)} PE pendentes`, 'purple')}
      ${metric('Check do Edital', `${fmtNumber(editalStudied)}/${fmtNumber(editalTotal)}`, `${fmtNumber(critical)} críticos · ${fmtNumber(attention)} atenção`, 'lime')}
    </section>

    <section class="pro26-plan"><header><div><span class="pro26-kicker">TRÊS AÇÕES, NESTA ORDEM</span><h2>Plano de estudo ajustado ao tempo disponível</h2></div><div class="pro26-time-picker" aria-label="Tempo disponível">${[30,60,90].map(value => `<button type="button" data-pro26-minutes="${value}" aria-pressed="false">${value} min</button>`).join('')}</div></header><div class="pro26-plan-steps"><article class="review"><b>01</b><div><span>REVISAR · <em data-plan-value="0">20</em> MIN</span><h3>${escapeHTML(topPattern)}</h3><p>Use os registros reais do Caderno de Erros; não crie uma agenda de revisão paralela.</p><a href="${BASE}caderno-erros/">Ver erros prioritários →</a></div></article><article class="practice"><b>02</b><div><span>PRATICAR · <em data-plan-value="1">30</em> MIN</span><h3><em data-plan-value="3">20</em> questões dirigidas</h3><p>Resolva no ambiente operacional existente e observe se o mesmo padrão volta.</p><a href="${BASE}resolver/">Abrir resolvedor →</a></div></article><article class="consolidate"><b>03</b><div><span>CONSOLIDAR · <em data-plan-value="2">10</em> MIN</span><h3>Registrar o resultado</h3><p>Atualize o Notion; o próximo sync recalcula os gráficos e a recomendação.</p><a href="${escapeHTML(notionUrl)}" target="_blank" rel="noopener noreferrer">Abrir registro no Notion ↗</a></div></article></div></section>

    <section class="pro26-analytics" data-pro26-analytics><header><div><span class="pro26-kicker">PANORAMA COMPLETO</span><h2>Gráficos para decidir, não apenas exibir</h2><p>Alterne entre Caderno de Erros, controle de questões e reta final.</p></div></header><nav class="pro26-tabs" role="tablist"><button type="button" role="tab" data-pro26-tab="errors">Caderno de Erros</button><button type="button" role="tab" data-pro26-tab="questions">Controle de questões</button><button type="button" role="tab" data-pro26-tab="readiness">Reta final</button></nav>
      <div class="pro26-panel" data-pro26-panel="errors"><div class="pro26-panel-metrics">${metric('Catalogados', fmtNumber(metrics.errors), 'fonte: Notion', 'orange')}${metric('Reincidências', fmtNumber(subjects.reduce((sum,item)=>sum+number(item.recurrent),0)), 'padrões que voltaram', 'purple')}${metric('Alta/crítica', fmtNumber(subjects.reduce((sum,item)=>sum+number(item.high_critical),0)), 'prioridade de revisão', 'red')}${metric('Maior concentração', escapeHTML(topSubject.subject || '—'), `${fmtNumber(topSubject.errors || 0)} erros`, 'lime')}</div><div class="pro26-chart-grid"><article class="pro26-chart-card"><header><h3>Erros por matéria</h3><p>Concentração atual do Caderno.</p></header>${horizontalBars(subjectBars)}</article><article class="pro26-chart-card"><header><h3>Padrões de erro</h3><p>Motivos que mais aparecem nos registros.</p></header>${horizontalBars(patterns, 'sinais')}</article></div><div class="pro26-recent-errors"><header><h3>Erros recentes que merecem retorno</h3><a href="${BASE}caderno-erros/">Abrir todos →</a></header><div>${(today.recentErrors || []).slice(0,6).map(item => `<a href="${BASE}caderno-erros/?origem=${encodeURIComponent(item.origin || '')}"><span>${escapeHTML(item.subject || 'Questão')}</span><strong>${escapeHTML(item.title || 'Erro registrado')}</strong><small>${escapeHTML(item.origin || '')} · ${escapeHTML(item.severity || 'revisar')}</small></a>`).join('') || '<div class="pro26-empty">Nenhum erro recente publicado.</div>'}</div></div></div>
      <div class="pro26-panel" data-pro26-panel="questions" hidden><div class="pro26-panel-metrics">${metric('Com resultado', fmtNumber(totalResults), 'questões contabilizadas', 'blue')}${metric('Acertos', fmtNumber(correct), fmtPct(metrics.accuracy || 0), 'green')}${metric('Erros nas execuções', fmtNumber(wrong), 'calculados por resultado', 'orange')}${metric('Tendência recente', `${delta >= 0 ? '+' : ''}${fmtPct(delta)}`, `${escapeHTML(last.pe || 'última execução')}`, delta < 0 ? 'red' : 'lime')}</div><div class="pro26-chart-grid wide-left"><article class="pro26-chart-card"><header><h3>Aproveitamento por execução</h3><p>Curva recente com linha de referência em 80%.</p></header>${lineChart(recent)}</article><article class="pro26-chart-card"><header><h3>Acertos x erros</h3><p>Distribuição das questões com resultado.</p></header>${errorDonut(correct, wrong)}</article><article class="pro26-chart-card"><header><h3>Ritmo semanal</h3><p>Volume total e aproveitamento.</p></header>${volumeChart(evolution.weekly || [])}</article><article class="pro26-chart-card"><header><h3>Aproveitamento por bloco</h3><p>Os blocos mais frágeis aparecem primeiro.</p></header>${percentBars(blockBars)}</article></div></div>
      <div class="pro26-panel" data-pro26-panel="readiness" hidden><div class="pro26-readiness"><article class="pro26-countdown"><span>PROVA OFICIAL</span><div><strong>${fmtNumber(examDays)}</strong><small>DIAS</small></div><h3>${fmtDate(home.meta?.examDate || '2026-09-06')}</h3><p>${examDays <= 7 ? 'Reta final: priorize recorrência, tópicos críticos e descanso.' : 'Tempo suficiente para corrigir os principais padrões sem dispersão.'}</p></article><article class="pro26-edital"><header><div><span>CHECK DO EDITAL</span><h3>${fmtNumber(editalStudied)} de ${fmtNumber(editalTotal)} tópicos estudados</h3></div><strong>${editalTotal ? fmtPct(editalStudied / editalTotal * 100) : '—'}</strong></header><div class="pro26-edital-track"><i style="width:${editalTotal ? clamp(editalStudied / editalTotal * 100,0,100) : 0}%"></i></div><div><span><b>${fmtNumber(critical)}</b> críticos</span><span><b>${fmtNumber(attention)}</b> atenção</span><span><b>${fmtNumber(editalSummary.risk?.strong || 0)}</b> fortes</span></div></article></div><article class="pro26-priorities"><header><div><h3>Tópicos prioritários do edital</h3><p>Ranqueados pelo histórico real de questões e erros.</p></div><a href="${BASE}riscos/">Abrir raio-X →</a></header><div>${priorityCards(edital.priorityTopics || [])}</div></article></div>
    </section>
    <span data-v27-continuity hidden></span><footer class="pro26-footer"><span>TDAS Cargo 202 · Dashboard PRO</span><span>${todayDone ? `${escapeHTML(current.pe || '')} concluído` : `${escapeHTML(current.pe || '')} em andamento`} · snapshot ${escapeHTML(home.meta?.snapshotDate || '')}</span></footer>
  </div>`;

  setupTabs(); setupPlan(); setupClock(); setupWorkflowStatus();
  document.querySelector('[data-pro26-open-questions]')?.addEventListener('click', () => { document.querySelector('[data-pro26-tab="questions"]')?.click(); document.querySelector('[data-pro26-analytics]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
} catch (error) {
  console.error('Dashboard PRO 2026 indisponível', error);
}
