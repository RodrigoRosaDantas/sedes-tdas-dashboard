import fs from 'node:fs/promises';
import path from 'node:path';
import { SOURCES, ROOT, hash, localDate, localIso, readJson, writeJson, writeText } from './notion/config.mjs';
import { fetchMarkdown, fetchPropertyText, mapLimit, queryAll } from './notion/api.mjs';
import { DAILY_ROOTS, prepareDailyContent } from './notion/daily-content.mjs';
import { isDailyContentPermissionError, pendingDailySemantic } from './notion/daily-access.mjs';
import { control, error, propId, redaction } from './notion/normalize.mjs';
import { build } from './notion/build.mjs';
import { shouldRebuild } from './notion/sync-decision.mjs';

const MINIMUM = { controls: 100, errors: 100, redactions: 25 };
const SCHEMA_VERSION = '20.4';
const previousState = await readJson('data/notion/state.json', {});
const previousHistory = await readJson('data/sync-history.json', { entries: [] });
const runStartedAt = new Date().toISOString();
const snapshotDate = localDate(runStartedAt);
const kind = process.env.SYNC_KIND === 'schedule' ? 'Sincronização agendada' : process.env.SYNC_KIND === 'workflow_dispatch' ? 'Sincronização manual' : 'Sincronização de preparação';

function uniqueBy(records, key, label) {
  const seen = new Map();
  for (const record of records) {
    const value = record[key];
    if (!value) throw new Error(`${label}: registro sem ${key}.`);
    if (seen.has(value)) throw new Error(`${label}: ${key} duplicado (${value}).`);
    seen.set(value, record);
  }
}

function validateSourceCounts(raw, filtered, name, previousCount) {
  if (filtered.length < MINIMUM[name]) throw new Error(`${name}: apenas ${filtered.length} registros válidos; mínimo de segurança ${MINIMUM[name]}.`);
  if (previousCount && filtered.length < Math.floor(previousCount * 0.95) && process.env.ALLOW_LARGE_DROP !== 'true') {
    throw new Error(`${name}: queda anormal de ${previousCount} para ${filtered.length}; publicação bloqueada.`);
  }
  if (filtered.length > raw.length) throw new Error(`${name}: total filtrado maior que total consultado.`);
}

async function completeError(record) {
  const summaryPropertyId = propId(record, ['Resumo']);
  let completeSummary = '';
  if (summaryPropertyId) {
    try { completeSummary = await fetchPropertyText(record.id, summaryPropertyId); }
    catch (failure) { console.warn(`${record.url}: falha ao paginar Resumo: ${failure.message}`); }
  }
  let markdown = '';
  if (!completeSummary.trim()) markdown = await fetchMarkdown(record.id);
  return error(record, completeSummary.trim(), markdown.trim());
}

function semanticRecord(record, type) {
  if (type === 'control' || type === 'redaction') {
    const { id, last_edited_time, ...publicRecord } = record;
    return publicRecord;
  }
  const { id, last_edited_time, markdown, ...publicRecord } = record;
  return publicRecord;
}

async function clearOldErrorParts() {
  const directory = path.join(ROOT, 'data/error-questions');
  await fs.mkdir(directory, { recursive: true });
  for (const file of await fs.readdir(directory)) if (/^part-\d+\.json$/.test(file)) await fs.rm(path.join(directory, file));
}

async function clearDailyKeys() {
  const directory = path.join(ROOT, 'data/integration/question-keys');
  await fs.mkdir(directory, { recursive: true });
  for (const file of await fs.readdir(directory)) if (/^[a-z0-9._-]+\.json$/i.test(file)) await fs.rm(path.join(directory, file));
}

async function removeLegacyTechnicalData() {
  for (const file of ['data/notion/control.json', 'data/notion/errors.json', 'data/notion/redactions.json']) {
    try { await fs.rm(path.join(ROOT, file)); } catch {}
  }
}

async function ensureRoutes(routes) {
  const peTemplate = await fs.readFile(path.join(ROOT, 'pe/1/index.html'), 'utf8');
  const subjectTemplate = await fs.readFile(path.join(ROOT, 'materias/portugues/index.html'), 'utf8');
  for (const number of routes.peNumbers) await writeText(`pe/${number}/index.html`, peTemplate);
  for (const slug of routes.subjectSlugs.filter(Boolean)) await writeText(`materias/${slug}/index.html`, subjectTemplate);
}

