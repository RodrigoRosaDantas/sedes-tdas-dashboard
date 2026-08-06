import { norm, round } from './config.mjs';

export const RD_SCHEMA_VERSION = '1.0';
export const SCORE_TARGET = 75;

export const text = value => Array.isArray(value) ? value.join(', ') : String(value ?? '').trim();
export const number = value => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? '').replace(',', '.').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};
export const yes = value => value === true || ['sim', 'true', 'yes', 'concluido', 'concluida', 'corrigido', 'corrigida', 'reescrito', 'reescrita', 'revisado', 'revisada'].includes(norm(value));
export const pendingStatus = status => /nao iniciad|planejad|a fazer|pendente|futuro/.test(norm(status));
export const correctedStatus = status => /corrigid|diagnosticad|reescrit/.test(norm(status));

export function scoreFromCriteria(cac, ot, dlp, explicit = null) {
  const direct = number(explicit);
  if (direct != null && direct > 0) return round(direct, 2);
  const values = [number(cac), number(ot), number(dlp)];
  if (values.some(value => value == null)) return null;
  return round(((values[0] * 7) + (values[1] * 1.5) + (values[2] * 1.5)) / 0.3, 2);
}

export function classification(score) {
  if (score == null) return 'Sem nota';
  if (score >= SCORE_TARGET) return 'Forte';
  if (score >= 50) return 'Aprovável';
  return 'Risco';
}

