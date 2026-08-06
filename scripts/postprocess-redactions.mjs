import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, SOURCES, localDate, readJson, writeJson } from './notion/config.mjs';
import { fetchMarkdown, fetchPropertyText, mapLimit, queryAll } from './notion/api.mjs';
import { prop, propId } from './notion/normalize.mjs';
import {
  RD_SCHEMA_VERSION,
  buildRedactionsDashboard,
  classification,
  correctedStatus,
  number,
  pendingStatus,
  sanitizeProposalMarkdown,
  scoreFromCriteria,
  text,
  validatePublicRedactions,
  yes
} from './notion/redactions-public.mjs';

const previous = await readJson('data/redactions.json', { meta: {}, redactions: [] });
const state = await readJson('data/notion/state.json', {});
const snapshotDate = previous.meta?.snapshotDate || state.snapshotDate || localDate();
const examDate = previous.meta?.examDate || '2026-09-06';
const peByRd = new Map((previous.redactions || []).map(item => [item.rd, item.pe || '']));

const read = (record, names) => prop(record, Array.isArray(names) ? names : [names]);
const safeText = value => {
  const result = text(value);
  return /formulaResult:\/\//i.test(result) ? '' : result;
};
const bool = (record, names) => yes(read(record, names));
const num = (record, names) => number(read(record, names));

async function completeLongText(record, name, { always = false } = {}) {
  const raw = safeText(read(record, [name]));
  const id = propId(record, [name]);
  if (!id || (!always && raw.length < 1800)) return raw;
  try {
    return safeText(await fetchPropertyText(record.id, id)) || raw;
  } catch (error) {
    console.warn(`${record.title}: não foi possível paginar ${name}: ${error.message}`);
    return raw;
  }
}

function weekNumber(value, rd) {
  const parsed = number(value);
  if (parsed != null) return parsed;
  const match = String(value || '').match(/\d+/);
  if (match) return Number(match[0]);
  return Math.ceil(Number(rd.slice(2)) / 2);
}

