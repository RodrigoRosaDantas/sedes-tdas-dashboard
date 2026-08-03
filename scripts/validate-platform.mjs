import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const ROOT = process.cwd();
const BASE = '/sedes-tdas-dashboard/';
const readJson = async file => JSON.parse(await fs.readFile(path.join(ROOT, file), 'utf8'));
const exists = async file => fs.access(path.join(ROOT, file)).then(() => true).catch(() => false);

async function walk(directory, output = []) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(full, output); else output.push(full);
  }
  return output;
}

function rel(file) { return path.relative(ROOT, file).replaceAll(path.sep, '/'); }
function required(condition, message) { if (!condition) throw new Error(message); }
function duplicates(values) { const seen = new Set(); return values.filter(value => seen.size === seen.add(value).size); }
function codeNumber(code) { return Number(String(code || '').replace(/\D/g, '')) || 0; }

const requiredFiles = [
  'index.html', 'hoje/index.html', 'evolucao/index.html', 'riscos/index.html', 'agenda/index.html', 'redacoes/index.html', 'auditoria/index.html',
  'mais/index.html', 'questoes-erros/index.html', 'pe/index.html', 'materias/index.html', 'manifest.webmanifest', 'sw.js', 'README.md',
  'assets/common.js', 'assets/enhance-v20.js', 'assets/error-questions.js', 'assets/pe.js', 'assets/subject.js', 'assets/subjects-index.js', 'assets/v20.css',
  'data/home.json', 'data/today.json', 'data/evolution.json', 'data/risks.json', 'data/agenda.json', 'data/redactions.json', 'data/audit.json',
  'data/more.json', 'data/subjects.json', 'data/sync-history.json', 'data/live.json', 'data/notion/state.json', 'data/error-questions/index.json',
  'data/export/actual-01.json', 'data/export/actual-02.json', 'data/export/actual-03.json', 'data/export/future-01.json', 'data/export/future-02.json',
  'data/export/redactions-01.json', 'data/export/redactions-02.json', 'data/export/errors.json', 'data/export/quality.json', 'data/export/summary.json'
];
for (const file of requiredFiles) required(await exists(file), `Arquivo obrigatório ausente: ${file}.`);

const allFiles = await walk(ROOT);
const temporary = allFiles.map(rel).filter(file => /(^|\/)(\.tmp|tmp|temp)(\/|$)|\.tmp$|\.sync-result/.test(file));
required(!temporary.length, `Arquivos temporários encontrados: ${temporary.join(', ')}.`);

for (const file of allFiles.filter(file => file.endsWith('.json') || file.endsWith('.webmanifest'))) {
  try { JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) { throw new Error(`${rel(file)} não é JSON válido: ${error.message}`); }
}

for (const file of allFiles.filter(file => file.endsWith('.js') || file.endsWith('.mjs'))) {
  try { await exec(process.execPath, ['--check', file]); }
  catch (error) { throw new Error(`${rel(file)} falhou na validação JavaScript: ${error.stderr || error.message}`); }
}

