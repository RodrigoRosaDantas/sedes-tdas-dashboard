const JSON_TYPE='application/json; charset=utf-8';
const MAX_REQUEST_BYTES=48*1024;
const MAX_ITEMS_PER_REQUEST=96;
const MAX_ACCESS_JWT_BYTES=16*1024;
const MAX_JWKS_BYTES=64*1024;
const CLOCK_SKEW_SECONDS=60;
const VALID_ANSWER=new Set(['A','B','C','D','E','Certo','Errado']);
const ROLES=new Set(['api','auth']);
const encoder=new TextEncoder();
const decoder=new TextDecoder();

const text=value=>String(value??'').trim();
const nowSeconds=()=>Math.floor(Date.now()/1000);
const base64Url=bytes=>{
 let binary='';
 for(const byte of bytes)binary+=String.fromCharCode(byte);
 return btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
};
const randomToken=()=>{const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);return base64Url(bytes)};
const sha256=async value=>base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(String(value)))));
const fromBase64Url=value=>{
 const normalized=String(value).replaceAll('-','+').replaceAll('_','/'),padding='='.repeat((4-normalized.length%4)%4),binary=atob(normalized+padding),bytes=new Uint8Array(binary.length);
 for(let index=0;index<binary.length;index++)bytes[index]=binary.charCodeAt(index);
 return bytes;
};
class AccessTokenError extends Error{constructor(code,message){super(message);this.name='AccessTokenError';this.code=code}}
function accessConfig(env){
 let teamDomain;try{teamDomain=new URL(text(env.ACCESS_TEAM_DOMAIN))}catch{throw new AccessTokenError('ACCESS_NOT_CONFIGURED','Domínio do Cloudflare Access ausente.');}
 const audience=text(env.ACCESS_AUD);
 if(teamDomain.protocol!=='https:'||teamDomain.username||teamDomain.password||teamDomain.search||teamDomain.hash||teamDomain.pathname!=='/'||!teamDomain.hostname.endsWith('.cloudflareaccess.com')||!audience||/[<>]/.test(audience))throw new AccessTokenError('ACCESS_NOT_CONFIGURED','Configuração do Cloudflare Access inválida.');
 return{issuer:teamDomain.origin,audience,jwksUrl:`${teamDomain.origin}/cdn-cgi/access/certs`};
}
function parseJwtPart(value,label){
 if(!value||!/^[A-Za-z0-9_-]+$/.test(value))throw new AccessTokenError('ACCESS_TOKEN_INVALID',`${label} JWT inválido.`);
 try{const parsed=JSON.parse(decoder.decode(fromBase64Url(value)));if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('shape');return parsed}catch{throw new AccessTokenError('ACCESS_TOKEN_INVALID',`${label} JWT inválido.`)}
}
async function readJwks(url,fetchFn){
 let response;try{response=await fetchFn(url,{headers:{Accept:'application/json'},redirect:'error'})}catch{throw new AccessTokenError('ACCESS_KEYS_UNAVAILABLE','Chaves do Cloudflare Access indisponíveis.')}if(!response.ok)throw new AccessTokenError('ACCESS_KEYS_UNAVAILABLE','Chaves do Cloudflare Access indisponíveis.');
 const declared=Number(response.headers.get('Content-Length')||0);if(declared>MAX_JWKS_BYTES)throw new AccessTokenError('ACCESS_KEYS_UNAVAILABLE','Resposta de chaves excede o limite.');
 const body=await response.text();if(encoder.encode(body).byteLength>MAX_JWKS_BYTES)throw new AccessTokenError('ACCESS_KEYS_UNAVAILABLE','Resposta de chaves excede o limite.');
 try{const payload=JSON.parse(body);if(!Array.isArray(payload?.keys))throw new Error('shape');return payload.keys}catch{throw new AccessTokenError('ACCESS_KEYS_UNAVAILABLE','Resposta de chaves inválida.')}
}
export async function verifyAccessJwt(token,env,{fetchFn=fetch,now=nowSeconds()}={}){
 const raw=text(token);if(!raw||encoder.encode(raw).byteLength>MAX_ACCESS_JWT_BYTES)throw new AccessTokenError('ACCESS_TOKEN_INVALID','Token do Cloudflare Access ausente ou inválido.');
 const parts=raw.split('.');if(parts.length!==3)throw new AccessTokenError('ACCESS_TOKEN_INVALID','Token do Cloudflare Access inválido.');
 const[encodedHeader,encodedPayload,encodedSignature]=parts,header=parseJwtPart(encodedHeader,'Cabeçalho'),payload=parseJwtPart(encodedPayload,'Payload'),config=accessConfig(env);
 if(header.alg!=='RS256'||!text(header.kid))throw new AccessTokenError('ACCESS_TOKEN_INVALID','Algoritmo ou chave do token não autorizado.');
 const keys=await readJwks(config.jwksUrl,fetchFn),jwk=keys.find(item=>text(item?.kid)===text(header.kid)&&item?.kty==='RSA'&&(!item.alg||item.alg==='RS256')&&(!item.use||item.use==='sig'));if(!jwk)throw new AccessTokenError('ACCESS_TOKEN_INVALID','Chave de assinatura não reconhecida.');
 let key,signature;try{key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);signature=fromBase64Url(encodedSignature)}catch{throw new AccessTokenError('ACCESS_TOKEN_INVALID','Chave ou assinatura inválida.');}
 const verified=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,signature,encoder.encode(`${encodedHeader}.${encodedPayload}`));if(!verified)throw new AccessTokenError('ACCESS_TOKEN_INVALID','Assinatura do token inválida.');
 const audiences=Array.isArray(payload.aud)?payload.aud.map(text):[text(payload.aud)],expiresAt=Number(payload.exp),notBefore=payload.nbf==null?null:Number(payload.nbf),issuedAt=payload.iat==null?null:Number(payload.iat);
 if(text(payload.iss)!==config.issuer||!audiences.includes(config.audience)||payload.type!=='app'||!Number.isFinite(expiresAt)||expiresAt<=now-CLOCK_SKEW_SECONDS||(notBefore!=null&&(!Number.isFinite(notBefore)||notBefore>now+CLOCK_SKEW_SECONDS))||(issuedAt!=null&&(!Number.isFinite(issuedAt)||issuedAt>now+CLOCK_SKEW_SECONDS)))throw new AccessTokenError('ACCESS_TOKEN_INVALID','Claims do token não autorizados.');
 const subject=text(payload.sub||payload.email);if(!subject)throw new AccessTokenError('ACCESS_TOKEN_INVALID','Identidade autenticada ausente.');
 return{subject,email:text(payload.email)||null,expiresAt,payload};
}
const securityHeaders=()=>({
 'Cache-Control':'no-store, private, max-age=0',
 'Pragma':'no-cache',
 'Referrer-Policy':'no-referrer',
 'X-Content-Type-Options':'nosniff',
 'X-Frame-Options':'DENY'
});
function json(payload,{status=200,headers={}}={}){return new Response(JSON.stringify(payload),{status,headers:{...securityHeaders(),'Content-Type':JSON_TYPE,...headers}})}
function allowedOrigin(request,env){const origin=request.headers.get('Origin');return Boolean(origin&&origin===env.APP_ORIGIN)}
function corsHeaders(env){return{'Access-Control-Allow-Origin':env.APP_ORIGIN,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600','Vary':'Origin'}}
function apiError(code,message,status,env,details){return json({ok:false,error:{code,message,...(details?{details}: {})}},{status,headers:corsHeaders(env)})}
function validReturnUrl(value,env){
 try{const target=new URL(value||`${env.APP_ORIGIN}${env.APP_BASE_PATH}resolver/`);if(target.origin!==env.APP_ORIGIN||!target.pathname.startsWith(env.APP_BASE_PATH))return null;target.hash='';return target.href}catch{return null}
}
function bearerToken(request){const value=request.headers.get('Authorization')||'';const match=value.match(/^Bearer ([A-Za-z0-9_-]{40,80})$/);return match?.[1]||null}
function validKeyRef(value){return /^(?:daily\/tdas-pe\d+-[a-f0-9]{8,64}|master\/[a-z0-9][a-z0-9._-]{0,159})$/i.test(text(value))}
function parseCorrectionPayload(value,env){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError('Corpo JSON inválido.');
 if(value.schemaVersion!=='1.0.0')throw new TypeError('Versão da solicitação incompatível.');
 if(value.namespace!==env.ANSWER_KEY_NAMESPACE)throw new TypeError('Namespace de correção não autorizado.');
 const catalogId=text(value.catalogId),items=Array.isArray(value.items)?value.items:[];
 if(!catalogId||catalogId.length>180)throw new TypeError('Catálogo inválido.');
 if(!items.length||items.length>MAX_ITEMS_PER_REQUEST)throw new TypeError(`A solicitação deve conter de 1 a ${MAX_ITEMS_PER_REQUEST} questões.`);
 const seen=new Set(),normalized=items.map(item=>{const id=text(item?.id),keyRef=text(item?.keyRef);if(!id||id.length>180||!validKeyRef(keyRef))throw new TypeError('Referência de questão inválida.');if(seen.has(id))throw new TypeError(`Questão duplicada: ${id}.`);seen.add(id);return{id,keyRef}});
 return{schemaVersion:'1.0.0',namespace:value.namespace,catalogId,items:normalized};
}
async function readBoundedJson(request){
 const length=Number(request.headers.get('Content-Length')||0);if(length>MAX_REQUEST_BYTES)throw new RangeError('Solicitação muito grande.');
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type')||''))throw new TypeError('Content-Type deve ser application/json.');
 const body=await request.text();if(encoder.encode(body).byteLength>MAX_REQUEST_BYTES)throw new RangeError('Solicitação muito grande.');
 try{return JSON.parse(body)}catch{throw new TypeError('Corpo JSON inválido.')}
}
async function authenticate(request,env){
 const token=bearerToken(request);if(!token)return null;
 const tokenHash=await sha256(token),now=nowSeconds();
 const row=await env.ANSWER_KEYS.prepare('SELECT token_hash FROM access_sessions WHERE token_hash = ?1 AND revoked_at IS NULL AND expires_at > ?2').bind(tokenHash,now).first();
 return row?{tokenHash,now}:null;
}
async function issueSession(request,env,{fetchFn=fetch}={}){
 if(request.method!=='GET')return json({ok:false,error:{code:'METHOD_NOT_ALLOWED',message:'Método não permitido.'}},{status:405,headers:{Allow:'GET'}});
 let identity;try{identity=await verifyAccessJwt(request.headers.get('Cf-Access-Jwt-Assertion'),env,{fetchFn})}catch(error){const code=error instanceof AccessTokenError?error.code:'ACCESS_TOKEN_INVALID',status=code==='ACCESS_NOT_CONFIGURED'||code==='ACCESS_KEYS_UNAVAILABLE'?503:403;console.error(JSON.stringify({message:'access token rejected',code,error:error instanceof Error?error.message:String(error)}));return json({ok:false,error:{code,message:status===503?'A autorização privada ainda não está disponível.':'Autorização do Cloudflare Access inválida ou expirada.'}},{status})}
 const subject=identity.subject;
 const token=randomToken(),tokenHash=await sha256(token),subjectHash=await sha256(subject.toLowerCase()),now=nowSeconds(),ttl=Math.min(3600,Math.max(300,Number(env.SESSION_TTL_SECONDS)||1200)),expiresAt=now+ttl;
 await env.ANSWER_KEYS.batch([
  env.ANSWER_KEYS.prepare('DELETE FROM access_sessions WHERE expires_at <= ?1 OR revoked_at IS NOT NULL').bind(now),
  env.ANSWER_KEYS.prepare('INSERT INTO access_sessions (token_hash, subject_hash, created_at, expires_at, last_used_at) VALUES (?1, ?2, ?3, ?4, ?3)').bind(tokenHash,subjectHash,now,expiresAt),
  env.ANSWER_KEYS.prepare('UPDATE access_sessions SET revoked_at = ?1 WHERE subject_hash = ?2 AND revoked_at IS NULL AND expires_at > ?1 AND token_hash NOT IN (SELECT token_hash FROM access_sessions WHERE subject_hash = ?2 AND revoked_at IS NULL AND expires_at > ?1 ORDER BY created_at DESC, token_hash DESC LIMIT 5)').bind(now,subjectHash)
 ]);
 const returnTo=validReturnUrl(new URL(request.url).searchParams.get('return_to'),env)||`${env.APP_ORIGIN}${env.APP_BASE_PATH}resolver/`;
 const nonce=randomToken().slice(0,24),payload=JSON.stringify({type:'tdas-answer-key-session',token,expiresAt}).replaceAll('<','\\u003c'),redirect=`${returnTo}${returnTo.includes('?')?'&':'?'}answer_key_auth=complete#tdas_answer_key_session=${encodeURIComponent(token)}&expires_at=${expiresAt}`;
 const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Autorização TDAS concluída</title><style nonce="${nonce}">body{font:16px system-ui,sans-serif;max-width:42rem;margin:4rem auto;padding:1.5rem;color:#172033}a{color:#0759c7}code{word-break:break-all}</style></head><body><h1>Autorização concluída</h1><p>Você já pode voltar ao resolvedor. Esta sessão expira automaticamente em poucos minutos.</p><p><a href="${redirect.replaceAll('&','&amp;').replaceAll('"','&quot;')}">Voltar ao TDAS</a></p><script nonce="${nonce}">const payload=${payload};if(window.opener){window.opener.postMessage(payload,${JSON.stringify(env.APP_ORIGIN)});window.close()}else{location.replace(${JSON.stringify(redirect)})}</script></body></html>`;
 return new Response(html,{status:200,headers:{...securityHeaders(),'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':`default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`}});
}
async function corrections(request,env){
 if(request.method!=='POST')return apiError('METHOD_NOT_ALLOWED','Método não permitido.',405,env);
 if(!allowedOrigin(request,env))return apiError('ORIGIN_DENIED','Origem não autorizada.',403,env);
 const session=await authenticate(request,env);if(!session)return apiError('AUTH_REQUIRED','Autorização ausente, expirada ou revogada.',401,env);
 let parsed;try{parsed=parseCorrectionPayload(await readBoundedJson(request),env)}catch(error){const status=error instanceof RangeError?413:400;return apiError('INVALID_REQUEST',error instanceof Error?error.message:'Solicitação inválida.',status,env)}
 const placeholders=parsed.items.map((_,index)=>`?${index+2}`).join(', '),ids=parsed.items.map(item=>item.id),expected=new Map(parsed.items.map(item=>[item.id,item.keyRef]));
 const result=await env.ANSWER_KEYS.prepare(`SELECT i.key_ref, i.question_id, i.answer, i.details_json FROM answer_key_items i JOIN answer_key_sets s ON s.namespace = i.namespace AND s.key_ref = i.key_ref WHERE i.namespace = ?1 AND s.active = 1 AND i.question_id IN (${placeholders})`).bind(parsed.namespace,...ids).all();
 const answers=[];for(const row of result.results||[]){const id=text(row.question_id),keyRef=text(row.key_ref);if(expected.get(id)!==keyRef)continue;let details={};try{details=JSON.parse(text(row.details_json)||'{}')}catch{console.error(JSON.stringify({message:'invalid correction details',questionId:id,keyRef}))}const gabarito=text(row.answer);if(!VALID_ANSWER.has(gabarito))continue;answers.push({...details,id,gabarito})}
 const byId=new Map(answers.map(item=>[item.id,item])),ordered=parsed.items.map(item=>byId.get(item.id)).filter(Boolean),missing=parsed.items.filter(item=>!byId.has(item.id)).map(item=>item.id);
 if(missing.length)return apiError('CORRECTION_INCOMPLETE','A correção privada não contém todas as questões solicitadas.',409,env,{missingCount:missing.length});
 await env.ANSWER_KEYS.prepare('UPDATE access_sessions SET last_used_at = ?1 WHERE token_hash = ?2').bind(session.now,session.tokenHash).run();
 return json({ok:true,schemaVersion:'1.0.0',namespace:parsed.namespace,material_id:parsed.catalogId,answers:ordered},{headers:corsHeaders(env)});
}
async function revoke(request,env){
 if(request.method!=='POST')return apiError('METHOD_NOT_ALLOWED','Método não permitido.',405,env);
 if(!allowedOrigin(request,env))return apiError('ORIGIN_DENIED','Origem não autorizada.',403,env);
 const session=await authenticate(request,env);if(!session)return apiError('AUTH_REQUIRED','Autorização ausente, expirada ou revogada.',401,env);
 await env.ANSWER_KEYS.prepare('UPDATE access_sessions SET revoked_at = ?1 WHERE token_hash = ?2').bind(session.now,session.tokenHash).run();
 return json({ok:true},{headers:corsHeaders(env)});
}
async function health(env){
 try{const row=await env.ANSWER_KEYS.prepare('SELECT COUNT(*) AS total FROM answer_key_items i JOIN answer_key_sets s ON s.namespace = i.namespace AND s.key_ref = i.key_ref WHERE i.namespace = ?1 AND s.active = 1').bind(env.ANSWER_KEY_NAMESPACE).first();return json({ok:true,status:Number(row?.total)>0?'ready':'empty',namespace:env.ANSWER_KEY_NAMESPACE,answerCount:Number(row?.total)||0})}catch(error){console.error(JSON.stringify({message:'health check failed',error:error instanceof Error?error.message:String(error)}));return json({ok:false,status:'unavailable'},{status:503})}
}
async function handle(request,env){
 const url=new URL(request.url);
 const role=text(env.ROLE).toLowerCase();
 if(!ROLES.has(role))return json({ok:false,error:{code:'ROLE_NOT_CONFIGURED',message:'Função do serviço não configurada.'}},{status:503});
 if(role==='auth'){
  if(url.pathname==='/auth/session')return issueSession(request,env);
  return json({ok:false,error:{code:'NOT_FOUND',message:'Rota inexistente.'}},{status:404});
 }
 if(request.method==='OPTIONS'&&url.pathname.startsWith('/v1/')){if(!allowedOrigin(request,env))return new Response(null,{status:403,headers:securityHeaders()});return new Response(null,{status:204,headers:{...securityHeaders(),...corsHeaders(env)}})}
 if(url.pathname==='/healthz')return health(env);
 if(url.pathname==='/v1/corrections')return corrections(request,env);
 if(url.pathname==='/v1/session/revoke')return revoke(request,env);
 return json({ok:false,error:{code:'NOT_FOUND',message:'Rota inexistente.'}},{status:404});
}
export default{async fetch(request,env){try{return await handle(request,env)}catch(error){console.error(JSON.stringify({message:'unhandled request error',error:error instanceof Error?error.message:String(error),path:new URL(request.url).pathname}));return json({ok:false,error:{code:'INTERNAL_ERROR',message:'Falha interna do serviço.'}},{status:500})}}};
export{MAX_ITEMS_PER_REQUEST,handle,issueSession,parseCorrectionPayload,sha256,validKeyRef,validReturnUrl};
