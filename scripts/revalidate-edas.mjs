import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { queryAll } from './notion/api.mjs';
import { localDate, localIso } from './notion/config.mjs';

const ROOT = process.cwd();
const SITE_PATH = 'edas-administracao/data/site.json';
const CONTRACT_PATH = 'edas-administracao/data/integration/daily-contract.json';
const OUTPUT_PATH = 'edas-administracao/data/revalidation.json';

const number = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const sprintId = value => String(value || '').trim().toUpperCase().match(/^S\d{2}$/)?.[0] || '';
const round = (value, digits = 2) => Number(value.toFixed(digits));
const sourceId = value => String(value || '').replace(/^collection:\/\//, '');

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

export function computeEdasObservation({ control, errors, cases }) {
  requireCondition(Array.isArray(control), 'Controle EDAS ausente.');
  requireCondition(Array.isArray(errors), 'Caderno de Erros EDAS ausente.');
  requireCondition(Array.isArray(cases), 'Estudos de Caso EDAS ausentes.');

  const controlRows = control.map(page => ({
    id: sprintId(page?.properties?.['Dia ID']),
    completed: page?.properties?.['Bloco objetivo concluído?'] === true,
    questions: number(page?.properties?.['Total do dia — feitas']),
    correct: number(page?.properties?.['Acertos gerais oficiais']),
  }));
  const sprintRows = controlRows.filter(row => row.id);
  const ids = sprintRows.map(row => row.id);
  requireCondition(sprintRows.length === 42, `Controle EDAS deve conter 42 Sprints S01–S42; recebeu ${sprintRows.length} entre ${controlRows.length} páginas.`);
  requireCondition(new Set(ids).size === ids.length, 'Controle EDAS contém Dia ID duplicado.');
  const expectedIds = Array.from({ length: 42 }, (_, index) => `S${String(index + 1).padStart(2, '0')}`);
  requireCondition(expectedIds.every(id => ids.includes(id)), 'Controle EDAS não contém exatamente S01–S42.');
  requireCondition(sprintRows.every(row => row.questions >= 0 && row.correct >= 0 && row.correct <= row.questions), 'Controle EDAS contém contagem objetiva inválida.');

  const questions = sprintRows.reduce((sum, row) => sum + row.questions, 0);
  const correct = sprintRows.reduce((sum, row) => sum + row.correct, 0);
  return {
    totalSprints: sprintRows.length,
    completedSprints: sprintRows.filter(row => row.completed).length,
    questions,
    correct,
    accuracy: questions ? round(correct / questions * 100) : 0,
    errorsAccumulated: questions - correct,
    errorPages: errors.length,
    cases: cases.length,
  };
}

export function assertObservationMatchesSite(observed, site) {
  const expected = {
    totalSprints: number(site?.plan?.totalSprints),
    completedSprints: number(site?.metrics?.completed),
    questions: number(site?.metrics?.questions),
    correct: number(site?.metrics?.correct),
    accuracy: number(site?.metrics?.accuracy),
    errorsAccumulated: number(site?.metrics?.errors),
    errorPages: number(site?.errorCoverage?.loaded),
    cases: number(site?.metrics?.casesTotal),
  };
  const differences = Object.keys(expected)
    .filter(key => Math.abs(number(observed[key]) - expected[key]) > (key === 'accuracy' ? 0.005 : 0))
    .map(key => `${key}: Notion=${observed[key]}; snapshot=${expected[key]}`);
  requireCondition(!differences.length, `O Notion diverge do snapshot EDAS publicado. ${differences.join(' | ')}`);
  return expected;
}

export function buildEdasRevalidation({ site, sources, observed, now = new Date() }) {
  requireCondition(site?.meta?.version, 'Snapshot EDAS sem versão semântica.');
  requireCondition(site?.meta?.snapshotDate, 'Snapshot EDAS sem data.');
  requireCondition(sprintId(site?.today?.sprint), 'Snapshot EDAS sem Sprint operacional válido.');
  assertObservationMatchesSite(observed, site);
  const instant = new Date(now);
  requireCondition(!Number.isNaN(instant.getTime()), 'Instante de revalidação inválido.');

  return {
    schemaVersion: '1.0.0',
    status: 'no_changes',
    validatedAt: localIso(instant.toISOString()),
    validatedDate: localDate(instant.toISOString()),
    snapshotDate: site.meta.snapshotDate,
    dataVersion: site.meta.version,
    sprintId: sprintId(site.today.sprint),
    sources: {
      control: `collection://${sources.control}`,
      errors: `collection://${sources.errors}`,
      cases: `collection://${sources.cases}`,
    },
    observed,
    note: `Revalidação sem alteração semântica: as três fontes oficiais foram percorridas integralmente e conferidas por paginação independente. O Controle mantém ${observed.totalSprints} Sprints S01–S42, ${observed.completedSprints} blocos objetivos concluídos, ${observed.questions} questões e ${observed.correct} acertos (${observed.accuracy.toFixed(2).replace('.', ',')}%); o Caderno mantém ${observed.errorPages} páginas detalhadas para ${observed.errorsAccumulated} erros acumulados; Estudos de Caso mantém ${observed.cases} registros.`,
  };
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(path.join(ROOT, file), 'utf8'));
}

export async function runEdasRevalidation({ now = process.env.EDAS_REVALIDATION_NOW || new Date().toISOString() } = {}) {
  const [site, contract] = await Promise.all([readJson(SITE_PATH), readJson(CONTRACT_PATH)]);
  const sources = {
    control: sourceId(contract?.sources?.control),
    errors: sourceId(contract?.sources?.errors),
    cases: sourceId(contract?.sources?.cases),
  };
  requireCondition(Object.values(sources).every(Boolean), 'Contrato EDAS sem as três fontes oficiais.');

  const [control, errors, cases] = await Promise.all([
    queryAll({ name: 'Controle de Questões EDAS', dataSourceId: sources.control }),
    queryAll({ name: 'Caderno de Erros EDAS', dataSourceId: sources.errors }),
    queryAll({ name: 'Estudos de Caso EDAS', dataSourceId: sources.cases }),
  ]);
  const observed = computeEdasObservation({ control, errors, cases });
  const revalidation = buildEdasRevalidation({ site, sources, observed, now });
  await fs.writeFile(path.join(ROOT, OUTPUT_PATH), `${JSON.stringify(revalidation, null, 2)}\n`, 'utf8');
  console.log(`EDAS revalidado sem divergência: ${observed.totalSprints} Sprints, ${observed.questions} questões, ${observed.correct} acertos, ${observed.errorPages} páginas de erro e ${observed.cases} casos.`);
  return revalidation;
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  await runEdasRevalidation();
}
