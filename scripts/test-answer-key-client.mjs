import assert from'node:assert/strict';
import{AnswerKeyAuthorizationRequired,CHUNK_SIZE,SESSION_KEY,catalogRequiresPrivateAnswerKey,consumeAnswerKeySession,loadAnswerKey,readAnswerKeySession}from'../assets/integration/answer-key-client.js';

const memory=()=>{const values=new Map();return{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)}};
const legacyCatalog={catalogId:'legacy',keyPath:'data/integration/question-keys/pe101.json',questions:[{id:'Q1'},{id:'Q2'}]};
const legacy=await loadAnswerKey(legacyCatalog,{config:{schemaVersion:'1.0.0',mode:'legacy-public',namespace:'tdas-cargo-202',publicFallbackAllowed:true},base:'',fetchFn:async url=>({ok:url.endsWith('pe101.json'),status:200,json:async()=>({answers:[{id:'Q1',gabarito:'A'},{id:'Q2',gabarito:'B'}]})})});
assert.deepEqual(legacy.answers.map(item=>item.gabarito),['A','B']);

const privateConfig={schemaVersion:'1.0.0',mode:'private',apiBaseUrl:'https://keys.example.workers.dev',authBaseUrl:'https://keys-auth.example.workers.dev',namespace:'tdas-cargo-202',authPath:'/auth/session',correctionsPath:'/v1/corrections',publicFallbackAllowed:false,legacyPublicAllowedForNonTarget:true};
const privateCatalog={catalogId:'tdas-pe101-abcdef123456',keyRef:'daily/tdas-pe101-abcdef123456',questions:Array.from({length:CHUNK_SIZE+4},(_,index)=>({id:`Q${index+1}`}))},storage=memory();
assert.equal(catalogRequiresPrivateAnswerKey(privateCatalog),true);
assert.equal(catalogRequiresPrivateAnswerKey({catalogId:'bank',questions:[{id:'TDAS-1',sourceKeyRef:'master/tdas-one',codigoCargo:'202',cargo:'TDAS — Técnico Administrativo'}]}),true);
assert.equal(catalogRequiresPrivateAnswerKey({catalogId:'bank',questions:[{id:'EDAS-1',sourceKeyRef:'master/edas-one',sourceKeyPath:'data/integration/question-keys/master/edas-one.json',codigoCargo:'400',cargo:'EDAS — Administração'}]}),false);
await assert.rejects(()=>loadAnswerKey(privateCatalog,{config:privateConfig,storage,fetchFn:async()=>{throw new Error('não deve buscar')}}),AnswerKeyAuthorizationRequired);
storage.setItem(SESSION_KEY,JSON.stringify({token:'a'.repeat(43),expiresAt:Math.floor(Date.now()/1000)+600}));let requests=0;
const privateKey=await loadAnswerKey(privateCatalog,{
 config:privateConfig,
 storage,
 fetchFn:async(url,init)=>{
  requests++;
  assert.equal(url,'https://keys.example.workers.dev/v1/corrections');
  assert.equal(init.credentials,'omit');
  assert.equal(init.headers.Authorization,`Bearer ${'a'.repeat(43)}`);
  const body=JSON.parse(init.body);assert.ok(body.items.length<=CHUNK_SIZE);
  return{ok:true,status:200,json:async()=>({ok:true,answers:body.items.map(item=>({id:item.id,gabarito:'C'}))})};
 }
});
assert.equal(requests,2,'Lotes grandes precisam ser particionados para respeitar limites do D1.');assert.equal(privateKey.answers.length,CHUNK_SIZE+4);

const hybridCatalog={catalogId:'tdas-bank-mixed',questions:[{id:'TDAS-1',sourceKeyRef:'master/tdas-one',sourceKeyPath:'data/integration/question-keys/master/tdas-one.json',codigoCargo:'202',cargo:'TDAS — Técnico Administrativo'},{id:'EDAS-1',sourceKeyRef:'master/edas-one',sourceKeyPath:'data/integration/question-keys/master/edas-one.json',codigoCargo:'400',cargo:'EDAS — Administração'}]},hybridCalls=[];
const hybridKey=await loadAnswerKey(hybridCatalog,{config:privateConfig,storage,base:'',fetchFn:async(url,init={})=>{hybridCalls.push(url);if(url.endsWith('/v1/corrections')){const body=JSON.parse(init.body);assert.deepEqual(body.items,[{id:'TDAS-1',keyRef:'master/tdas-one'}]);return{ok:true,status:200,json:async()=>({ok:true,answers:[{id:'TDAS-1',gabarito:'A'}]})}}assert.equal(url,'data/integration/question-keys/master/edas-one.json');return{ok:true,status:200,json:async()=>({answers:[{id:'EDAS-1',gabarito:'B'}]})}}});
assert.deepEqual(hybridKey.answers.map(item=>item.gabarito),['A','B']);assert.equal(hybridCalls.length,2,'Bateria mista deve privatizar somente o TDAS 202 e preservar os demais cargos.');

const fragmentStorage=memory(),locationLike={href:'https://rodrigorosadantas.github.io/sedes-tdas-dashboard/resolver/?answer_key_auth=complete#tdas_answer_key_session='+encodeURIComponent('b'.repeat(43))+'&expires_at='+(Math.floor(Date.now()/1000)+300),hash:''};locationLike.hash=new URL(locationLike.href).hash;let replaced='';
assert.equal(consumeAnswerKeySession({locationLike,historyLike:{state:null,replaceState:(_state,_title,url)=>{replaced=url}},storage:fragmentStorage}),true);assert.equal(readAnswerKeySession({storage:fragmentStorage})?.token,'b'.repeat(43));assert.ok(!replaced.includes('tdas_answer_key_session'),'Token deve ser removido imediatamente da URL.');assert.ok(!replaced.includes('answer_key_auth'),'Sinal de retorno deve ser removido da URL.');
let unavailableStorageReplacement='';assert.equal(consumeAnswerKeySession({locationLike,historyLike:{state:null,replaceState:(_state,_title,url)=>{unavailableStorageReplacement=url}},storage:null}),false);assert.ok(!unavailableStorageReplacement.includes('tdas_answer_key_session'),'O token deve sair da URL mesmo quando o armazenamento da sessão estiver indisponível.');
await assert.rejects(()=>loadAnswerKey(privateCatalog,{config:{...privateConfig,publicFallbackAllowed:true},storage}),/modo privado/);
await assert.rejects(()=>loadAnswerKey(privateCatalog,{config:{...privateConfig,authBaseUrl:privateConfig.apiBaseUrl},storage}),/origens separadas/);

console.log('Cliente de correção validado: fallback controlado, sessão curta, lotes privados e token removido da URL.');
