import assert from 'node:assert/strict';
import { control } from './notion/normalize.mjs';

const record = (status, properties = {}) => ({
  id: 'test',
  title: 'PE78 — Cargo 202 completo: revisão administrativa',
  url: 'https://app.notion.com/p/test',
  last_edited_time: '2026-08-03T00:00:00.000Z',
  properties: {
    'Dia ID': 'PE78',
    Data: '2026-08-03',
    Semana: 12,
    Status: status,
    'Meta de questões': 48,
    'Questões feitas': 48,
    Acertos: 0,
    ...properties,
  },
});

const pending = control(record('Não iniciada'));
assert.equal(pending.meta, 48);
assert.equal(pending.attempted, 0);
assert.equal(pending.acertos, null);
assert.equal(pending.ag, null);
assert.equal(pending.ae, null);

for (const status of ['Planejada', 'A fazer', 'Pendente', 'Futuro']) {
  const item = control(record(status, {'Questões feitas': 35, Acertos: 35}));
  assert.equal(item.attempted, 0, `${status} não pode publicar questões tentadas.`);
  assert.equal(item.acertos, null, `${status} não pode publicar acertos.`);
}

const completed = control(record('Concluído', {
  'Questões feitas': 48,
  Acertos: 44,
  'Acertos gerais': 10,
  'Acertos específicas': 34,
}));
assert.equal(completed.attempted, 48);
assert.equal(completed.acertos, 44);
assert.equal(completed.ag, 10);
assert.equal(completed.ae, 34);

const partial = control(record('Em andamento', {'Questões feitas': 20, Acertos: 16}));
assert.equal(partial.attempted, 20);
assert.equal(partial.acertos, 16);

console.log('Controle normalizado: atividades pendentes não publicam tentativa ou resultado; execução real permanece preservada.');
