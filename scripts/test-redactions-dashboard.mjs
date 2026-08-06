import assert from 'node:assert/strict';
import {
  buildRedactionsDashboard,
  classification,
  sanitizeProposalMarkdown,
  scoreFromCriteria,
  validatePublicRedactions
} from './notion/redactions-public.mjs';

assert.equal(scoreFromCriteria(1.9, 1.9, 1.8), 62.83, 'A fórmula CAC/OT/DLP deve reproduzir a nota estimada.');
assert.equal(classification(75), 'Forte');
assert.equal(classification(50), 'Aprovável');
assert.equal(classification(49.99), 'Risco');
assert.equal(
  sanitizeProposalMarkdown('# Tema\n## Comando\nTexto seguro\n## Correção após a escrita\nResposta indevida'),
  '# Tema\n## Comando\nTexto seguro',
  'A proposta pública deve terminar antes da correção.'
);

const knownScores = [62.83,60.67,64.17,67,51.33,58,52.33,48.58,60.83,55.17,61.67,61.67];
const details = Array.from({ length: 32 }, (_, index) => {
  const number = index + 1;
  const rd = `RD${String(number).padStart(2, '0')}`;
  const corrected = index < knownScores.length;
  const locked = index >= 23;
  return {
    schemaVersion: '1.0',
    rd,
    corrected,
    meta: {
      theme: `Tema ${rd}`,
      pe: `PE${String(number * 3).padStart(2, '0')}`,
      week: Math.ceil(number / 2),
      date: `2026-${number < 24 ? '07' : '09'}-${String((number % 27) + 1).padStart(2, '0')}`,
      status: corrected ? 'Corrigida' : 'Não iniciada',
      axis: index % 2 ? 'Assistência Social / SUAS' : 'Gestão pública / eficiência',
      priority: index % 3 ? 'Alta' : 'Média',
      discursivePriority: 'Núcleo do edital'
    },
    access: { locked },
    proposal: locked ? null : { command: 'Comando público', requiredConcepts: 'Conceitos', caseProblem: '', markdown: '## Proposta' },
    original: corrected ? { text: `Texto original ${rd}`, lines: 24 } : null,
    performance: corrected ? { score: knownScores[index], criteria: { cac: 1.9, ot: 1.8, dlp: 1.7 } } : null,
    feedback: corrected ? { strategicCorrection: `Correção ${rd}`, mainFailure: index % 2 ? 'Superficialidade' : 'Português', nextAction: 'Reescrever conclusão', rewriteRequired: true, canBeModel: false, portugueseReviewed: false } : null,
    model: corrected ? { maximumRewrite: `Reescrita ${rd}` } : null
  };
});
const dashboard = buildRedactionsDashboard(details, { snapshotDate: '2026-08-05', examDate: '2026-09-06' });
assert.equal(dashboard.summary.total, 32);
assert.equal(dashboard.summary.corrected, 12);
assert.equal(dashboard.summary.pending, 20);
assert.equal(dashboard.summary.average, 58.69);
assert.equal(dashboard.bands.risk, 1);
assert.equal(dashboard.bands.approvable, 11);
assert.equal(dashboard.evolution.length, 12);
assert.ok(dashboard.priorities.length > 0);

const payload = {
  schemaVersion: '1.0',
  redactions: details.map(item => ({ rd: item.rd })),
  dashboard
};
assert.equal(validatePublicRedactions(payload, details), true);
console.log('Dashboard Discursivo validado: fórmula, privacidade, sequência RD01–RD32, métricas e prioridades.');
