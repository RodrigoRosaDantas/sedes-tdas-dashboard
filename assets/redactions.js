import { loadJSON, setupShell, fmtDate, metric, escapeHTML, setLoadingError } from './common.js';

const score = value => Number.isFinite(Number(value)) ? Number(value) : null;
const fmtScore = value => score(value) == null ? '—' : Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const statusTone = value => /corrigid|reescrit/.test(norm(value)) ? 'success' : /risco|bloquead/.test(norm(value)) ? 'danger' : /andamento|estruturad|escrit/.test(norm(value)) ? 'info' : 'warning';

function fallbackDashboard(data) {
  const corrected = data.redactions.filter(item => score(item.score) != null && score(item.score) > 0);
  const values = corrected.map(item => score(item.score));
  const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  return {
    summary: {
      total: data.redactions.length,
      corrected: corrected.length,
      pending: Math.max(0, data.redactions.length - corrected.length),
      average,
      median: null,
      best: corrected.length ? [...corrected].sort((a, b) => score(b.score) - score(a.score))[0] : null,
      worst: corrected.length ? [...corrected].sort((a, b) => score(a.score) - score(b.score))[0] : null,
      last: corrected.at(-1) || null,
      target: 75,
      distanceToTarget: average == null ? null : 75 - average,
      weeksRemaining: data.summary?.weeksRemaining || 0,
      perWeek: data.summary?.perWeek || 0,
      readiness: average || 0
    },
    bands: {
      strong: values.filter(value => value >= 75).length,
      approvable: values.filter(value => value >= 50 && value < 75).length,
      risk: values.filter(value => value < 50).length
    },
    criteria: { cac: null, ot: null, dlp: null },
    evolution: corrected.map(item => ({ rd: item.rd, score: score(item.score), movingAverage3: null, theme: item.theme, axis: item.axis || '' })),
    axes: [], failures: [], priorities: [],
    readiness: { value: average || 0, label: 'Em implantação', components: {}, notice: 'Índice interno de estudo.' }
  };
}

