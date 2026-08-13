const DAY_MS = 86_400_000;
const UNCERTAIN_CLASSIFICATIONS = new Set(['correct_with_doubt', 'correct_by_guess', 'marked']);
const CRITICAL_REVIEW_SIGNALS = new Set(['wrong_again', 'incorrect_confirmed']);

const numeric = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round((numeric(value) + Number.EPSILON) * factor) / factor;
};
const ratio = (numerator, denominator) => denominator ? round(numeric(numerator) / numeric(denominator) * 100) : 0;
const peNumber = value => numeric(String(value || '').replace(/\D/g, ''));
const completedStatus = value => /conclu|finaliz|feito|realiz/i.test(String(value || ''));

function calendarDistanceInclusive(fromIso, toIso) {
  const parse = value => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
  };
  const from = parse(fromIso), to = parse(toIso);
  if (from === null || to === null) return null;
  return Math.max(0, Math.floor((to - from) / DAY_MS) + 1);
}

function orderedAttempts(local = {}) {
  return [...(Array.isArray(local.attempts) ? local.attempts : [])]
    .filter(item => item && Number.isFinite(Number(item.finishedAt)))
    .sort((a, b) => Number(a.finishedAt) - Number(b.finishedAt));
}

function aggregateAttempts(attempts = []) {
  const questions = attempts.reduce((sum, item) => sum + numeric(item.total), 0);
  const correct = attempts.reduce((sum, item) => sum + numeric(item.correct), 0);
  const elapsedMs = attempts.reduce((sum, item) => sum + numeric(item.elapsedMs), 0);
  return Object.freeze({
    attempts: attempts.length,
    studyAttempts: attempts.filter(item => item.mode === 'study').length,
    reviewAttempts: attempts.filter(item => item.mode === 'review').length,
    questions,
    correct,
    incorrect: Math.max(0, questions - correct),
    accuracy: ratio(correct, questions),
    elapsedMs,
    averageQuestionMs: questions ? Math.round(elapsedMs / questions) : 0,
  });
}

function windowStats(attempts, now, days) {
  const threshold = numeric(now) - days * DAY_MS;
  const selected = attempts.filter(item => numeric(item.finishedAt) >= threshold);
  const aggregate = aggregateAttempts(selected);
  const activeDays = new Set(selected.map(item => new Date(numeric(item.finishedAt)).toISOString().slice(0, 10))).size;
  return Object.freeze({...aggregate, activeDays, days});
}

function buildTrend(attempts) {
  const study = attempts.filter(item => item.mode === 'study');
  const recent = study.slice(-5);
  const previous = study.slice(-10, -5);
  const mean = rows => rows.length ? rows.reduce((sum, item) => sum + numeric(item.percent), 0) / rows.length : null;
  const recentAverage = mean(recent), previousAverage = mean(previous);
  const delta = recentAverage !== null && previousAverage !== null ? round(recentAverage - previousAverage) : null;
  return Object.freeze({
    recentCount: recent.length,
    previousCount: previous.length,
    recentAverage: recentAverage === null ? null : round(recentAverage),
    previousAverage: previousAverage === null ? null : round(previousAverage),
    delta,
    direction: delta === null ? 'sem_base' : delta > 0.4 ? 'subindo' : delta < -0.4 ? 'caindo' : 'estavel',
  });
}

