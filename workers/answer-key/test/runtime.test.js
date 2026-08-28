import {env} from 'cloudflare:workers';
import {beforeEach,describe,expect,it} from 'vitest';
import worker,{sha256} from '../src/index.js';

const ORIGIN='https://rodrigorosadantas.github.io';
const NAMESPACE='tdas-cargo-202';
const KEY_REF='daily/tdas-pe101-bc2c9589ce55';
const TOKEN='t'.repeat(43);
const apiEnv=()=>({...env,ROLE:'api',APP_ORIGIN:ORIGIN,APP_BASE_PATH:'/sedes-tdas-dashboard/',ANSWER_KEY_NAMESPACE:NAMESPACE,SESSION_TTL_SECONDS:'1200'});

async function seed(){
 const now=Math.floor(Date.now()/1000),tokenHash=await sha256(TOKEN);
 await env.ANSWER_KEYS.batch([
  env.ANSWER_KEYS.prepare('INSERT INTO answer_key_sets (namespace, key_ref, material_id, content_hash, question_count, active, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6)').bind(NAMESPACE,KEY_REF,'tdas-pe101-bc2c9589ce55','hash',2,now),
  env.ANSWER_KEYS.prepare('INSERT INTO answer_key_items (namespace, key_ref, question_id, answer, details_json) VALUES (?1, ?2, ?3, ?4, ?5)').bind(NAMESPACE,KEY_REF,'PE101-Q001','C',JSON.stringify({fundamento:'Regra auditada'})),
  env.ANSWER_KEYS.prepare('INSERT INTO answer_key_items (namespace, key_ref, question_id, answer, details_json) VALUES (?1, ?2, ?3, ?4, ?5)').bind(NAMESPACE,KEY_REF,'PE101-Q002','A','{}'),
  env.ANSWER_KEYS.prepare('INSERT INTO access_sessions (token_hash, subject_hash, created_at, expires_at, last_used_at) VALUES (?1, ?2, ?3, ?4, ?3)').bind(tokenHash,await sha256('subject'),now,now+600)
 ]);
}

function correctionRequest(items,token=TOKEN){return new Request('https://api.example/v1/corrections',{method:'POST',headers:{Origin:ORIGIN,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({schemaVersion:'1.0.0',namespace:NAMESPACE,catalogId:'catalog-test',items})})}

beforeEach(async()=>{
 await env.ANSWER_KEYS.batch([
  env.ANSWER_KEYS.prepare('DELETE FROM answer_key_items'),
  env.ANSWER_KEYS.prepare('DELETE FROM answer_key_sets'),
  env.ANSWER_KEYS.prepare('DELETE FROM access_sessions')
 ]);
 await seed();
});

describe('API privada de gabaritos',()=>{
 it('serve a correção completa em D1 e preserva a ordem solicitada',async()=>{
  const response=await worker.fetch(correctionRequest([{id:'PE101-Q002',keyRef:KEY_REF},{id:'PE101-Q001',keyRef:KEY_REF}]),apiEnv());
  expect(response.status).toBe(200);
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
  expect(response.headers.get('Cache-Control')).toContain('no-store');
  const payload=await response.json();
  expect(payload.answers.map(item=>item.id)).toEqual(['PE101-Q002','PE101-Q001']);
  expect(payload.answers[1]).toMatchObject({gabarito:'C',fundamento:'Regra auditada'});
 });

 it('falha fechado para token, origem, referência ou item ausente',async()=>{
  expect((await worker.fetch(correctionRequest([{id:'PE101-Q001',keyRef:KEY_REF}],'x'.repeat(43)),apiEnv())).status).toBe(401);
  const wrongOrigin=correctionRequest([{id:'PE101-Q001',keyRef:KEY_REF}]);wrongOrigin.headers.set('Origin','https://evil.example');
  expect((await worker.fetch(wrongOrigin,apiEnv())).status).toBe(403);
  expect((await worker.fetch(correctionRequest([{id:'PE101-Q001',keyRef:'master/wrong-set'}]),apiEnv())).status).toBe(409);
  expect((await worker.fetch(correctionRequest([{id:'PE101-Q999',keyRef:KEY_REF}]),apiEnv())).status).toBe(409);
 });

 it('revoga a sessão e bloqueia reutilização',async()=>{
  const revoke=new Request('https://api.example/v1/session/revoke',{method:'POST',headers:{Origin:ORIGIN,Authorization:`Bearer ${TOKEN}`}});
  expect((await worker.fetch(revoke,apiEnv())).status).toBe(200);
  expect((await worker.fetch(correctionRequest([{id:'PE101-Q001',keyRef:KEY_REF}]),apiEnv())).status).toBe(401);
 });

 it('isola as rotas dos Workers de API e autenticação',async()=>{
  expect((await worker.fetch(new Request('https://api.example/auth/session'),apiEnv())).status).toBe(404);
  const authEnv={...apiEnv(),ROLE:'auth'};
  expect((await worker.fetch(correctionRequest([{id:'PE101-Q001',keyRef:KEY_REF}]),authEnv)).status).toBe(404);
  expect((await worker.fetch(new Request('https://auth.example/healthz'),authEnv)).status).toBe(404);
 });
});
