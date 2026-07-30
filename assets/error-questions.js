import { loadJSON, setupShell, fmtNumber, fmtDate, escapeHTML, metric, setLoadingError } from './common.js';

const BASE = '/sedes-tdas-dashboard/';
const safeLines = value => escapeHTML(value || '').replace(/\r?\n/g, '<br>');
const normalized = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

try {
  const index = await loadJSON('data/error-questions/index.json');
  setupShell('riscos', index.meta);
  document.querySelector('main').innerHTML = `
    <section class="hero">
      <span class="kicker">Caderno de Erros autorizado</span>
      <h1>Questões que errei</h1>
      <p>Questões, classificações e resumos integrais publicados diretamente das três fontes oficiais do Notion.</p>
      <div class="detail-actions"><a class="btn" href="${BASE}riscos/">Ver análise de riscos</a><a class="btn" href="${BASE}auditoria/">Abrir auditoria</a></div>
    </section>
    <section class="grid metrics">
      ${metric('Questões catalogadas', fmtNumber(index.total), 'registros reais com Questão / Erro')}
      ${metric('Matérias', fmtNumber(index.materias), 'agrupamentos atuais')}
      ${metric('Reincidentes', fmtNumber(index.reincidentes), 'reincidência maior que zero')}
      ${metric('Altos ou críticos', fmtNumber(index.altosCriticos), 'prioridade de revisão')}
    </section>
    <section class="section">
      <div class="section-head"><div><h2>Busca e filtros</h2><p>O carregamento acontece em partes de até 20 registros para funcionar bem no celular.</p></div><span class="stamp" id="load-status">0 de ${index.total}</span></div>
      <div class="error-filter-grid">
        <label>Busca global<input id="error-search" type="search" placeholder="Questão, resumo, tema, PE ou matéria"></label>
        <label>Matéria<select id="error-subject"><option value="all">Todas</option>${index.subjects.map(item => `<option value="${escapeHTML(item.subject)}">${escapeHTML(item.subject)} (${item.count})</option>`).join('')}</select></label>
        <label>Gravidade<select id="error-severity"><option value="all">Todas</option><option>Crítica</option><option>Alta</option><option>Média</option><option>Baixa</option><option>Não informada</option></select></label>
        <label>Reincidência<select id="error-recurrence"><option value="all">Todas</option><option value="yes">Somente reincidentes</option><option value="no">Sem reincidência</option></select></label>
      </div>
    </section>
    <section class="section"><div id="error-results" class="error-subject-groups"><div class="card panel"><p>Carregando a primeira parte…</p></div></div></section>
    <footer class="footer"><span>Questões erradas · dados oficiais</span><span>Snapshot <span data-snapshot></span></span></footer>`;

  const search = document.querySelector('#error-search');
  const subject = document.querySelector('#error-subject');
  const severity = document.querySelector('#error-severity');
  const recurrence = document.querySelector('#error-recurrence');
  const results = document.querySelector('#error-results');
  const status = document.querySelector('#load-status');
  const records = [];
  let loadedParts = 0;

  function incomplete(record) {
    const missing = [];
    if (!record.materia) missing.push('Matéria');
    if (!record.origem) missing.push('Origem / Dia ID');
    if (!record.data) missing.push('Data');
    if (!record.gravidade) missing.push('Gravidade');
    if (!record.resumo) missing.push('Resumo');
    return missing;
  }

  function matches(record) {
    const query = normalized(search.value.trim());
    const haystack = normalized([record.questaoErro, record.materia, record.origem, record.gravidade, record.tema, record.subtema, ...(record.padraoErro || []), record.resumo].join(' '));
    return (!query || haystack.includes(query))
      && (subject.value === 'all' || record.materia === subject.value)
      && (severity.value === 'all' || record.gravidade === severity.value)
      && (recurrence.value === 'all' || recurrence.value === 'yes' && Number(record.reincidencia) > 0 || recurrence.value === 'no' && Number(record.reincidencia) === 0);
  }

  function renderCard(record) {
    const missing = incomplete(record);
    const patterns = (record.padraoErro || []).map(item => `<span class="tag">${escapeHTML(item)}</span>`).join('');
    return `<details class="card error-question-card">
      <summary>
        <span><small>${escapeHTML(record.origem || 'Origem ausente')} · ${fmtDate(record.data)}</small><strong>${escapeHTML(record.questaoErro)}</strong><em>${escapeHTML(record.materia || 'Matéria ausente')}</em></span>
        <span class="status ${record.gravidade === 'Alta' || record.gravidade === 'Crítica' ? 'critical' : 'warning'}">${escapeHTML(record.gravidade || 'Não informada')}</span>
      </summary>
      <div class="error-question-body">
        ${missing.length ? `<div class="quality-note"><b>Registro incompleto.</b> Campos ausentes na fonte: ${escapeHTML(missing.join(', '))}.</div>` : ''}
        <div class="tags"><span class="tag">Reincidência: ${fmtNumber(record.reincidencia || 0)}</span><span class="tag">Flashcard: ${record.flashcard ? 'Sim' : 'Não'}</span><span class="tag">Revisado: ${record.revisado ? 'Sim' : 'Não'}</span>${patterns}</div>
        ${(record.tema || record.subtema) ? `<div class="error-topic"><b>${escapeHTML(record.tema || 'Tema não informado')}</b><span>${escapeHTML(record.subtema || '')}</span></div>` : ''}
        <div class="error-summary">${record.resumo ? safeLines(record.resumo) : '<p>Resumo não preenchido no registro oficial.</p>'}</div>
        <div class="detail-actions"><a class="btn" href="${record.url}" target="_blank" rel="noopener">Abrir registro no Notion ↗</a>${record.origem ? `<a class="btn" href="${BASE}pe/${Number(String(record.origem).replace(/\D/g, ''))}/">Abrir ${escapeHTML(record.origem)}</a>` : ''}</div>
      </div>
    </details>`;
  }

  function render() {
    const filtered = records.filter(matches);
    const groups = new Map();
    for (const record of filtered) {
      const key = record.materia || 'Não classificado';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(record);
    }
    results.innerHTML = filtered.length ? [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, items]) => `
      <section class="error-subject-group">
        <div class="section-head"><div><h2>${escapeHTML(name)}</h2><p>${items.length} registro(s) no filtro atual.</p></div><a class="btn" href="${BASE}materias/${normalized(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}/">Ver matéria</a></div>
        <div class="error-card-list">${items.map(renderCard).join('')}</div>
      </section>`).join('') : '<div class="empty">Nenhuma questão encontrada para os filtros atuais.</div>';
    status.textContent = `${records.length} de ${index.total} carregadas${loadedParts < index.parts.length ? ' · carregando…' : ''}`;
  }

  for (const control of [search, subject, severity, recurrence]) control.addEventListener(control === search ? 'input' : 'change', render);
  for (const part of index.parts) {
    const rows = await loadJSON(`data/error-questions/${part.file}`);
    records.push(...rows);
    loadedParts++;
    render();
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
  status.textContent = `${records.length} de ${index.total} carregadas`;
} catch (error) {
  setLoadingError(error);
}
