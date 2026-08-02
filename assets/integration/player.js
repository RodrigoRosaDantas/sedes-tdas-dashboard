import {BASE, escapeHTML, loadJSON, setupShell, setLoadingError} from '../common.js?v=24.1';
import {createAttemptRecord} from './attempt-store.js?v=1.0.0';
import {commitCompletedAttempt} from './completion-transaction.js?v=1.0.0';
import {ANSWER_OPTIONS, canFinish, createSession, evaluateSession, formatElapsed, moveToQuestion, selectAnswer, sessionProgress} from './player-core.js?v=1.0.0';
import {normalizeResponseMeta} from './response-classification.js?v=1.0.0';
import {getReviewById} from './review-store.js?v=1.0.0';

const main = document.querySelector('main');
const CLASSIFICATION_LABELS = Object.freeze({
  incorrect_confirmed: 'Erro confirmado',
  correct_secure: 'Acerto seguro',
  correct_with_doubt: 'Acerto com dúvida',
  correct_by_guess: 'Acerto por chute',
  marked: 'Marcada para revisão',
  annulment_pending: 'Possível anulação',
  source_error: 'Erro da fonte',
});
const state = {
  catalog: null,
  session: null,
  evaluation: null,
  responseMeta: {},
  reviewContext: null,
  attemptRecord: null,
  transaction: null,
  transactionError: null,
  timerId: null,
};

const isReviewMode = () => Boolean(state.reviewContext);

function stopTimer() {
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = null;
}

function updateTimer() {
  const element = document.querySelector('#pilot-timer');
  if (element && state.session) element.textContent = formatElapsed(Date.now() - state.session.startedAt);
}

function startTimer() {
  stopTimer();
  updateTimer();
  state.timerId = setInterval(updateTimer, 1000);
}

function responseMetaFor(questionId) {
  return normalizeResponseMeta(state.responseMeta[questionId]);
}

function updateResponseMeta(questionId, patch) {
  state.responseMeta = {...state.responseMeta, [questionId]: normalizeResponseMeta({...responseMetaFor(questionId), ...patch})};
}

function resetRunState() {
  stopTimer();
  state.session = null;
  state.evaluation = null;
  state.responseMeta = {};
  state.attemptRecord = null;
  state.transaction = null;
  state.transactionError = null;
}

function renderIntro() {
  resetRunState();
  const review = state.reviewContext;
  const title = review ? `Revisão ${review.stage} · questão ${review.numeroOriginal}` : 'Resolver questões';
  const description = review ? `${review.subassunto || review.assunto}. Esta execução encerra somente o item agendado.` : state.catalog.nome;
  main.innerHTML = `
    <section class="hero">
      <span class="kicker">${review ? 'Revisão espaçada local' : 'Piloto técnico · PE76'}</span>
      <h1>${escapeHTML(title)}</h1>
      <p>${escapeHTML(description)}</p>
      <div class="tags"><span class="tag">${state.catalog.quantidade_questoes} ${state.catalog.quantidade_questoes === 1 ? 'questão' : 'questões'}</span><span class="tag">${review ? review.stage : `${state.catalog.tempo_sugerido_minutos} minutos sugeridos`}</span><span class="tag">Classificação ativa</span></div>
      <div class="hero-actions"><button class="btn primary" data-player-start>${review ? 'Iniciar revisão' : 'Iniciar piloto'}</button><a class="btn" href="${review ? `${BASE}revisar/` : `${BASE}estudar/`}">Voltar</a></div>
    </section>
    <section class="section"><div class="grid two">
      <article class="card panel"><h2>Como funciona</h2><p>Registre a alternativa, sua confiança e qualquer ressalva editorial antes da correção.</p></article>
      <article class="card panel"><h2>${review ? 'Conclusão da revisão' : 'Conclusão atômica'}</h2><p>${review ? 'O item será encerrado sem criar nova agenda.' : 'Tentativa, caderno, revisões e progresso piloto do PE são gravados juntos ou revertidos juntos.'}</p></article>
    </div></section>
    <footer class="footer"><span>${review ? `Revisão ${escapeHTML(review.stage)}` : 'Player piloto'} · Fase 8</span><span>Sem writeback</span></footer>`;
}

