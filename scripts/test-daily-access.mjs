import assert from 'node:assert/strict';
import {isDailyContentPermissionError,pendingDailySemantic} from './notion/daily-access.mjs';

assert.equal(isDailyContentPermissionError(new Error('Notion API 404 em /blocks/x: object_not_found; shared with your integration "TDAS Dashboard Sync".')),true);
assert.equal(isDailyContentPermissionError(new Error('Notion API 429: rate_limited')),false);
assert.equal(isDailyContentPermissionError(new Error('PE78: gabarito possui 47 respostas para 48 questões.')),false);
assert.deepEqual(pendingDailySemantic({pe:'PE78',materialsRootId:'mat',questionsRootId:'q'}),{
 status:'pending_permission',pe:'PE78',integration:'TDAS Dashboard Sync',roots:{materials:'mat',questions:'q'}
});
console.log('Permissão diária testada: 404 de compartilhamento vira pendência; erros reais continuam bloqueadores.');