function topicDiagnostics(attempts) {
  const groups = new Map();
  for (const attempt of attempts) {
    for (const item of attempt.questionResults || []) {
      const topic = String(item.subassunto || item.assunto || 'Sem assunto').trim() || 'Sem assunto';
      const key = topic.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
      const current = groups.get(key) || {topic, total: 0, correct: 0, errors: 0, uncertain: 0, pes: new Set()};
      current.total += 1;
      if (item.correct === true) current.correct += 1;
      if (item.classification === 'incorrect_confirmed') current.errors += 1;
      if (UNCERTAIN_CLASSIFICATIONS.has(item.classification) || ['doubt', 'guess'].includes(item.confidence)) current.uncertain += 1;
      if (attempt.peId) current.pes.add(String(attempt.peId));
      groups.set(key, current);
    }
  }
  return Object.freeze([...groups.values()].map(item => Object.freeze({
    topic: item.topic,
    total: item.total,
    correct: item.correct,
    errors: item.errors,
    uncertain: item.uncertain,
    accuracy: ratio(item.correct, item.total),
    riskScore: item.errors * 4 + item.uncertain * 2,
    pes: Object.freeze([...item.pes]),
  })).sort((a, b) => b.riskScore - a.riskScore || b.errors - a.errors || a.accuracy - b.accuracy || a.topic.localeCompare(b.topic, 'pt-BR')).slice(0, 12));
}

function draftSnapshot(draft, currentPe) {
  if (!draft || typeof draft !== 'object') return Object.freeze({active: false, currentPe: false, answered: 0, total: 0, currentIndex: null, savedAt: null});
  const answers = draft.session?.answers && typeof draft.session.answers === 'object' ? Object.keys(draft.session.answers).filter(key => String(draft.session.answers[key] || '').trim()).length : 0;
  const total = Array.isArray(draft.session?.questionIds) ? draft.session.questionIds.length : numeric(draft.session?.total);
  return Object.freeze({
    active: true,
    currentPe: String(draft.peId || '') === String(currentPe || ''),
    peId: draft.peId || null,
    answered: answers,
    total,
    currentIndex: Number.isInteger(draft.session?.currentIndex) ? draft.session.currentIndex : null,
    savedAt: numeric(draft.savedAt) || null,
  });
}

function dataQuality({home, audit, platform, local}) {
  const officialErrors = numeric(home?.metrics?.errors);
  const linkedErrors = numeric(audit?.summary?.linked_error_records);
  return Object.freeze({
    officialSnapshotDate: home?.meta?.snapshotDate || null,
    syncAt: platform?.syncAt || null,
    platformVersion: platform?.platformVersion || null,
    dataVersion: platform?.dataVersion || home?.meta?.version || null,
    sourceCommit: platform?.sourceCommit || null,
    localUpdatedAt: numeric(local?.updatedAt) || null,
    linkedOfficialErrors: linkedErrors,
    unlinkedOfficialErrors: Math.max(0, officialErrors - linkedErrors),
    policy: 'official-and-local-separated',
  });
}