function renderQuestion() {
  const progress = sessionProgress(state.session);
  const question = state.catalog.questoes[state.session.currentIndex];
  const selected = state.session.answers[question.id] || '';
  const meta = responseMetaFor(question.id);
  main.innerHTML = `
    <section class="hero pilot-shell"><div class="pilot-toolbar"><div class="pilot-progress"><div><strong>Questão ${state.session.currentIndex + 1} de ${progress.total}</strong> · ${progress.answered} respondidas</div><div class="pilot-progress-track" aria-label="${progress.percent.toFixed(0)}% respondido"><div class="pilot-progress-fill" style="width:${progress.percent}%"></div></div></div><strong class="pilot-timer" id="pilot-timer" aria-label="Tempo decorrido">${formatElapsed(Date.now() - state.session.startedAt)}</strong></div></section>
    <section class="section pilot-shell">
      <article class="card panel pilot-question">
        <div><span class="kicker">Questão ${question.numero_original} · ${escapeHTML(question.assunto)}</span><h1>${escapeHTML(question.enunciado)}</h1></div>
        ${question.texto_base ? `<blockquote class="pilot-text">${escapeHTML(question.texto_base)}</blockquote>` : ''}
        <fieldset class="pilot-options"><legend class="skip">Escolha uma alternativa</legend>${ANSWER_OPTIONS.map(option => `<label class="pilot-option"><input type="radio" name="pilot-answer" value="${option}" ${selected === option ? 'checked' : ''}><span><strong>${option})</strong> ${escapeHTML(question.alternativas[option])}</span></label>`).join('')}</fieldset>
        <fieldset class="pilot-meta"><legend><strong>Como você chegou à resposta?</strong></legend><div class="pilot-meta-grid"><label><input type="radio" name="pilot-confidence" value="secure" ${meta.confidence === 'secure' ? 'checked' : ''}> Segurança</label><label><input type="radio" name="pilot-confidence" value="doubt" ${meta.confidence === 'doubt' ? 'checked' : ''}> Dúvida</label><label><input type="radio" name="pilot-confidence" value="guess" ${meta.confidence === 'guess' ? 'checked' : ''}> Chute</label></div><label><input type="checkbox" data-player-marked ${meta.marked ? 'checked' : ''}> Marcar para revisão</label><label>Ressalva editorial<select data-player-issue><option value="none" ${meta.issue === 'none' ? 'selected' : ''}>Nenhuma</option><option value="annulment_pending" ${meta.issue === 'annulment_pending' ? 'selected' : ''}>Possível anulação</option><option value="source_error" ${meta.issue === 'source_error' ? 'selected' : ''}>Possível erro da fonte/gabarito</option></select></label></fieldset>
      </article>
      <article class="card panel"><h2>Mapa da sessão</h2><div class="pilot-map">${state.catalog.questoes.map((item, index) => { const itemMeta = responseMetaFor(item.id); return `<button class="btn ${state.session.answers[item.id] ? 'answered' : ''} ${itemMeta.marked ? 'marked' : ''} ${index === state.session.currentIndex ? 'current' : ''}" data-player-index="${index}" aria-label="Ir para questão ${index + 1}">${index + 1}</button>`; }).join('')}</div></article>
      <div class="pilot-actions"><button class="btn" data-player-prev ${state.session.currentIndex === 0 ? 'disabled' : ''}>← Anterior</button><a class="btn" href="${isReviewMode() ? `${BASE}revisar/` : `${BASE}estudar/`}">Sair e descartar sessão</a>${state.session.currentIndex < progress.total - 1 ? '<button class="btn primary" data-player-next>Próxima →</button>' : `<button class="btn primary" data-player-finish ${canFinish(state.session) ? '' : 'disabled'}>Finalizar (${progress.remaining} pendentes)</button>`}</div>
    </section>`;
  updateTimer();
}

