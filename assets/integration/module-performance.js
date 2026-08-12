import {BASE, escapeHTML, loadJSON, setupShell, setLoadingError} from '../common.js?v=24.1';
import {readModuleState} from './module-store.js?v=2.0.0';

const pct = value => `${Number(value || 0).toFixed(1).replace('.', ',')}%`;
const pp = value => `${value >= 0 ? '+' : ''}${Number(value || 0).toFixed(1).replace('.', ',')} p.p.`;
const duration = ms => `${Math.floor(Number(ms || 0) / 60000)}min ${Math.floor(Number(ms || 0) % 60000 / 1000)}s`;
const average = items => items.length ? items.reduce((sum, item) => sum + Number(item.percent || 0), 0) / items.length : null;
const topicKey = item => String(item?.subassunto || item?.assunto || 'Sem assunto').trim() || 'Sem assunto';
function buildTopicDiagnostics(attempts = []) {
  const groups = new Map();
  for (const attempt of attempts) for (const item of attempt.questionResults || []) {
    const topic = topicKey(item);
    const key = topic.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
    const current = groups.get(key) || {topic, total: 0, correct: 0, errors: 0, uncertain: 0, pes: new Set()};
    current.total += 1;
    if (item.correct) current.correct += 1;
    if (item.classification === 'incorrect_confirmed') current.errors += 1;
    if (['correct_with_doubt', 'correct_by_guess', 'marked'].includes(item.classification) || ['doubt', 'guess'].includes(item.confidence)) current.uncertain += 1;
    if (attempt.peId) current.pes.add(String(attempt.peId));
    groups.set(key, current);
  }
  return [...groups.values()].map(item => ({...item, pes: [...item.pes], accuracy: item.total ? item.correct / item.total * 100 : 0, riskScore: item.errors * 4 + item.uncertain * 2})).sort((a, b) => b.riskScore - a.riskScore || b.errors - a.errors || a.accuracy - b.accuracy || a.topic.localeCompare(b.topic, 'pt-BR'));
}
function buildTrend(attempts = []) {
  const study = attempts.filter(item => item.mode === 'study').sort((a, b) => Number(b.finishedAt || 0) - Number(a.finishedAt || 0));
  const recent = study.slice(0, 5), previous = study.slice(5, 10);
  const recentAverage = average(recent), previousAverage = average(previous);
  return {recentCount: recent.length, previousCount: previous.length, recentAverage, previousAverage, delta: recentAverage != null && previousAverage != null ? recentAverage - previousAverage : null};
}
try {
  const shell = await loadJSON('data/more.json');
  setupShell('mais', shell.meta);
  const state = readModuleState();
  const attempts = [...state.attempts].sort((a, b) => Number(b.finishedAt || 0) - Number(a.finishedAt || 0));
  const questions = attempts.reduce((sum, item) => sum + item.total, 0);
  const correct = attempts.reduce((sum, item) => sum + item.correct, 0);
  const elapsed = attempts.reduce((sum, item) => sum + item.elapsedMs, 0);
  const accuracy = questions ? correct / questions * 100 : 0;
  const dueReviews = state.reviews.filter(item => item.status === 'pending' && Number(item.dueAt) <= Date.now());
  const criticalReviews = dueReviews.filter(item => ['wrong_again', 'incorrect_confirmed'].includes(item.sourceOutcome || item.outcome || item.classification));
  const diagnostics = buildTopicDiagnostics(attempts);
  const topRisk = diagnostics.find(item => item.riskScore > 0) || null;
  const topUncertain = [...diagnostics].sort((a, b) => b.uncertain - a.uncertain || b.riskScore - a.riskScore)[0] || null;
  const trend = buildTrend(attempts);
  const trendLabel = trend.delta == null ? 'Sem base comparável' : trend.delta > 0.4 ? 'Subindo' : trend.delta < -0.4 ? 'Caindo' : 'Estável';
  const trendClass = trend.delta != null && trend.delta < -0.4 ? 'critical' : trend.delta != null && trend.delta > 0.4 ? '' : 'warning';
  const diagnosisSection = attempts.length ? `<section class="section" data-performance-diagnostics><div class="section-head"><div><h2>Diagnóstico acionável</h2><p>Leitura derivada somente das suas sessões locais. O risco usa uma fórmula simples e visível: <strong>erro × 4 + dúvida/chute/marcação × 2</strong>.</p></div><span class="stamp">Sem índice oculto</span></div><div class="grid metrics"><article class="card metric"><small>Maior risco local</small><strong>${topRisk ? topRisk.riskScore : 0}</strong><span>${topRisk ? `${escapeHTML(topRisk.topic)} · ${topRisk.errors} erro${topRisk.errors === 1 ? '' : 's'} · ${topRisk.uncertain} incerteza${topRisk.uncertain === 1 ? '' : 's'}` : 'Nenhum sinal de risco classificado'}</span></article><article class="card metric"><small>Maior incerteza</small><strong>${topUncertain?.uncertain || 0}</strong><span>${topUncertain?.uncertain ? escapeHTML(topUncertain.topic) : 'Sem dúvida, chute ou marcação registrados'}</span></article><article class="card metric"><small>Tendência — estudo</small><strong>${trend.delta == null ? '—' : pp(trend.delta)}</strong><span><span class="status ${trendClass}">${trendLabel}</span> · média recente ${trend.recentAverage == null ? '—' : pct(trend.recentAverage)}</span></article><article class="card metric"><small>Revisões vencidas</small><strong>${dueReviews.length}</strong><span>${criticalReviews.length} com sinal de erro/reincidência</span></article></div>${diagnostics.length ? `<div class="grid two">${diagnostics.slice(0, 8).map(item => `<article class="card panel"><small>Risco ${item.riskScore} = ${item.errors}×4 + ${item.uncertain}×2</small><h3>${escapeHTML(item.topic)}</h3><p>${item.correct}/${item.total} corretas · ${pct(item.accuracy)} · ${item.pes.length} PE${item.pes.length === 1 ? '' : 's'}</p><div class="tags"><span class="tag">${item.errors} erros</span><span class="tag">${item.uncertain} incertezas</span></div></article>`).join('')}</div>` : ''}<article class="card panel"><small>Próxima ação sugerida</small><h3>${criticalReviews.length ? 'Fechar revisões críticas antes de aumentar o volume' : topRisk ? `Atacar ${escapeHTML(topRisk.topic)}` : 'Manter o ciclo e continuar classificando'}</h3><p>${criticalReviews.length ? `Há ${criticalReviews.length} revisão${criticalReviews.length === 1 ? '' : 'ões'} vencida${criticalReviews.length === 1 ? '' : 's'} ligada${criticalReviews.length === 1 ? '' : 's'} a erro ou reincidência.` : topRisk ? `Esse tópico tem o maior escore local de risco (${topRisk.riskScore}). Refaça questões e confirme domínio antes de considerá-lo estável.` : 'Os dados locais ainda não mostram um foco crítico; continue registrando sessões reais.'}</p><div class="hero-actions"><a class="btn primary" href="${criticalReviews.length ? `${BASE}revisar/` : `${BASE}resolver/`}">${criticalReviews.length ? 'Abrir revisões' : 'Resolver questões'}</a><a class="btn" href="${BASE}caderno-erros/">Ver reincidências</a></div></article></section>` : '';
  document.querySelector('main').innerHTML = `<section class="hero"><span class="kicker">Desempenho do módulo</span><h1>Desempenho</h1><p>Métricas reconstruídas exclusivamente das sessões locais v2 deste dispositivo.</p><div class="tags"><span class="tag">${attempts.length} tentativas</span><span class="tag">${dueReviews.length} revisões disponíveis</span><span class="tag">${criticalReviews.length} revisões críticas</span><span class="tag">Sem dados do catálogo de exemplo</span></div><div class="hero-actions"><a class="btn primary" href="${BASE}resolver/">Resolver questões</a><a class="btn" href="${BASE}revisar/">Revisar</a><a class="btn" href="${BASE}evolucao/">Ver evolução oficial</a></div></section>${attempts.length ? `<section class="grid metrics"><article class="card metric"><small>Aproveitamento local</small><strong>${pct(accuracy)}</strong><span>${correct}/${questions} respostas corretas</span></article><article class="card metric"><small>Tentativas</small><strong>${attempts.length}</strong><span>${attempts.filter(item => item.mode === 'study').length} estudo · ${attempts.filter(item => item.mode === 'review').length} revisão</span></article><article class="card metric"><small>Tempo total</small><strong>${duration(elapsed)}</strong><span>${questions ? duration(elapsed / questions) : '0min 0s'} por questão</span></article><article class="card metric"><small>Melhor resultado</small><strong>${pct(Math.max(...attempts.map(item => item.percent)))}</strong><span>último: ${pct(attempts[0]?.percent)}</span></article></section>${diagnosisSection}<section class="section"><div class="section-head"><div><h2>Últimas tentativas</h2></div></div><div class="grid two">${attempts.slice(0, 20).map(item => `<article class="card panel"><small>${item.mode === 'review' ? 'Revisão' : 'Estudo'}${item.peId ? ` · ${escapeHTML(item.peId)}` : ''}</small><h3>${item.correct}/${item.total} · ${pct(item.percent)}</h3><p>Tempo: ${duration(item.elapsedMs)}</p></article>`).join('')}</div></section>` : '<section class="section"><article class="card panel"><h2>Nenhuma tentativa local</h2><p>O painel será preenchido quando houver catálogo autorizado e sessões concluídas.</p></article></section>'}<section class="section"><article class="card panel"><h2>Separação preservada</h2><p>Este diagnóstico local não altera a Evolução oficial, os PE ou o Notion e não inventa desempenho onde não há sessão registrada.</p></article></section>`;
} catch (error) {
  setLoadingError(error);
}
