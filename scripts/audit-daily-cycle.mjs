import fs from 'node:fs/promises';
import { DAILY_ROOTS, discoverDailyPages, parseDailyQuestions, peCode, renderMaterialMarkdown } from './notion/daily-content.mjs';
import { fetchMarkdown } from './notion/api.mjs';

const CONTROL_FILES = Object.freeze([
  'data/export/actual-01.json',
  'data/export/actual-02.json',
  'data/export/actual-03.json',
  'data/export/future-01.json',
  'data/export/future-02.json'
]);
const FROM_PE = Number(process.env.AUDIT_FROM_PE || 79);
const TO_PE = Number(process.env.AUDIT_TO_PE || 112);
const ALLOWED_PUBLIC_FIELDS = Object.freeze(['alternativas', 'assunto', 'enunciado', 'id', 'numeroOriginal']);
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const required = (condition, message) => { if (!condition) throw new Error(message); };
const peId = number => `PE${String(number).padStart(2, '0')}`;

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
        previous.date === record.date && String(previous.planned_questions) === String(record.planned_questions),
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
    const expectedCount = Number(record.planned_questions ?? record.meta ?? 0);
    required(Number.isInteger(expectedCount) && expectedCount >= 0, `${pe}: quantidade programada inválida.`);
    required(/^\d{4}-\d{2}-\d{2}$/.test(String(record.date || '')), `${pe}: data inválida.`);
    selected.push({
      pe,
      number,
      date: record.date,
      title: String(record.title || pe).trim(),
      expectedCount
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
    required(Object.keys(question.alternativas || {}).join('') === 'ABCDE', `${pe}: alternativas incompletas em ${question.id}.`);
  }
}

const controls = await loadControls();
required(controls.length === TO_PE - FROM_PE + 1, 'Ciclo restante: cobertura incompleta.');

console.log(`Auditando ${controls.length} dias, de ${controls[0].pe} a ${controls.at(-1).pe}, diretamente nas duas árvores oficiais do Notion...`);
const [materials, questions] = await Promise.all([
  discoverDailyPages(DAILY_ROOTS.materials),
  discoverDailyPages(DAILY_ROOTS.questions)
]);

const ready = [];
const failures = [];
for (const control of controls) {
  try {
    const materialPage = materials.get(control.pe);
    const questionPage = questions.get(control.pe);
    required(materialPage && questionPage, `${control.pe}: vínculo entre material e questões ausente.`);
    required(peCode(materialPage.title) === control.pe, `${control.pe}: título da página de material incompatível.`);
    required(peCode(questionPage.title) === control.pe, `${control.pe}: título da página de questões incompatível.`);

    const materialMarkdown = await fetchMarkdown(materialPage.id);
    await pause(350);
    const questionMarkdown = await fetchMarkdown(questionPage.id);
    await pause(350);

    required(materialMarkdown.trim().length >= 200, `${control.pe}: material vazio ou ainda incompleto.`);
    required(questionMarkdown.trim().length >= 100 || control.expectedCount === 0, `${control.pe}: página de questões vazia ou ainda incompleta.`);
    const html = renderMaterialMarkdown(materialMarkdown);
    required(html.length >= 200, `${control.pe}: material não produziu HTML suficiente.`);

    const parsed = parseDailyQuestions(questionMarkdown, {
      pe: control.pe,
      title: control.title,
      expectedCount: control.expectedCount,
      sourcePageId: questionPage.id
    });
    validatePublicCatalog(parsed.catalog, control.pe, control.expectedCount);
    if (control.expectedCount === 0) {
      required(parsed.key === null && parsed.catalog.keyPath === null, `${control.pe}: dia sem questões gerou correção indevida.`);
    } else {
      required(parsed.key?.answers?.length === control.expectedCount, `${control.pe}: correção separada incompleta.`);
      required(parsed.key.material_id === parsed.catalog.catalogId, `${control.pe}: correção separada não corresponde ao catálogo.`);
    }
    ready.push({pe: control.pe, date: control.date, questions: control.expectedCount, materialHtml: html.length});
    console.log(`${control.pe}: pronto — material ${html.length} caracteres; ${control.expectedCount} questões; correção separada.`);
  } catch (error) {
    failures.push({pe: control.pe, date: control.date, reason: error.message});
    console.error(`${control.pe}: bloqueado — ${error.message}`);
  }
}

const summary = {
  status: failures.length ? 'blocked' : 'ready',
  from: controls[0].pe,
  to: controls.at(-1).pe,
  firstDate: controls[0].date,
  lastDate: controls.at(-1).date,
  audited: controls.length,
  ready: ready.length,
  blocked: failures.length,
  totalQuestions: ready.reduce((total, item) => total + item.questions, 0),
  failures
};
console.log(JSON.stringify(summary));
if (failures.length) process.exitCode = 1;
