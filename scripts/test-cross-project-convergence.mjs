import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createSession, evaluateSession, selectAnswer} from '../assets/integration/player-core.js';
import {saveCompletedAttempt} from '../assets/integration/module-store.js';
import {
  DAILY_STORAGE_KEY,
  MODULE_STORAGE_KEY,
  createLocalBackup,
  restoreLocalBackup,
} from '../assets/integration/local-backup.js';

class MemoryStorage {
  constructor(entries = {}) { this.map = new Map(Object.entries(entries)); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}

// 1) Aprendizado EDAS preservado no TDAS: item editorialmente suspeito não vira erro real.
const catalog = {
  catalogId: 'convergence-editorial-quarantine',
  peId: 'PE89',
  questions: [
    {id: 'q-annul', numeroOriginal: 1, materia: 'Teste', assunto: 'Integridade editorial', subassunto: 'Anulação', enunciado: 'Q1', alternativas: {A:'a',B:'b',C:'c',D:'d',E:'e'}},
    {id: 'q-source', numeroOriginal: 2, materia: 'Teste', assunto: 'Integridade editorial', subassunto: 'Fonte', enunciado: 'Q2', alternativas: {A:'a',B:'b',C:'c',D:'d',E:'e'}},
  ],
};
const answerKey = {material_id: catalog.catalogId, answers: [{id:'q-annul',gabarito:'A'},{id:'q-source',gabarito:'B'}]};
let session = createSession({id: catalog.catalogId, questoes: catalog.questions}, 1_000);
session = selectAnswer(session, 'q-annul', 'C', 2_000);
session = selectAnswer(session, 'q-source', 'D', 3_000);
const evaluation = evaluateSession(session, answerKey, 10_000);
const quarantineStorage = new MemoryStorage();
const quarantined = saveCompletedAttempt({
  catalog,
  evaluation,
  responseMeta: {
    'q-annul': {issue: 'annulment_pending'},
    'q-source': {issue: 'source_error'},
  },
}, quarantineStorage);
assert.equal(quarantined.state.errors.length, 0, 'Questão suspeita não pode entrar no Caderno como erro real.');
assert.equal(quarantined.state.aiQueue.length, 2, 'Questões suspeitas devem ir para a fila de validação.');
assert.equal(quarantined.state.reviews.length, 0, 'Questão editorialmente pendente não deve gerar revisão como se fosse erro do aluno.');
assert.deepEqual(new Set(quarantined.state.aiQueue.map(item => item.classification)), new Set(['annulment_pending', 'source_error']));
assert.equal(quarantined.attempt.localOnly, true);
assert.equal(quarantined.attempt.notionWriteback, false);

// 2) Aprendizado EDAS preservado no TDAS: restauração local é transacional e não deixa estado pela metade.
const daily = {version: 1, items: {PE89: {material: true, questions: true, registered: false, updatedAt: '2026-08-15T12:00:00-03:00'}}};
const moduleState = {schemaVersion: '2.0.0', updatedAt: 1, attempts: [], errors: [], marked: [], reviews: [], aiQueue: []};
const sourceStorage = new MemoryStorage({
  [DAILY_STORAGE_KEY]: JSON.stringify(daily),
  [MODULE_STORAGE_KEY]: JSON.stringify(moduleState),
});
const backup = createLocalBackup(sourceStorage, '2026-08-15T12:00:00-03:00');

class FailingStorage extends MemoryStorage {
  constructor(entries = {}) { super(entries); this.failModuleWrite = false; }
  setItem(key, value) {
    if (this.failModuleWrite && key === MODULE_STORAGE_KEY) throw new Error('falha simulada');
    super.setItem(key, value);
  }
}
const previousDaily = JSON.stringify({version: 1, items: {PE88: {material: true, questions: false, registered: false, updatedAt: null}}});
const previousModule = JSON.stringify({...moduleState, attempts: [{id: 'estado-anterior'}]});
const failing = new FailingStorage({[DAILY_STORAGE_KEY]: previousDaily, [MODULE_STORAGE_KEY]: previousModule});
failing.failModuleWrite = true;
assert.throws(() => restoreLocalBackup(backup, failing), /restauração foi revertida/i);
assert.equal(failing.getItem(DAILY_STORAGE_KEY), previousDaily, 'Rollback deve restaurar o progresso diário anterior.');
assert.equal(failing.getItem(MODULE_STORAGE_KEY), previousModule, 'Rollback deve restaurar o módulo anterior.');

// 3) Aprendizado EDAS preservado no TDAS: desempenho privado e evolução oficial continuam explicitamente separados.
const performanceUi = await fs.readFile('assets/integration/module-performance-v4.js', 'utf8');
assert.match(performanceUi, /Inteligência privada de estudo/);
assert.match(performanceUi, /registro oficial do Notion permanece separado/);
assert.match(performanceUi, /Estas métricas não alteram a Evolução oficial/);

// 4) Diferença intencional: o TDAS é diário. Não deve aceitar snapshot de outro dia apenas por haver "no_changes".
const publicationMonitor = await fs.readFile('scripts/monitor-tdas-publication.mjs', 'utf8');
assert.match(publicationMonitor, /SNAPSHOT_DATE_STALE/);
assert.match(publicationMonitor, /EXECUTION_DATE_STALE/);
assert.match(publicationMonitor, /snapshot técnico do site não corresponde à data atual/);

console.log('Convergência EDAS → TDAS protegida: quarentena editorial, rollback local, separação privado/oficial e frescor diário específico do TDAS.');
