import {BASE, escapeHTML, loadJSON, setupShell, setLoadingError} from '../common.js?v=24.1';
import {createAttemptRecord, saveAttempt} from './attempt-store.js?v=1.0.0';
import {syncAttemptIndexes} from './classification-store.js?v=1.0.0';
import {ANSWER_OPTIONS, canFinish, createSession, evaluateSession, formatElapsed, moveToQuestion, selectAnswer, sessionProgress} from './player-core.js?v=1.0.0';
import {normalizeResponseMeta} from './response-classification.js?v=1.0.0';

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
  attemptRecord: null,
  savedAttempt: null,
  saveError: null,
  indexStatus: null,
  indexError: null,
  timerId: null,
};

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
  state.responseMeta = {
    ...state.responseMeta,
    [questionId]: normalizeResponseMeta({...responseMetaFor(questionId), ...patch}),
  };
}

function renderIntro() {
  stopTimer();
  state.session = null;
  state.evaluation = null;
  state.responseMeta = {};
  state.attemptRecord = null;
  state.savedAttempt = null;
  state.saveError = null;
  state.indexStatus = null;
  state.indexError = null;
  main.innerHTML = `
    <section class="hero">
      <span class="kicker">Piloto técnico · PE76</span>
      <h1>Resolver questões</h1>
      <p>${escapeHTML(state.catalog.nome)}</p>
      <div class="tags">
        <span class="tag">${state.catalog.quantidade_questoes} questões</span>
        <span class="tag">${state.catalog.tempo_sugerido_minutos} minutos sugeridos</span>
        <span class="tag">Classificação ativa</span>
      </div>
      <div class="hero-actions"><button class="btn primary" data-player-start>Iniciar piloto</button><a class="btn" href="${BASE}estudar/">Voltar ao catálogo</a></div>
    </section>
    <section class="section"><div class="grid two">
      <article class="card panel"><h2>Como funciona</h2><p>Além da alternativa, registre se respondeu com segurança, dúvida ou chute. Você também pode marcar a questão ou indicar possível anulação ou erro da fonte.</p></article>
      <article class="card panel"><h2>Regra do caderno</h2><p>Somente a tentativa concluída é salva. Apenas <strong>erro confirmado</strong> entra no caderno; ressalvas editoriais ficam fora dele.</p></article>
    </div></section>
    <footer class="footer"><span>Player piloto · Fase 6</span><span>Sem writeback</span></footer>`;
}

