import { loadJSON, setupShell, fmtNumber, fmtPct, fmtDate, metric, setLoadingError, routes, escapeHTML } from './common.js?v=26.16.0';
import { readPeProgress, summarizeProgress } from './integration/daily-progress.js?v=1.0.0';
import { readModuleState } from './integration/module-store.js?v=2.1.0';
import { readSessionDraft } from './integration/session-draft.js?v=1.0.0';

const BASE = '/sedes-tdas-dashboard/';
const completed = value => /conclu|finaliz|feito|realiz/i.test(String(value || ''));
const normalizePe = value => `PE${String(Number(String(value || '').replace(/\D/g, '')) || 0).padStart(2, '0')}`;
function examCountdown(examDate) {
  const [year, month, day] = examDate.split('-').map(Number);
  const now = new Date();
  return Math.max(0, Math.ceil((Date.UTC(year, month - 1, day) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000));
}

try {
  const d = await loadJSON('data/home.json');
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
  const secondaryLabel = overdue ? `Ver ${todayPe} de hoje` : 'Questões';
  const statusCopy = overdue
    ? `${focusPe} venceu em ${fmtDate(focus.date)} e ainda está pendente. O progresso já iniciado no PE atual sempre é preservado.`
    : todayDone
      ? 'Bloco objetivo concluído. A próxima prioridade é consolidar a revisão e preservar o fechamento do ciclo.'
      : `Material e bateria programados para hoje. Continue exatamente do ponto de execução do ${todayPe}.`;

  document.querySelector('main').innerHTML = `
    <section class="hero tdas-home-focus">
      <div class="tdas-home-focus-head"><span class="kicker">Próximo passo</span><span class="tdas-pe-chip">${escapeHTML(focusPe)}</span></div>
      <h1>${escapeHTML(focus.title)}</h1>
      <p class="tdas-home-focus-copy">${escapeHTML(statusCopy)}</p>
      <div class="hero-actions tdas-home-actions"><a class="btn primary" href="${primaryHref}">${escapeHTML(primaryLabel)}</a><a class="btn" href="${secondaryHref}">${escapeHTML(secondaryLabel)}</a></div>
      <div class="tdas-home-quick"><span>${escapeHTML(focus.status)}</span><span>${escapeHTML(focusQuestions)} questões</span><span>${escapeHTML(focus.type || focus.block || 'Ciclo oficial')}</span>${focus.rd ? `<span>${escapeHTML(focus.rd)}</span>` : ''}</div>
    </section>
    <section class="grid metrics tdas-home-metrics">
      ${metric('Até a prova', fmtNumber(days), `${days === 0 ? 'Prova hoje' : `${days} dias restantes`} · ${fmtDate(d.meta.examDate)}`)}
      ${metric('PE pendentes', fmtNumber(remaining), `${metrics.completed} de ${metrics.totalPE} cumpridos`)}
      ${metric('Aproveitamento', fmtPct(metrics.accuracy), 'questões com resultado registrado')}
      ${metric('PE atual', todayPe, `${d.today.status} · ${d.today.meta} questões`)}
    </section>
    <section class="section tdas-home-shortcuts"><div class="section-head"><div><h2>Continuar o ciclo</h2><p>Atalhos essenciais; detalhes técnicos ficam fora da Home.</p></div></div><div class="grid three"><a class="card portal tdas-compact-portal" href="${BASE}revisar/"><small>Praticar</small><b>Revisões</b><span>D+1, D+7, D+20 e reforços pendentes.</span><em>Abrir →</em></a><a class="card portal tdas-compact-portal" href="${routes.redacoes}"><small>Discursiva</small><b>Redações</b><span>Produção, correção e prioridades do Banco Discursivo.</span><em>Abrir →</em></a><a class="card portal tdas-compact-portal" href="${BASE}configuracoes/"><small>Sistema</small><b>Configurações</b><span>Sincronização, PWA, backup, fontes e conforto visual.</span><em>Abrir →</em></a></div></section>
    <footer class="footer"><span>TDAS · Cargo 202</span><span>Última sincronização <span data-sync></span></span></footer>`;
} catch (error) {
  setLoadingError(error);
}
