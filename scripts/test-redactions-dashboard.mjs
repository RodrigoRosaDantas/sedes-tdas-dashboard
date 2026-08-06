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
const correctedDates=['2026-05-19','2026-05-22','2026-05-26','2026-05-29','2026-07-04','2026-06-05','2026-06-09','2026-06-12','2026-06-16','2026-06-19','2026-06-23','2026-06-26'];
const details = Array.from({ length: 32 }, (_, index) => {
  const number = index + 1;
  const rd = `RD${String(number).padStart(2, '0')}`;
  const corrected = index < knownScores.length;
  const locked = index >= 23;
  const date=corrected?correctedDates[index]:`2026-${number<24?'07':'09'}-${String((number%27)+1).padStart(2,'0')}`;
  return {
    schemaVersion: '1.1',
    rd,
    corrected,
    meta: {
      theme: `Tema ${rd}`,
      pe: `PE${String(number * 3).padStart(2, '0')}`,
      week: Math.ceil(number / 2),
      date,
      correctionDate: corrected?date:'',
      status: corrected ? 'Corrigida' : 'Não iniciada',
      axis: index % 2 ? 'Assistência Social / SUAS' : 'Gestão pública / eficiência',
      priority: index % 3 ? 'Alta' : 'Média',
      discursivePriority: 'Núcleo do edital'
    },
    access: { locked },
    proposal: locked ? null : { command: 'Comando público', requiredConcepts: 'Conceitos', caseProblem: '', markdown: '## Proposta' },
    original: corrected ? { text: `Texto original ${rd}`, lines: 24 } : null,
    performance: corrected ? { score: knownScores[index], criteria: { cac: 1.9, ot: 1.8, dlp: 1.7 } } : null,
    feedback: corrected ? { strategicCorrection: `Correção ${rd}`, mainFailure: index % 2 ? 'Superficialidade' : 'Português', nextAction: 'Reescrever conclusão', rewriteRequired: true, rewriteCompleted:index<2, canBeModel: true, portugueseReviewed: false } : null,
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
assert.equal(dashboard.summary.last.rd,'RD05','A última nota deve seguir a data de correção, não o número da RD.');
assert.equal(dashboard.summary.lastSequence.rd,'RD12','A última RD na sequência deve permanecer disponível separadamente.');
assert.equal(dashboard.evolution.at(-1).rd,'RD05','O gráfico deve seguir ordem cronológica.');
assert.equal(dashboard.summary.rewriteCompletion,16.7,'Somente reescritas objetivamente concluídas entram no indicador.');
assert.equal(dashboard.summary.scheduleAdherence,52.2,'Regularidade deve medir cumprimento do calendário vencido.');
assert.ok(dashboard.priorities.length > 0);
const rd01Priority=dashboard.priorities.find(item=>item.rd==='RD01');
assert.ok(!rd01Priority||!rd01Priority.reasons.includes('reescrita necessária'),'Reescrita concluída não pode permanecer como pendência.');

const payload = {
  schemaVersion: '1.1',
  redactions: details.map(item => ({ rd: item.rd })),
  dashboard
};
assert.equal(validatePublicRedactions(payload, details), true);
console.log('Dashboard Discursivo validado: cronologia, reescrita concluída, calendário, fórmula, privacidade, sequência e prioridades.');