function renderQuestion() {
  const progress = sessionProgress(state.session);
  const question = state.catalog.questoes[state.session.currentIndex];
  const selected = state.session.answers[question.id] || '';
  const meta = responseMetaFor(question.id);
  main.innerHTML = `
    <section class="hero pilot-shell">
      <div class="pilot-toolbar">
        <div class="pilot-progress">
          <div><strong>Questão ${state.session.currentIndex + 1} de ${progress.total}</strong> · ${progress.answered} respondidas</div>
          <div class="pilot-progress-track" aria-label="${progress.percent.toFixed(0)}% respondido"><div class="pilot-progress-fill" style="width:${progress.percent}%"></div></div>
        </div>
        <strong class="pilot-timer" id="pilot-timer" aria-label="Tempo decorrido">${formatElapsed(Date.now() - state.session.startedAt)}</strong>
      </div>
    </section>
    <section class="section pilot-shell">
      <article class="card panel pilot-question">
        <div><span class="kicker">Questão ${question.numero_original} · ${escapeHTML(question.assunto)}</span><h1>${escapeHTML(question.enunciado)}</h1></div>
        ${question.texto_base ? `<blockquote class="pilot-text">${escapeHTML(question.texto_base)}</blockquote>` : ''}
        <fieldset class="pilot-options"><legend class="skip">Escolha uma alternativa</legend>${ANSWER_OPTIONS.map(option => `
          <label class="pilot-option">
            <input type="radio" name="pilot-answer" value="${option}" ${selected === option ? 'checked' : ''}>
            <span><strong>${option})</strong> ${escapeHTML(question.alternativas[option])}</span>
          </label>`).join('')}</fieldset>
        <fieldset class="pilot-meta">
          <legend><strong>Como você chegou à resposta?</strong></legend>
          <div class="pilot-meta-grid">
            <label><input type="radio" name="pilot-confidence" value="secure" ${meta.confidence === 'secure' ? 'checked' : ''}> Segurança</label>
            <label><input type="radio" name="pilot-confidence" value="doubt" ${meta.confidence === 'doubt' ? 'checked' : ''}> Dúvida</label>
            <label><input type="radio" name="pilot-confidence" value="guess" ${meta.confidence === 'guess' ? 'checked' : ''}> Chute</label>
          </div>
          <label><input type="checkbox" data-player-marked ${meta.marked ? 'checked' : ''}> Marcar para revisão</label>
          <label>Ressalva editorial
            <select data-player-issue>
              <option value="none" ${meta.issue === 'none' ? 'selected' : ''}>Nenhuma</option>
              <option value="annulment_pending" ${meta.issue === 'annulment_pending' ? 'selected' : ''}>Possível anulação</option>
              <option value="source_error" ${meta.issue === 'source_error' ? 'selected' : ''}>Possível erro da fonte/gabarito</option>
            </select>
          </label>
        </fieldset>
      </article>
      <article class="card panel">
        <h2>Mapa da sessão</h2>
        <div class="pilot-map">${state.catalog.questoes.map((item, index) => {
          const itemMeta = responseMetaFor(item.id);
          return `<button class="btn ${state.session.answers[item.id] ? 'answered' : ''} ${itemMeta.marked ? 'marked' : ''} ${index === state.session.currentIndex ? 'current' : ''}" data-player-index="${index}" aria-label="Ir para questão ${index + 1}">${index + 1}</button>`;
        }).join('')}</div>
      </article>
      <div class="pilot-actions">
        <button class="btn" data-player-prev ${state.session.currentIndex === 0 ? 'disabled' : ''}>← Anterior</button>
        <a class="btn" href="${BASE}estudar/">Sair e descartar sessão</a>
        ${state.session.currentIndex < progress.total - 1
          ? '<button class="btn primary" data-player-next>Próxima →</button>'
          : `<button class="btn primary" data-player-finish ${canFinish(state.session) ? '' : 'disabled'}>Finalizar (${progress.remaining} pendentes)</button>`}
      </div>
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
    try {
      state.attemptRecord = createAttemptRecord({
        catalog: state.catalog,
        evaluation: state.evaluation,
        responseMeta: state.responseMeta,
        savedAt: Date.now(),
      });
      state.savedAttempt = saveAttempt(state.attemptRecord);
      state.saveError = null;
      try {
        state.indexStatus = syncAttemptIndexes(state.attemptRecord);
        state.indexError = null;
      } catch (error) {
        state.indexStatus = null;
        state.indexError = error;
        console.error('Falha ao atualizar caderno e marcações', error);
      }
    } catch (error) {
      state.attemptRecord = null;
      state.savedAttempt = null;
      state.saveError = error;
      console.error('Falha ao salvar tentativa local', error);
    }
    stopTimer();
    renderResult();
  } catch (error) {
    if (button) { button.disabled = false; button.textContent = 'Tentar finalizar novamente'; }
    alert(`Não foi possível corrigir o piloto: ${error.message}`);
  }
}

function renderResult() {
  const evaluation = state.evaluation;
  const resultMap = new Map(evaluation.results.map(result => [result.id, result]));
  const classifiedMap = new Map((state.attemptRecord?.questionResults || []).map(result => [result.id, result]));
  const storageMessage = state.savedAttempt
    ? `Tentativa salva neste dispositivo. Histórico local: ${state.savedAttempt.totalStored}.`
    : `Resultado calculado, mas não salvo neste dispositivo${state.saveError ? `: ${escapeHTML(state.saveError.message)}` : '.'}`;
  const indexMessage = state.indexStatus
    ? `Caderno local: ${state.indexStatus.totalErrors} erros confirmados; ${state.indexStatus.totalMarked} marcações.`
    : state.indexError ? `Índices locais não atualizados: ${escapeHTML(state.indexError.message)}.` : '';
  main.innerHTML = `
    <section class="hero pilot-result">
      <span class="kicker">Resultado classificado do piloto</span>
      <h1>${evaluation.correct}/${evaluation.total} acertos · ${evaluation.percent.toFixed(0)}%</h1>
      <p>Tempo: ${formatElapsed(evaluation.elapsedMs)}. ${storageMessage} ${indexMessage} Este resultado não foi enviado ao Notion nem ao progresso oficial.</p>
      <div class="hero-actions"><button class="btn primary" data-player-restart>Refazer piloto</button><a class="btn" href="${BASE}caderno-erros/">Abrir caderno local</a><a class="btn" href="${BASE}estudar/">Voltar ao catálogo</a></div>
    </section>
    <section class="section"><div class="pilot-result-list">${state.catalog.questoes.map((question, index) => {
      const result = resultMap.get(question.id);
      const classified = classifiedMap.get(question.id);
      const classification = classified?.classification || (result.correct ? 'correct_secure' : 'incorrect_confirmed');
      return `<article class="card pilot-result-item" data-correct="${result.correct}">
        <strong>${index + 1}</strong>
        <span>${escapeHTML(question.subassunto)}<br><small>Marcada: ${result.selected} · Gabarito: ${result.correctAnswer}${classified?.marked ? ' · Revisar' : ''}</small></span>
        <strong class="pilot-result-status">${escapeHTML(CLASSIFICATION_LABELS[classification] || classification)}</strong>
      </article>`;
    }).join('')}</div></section>
    <section class="section"><article class="card panel"><h2>Regra aplicada</h2><p>Possível anulação e erro da fonte não viram erro definitivo. Somente <code>incorrect_confirmed</code> é elegível ao caderno.</p></article></section>
    <footer class="footer"><span>Player piloto · classificação concluída</span><span>Histórico e índices somente locais</span></footer>`;
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
  const start = event.target.closest('[data-player-start]');
  if (start) {
    state.session = createSession(state.catalog, Date.now());
    startTimer();
    renderQuestion();
    return;
  }
  const restart = event.target.closest('[data-player-restart]');
  if (restart) { renderIntro(); return; }
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
  const [catalog, shell] = await Promise.all([
    fetch(BASE + 'data/integration/pilot/pe76-catalog.json', {cache: 'no-store'}).then(response => {
      if (!response.ok) throw new Error(`Falha ao carregar catálogo (${response.status})`);
      return response.json();
    }),
    loadJSON('data/more.json'),
  ]);
  state.catalog = catalog;
  setupShell('mais', shell.meta);
  renderIntro();
} catch (error) {
  setLoadingError(error);
}