function evolutionChart(rows) {
  if (!rows.length) return '<div class="empty">As notas aparecerão após a primeira correção exportada.</div>';
  const W = 920, H = 330, left = 52, right = 24, top = 24, bottom = 48;
  const min = Math.max(0, Math.min(40, ...rows.map(item => Number(item.score) - 6)));
  const max = 100;
  const sx = index => left + index * (W - left - right) / Math.max(1, rows.length - 1);
  const sy = value => H - bottom - (Number(value) - min) * (H - top - bottom) / Math.max(1, max - min);
  const gridValues = [50, 60, 75, 90];
  const grids = gridValues.map(value => `<line x1="${left}" y1="${sy(value)}" x2="${W-right}" y2="${sy(value)}" class="rd-grid"/><text x="8" y="${sy(value)+4}" class="rd-axis-label">${value}</text>`).join('');
  const scorePoints = rows.map((item, index) => `${sx(index)},${sy(item.score)}`).join(' ');
  const movingRows = rows.filter(item => score(item.movingAverage3) != null);
  const movingPoints = movingRows.map(item => {
    const index = rows.indexOf(item);
    return `${sx(index)},${sy(item.movingAverage3)}`;
  }).join(' ');
  const dots = rows.map((item, index) => `<a href="/sedes-tdas-dashboard/redacoes/detalhe/?rd=${encodeURIComponent(item.rd)}"><circle cx="${sx(index)}" cy="${sy(item.score)}" r="5" class="rd-score-dot"><title>${escapeHTML(item.rd)}: ${fmtScore(item.score)} pontos</title></circle></a><text x="${sx(index)}" y="${H-20}" text-anchor="middle" class="rd-x-label">${escapeHTML(item.rd)}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolução das notas das redações"><title>Evolução das notas das redações</title>${grids}<line x1="${left}" y1="${sy(75)}" x2="${W-right}" y2="${sy(75)}" class="rd-target"><title>Meta de 75 pontos</title></line><polyline points="${scorePoints}" class="rd-score-line"/>${movingPoints ? `<polyline points="${movingPoints}" class="rd-moving-line"/>` : ''}${dots}</svg><div class="rd-chart-legend"><span><i class="legend-score"></i>Nota obtida</span><span><i class="legend-moving"></i>Média móvel de 3 redações</span><span><i class="legend-target"></i>Meta de 75</span></div>`;
}

function criteriaCards(criteria) {
  const rows = [
    { label: 'CAC', value: criteria.cac, detail: 'Conteúdo e atendimento ao comando' },
    { label: 'OT', value: criteria.ot, detail: 'Organização textual' },
    { label: 'DLP', value: criteria.dlp, detail: 'Domínio da língua portuguesa' }
  ];
  return rows.map(item => {
    const width = item.value == null ? 0 : Math.max(0, Math.min(100, item.value / 3 * 100));
    return `<article class="card rd-criterion"><div><small>${item.label}</small><strong>${item.value == null ? '—' : Number(item.value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<em>/3</em></strong><span>${item.detail}</span></div><div class="rd-progress" aria-label="${item.label}: ${width.toFixed(0)}% da escala"><i style="width:${width}%"></i></div></article>`;
  }).join('');
}

function distribution(bands) {
  const rows = [
    ['Forte', bands.strong || 0, '75 ou mais'],
    ['Aprovável', bands.approvable || 0, '50 a 74,99'],
    ['Risco', bands.risk || 0, 'abaixo de 50']
  ];
  const max = Math.max(1, ...rows.map(item => item[1]));
  return rows.map(([label, value, detail]) => `<div class="rd-dist-row"><div><strong>${label}</strong><span>${detail}</span></div><div class="rd-dist-track"><i style="width:${Math.max(value ? 8 : 0, value/max*100)}%"></i></div><b>${value}</b></div>`).join('');
}

function axesTable(rows) {
  if (!rows?.length) return '<div class="empty">Os dados por eixo serão calculados na próxima sincronização discursiva.</div>';
  return `<div class="table-wrap"><table><thead><tr><th>Eixo</th><th>Total</th><th>Corrigidas</th><th>Pendentes</th><th>Média</th><th>Melhor</th></tr></thead><tbody>${rows.map(item => `<tr><td>${escapeHTML(item.axis)}</td><td>${item.total}</td><td>${item.corrected}</td><td>${item.pending}</td><td>${fmtScore(item.average)}</td><td>${fmtScore(item.best)}</td></tr>`).join('')}</tbody></table></div>`;
}

function prioritiesList(rows) {
  if (!rows?.length) return '<div class="empty">Nenhuma prioridade automática disponível.</div>';
  return `<div class="rd-priority-list">${rows.map((item, index) => `<a class="card rd-priority" href="${item.href}"><span class="rd-priority-rank">${index+1}</span><div><strong>${escapeHTML(item.rd)} — ${escapeHTML(item.theme)}</strong><p>${escapeHTML(item.reasons.join(' · '))}</p><small>${escapeHTML(item.action)}</small></div><b>${fmtScore(item.score)}</b></a>`).join('')}</div>`;
}

function failureList(rows) {
  if (!rows?.length) return '<div class="empty">Os padrões de erro aparecerão conforme as correções forem consolidadas.</div>';
  const max = Math.max(1, ...rows.map(item => item.count));
  return `<div class="rd-failures">${rows.slice(0, 8).map(item => `<div><span>${escapeHTML(item.label)}</span><div class="rd-failure-track"><i style="width:${item.count/max*100}%"></i></div><b>${item.count}</b></div>`).join('')}</div>`;
}

function readinessCard(readiness) {
  const value = Number(readiness?.value || 0);
  return `<article class="card rd-readiness"><div class="rd-ring" style="--value:${Math.max(0,Math.min(100,value))}"><strong>${value.toLocaleString('pt-BR',{maximumFractionDigits:1})}</strong><small>/100</small></div><div><span class="kicker">Prontidão Discursiva TDAS</span><h3>${escapeHTML(readiness?.label || 'Em consolidação')}</h3><p>${escapeHTML(readiness?.notice || 'Índice interno de acompanhamento.')}</p><div class="rd-components">${Object.entries(readiness?.components || {}).map(([key,val])=>`<span>${escapeHTML(({averageScore:'Média',recentTrend:'Tendência',command:'Comando',regularity:'Regularidade',rewrites:'Reescritas',languageReview:'Revisão linguística'})[key]||key)} <b>${Number(val).toLocaleString('pt-BR',{maximumFractionDigits:1})}</b></span>`).join('')}</div></div></article>`;
}

function csvDownload(rows) {
  const header = ['RD','Semana','PE','Data','Tema','Eixo','Status','Nota','Faixa','Prioridade'];
  const values = rows.map(item => [item.rd,item.week,item.pe,item.date,item.theme,item.axis,item.status,item.score ?? '',item.classification,item.priority]);
  const csv = [header, ...values].map(row => row.map(value => `"${String(value ?? '').replaceAll('"','""')}"`).join(';')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'dashboard_discursivo_TDAS.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

try {
  const data = await loadJSON('data/redactions.json');
  setupShell('redacoes', data.meta);
  const dashboard = data.dashboard || fallbackDashboard(data);
  const summary = dashboard.summary;
  document.querySelector('main').innerHTML = `
    <section class="hero rd-hero"><div><span class="kicker">Preparação discursiva</span><h1>Dashboard Discursivo</h1><p>Acompanhe evolução, critérios, ritmo, padrões de erro e prioridades da RD01 até a última redação cadastrada.</p></div><div class="rd-hero-actions"><button class="btn" id="export-redactions">Baixar resumo</button><a class="btn secondary" href="#banco">Abrir banco</a></div></section>
    <section class="grid metrics rd-metrics">
      ${metric('Redações previstas', summary.total, 'sequência oficial do banco')}
      ${metric('Corrigidas', summary.corrected, `${summary.pending} ainda pendentes`)}
      ${metric('Média geral', fmtScore(summary.average), summary.average == null ? 'aguardando notas' : `meta ${fmtScore(summary.target)}`)}
      ${metric('Melhor resultado', summary.best ? fmtScore(summary.best.score) : '—', summary.best?.rd || 'sem resultado')}
      ${metric('Última nota', summary.last ? fmtScore(summary.last.score) : '—', summary.last?.rd || 'sem resultado')}
      ${metric('Ritmo necessário', Number(summary.perWeek || 0).toLocaleString('pt-BR',{maximumFractionDigits:1}), 'redações por semana')}
    </section>
    <section class="section rd-two-columns">
      <article class="card panel rd-chart-card"><div class="section-head"><div><h2>Evolução das notas</h2><p>Nota obtida, média móvel e meta de 75 pontos.</p></div></div><div class="rd-chart">${evolutionChart(dashboard.evolution || [])}</div></article>
      ${readinessCard(dashboard.readiness)}
    </section>
    <section class="section"><div class="section-head"><div><h2>Evolução por critério</h2><p>Médias de CAC, OT e DLP na escala de 0 a 3.</p></div></div><div class="grid rd-criteria">${criteriaCards(dashboard.criteria || {})}</div></section>
    <section class="section rd-two-columns">
      <article class="card panel"><h2>Distribuição das notas</h2><p>Faixas internas utilizadas no acompanhamento.</p><div class="rd-distribution">${distribution(dashboard.bands || {})}</div>${summary.distanceToTarget == null ? '' : `<p class="rd-note">Distância da média atual até 75 pontos: <strong>${fmtScore(summary.distanceToTarget)}</strong>.</p>`}</article>
      <article class="card panel"><h2>Padrões de erro</h2><p>Principais falhas registradas nas redações corrigidas.</p>${failureList(dashboard.failures)}</article>
    </section>
    <section class="section"><div class="section-head"><div><h2>Desempenho por eixo</h2><p>Compare execução e notas entre os conteúdos do edital.</p></div></div>${axesTable(dashboard.axes)}</section>
    <section class="section"><div class="section-head"><div><h2>Fila estratégica</h2><p>Prioridades calculadas por nota, núcleo do edital, reescrita e revisão linguística.</p></div></div>${prioritiesList(dashboard.priorities)}</section>
    <section class="section" id="banco"><div class="section-head"><div><h2>Banco Discursivo</h2><p>Status real, nota e acesso individual de RD01 até a última.</p></div></div><div class="toolbar rd-toolbar"><label>Pesquisar<input id="search" type="search" placeholder="RD, tema, PE ou eixo"></label><label>Status<select id="status"><option value="all">Todos</option></select></label><label>Eixo<select id="axis"><option value="all">Todos</option></select></label><label>Semana<select id="week"><option value="all">Todas</option></select></label></div><div class="table-wrap"><table><thead><tr><th>RD</th><th>Semana</th><th>PE</th><th>Data</th><th>Tema</th><th>Status</th><th>Nota</th><th>Acesso</th></tr></thead><tbody id="rows"></tbody></table></div></section>
    <section class="section"><article class="card panel rd-privacy"><h3>Proteção da aplicação cega</h3><p>${escapeHTML(data.privacy?.notice || data.notice || 'Conteúdos futuros permanecem protegidos.')}</p></article></section>
    <footer class="footer"><span>Dashboard Discursivo · banco oficial</span><span>Snapshot <span data-snapshot></span></span></footer>`;

  const rows = document.querySelector('#rows');
  const search = document.querySelector('#search');
  const status = document.querySelector('#status');
  const axis = document.querySelector('#axis');
  const week = document.querySelector('#week');
  const unique = key => [...new Set(data.redactions.map(item => item[key]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'pt-BR',{numeric:true}));
  status.insertAdjacentHTML('beforeend', unique('status').map(value => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join(''));
  axis.insertAdjacentHTML('beforeend', unique('axis').map(value => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join(''));
  week.insertAdjacentHTML('beforeend', unique('week').map(value => `<option value="${escapeHTML(value)}">Semana ${escapeHTML(value)}</option>`).join(''));
  const params = new URLSearchParams(location.search);
  const focus = [params.get('rd'), params.get('pe')].filter(Boolean).join(' ').trim();
  if (focus) search.value = focus;
  function render() {
    const q = norm(search.value).trim();
    const filtered = data.redactions.filter(item =>
      (status.value === 'all' || item.status === status.value) &&
      (axis.value === 'all' || item.axis === axis.value) &&
      (week.value === 'all' || String(item.week) === week.value) &&
      (!q || norm([item.rd,item.pe,item.theme,item.axis,item.status].join(' ')).includes(q))
    );
    rows.innerHTML = filtered.map(item => {
      const href = `/sedes-tdas-dashboard/redacoes/detalhe/?rd=${encodeURIComponent(item.rd)}`;
      const access = item.locked ? `Bloqueada até ${fmtDate(item.date)}` : item.corrected ? 'Correção disponível' : 'Proposta disponível';
      return `<tr${focus && norm([item.rd,item.pe].join(' ')).includes(norm(focus)) ? ' data-focused-redaction="true"' : ''}><td><a class="rd-code" href="${href}">${escapeHTML(item.rd)}</a></td><td>${escapeHTML(item.week)}</td><td>${escapeHTML(item.pe || '—')}</td><td>${fmtDate(item.date)}</td><td><a href="${href}">${escapeHTML(item.theme)}</a><small class="rd-table-axis">${escapeHTML(item.axis || '')}</small></td><td><span class="status ${statusTone(item.status)}">${escapeHTML(item.status || 'Não informado')}</span></td><td><strong>${fmtScore(item.score)}</strong><small class="rd-classification">${escapeHTML(item.classification || 'Sem nota')}</small></td><td><a class="rd-access ${item.locked?'locked':''}" href="${href}">${escapeHTML(access)} →</a></td></tr>`;
    }).join('') || '<tr><td colspan="8" class="empty">Nenhuma redação encontrada.</td></tr>';
  }
  search.oninput = status.onchange = axis.onchange = week.onchange = render;
  document.querySelector('#export-redactions').onclick = () => csvDownload(data.redactions);
  render();
} catch (error) {
  setLoadingError(error);
}