export function sanitizeProposalMarkdown(markdown = '') {
  const source = String(markdown || '').replace(/\r\n?/g, '\n');
  const forbiddenHeading = /^#{1,6}\s*(?:espelho|corre[cç][aã]o estrat[eé]gica|reescrita(?:\s+para\s+nota\s+m[aá]xima)?|resposta[- ]modelo|modelo de resposta)/i;
  const stopHeading = /^#{1,6}\s*corre[cç][aã]o\s+ap[oó]s\s+a\s+escrita/i;
  const safe = [];
  for (const line of source.split('\n')) {
    if (forbiddenHeading.test(line) || stopHeading.test(line)) break;
    if (/espelho de corre[cç][aã]o/i.test(line)) continue;
    if (/formulaResult:\/\//i.test(line)) continue;
    safe.push(line);
  }
  return safe.join('\n').trim();
}

function average(values) {
  const valid = values.filter(value => Number.isFinite(value));
  return valid.length ? round(valid.reduce((sum, value) => sum + value, 0) / valid.length, 2) : null;
}

function median(values) {
  const valid = values.filter(value => Number.isFinite(value)).sort((a, b) => a - b);
  if (!valid.length) return null;
  const middle = Math.floor(valid.length / 2);
  return round(valid.length % 2 ? valid[middle] : (valid[middle - 1] + valid[middle]) / 2, 2);
}

function movingAverage(rows, index, count = 3) {
  return average(rows.slice(Math.max(0, index - count + 1), index + 1).map(item => item.score));
}

function groupCount(rows, key, fallback = 'Não informado') {
  const groups = new Map();
  for (const row of rows) {
    const value = text(row[key]) || fallback;
    groups.set(value, (groups.get(value) || 0) + 1);
  }
  return [...groups.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function axisRows(details) {
  const groups = new Map();
  for (const detail of details) {
    const axis = text(detail.meta?.axis) || 'Não classificado';
    if (!groups.has(axis)) groups.set(axis, { axis, total: 0, corrected: 0, pending: 0, scores: [] });
    const group = groups.get(axis);
    group.total++;
    if (detail.corrected) {
      group.corrected++;
      if (Number.isFinite(detail.performance?.score)) group.scores.push(detail.performance.score);
    } else group.pending++;
  }
  return [...groups.values()].map(group => ({
    axis: group.axis,
    total: group.total,
    corrected: group.corrected,
    pending: group.pending,
    average: average(group.scores),
    best: group.scores.length ? Math.max(...group.scores) : null
  })).sort((a, b) => (b.average ?? -1) - (a.average ?? -1) || b.total - a.total || a.axis.localeCompare(b.axis));
}

function priorityRows(details) {
  return details
    .filter(detail => !detail.access?.locked)
    .map(detail => {
      const score = detail.performance?.score;
      const reasons = [];
      let weight = 0;
      if (detail.corrected && score != null && score < 50) { weight += 100; reasons.push('nota abaixo de 50'); }
      else if (detail.corrected && score != null && score < 60) { weight += 70; reasons.push('nota abaixo de 60'); }
      if (norm(detail.meta?.priority) === 'alta') { weight += 25; reasons.push('prioridade estratégica alta'); }
      if (norm(detail.meta?.discursivePriority) === 'nucleo do edital') { weight += 20; reasons.push('tema do núcleo do edital'); }
      if (detail.corrected && detail.feedback?.rewriteRequired && !detail.feedback?.canBeModel) { weight += 18; reasons.push('reescrita necessária'); }
      if (detail.corrected && !detail.feedback?.portugueseReviewed) { weight += 12; reasons.push('revisão linguística pendente'); }
      if (!detail.corrected && detail.meta?.date) { weight += 10; reasons.push('produção pendente'); }
      return {
        rd: detail.rd,
        theme: detail.meta?.theme || '',
        score: score ?? null,
        weight,
        reasons,
        action: detail.feedback?.nextAction || (detail.corrected ? 'Revisar diagnóstico e reescrever o ponto mais fraco.' : 'Produzir a redação dentro de 20 a 30 linhas.'),
        href: `/sedes-tdas-dashboard/redacoes/detalhe/?rd=${detail.rd}`
      };
    })
    .filter(item => item.weight > 0)
    .sort((a, b) => b.weight - a.weight || (a.score ?? 999) - (b.score ?? 999) || a.rd.localeCompare(b.rd, undefined, { numeric: true }))
    .slice(0, 8);
}

export function buildRedactionsDashboard(details, { snapshotDate = '', examDate = '2026-09-06' } = {}) {
  const sorted = [...details].sort((a, b) => Number(a.rd.slice(2)) - Number(b.rd.slice(2)));
  const corrected = sorted.filter(item => item.corrected && Number.isFinite(item.performance?.score));
  const scores = corrected.map(item => item.performance.score);
  const evolution = corrected.map((item, index) => ({
    rd: item.rd,
    date: item.meta?.date || '',
    theme: item.meta?.theme || '',
    axis: item.meta?.axis || 'Não classificado',
    score: item.performance.score,
    movingAverage3: movingAverage(corrected, index),
    cac: item.performance?.criteria?.cac ?? null,
    ot: item.performance?.criteria?.ot ?? null,
    dlp: item.performance?.criteria?.dlp ?? null,
    classification: classification(item.performance.score)
  }));
  const status = groupCount(sorted.map(item => ({ status: item.meta?.status || 'Não informado' })), 'status');
  const failures = groupCount(corrected.map(item => ({ failure: item.feedback?.mainFailure || item.feedback?.dominantPattern || 'Sem falha crítica' })), 'failure', 'Sem falha crítica');
  const criteria = {
    cac: average(corrected.map(item => item.performance?.criteria?.cac)),
    ot: average(corrected.map(item => item.performance?.criteria?.ot)),
    dlp: average(corrected.map(item => item.performance?.criteria?.dlp))
  };
  const best = corrected.length ? [...corrected].sort((a, b) => b.performance.score - a.performance.score)[0] : null;
  const worst = corrected.length ? [...corrected].sort((a, b) => a.performance.score - b.performance.score)[0] : null;
  const last = corrected.at(-1) || null;
  const bands = {
    strong: scores.filter(value => value >= SCORE_TARGET).length,
    approvable: scores.filter(value => value >= 50 && value < SCORE_TARGET).length,
    risk: scores.filter(value => value < 50).length
  };
  const total = sorted.length;
  const correctedCount = corrected.length;
  const pending = Math.max(0, total - correctedCount);
  const start = snapshotDate ? new Date(`${snapshotDate}T12:00:00-03:00`) : new Date();
  const end = new Date(`${examDate}T12:00:00-03:00`);
  const weeksRemaining = Math.max(0, round((end - start) / 604800000, 1));
  const perWeek = weeksRemaining ? round(pending / weeksRemaining, 1) : pending;
  const rewriteRate = correctedCount ? corrected.filter(item => !item.feedback?.rewriteRequired || item.feedback?.canBeModel).length / correctedCount * 100 : 0;
  const reviewedRate = correctedCount ? corrected.filter(item => item.feedback?.portugueseReviewed).length / correctedCount * 100 : 0;
  const avgScore = average(scores) ?? 0;
  const recentScores = scores.slice(-3);
  const recentAverage = average(recentScores) ?? avgScore;
  const trendComponent = Math.max(0, Math.min(100, 50 + (recentAverage - avgScore) * 5));
  const commandComponent = criteria.cac == null ? 0 : Math.min(100, criteria.cac / 3 * 100);
  const regularityComponent = total ? correctedCount / total * 100 : 0;
  const readiness = round(avgScore * 0.4 + trendComponent * 0.2 + commandComponent * 0.15 + regularityComponent * 0.1 + rewriteRate * 0.1 + reviewedRate * 0.05, 1);
  return {
    summary: {
      total,
      corrected: correctedCount,
      pending,
      average: average(scores),
      median: median(scores),
      best: best ? { rd: best.rd, score: best.performance.score, theme: best.meta?.theme || '' } : null,
      worst: worst ? { rd: worst.rd, score: worst.performance.score, theme: worst.meta?.theme || '' } : null,
      last: last ? { rd: last.rd, score: last.performance.score, theme: last.meta?.theme || '' } : null,
      target: SCORE_TARGET,
      distanceToTarget: scores.length ? round(SCORE_TARGET - avgScore, 2) : null,
      weeksRemaining,
      perWeek,
      readiness
    },
    bands,
    criteria,
    evolution,
    axes: axisRows(sorted),
    failures,
    status,
    priorities: priorityRows(sorted),
    readiness: {
      value: readiness,
      label: readiness >= 75 ? 'Forte' : readiness >= 50 ? 'Em consolidação' : 'Atenção',
      components: {
        averageScore: round(avgScore, 1),
        recentTrend: round(trendComponent, 1),
        command: round(commandComponent, 1),
        regularity: round(regularityComponent, 1),
        rewrites: round(rewriteRate, 1),
        languageReview: round(reviewedRate, 1)
      },
      notice: 'Índice interno de estudo. Não substitui a nota da banca nem representa previsão oficial.'
    }
  };
}

export function validatePublicRedactions(payload, details, { requireEnriched = true } = {}) {
  const failures = [];
  if (!payload || typeof payload !== 'object') failures.push('payload ausente');
  const rows = Array.isArray(payload?.redactions) ? payload.redactions : [];
  if (requireEnriched && payload?.schemaVersion !== RD_SCHEMA_VERSION) failures.push(`schemaVersion esperado ${RD_SCHEMA_VERSION}`);
  if (rows.length < 32) failures.push(`apenas ${rows.length} redações no índice`);
  const codes = rows.map(item => item.rd).filter(Boolean);
  const unique = new Set(codes);
  if (unique.size !== codes.length) failures.push('RD duplicada no índice');
  const maximum = Math.max(0, ...codes.map(code => Number(String(code).replace(/\D/g, '')) || 0));
  for (let number = 1; number <= maximum; number++) {
    const expected = `RD${String(number).padStart(2, '0')}`;
    if (!unique.has(expected)) failures.push(`sequência incompleta: ${expected} ausente`);
  }
  const serialized = JSON.stringify({ payload, details });
  for (const forbidden of ['formulaResult://', 'Espelho de correção', 'espelho de correção']) {
    if (serialized.includes(forbidden)) failures.push(`conteúdo proibido exposto: ${forbidden}`);
  }
  for (const detail of details || []) {
    if (!detail?.rd) failures.push('detalhe sem RD');
    if (detail?.access?.locked) {
      const leak = JSON.stringify({ proposal: detail.proposal, original: detail.original, feedback: detail.feedback, performance: detail.performance });
      if (/[A-Za-zÀ-ÿ]{8}/.test(leak.replace(/locked|false|true|null|access|proposal|original|feedback|performance/g, ''))) failures.push(`${detail.rd}: conteúdo privado presente em registro bloqueado`);
    }
    if (detail?.corrected) {
      if (!Number.isFinite(detail.performance?.score)) failures.push(`${detail.rd}: corrigida sem nota`);
      if (!text(detail.original?.text)) failures.push(`${detail.rd}: corrigida sem texto original`);
      if (!text(detail.feedback?.strategicCorrection)) failures.push(`${detail.rd}: corrigida sem correção estratégica`);
    }
  }
  if (failures.length) throw new Error(`Banco Discursivo inválido: ${failures.join('; ')}`);
  return true;
}
