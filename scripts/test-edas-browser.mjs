import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const base=(process.env.EDAS_BASE_URL||'http://127.0.0.1:4173/sedes-tdas-dashboard/edas-administracao').replace(/\/$/,'');
const chromeBin=process.env.CHROME_BIN||'google-chrome';
const port=Number(process.env.CHROME_DEBUG_PORT||9444);
const profile=await fs.mkdtemp(path.join(os.tmpdir(),'edas-browser-'));
const chrome=spawn(chromeBin,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let chromeError='';chrome.stderr.on('data',chunk=>chromeError+=chunk);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitJson(url,attempts=60){let last;for(let i=0;i<attempts;i++){try{const r=await fetch(url);if(r.ok)return r.json();last=new Error(String(r.status));}catch(e){last=e;}await delay(250);}throw new Error(`${last?.message||'timeout'}${chromeError?`\n${chromeError.slice(-1000)}`:''}`);}
function connect(wsUrl){const socket=new WebSocket(wsUrl);let id=0;const pending=new Map(),listeners=new Map();socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);return;}for(const fn of listeners.get(m.method)||[])fn(m.params);listeners.delete(m.method);};const ready=new Promise((res,rej)=>{socket.onopen=res;socket.onerror=()=>rej(new Error('Falha no DevTools'));});const send=async(method,params={})=>{await ready;const current=++id;return new Promise((res,rej)=>{pending.set(current,{resolve:res,reject:rej});socket.send(JSON.stringify({id:current,method,params}));});};const once=method=>new Promise(resolve=>{const arr=listeners.get(method)||[];arr.push(resolve);listeners.set(method,arr);});return{socket,ready,send,once};}
async function newPage(width=1280,height=900){const target=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'}).then(r=>r.json());const c=connect(target.webSocketDebuggerUrl);await c.ready;await c.send('Page.enable');await c.send('Runtime.enable');await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=640});return c;}
async function nav(c,url){const loaded=c.once('Page.loadEventFired');await c.send('Page.navigate',{url});await loaded;}
async function evalJs(c,expression){const r=await c.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text||'Erro no navegador');return r.result?.value;}
async function waitFor(c,expression,label,attempts=100){for(let i=0;i<attempts;i++){try{if(await evalJs(c,expression))return;}catch{}await delay(200);}throw new Error(`Timeout: ${label}`);}
async function stop(){if(chrome.exitCode!==null)return;await new Promise(resolve=>{const timer=setTimeout(()=>{if(chrome.exitCode===null)chrome.kill('SIGKILL');resolve();},3000);chrome.once('exit',()=>{clearTimeout(timer);resolve();});chrome.kill('SIGTERM');});}

try{
 await waitJson(`http://127.0.0.1:${port}/json/version`);
 const [site,catalog]=await Promise.all([waitJson(`${base}/data/site.json`),waitJson(`${base}/data/integration/question-catalog.json`)]);
 const home=await newPage(1280,900);await nav(home,`${base}/`);await waitFor(home,`document.body.textContent.includes(${JSON.stringify(site.today.sprint)})`,'Sprint atual na home');assert.equal(await evalJs(home,`document.querySelector('[data-platform-version]')?.textContent.includes(${JSON.stringify(site.meta.version)})`),true);
 const mobile=await newPage(390,844);await nav(mobile,`${base}/hoje/`);await waitFor(mobile,"document.body.textContent.includes('Material Premium')",'Hoje EDAS');assert.ok((await evalJs(mobile,"document.querySelector('#mobile-nav')?.textContent||''")).length>0,'Navegação móvel ausente.');
 const resolver=await newPage(1100,900);await nav(resolver,`${base}/resolver/`);await waitFor(resolver,"document.body.textContent.includes('Questão 1 de')",'primeira questão');
 assert.equal(await evalJs(resolver,"performance.getEntriesByType('resource').some(x=>x.name.includes('answer-key.json'))"),false,'Gabarito não pode ser requisitado antes da finalização.');
 assert.equal(await evalJs(resolver,"document.body.textContent.includes('Gabarito:')"),false,'Gabarito não pode aparecer antes da finalização.');
 await evalJs(resolver,`navigator.serviceWorker.register('${base}/sw.js?audit='+Date.now()).then(reg=>new Promise(resolve=>{const w=reg.installing||reg.waiting||reg.active;if(w?.state==='activated')return resolve(true);const done=()=>w?.state==='activated'&&resolve(true);w?.addEventListener('statechange',done);setTimeout(()=>resolve(true),12000);}));`);
 await waitFor(resolver,"caches.keys().then(keys=>keys.some(k=>k.startsWith('edas-')))",'cache EDAS');
 assert.equal(await evalJs(resolver,`caches.match(location.origin+'${new URL(base).pathname}/data/integration/answer-key.json',{ignoreSearch:true}).then(Boolean)`),false,'Gabarito não pode estar no precache.');
 const total=Number(catalog.questions.length);assert.ok(total>0,'Catálogo vazio.');
 await evalJs(resolver,`(async()=>{for(let i=0;i<${total};i++){const radio=document.querySelector('input[name=answer]');if(!radio)throw new Error('radio ausente '+i);radio.click();document.querySelector('[data-next]').click();await new Promise(r=>setTimeout(r,35));}return true})()`);
 await waitFor(resolver,"document.body.textContent.includes('Sessão concluída')",'conclusão da sessão',150);
 assert.equal(await evalJs(resolver,"document.body.textContent.includes('Gabarito:')"),true,'A correção deve aparecer após a finalização.');
 await waitFor(resolver,`caches.match(location.origin+'${new URL(base).pathname}/data/integration/answer-key.json',{ignoreSearch:true}).then(Boolean)`,'gabarito em cache após fechamento');
 console.log(JSON.stringify({browser:'ok',sprint:site.today.sprint,version:site.meta.version,mobile:true,questionCount:total,answerKeyBeforeFinish:false,answerKeyAfterFinish:true,pwa:true}));
}finally{await stop();await fs.rm(profile,{recursive:true,force:true,maxRetries:8,retryDelay:200}).catch(()=>{});}
