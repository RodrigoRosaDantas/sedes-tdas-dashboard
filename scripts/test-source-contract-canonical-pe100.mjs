import assert from 'node:assert/strict';
import {buildContractAssessment} from './notion/source-contract-policy.mjs';

const control={pe:'PE100',date:'2026-08-25',planned_questions:60,status:'Planejado'};
const micro={pe:'PE100',date:'2026-08-25',expectation:{mode:'strict',min:51,max:51}};
const catalog={
 peId:'PE100',
 questionCount:60,
 authorizedSource:{
  type:'notion-daily-child-page',
  pageId:'child-pe100',
  primaryPageId:'primary-pe100',
  url:'https://app.notion.com/p/pe100',
  resolution:'validated-child-page'
 }
};

const accepted=buildContractAssessment({controls:[control],microDays:[micro],catalog,currentPe:'PE100',snapshotDate:'2026-08-25'});
assert.equal(accepted.status,'ready_with_warnings');
assert.equal(accepted.current.status,'ready');
assert.deepEqual(accepted.current.conflicts.map(item=>item.code),[
 'canonical_control_overrides_micro',
 'canonical_catalog_overrides_micro'
]);
assert.ok(accepted.current.conflicts.every(item=>item.severity==='warning'));

const badCatalog={...catalog,questionCount:59};
const blocked=buildContractAssessment({controls:[control],microDays:[micro],catalog:badCatalog,currentPe:'PE100',snapshotDate:'2026-08-25'});
assert.equal(blocked.status,'blocked');
assert.equal(blocked.current.status,'blocked');
assert.ok(blocked.current.conflicts.some(item=>item.code==='control_vs_micro'&&item.severity==='critical'));
assert.ok(blocked.current.conflicts.some(item=>item.code==='catalog_vs_micro'&&item.severity==='critical'));

console.log('Contrato canônico PE100: concordância rastreável aceita; divergência real permanece bloqueante.');