async function generateServiceWorker(routes, errorIndex) {
  const base = '/sedes-tdas-dashboard/';
  const core = [
    '', 'hoje/', 'evolucao/', 'riscos/', 'agenda/', 'redacoes/', 'auditoria/', 'mais/', 'questoes-erros/', 'pe/', 'materias/', 'offline.html',
    'manifest.webmanifest', 'assets/styles.css', 'assets/v20.css', 'assets/common.js', 'assets/home.js', 'assets/today.js', 'assets/evolution.js',
    'assets/site-parity-v11.css', 'assets/site-parity-v11-fixes.css', 'assets/site-shell-boot.css', 'assets/integration/site-parity-v11.js',
    'assets/risks.js', 'assets/agenda.js', 'assets/redactions.js', 'assets/audit.js', 'assets/more.js', 'assets/pe.js', 'assets/subject.js',
    'assets/subjects-index.js', 'assets/error-questions.js', 'assets/enhance-v20.js', 'data/home.json', 'data/today.json', 'data/evolution.json',
    'data/risks.json', 'data/agenda.json', 'data/redactions.json', 'data/audit.json', 'data/more.json', 'data/subjects.json',
    'data/sync-history.json', 'data/live.json', 'data/error-questions/index.json', 'icons/icon.svg', 'icons/maskable.svg', 'icons/icon-192.png', 'icons/icon-512.png'
  ];
  const dynamic = [
    ...routes.peNumbers.map(number => `pe/${number}/`),
    ...routes.subjectSlugs.filter(Boolean).map(slug => `materias/${slug}/`),
    ...errorIndex.parts.map(part => `data/error-questions/${part.file}`)
  ];
  const precache = [...new Set([...core, ...dynamic])].map(item => `${base}${item}`);
  const source = `const VERSION='tdas-v20-${snapshotDate.replaceAll('-', '')}-${hash(precache).slice(0, 8)}';\nconst BASE='${base}';\nconst PRECACHE=${JSON.stringify(precache)};\nself.addEventListener('install',event=>event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(PRECACHE)).then(()=>self.skipWaiting())));\nself.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==VERSION).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));\nself.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const url=new URL(event.request.url);if(url.origin!==location.origin)return;if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(VERSION).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match(event.request).then(cached=>cached||caches.match(BASE+'offline.html'))));return}if(url.pathname.includes('/data/')){event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(VERSION).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match(event.request)));return}event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{const copy=response.clone();caches.open(VERSION).then(cache=>cache.put(event.request,copy));return response}))) });\n`;
  await writeText('sw.js', source);
}

function appendHistory(status, summary, detail) {
  return {
    meta: { snapshotDate, examDate: '2026-09-06', syncTimes: ['00h50', '06h50', '12h50', '18h50'], version: SCHEMA_VERSION },
    entries: [{ at: localIso(runStartedAt), kind, status, summary, detail }, ...(previousHistory.entries || [])].slice(0, 40)
  };
}

function setOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  return fs.appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, 'utf8');
}

function pendingDailyContent(controls) {
  const current = controls.find(item => item.date === snapshotDate);
  const pe = current?.pe || '';
  return {
    available: false,
    pe,
    catalog: { questionCount: 0 },
    semantic: pendingDailySemantic({
      pe, materialsRootId: DAILY_ROOTS.materials.id, questionsRootId: DAILY_ROOTS.questions.id
    }),
    warning: 'As raízes Materiais Premium Diários e Questões Diárias ainda não estão compartilhadas com a integração TDAS Dashboard Sync.'
  };
}

console.log('Consultando as três bases operacionais e as duas árvores oficiais da Execução diária no Notion...');
const [rawControls, rawErrors, rawRedactions] = await Promise.all([
  queryAll(SOURCES.control), queryAll(SOURCES.errors), queryAll(SOURCES.redactions)
]);

const controls = rawControls.map(control).filter(item => /^PE[0-9]+$/.test(item.pe)).sort((a, b) => Number(a.pe.slice(2)) - Number(b.pe.slice(2)));
const rdToPe = new Map(controls.filter(item => item.rd).map(item => [item.rd, item.pe]));
const redactions = rawRedactions.map(redaction).filter(item => /^RD[0-9]+$/.test(item.rd)).map(item => ({ ...item, pe: rdToPe.get(item.rd) || '' })).sort((a, b) => Number(a.rd.slice(2)) - Number(b.rd.slice(2)));
const realErrorPages = rawErrors.filter(item => String(item.title || '').trim() !== '');
console.log(`Caderno de Erros: ${realErrorPages.length} registros reais; lendo Resumo integral de cada página.`);
const errors = (await mapLimit(realErrorPages, 3, completeError)).sort((a, b) => String(a.url).localeCompare(String(b.url)));

validateSourceCounts(rawControls, controls, 'controls', Number(previousState.counts?.controls) || 0);
validateSourceCounts(rawErrors, errors, 'errors', Number(previousState.counts?.errors) || 0);
validateSourceCounts(rawRedactions, redactions, 'redactions', Number(previousState.counts?.redactions) || 0);
uniqueBy(controls, 'url', 'Controle'); uniqueBy(controls, 'pe', 'Controle');
uniqueBy(errors, 'url', 'Caderno de Erros');
uniqueBy(redactions, 'url', 'Redações'); uniqueBy(redactions, 'rd', 'Redações');
if (errors.some(item => !item.questionError.trim())) throw new Error('Caderno de Erros: registro real sem Questão / Erro após normalização.');

