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

const legacy23 = fs.readFileSync('scripts/postprocess-v23.mjs', 'utf8');
const legacy24 = fs.readFileSync('scripts/postprocess-v24.mjs', 'utf8');
assert.ok(!legacy23.includes("'data/home.json':"));
assert.ok(!legacy24.includes("'data/home.json':"));
assert.ok(legacy24.includes("write('data/live-v24.json', {})"));

console.log('Atualidade do painel validada: PE atual explícito, descansos cumpridos e overlays históricos neutralizados.');
