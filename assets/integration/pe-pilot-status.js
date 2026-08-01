import {BASE, escapeHTML} from '../common.js?v=24.1';
import {readPeProgress} from './pe-progress-store.js?v=1.0.0';

const waitForPe = () => new Promise((resolve, reject) => {
  let attempts = 0;
  const check = () => {
    const main = document.querySelector('main');
    if (main?.querySelector('.hero h1')?.textContent.trim() === 'PE76') return resolve(main);
    if (attempts++ >= 120) return reject(new Error('PE76 não ficou pronto para a integração local.'));
    setTimeout(check, 40);
  };
  check();
});

function formatDate(timestamp) {
  return timestamp ? new Intl.DateTimeFormat('pt-BR', {dateStyle: 'short', timeStyle: 'short'}).format(new Date(timestamp)) : 'Nenhuma execução';
}

try {
  const main = await waitForPe();
  const progress = readPeProgress('PE76');
  const footer = main.querySelector('footer');
  const section = document.createElement('section');
  section.className = 'section';
  section.dataset.pePilotStatus = 'PE76';
  section.innerHTML = `
    <div class="section-head"><div><h2>Atividade piloto local</h2><p>Indicadores deste dispositivo, separados do registro oficial acima.</p></div><span class="stamp">Escopo: piloto local</span></div>
    ${progress ? `<div class="grid metrics">
      <article class="card metric"><small>Tentativas piloto</small><strong>${progress.pilotAttempts}</strong><span>não alteram o PE oficial</span></article>
      <article class="card metric"><small>Revisões concluídas</small><strong>${progress.reviewAttempts}</strong><span>agenda somente local</span></article>
      <article class="card metric"><small>Melhor resultado</small><strong>${Number(progress.bestPercent).toFixed(0)}%</strong><span>último: ${Number(progress.latestPercent).toFixed(0)}%</span></article>
      <article class="card metric"><small>Última atividade</small><strong>${escapeHTML(formatDate(progress.latestAttemptAt))}</strong><span>${progress.totalQuestionsAnswered} respostas locais</span></article>
    </div>` : '<article class="card panel"><h3>Nenhuma atividade piloto neste dispositivo</h3><p>O PE76 continua com o estado oficial exibido acima. Resolver o piloto criará apenas um indicador local.</p></article>'}
    <div class="hero-actions"><a class="btn primary" href="${BASE}resolver/?pilot=pe76">Resolver piloto PE76</a><a class="btn" href="${BASE}revisar/">Abrir revisões locais</a><a class="btn" href="${BASE}caderno-erros/">Abrir caderno local</a></div>
    <article class="card panel"><h3>Garantia de separação</h3><p><code>officialCompleted=false</code>, <code>officialStatus=not_modified</code> e <code>notionWriteback=false</code>. O painel não transforma o PE76 em concluído.</p></article>`;
  footer?.before(section);
} catch (error) {
  console.error('Falha ao exibir atividade piloto do PE76', error);
}
