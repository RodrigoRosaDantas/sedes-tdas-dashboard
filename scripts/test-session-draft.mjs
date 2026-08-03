import assert from 'node:assert/strict';
import {clearSessionDraft,matchingSessionDraft,readSessionDraft,STORAGE_KEY,writeSessionDraft} from '../assets/integration/session-draft.js';

class MemoryStorage{constructor(){this.map=new Map()}getItem(key){return this.map.has(key)?this.map.get(key):null}setItem(key,value){this.map.set(key,String(value))}removeItem(key){this.map.delete(key)}}
const storage=new MemoryStorage();
const catalog={catalogId:'daily:PE78',peId:'PE78',questions:[{id:'q1'},{id:'q2'},{id:'q3'}]};
const session={schemaVersion:'1.0.0',materialId:catalog.catalogId,questionIds:['q1','q2','q3'],answers:{q1:'A',q2:'Z'},currentIndex:1,startedAt:1000,updatedAt:2000,finishedAt:null};
const saved=writeSessionDraft({catalogId:catalog.catalogId,peId:catalog.peId,session,responseMeta:{q1:{confidence:'doubt',marked:true,issue:'none'}}},storage);
assert.equal(saved.session.answers.q1,'A');
assert.equal(saved.session.answers.q2,undefined);
assert.equal(readSessionDraft(storage).session.currentIndex,1);
assert.equal(matchingSessionDraft(catalog,storage).responseMeta.q1.confidence,'doubt');
assert.equal(matchingSessionDraft({...catalog,catalogId:'outro'},storage),null);
assert.ok(storage.getItem(STORAGE_KEY));
clearSessionDraft(storage);
assert.equal(readSessionDraft(storage),null);
console.log('Rascunho local validado: respostas, posição e metadados retomáveis; dados inválidos descartados; limpeza atômica.');
