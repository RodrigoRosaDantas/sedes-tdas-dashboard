import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fulfilledCount, isRest } from './notion/progress.mjs';

const rows = [
  { pe: 'PE01', date: '2026-08-01', status: 'Concluído', title: 'Estudo' },
  { pe: 'PE02', date: '2026-08-02', status: 'Descanso', title: 'Descanso / Anki leve', type: 'Descanso' },
  { pe: 'PE03', date: '2026-08-03', status: 'Não iniciada', title: 'Atividade de hoje' }
];

assert.equal(fulfilledCount(rows, '2026-08-03'), 2);
assert.equal(isRest(rows[1]), true);
assert.equal(isRest(rows[2]), false);
assert.deepEqual(JSON.parse(fs.readFileSync('data/live-v23.json', 'utf8')), {});
assert.deepEqual(JSON.parse(fs.readFileSync('data/live-v24.json', 'utf8')), {});
assert.ok(fs.readFileSync('assets/home.js', 'utf8').includes("metric('PE atual'"));

const home = JSON.parse(fs.readFileSync('data/home.json', 'utf8'));
const agenda = JSON.parse(fs.readFileSync('data/agenda.json', 'utf8'));
assert.equal(agenda.summary.remainingPE, home.metrics.totalPE - home.metrics.completed, 'PE pendentes devem fechar com o ciclo oficial total menos os cumpridos.');
assert.equal(agenda.summary.overduePE, agenda.overdue.length, 'Resumo de atrasos deve fechar com a lista explícita.');
assert.deepEqual(home.overdue.map(item => item.pe), agenda.overdue.map(item => item.pe), 'Home e Agenda devem publicar os mesmos PE atrasados.');
assert.equal(agenda.latestCompleted.pe, home.latest.pe, 'Último PE concluído deve ser independente do PE atual.');

const legacy23 = fs.readFileSync('scripts/postprocess-v23.mjs', 'utf8');
const legacy24 = fs.readFileSync('scripts/postprocess-v24.mjs', 'utf8');
assert.ok(!legacy23.includes("'data/home.json':"));
assert.ok(!legacy24.includes("'data/home.json':"));
assert.ok(legacy24.includes("write('data/live-v24.json', {})"));

console.log('Atualidade do painel validada: PE atual, último concluído e atrasos são distintos; descansos cumpridos e overlays históricos permanecem corretos.');