async function buildDetail(record) {
  const rd = safeText(read(record, ['RD ID'])).toUpperCase();
  const date = safeText(read(record, ['Data'])).slice(0, 10);
  const correctionDate = safeText(read(record, ['Data da correção'])).slice(0, 10);
  const status = safeText(read(record, ['Status', 'Resultado automático', 'Situação', 'Estado da versão'])) || 'Não informado';
  const corrected = bool(record, ['Diagnóstico feito?', 'Corrigida?', 'Correção feita?']) || correctedStatus(status);
  const locked = !corrected && Boolean(date && date > snapshotDate) && pendingStatus(status);
  const meta = {
    theme: safeText(read(record, ['Tema'])) || record.title.replace(/^\s*RD\s*\d+\s*[—–-]\s*/i, '').trim() || record.title,
    pe: peByRd.get(rd) || '',
    week: weekNumber(read(record, ['Semana']), rd),
    date,
    correctionDate,
    status,
    axis: safeText(read(record, ['Eixo'])),
    type: safeText(read(record, ['Tipo'])),
    priority: safeText(read(record, ['Prioridade estratégica'])),
    discursivePriority: safeText(read(record, ['Prioridade discursiva'])),
    strategicScore: num(record, ['Pontuação estratégica']),
    solutionNature: safeText(read(record, ['Natureza da solução'])),
    batch: safeText(read(record, ['Lote de aplicação'])),
    bankVersion: safeText(read(record, ['Versão do banco'])),
    versionState: safeText(read(record, ['Estado da versão'])),
    lastEditedAt: record.last_edited_time || ''
  };

  if (locked) {
    return {
      schemaVersion: RD_SCHEMA_VERSION,
      rd,
      corrected: false,
      meta,
      access: {
        locked: true,
        unlockDate: date,
        reason: 'Proposta futura protegida para preservar a aplicação cega.'
      },
      proposal: null,
      original: null,
      performance: null,
      feedback: null,
      model: null
    };
  }

  const [command, concepts, observations, markdown] = await Promise.all([
    completeLongText(record, 'Comando'),
    completeLongText(record, 'Conceitos obrigatórios'),
    completeLongText(record, 'Observações'),
    fetchMarkdown(record.id).catch(error => {
      console.warn(`${record.title}: conteúdo da página indisponível: ${error.message}`);
      return '';
    })
  ]);
  const proposal = {
    command,
    requiredConcepts: concepts,
    caseProblem: observations,
    markdown: sanitizeProposalMarkdown(markdown)
  };

  if (!corrected) {
    return {
      schemaVersion: RD_SCHEMA_VERSION,
      rd,
      corrected: false,
      meta,
      access: { locked: false, unlockDate: date, reason: '' },
      proposal,
      original: null,
      performance: null,
      feedback: null,
      model: null
    };
  }

  const [originalText, strategicCorrection, maximumRewrite] = await Promise.all([
    completeLongText(record, 'Texto original', { always: true }),
    completeLongText(record, 'Correção estratégica', { always: true }),
    completeLongText(record, 'Reescrita nota máxima', { always: true })
  ]);
  const cac = num(record, ['Nota CAC']);
  const ot = num(record, ['Nota OT']);
  const dlp = num(record, ['Nota DLP']);
  const score = scoreFromCriteria(cac, ot, dlp, read(record, ['Nota estimada']));
  const result = safeText(read(record, ['Resultado redação'])) || classification(score);
  return {
    schemaVersion: RD_SCHEMA_VERSION,
    rd,
    corrected: true,
    meta,
    access: { locked: false, unlockDate: date, reason: '' },
    proposal,
    original: {
      text: originalText,
      lines: num(record, ['Linhas utilizadas'])
    },
    performance: {
      score,
      classification: classification(score),
      result,
      criteria: { cac, ot, dlp }
    },
    feedback: {
      strategicCorrection,
      mainFailure: safeText(read(record, ['Falha principal'])),
      dominantPattern: safeText(read(record, ['Padrão de erro dominante'])),
      nextAction: safeText(read(record, ['Próxima ação'])),
      keyPhrase: safeText(read(record, ['Frase-chave para memorizar'])),
      structureUsed: safeText(read(record, ['Estrutura usada'])),
      rewriteRequired: bool(record, ['Reescrever?']),
      rewriteCompleted: bool(record, ['Reescrita concluída?']),
      portugueseReviewed: bool(record, ['Português revisado?']),
      canBeModel: bool(record, ['Pode virar modelo?']),
      allCommandsAnswered: bool(record, ['Respondeu todos os comandos?']),
      organized: bool(record, ['Organização textual?']),
      contentSpecific: bool(record, ['Conteúdo específico?']),
      becomesFlashcard: bool(record, ['Vira flashcard?']),
      becomesErrorNotebook: bool(record, ['Vira caderno de erros?'])
    },
    model: {
      thesis: safeText(read(record, ['Tese'])),
      argument1: safeText(read(record, ['Argumento 1'])),
      argument2: safeText(read(record, ['Argumento 2'])),
      repertoire: safeText(read(record, ['Repertório'])),
      maximumRewrite
    }
  };
}

console.log('Banco Discursivo: consultando RD01 até a última redação cadastrada...');
const raw = await queryAll(SOURCES.redactions);
const records = raw
  .filter(record => /^RD\d+$/.test(safeText(read(record, ['RD ID'])).toUpperCase()))
  .sort((a, b) => Number(safeText(read(a, ['RD ID'])).replace(/\D/g, '')) - Number(safeText(read(b, ['RD ID'])).replace(/\D/g, '')));
if (records.length < 32) throw new Error(`Banco Discursivo: somente ${records.length} RDs válidas; esperado pelo menos RD01–RD32.`);