export function buildStudyState({home = {}, platform = {}, local = {}, draft = null, dailyProgress = null, audit = {}, now = Date.now()} = {}) {
  const attempts = orderedAttempts(local);
  const localAggregate = aggregateAttempts(attempts);
  const reviews = Array.isArray(local.reviews) ? local.reviews : [];
  const dueReviews = reviews.filter(item => item?.status === 'pending' && numeric(item.dueAt) <= numeric(now));
  const criticalDueReviews = dueReviews.filter(item => CRITICAL_REVIEW_SIGNALS.has(item.sourceOutcome || item.outcome || item.classification));
  const currentPe = home?.today?.pe || platform?.peId || null;
  const totalPe = numeric(home?.metrics?.totalPE);
  const completedPe = numeric(home?.metrics?.completed);
  const pendingPe = Math.max(0, totalPe - completedPe);
  const operationalDays = numeric(home?.metrics?.operationalDays || home?.metrics?.calendarDays);
  const officialQuestions = numeric(home?.metrics?.resultQuestions || home?.metrics?.questions);
  const officialCorrect = numeric(home?.metrics?.correct);
  const todayStatus = home?.today?.status || null;
  const planPct = ratio(completedPe, totalPe);
  const inclusiveDaysToExam = calendarDistanceInclusive(home?.meta?.snapshotDate, home?.meta?.examDate);
  const requiredPePerDay = operationalDays ? round(pendingPe / operationalDays) : null;
  const draftState = draftSnapshot(draft, currentPe);
  const currentProgress = dailyProgress && typeof dailyProgress === 'object' ? Object.freeze({...dailyProgress}) : null;

  const official = Object.freeze({
    currentPe,
    currentPeNumber: peNumber(currentPe),
    currentTitle: home?.today?.title || null,
    currentStatus: todayStatus,
    currentCompleted: completedStatus(todayStatus),
    completedPe,
    totalPe,
    pendingPe,
    completionPct: planPct,
    questions: officialQuestions,
    correct: officialCorrect,
    incorrect: Math.max(0, officialQuestions - officialCorrect),
    accuracy: home?.metrics?.accuracy == null ? ratio(officialCorrect, officialQuestions) : round(home.metrics.accuracy),
    errors: numeric(home?.metrics?.errors),
    redactions: numeric(home?.metrics?.redactions),
    operationalDays,
    daysIncludingToday: inclusiveDaysToExam,
    requiredPePerDay,
    latestPe: home?.latest?.pe || null,
    latestAccuracy: home?.latest?.accuracy == null ? null : round(home.latest.accuracy),
  });

  const localState = Object.freeze({
    ...localAggregate,
    errors: Array.isArray(local.errors) ? local.errors.length : 0,
    marked: Array.isArray(local.marked) ? local.marked.length : 0,
    aiPending: Array.isArray(local.aiQueue) ? local.aiQueue.filter(item => item?.status !== 'completed').length : 0,
    reviews: Object.freeze({
      pending: reviews.filter(item => item?.status === 'pending').length,
      due: dueReviews.length,
      criticalDue: criticalDueReviews.length,
      completed: reviews.filter(item => item?.status === 'completed').length,
    }),
    draft: draftState,
    currentProgress,
    lastActivityAt: Math.max(
      numeric(local?.updatedAt),
      numeric(draftState.savedAt),
      attempts.length ? numeric(attempts.at(-1).finishedAt) : 0,
    ) || null,
  });

  return Object.freeze({
    schemaVersion: '1.0.0',
    scope: 'official-plus-local-separated',
    generatedAt: numeric(now),
    examDate: home?.meta?.examDate || null,
    currentPe,
    official,
    local: localState,
    recent: Object.freeze({
      days7: windowStats(attempts, now, 7),
      days30: windowStats(attempts, now, 30),
    }),
    trend: buildTrend(attempts),
    topicRisks: topicDiagnostics(attempts),
    alerts: Object.freeze((Array.isArray(home?.alerts) ? home.alerts : []).slice(0, 5).map(item => Object.freeze({...item}))),
    quality: dataQuality({home, audit, platform, local}),
  });
}

const fmtPct = value => `${round(value, 1).toFixed(1).replace('.', ',')}%`;
const fmtNum = value => new Intl.NumberFormat('pt-BR').format(numeric(value));
const fmtDuration = ms => {
  const totalMinutes = Math.round(numeric(ms) / 60_000);
  const hours = Math.floor(totalMinutes / 60), minutes = totalMinutes % 60;
  return hours ? `${hours}h ${minutes}min` : `${minutes}min`;
};

