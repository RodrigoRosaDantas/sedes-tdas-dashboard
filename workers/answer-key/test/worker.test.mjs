import assert from'node:assert/strict';
import worker,{MAX_ITEMS_PER_REQUEST,issueSession,parseCorrectionPayload,sha256,validKeyRef,validReturnUrl,verifyAccessJwt}from'../src/index.js';

const now=Math.floor(Date.now()/1000);
const env={ROLE:'api',APP_ORIGIN:'https://rodrigorosadantas.github.io',APP_BASE_PATH:'/sedes-tdas-dashboard/',ANSWER_KEY_NAMESPACE:'tdas-cargo-202',SESSION_TTL_SECONDS:'1200',ACCESS_TEAM_DOMAIN:'https://tdas-test.cloudflareaccess.com',ACCESS_AUD:'tdas-test-audience'};
const encode=value=>Buffer.from(typeof value==='string'?value:JSON.stringify(value)).toString('base64url');
const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const publicJwk={...await crypto.subtle.exportKey('jwk',keys.publicKey),kid:'test-key',alg:'RS256',use:'sig'};
async function accessToken(overrides={}){const header={alg:'RS256',kid:'test-key',typ:'JWT'},payload={iss:env.ACCESS_TEAM_DOMAIN,aud:[env.ACCESS_AUD],type:'app',sub:'subject-123',email:'rodrigo@example.com',iat:now-5,nbf:now-5,exp:now+600,...overrides},unsigned=`${encode(header)}.${encode(payload)}`,signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,Buffer.from(unsigned));return`${unsigned}.${Buffer.from(signature).toString('base64url')}`}
const jwksFetch=async(url,init)=>{assert.equal(url,`${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`);assert.equal(init.redirect,'error');return new Response(JSON.stringify({keys:[publicJwk]}),{headers:{'Content-Type':'application/json'}})};
function fakeDb(){const batches=[];return{batches,prepare(sql){return{sql,values:[],bind(...values){this.values=values;return this},first:async()=>null,all:async()=>({results:[]}),run:async()=>({success:true})}},async batch(statements){batches.push(statements.map(item=>({sql:item.sql,values:item.values})));return statements.map(()=>({success:true}))}}}

assert.equal(validKeyRef('daily/tdas-pe101-bc2c9589ce55'),true);
assert.equal(validKeyRef('master/sim-emilia-2026-tdas-leg01'),true);
assert.equal(validKeyRef('master/../edas-key'),false);
assert.equal(validKeyRef('edas/master-key'),false);
assert.equal(validReturnUrl('https://rodrigorosadantas.github.io/sedes-tdas-dashboard/resolver/?modo=banco',env),'https://rodrigorosadantas.github.io/sedes-tdas-dashboard/resolver/?modo=banco');
assert.equal(validReturnUrl('https://evil.example/sedes-tdas-dashboard/resolver/',env),null);
assert.equal((await sha256('session-token')).length,43);
const parsed=parseCorrectionPayload({schemaVersion:'1.0.0',namespace:'tdas-cargo-202',catalogId:'catalog',items:[{id:'PE101-Q001',keyRef:'daily/tdas-pe101-bc2c9589ce55'}]},env);
assert.equal(parsed.items.length,1);
assert.throws(()=>parseCorrectionPayload({schemaVersion:'1.0.0',namespace:'edas-cargo-400',catalogId:'x',items:[{id:'x',keyRef:'master/x'}]},env),/Namespace/);
assert.throws(()=>parseCorrectionPayload({schemaVersion:'1.0.0',namespace:'tdas-cargo-202',catalogId:'x',items:Array.from({length:MAX_ITEMS_PER_REQUEST+1},(_,index)=>({id:`Q${index}`,keyRef:'master/x'}))},env),/de 1 a/);

