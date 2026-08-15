import {PRIVATE_HISTORY_CONFIG} from '../assets/integration/private-history-config.js';

const config=PRIVATE_HISTORY_CONFIG?.firebaseConfig||{};
const required=['apiKey','authDomain','projectId','appId'];
for(const field of required)if(!String(config[field]||'').trim())throw new Error(`Firebase TDAS: ${field} ausente.`);
if(config.projectId!=='tdas-68014')throw new Error(`Firebase TDAS: projectId inesperado (${config.projectId}).`);
if(config.authDomain!==`${config.projectId}.firebaseapp.com`)throw new Error('Firebase TDAS: authDomain não corresponde ao projeto.');
if(!String(config.appId).startsWith('1:878689644837:web:'))throw new Error('Firebase TDAS: appId não corresponde ao app Web esperado.');

const email=`tdas-ci-${Date.now()}-${Math.random().toString(36).slice(2)}@example.invalid`;
const endpoint=`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(config.apiKey)}`;
let response,payload;
try{
 response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password:'tdas-ci-invalid-password-2026',returnSecureToken:true}),signal:AbortSignal.timeout(12000)});
 payload=await response.json().catch(()=>({}));
}catch(error){throw new Error(`Firebase TDAS: não foi possível alcançar o Authentication (${error?.message||error}).`)}
if(response.ok)throw new Error('Firebase TDAS: credencial sintética autenticou inesperadamente.');
const message=String(payload?.error?.message||'').trim();
const validNegative=new Set(['EMAIL_NOT_FOUND','INVALID_PASSWORD','INVALID_LOGIN_CREDENTIALS','TOO_MANY_ATTEMPTS_TRY_LATER']);
if(!validNegative.has(message))throw new Error(`Firebase TDAS: Authentication não passou no smoke real (${response.status}: ${message||'erro sem código'}).`);
console.log(`Firebase Authentication alcançável e Web API Key aceita (${message}).`);
