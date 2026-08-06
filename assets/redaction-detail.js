import { BASE, loadJSON, setupShell, fmtDate, metric, escapeHTML, setLoadingError } from './common.js';

const score = value => Number.isFinite(Number(value)) ? Number(value) : null;
const fmtScore = value => score(value) == null ? '—' : Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const safeBreaks = value => escapeHTML(String(value ?? '')).replace(/&lt;br\s*\/?&gt;/gi, '<br>');
function plainBlock(value, empty = 'Não informado no banco.') {
  return value ? `<div class="rd-rich-text">${safeBreaks(value)}</div>` : `<div class="empty">${escapeHTML(empty)}</div>`;
}
function markdownBlock(value) {
  if (!value) return '<div class="empty">Conteúdo motivador não disponível na exportação.</div>';
  const lines = String(value).split(/\r?\n/);
  return `<div class="rd-proposal-markdown">${lines.map(line => {
    const escaped = escapeHTML(line);
    if (/^###\s+/.test(line)) return `<h4>${escapeHTML(line.replace(/^###\s+/,''))}</h4>`;
    if (/^##\s+/.test(line)) return `<h3>${escapeHTML(line.replace(/^##\s+/,''))}</h3>`;
    if (/^#\s+/.test(line)) return `<h2>${escapeHTML(line.replace(/^#\s+/,''))}</h2>`;
    if (/^-\s+/.test(line)) return `<p class="rd-list-item">• ${escapeHTML(line.replace(/^-\s+/,''))}</p>`;
    if (/^\d+\.\s+/.test(line)) return `<p class="rd-list-item">${escaped}</p>`;
    return line.trim() ? `<p>${escaped}</p>` : '<div class="rd-space"></div>';
  }).join('')}</div>`;
}

function criterion(label, value, detail) {
  const width = score(value) == null ? 0 : Math.max(0, Math.min(100, Number(value) / 3 * 100));
  return `<article class="card rd-criterion"><div><small>${label}</small><strong>${fmtScore(value)}<em>/3</em></strong><span>${detail}</span></div><div class="rd-progress"><i style="width:${width}%"></i></div></article>`;
}

async function saveOffline(detail) {
  if (!('caches' in window)) throw new Error('O navegador não oferece armazenamento offline por Cache API.');
  const keys = await caches.keys();
  const cacheName = keys.find(key => key.startsWith('tdas-')) || 'tdas-redactions-offline';
  const cache = await caches.open(cacheName);
  const rd = detail.rd.toLowerCase();
  const resources = [
    `${BASE}redacoes/detalhe/?rd=${encodeURIComponent(detail.rd)}`,
    `${BASE}data/redactions/${rd}.json`,
    `${BASE}assets/redaction-detail.js`,
    `${BASE}assets/redactions-dashboard.css`,
    `${BASE}assets/common.js`,
    `${BASE}assets/styles.css`
  ];
  const responses = await Promise.all(resources.map(async resource => {
    const response = await fetch(resource, { cache: 'reload' });
    if (!response.ok) throw new Error(`Falha ao armazenar ${resource} (${response.status}).`);
    return [resource, response];
  }));
  await Promise.all(responses.map(([resource, response]) => cache.put(resource, response)));
}

try {
  const params = new URLSearchParams(location.search);
  const rd = String(params.get('rd') || '').toUpperCase();
  if (!/^RD\d{2,}$/.test(rd)) throw new Error('Informe uma redação válida, como RD01.');
  const detail = await loadJSON(`data/redactions/${rd.toLowerCase()}.json`);
  const index = await loadJSON('data/redactions.json');
  setupShell('redacoes', index.meta);
  if (detail.access?.locked) {
    document.querySelector('main').innerHTML = `
      <section class="hero rd-detail-hero"><div><span class="kicker">Aplicação cega protegida</span><h1>${escapeHTML(detail.rd)} — ${escapeHTML(detail.meta.theme)}</h1><p>A proposta completa ainda não foi liberada para preservar o treino previsto no calendário.</p></div></section>
      <section class="section"><article class="card panel rd-lock-card"><div class="rd-lock-icon">🔒</div><div><h2>Liberação em ${fmtDate(detail.access.unlockDate)}</h2><p>${escapeHTML(detail.access.reason)}</p><p>Você pode acompanhar o tema, a data e o eixo, mas o comando e os textos motivadores permanecem ocultos até a data planejada.</p><a class="btn" href="${BASE}redacoes/">Voltar ao Dashboard Discursivo</a></div></article></section>`;
  } else {
    const perf = detail.performance;
    document.querySelector('main').innerHTML = `
      <section class="hero rd-detail-hero"><div><span class="kicker">${detail.corrected ? 'Redação corrigida' : 'Proposta disponível'}</span><h1>${escapeHTML(detail.rd)} — ${escapeHTML(detail.meta.theme)}</h1><p>${escapeHTML(detail.meta.axis || 'Eixo não classificado')} · ${escapeHTML(detail.meta.pe || 'PE não vinculado')} · Semana ${escapeHTML(detail.meta.week || '—')}</p></div><div class="rd-hero-actions"><button class="btn" id="offline-rd">Baixar para estudo offline</button><button class="btn secondary" id="print-rd">Imprimir</button></div></section>
      <section class="grid metrics rd-metrics">
        ${metric('Status', detail.meta.status || 'Não informado', fmtDate(detail.meta.date))}
        ${metric('Nota estimada', fmtScore(perf?.score), perf?.classification || 'Sem nota')}
        ${metric('Prioridade', detail.meta.priority || 'Não informada', detail.meta.discursivePriority || '')}
        ${metric('Tipo de treino', detail.meta.type || 'Não informado', detail.meta.solutionNature || '')}
      </section>
      <section class="section rd-two-columns rd-detail-columns">
        <article class="card panel"><h2>Comando</h2>${plainBlock(detail.proposal?.command)}</article>
        <article class="card panel"><h2>Conceitos obrigatórios</h2>${plainBlock(detail.proposal?.requiredConcepts)}</article>
      </section>
      ${detail.proposal?.caseProblem ? `<section class="section"><article class="card panel"><h2>Caso-problema e observações</h2>${plainBlock(detail.proposal.caseProblem)}</article></section>` : ''}
      <section class="section"><article class="card panel"><div class="section-head"><div><h2>Proposta completa</h2><p>Textos motivadores, instruções e comando liberados para esta RD.</p></div></div>${markdownBlock(detail.proposal?.markdown)}</article></section>
      ${detail.corrected ? `
        <section class="section"><div class="section-head"><div><h2>Desempenho por critério</h2><p>Rubrica de treino CAC, OT e DLP.</p></div></div><div class="grid rd-criteria">${criterion('CAC',perf.criteria?.cac,'Conteúdo e atendimento ao comando')}${criterion('OT',perf.criteria?.ot,'Organização textual')}${criterion('DLP',perf.criteria?.dlp,'Domínio da língua portuguesa')}</div></section>
        <section class="section"><article class="card panel"><h2>Texto original</h2>${plainBlock(detail.original?.text,'Texto original não registrado.')}<p class="rd-note">Linhas utilizadas: <strong>${escapeHTML(detail.original?.lines ?? 'não informado')}</strong>.</p></article></section>
        <section class="section"><article class="card panel rd-feedback"><h2>Correção estratégica</h2>${plainBlock(detail.feedback?.strategicCorrection,'Correção estratégica não registrada.')}</article></section>
        <section class="section rd-two-columns rd-detail-columns"><article class="card panel"><h2>Diagnóstico</h2><dl class="rd-definition"><dt>Falha principal</dt><dd>${escapeHTML(detail.feedback?.mainFailure || 'Não informada')}</dd><dt>Padrão dominante</dt><dd>${escapeHTML(detail.feedback?.dominantPattern || 'Não informado')}</dd><dt>Próxima ação</dt><dd>${escapeHTML(detail.feedback?.nextAction || 'Não informada')}</dd><dt>Frase-chave</dt><dd>${escapeHTML(detail.feedback?.keyPhrase || 'Não informada')}</dd></dl></article><article class="card panel"><h2>Controles</h2><ul class="rd-checks"><li data-done="${Boolean(detail.feedback?.allCommandsAnswered)}">Respondeu todos os comandos</li><li data-done="${Boolean(detail.feedback?.organized)}">Organização textual conferida</li><li data-done="${Boolean(detail.feedback?.portugueseReviewed)}">Português revisado</li><li data-done="${Boolean(detail.feedback?.canBeModel)}">Pode virar modelo</li><li data-done="${Boolean(detail.feedback?.becomesFlashcard)}">Vira flashcard</li><li data-done="${Boolean(detail.feedback?.becomesErrorNotebook)}">Vira caderno de erros</li></ul></article></section>
        <section class="section"><article class="card panel"><h2>Reescrita para nota máxima</h2>${plainBlock(detail.model?.maximumRewrite,'Reescrita ainda não registrada.')}</article></section>
        <section class="section rd-two-columns rd-detail-columns"><article class="card panel"><h2>Estrutura argumentativa</h2><dl class="rd-definition"><dt>Tese</dt><dd>${escapeHTML(detail.model?.thesis || 'Não informada')}</dd><dt>Argumento 1</dt><dd>${escapeHTML(detail.model?.argument1 || 'Não informado')}</dd><dt>Argumento 2</dt><dd>${escapeHTML(detail.model?.argument2 || 'Não informado')}</dd></dl></article><article class="card panel"><h2>Repertório</h2>${plainBlock(detail.model?.repertoire)}</article></section>
      ` : `<section class="section"><article class="card panel rd-privacy"><h2>Correção ainda indisponível</h2><p>O texto, a nota e os diagnósticos só serão publicados depois que esta redação for produzida e corrigida no banco oficial.</p></article></section>`}
      <section class="section"><div class="rd-bottom-actions"><a class="btn secondary" href="${BASE}redacoes/">← Voltar ao dashboard</a><a class="btn secondary" href="${escapeHTML(detail.meta.sourceUrl)}" target="_blank" rel="noopener">Abrir registro no Notion</a></div></section>
      <footer class="footer"><span>${escapeHTML(detail.rd)} · Banco Discursivo</span><span>Snapshot <span data-snapshot></span></span></footer>`;
    const offlineButton = document.querySelector('#offline-rd');
    offlineButton.onclick = async () => {
      offlineButton.disabled = true;
      const previous = offlineButton.textContent;
      offlineButton.textContent = 'Salvando…';
      try {
        await saveOffline(detail);
        offlineButton.textContent = 'Disponível offline ✓';
      } catch (error) {
        offlineButton.textContent = previous;
        alert(error.message);
      } finally {
        offlineButton.disabled = false;
      }
    };
    document.querySelector('#print-rd').onclick = () => window.print();
  }
} catch (error) {
  setLoadingError(error);
}
