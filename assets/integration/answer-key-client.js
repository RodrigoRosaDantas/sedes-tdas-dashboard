const BASE='/sedes-tdas-dashboard/';
const CONFIG_PATH='data/integration/answer-key-service.json';
const SESSION_KEY='tdas.202.answer-key.session.v1';
const CHUNK_SIZE=96;
const SAFE_LEGACY_PATH=/^data\/integration\/question-keys\/(?:[a-z0-9._-]+|master\/[a-z0-9._-]+)\.json$/i;
const SAFE_KEY_REF=/^(?:daily\/tdas-pe\d+-[a-f0-9]{8,64}|master\/[a-z0-9][a-z0-9._-]{0,159})$/i;
const TARGET_CARGO_CODE='202';
const TARGET_CARGO_NAME='TDAS — Técnico Administrativo';
let configPromise=null;

const text=value=>String(value??'').trim();
const storageOrNull=storage=>storage&&typeof storage.getItem==='function'&&typeof storage.setItem==='function'?storage:null;
const sessionStorageOrNull=()=>{try{return storageOrNull(globalThis.sessionStorage)}catch{return null}};
const copy=value=>value&&typeof value==='object'?JSON.parse(JSON.stringify(value)):value;
function validateConfig(value){
 if(!value||value.schemaVersion!=='1.0.0'||!['legacy-public','private'].includes(value.mode))throw new Error('Configuração do serviço de correção inválida.');
 if(value.namespace!=='tdas-cargo-202')throw new Error('Namespace do serviço de correção inválido.');
 if(value.mode==='private'){
  let endpoint,authEndpoint;try{endpoint=new URL(value.apiBaseUrl);authEndpoint=new URL(value.authBaseUrl)}catch{throw new Error('Endpoints privados de correção ausentes.');}
  if([endpoint,authEndpoint].some(url=>url.protocol!=='https:'||url.username||url.password||url.search||url.hash))throw new Error('Endpoint privado de correção inseguro.');
  if(endpoint.origin===authEndpoint.origin)throw new Error('Login e API privados precisam usar origens separadas.');
  if(value.publicFallbackAllowed!==false)throw new Error('O modo privado não pode permitir retorno ao gabarito público.');
  if(value.legacyPublicAllowedForNonTarget!==true)throw new Error('O modo privado deve declarar como tratar questões fora do TDAS 202.');
 }
 return Object.freeze({...value});
}
export async function prepareAnswerKeyClient({fetchFn=globalThis.fetch,base=BASE,force=false}={}){
 consumeAnswerKeySession();
 if(force||!configPromise)configPromise=Promise.resolve(fetchFn(base+CONFIG_PATH,{cache:'no-store'})).then(response=>{if(!response.ok)throw new Error(`Falha ao carregar configuração da correção (${response.status}).`);return response.json()}).then(validateConfig);
 return configPromise;
}
export function consumeAnswerKeySession({locationLike=globalThis.location,historyLike=globalThis.history,storage=sessionStorageOrNull()}={}){
 if(!locationLike)return false;const hash=String(locationLike.hash||'').replace(/^#/,'');if(!hash)return false;const params=new URLSearchParams(hash),token=text(params.get('tdas_answer_key_session')),expiresAt=Number(params.get('expires_at'));
 if(!/^[A-Za-z0-9_-]{40,80}$/.test(token)||!Number.isFinite(expiresAt)||expiresAt*1000<=Date.now())return false;
 let stored=false;try{storage?.setItem(SESSION_KEY,JSON.stringify({token,expiresAt}));stored=Boolean(storage)}catch{}params.delete('tdas_answer_key_session');params.delete('expires_at');
 if(historyLike?.replaceState){const url=new URL(locationLike.href);url.hash=params.toString();url.searchParams.delete('answer_key_auth');historyLike.replaceState(historyLike.state||null,'',url.href)}
 return stored;
}
export function readAnswerKeySession({storage=sessionStorageOrNull(),now=Date.now()}={}){
 if(!storage)return null;try{const value=JSON.parse(storage.getItem(SESSION_KEY)||'null'),expiresAt=Number(value?.expiresAt),token=text(value?.token);if(!/^[A-Za-z0-9_-]{40,80}$/.test(token)||!Number.isFinite(expiresAt)||expiresAt*1000<=now+5000){storage.removeItem(SESSION_KEY);return null}return{token,expiresAt}}catch{storage.removeItem(SESSION_KEY);return null}
}
export function clearAnswerKeySession({storage=sessionStorageOrNull()}={}){storage?.removeItem(SESSION_KEY)}
export class AnswerKeyAuthorizationRequired extends Error{constructor(message='Autorize a correção privada para ver o resultado.'){super(message);this.name='AnswerKeyAuthorizationRequired';this.code='ANSWER_KEY_AUTH_REQUIRED'}}
export const isAnswerKeyAuthorizationRequired=error=>error?.code==='ANSWER_KEY_AUTH_REQUIRED';
function questionKeyRef(question,catalog){const catalogDaily=/^tdas-pe\d+-[a-f0-9]{8,64}$/i.test(text(catalog?.catalogId))?`daily/${text(catalog.catalogId)}`:'';return text(question?.sourceKeyRef||catalog?.keyRef||catalogDaily||(question?.materialId?`master/${text(question.materialId)}`:''))}
export function catalogRequiresPrivateAnswerKey(catalog){return(catalog?.questions||[]).some(question=>{const keyRef=questionKeyRef(question,catalog);if(keyRef.startsWith('daily/'))return true;return keyRef.startsWith('master/')&&text(question?.codigoCargo??question?.codigo_cargo)===TARGET_CARGO_CODE&&text(question?.cargo)===TARGET_CARGO_NAME})}
export async function answerKeyAuthorizationRequired(catalog,options={}){const config=await prepareAnswerKeyClient(options);return config.mode==='private'&&catalogRequiresPrivateAnswerKey(catalog)&&!readAnswerKeySession(options)}

function authorizationUrl(config,returnTo){const endpoint=new URL(config.authPath||'/auth/session',config.authBaseUrl);endpoint.searchParams.set('return_to',returnTo);return endpoint}
export async function authorizeAnswerKeyAccess({returnTo=globalThis.location?.href||`${BASE}resolver/`,openFn=globalThis.open?.bind(globalThis),navigate=url=>globalThis.location?.assign?.(url),storage=sessionStorageOrNull(),fetchFn=globalThis.fetch,base=BASE,timeoutMs=120000,config:providedConfig=null}={}){
 const config=providedConfig?validateConfig(providedConfig):await prepareAnswerKeyClient({fetchFn,base});if(config.mode!=='private')return null;
 const endpoint=authorizationUrl(config,returnTo),authOrigin=new URL(config.authBaseUrl).origin,popup=typeof openFn==='function'?openFn(endpoint.href,'tdas-answer-key-auth','popup,width=520,height=700,resizable=yes,scrollbars=yes'):null;
 if(!popup){navigate?.(endpoint.href);return new Promise(()=>{})}
 return new Promise((resolve,reject)=>{
  let timer;const cleanup=()=>{globalThis.removeEventListener?.('message',onMessage);if(timer)clearTimeout(timer)};
  const onMessage=event=>{if(event.origin!==authOrigin||event.source!==popup||event.data?.type!=='tdas-answer-key-session')return;const token=text(event.data.token),expiresAt=Number(event.data.expiresAt);if(!/^[A-Za-z0-9_-]{40,80}$/.test(token)||!Number.isFinite(expiresAt)||expiresAt*1000<=Date.now()){cleanup();reject(new Error('A sessão de correção recebida é inválida.'));return}storage?.setItem(SESSION_KEY,JSON.stringify({token,expiresAt}));cleanup();try{popup.close()}catch{}resolve({expiresAt})};
  globalThis.addEventListener?.('message',onMessage);timer=setTimeout(()=>{cleanup();try{popup.close()}catch{}reject(new Error('A autorização expirou antes de ser concluída.'))},timeoutMs);
 });
}
function legacyPaths(catalog){return[...new Set((catalog?.questions||[]).map(question=>text(question.sourceKeyPath)).filter(Boolean).concat(text(catalog?.keyPath)||[]))].filter(Boolean)}
function privateItems(catalog){const seen=new Set();return(catalog?.questions||[]).map(question=>{const id=text(question?.id),derivedDaily=question?.sourceCatalogId?`daily/${text(question.sourceCatalogId)}`:'',keyRef=questionKeyRef(question,catalog)||derivedDaily;if(!id||seen.has(id)||!SAFE_KEY_REF.test(keyRef))throw new Error('O catálogo contém referência privada de correção inválida.');seen.add(id);return{id,keyRef}})}
function buildMergedKey(catalog,payloads){const map=new Map();for(const payload of payloads)for(const item of payload?.answers||[])if(item?.id)map.set(text(item.id),item);const answers=(catalog?.questions||[]).map(question=>map.get(text(question.id))).filter(Boolean);if(answers.length!==(catalog?.questions||[]).length)throw new Error('A correção recebida está incompleta.');return{schemaVersion:'1.1.0',material_id:catalog.catalogId,answers:answers.map(copy)}}
async function loadLegacy(catalog,{fetchFn,base}){const paths=legacyPaths(catalog);if(!paths.length||paths.some(path=>!SAFE_LEGACY_PATH.test(path)))throw new Error('O catálogo autorizado não possui caminho de correção válido.');const payloads=await Promise.all(paths.map(async path=>{const response=await fetchFn(base+path,{cache:'no-store'});if(!response.ok)throw new Error(`Falha ao carregar correção (${response.status}).`);return response.json()}));return buildMergedKey(catalog,payloads)}
async function loadPrivate(catalog,config,{fetchFn,storage}){
 const session=readAnswerKeySession({storage});if(!session)throw new AnswerKeyAuthorizationRequired();const endpoint=new URL(config.correctionsPath||'/v1/corrections',config.apiBaseUrl),items=privateItems(catalog),payloads=[];
 for(let offset=0;offset<items.length;offset+=CHUNK_SIZE){const chunk=items.slice(offset,offset+CHUNK_SIZE),response=await fetchFn(endpoint.href,{method:'POST',cache:'no-store',credentials:'omit',redirect:'error',headers:{Authorization:`Bearer ${session.token}`,'Content-Type':'application/json'},body:JSON.stringify({schemaVersion:'1.0.0',namespace:config.namespace,catalogId:catalog.catalogId,items:chunk})});let payload=null;try{payload=await response.json()}catch{}if(response.status===401){clearAnswerKeySession({storage});throw new AnswerKeyAuthorizationRequired()}if(!response.ok||payload?.ok!==true)throw new Error(payload?.error?.message||`Falha ao carregar correção privada (${response.status}).`);payloads.push(payload)}
 return buildMergedKey(catalog,payloads);
}
export async function loadAnswerKey(catalog,{fetchFn=globalThis.fetch,base=BASE,storage=sessionStorageOrNull(),config=null}={}){
 if(!catalog?.catalogId||!Array.isArray(catalog.questions)||!catalog.questions.length)throw new TypeError('Catálogo de correção inválido.');const service=config?validateConfig(config):await prepareAnswerKeyClient({fetchFn,base});if(service.mode==='private'){const privateQuestions=[],legacyQuestions=[];for(const question of catalog.questions)(catalogRequiresPrivateAnswerKey({...catalog,questions:[question]})?privateQuestions:legacyQuestions).push(question);const payloads=[];if(privateQuestions.length)payloads.push(await loadPrivate({...catalog,questions:privateQuestions},service,{fetchFn,storage}));if(legacyQuestions.length){if(service.legacyPublicAllowedForNonTarget!==true)throw new Error('Correção fora do TDAS 202 indisponível neste serviço.');payloads.push(await loadLegacy({...catalog,keyPath:null,questions:legacyQuestions},{fetchFn,base}))}return buildMergedKey(catalog,payloads)}if(service.publicFallbackAllowed!==true)throw new Error('Fallback público de correção desativado.');return loadLegacy(catalog,{fetchFn,base});
}
export{CHUNK_SIZE,CONFIG_PATH,SESSION_KEY,TARGET_CARGO_CODE,TARGET_CARGO_NAME};
