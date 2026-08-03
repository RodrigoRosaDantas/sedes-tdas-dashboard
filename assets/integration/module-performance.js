import {BASE, escapeHTML, loadJSON, setupShell, setLoadingError} from '../common.js?v=24.1';
import {readModuleState} from './module-store.js?v=2.0.0';

const pct = value => `${Number(value || 0).toFixed(1).replace('.', ',')}%`;
const duration = ms => `${Math.floor(Number(ms || 0) / 60000)}min ${Math.floor(Number(ms || 0) % 60000 / 1000)}s`;
try {
  const shell = await loadJSON('data/more.json');
  setupShell('mais', shell.meta);
  const state = readModuleState();
  const attempts = state.attempts;
  const questions = attempts.reduce((sum, item) => sum + item.total, 0);
  const correct = attempts.reduce((sum, item) => sum + item.correct, 0);
  const elapsed = attempts.reduce((sum, item) => sum + item.elapsedMs, 0);
  const accuracy = questions ? correct / questions * 100 : 0;
  document.querySelector('main').innerHTML = `<section class="hero"><span class="kicker">Desempenho do módulo</span><h1>Desempenho</h1><p>Métricas reconstruídas exclusivamente das sessões locais v2 deste dispositivo.</p><div class="tags"><span class="tag">${attempts.length} tentativas</span><span class="tag">${state.reviews.filter(item => item.status === 'pending' && item.dueAt <= Date.now()).length} revisões disponíveis</span><span class="tag">Sem dados do catálogo de exemplo</span></div><div class="hero-actions"><a class="btn primary" href="${BASE}resolver/">Resolver questões</a><a class="btn" href="${BASE}revisar/">Revisar</a><a class="btn" href="${BASE}evolucao/">Ver evolução oficial</a></div></section>${attempts.length ? `<section class="grid metrics"><article class="card metric"><small>Aproveitamento local</small><strong>${pct(accuracy)}</strong><span>${correct}/${questions} respostas corretas</span></article><article class="card metric"><small>Tentativas</small><strong>${attempts.length}</strong><span>${attempts.filter(item => item.mode === 'study').length} estudo · ${attempts.filter(item => item.mode === 'review').length} revisão</span></article><article class="card metric"><small>Tempo total</small><strong>${duration(elapsed)}</strong><span>${questions ? duration(elapsed / questions) : '0min 0s'} por questão</span></article><article class="card metric"><small>Melhor resultado</small><strong>${pct(Math.max(...attempts.map(item => item.percent)))}</strong><span>último: ${pct(attempts[0]?.percent)}</span></article></section><section class="section"><div class="section-head"><div><h2>Últimas tentativas</h2></div></div><div class="grid two">${attempts.slice(0, 20).map(item => `<article class="card panel"><small>${item.mode === 'review' ? 'Revisão' : 'Estudo'}</small><h3>${item.correct}/${item.total} · ${pct(item.percent)}</h3><p>Tempo: ${duration(item.elapsedMs)}</p></article>`).join('')}</div></section>` : '<section class="section"><article class="card panel"><h2>Nenhuma tentativa local</h2><p>O painel será preenchido quando houver catálogo autorizado e sessões concluídas.</p></article></section>'}<section class="section"><article class="card panel"><h2>Separação preservada</h2><p>Este painel local não altera a Evolução oficial, os PE ou o Notion.</p></article></section>`;
} catch (error) {
  setLoadingError(error);
}
