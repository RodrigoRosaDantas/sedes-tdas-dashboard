import {PRIVATE_HISTORY_CONFIG} from '../assets/integration/private-history-config.js';

const config=PRIVATE_HISTORY_CONFIG?.firebaseConfig||{};
const apiKey=String(config.apiKey||'').trim();
const projectId=String(config.projectId||'').trim();
if(!apiKey||!projectId)throw new Error('Firestore E2E TDAS: configuração Firebase incompleta.');

const nonce=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
const email=`tdas-firestore-ci-${nonce}@example.invalid`;
const password=`Tdas-CI-${nonce}-Aa9!`;
const authBase='https://identitytoolkit.googleapis.com/v1/accounts';
const docsBase=`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents`;
let idToken='',uid='',ownUrl='';

async function jsonResponse(response){return response.json().catch(()=>({}));}
async function authPost(action,body){
 const response=await fetch(`${authBase}:${action}?key=${encodeURIComponent(apiKey)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 const payload=await jsonResponse(response);
 if(!response.ok)throw new Error(`Firestore E2E TDAS: Firebase Auth ${action} falhou (${response.status}: ${payload?.error?.message||'sem código'}).`);
 return payload;
}
async function firestore(url,{method='GET',token=idToken,body}={}){
 const headers={};
 if(token)headers.authorization=`Bearer ${token}`;
 if(body!==undefined)headers['content-type']='application/json';
 const response=await fetch(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 return {response,payload:await jsonResponse(response)};
}

try{
 const account=await authPost('signUp',{email,password,returnSecureToken:true});
 idToken=String(account.idToken||'');
 uid=String(account.localId||'');
 if(!idToken||!uid)throw new Error('Firestore E2E TDAS: Auth não retornou token/UID.');

 const docId=`probe-${nonce}`;
 ownUrl=`${docsBase}/users/${encodeURIComponent(uid)}/ci/${encodeURIComponent(docId)}`;
 const ownBody={fields:{kind:{stringValue:'tdas-private-history-e2e'},nonce:{stringValue:nonce},createdAt:{timestampValue:new Date().toISOString()}}};
 const ownWrite=await firestore(ownUrl,{method:'PATCH',body:ownBody});
 if(!ownWrite.response.ok)throw new Error(`Firestore E2E TDAS: escrita no próprio UID negada (${ownWrite.response.status}: ${ownWrite.payload?.error?.status||ownWrite.payload?.error?.message||'sem código'}). Regras publicadas podem não corresponder ao contrato do repositório.`);

 const ownRead=await firestore(ownUrl);
 if(!ownRead.response.ok)throw new Error(`Firestore E2E TDAS: leitura no próprio UID falhou (${ownRead.response.status}: ${ownRead.payload?.error?.status||ownRead.payload?.error?.message||'sem código'}).`);
 if(ownRead.payload?.fields?.nonce?.stringValue!==nonce)throw new Error('Firestore E2E TDAS: documento próprio retornou conteúdo inesperado.');

 const unauthRead=await firestore(ownUrl,{token:''});
 if(unauthRead.response.status!==403)throw new Error(`Firestore E2E TDAS: leitura sem autenticação deveria ser negada com 403, recebeu ${unauthRead.response.status}. Regras de produção estão permissivas.`);

 const foreignUrl=`${docsBase}/users/tdas-ci-foreign-${encodeURIComponent(nonce)}/ci/${encodeURIComponent(docId)}`;
 const foreignWrite=await firestore(foreignUrl,{method:'PATCH',body:ownBody});
 if(foreignWrite.response.status!==403)throw new Error(`Firestore E2E TDAS: escrita fora do próprio UID deveria ser negada com 403, recebeu ${foreignWrite.response.status}. Isolamento por usuário não está efetivo.`);

 console.log('Firestore E2E TDAS: Auth, leitura/escrita própria e isolamento por UID validados em produção.');
}finally{
 if(ownUrl&&idToken){
  try{await firestore(ownUrl,{method:'DELETE'});}catch{}
 }
 if(idToken){
  try{await authPost('delete',{idToken});}catch(error){console.error(`Firestore E2E TDAS: alerta de limpeza da conta sintética (${error.message}).`);}
 }
}