const token=await accessToken(),identity=await verifyAccessJwt(token,env,{fetchFn:jwksFetch,now});
assert.equal(identity.subject,'subject-123');assert.equal(identity.email,'rodrigo@example.com');
const wrongAudienceToken=await accessToken({aud:['wrong-audience']});
const expiredToken=await accessToken({exp:now-120});
await assert.rejects(()=>verifyAccessJwt(wrongAudienceToken,env,{fetchFn:jwksFetch,now}),/Claims/);
await assert.rejects(()=>verifyAccessJwt(expiredToken,env,{fetchFn:jwksFetch,now}),/Claims/);
const tampered=token.split('.');tampered[1]=encode({...JSON.parse(Buffer.from(tampered[1],'base64url')),email:'attacker@example.com'});await assert.rejects(()=>verifyAccessJwt(tampered.join('.'),env,{fetchFn:jwksFetch,now}),/Assinatura/);

const noConfig=await issueSession(new Request('https://worker.example/auth/session',{headers:{'Cf-Access-Jwt-Assertion':token}}),{...env,ROLE:'auth',ACCESS_TEAM_DOMAIN:'',ANSWER_KEYS:fakeDb()});assert.equal(noConfig.status,503);assert.equal((await noConfig.json()).error.code,'ACCESS_NOT_CONFIGURED');
const missingAccess=await worker.fetch(new Request('https://worker.example/auth/session'),{...env,ROLE:'auth',ANSWER_KEYS:fakeDb()});assert.equal(missingAccess.status,403);assert.equal((await missingAccess.json()).error.code,'ACCESS_TOKEN_INVALID');
const db=fakeDb(),authorized=await issueSession(new Request('https://worker.example/auth/session?return_to=https%3A%2F%2Frodrigorosadantas.github.io%2Fsedes-tdas-dashboard%2Fresolver%2F',{headers:{'Cf-Access-Jwt-Assertion':token}}),{...env,ANSWER_KEYS:db},{fetchFn:jwksFetch});
assert.equal(authorized.status,200);const html=await authorized.text();assert.match(html,/Autorização concluída/);assert.match(authorized.headers.get('Content-Security-Policy'),/default-src 'none'/);assert.equal(db.batches.length,1);assert.equal(db.batches[0].length,3);const issuedToken=html.match(/"token":"([A-Za-z0-9_-]+)"/)?.[1];assert.equal(issuedToken?.length,43);assert.ok(!JSON.stringify(db.batches).includes(issuedToken),'D1 deve armazenar somente o hash da sessão.');

const authCannotCorrect=await worker.fetch(new Request('https://worker.example/v1/corrections',{method:'POST',headers:{Origin:env.APP_ORIGIN,'Content-Type':'application/json'},body:'{}'}),{...env,ROLE:'auth',ANSWER_KEYS:fakeDb()});assert.equal(authCannotCorrect.status,404);
const apiCannotIssueSession=await worker.fetch(new Request('https://worker.example/auth/session'),{...env,ANSWER_KEYS:fakeDb()});assert.equal(apiCannotIssueSession.status,404);

const wrongOrigin=await worker.fetch(new Request('https://worker.example/v1/corrections',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'}),{...env,ANSWER_KEYS:fakeDb()});assert.equal(wrongOrigin.status,403);assert.equal((await wrongOrigin.json()).error.code,'ORIGIN_DENIED');
const preflight=await worker.fetch(new Request('https://worker.example/v1/corrections',{method:'OPTIONS',headers:{Origin:env.APP_ORIGIN}}),{...env,ANSWER_KEYS:fakeDb()});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),env.APP_ORIGIN);
const notFound=await worker.fetch(new Request('https://worker.example/public-key.json'),{...env,ANSWER_KEYS:fakeDb()});assert.equal(notFound.status,404);assert.match(notFound.headers.get('Cache-Control'),/no-store/);

console.log('Worker privado validado: JWT Access verificado por assinatura/claims, origem estrita, namespace TDAS e nenhuma rota pública de gabarito.');
