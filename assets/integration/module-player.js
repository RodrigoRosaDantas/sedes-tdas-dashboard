import {BASE, escapeHTML, loadJSON, setupShell, setLoadingError} from '../common.js?v=24.1';
import {ANSWER_OPTIONS, canFinish, createSession, evaluateSession, formatElapsed, moveToQuestion, selectAnswer, sessionProgress} from './player-core.js?v=1.0.0';
import {readModuleState, saveCompletedAttempt} from './module-store.js?v=2.0.0';

const main = document.querySelector('main');
const state = {catalog: null, session: null, responseMeta: {}, review: null, timer: null};

const safeKeyPath = path => /^data\/integration\/question-keys\/[a-z0-9._-]+\.json$/i.test(String(path || ''));

function stopTimer() {
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
}
function updateTimer() {
  const node = document.querySelector('[data-module-timer]');
  if (node && state.session) node.textContent = formatElapsed(Date.now() - state.session.startedAt);
}
function startTimer() {
  stopTimer();
  updateTimer();
  state.timer = setInterval(updateTimer, 1000);
}
function metaFor(id) {
  return {confidence: 'secure', marked: false, issue: 'none', ...(state.responseMeta[id] || {})};
}
function questionCatalog() {
  if (!state.review) return state.catalog;
  const question = state.catalog.questions.find(item => item.id === state.review.questionId);
  return question ? {...state.catalog, catalogId: `${state.catalog.catalogId}:review:${state.review.id}`, title: `Revisão ${state.review.stage}`, questionCount: 1, questions: [question]} : null;
}
function renderEmpty() {
  main.innerHTML = `<section class="hero"><span class="kicker">Resolver · uso real</span><h1>Nenhuma questão disponível</h1><p>O player está operacional, mas nenhum catálogo autorizado foi incorporado ao módulo. O conjunto PE76 de exemplo não é carregado.</p><div class="hero-actions"><a class="btn primary" href="${BASE}estudar/">Voltar para Estudar</a><a class="btn" href="${BASE}revisar/">Abrir revisões</a></div></section><section class="section"><article class="card panel"><h2>Sem importação automática</h2><p>Esta página não consulta o Banco Mestre, o Notion ou outro repositório de questões em tempo de execução.</p></article></section>`;
}
function renderUnavailableReview() {
  main.innerHTML = `<section class="hero"><span class="kicker">Revisão local</span><h1>Questão não disponível no catálogo atual</h1><p>A referência de revisão foi preservada, mas o conteúdo correspondente não integra o catálogo autorizado atual.</p><div class="hero-actions"><a class="btn primary" href="${BASE}revisar/">Voltar às revisões</a></div></section>`;
}
function renderIntro() {
  const catalog = questionCatalog();
  if (!catalog) return renderUnavailableReview();
  state.session = null;
  state.responseMeta = {};
  main.innerHTML = `<section class="hero"><span class="kicker">${state.review ? `Revisão ${escapeHTML(state.review.stage)}` : 'Sessão local'}</span><h1>${escapeHTML(state.review ? `Revisar questão ${state.review.numeroOriginal ?? ''}` : catalog.title)}</h1><p>${escapeHTML(catalog.description || 'Responda todas as questões antes da correção.')}</p><div class="tags"><span class="tag">${catalog.questions.length} ${catalog.questions.length === 1 ? 'questão' : 'questões'}</span><span class="tag">Correção somente ao finalizar</span><span class="tag">Sem writeback</span></div><div class="hero-actions"><button class="btn primary" data-module-start>Iniciar</button><a class="btn" href="${state.review ? `${BASE}revisar/` : `${BASE}estudar/`}">Voltar</a></div></section>`;
}
function renderQuestion() {
  const catalog = questionCatalog();
  const progress = sessionProgress(state.session);
  const question = catalog.questions[state.session.currentIndex];
  const selected = state.session.answers[question.id] || '';
  const meta = metaFor(question.id);
  main.innerHTML = `<section class="hero pilot-shell"><div class="pilot-toolbar"><div class="pilot-progress"><div><strong>Questão ${state.session.currentIndex + 1} de ${progress.total}</strong> · ${progress.answered} respondidas</div><div class="pilot-progress-track"><div class="pilot-progress-fill" style="width:${progress.percent}%"></div></div></div><strong class="pilot-timer" data-module-timer>${formatElapsed(Date.now() - state.session.startedAt)}</strong></div></section><section class="section pilot-shell"><article class="card panel pilot-question"><span class="kicker">${escapeHTML(question.assunto || 'Questão')}</span><h1>${escapeHTML(question.enunciado)}</h1>${question.texto_base ? `<blockquote class="pilot-text">${escapeHTML(question.texto_base)}</blockquote>` : ''}<fieldset class="pilot-options"><legend class="skip">Escolha uma alternativa</legend>${ANSWER_OPTIONS.filter(option => question.alternativas?.[option]).map(option => `<label class="pilot-option"><input type="radio" name="module-answer" value="${option}" ${selected === option ? 'checked' : ''}><span><strong>${option})</strong> ${escapeHTML(question.alternativas[option])}</span></label>`).join('')}</fieldset><fieldset class="pilot-meta"><legend><strong>Como você chegou à resposta?</strong></legend><div class="pilot-meta-grid"><label><input type="radio" name="module-confidence" value="secure" ${meta.confidence === 'secure' ? 'checked' : ''}> Segurança</label><label><input type="radio" name="module-confidence" value="doubt" ${meta.confidence === 'doubt' ? 'checked' : ''}> Dúvida</label><label><input type="radio" name="module-confidence" value="guess" ${meta.confidence === 'guess' ? 'checked' : ''}> Chute</label></div><label><input type="checkbox" data-module-marked ${meta.marked ? 'checked' : ''}> Marcar para revisão</label><label>Ressalva editorial<select data-module-issue><option value="none" ${meta.issue === 'none' ? 'selected' : ''}>Nenhuma</option><option value="annulment_pending" ${meta.issue === 'annulment_pending' ? 'selected' : ''}>Possível anulação</option><option value="source_error" ${meta.issue === 'source_error' ? 'selected' : ''}>Possível erro da fonte</option></select></label></fieldset></article><article class="card panel"><h2>Mapa da sessão</h2><div class="pilot-map">${catalog.questions.map((item, index) => `<button class="btn ${state.session.answers[item.id] ? 'answered' : ''} ${index === state.session.currentIndex ? 'current' : ''}" data-module-index="${index}">${index + 1}</button>`).join('')}</div></article><div class="pilot-actions"><button class="btn" data-module-prev ${state.session.currentIndex === 0 ? 'disabled' : ''}>← Anterior</button><a class="btn" href="${state.review ? `${BASE}revisar/` : `${BASE}estudar/`}">Sair</a>${state.session.currentIndex < progress.total - 1 ? '<button class="btn primary" data-module-next>Próxima →</button>' : `<button class="btn primary" data-module-finish ${canFinish(state.session) ? '' : 'disabled'}>Finalizar (${progress.remaining} pendentes)</button>`}</div></section>`;
  updateTimer();
}
async function finishSession() {
  if (!canFinish(state.session)) return;
  const catalog = questionCatalog();
  if (!safeKeyPath(state.catalog.keyPath)) throw new Error('O catálogo autorizado não possui caminho de gabarito válido.');
  const key = await fetch(BASE + state.catalog.keyPath, {cache: 'no-store'}).then(response => {
    if (!response.ok) throw new Error(`Falha ao carregar gabarito (${response.status}).`);
    return response.json();
  });
  const normalizedKey = state.review ? {...key, material_id: catalog.catalogId, answers: key.answers.filter(item => item.id === catalog.questions[0].id)} : key;
  const evaluation = evaluateSession(state.session, normalizedKey, Date.now());
  const saved = saveCompletedAttempt({catalog, evaluation, responseMeta: state.responseMeta, mode: state.review ? 'review' : 'study', reviewId: state.review?.id || null});
  stopTimer();
  main.innerHTML = `<section class="hero pilot-result"><span class="kicker">Resultado local</span><h1>${evaluation.correct}/${evaluation.total} acertos · ${evaluation.percent.toFixed(0)}%</h1><p>Tentativa salva somente neste dispositivo. Foram registrados ${saved.state.errors.length} erros, ${saved.state.reviews.filter(item => item.status === 'pending').length} revisões pendentes e ${saved.state.aiQueue.length} ressalvas para análise.</p><div class="hero-actions"><a class="btn primary" href="${state.review ? `${BASE}revisar/` : `${BASE}resolver/`}">${state.review ? 'Voltar às revisões' : 'Nova sessão'}</a><a class="btn" href="${BASE}caderno-erros/">Abrir caderno</a><a class="btn" href="${BASE}desempenho/">Ver desempenho</a></div></section>`;
}
main.addEventListener('change', event => {
  if (!state.session) return;
  const questionId = state.session.questionIds[state.session.currentIndex];
  if (event.target.matches('input[name="module-answer"]')) state.session = selectAnswer(state.session, questionId, event.target.value, Date.now());
  else if (event.target.matches('input[name="module-confidence"]')) state.responseMeta[questionId] = {...metaFor(questionId), confidence: event.target.value};
  else if (event.target.matches('[data-module-marked]')) state.responseMeta[questionId] = {...metaFor(questionId), marked: event.target.checked};
  else if (event.target.matches('[data-module-issue]')) state.responseMeta[questionId] = {...metaFor(questionId), issue: event.target.value};
  else return;
  renderQuestion();
});
main.addEventListener('click', event => {
  if (event.target.closest('[data-module-start]')) {
    const catalog = questionCatalog();
    state.session = createSession({id: catalog.catalogId, questoes: catalog.questions}, Date.now());
    startTimer();
    renderQuestion();
    return;
  }
  if (!state.session) return;
  const index = event.target.closest('[data-module-index]');
  if (index) state.session = moveToQuestion(state.session, Number(index.dataset.moduleIndex), Date.now());
  else if (event.target.closest('[data-module-prev]')) state.session = moveToQuestion(state.session, state.session.currentIndex - 1, Date.now());
  else if (event.target.closest('[data-module-next]')) state.session = moveToQuestion(state.session, state.session.currentIndex + 1, Date.now());
  else if (event.target.closest('[data-module-finish]')) { finishSession().catch(error => alert(error.message)); return; }
  else return;
  renderQuestion();
});

try {
  const [catalog, shell] = await Promise.all([
    fetch(BASE + 'data/integration/question-catalog.json', {cache: 'no-store'}).then(response => response.json()),
    loadJSON('data/more.json'),
  ]);
  setupShell('mais', shell.meta);
  state.catalog = catalog;
  const reviewId = new URLSearchParams(location.search).get('review');
  if (reviewId) {
    state.review = readModuleState().reviews.find(item => item.id === reviewId && item.status === 'pending') || null;
    if (!state.review) throw new Error('Revisão local não encontrada ou já concluída.');
    if (state.review.dueAt > Date.now()) throw new Error('Esta revisão ainda não está disponível.');
  }
  if (!Array.isArray(catalog.questions) || catalog.questions.length === 0) renderEmpty();
  else renderIntro();
} catch (error) {
  setLoadingError(error);
}