async function finishSession() {
  if (!canFinish(state.session)) return;
  const button = document.querySelector('[data-player-finish]');
  if (button) { button.disabled = true; button.textContent = 'Corrigindo…'; }
  try {
    const key = await fetch(BASE + 'data/integration/pilot/pe76-key.json', {cache: 'no-store'}).then(response => {
      if (!response.ok) throw new Error(`Falha ao carregar gabarito (${response.status})`);
      return response.json();
    });
    state.evaluation = evaluateSession(state.session, key, Date.now());
    state.session = state.evaluation.session;
    state.attemptRecord = createAttemptRecord({catalog: state.catalog, evaluation: state.evaluation, responseMeta: state.responseMeta, mode: isReviewMode() ? 'review' : 'pilot', sourceReviewId: state.reviewContext?.id || null, savedAt: Date.now()});
    try {
      state.transaction = commitCompletedAttempt(state.attemptRecord, {includeD0: false});
      state.transactionError = null;
    } catch (error) {
      state.transaction = null;
      state.transactionError = error;
      console.error('Conclusão local revertida', error);
    }
    stopTimer();
    renderResult();
  } catch (error) {
    if (button) { button.disabled = false; button.textContent = 'Tentar finalizar novamente'; }
    alert(`Não foi possível corrigir: ${error.message}`);
  }
}

function renderResult() {
  const evaluation = state.evaluation;
  const resultMap = new Map(evaluation.results.map(result => [result.id, result]));
  const classifiedMap = new Map((state.attemptRecord?.questionResults || []).map(result => [result.id, result]));
  const transactionMessage = state.transaction
    ? `Conclusão gravada atomicamente. Histórico: ${state.transaction.savedAttempt.totalStored}; caderno: ${state.transaction.indexes.totalErrors}; progresso local do ${state.transaction.peProgress.peId}: ${state.transaction.peProgress.pilotAttempts} piloto(s) e ${state.transaction.peProgress.reviewAttempts} revisão(ões).`
    : `Conclusão não persistida${state.transactionError ? `: ${escapeHTML(state.transactionError.message)}` : '.'}`;
  const reviewMessage = isReviewMode()
    ? state.transaction ? `Revisão ${escapeHTML(state.reviewContext.stage)} concluída sem nova agenda.` : ''
    : state.transaction ? `${state.transaction.reviews.added} revisões D+1, D+7 e D+20 agendadas.` : '';
  const primaryAction = isReviewMode() ? `<a class="btn primary" href="${BASE}revisar/">Voltar às revisões</a>` : '<button class="btn primary" data-player-restart>Refazer piloto</button>';
  main.innerHTML = `
    <section class="hero pilot-result"><span class="kicker">${isReviewMode() ? 'Resultado da revisão local' : 'Resultado classificado do piloto'}</span><h1>${evaluation.correct}/${evaluation.total} acertos · ${evaluation.percent.toFixed(0)}%</h1><p>Tempo: ${formatElapsed(evaluation.elapsedMs)}. ${transactionMessage} ${reviewMessage} Nenhum dado foi enviado ao Notion ou ao progresso oficial.</p><div class="hero-actions">${primaryAction}<a class="btn" href="${BASE}pe/76/">Ver PE76</a><a class="btn" href="${BASE}caderno-erros/">Abrir caderno local</a></div></section>
    <section class="section"><div class="pilot-result-list">${state.catalog.questoes.map((question, index) => { const result = resultMap.get(question.id); const classified = classifiedMap.get(question.id); const classification = classified?.classification || (result.correct ? 'correct_secure' : 'incorrect_confirmed'); return `<article class="card pilot-result-item" data-correct="${result.correct}"><strong>${index + 1}</strong><span>${escapeHTML(question.subassunto)}<br><small>Marcada: ${result.selected} · Gabarito: ${result.correctAnswer}${classified?.marked ? ' · Revisar' : ''}</small></span><strong class="pilot-result-status">${escapeHTML(CLASSIFICATION_LABELS[classification] || classification)}</strong></article>`; }).join('')}</div></section>
    <section class="section"><article class="card panel"><h2>Separação oficial</h2><p>O indicador do PE usa <code>scope=pilot-local</code>, <code>officialCompleted=false</code> e <code>notionWriteback=false</code>. O status oficial permanece intocado.</p></article></section>
    <footer class="footer"><span>${state.transaction ? 'Transação local concluída' : 'Transação local revertida'}</span><span>Fase 8</span></footer>`;
}

