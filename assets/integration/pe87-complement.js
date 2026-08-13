export const PE87_COMPLEMENT = Object.freeze({
  peId: 'PE87',
  historicalAnswered: 30,
  startQuestion: 31,
  endQuestion: 48,
  total: 18,
  catalogSuffix: ':complement:q31-q48',
});

const questionNumber = question => Number(question?.numeroOriginal ?? question?.numero_original ?? 0);

export function complementCatalogId(catalogId) {
  return `${String(catalogId || '')}${PE87_COMPLEMENT.catalogSuffix}`;
}

export function buildPe87ComplementCatalog(catalog) {
  if (!catalog || String(catalog.peId || '').toUpperCase() !== PE87_COMPLEMENT.peId) return null;
  const questions = (catalog.questions || []).filter(question => {
    const number = questionNumber(question);
    return number >= PE87_COMPLEMENT.startQuestion && number <= PE87_COMPLEMENT.endQuestion;
  }).map(question => ({
    ...question,
    numero_original: question.numero_original ?? question.numeroOriginal ?? null,
  }));
  const expected = Array.from({length: PE87_COMPLEMENT.total}, (_, index) => PE87_COMPLEMENT.startQuestion + index);
  const actual = questions.map(questionNumber).sort((a, b) => a - b);
  if (questions.length !== PE87_COMPLEMENT.total || !expected.every((number, index) => number === actual[index])) return null;
  return Object.freeze({
    ...catalog,
    catalogId: complementCatalogId(catalog.catalogId),
    title: 'PE87 — Complemento Q31–Q48',
    description: 'Sessão complementar isolada. Preserva integralmente o histórico Q1–Q30 e registra somente Q31–Q48 neste dispositivo.',
    questionCount: questions.length,
    questions: Object.freeze(questions),
    complement: PE87_COMPLEMENT,
  });
}

export function isPe87ComplementRequired(today) {
  const pe = String(today?.pe || '').toUpperCase();
  const status = String(today?.status || '');
  return pe === PE87_COMPLEMENT.peId
    && /conclu|finaliz|feito|realiz/i.test(status)
    && Number(today?.meta) === PE87_COMPLEMENT.endQuestion
    && Number(today?.attempted) === PE87_COMPLEMENT.historicalAnswered;
}

export function findCompletedPe87Complement(attempts, catalogId) {
  const target = complementCatalogId(catalogId);
  return (attempts || []).find(attempt => attempt.mode === 'complement' && attempt.catalogId === target && Number(attempt.total) === PE87_COMPLEMENT.total) || null;
}

export function isPe87ComplementDraft(draft, catalogId = null) {
  if (!draft || !String(draft.catalogId || '').endsWith(PE87_COMPLEMENT.catalogSuffix)) return false;
  return catalogId == null || draft.catalogId === complementCatalogId(catalogId);
}
