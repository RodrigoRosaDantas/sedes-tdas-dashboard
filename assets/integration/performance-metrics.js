const CONFIDENCE_KEYS = Object.freeze(['secure', 'doubt', 'guess']);
const CLASSIFICATION_KEYS = Object.freeze(['incorrect_confirmed','correct_secure','correct_with_doubt','correct_by_guess','marked','annulment_pending','source_error']);

const round = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const ratio = (numerator, denominator) => denominator ? numerator / denominator * 100 : 0;

function validateAttempts(attempts) {
  if (!Array.isArray(attempts)) throw new TypeError('Tentativas inválidas para desempenho.');
  for (const attempt of attempts) {
    if (!attempt || !['pilot','review'].includes(attempt.mode) || !Array.isArray(attempt.questionResults)) {
      throw new TypeError('Tentativa incompatível com o painel.');
    }
  }
}

function aggregateQuestions(attempts) {
  return attempts.flatMap(attempt => attempt.questionResults.map(question => ({...question, attemptId: attempt.id, mode: attempt.mode, finishedAt: attempt.finishedAt})));
}

export function buildPerformanceSnapshot(attempts, reviews = [], peProgress = null, now = Date.now()) {
  validateAttempts(attempts);
  if (!Array.isArray(reviews)) throw new TypeError('Agenda de revisões inválida.');
  const ordered = [...attempts].sort((a, b) => a.finishedAt - b.finishedAt);
  const questions = aggregateQuestions(ordered);
  const correct = questions.filter(question => question.correct).length;
  const classifications = Object.fromEntries(CLASSIFICATION_KEYS.map(key => [key, 0]));
  const confidence = Object.fromEntries(CONFIDENCE_KEYS.map(key => [key, {questions: 0, correct: 0, accuracy: 0}]));
  const subjects = new Map();

  for (const question of questions) {
    if (Object.hasOwn(classifications, question.classification)) classifications[question.classification] += 1;
    if (Object.hasOwn(confidence, question.confidence)) {
      confidence[question.confidence].questions += 1;
      if (question.correct) confidence[question.confidence].correct += 1;
    }
    const key = question.assunto || 'Sem assunto';
    const current = subjects.get(key) || {subject: key, questions: 0, correct: 0, incorrect: 0, accuracy: 0};
    current.questions += 1;
    if (question.correct) current.correct += 1;
    else current.incorrect += 1;
    subjects.set(key, current);
  }
  for (const item of Object.values(confidence)) item.accuracy = round(ratio(item.correct, item.questions));
  for (const item of subjects.values()) item.accuracy = round(ratio(item.correct, item.questions));

  const pilotAttempts = ordered.filter(attempt => attempt.mode === 'pilot');
  const reviewAttempts = ordered.filter(attempt => attempt.mode === 'review');
  const elapsedMs = ordered.reduce((sum, attempt) => sum + attempt.elapsedMs, 0);
  const dueReviews = reviews.filter(review => review.status === 'pending' && review.dueAt <= Number(now)).length;
  const pendingReviews = reviews.filter(review => review.status === 'pending').length;
  const completedReviews = reviews.filter(review => review.status === 'completed').length;
  const trend = ordered.slice(-20).map(attempt => Object.freeze({
    id: attempt.id,
    mode: attempt.mode,
    finishedAt: attempt.finishedAt,
    percent: round(attempt.percent),
    correct: attempt.correct,
    total: attempt.total,
    elapsedMs: attempt.elapsedMs,
  }));

  return Object.freeze({
    schemaVersion: '1.0.0',
    scope: 'pilot-local',
    attempts: ordered.length,
    pilotAttempts: pilotAttempts.length,
    reviewAttempts: reviewAttempts.length,
    questions: questions.length,
    correct,
    incorrect: questions.length - correct,
    accuracy: round(ratio(correct, questions.length)),
    elapsedMs,
    averageQuestionMs: questions.length ? Math.round(elapsedMs / questions.length) : 0,
    bestPilotPercent: pilotAttempts.length ? Math.max(...pilotAttempts.map(attempt => attempt.percent)) : null,
    latestPercent: ordered.length ? ordered.at(-1).percent : null,
    classifications: Object.freeze(classifications),
    confidence: Object.freeze(confidence),
    subjects: Object.freeze([...subjects.values()].sort((a, b) => a.accuracy - b.accuracy || b.questions - a.questions || a.subject.localeCompare(b.subject))),
    reviews: Object.freeze({due: dueReviews, pending: pendingReviews, completed: completedReviews}),
    peProgress: peProgress ? Object.freeze({...peProgress}) : null,
    trend: Object.freeze(trend),
  });
}
