const DATA_URL = "../data/questoes-mvp.json";
const STORAGE_KEY = "sedes.questoes.history.v1";
const ACTIVE_KEY = "sedes.questoes.active.v1";

const app = document.querySelector("#app");
const themeToggle = document.querySelector("#theme-toggle");

const state = {
  data: null,
  material: null,
  questions: [],
  mode: null,
  current: 0,
  answers: {},
  confirmed: {},
  flagged: {},
  startedAt: null,
  elapsedBeforeResume: 0,
  questionStartedAt: null,
  questionTimes: {},
  timerId: null,
  finished: false,
  subset: null,
};

const esc = (value = "") => String(value)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const formatTime = (seconds) => {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return h ? `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`
    : `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
};

const nowSeconds = () => state.startedAt
  ? state.elapsedBeforeResume + (Date.now() - state.startedAt) / 1000
  : state.elapsedBeforeResume;

const loadHistory = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
};

const saveHistory = (attempt) => {
  const history = [attempt, ...loadHistory()].slice(0, 50);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
};

const setTheme = (theme) => {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("sedes.theme", theme);
};

themeToggle.addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});
setTheme(localStorage.getItem("sedes.theme") || "dark");

const clearTimer = () => {
  if (state.timerId) window.clearInterval(state.timerId);
  state.timerId = null;
};

const startTimer = () => {
  clearTimer();
  state.timerId = window.setInterval(() => {
    document.querySelectorAll("[data-total-time]").forEach(el => el.textContent = formatTime(nowSeconds()));
    if (state.questionStartedAt) {
      const currentQuestionSeconds = (Date.now() - state.questionStartedAt) / 1000;
      document.querySelectorAll("[data-question-time]").forEach(el => el.textContent = formatTime(currentQuestionSeconds));
    }
  }, 250);
};

const trackCurrentQuestion = () => {
  if (!state.questionStartedAt) return;
  const q = state.questions[state.current];
  if (!q) return;
  const seconds = (Date.now() - state.questionStartedAt) / 1000;
  state.questionTimes[q.id] = (state.questionTimes[q.id] || 0) + seconds;
  state.questionStartedAt = Date.now();
};

const persistActive = () => {
  if (!state.mode || state.finished) return;
  const snapshot = {
    materialId: state.material.id, mode: state.mode, current: state.current,
    answers: state.answers, confirmed: state.confirmed, flagged: state.flagged,
    elapsed: nowSeconds(), questionTimes: state.questionTimes, subset: state.subset,
  };
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(snapshot));
};

const renderHome = () => {
  clearTimer();
  state.mode = null;
  state.finished = false;
  localStorage.removeItem(ACTIVE_KEY);
  const m = state.material;
  const history = loadHistory();
  app.innerHTML = `
    <section class="hero card">
      <p class="eyebrow">Plataforma de treino · MVP</p>
      <h1>Resolva, corrija e acompanhe o seu desempenho.</h1>
      <p class="lead">Primeiro lote conectado ao Banco Mestre do Notion. Este protótipo valida os modos treino e prova, cronômetro, correção, comentários e histórico local.</p>
      <div class="meta-grid">
        <div class="meta"><small>Questões</small><strong>${state.questions.length}</strong></div>
        <div class="meta"><small>Disciplina</small><strong>${esc(m.disciplina)}</strong></div>
        <div class="meta"><small>Tempo sugerido</small><strong>${m.tempoSugeridoMinutos} min</strong></div>
        <div class="meta"><small>Fonte</small><strong>${esc(m.fonte)}</strong></div>
      </div>
    </section>
    <section class="section material-card card">
      <div>
        <div class="pills"><span class="pill">Simulado</span><span class="pill">${esc(m.ano)}</span><span class="pill">${esc(m.cargo)}</span></div>
        <h2>${esc(m.nome)}</h2>
        <p>No modo treino, a correção aparece após confirmar cada questão. No modo prova, o gabarito só aparece ao finalizar.</p>
      </div>
      <div class="actions">
        <button class="btn primary" data-start="treino">Iniciar modo treino</button>
        <button class="btn" data-start="prova">Iniciar modo prova</button>
      </div>
    </section>
    <section class="history card">
      <p class="eyebrow">Histórico no aparelho</p>
      <h2>Tentativas recentes</h2>
      <div class="history-list">
        ${history.length ? history.map(item => `
          <div class="history-item">
            <div><strong>${esc(item.materialName)}</strong><br><small>${new Date(item.finishedAt).toLocaleString("pt-BR")} · ${item.mode === "treino" ? "Treino" : "Prova"}</small></div>
            <div><strong>${item.correct}/${item.total} · ${item.percent}%</strong><br><small>${formatTime(item.elapsed)}</small></div>
          </div>`).join("") : `<p class="lead">Nenhuma tentativa concluída neste navegador.</p>`}
      </div>
    </section>`;
  document.querySelectorAll("[data-start]").forEach(btn => btn.addEventListener("click", () => begin(btn.dataset.start)));
};

const begin = (mode, subset = null) => {
  state.mode = mode;
  state.subset = subset;
  const ids = subset || state.material.questoes;
  state.questions = ids.map(id => state.data.questions.find(q => q.id === id)).filter(Boolean);
  state.current = 0; state.answers = {}; state.confirmed = {}; state.flagged = {};
  state.questionTimes = {}; state.elapsedBeforeResume = 0; state.startedAt = Date.now();
  state.questionStartedAt = Date.now(); state.finished = false;
  startTimer(); renderQuestion(); persistActive();
};

const optionClass = (q, letter) => {
  const selected = state.answers[q.id] === letter;
  const confirmed = state.confirmed[q.id];
  if (state.mode === "treino" && confirmed) {
    if (letter === q.gabarito) return "option correct";
    if (selected && letter !== q.gabarito) return "option incorrect";
  }
  return selected ? "option selected" : "option";
};

const renderFeedback = (q) => {
  if (state.mode !== "treino" || !state.confirmed[q.id]) return "";
  const answer = state.answers[q.id];
  const ok = answer === q.gabarito;
  return `<div class="feedback ${ok ? "good" : "bad"}">
    <h3>${ok ? "✅ Resposta correta" : "❌ Resposta incorreta"}</h3>
    <p>Você marcou <strong>${esc(answer || "em branco")}</strong>. Gabarito: <strong>${esc(q.gabarito)}</strong>.</p>
    <p>${esc(q.comentario || "Comentário não disponível.")}</p>
    ${q.fundamento ? `<p><strong>Fundamento:</strong> ${esc(q.fundamento)}</p>` : ""}
    ${q.pegadinha ? `<p><strong>Pegadinha:</strong> ${esc(q.pegadinha)}</p>` : ""}
  </div>`;
};

const renderQuestion = () => {
  const q = state.questions[state.current];
  if (!q) return finish();
  const answeredCount = Object.keys(state.answers).length;
  const confirmedCount = Object.keys(state.confirmed).length;
  const progress = ((state.current + 1) / state.questions.length) * 100;
  app.innerHTML = `
    <section class="exam-shell">
      <article class="question-card card">
        <div class="exam-head">
          <div><p class="eyebrow">${state.mode === "treino" ? "Modo treino" : "Modo prova"} · Questão ${state.current + 1} de ${state.questions.length}</p></div>
          <div class="timer">⏱ <span data-total-time>${formatTime(nowSeconds())}</span></div>
        </div>
        <div class="progress"><span style="width:${progress}%"></span></div>
        ${q.textoBase ? `<div class="text-base">${esc(q.textoBase)}</div>` : ""}
        <h2 class="question-title">${esc(q.enunciado)}</h2>
        <div class="options">
          ${Object.entries(q.alternativas).map(([letter,text]) => `
            <label class="${optionClass(q, letter)}" data-option="${letter}">
              <input type="radio" name="answer" value="${letter}" ${state.answers[q.id] === letter ? "checked" : ""} ${state.confirmed[q.id] ? "disabled" : ""}>
              <span class="letter">${letter}</span><span>${esc(text)}</span>
            </label>`).join("")}
        </div>
        ${renderFeedback(q)}
        <div class="exam-actions">
          <div class="actions">
            <button class="btn" data-prev ${state.current === 0 ? "disabled" : ""}>Anterior</button>
            <button class="btn" data-flag>${state.flagged[q.id] ? "★ Marcada" : "☆ Marcar para revisar"}</button>
          </div>
          <div class="actions">
            ${state.mode === "treino" && !state.confirmed[q.id] ? `<button class="btn primary" data-confirm ${state.answers[q.id] ? "" : "disabled"}>Confirmar resposta</button>` : ""}
            <button class="btn primary" data-next>${state.current === state.questions.length - 1 ? "Finalizar" : "Próxima"}</button>
          </div>
        </div>
      </article>
      <aside class="side-panel card">
        <h3>Mapa de questões</h3>
        <div class="question-map">
          ${state.questions.map((item,index) => {
            let cls = "map-btn";
            if (index === state.current) cls += " current";
            if (state.answers[item.id]) cls += " answered";
            if (state.mode === "treino" && state.confirmed[item.id]) cls += state.answers[item.id] === item.gabarito ? " correct" : " incorrect";
            if (state.flagged[item.id]) cls += " flagged";
            return `<button class="${cls}" data-jump="${index}">${index+1}</button>`;
          }).join("")}
        </div>
        <div class="side-stats">
          <div><span>Respondidas</span><strong>${answeredCount}/${state.questions.length}</strong></div>
          ${state.mode === "treino" ? `<div><span>Confirmadas</span><strong>${confirmedCount}</strong></div>` : ""}
          <div><span>Nesta questão</span><strong data-question-time>00:00</strong></div>
        </div>
        <button class="btn danger" data-exit style="width:100%;margin-top:15px">Sair da tentativa</button>
      </aside>
    </section>`;
  bindQuestionEvents(q);
  persistActive();
};

const bindQuestionEvents = (q) => {
  document.querySelectorAll("input[name=answer]").forEach(input => input.addEventListener("change", () => {
    state.answers[q.id] = input.value; renderQuestion();
  }));
  document.querySelector("[data-confirm]")?.addEventListener("click", () => {
    if (!state.answers[q.id]) return;
    state.confirmed[q.id] = true; renderQuestion();
  });
  document.querySelector("[data-prev]")?.addEventListener("click", () => navigate(state.current - 1));
  document.querySelector("[data-next]")?.addEventListener("click", () => {
    if (state.current === state.questions.length - 1) finish(); else navigate(state.current + 1);
  });
  document.querySelector("[data-flag]")?.addEventListener("click", () => {
    state.flagged[q.id] = !state.flagged[q.id]; renderQuestion();
  });
  document.querySelectorAll("[data-jump]").forEach(btn => btn.addEventListener("click", () => navigate(Number(btn.dataset.jump))));
  document.querySelector("[data-exit]")?.addEventListener("click", () => {
    trackCurrentQuestion(); state.elapsedBeforeResume = nowSeconds(); state.startedAt = null;
    if (confirm("Encerrar esta tentativa e voltar ao início?")) renderHome();
    else { state.startedAt = Date.now(); state.questionStartedAt = Date.now(); startTimer(); }
  });
};

const navigate = (index) => {
  if (index < 0 || index >= state.questions.length) return;
  trackCurrentQuestion(); state.current = index; state.questionStartedAt = Date.now(); renderQuestion();
};

const finish = () => {
  trackCurrentQuestion(); clearTimer(); state.elapsedBeforeResume = nowSeconds(); state.startedAt = null; state.finished = true;
  localStorage.removeItem(ACTIVE_KEY);
  const results = state.questions.map(q => {
    const answer = state.answers[q.id] || null;
    return {q, answer, correct: answer === q.gabarito};
  });
  const correct = results.filter(r => r.correct).length;
  const blank = results.filter(r => !r.answer).length;
  const wrong = state.questions.length - correct - blank;
  const percent = Math.round((correct / state.questions.length) * 1000) / 10;
  const attempt = {
    id: crypto.randomUUID?.() || String(Date.now()), materialId: state.material.id,
    materialName: state.material.nome, mode: state.mode, finishedAt: new Date().toISOString(),
    elapsed: Math.round(state.elapsedBeforeResume), total: state.questions.length, correct, wrong, blank, percent,
    answers: state.answers, questionTimes: state.questionTimes,
  };
  saveHistory(attempt);
  app.innerHTML = `
    <section class="result-card card">
      <p class="eyebrow">Tentativa concluída</p>
      <h1>${percent}% de aproveitamento</h1>
      <div class="summary-grid">
        <div class="summary"><small>Acertos</small><strong>${correct}</strong></div>
        <div class="summary"><small>Erros</small><strong>${wrong}</strong></div>
        <div class="summary"><small>Em branco</small><strong>${blank}</strong></div>
        <div class="summary"><small>Tempo total</small><strong>${formatTime(state.elapsedBeforeResume)}</strong></div>
      </div>
      <div class="actions" style="margin-top:20px">
        <button class="btn primary" data-home>Voltar ao início</button>
        ${wrong + blank ? `<button class="btn" data-retry>Refazer erradas e em branco</button>` : ""}
      </div>
      <div class="result-list">
        ${results.map((r,index) => `<article class="result-question">
          <header><strong>Questão ${index+1}</strong><strong class="${r.correct ? "status-good" : "status-bad"}">${r.correct ? "Correta" : "Revisar"}</strong></header>
          <p>${esc(r.q.enunciado)}</p>
          <p>Marcada: <strong>${esc(r.answer || "em branco")}</strong> · Gabarito: <strong>${esc(r.q.gabarito)}</strong></p>
          <p>${esc(r.q.comentario || "")}</p>
        </article>`).join("")}
      </div>
    </section>`;
  document.querySelector("[data-home]").addEventListener("click", renderHome);
  document.querySelector("[data-retry]")?.addEventListener("click", () => {
    const subset = results.filter(r => !r.correct).map(r => r.q.id);
    begin("treino", subset);
  });
};

const init = async () => {
  try {
    const response = await fetch(DATA_URL, {cache:"no-store"});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    state.material = state.data.materials[0];
    state.questions = state.material.questoes.map(id => state.data.questions.find(q => q.id === id)).filter(Boolean);
    renderHome();
  } catch (error) {
    console.error(error);
    app.replaceChildren(document.querySelector("#error-template").content.cloneNode(true));
  }
};

window.addEventListener("beforeunload", persistActive);
init();
