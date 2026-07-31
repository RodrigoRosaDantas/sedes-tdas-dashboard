import {BASE, escapeHTML, loadJSON, setupShell, setLoadingError} from '../common.js?v=24.1';
import {createAttemptRecord, saveAttempt} from './attempt-store.js?v=1.0.0';
import {ANSWER_OPTIONS, canFinish, createSession, evaluateSession, formatElapsed, moveToQuestion, selectAnswer, sessionProgress} from './player-core.js?v=1.0.0';

const main = document.querySelector('main');
const state = {catalog: null, session: null, evaluation: null, savedAttempt: null, saveError: null, timerId: null};

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

function renderIntro() {
  stopTimer();
  state.session = null;
  state.evaluation = null;
  state.savedAttempt = null;
  state.saveError = null;
  main.innerHTML = `
    <section class="hero">
      <span class="kicker">Piloto técnico · PE76</span>
      <h1>Resolver questões</h1>
      <p>${escapeHTML(state.catalog.nome)}</p>
      <div class="tags">
        <span class="tag">${state.catalog.quantidade_questoes} questões</span>
        <span class="tag">${state.catalog.tempo_sugerido_minutos} minutos sugeridos</span>
        <span class="tag">Sessão ativa em memória</span>
      </div>
      <div class="hero-actions"><button class="btn primary" data-player-start>Iniciar piloto</button><a class="btn" href="${BASE}estudar/">Voltar ao catálogo</a></div>
    </section>
    <section class="section"><div class="grid two">
      <article class="card panel"><h2>Como funciona</h2><p>Responda às dez questões. O gabarito só será solicitado quando você finalizar a sessão.</p></article>
      <article class="card panel"><h2>Histórico local</h2><p>A sessão em andamento é descartada ao sair. Somente a tentativa concluída é salva neste dispositivo, como piloto e sem progresso oficial.</p></article>
    </div></section>
    <footer class="footer"><span>Player piloto · Fase 5</span><span>Sem writeback</span></footer>`;
}

function renderQuestion() {
  const progress = sessionProgress(state.session);
  const question = state.catalog.questoes[state.session.currentIndex];
  const selected = state.session.answers[question.id] || '';
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
      </article>
      <article class="card panel">
        <h2>Mapa da sessão</h2>
        <div class="pilot-map">${state.catalog.questoes.map((item, index) => `<button class="btn ${state.session.answers[item.id] ? 'answered' : ''} ${index === state.session.currentIndex ? 'current' : ''}" data-player-index="${index}" aria-label="Ir para questão ${index + 1}">${index + 1}</button>`).join('')}</div>
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
      const attempt = createAttemptRecord({catalog: state.catalog, evaluation: state.evaluation, savedAt: Date.now()});
      state.savedAttempt = saveAttempt(attempt);
      state.saveError = null;
    } catch (error) {
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
  const storageMessage = state.savedAttempt
    ? `Tentativa salva neste dispositivo. Histórico local: ${state.savedAttempt.totalStored}.`
    : `Resultado calculado, mas não salvo neste dispositivo${state.saveError ? `: ${escapeHTML(state.saveError.message)}` : '.'}`;
  main.innerHTML = `
    <section class="hero pilot-result">
      <span class="kicker">Resultado local do piloto</span>
      <h1>${evaluation.correct}/${evaluation.total} acertos · ${evaluation.percent.toFixed(0)}%</h1>
      <p>Tempo: ${formatElapsed(evaluation.elapsedMs)}. ${storageMessage} Este resultado não foi enviado ao Notion nem ao progresso oficial.</p>
      <div class="hero-actions"><button class="btn primary" data-player-restart>Refazer piloto</button><a class="btn" href="${BASE}estudar/">Voltar ao catálogo</a></div>
    </section>
    <section class="section"><div class="pilot-result-list">${state.catalog.questoes.map((question, index) => {
      const result = resultMap.get(question.id);
      return `<article class="card pilot-result-item" data-correct="${result.correct}">
        <strong>${index + 1}</strong>
        <span>${escapeHTML(question.subassunto)}<br><small>Marcada: ${result.selected} · Gabarito: ${result.correctAnswer}</small></span>
        <strong class="pilot-result-status">${result.correct ? 'Correta' : 'Incorreta'}</strong>
      </article>`;
    }).join('')}</div></section>
    <section class="section"><article class="card panel"><h2>Escopo do histórico</h2><p>A tentativa foi identificada como piloto do PE76, Cargo 202, perfil Rodrigo, com <code>officialProgress=false</code> e <code>notionWriteback=false</code>.</p></article></section>
    <footer class="footer"><span>Player piloto · correção concluída</span><span>Histórico somente local</span></footer>`;
}

main.addEventListener('change', event => {
  const input = event.target.closest('input[name="pilot-answer"]');
  if (!input || !state.session) return;
  const questionId = state.session.questionIds[state.session.currentIndex];
  state.session = selectAnswer(state.session, questionId, input.value, Date.now());
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
