import {BASE, escapeHTML, loadJSON, setupShell, setLoadingError} from '../common.js?v=24.1';
import {readModuleState} from './module-store.js?v=2.0.0';

try {
  const [catalog, navigation, shell] = await Promise.all([
    fetch(BASE + 'data/integration/question-catalog.json', {cache: 'no-store'}).then(response => {
      if (!response.ok) throw new Error(`Falha ao carregar catálogo autorizado (${response.status}).`);
      return response.json();
    }),
    fetch(BASE + 'data/integration/navigation.json', {cache: 'no-store'}).then(response => response.json()),
    loadJSON('data/more.json'),
  ]);
  setupShell('mais', shell.meta);
  const state = readModuleState();
  const available = Array.isArray(catalog.questions) && catalog.questions.length > 0;
  document.querySelector('main').innerHTML = `
    <section class="hero">
      <span class="kicker">Módulo de questões · uso real</span>
      <h1>Estudar</h1>
      <p>Resolver, revisar, classificar erros e acompanhar desempenho em um módulo local, sem escrever no Notion.</p>
      <div class="tags">
        <span class="tag">${available ? `${catalog.questions.length} questões autorizadas` : 'Nenhuma questão autorizada incorporada'}</span>
        <span class="tag">${state.attempts.length} tentativas locais</span>
        <span class="tag">Dados do módulo neste dispositivo</span>
      </div>
      <div class="hero-actions">
        <a class="btn primary" href="${BASE}resolver/">${available ? 'Iniciar sessão' : 'Abrir Resolver'}</a>
        <a class="btn" href="${BASE}revisar/">Revisar</a>
        <a class="btn" href="${BASE}desempenho/">Ver desempenho</a>
      </div>
    </section>
    ${available ? `<section class="section"><article class="card panel"><small>Catálogo ativo</small><h2>${escapeHTML(catalog.title)}</h2><p>${escapeHTML(catalog.description || '')}</p></article></section>` : `
    <section class="section">
      <article class="card panel">
        <small>Estado operacional vazio</small>
        <h2>Estrutura pronta, sem conteúdo de exemplo</h2>
        <p>O catálogo PE76 foi retirado. Nenhum enunciado, alternativa ou gabarito de exemplo é carregado. As funcionalidades permanecem preparadas para um catálogo autorizado específico deste módulo.</p>
      </article>
    </section>`}
    <section class="section">
      <div class="section-head"><div><h2>Áreas do módulo</h2><p>As rotas continuam independentes e funcionais.</p></div></div>
      <div class="grid portal-grid">${navigation.routes.map(route => `<a class="card portal" href="${route.path}"><small>${escapeHTML(route.status)}</small><b>${escapeHTML(route.title)}</b><span>${escapeHTML(route.description)}</span><em>${route.key === 'estudar' ? 'Página atual' : 'Abrir →'}</em></a>`).join('')}</div>
    </section>
    <section class="section"><article class="card panel"><h2>Separação preservada</h2><p>O módulo não consulta o Banco Mestre editorial, não importa questões automaticamente e não envia respostas ao Notion.</p></article></section>
    <footer class="footer"><span>Módulo de questões · operação real</span><span>Snapshot <span data-snapshot></span></span></footer>`;
} catch (error) {
  setLoadingError(error);
}
