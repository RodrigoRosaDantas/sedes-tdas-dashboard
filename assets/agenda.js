import { BASE, loadJSON, setupShell, fmtDate, fmtNumber, metric, escapeHTML, setLoadingError } from './common.js?v=26.16.0';

const peHref = pe => `${BASE}estudar/?pe=${encodeURIComponent(pe || '')}`;
const itemType = item => item?.type || item?.typ || item?.block || 'Não informado';
const itemQuestions = item => item?.planned_questions || item?.meta || '—';
const plural = (value, singular, pluralForm) => `${value} ${value === 1 ? singular : pluralForm}`;
const timelineCard = (item, dateLabel = fmtDate(item.date)) => `
  <a class="card timeline-item" href="${peHref(item.pe)}">
    <span class="timeline-date">${escapeHTML(dateLabel)}</span>
    <div>
      <b>${escapeHTML(item.pe)} · ${escapeHTML(item.title)}</b>
      <small>${escapeHTML(itemType(item))} · ${escapeHTML(itemQuestions(item))} questões${item.rd ? ` · ${escapeHTML(item.rd)}` : ''}</small>
    </div>
    <span class="status warning">${escapeHTML(item.status || 'Não informado')}</span>
  </a>`;

try {
  const d = await loadJSON('data/agenda.json');
  setupShell('agenda', d.meta);
  const overdue = Array.isArray(d.overdue) ? d.overdue : [];
  const future = Array.isArray(d.allFuture) ? d.allFuture : [];
  const latest = d.latestCompleted || d.recentCompleted?.at(-1) || null;
  const overdueDetail = `${plural(overdue.length, 'atrasado', 'atrasados')} · ${plural(future.length, 'no calendário', 'no calendário')}`;

  document.querySelector('main').innerHTML = `
    <section class="hero">
      <span class="kicker">Planejamento executável</span>
      <h1>Agenda</h1>
      <p>O próximo passo já está definido. Pendências vencidas permanecem visíveis até a conclusão oficial.</p>
    </section>
    <section class="grid metrics">
      ${metric('PE pendentes', d.summary.remainingPE, overdueDetail)}
      ${metric('Ritmo necessário', d.summary.pace.toFixed(2).replace('.', ','), 'PE por dia')}
      ${metric('Questões planejadas', fmtNumber(d.summary.plannedQuestionsMidpoint), 'pendências + calendário')}
      ${metric('Último PE concluído', latest?.pe || '—', latest ? `${fmtDate(latest.date)} · ${latest.status}` : 'Nenhum registro concluído')}
    </section>
    ${overdue.length ? `<section class="section"><div class="section-head"><div><h2>Pendências anteriores</h2><p>PE vencidos não são descartados quando o calendário avança.</p></div><span class="status critical">${plural(overdue.length, 'atrasado', 'atrasados')}</span></div><div class="timeline">${overdue.map(item => timelineCard(item)).join('')}</div></section>` : ''}
    <section class="section">
      <div class="section-head"><div><h2>PE atual</h2><p>Atividade prevista para o snapshot de hoje.</p></div></div>
      <div class="timeline">${d.current ? timelineCard(d.current, 'Hoje') : '<div class="empty">Nenhum PE atual informado.</div>'}</div>
    </section>
    <section class="section">
      <div class="section-head"><div><h2>Próximos PE</h2><p>Planejamento posterior ao PE atual, separado dos resultados e das pendências anteriores.</p></div></div>
      <div class="toolbar">
        <label>Janela<select id="window"><option value="7">Próximos 7</option><option value="14" selected>Próximos 14</option><option value="all">Todo o restante</option></select></label>
        <label>Tipo<select id="type"><option value="all">Todos</option>${[...new Set(future.map(itemType))].map(type => `<option>${escapeHTML(type)}</option>`).join('')}</select></label>
      </div>
      <div class="timeline" id="timeline"></div>
    </section>
    <section class="section">
      <div class="section-head"><div><h2>Últimos dias concluídos</h2><p>Contexto rápido antes de avançar.</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>PE</th><th>Data</th><th>Atividade</th><th>Meta</th><th>Resultado</th></tr></thead><tbody>${(d.recentCompleted || []).map(item => `<tr><td>${escapeHTML(item.pe)}</td><td>${fmtDate(item.date)}</td><td>${escapeHTML(item.title)}</td><td>${escapeHTML(item.meta)}</td><td>${item.acertos ?? 'Pendente'}${item.accuracy != null ? ` · ${item.accuracy.toFixed(2).replace('.', ',')}%` : ''}</td></tr>`).join('')}</tbody></table></div>
    </section>
    <section class="section"><article class="card formula"><small>Fórmula do ritmo</small><strong>${d.summary.pace.toFixed(2).replace('.', ',')} PE/dia</strong><code>${d.summary.remainingPE} PE pendentes (${plural(overdue.length, 'atrasado', 'atrasados')}) ÷ ${d.summary.operationalDays} dias operacionais inclusivos</code></article></section>
    <footer class="footer"><span>Agenda · planejamento oficial</span><span>Snapshot <span data-snapshot></span></span></footer>`;

  const windowSelect = document.querySelector('#window');
  const typeSelect = document.querySelector('#type');
  const timeline = document.querySelector('#timeline');
  const currentNumber = Number(String(d.current?.pe || '').replace(/\D/g, ''));
  function render() {
    let rows = future
      .filter(item => Number(item.number) > currentNumber)
      .filter(item => typeSelect.value === 'all' || itemType(item) === typeSelect.value);
    if (windowSelect.value !== 'all') rows = rows.slice(0, Number(windowSelect.value));
    timeline.innerHTML = rows.map(item => timelineCard(item)).join('') || '<div class="empty">Nenhum PE para o filtro.</div>';
  }
  windowSelect.onchange = typeSelect.onchange = render;
  render();
} catch (error) {
  setLoadingError(error);
}