main.addEventListener('change', event => {
  const answer = event.target.closest('input[name="pilot-answer"]');
  const confidence = event.target.closest('input[name="pilot-confidence"]');
  const marked = event.target.closest('[data-player-marked]');
  const issue = event.target.closest('[data-player-issue]');
  if (!state.session) return;
  const questionId = state.session.questionIds[state.session.currentIndex];
  if (answer) state.session = selectAnswer(state.session, questionId, answer.value, Date.now());
  else if (confidence) updateResponseMeta(questionId, {confidence: confidence.value});
  else if (marked) updateResponseMeta(questionId, {marked: marked.checked});
  else if (issue) updateResponseMeta(questionId, {issue: issue.value});
  else return;
  renderQuestion();
});

main.addEventListener('click', event => {
  if (event.target.closest('[data-player-start]')) { state.session = createSession(state.catalog, Date.now()); startTimer(); renderQuestion(); return; }
  if (event.target.closest('[data-player-restart]')) { renderIntro(); return; }
  if (!state.session || state.session.finishedAt !== null) return;
  const indexButton = event.target.closest('[data-player-index]');
  if (indexButton) state.session = moveToQuestion(state.session, Number(indexButton.dataset.playerIndex), Date.now());
  else if (event.target.closest('[data-player-prev]')) state.session = moveToQuestion(state.session, state.session.currentIndex - 1, Date.now());
  else if (event.target.closest('[data-player-next]')) state.session = moveToQuestion(state.session, state.session.currentIndex + 1, Date.now());
  else if (event.target.closest('[data-player-finish]')) { finishSession(); return; }
  else return;
  renderQuestion();
});

try {
  const reviewId = new URLSearchParams(globalThis.location?.search || '').get('review');
  const [fullCatalog, shell] = await Promise.all([
    fetch(BASE + 'data/integration/pilot/pe76-catalog.json', {cache: 'no-store'}).then(response => { if (!response.ok) throw new Error(`Falha ao carregar catálogo (${response.status})`); return response.json(); }),
    loadJSON('data/more.json'),
  ]);
  if (reviewId) {
    const review = getReviewById(reviewId);
    if (!review) throw new Error('Revisão local não encontrada neste dispositivo.');
    if (review.status !== 'pending') throw new Error('Esta revisão já foi concluída.');
    if (review.dueAt > Date.now()) throw new Error('Esta revisão ainda não está disponível.');
    const question = fullCatalog.questoes.find(item => item.id === review.questionId);
    if (!question) throw new Error('Questão da revisão não existe no catálogo piloto.');
    state.reviewContext = review;
    state.catalog = {...fullCatalog, nome: `Revisão ${review.stage} — questão ${review.numeroOriginal}`, quantidade_questoes: 1, tempo_sugerido_minutos: 3, questoes: [question]};
  } else {
    state.reviewContext = null;
    state.catalog = fullCatalog;
  }
  setupShell('mais', shell.meta);
  renderIntro();
} catch (error) {
  setLoadingError(error);
}
