import assert from 'node:assert/strict';
import {createSession,evaluateSession,selectAnswer} from '../assets/integration/player-core.js';
import {clearModuleState,readModuleState,saveCompletedAttempt,STORAGE_KEY} from '../assets/integration/module-store.js';

class MemoryStorage{
 constructor(entries={}){this.items=new Map(Object.entries(entries))}
 getItem(key){return this.items.has(key)?this.items.get(key):null}
 setItem(key,value){this.items.set(key,String(value))}
 removeItem(key){this.items.delete(key)}
}
const catalog={catalogId:'authorized-test-catalog',peId:'PE88',questions:[
 {id:'q1',numeroOriginal:1,assunto:'Teste',subassunto:'A',enunciado:'Q1',alternativas:{A:'a',B:'b',C:'c',D:'d',E:'e'}},
 {id:'q2',numero_original:2,assunto:'Teste',subassunto:'B',enunciado:'Q2',alternativas:{A:'a',B:'b',C:'c',D:'d',E:'e'}},
]};
const key={material_id:catalog.catalogId,answers:[{id:'q1',gabarito:'A'},{id:'q2',gabarito:'B'}]};
let session=createSession({id:catalog.catalogId,questoes:catalog.questions},1_000);
session=selectAnswer(session,'q1','A',2_000);session=selectAnswer(session,'q2','C',3_000);
const evaluation=evaluateSession(session,key,61_000),storage=new MemoryStorage();
const saved=saveCompletedAttempt({catalog,evaluation,responseMeta:{q1:{confidence:'doubt'},q2:{marked:true}}},storage);
assert.equal(saved.attempt.mode,'study');
assert.equal(saved.attempt.peId,'PE88');
assert.equal(saved.attempt.localOnly,true);
assert.equal(saved.attempt.persistent,false);
assert.equal(saved.attempt.cloudSync,false);
assert.equal(saved.attempt.notionWriteback,false);
assert.equal(saved.attempt.questionResults.find(item=>item.id==='q1').numeroOriginal,1,'Catálogo real em camelCase deve preservar numeroOriginal.');
assert.equal(saved.attempt.questionResults.find(item=>item.id==='q2').numeroOriginal,2,'Formato legado snake_case deve continuar suportado.');
assert.equal(saved.state.attempts.length,1);
assert.equal(saved.state.errors.length,1);
assert.equal(saved.state.marked.length,1);
assert.equal(saved.state.reviews.length,0);
assert.equal(saved.state.aiQueue.length,0);
assert.equal(storage.getItem(STORAGE_KEY),null,'Tentativa concluída não pode ser escrita no localStorage.');
const current=readModuleState(storage);
assert.equal(current.attempts.length,1,'Resultado recém-finalizado deve permanecer disponível em memória nesta página.');
assert.equal(current.attempts[0].id,saved.attempt.id);
assert.throws(()=>saveCompletedAttempt({catalog,evaluation,mode:'review'},storage),/não executa nem persiste revisão interna/i,'Store deve rejeitar qualquer tentativa de revisão interna.');
storage.setItem(STORAGE_KEY,JSON.stringify({legacy:true}));
clearModuleState(storage);
assert.equal(storage.getItem(STORAGE_KEY),null,'Limpeza deve remover eventual estado legado do navegador.');
assert.equal(readModuleState(storage).attempts.length,0,'Limpeza deve zerar também o estado efêmero atual.');
console.log('Módulo testado: estudo, correção separada, resultado efêmero, zero revisão interna e zero histórico persistente.');
