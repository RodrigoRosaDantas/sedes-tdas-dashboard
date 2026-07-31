import {BASE, escapeHTML, loadJSON, setupShell, setLoadingError} from '../common.js?v=24.1';
import {readErrors, readMarked} from './classification-store.js?v=1.0.0';

const main = document.querySelector('main');
const classificationLabels = Object.freeze({
  incorrect_confirmed: 'Erro confirmado',
  marked: 'Marcada para revisão',
});

function formatDate(timestamp) {
  return new Intl.DateTimeFormat('pt-BR', {dateStyle: 'short', timeStyle: 'short'}).format(new Date(timestamp));
}

try {
  const shell = await loadJSON('data/more.json');
  setupShell('mais', shell.meta);
  const errors = readErrors();
  const marked = readMarked();
  main.innerHTML = `
    <section class="hero">
      <span class="kicker">Caderno local · piloto</span>
      <h1>Caderno de erros</h1>
      <p>Somente erros confirmados das tentativas locais. Possível anulação e erro da fonte permanecem fora deste caderno.</p>
      <div class="tags"><span class="tag">${errors.length} erros confirmados</span><span class="tag">${marked.length} marcações</span><span class="tag">Sem progresso oficial</span></div>
      <div class="hero-actions"><a class="btn primary" href="${BASE}resolver/?pilot=pe76">Resolver piloto</a><a class="btn" href="${BASE}questoes-erros/">Abrir acervo oficial atual</a></div>
    </section>
    <section class="section">
      <div class="section-head"><div><h2>Erros confirmados locais</h2><p>Registros elegíveis pela classificação <code>incorrect_confirmed</code>.</p></div></div>
      ${errors.length ? `<div class="grid two">${errors.map(item => `<article class="card panel"><small>${escapeHTML(item.peId)} · questão ${item.numeroOriginal} · ${formatDate(item.createdAt)}</small><h3>${escapeHTML(item.subassunto || item.assunto)}</h3><p>Marcada: <strong>${escapeHTML(item.selected)}</strong> · Gabarito: <strong>${escapeHTML(item.correctAnswer)}</strong></p><div class="tags"><span class="tag">${escapeHTML(classificationLabels[item.classification] || item.classification)}</span>${item.marked ? '<span class="tag">Também marcada</span>' : ''}</div></article>`).join('')}</div>` : '<article class="card panel"><h3>Nenhum erro confirmado local</h3><p>Conclua o piloto para formar o caderno. Ressalvas editoriais não entram aqui.</p></article>'}
    </section>
    <section class="section">
      <div class="section-head"><div><h2>Marcações para revisão</h2><p>Questões marcadas independentemente de acerto ou erro.</p></div></div>
      ${marked.length ? `<div class="grid two">${marked.map(item => `<article class="card panel"><small>${escapeHTML(item.peId)} · questão ${item.numeroOriginal}</small><h3>${escapeHTML(item.subassunto || item.assunto)}</h3><p>${escapeHTML(classificationLabels[item.classification] || item.classification)} · ${escapeHTML(item.confidence)}</p></article>`).join('')}</div>` : '<article class="card panel"><p>Nenhuma questão marcada neste dispositivo.</p></article>'}
    </section>
    <section class="section"><article class="card panel"><h2>Separação preservada</h2><p>Este caderno local do piloto não substitui nem modifica o acervo oficial em <code>/questoes-erros/</code>.</p></article></section>
    <footer class="footer"><span>Caderno local · Fase 6</span><span>Snapshot <span data-snapshot></span></span></footer>`;
} catch (error) {
  setLoadingError(error);
}
