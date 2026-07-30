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
  try { data[file] = JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) { throw new Error(`${file} não é um JSON válido: ${error.message}`); }
}

const controls = data['data/notion/control.json'].records;
const errors = data['data/notion/errors.json'].records;
const redactions = data['data/notion/redactions.json'].records;
const home = data['data/home.json'];
const risks = data['data/risks.json'];
const subjects = data['data/subjects.json'];
const redactionsPublic = data['data/redactions.json'];
const state = data['data/notion/state.json'];

if (!Array.isArray(controls) || controls.length < 50) throw new Error(`Controle de questões incompleto: ${controls?.length ?? 0} registros.`);
if (!Array.isArray(errors) || errors.length < 1) throw new Error('Caderno de erros vazio.');
if (!Array.isArray(redactions) || redactions.length < 1) throw new Error('Banco de redações vazio.');
if (home.metrics.errors !== errors.length) throw new Error('Total de erros diverge entre home.json e a fonte normalizada.');
if (risks.summary.total !== errors.length) throw new Error('Total de erros diverge em risks.json.');
if (subjects.subjects.reduce((sum, x) => sum + x.errors, 0) !== errors.length) throw new Error('Soma por matéria não fecha com o total de erros.');
if (redactionsPublic.summary.valid !== redactionsPublic.redactions.length) throw new Error('Total de redações válidas não fecha.');
if (!state.semanticHash || state.semanticHash.length !== 64) throw new Error('Hash semântico ausente ou inválido.');
if (!/^\d{4}-\d{2}-\d{2}$/.test(state.snapshotDate)) throw new Error('Data do snapshot inválida.');

for (const item of [...controls, ...errors, ...redactions]) {
  if (!item.id || !item.url) throw new Error('Registro sem ID ou URL oficial do Notion.');
}

console.log(`Validação concluída: ${controls.length} controles, ${errors.length} erros, ${redactions.length} redações.`);
