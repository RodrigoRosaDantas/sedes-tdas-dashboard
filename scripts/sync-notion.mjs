import { SOURCES, hash, localDate, readJson, writeJson } from './notion/config.mjs';
import { fetchMarkdown, mapLimit, queryAll } from './notion/api.mjs';
import { control, error, redaction } from './notion/normalize.mjs';
import { build } from './notion/build.mjs';

const MINIMUM = { controls: 100, errors: 100, redactions: 25 };
const previousState = await readJson('data/notion/state.json', {});
const previousErrors = await readJson('data/notion/errors.json', { records: [] });
const previousHome = await readJson('data/home.json', {});
const previousRedactionsPublic = await readJson('data/redactions.json', {});
const oldMarkdown = new Map((previousErrors.records || []).map(item => [item.id, item.markdown || '']));

console.log('Consultando os três bancos oficiais do Notion...');
const [rawControls, rawErrors, rawRedactions] = await Promise.all([
  queryAll(SOURCES.control),
  queryAll(SOURCES.errors),
  queryAll(SOURCES.redactions)
]);

const controls = rawControls
  .map(control)
  .filter(item => /^PE\d{2,3}$/.test(item.pe))
  .sort((a, b) => a.pe.localeCompare(b.pe) || a.id.localeCompare(b.id));
const rdToPe = new Map(controls.filter(item => item.rd && item.pe).map(item => [item.rd, item.pe]));
const redactions = rawRedactions
  .map(redaction)
  .filter(item => /^RD\d{2,3}$/.test(item.rd))
  .map(item => ({ ...item, pe: rdToPe.get(item.rd) || '' }))
  .sort((a, b) => a.rd.localeCompare(b.rd) || a.id.localeCompare(b.id));

const changedErrors = rawErrors.filter(item => previousState.pageVersions?.[item.id] !== item.last_edited_time || !oldMarkdown.has(item.id));
console.log(`Erros: ${rawErrors.length}; conteúdo novo/alterado: ${changedErrors.length}.`);
const freshMarkdown = new Map(await mapLimit(changedErrors, 3, async item => [item.id, await fetchMarkdown(item.id)]));
const errors = rawErrors.map(item => error(item, freshMarkdown.get(item.id) ?? oldMarkdown.get(item.id) ?? '')).sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.id.localeCompare(b.id));

const fallbackPreviousCounts = {
  controls: Number(previousHome.metrics?.totalPE) || 0,
  errors: Number(previousHome.metrics?.errors) || 0,
  redactions: Number(previousRedactionsPublic.summary?.valid) || 0
};
const previousCounts = { ...fallbackPreviousCounts, ...(previousState.counts || {}) };
const currentCounts = { controls: controls.length, errors: errors.length, redactions: redactions.length };

for (const [name, count] of Object.entries(currentCounts)) {
  if (count < MINIMUM[name]) throw new Error(`${name}: consulta incompleta (${count}); mínimo de segurança: ${MINIMUM[name]}.`);
  const previous = Number(previousCounts[name]) || 0;
  if (previous && count < Math.floor(previous * 0.95) && process.env.ALLOW_LARGE_DROP !== 'true') {
    throw new Error(`${name}: queda anormal de ${previous} para ${count}. Publicação bloqueada para preservar o último snapshot válido.`);
  }
}

for (const [name, records] of Object.entries({ controls, errors, redactions })) {
  const ids = new Set(records.map(item => item.id));
  if (ids.size !== records.length) throw new Error(`${name}: IDs duplicados detectados.`);
  if (records.some(item => !item.id || !item.url)) throw new Error(`${name}: registro sem ID ou URL oficial.`);
}

for (const [name, records, key] of [['controls', controls, 'pe'], ['redactions', redactions, 'rd']]) {
  const codes = new Set();
  for (const item of records) {
    if (codes.has(item[key])) throw new Error(`${name}: código duplicado ${item[key]}.`);
    codes.add(item[key]);
  }
}

const semantic = {
  controls: controls.map(({ last_edited_time, ...item }) => item),
  errors: errors.map(({ last_edited_time, markdown, ...item }) => ({ ...item, markdownHash: hash(markdown || '') })),
  redactions: redactions.map(({ last_edited_time, ...item }) => item)
};
const nextHash = hash(semantic);
if (previousState.semanticHash === nextHash) {
  console.log('Nenhuma alteração semântica encontrada. Nenhum arquivo será alterado.');
  process.exit(0);
}

const syncedAt = new Date().toISOString();
const date = localDate(syncedAt);
const output = build(controls, errors, redactions, date, syncedAt);
output.state.semanticHash = nextHash;

await Promise.all([
  writeJson('data/notion/control.json', { source: SOURCES.control, records: controls }),
  writeJson('data/notion/errors.json', { source: SOURCES.errors, records: errors }),
  writeJson('data/notion/redactions.json', { source: SOURCES.redactions, records: redactions }),
  writeJson('data/notion/state.json', output.state),
  writeJson('data/home.json', output.home),
  writeJson('data/risks.json', output.risks),
  writeJson('data/subjects.json', output.subjects),
  writeJson('data/redactions.json', output.redactionsOut)
]);
console.log(`Sincronização preparada: ${controls.length} controles, ${errors.length} erros e ${redactions.length} redações.`);
