import {BASE, escapeHTML} from '../common.js?v=24.1';

const waitForStudyPage = () => new Promise((resolve, reject) => {
  let attempts = 0;
  const check = () => {
    const main = document.querySelector('main');
    if (main?.querySelector('.hero h1')?.textContent.trim() === 'Estudar') return resolve(main);
    if (attempts++ >= 100) return reject(new Error('A página Estudar não ficou pronta para o catálogo.'));
    setTimeout(check, 40);
  };
  check();
});

try {
  const [main, catalog] = await Promise.all([
    waitForStudyPage(),
    fetch(BASE + 'data/integration/pilot/pe76-catalog.json', {cache: 'no-store'}).then(response => {
      if (!response.ok) throw new Error(`Falha ao carregar catálogo piloto (${response.status})`);
      return response.json();
    }),
  ]);
  const footer = main.querySelector('footer');
  const section = document.createElement('section');
  section.className = 'section';
  section.dataset.pilotCatalog = catalog.id;
  section.innerHTML = `
    <div class="section-head">
      <div>
        <h2>Catálogo piloto PE76</h2>
        <p>Recorte técnico isolado, sem alterar o progresso oficial e sem carregar o gabarito antes da correção.</p>
      </div>
      <span class="stamp">${catalog.quantidade_questoes} questões · ${catalog.tempo_sugerido_minutos} min</span>
    </div>
    <div class="grid two">
      <article class="card panel">
        <small>Seleção</small>
        <h3>Questões 1–6 e 13–16</h3>
        <p>Assistência Social, SUAS e Língua Portuguesa aplicada.</p>
      </article>
      <article class="card panel">
        <small>Segurança operacional</small>
        <h3>Modo piloto</h3>
        <p>A sessão fica somente em memória e nenhum resultado é lançado no Notion ou no corte oficial.</p>
      </article>
    </div>
    <div class="hero-actions"><a class="btn primary" href="${BASE}resolver/?pilot=pe76">Iniciar piloto</a></div>
    <div class="grid portal-grid">${catalog.questoes.map(question => `
      <article class="card portal">
        <small>Questão ${question.numero_original}</small>
        <b>${escapeHTML(question.assunto)}</b>
        <span>${escapeHTML(question.subassunto)}</span>
        <em>Disponível no piloto</em>
      </article>`).join('')}
    </div>
    <article class="card panel">
      <h3>Resultado temporário</h3>
      <p>O gabarito é solicitado apenas ao finalizar as dez respostas. Sair ou atualizar elimina a sessão e o resultado.</p>
    </article>`;
  footer?.before(section);
} catch (error) {
  console.error('Falha no catálogo piloto PE76', error);
}
