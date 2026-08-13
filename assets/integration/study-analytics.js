const DAY_MS = 86_400_000;
const UNCERTAIN_CLASSIFICATIONS = new Set(['correct_with_doubt', 'correct_by_guess', 'marked']);
const CRITICAL_REVIEW_OUTCOMES = new Set(['wrong_again', 'incorrect_confirmed']);

const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const nullablePct = (part, total) => total > 0 ? part / total * 100 : null;
const normalizeTopic = value => String(value || 'Sem assunto').trim() || 'Sem assunto';
const normalizeKey = value => normalizeTopic(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

function saoPauloDateKey(timestamp) {
  const date = new Date(Number(timestamp));
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function dateKeyTimestamp(key) {
  return Date.parse(`${key}T00:00:00-03:00`);
}

function shiftDateKey(key, days) {
  const timestamp = Date.parse(`${key}T12:00:00-03:00`) + days * DAY_MS;
  return saoPauloDateKey(timestamp);
}

function attemptTimestamp(attempt) {
  return finite(attempt?.finishedAt || attempt?.startedAt);
}

function questionSignals(attempts) {
  const output = {questionResults: 0, questionResultsCorrect: 0, errors: 0, uncertain: 0, secureCorrect: 0, classified: 0};
  for (const attempt of attempts) {
    for (const item of attempt?.questionResults || []) {
      output.questionResults += 1;
      if (item?.correct === true) output.questionResultsCorrect += 1;
      const classification = String(item?.classification || '');
      const confidence = String(item?.confidence || '');
      if (classification) output.classified += 1;
      if (classification === 'incorrect_confirmed' || (!classification && item?.correct === false)) output.errors += 1;
      if (UNCERTAIN_CLASSIFICATIONS.has(classification) || ['doubt', 'guess'].includes(confidence)) output.uncertain += 1;
      if (classification === 'correct_secure' || (!classification && item?.correct === true && !['doubt', 'guess'].includes(confidence))) output.secureCorrect += 1;
    }
  }
  return {...output,
    errorRate: nullablePct(output.errors, output.questionResults),
    uncertaintyRate: nullablePct(output.uncertain, output.questionResults),
    secureCorrectRate: nullablePct(output.secureCorrect, output.questionResults),
  };
}

function summarizeAttempts(attempts) {
  const questions = attempts.reduce((sum, item) => sum + finite(item?.total), 0);
  const correct = attempts.reduce((sum, item) => sum + finite(item?.correct), 0);
  const elapsedMs = attempts.reduce((sum, item) => sum + Math.max(0, finite(item?.elapsedMs)), 0);
  const activeDays = new Set(attempts.map(item => saoPauloDateKey(attemptTimestamp(item))).filter(Boolean)).size;
  const signals = questionSignals(attempts);
  return {
    attempts: attempts.length,
    questions,
    correct,
    incorrect: Math.max(0, questions - correct),
    accuracy: nullablePct(correct, questions),
    elapsedMs,
    averageMsPerQuestion: questions > 0 ? elapsedMs / questions : null,
    questionsPerHour: elapsedMs > 0 ? questions / (elapsedMs / 3_600_000) : null,
    activeDays,
    questionsPerActiveDay: activeDays > 0 ? questions / activeDays : null,
    ...signals,
  };
}

function attemptsBetween(attempts, start, end) {
  return attempts.filter(item => {
    const timestamp = attemptTimestamp(item);
    return timestamp >= start && timestamp < end;
  });
}

function buildActivity(attempts) {
  const days = new Map();
  for (const attempt of attempts) {
    const key = saoPauloDateKey(attemptTimestamp(attempt));
    if (!key) continue;
    const current = days.get(key) || {date: key, attempts: 0, questions: 0, correct: 0, elapsedMs: 0};
    current.attempts += 1;
    current.questions += finite(attempt.total);
    current.correct += finite(attempt.correct);
    current.elapsedMs += Math.max(0, finite(attempt.elapsedMs));
    days.set(key, current);
  }
  return [...days.values()]
    .map(item => ({...item, accuracy: nullablePct(item.correct, item.questions)}))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function buildStreak(activity, now) {
  if (!activity.length) return {current: 0, longest: 0, latestActiveDate: null};
  const keys = activity.map(item => item.date).sort();
  let longest = 1;
  let running = 1;
  for (let index = 1; index < keys.length; index += 1) {
    running = keys[index] === shiftDateKey(keys[index - 1], 1) ? running + 1 : 1;
    longest = Math.max(longest, running);
  }
  const latest = keys.at(-1);
  const today = saoPauloDateKey(now);
  const yesterday = shiftDateKey(today, -1);
  if (![today, yesterday].includes(latest)) return {current: 0, longest, latestActiveDate: latest};
  let current = 1;
  for (let index = keys.length - 1; index > 0; index -= 1) {
    if (keys[index - 1] !== shiftDateKey(keys[index], -1)) break;
    current += 1;
  }
  return {current, longest, latestActiveDate: latest};
}

function buildTopicDiagnostics(attempts) {
  const groups = new Map();
  for (const attempt of attempts) {
    for (const item of attempt?.questionResults || []) {
      const topic = normalizeTopic(item?.subassunto || item?.assunto);
      const key = normalizeKey(topic);
      const current = groups.get(key) || {topic, total: 0, correct: 0, errors: 0, uncertain: 0, pes: new Set(), attempts: new Set()};
      current.total += 1;
      if (item?.correct === true) current.correct += 1;
      const classification = String(item?.classification || '');
      const confidence = String(item?.confidence || '');
      if (classification === 'incorrect_confirmed' || (!classification && item?.correct === false)) current.errors += 1;
      if (UNCERTAIN_CLASSIFICATIONS.has(classification) || ['doubt', 'guess'].includes(confidence)) current.uncertain += 1;
      if (attempt?.peId) current.pes.add(String(attempt.peId));
      if (attempt?.id) current.attempts.add(String(attempt.id));
      groups.set(key, current);
    }
  }
  return [...groups.values()]
    .map(item => ({
      topic: item.topic,
      total: item.total,
      correct: item.correct,
      errors: item.errors,
      uncertain: item.uncertain,
      peCount: item.pes.size,
      attemptCount: item.attempts.size,
      accuracy: nullablePct(item.correct, item.total),
      riskScore: item.errors * 4 + item.uncertain * 2,
    }))
    .sort((a, b) => b.riskScore - a.riskScore || b.errors - a.errors || (a.accuracy ?? 0) - (b.accuracy ?? 0) || a.topic.localeCompare(b.topic, 'pt-BR'));
}

function buildReviewSummary(attempts, reviews, now) {
  const reviewAttempts = attempts.filter(item => item?.mode === 'review');
  const outcomes = {mastered: 0, unsure: 0, wrongAgain: 0, other: 0};
  for (const attempt of reviewAttempts) {
    const outcome = String(attempt?.reviewOutcome || '');
    if (outcome === 'mastered') outcomes.mastered += 1;
    else if (outcome === 'unsure') outcomes.unsure += 1;
    else if (outcome === 'wrong_again') outcomes.wrongAgain += 1;
    else outcomes.other += 1;
  }
  const completed = outcomes.mastered + outcomes.unsure + outcomes.wrongAgain;
  const due = reviews.filter(item => item?.status === 'pending' && finite(item?.dueAt) <= now);
  const criticalDue = due.filter(item => CRITICAL_REVIEW_OUTCOMES.has(String(item?.sourceOutcome || item?.outcome || item?.classification || '')));
  return {
    attempts: reviewAttempts.length,
    completed,
    ...outcomes,
    masteredRate: nullablePct(outcomes.mastered, completed),
    wrongAgainRate: nullablePct(outcomes.wrongAgain, completed),
    due: due.length,
    criticalDue: criticalDue.length,
  };
}

export function buildStudyAnalytics({attempts = [], reviews = [], now = Date.now()} = {}) {
  const safeAttempts = Array.isArray(attempts) ? attempts.filter(Boolean).sort((a, b) => attemptTimestamp(a) - attemptTimestamp(b)) : [];
  const safeReviews = Array.isArray(reviews) ? reviews.filter(Boolean) : [];
  const nowTs = finite(now) || Date.now();
  const todayKey = saoPauloDateKey(nowTs);
  const todayStart = dateKeyTimestamp(todayKey);
  const tomorrowStart = dateKeyTimestamp(shiftDateKey(todayKey, 1));
  const current7Start = dateKeyTimestamp(shiftDateKey(todayKey, -6));
  const previous7Start = dateKeyTimestamp(shiftDateKey(todayKey, -13));
  const current30Start = dateKeyTimestamp(shiftDateKey(todayKey, -29));

  const total = summarizeAttempts(safeAttempts);
  const today = summarizeAttempts(attemptsBetween(safeAttempts, todayStart, tomorrowStart));
  const last7 = summarizeAttempts(attemptsBetween(safeAttempts, current7Start, tomorrowStart));
  const previous7 = summarizeAttempts(attemptsBetween(safeAttempts, previous7Start, current7Start));
  const last30 = summarizeAttempts(attemptsBetween(safeAttempts, current30Start, tomorrowStart));
  const study = summarizeAttempts(safeAttempts.filter(item => item?.mode === 'study'));
  const reviewMode = summarizeAttempts(safeAttempts.filter(item => item?.mode === 'review'));
  const activity = buildActivity(safeAttempts);
  const streak = buildStreak(activity, nowTs);
  const topics = buildTopicDiagnostics(safeAttempts);
  const review = buildReviewSummary(safeAttempts, safeReviews, nowTs);
  const accuracyDelta7 = last7.accuracy != null && previous7.accuracy != null ? last7.accuracy - previous7.accuracy : null;
  const questionsDelta7 = last7.questions - previous7.questions;

  let recommendation = {kind: 'continue', title: 'Manter o ciclo', detail: 'Continue registrando sessões reais para fortalecer a leitura estatística.'};
  if (review.criticalDue > 0) {
    recommendation = {kind: 'review', title: 'Fechar revisões críticas', detail: `${review.criticalDue} revisão${review.criticalDue === 1 ? '' : 'ões'} vencida${review.criticalDue === 1 ? '' : 's'} ligada${review.criticalDue === 1 ? '' : 's'} a erro ou reincidência.`};
  } else if (topics[0]?.riskScore > 0) {
    recommendation = {kind: 'topic', title: `Atacar ${topics[0].topic}`, detail: `Maior risco local: ${topics[0].riskScore} = ${topics[0].errors}×4 + ${topics[0].uncertain}×2.`};
  }

  return {
    generatedAt: nowTs,
    todayKey,
    total,
    today,
    last7,
    previous7,
    last30,
    study,
    reviewMode,
    activity,
    streak,
    topics,
    review,
    trend: {accuracyDelta7, questionsDelta7},
    recommendation,
  };
}

export {saoPauloDateKey};
