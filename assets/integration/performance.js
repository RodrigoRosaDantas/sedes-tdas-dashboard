import {BASE, escapeHTML, loadJSON, setupShell, setLoadingError} from '../common.js?v=24.1';
import {readAttempts} from './attempt-store.js?v=1.0.0';
import {buildPerformanceSnapshot} from './performance-metrics.js?v=1.0.0';
import {readPeProgress} from './pe-progress-store.js?v=1.0.0';
import {readReviews} from './review-store.js?v=1.0.0';

const main = document.querySelector('main');
const fmtNumber = value => new Intl.NumberFormat('pt-BR').format(value);
const fmtPct = value => `${Number(value).toFixed(1).replace('.', ',')}%`;
const fmtDate = value => new Intl.DateTimeFormat('pt-BR', {dateStyle: 'short', timeStyle: 'short'}).format(new Date(value));
const fmtTime = milliseconds => {
  const seconds = Math.max(0, Math.round(Number(milliseconds) / 1000));
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return minutes ? `${minutes}min ${remaining}s` : `${remaining}s`;
};
const modeLabels = Object.freeze({pilot: 'Piloto', review: 'Revisão', legacy: 'Legado importado'});
const labels = Object.freeze({
  secure: 'Segurança', doubt: 'Dúvida', guess: 'Chute',
  incorrect_confirmed: 'Erros confirmados', correct_secure: 'Acertos seguros', correct_with_doubt: 'Acertos com dúvida',
  correct_by_guess: 'Acertos por chute', marked: 'Marcadas', annulment_pending: 'Possível anulação', source_error: 'Erro da fonte',
});

function metric(label, value, detail) {
  return `<article class="card metric"><small>${escapeHTML(label)}</small><strong>${escapeHTML(String(value))}</strong><span>${escapeHTML(detail)}</span></article>`;
}

try {
  const shell = await loadJSON('data/more.json');
  setupShell('mais', shell.meta);
  const attempts = readAttempts();
  const reviews = readReviews();
  const peProgress = readPeProgress('PE76');
  const snapshot = buildPerformanceSnapshot(attempts, reviews, peProgress, Date.now());
  main.innerHTML = `
    <section class="hero">
      <span class="kicker">Desempenho local</span>
      <h1>Desempenho</h1>
      <p>Métricas reconstruídas das tentativas deste dispositivo, incluindo histórico legado importado com procedência.</p>
      <div class="tags"><span class="tag">${snapshot.attempts} tentativas</span><span class="tag">${snapshot.reviews.due} revisões disponíveis</span><span class="tag">${snapshot.legacyAttempts} legado(s)</span></div>
      <div class="hero-actions"><a class="btn primary" href="${BASE}resolver/?pilot=pe76">Resolver piloto</a><a class="btn" href="${BASE}revisar/">Revisar</a><a class="btn" href="${BASE}evolucao/">Ver evolução oficial</a></div>
    </section>
    ${snapshot.attempts ? `
    <section class="grid metrics">
      ${metric('Aproveitamento local', fmtPct(snapshot.accuracy), `${snapshot.correct}/${snapshot.questions} respostas corretas`)}
      ${metric('Tentativas', fmtNumber(snapshot.attempts), `${snapshot.pilotAttempts} piloto · ${snapshot.reviewAttempts} revisão · ${snapshot.legacyAttempts} legado`)}
      ${metric('Melhor piloto', snapshot.bestPilotPercent === null ? '—' : fmtPct(snapshot.bestPilotPercent), `último resultado: ${fmtPct(snapshot.latestPercent)}`)}
      ${metric('Tempo médio', fmtTime(snapshot.averageQuestionMs), `por questão · ${fmtTime(snapshot.elapsedMs)} total`)}
    </section>
    <section class="section"><div class="section-head"><div><h2>Confiança × resultado</h2><p>Volume e acurácia conforme a forma de resposta registrada.</p></div></div><div class="grid three">${Object.entries(snapshot.confidence).map(([key, item]) => `<article class="card panel"><small>${escapeHTML(labels[key])}</small><h3>${item.questions} questões</h3><p>${item.correct} corretas · <strong>${fmtPct(item.accuracy)}</strong></p><div class="pilot-progress-track"><div class="pilot-progress-fill" style="width:${Math.min(100, item.accuracy)}%"></div></div></article>`).join('')}</div></section>
    <section class="section"><div class="section-head"><div><h2>Classificações</h2><p>Distribuição das decisões tomadas após a correção.</p></div></div><div class="grid portal-grid">${Object.entries(snapshot.classifications).map(([key, value]) => `<article class="card portal"><small>Classificação</small><b>${escapeHTML(labels[key] || key)}</b><span>${fmtNumber(value)} registro(s)</span><em>${snapshot.questions ? fmtPct(value / snapshot.questions * 100) : '0,0%'}</em></article>`).join('')}</div></section>
    <section class="section"><div class="section-head"><div><h2>Por assunto</h2><p>Ordenado do menor para o maior aproveitamento local.</p></div></div>${snapshot.subjects.length ? `<div class="grid two">${snapshot.subjects.map(item => `<article class="card panel"><small>${fmtNumber(item.questions)} questões</small><h3>${escapeHTML(item.subject)}</h3><p>${item.correct} acertos · ${item.incorrect} erros · <strong>${fmtPct(item.accuracy)}</strong></p><div class="pilot-progress-track"><div class="pilot-progress-fill" style="width:${Math.min(100, item.accuracy)}%"></div></div></article>`).join('')}</div>` : '<article class="card panel"><p>Sem assuntos registrados.</p></article>'}</section>
    <section class="section"><div class="section-head"><div><h2>Últimas tentativas</h2><p>Até vinte registros, em ordem cronológica.</p></div></div><div class="grid two">${snapshot.trend.map(item => `<article class="card panel"><small>${escapeHTML(modeLabels[item.mode] || item.mode)} · ${fmtDate(item.finishedAt)}</small><h3>${item.correct}/${item.total} · ${fmtPct(item.percent)}</h3><p>Tempo: ${fmtTime(item.elapsedMs)}</p></article>`).join('')}</div></section>` : `
    <section class="section"><article class="card panel"><h2>Nenhuma tentativa local</h2><p>Conclua o piloto PE76 ou importe um histórico compatível pela página Mais.</p></article></section>`}
    <section class="section"><div class="grid two"><article class="card panel"><h2>Revisões</h2><p>${snapshot.reviews.due} disponíveis · ${snapshot.reviews.pending} pendentes · ${snapshot.reviews.completed} concluídas.</p></article><article class="card panel"><h2>PE76 local</h2><p>${snapshot.peProgress ? `${snapshot.peProgress.pilotAttempts} piloto(s), ${snapshot.peProgress.reviewAttempts} revisão(ões), melhor ${fmtPct(snapshot.peProgress.bestPercent)}.` : 'Nenhuma atividade local registrada.'}</p></article></div></section>
    <section class="section"><article class="card panel"><h2>Separação preservada</h2><p>Este painel não substitui a Evolução oficial, não atualiza PE e não grava no Notion. O histórico legado é somente leitura analítica e não gera revisões automaticamente.</p></article></section>
    <footer class="footer"><span>Desempenho local · Fase 10</span><span>Snapshot <span data-snapshot></span></span></footer>`;
} catch (error) {
  setLoadingError(error);
}
