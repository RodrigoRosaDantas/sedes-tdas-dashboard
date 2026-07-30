import fs from 'node:fs/promises';

const files = [
  'data/notion/control.json',
  'data/notion/errors.json',
  'data/notion/redactions.json',
  'data/notion/state.json',
  'data/home.json',
  'data/risks.json',
  'data/subjects.json',
  'data/redactions.json'
];

const data = {};
for (const file of files) {
  try {
    data[file] = JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    throw new Error(`${file} não é um JSON válido: ${error.message}`);
  }
}

const controls = data['data/notion/control.json'].records;
const errors = data['data/notion/errors.json'].records;
const redactions = data['data/notion/redactions.json'].records;
const home = data['data/home.json'];
const risks = data['data/risks.json'];
const subjects = data['data/subjects.json'];
const redactionsPublic = data['data/redactions.json'];
const state = data['data/notion/state.json'];

if (!Array.isArray(controls) || controls.length < 100) throw new Error(`Controle de questões incompleto: ${controls?.length ?? 0} registros.`);
if (!Array.isArray(errors) || errors.length < 100) throw new Error(`Caderno de erros incompleto: ${errors?.length ?? 0} registros.`);
if (!Array.isArray(redactions) || redactions.length < 25) throw new Error(`Banco de redações incompleto: ${redactions?.length ?? 0} registros.`);
if (home.metrics.errors !== errors.length) throw new Error('Total de erros diverge entre home.json e a fonte normalizada.');
if (risks.summary.total !== errors.length) throw new Error('Total de erros diverge em risks.json.');
if (subjects.subjects.reduce((sum, item) => sum + item.errors, 0) !== errors.length) throw new Error('Soma por matéria não fecha com o total de erros.');
if (redactionsPublic.summary.valid !== redactionsPublic.redactions.length) throw new Error('Total de redações válidas não fecha.');
if (state.counts.controls !== controls.length || state.counts.errors !== errors.length || state.counts.redactions !== redactions.length) throw new Error('Contagens do estado não fecham com os bancos normalizados.');
if (!state.semanticHash || state.semanticHash.length !== 64) throw new Error('Hash semântico ausente ou inválido.');
if (!/^\d{4}-\d{2}-\d{2}$/.test(state.snapshotDate)) throw new Error('Data do snapshot inválida.');

for (const [name, records] of Object.entries({ controls, errors, redactions })) {
  const ids = new Set();
  for (const item of records) {
    if (!item.id || !item.url) throw new Error(`${name}: registro sem ID ou URL oficial do Notion.`);
    if (ids.has(item.id)) throw new Error(`${name}: ID duplicado ${item.id}.`);
    ids.add(item.id);
  }
}

if (!controls.some(item => /^PE\d{2,3}$/.test(item.pe))) throw new Error('Nenhum Dia ID PE válido foi encontrado.');
if (!errors.every(item => item.subject && item.date)) throw new Error('Há erro sem matéria ou data normalizada.');
if (!redactions.some(item => /^RD\d{2,3}$/.test(item.rd))) throw new Error('Nenhum RD ID válido foi encontrado.');

console.log(`Validação concluída: ${controls.length} controles, ${errors.length} erros, ${redactions.length} redações.`);