export function buildAiStudySummary(state) {
  if (!state || state.schemaVersion !== '1.0.0') throw new TypeError('Estado de estudo inválido para resumo de IA.');
  const topRisks = state.topicRisks.slice(0, 5);
  const lines = [
    'ESTADO DO ESTUDO — SEDES/DF TDAS CARGO 202',
    `Gerado em: ${new Date(state.generatedAt).toISOString()}`,
    'Regra de leitura: dados OFICIAIS e LOCAIS são camadas diferentes e não devem ser somados como se fossem a mesma origem.',
    '',
    'OFICIAL / NOTION PUBLICADO',
    `PE atual: ${state.official.currentPe || '—'} — ${state.official.currentTitle || 'sem título'} — ${state.official.currentStatus || 'sem status'}`,
    `Plano: ${fmtNum(state.official.completedPe)}/${fmtNum(state.official.totalPe)} PE concluídos (${fmtPct(state.official.completionPct)}); ${fmtNum(state.official.pendingPe)} pendentes.`,
    `Prova: ${state.examDate || '—'}; ${state.official.daysIncludingToday ?? '—'} dias corridos incluindo a data do snapshot; ${state.official.operationalDays || '—'} dias operacionais do plano.`,
    `Ritmo necessário: ${state.official.requiredPePerDay == null ? '—' : state.official.requiredPePerDay.toFixed(2).replace('.', ',')} PE/dia.`,
    `Questões com resultado: ${fmtNum(state.official.questions)}; acertos: ${fmtNum(state.official.correct)}; aproveitamento: ${fmtPct(state.official.accuracy)}; erros catalogados: ${fmtNum(state.official.errors)}.`,
    `Redações registradas: ${fmtNum(state.official.redactions)}.`,
    '',
    'LOCAL / ESTE DISPOSITIVO',
    `Tentativas: ${fmtNum(state.local.attempts)} (${fmtNum(state.local.studyAttempts)} estudo; ${fmtNum(state.local.reviewAttempts)} revisão).`,
    `Questões: ${fmtNum(state.local.questions)}; acertos: ${fmtNum(state.local.correct)}; aproveitamento: ${fmtPct(state.local.accuracy)}; tempo: ${fmtDuration(state.local.elapsedMs)}.`,
    `Revisões: ${fmtNum(state.local.reviews.due)} vencidas, ${fmtNum(state.local.reviews.criticalDue)} críticas, ${fmtNum(state.local.reviews.pending)} pendentes.`,
    `Caderno local: ${fmtNum(state.local.errors)} erros; ${fmtNum(state.local.marked)} marcações; ${fmtNum(state.local.aiPending)} itens pendentes de análise de IA/editorial.`,
    `Sessão ativa: ${state.local.draft.active ? `${state.local.draft.peId || 'PE não identificado'} — ${state.local.draft.answered}/${state.local.draft.total} respondidas` : 'não'}.`,
    '',
    'JANELA RECENTE',
    `Últimos 7 dias: ${fmtNum(state.recent.days7.questions)} questões, ${fmtPct(state.recent.days7.accuracy)}, ${fmtDuration(state.recent.days7.elapsedMs)}, ${fmtNum(state.recent.days7.activeDays)} dias ativos.`,
    `Últimos 30 dias: ${fmtNum(state.recent.days30.questions)} questões, ${fmtPct(state.recent.days30.accuracy)}, ${fmtDuration(state.recent.days30.elapsedMs)}, ${fmtNum(state.recent.days30.activeDays)} dias ativos.`,
    `Tendência de estudo (5 últimas vs. 5 anteriores): ${state.trend.delta == null ? 'sem base comparável' : `${state.trend.delta >= 0 ? '+' : ''}${state.trend.delta.toFixed(1).replace('.', ',')} p.p. (${state.trend.direction})`}.`,
    '',
    'RISCOS LOCAIS — fórmula transparente: erro×4 + dúvida/chute/marcação×2',
    ...(topRisks.length ? topRisks.map((item, index) => `${index + 1}. ${item.topic}: risco ${item.riskScore}; ${item.errors} erros; ${item.uncertain} incertezas; ${fmtPct(item.accuracy)} em ${item.total} questões.`) : ['Sem base local suficiente para ranquear riscos.']),
    '',
    'QUALIDADE / RASTREABILIDADE',
    `Última sincronização oficial: ${state.quality.syncAt || '—'}.`,
    `Versões: plataforma ${state.quality.platformVersion || '—'}; dados ${state.quality.dataVersion || '—'}.`,
    `Erros oficiais sem origem vinculada: ${fmtNum(state.quality.unlinkedOfficialErrors)}.`,
    'Use os números para diagnóstico e decisão; não inferir dados ausentes nem misturar a camada local com o registro oficial.',
  ];
  return lines.join('\n');
}
