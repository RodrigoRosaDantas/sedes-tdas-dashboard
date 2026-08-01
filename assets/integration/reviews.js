import {BASE, escapeHTML, loadJSON, setupShell, setLoadingError} from '../common.js?v=24.1';
import {readReviews} from './review-store.js?v=1.0.0';

const main = document.querySelector('main');
const stageOrder = Object.freeze({'D0': 0, 'D+1': 1, 'D+7': 2, 'D+20': 3});

function formatDate(timestamp) {
  return new Intl.DateTimeFormat('pt-BR', {dateStyle: 'short', timeStyle: 'short'}).format(new Date(timestamp));
}

function reviewCard(review, now) {
  const due = review.status === 'pending' && review.dueAt <= now;
  const status = review.status === 'completed' ? 'Concluída' : due ? 'Disponível agora' : `Agendada para ${formatDate(review.dueAt)}`;
  const action = review.status === 'pending'
    ? `<a class="btn ${due ? 'primary' : ''}" href="${BASE}resolver/?review=${encodeURIComponent(review.id)}">Revisar questão</a>`
    : `<span class="tag">Resultado: ${escapeHTML(review.outcome || 'registrado')}</span>`;
  return `<article class="card panel"><small>${escapeHTML(review.stage)} · ${escapeHTML(review.peId)} · questão ${review.numeroOriginal}</small><h3>${escapeHTML(review.subassunto || review.assunto)}</h3><p>${escapeHTML(status)}<br>Origem: ${escapeHTML(review.sourceClassification)}</p>${action}</article>`;
}

try {
  const shell = await loadJSON('data/more.json');
  setupShell('mais', shell.meta);
  const now = Date.now();
  const reviews = [...readReviews()].sort((a, b) => a.status.localeCompare(b.status) || a.dueAt - b.dueAt || stageOrder[a.stage] - stageOrder[b.stage]);
  const due = reviews.filter(review => review.status === 'pending' && review.dueAt <= now);
  const upcoming = reviews.filter(review => review.status === 'pending' && review.dueAt > now);
  const completed = reviews.filter(review => review.status === 'completed');
  main.innerHTML = `
    <section class="hero">
      <span class="kicker">Revisão espaçada local</span>
      <h1>Revisar</h1>
      <p>Agenda D+1, D+7 e D+20 formada por erros confirmados, dúvidas, chutes e marcações. D0 permanece excepcional.</p>
      <div class="tags"><span class="tag">${due.length} disponíveis</span><span class="tag">${upcoming.length} futuras</span><span class="tag">${completed.length} concluídas</span></div>
      <div class="hero-actions"><a class="btn primary" href="${due[0] ? `${BASE}resolver/?review=${encodeURIComponent(due[0].id)}` : `${BASE}resolver/?pilot=pe76`}">${due.length ? 'Iniciar próxima revisão' : 'Resolver piloto'}</a><a class="btn" href="${BASE}caderno-erros/">Abrir caderno</a></div>
    </section>
    <section class="section"><div class="section-head"><div><h2>Disponíveis agora</h2><p>Itens vencidos ou previstos para hoje.</p></div></div>${due.length ? `<div class="grid two">${due.map(review => reviewCard(review, now)).join('')}</div>` : '<article class="card panel"><p>Nenhuma revisão está vencida neste dispositivo.</p></article>'}</section>
    <section class="section"><div class="section-head"><div><h2>Próximas revisões</h2><p>Agenda futura ordenada por vencimento.</p></div></div>${upcoming.length ? `<div class="grid two">${upcoming.map(review => reviewCard(review, now)).join('')}</div>` : '<article class="card panel"><p>Nenhuma revisão futura agendada.</p></article>'}</section>
    <section class="section"><div class="section-head"><div><h2>Concluídas</h2><p>Últimos registros concluídos localmente.</p></div></div>${completed.length ? `<div class="grid two">${completed.slice(-20).reverse().map(review => reviewCard(review, now)).join('')}</div>` : '<article class="card panel"><p>Nenhuma revisão concluída ainda.</p></article>'}</section>
    <section class="section"><article class="card panel"><h2>Isolamento</h2><p>A agenda e os resultados de revisão permanecem neste dispositivo e não atualizam o PE oficial ou o Notion.</p></article></section>
    <footer class="footer"><span>Revisões locais · Fase 7</span><span>Snapshot <span data-snapshot></span></span></footer>`;
} catch (error) {
  setLoadingError(error);
}
