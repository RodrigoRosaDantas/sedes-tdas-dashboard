import fs from 'node:fs/promises';
import { DAILY_ROOTS, discoverDailyPages, peCode, renderMaterialMarkdown, resolveDailyQuestionSource } from './notion/daily-content.mjs';
import { fetchMarkdown } from './notion/api.mjs';
import { auditFailurePolicy, correctionPolicy } from './notion/daily-audit-policy.mjs';
import { isRest } from './notion/progress.mjs';

const CONTROL_FILES = Object.freeze([
  'data/export/actual-01.json',
  'data/export/actual-02.json',
  'data/export/actual-03.json',
  'data/export/future-01.json',
  'data/export/future-02.json'
]);
const FROM_PE = Number(process.env.AUDIT_FROM_PE || 79);
const TO_PE = Number(process.env.AUDIT_TO_PE || 112);
const TIME_ZONE = 'America/Sao_Paulo';
const ALLOWED_PUBLIC_FIELDS = Object.freeze(['alternativas', 'assunto', 'enunciado', 'id', 'numeroOriginal']);
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const required = (condition, message) => { if (!condition) throw new Error(message); };
const peId = number => `PE${String(number).padStart(2, '0')}`;
const todayLocal = () => {
  if (process.env.AUDIT_TODAY) return process.env.AUDIT_TODAY;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

async function loadControls() {
  const records = [];
  for (const file of CONTROL_FILES) {
    const content = JSON.parse(await fs.readFile(file, 'utf8'));
    required(Array.isArray(content), `${file}: conteúdo não é uma lista.`);
    records.push(...content);
  }
  const byPe = new Map();
  for (const record of records) {
    const pe = peCode(record?.pe);
    if (!pe) continue;
    if (byPe.has(pe)) {
      const previous = byPe.get(pe);
      required(
        previous.date === record.date && String(previous.planned_questions ?? previous.meta) === String(record.planned_questions ?? record.meta),
        `${pe}: registros divergentes entre os arquivos de execução.`
      );
      continue;
    }
    byPe.set(pe, record);
  }
  const selected = [];
  for (let number = FROM_PE; number <= TO_PE; number++) {
    const pe = peId(number);
    const record = byPe.get(pe);
    required(record, `${pe}: controle não localizado nos arquivos oficiais gerados do Notion.`);
    const declaredCount = Number(record.planned_questions ?? record.meta ?? 0);
    const expectedCount = isRest(record) ? 0 : declaredCount;
    required(Number.isInteger(expectedCount) && expectedCount >= 0, `${pe}: quantidade programada inválida.`);
    required(/^\d{4}-\d{2}-\d{2}$/.test(String(record.date || '')), `${pe}: data inválida.`);
    selected.push({
      pe,
      number,
      date: record.date,
      title: String(record.title || pe).trim(),
      expectedCount,
      status: String(record.status || ''),
      attempted: Number(record.attempted ?? 0),
      correct: Number(record.acertos ?? 0),
      errors: Number(record.errors ?? 0),
      accuracy: Number(record.accuracy ?? Number.NaN)
    });
  }
  const dates = selected.map(item => item.date);
  required(new Set(dates).size === dates.length, 'Ciclo restante: há datas duplicadas.');
  for (let index = 1; index < selected.length; index++) {
    const previous = new Date(`${selected[index - 1].date}T12:00:00Z`);
    const current = new Date(`${selected[index].date}T12:00:00Z`);
    required((current - previous) / 86400000 === 1, `${selected[index].pe}: a sequência diária possui lacuna após ${selected[index - 1].pe}.`);
  }
  return selected;
}

function validatePublicCatalog(catalog, pe, expectedCount) {
  required(catalog.peId === pe, `${pe}: catálogo associado a outro Dia ID.`);
  required(catalog.questionCount === expectedCount, `${pe}: catálogo gerou ${catalog.questionCount}; esperado ${expectedCount}.`);
  required(Array.isArray(catalog.questions) && catalog.questions.length === expectedCount, `${pe}: lista pública de questões incompatível.`);
  const serialized = JSON.stringify(catalog);
  required(!/"(?:gabarito|answers|comentarios|comentários|fundamentos|respostas)"\s*:/i.test(serialized), `${pe}: catálogo público contém campo reservado de correção.`);
  for (const question of catalog.questions) {
    const fields = Object.keys(question).sort();
    required(fields.join('|') === ALLOWED_PUBLIC_FIELDS.join('|'), `${pe}: campos públicos inesperados em ${question.id}.`);
    const optionKeys = Object.keys(question.alternativas || {});
    required(optionKeys.length >= 2 && optionKeys.length <= 5, `${pe}: quantidade de alternativas inválida em ${question.id}.`);
    required(optionKeys.join('') === 'ABCDE'.slice(0, optionKeys.length), `${pe}: alternativas descontínuas em ${question.id}.`);
  }
}

const controls = await loadControls();
required(controls.length === TO_PE - FROM_PE + 1, 'Ciclo restante: cobertura incompleta.');
const auditToday = todayLocal();

console.log(`Auditando ${controls.length} dias, de ${controls[0].pe} a ${controls.at(-1).pe}, diretamente nas duas árvores oficiais do Notion...`);
const [materials, questions] = await Promise.all([
  discoverDailyPages(DAILY_ROOTS.materials),
  discoverDailyPages(DAILY_ROOTS.questions)
]);

const ready = [];
const pending = [];
const failures = [];
for (const control of controls) {
  let materialHtmlLength = 0;
  try {
    const materialPage = materials.get(control.pe);
    const questionPage = questions.get(control.pe);
    required(materialPage && questionPage, `${control.pe}: vínculo entre material e questões ausente.`);
    required(peCode(materialPage.title) === control.pe, `${control.pe}: título da página de material incompatível.`);
    required(peCode(questionPage.title) === control.pe, `${control.pe}: título da página de questões incompatível.`);

    const [materialResult, questionResult] = await Promise.allSettled([
      fetchMarkdown(materialPage.id),
      resolveDailyQuestionSource({
        questionPage,
        pe: control.pe,
        title: control.title,
        expectedCount: control.expectedCount
      })
    ]);
    await pause(350);

    if (materialResult.status === 'rejected') throw materialResult.reason;
    const materialMarkdown = materialResult.value;
    required(materialMarkdown.trim().length >= 200, `${control.pe}: material vazio ou ainda incompleto.`);
    const html = renderMaterialMarkdown(materialMarkdown);
    required(html.length >= 200, `${control.pe}: material não produziu HTML suficiente.`);
    materialHtmlLength = html.length;
    if (questionResult.status === 'rejected') throw questionResult.reason;
    const resolvedQuestions = questionResult.value;
    required(resolvedQuestions.markdown.trim().length >= 100 || resolvedQuestions.effectiveExpectedCount === 0, `${control.pe}: página de questões vazia ou ainda incompleta.`);

    const effectiveExpectedCount = resolvedQuestions.effectiveExpectedCount;
    const parsed = resolvedQuestions.parsed;
    let correctionMode = 'not-applicable';

    validatePublicCatalog(parsed.catalog, control.pe, effectiveExpectedCount);
    if (effectiveExpectedCount === 0) {
      required(parsed.key === null && parsed.catalog.keyPath === null, `${control.pe}: dia sem questões gerou correção indevida.`);
    } else {
      const answerCount = parsed.key?.answers?.length ?? 0;
      const policy = correctionPolicy({
        control: { ...control, expectedCount: effectiveExpectedCount },
        answerCount,
        today: auditToday
      });
      required(policy.accepted, `${control.pe}: gabarito possui ${answerCount} respostas para ${effectiveExpectedCount} questões.`);
      correctionMode = policy.mode;
      required(parsed.key.material_id === parsed.catalog.catalogId, `${control.pe}: correção separada não corresponde ao catálogo.`);
    }
    ready.push({pe: control.pe, date: control.date, questions: effectiveExpectedCount, materialHtml: html.length, correctionMode});
    const correctionLabel = correctionMode === 'answer-key' ? 'separada' : 'não aplicável';
    console.log(`${control.pe}: pronto — material ${html.length} caracteres; ${effectiveExpectedCount} questões de treino; correção ${correctionLabel}; fonte ${resolvedQuestions.resolution}.`);
  } catch (error) {
    const exactMissingKey = control.expectedCount > 0
      && error.message === `${control.pe}: gabarito possui 0 respostas para ${control.expectedCount} questões.`;
    const historicalPolicy = correctionPolicy({
      control: { ...control, expectedCount: control.expectedCount },
      answerCount: 0,
      today: auditToday
    });
    if (exactMissingKey && historicalPolicy.mode === 'historical-execution') {
      const correctionMode = 'historical-execution';
      console.warn(`${control.pe}: estrutura integral das ${control.expectedCount} questões validada; chave não preservada após execução e histórico confirmado pelo controle oficial (${control.correct} acertos + ${control.errors} erros; tentadas=${control.attempted}; status ${control.status}).`);
      ready.push({pe: control.pe, date: control.date, questions: control.expectedCount, materialHtml: materialHtmlLength, correctionMode});
      console.log(`${control.pe}: pronto — material ${materialHtmlLength} caracteres; ${control.expectedCount} questões de treino; correção histórica validada pelo controle.`);
      continue;
    }
    const failurePolicy = auditFailurePolicy({control, error, today: auditToday});
    if (!failurePolicy.blocking) {
      pending.push({pe: control.pe, date: control.date, reason: failurePolicy.reason});
      console.warn(`${control.pe}: pendente — conteúdo adaptativo futuro ainda não integralizado; ${failurePolicy.reason}`);
      continue;
    }
    failures.push({pe: control.pe, date: control.date, reason: error.message});
    console.error(`${control.pe}: bloqueado — ${error.message}`);
  }
}

const summary = {
  status: failures.length ? 'blocked' : pending.length ? 'ready-with-future-pending' : 'ready',
  from: controls[0].pe,
  to: controls.at(-1).pe,
  firstDate: controls[0].date,
  lastDate: controls.at(-1).date,
  audited: controls.length,
  ready: ready.length,
  pending: pending.length,
  blocked: failures.length,
  totalQuestions: ready.reduce((total, item) => total + item.questions, 0),
  historicalCorrections: ready.filter(item => item.correctionMode === 'historical-execution').map(item => item.pe),
  pendingItems: pending,
  failures
};
console.log(JSON.stringify(summary));
if (failures.length) process.exitCode = 1;