const details = await mapLimit(records, 3, buildDetail);
const dashboard = buildRedactionsDashboard(details, { snapshotDate, examDate });
const redactions = details.map(detail => ({
  rd: detail.rd,
  week: detail.meta.week,
  pe: detail.meta.pe,
  date: detail.meta.date,
  correctionDate: detail.meta.correctionDate || '',
  theme: detail.meta.theme,
  status: detail.meta.status,
  axis: detail.meta.axis,
  type: detail.meta.type,
  priority: detail.meta.priority,
  discursivePriority: detail.meta.discursivePriority,
  corrected: detail.corrected,
  locked: detail.access.locked,
  score: detail.performance?.score ?? null,
  classification: detail.performance?.classification || 'Sem nota',
  mainFailure: detail.feedback?.mainFailure || '',
  nextAction: detail.feedback?.nextAction || '',
  rewriteCompleted: Boolean(detail.feedback?.rewriteCompleted),
  rewriteRequired: Boolean(detail.feedback?.rewriteRequired && !detail.feedback?.rewriteCompleted),
  portugueseReviewed: Boolean(detail.feedback?.portugueseReviewed),
  detailPath: `data/redactions/${detail.rd.toLowerCase()}.json`
}));
const payload = {
  schemaVersion: RD_SCHEMA_VERSION,
  meta: {
    snapshotDate,
    examDate,
    syncTimes: previous.meta?.syncTimes || ['00h50', '06h50', '12h50', '18h50'],
    version: previous.meta?.version || '20.3',
    generatedAt: state.syncedAt || new Date().toISOString(),
    source: 'Banco oficial de redações TDAS'
  },
  summary: {
    ...dashboard.summary,
    valid: dashboard.summary.total,
    notStarted: dashboard.summary.pending
  },
  dashboard,
  redactions,
  privacy: {
    applicationBlind: true,
    futureProposalsLocked: true,
    futureCorrectionsExported: false,
    sourceLinksExported: false,
    publicRepository: true,
    privateLayerReady: false,
    notice: 'Propostas futuras permanecem bloqueadas até a data planejada. Links diretos do banco editorial não são exportados. Textos e correções concluídos permanecem na camada pública atual até a implantação de autenticação privada.'
  },
  notice: 'Dados lidos diretamente do banco oficial. Status, notas e diagnósticos não são presumidos.'
};
validatePublicRedactions(payload, details, { requireEnriched: true });

const directory = path.join(ROOT, 'data/redactions');
await fs.mkdir(directory, { recursive: true });
for (const file of await fs.readdir(directory)) if (/^rd\d+\.json$/i.test(file)) await fs.rm(path.join(directory, file));
await Promise.all([
  writeJson('data/redactions.json', payload),
  ...details.map(detail => writeJson(`data/redactions/${detail.rd.toLowerCase()}.json`, detail))
]);
const middle = Math.ceil(redactions.length / 2);
await Promise.all([
  writeJson('data/export/redactions-01.json', redactions.slice(0, middle)),
  writeJson('data/export/redactions-02.json', redactions.slice(middle))
]);

async function patchServiceWorker() {
  const file = path.join(ROOT, 'sw.js');
  let source = await fs.readFile(file, 'utf8');
  const extendArrayConstant = (name, items) => {
    const expression = new RegExp(`const ${name}=(\\[[^;]+\\]);`);
    const match = source.match(expression);
    if (!match) throw new Error(`Banco Discursivo: constante ${name} não localizada no service worker.`);
    const current = JSON.parse(match[1]);
    const next = [...new Set([...current, ...items])];
    source = source.replace(match[0], `const ${name}=${JSON.stringify(next)};`);
  };
  extendArrayConstant('CORE_ROUTES', ['redacoes/detalhe/']);
  extendArrayConstant('ASSETS', ['assets/redactions-dashboard.css', 'assets/redaction-detail.js']);
  await fs.writeFile(file, source, 'utf8');
}
await patchServiceWorker();
console.log(`Banco Discursivo publicado: ${redactions.length} RDs, ${dashboard.summary.corrected} corrigidas, ${dashboard.summary.pending} pendentes e ${details.filter(item => item.access.locked).length} propostas futuras protegidas.`);