const htmlFiles = allFiles.filter(file => file.endsWith('.html'));
for (const file of htmlFiles) {
  const content = await fs.readFile(file, 'utf8');
  required(/<!doctype html>/i.test(content), `${rel(file)} sem doctype.`);
  required(/<html\b/i.test(content) && /<main\b/i.test(content) && /<\/html>/i.test(content), `${rel(file)} possui estrutura HTML incompleta.`);
  for (const match of content.matchAll(/(?:href|src)=["'](\/sedes-tdas-dashboard\/[^"'#?]*)(?:[?#][^"']*)?["']/g)) {
    let target = match[1].slice(BASE.length);
    if (!target) target = 'index.html'; else if (target.endsWith('/')) target += 'index.html';
    required(await exists(target), `${rel(file)} referencia arquivo inexistente: ${match[1]}.`);
  }
}

const manifest = await readJson('manifest.webmanifest');
required(manifest.start_url === BASE && manifest.scope === BASE, 'Manifesto com start_url ou scope incorreto.');
for (const icon of manifest.icons || []) {
  const target = String(icon.src || '').replace(BASE, '');
  required(target && await exists(target), `Ícone do manifesto ausente: ${icon.src}.`);
}

const errorIndexForSw = await readJson('data/error-questions/index.json');
const sw = await fs.readFile(path.join(ROOT, 'sw.js'), 'utf8');
const stringArray = name => {
  const match = sw.match(new RegExp(`const ${name}=\\[([\\s\\S]*?)\\];`));
  required(match, `Service worker sem lista ${name} válida.`);
  const values = [...match[1].matchAll(/(['"])(.*?)\1/g)].map(item => item[2]);
  required(values.length || !match[1].trim(), `Service worker possui lista ${name} sem strings válidas.`);
  return values;
};
const literalPrecache = sw.match(/const PRECACHE=\[([\s\S]*?)\];/);
required(literalPrecache, 'Service worker sem lista PRECACHE válida.');
let precache;
if (literalPrecache[1].includes('...CORE_ROUTES.map')) {
  const coreRoutes = stringArray('CORE_ROUTES');
  const assets = stringArray('ASSETS');
  const data = stringArray('DATA');
  const icons = stringArray('ICONS');
  const subjectsInSw = stringArray('SUBJECTS');
  precache = [
    ...coreRoutes.map(route => BASE + route),
    ...assets.map(asset => BASE + asset),
    ...data.map(file => BASE + file),
    ...icons.map(icon => BASE + icon),
    ...Array.from({length: 112}, (_, index) => BASE + `pe/${index + 1}/`),
    ...subjectsInSw.map(slug => BASE + `materias/${slug}/`),
    ...(errorIndexForSw.parts || []).map(part => BASE + `data/error-questions/${part.file}`),
  ];
} else {
  precache = [...literalPrecache[1].matchAll(/(['"])(.*?)\1/g)].map(item => item[2]);
}
required(precache.length, 'Service worker possui PRECACHE vazio.');
required(!duplicates(precache).length, 'Service worker possui URLs duplicadas no PRECACHE.');
for (const url of precache) {
  let target = String(url).replace(BASE, '');
  if (!target) target = 'index.html'; else if (target.endsWith('/')) target += 'index.html';
  required(await exists(target), `Service worker referencia arquivo inexistente: ${url}.`);
}

const home = await readJson('data/home.json');
const today = await readJson('data/today.json');
const evolution = await readJson('data/evolution.json');
const risks = await readJson('data/risks.json');
const agenda = await readJson('data/agenda.json');
const redactions = await readJson('data/redactions.json');
const audit = await readJson('data/audit.json');
const subjects = await readJson('data/subjects.json');
const history = await readJson('data/sync-history.json');
const state = await readJson('data/notion/state.json');
const actual = [
  ...await readJson('data/export/actual-01.json'), ...await readJson('data/export/actual-02.json'), ...await readJson('data/export/actual-03.json')
];
const future = [...await readJson('data/export/future-01.json'), ...await readJson('data/export/future-02.json')];
const redactionExports = [...await readJson('data/export/redactions-01.json'), ...await readJson('data/export/redactions-02.json')];
const allControls = [...actual, ...future];

required(/^20\./.test(String(home.meta?.version)), 'A arquitetura deixou de ser v20.');
required(/^\d{4}-\d{2}-\d{2}$/.test(home.meta?.snapshotDate || ''), 'Data do snapshot inválida.');
required(today.current?.pe === home.today?.pe, 'PE atual diverge entre today.json e home.json.');
required(agenda.current?.pe === home.today?.pe, 'PE atual diverge entre agenda.json e home.json.');
required(home.latest?.pe, 'Último PE concluído ausente em home.json.');
required(state.counts?.controls === allControls.length, 'Total processado do Controle diverge do estado.');
required(state.counts?.errors === risks.summary?.total, 'Total processado do Caderno de Erros diverge do estado.');
required(state.counts?.redactions === redactions.redactions?.length, 'Total processado das Redações diverge do estado.');
required(home.metrics?.errors === risks.summary?.total, 'Total de erros diverge entre home e risks.');
required(audit.summary?.error_bank_total === risks.summary?.total, 'Total de erros diverge na auditoria.');
required(subjects.subjects.reduce((sum, item) => sum + item.errors, 0) === risks.summary.total, 'Soma de erros por matéria não fecha.');
required(redactions.summary?.valid === redactions.redactions?.length && redactionExports.length === redactions.redactions.length, 'Total de redações não fecha.');
required(evolution.summary?.resultDays === evolution.actual?.length, 'Total de dias com resultado não fecha em evolution.json.');
required(Array.isArray(history.entries) && history.entries.length >= 1 && history.entries.length <= 40, 'Histórico de sincronização inválido.');
required(['success', 'no_changes', 'error'].includes(history.entries[0].status), 'Status mais recente do histórico é inválido.');

required(!duplicates(allControls.map(item => item.pe)).length, 'PE duplicado nas exportações.');
required(!duplicates(allControls.map(item => item.url)).length, 'URL duplicada no Controle processado.');
required(allControls.every(item => /^PE[0-9]+$/.test(item.pe) && item.url), 'Há PE sem chave integral ou URL.');
required(!duplicates(redactions.redactions.map(item => item.rd)).length, 'RD duplicada.');
required(!duplicates(redactions.redactions.map(item => item.url)).length, 'URL duplicada nas redações.');
required(redactions.redactions.every(item => /^RD[0-9]+$/.test(item.rd) && item.url), 'Há redação sem chave integral ou URL.');

for (const item of allControls) required(await exists(`pe/${codeNumber(item.pe)}/index.html`), `Rota ausente para ${item.pe}.`);
for (const item of subjects.subjects) required(await exists(`materias/${item.slug}/index.html`), `Rota ausente para matéria ${item.subject}.`);

const errorIndex = errorIndexForSw;
required(errorIndex.total === risks.summary.total, 'Índice de questões erradas diverge do total oficial.');
required(errorIndex.materias === subjects.subjects.length, 'Total de matérias diverge no índice de questões erradas.');
let errorRecords = [];
for (const part of errorIndex.parts || []) {
  required(/^part-[0-9]+\.json$/.test(part.file), `Nome de parte inválido: ${part.file}.`);
  const records = await readJson(`data/error-questions/${part.file}`);
  required(records.length === part.count && records.length <= 20, `${part.file}: contagem inválida ou mais de 20 registros.`);
  errorRecords.push(...records);
}
required(errorRecords.length === errorIndex.total, 'Total contado nas partes não fecha com o índice.');
required(!duplicates(errorRecords.map(item => item.url)).length, 'URL duplicada nas questões erradas.');
const allowedErrorKeys = ['questaoErro', 'materia', 'origem', 'data', 'gravidade', 'reincidencia', 'padraoErro', 'tema', 'subtema', 'flashcard', 'revisado', 'url', 'resumo'].sort();
for (const item of errorRecords) {
  required(item.questaoErro && item.url, 'Questão errada sem chave textual ou URL.');
  required(JSON.stringify(Object.keys(item).sort()) === JSON.stringify(allowedErrorKeys), `Questão errada publicou campos não autorizados: ${Object.keys(item).join(', ')}.`);
  required(!('observations' in item) && !('id' in item), 'Questão errada contém campo técnico proibido.');
}

required(!(await exists('data/notion/control.json')) && !(await exists('data/notion/errors.json')) && !(await exists('data/notion/redactions.json')), 'Arquivos técnicos legados ainda estão publicados.');
required(JSON.stringify(await readJson('data/live.json')) === '{}', 'data/live.json contém sobreposição histórica e pode adulterar o snapshot atual.');

for (const download of audit.downloads || []) required(download.key && download.filename, 'Download sem chave ou nome de arquivo.');
console.log(`Validação integral concluída: ${allControls.length} PE, ${errorRecords.length} erros, ${redactions.redactions.length} redações, ${htmlFiles.length} HTML e ${allFiles.length} arquivos.`);
