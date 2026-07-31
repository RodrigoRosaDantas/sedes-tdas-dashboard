import {BASE, escapeHTML, loadJSON, setupShell, setLoadingError} from '../common.js?v=24.1';

const routeKey = document.documentElement.dataset.integrationRoute;
const routeActions = {
  estudar: [
    {href: BASE + 'resolver/', label: 'Ver rota de resolução'},
    {href: BASE + 'revisar/', label: 'Ver rota de revisão'},
  ],
  resolver: [{href: BASE + 'estudar/', label: 'Voltar para Estudar'}],
  revisar: [
    {href: BASE + 'caderno-erros/', label: 'Abrir estrutura do caderno'},
    {href: BASE + 'estudar/', label: 'Voltar para Estudar'},
  ],
  'caderno-erros': [
    {href: BASE + 'questoes-erros/', label: 'Abrir caderno oficial atual', primary: true},
    {href: BASE + 'revisar/', label: 'Voltar para Revisar'},
  ],
  desempenho: [{href: BASE + 'evolucao/', label: 'Abrir evolução atual', primary: true}],
  'fila-ia': [{href: BASE + 'estudar/', label: 'Voltar para Estudar'}],
};

try {
  const [navigation, shell] = await Promise.all([
    fetch(BASE + 'data/integration/navigation.json', {cache: 'no-store'}).then(response => {
      if (!response.ok) throw new Error(`Falha ao carregar navegação (${response.status})`);
      return response.json();
    }),
    loadJSON('data/more.json'),
  ]);
  const current = navigation.routes.find(route => route.key === routeKey);
  if (!current) throw new Error('Rota de integração não reconhecida.');
  setupShell('mais', shell.meta);
  const actions = routeActions[routeKey] || [{href: BASE, label: 'Voltar ao início'}];
  document.querySelector('main').innerHTML = `
    <section class="hero">
      <span class="kicker">Módulo de questões · Fase ${navigation.phase}</span>
      <h1>${escapeHTML(current.title)}</h1>
      <p>${escapeHTML(current.description)}</p>
      <div class="tags">
        <span class="tag">${escapeHTML(current.status)}</span>
        <span class="tag">Sem gravação de dados</span>
      </div>
      <div class="hero-actions">${actions.map(action => `<a class="btn ${action.primary ? 'primary' : ''}" href="${action.href}">${escapeHTML(action.label)}</a>`).join('')}</div>
    </section>
    <section class="section">
      <div class="grid two">
        <article class="card panel">
          <h2>O que está pronto</h2>
          <p>A rota, o endereço estável e a integração com a navegação da Plataforma TDAS.</p>
        </article>
        <article class="card panel">
          <h2>Próxima ativação</h2>
          <p>${escapeHTML(current.nextPhase)}</p>
        </article>
      </div>
    </section>
    <section class="section">
      <div class="section-head"><div><h2>Áreas do módulo</h2><p>Estrutura aprovada para as próximas fases.</p></div></div>
      <div class="grid portal-grid">${navigation.routes.map(route => `<a class="card portal" href="${route.path}" aria-current="${route.key === routeKey ? 'page' : 'false'}"><small>Fase ${navigation.phase}</small><b>${escapeHTML(route.title)}</b><span>${escapeHTML(route.description)}</span><em>${route.key === routeKey ? 'Página atual' : 'Abrir →'}</em></a>`).join('')}</div>
    </section>
    <footer class="footer"><span>Módulo de questões · navegação estrutural</span><span>Snapshot <span data-snapshot></span></span></footer>`;
} catch (error) {
  setLoadingError(error);
}