let daily;
try {
  daily = await prepareDailyContent({controls, snapshotDate, runStartedAt});
  daily.available = true;
  console.log(`${daily.pe}: material e ${daily.catalog.questionCount} questões preparados diretamente das páginas filhas oficiais.`);
} catch (failure) {
  if (!isDailyContentPermissionError(failure)) throw failure;
  daily = pendingDailyContent(controls);
  console.warn(`Conteúdo diário aguardando permissão: ${failure.message}`);
}

const semantic = {
  schemaVersion: SCHEMA_VERSION,
  controls: controls.map(item => semanticRecord(item, 'control')),
  errors: errors.map(item => semanticRecord(item, 'error')),
  redactions: redactions.map(item => semanticRecord(item, 'redaction')),
  daily: daily.semantic
};
const nextHash = hash(semantic);
const semanticChanged = shouldRebuild({
  previousHash: previousState.semanticHash,
  nextHash,
  syncKind: process.env.SYNC_KIND || '',
  forceRebuild: process.env.FORCE_REBUILD === 'true'
});
const output = build(controls, errors, redactions, snapshotDate, runStartedAt);
output.state.semanticHash = nextHash;
output.state.dailyContent = daily.semantic;

if (semanticChanged) {
  await removeLegacyTechnicalData();
  await clearOldErrorParts();
  if (daily.available) await clearDailyKeys();
  const writes = [
    writeJson('data/notion/state.json', output.state),
    writeJson('data/home.json', output.home), writeJson('data/today.json', output.today), writeJson('data/evolution.json', output.evolution),
    writeJson('data/risks.json', output.risks), writeJson('data/agenda.json', output.agenda), writeJson('data/redactions.json', output.redactionsPublic),
    writeJson('data/audit.json', output.audit), writeJson('data/more.json', output.more), writeJson('data/subjects.json', output.subjects), writeJson('data/live.json', output.live),
    writeJson('data/export/actual-01.json', output.exports.actual1), writeJson('data/export/actual-02.json', output.exports.actual2), writeJson('data/export/actual-03.json', output.exports.actual3),
    writeJson('data/export/future-01.json', output.exports.future1), writeJson('data/export/future-02.json', output.exports.future2),
    writeJson('data/export/redactions-01.json', output.exports.redactions1), writeJson('data/export/redactions-02.json', output.exports.redactions2),
    writeJson('data/export/errors.json', output.exports.errors), writeJson('data/export/quality.json', output.exports.quality), writeJson('data/export/summary.json', output.exports.summary),
    writeJson('data/error-questions/index.json', output.errorQuestions.index),
    ...output.errorQuestions.parts.map((records, index) => writeJson(`data/error-questions/part-${String(index + 1).padStart(2, '0')}.json`, records))
  ];
  if (daily.available) {
    writes.push(
      writeJson('data/integration/daily-execution.json', daily.contract),
      writeJson('data/integration/daily-material.json', daily.material),
      writeJson('data/integration/question-catalog.json', daily.catalog),
      ...(daily.key ? [writeJson(daily.catalog.keyPath, daily.key)] : [])
    );
  }
  await Promise.all(writes);
  await ensureRoutes(output.routes);
  await generateServiceWorker(output.routes, output.errorQuestions.index);
  await writeJson('data/sync-history.json', appendHistory(
    'success',
    daily.available ? 'Fontes oficiais e conteúdo diário sincronizados' : 'Fontes operacionais sincronizadas; conteúdo diário aguardando permissão',
    daily.available
      ? `Processados ${controls.length} PE, ${errors.length} erros, ${redactions.length} redações e o conteúdo do ${daily.pe}: material completo e ${daily.catalog.questionCount} questões, com correção separada.`
      : `Processados ${controls.length} PE, ${errors.length} erros e ${redactions.length} redações. ${daily.warning}`
  ));
  await setOutput('semantic_changes', 'true');
  console.log(daily.available
    ? `Mudança preparada: ${controls.length} PE, ${errors.length} erros, ${redactions.length} redações e conteúdo diário de ${daily.pe}.`
    : `Mudança preparada sem conteúdo diário: ${daily.warning}`
  );
} else {
  await writeJson('data/sync-history.json', appendHistory(
    'no_changes',
    daily.available ? 'Fontes oficiais verificadas sem mudança semântica' : 'Fontes operacionais verificadas; conteúdo diário aguardando permissão',
    daily.available
      ? `Contagens confirmadas: ${controls.length} PE, ${errors.length} erros e ${redactions.length} redações. Material e ${daily.catalog.questionCount} questões de ${daily.pe} permanecem íntegros.`
      : `Contagens confirmadas: ${controls.length} PE, ${errors.length} erros e ${redactions.length} redações. ${daily.warning}`
  ));
  await setOutput('semantic_changes', 'false');
  console.log(daily.available ? 'Nenhuma mudança semântica; somente o histórico da execução foi atualizado.' : daily.warning);
}
