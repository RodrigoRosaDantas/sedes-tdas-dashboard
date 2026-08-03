import assert from 'node:assert/strict';
import { shouldRebuild } from './notion/sync-decision.mjs';

assert.equal(shouldRebuild({ previousHash: 'abc', nextHash: 'abc', syncKind: 'schedule' }), false);
assert.equal(shouldRebuild({ previousHash: 'abc', nextHash: 'def', syncKind: 'schedule' }), true);
assert.equal(shouldRebuild({ previousHash: 'abc', nextHash: 'abc', syncKind: 'push' }), true);
assert.equal(shouldRebuild({ previousHash: 'abc', nextHash: 'abc', syncKind: 'workflow_dispatch', forceRebuild: true }), true);
assert.equal(shouldRebuild({ previousHash: '', nextHash: 'abc', syncKind: 'schedule' }), true);

console.log('Decisão de sincronização testada: mudanças técnicas em push forçam reconstrução; rotinas sem mudança permanecem estáveis.');
