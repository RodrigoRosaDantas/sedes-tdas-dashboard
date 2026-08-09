import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const base=(process.env.TDAS_BASE_URL||'http://127.0.0.1:4173/sedes-tdas-dashboard').replace(/\/$/,'');
const chromeBin=process.env.CHROME_BIN||'google-chrome';
const port=Number(process.env.CHROME_DEBUG_PORT||9333);
const profile=await fs.mkdtemp(path.join(os.tmpdir(),'tdas-redactions-browser-'));
const chrome=spawn(chromeBin,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let chromeError='';chrome.stderr.on('data',chunk=>chromeError+=chunk);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitJson(url,attempts=60){let last;for(let i=0;i<attempts;i++){try{const response=await fetch(url);if(response.ok)return response.json();last=new Error(String(response.status));}catch(error){last=error;}await delay(250);}throw new Error(`${last?.message||'Timeout'}${chromeError?`\n${chromeError.slice(-1200)}`:''}`);}
function connect(wsUrl){
 const socket=new WebSocket(wsUrl);let id=0;const pending=new Map();const listeners=new Map();
 socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const task=pending.get(message.id);if(!task)return;pending.delete(message.id);message.error?task.reject(new Error(message.error.message)):task.resolve(message.result);return;}for(const resolve of listeners.get(message.method)||[])resolve(message.params);listeners.delete(message.method);};
 const ready=new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=()=>reject(new Error('Falha ao conectar ao Chrome DevTools'));});
 const send=async(method,params={})=>{await ready;const current=++id;return new Promise((resolve,reject)=>{pending.set(current,{resolve,reject});socket.send(JSON.stringify({id:current,method,params}));});};
 const once=method=>new Promise(resolve=>{const values=listeners.get(method)||[];values.push(resolve);listeners.set(method,values);});
 return{socket,ready,send,once};
}
async function newPage(width=1280,height=900){
 const target=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'}).then(response=>response.json());
 const client=connect(target.webSocketDebuggerUrl);await client.ready;await client.send('Page.enable');await client.send('Runtime.enable');await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=640});return client;
}
async function navigate(client,url){const loaded=client.once('Page.loadEventFired');await client.send('Page.navigate',{url});await loaded;}
async function evaluate(client,expression){const result=await client.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Erro no navegador');return result.result?.value;}
async function waitFor(client,expression,label,attempts=80){for(let i=0;i<attempts;i++){try{if(await evaluate(client,expression))return;}catch{}await delay(250);}throw new Error(`Timeout: ${label}`);}
async function stopChrome(){
 if(chrome.exitCode!==null)return;
 await new Promise(resolve=>{
  const timer=setTimeout(()=>{if(chrome.exitCode===null)chrome.kill('SIGKILL');resolve();},3000);
  chrome.once('exit',()=>{clearTimeout(timer);resolve();});
  chrome.kill('SIGTERM');
 });
}

try{
 await waitJson(`http://127.0.0.1:${port}/json/version`);
 const [platform,redactions]=await Promise.all([waitJson(`${base}/data/platform-version.json`),waitJson(`${base}/data/redactions.json`)]);
 const lockedRd=(redactions.redactions||[]).find(item=>item.locked===true)?.rd||'';
 const home=await newPage(1280,900);
 await navigate(home,`${base}/`);
 await waitFor(home,"document.body.textContent.includes('Central de execução')",'central da página inicial');
 await waitFor(home,`document.body.textContent.includes(${JSON.stringify(platform.platformVersion)})`,'versão na página inicial');
 const homeState=await evaluate(home,`({brand:document.querySelector('.brand small')?.textContent||'',status:document.querySelector('[data-publication-status]')?.textContent||'',lastSync:document.querySelector('[data-last-sync]')?.textContent||'',body:document.body.textContent})`);
 const expectedSync=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'America/Sao_Paulo'}).format(new Date(platform.syncAt)).replace(',',' às');
 assert.ok(homeState.brand.includes(platform.platformVersion),`Marca não apresenta ${platform.platformVersion}: ${homeState.brand}`);
 assert.ok(homeState.body.includes(`Plataforma ${platform.platformVersion}`),`Central não apresenta Plataforma ${platform.platformVersion}.`);
 assert.ok(homeState.body.includes(`publicação ${String(platform.sourceCommit).slice(0,7)}`),`Central não apresenta a publicação ${String(platform.sourceCommit).slice(0,7)}.`);
 assert.ok(homeState.body.includes(expectedSync),`Sincronização esperada ${expectedSync} não apareceu. Estado: ${JSON.stringify({status:homeState.status,lastSync:homeState.lastSync})}`);
 assert.ok(!homeState.body.includes('00h50 · 06h50 · 12h50 · 18h50'),`A página inicial ainda apresenta horários programados como última atualização.`);

 const mobile=await newPage(390,844);
 await navigate(mobile,`${base}/redacoes/?tab=bank&band=Risco`);
 await waitFor(mobile,"document.querySelector('#result-count')?.textContent.includes('1 de 32')",'filtro de risco');
 assert.equal(await evaluate(mobile,"document.querySelector('[data-tab=bank]')?.getAttribute('aria-selected')"),'true');
 assert.equal(await evaluate(mobile,"getComputedStyle(document.querySelector('.rd-bank-table')).display"),'none');
 assert.notEqual(await evaluate(mobile,"getComputedStyle(document.querySelector('.rd-bank-cards')).display"),'none');
 assert.equal(await evaluate(mobile,"[...document.querySelectorAll('#mobile-nav a')].map(a=>a.querySelector('span:last-child')?.textContent.trim()||'').join('|')"),'Início|Estudar|Questões|Desempenho|Mais');
 await waitFor(mobile,"Boolean(document.querySelector('[data-menu-toggle]'))",'botão do menu móvel');
 await evaluate(mobile,"document.querySelector('[data-menu-toggle]').click();true");
 await waitFor(mobile,"!document.querySelector('[data-tdas-drawer]').hidden",'drawer móvel nas redações');
 assert.equal(await evaluate(mobile,"document.querySelector('.tdas-drawer-nav')?.textContent.includes('Redação')"),true,'Redação deve permanecer acessível no drawer.');
 await evaluate(mobile,"document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));true");
 assert.equal(await evaluate(mobile,"document.querySelector('[data-tab=bank]')?.hasAttribute('aria-controls')"),true);
 assert.equal(await evaluate(mobile,"document.querySelector('[data-panel=bank]')?.getAttribute('role')"),'tabpanel');

 const detail=await newPage(1100,900);
 await navigate(detail,`${base}/redacoes/detalhe/?rd=RD01`);
 await waitFor(detail,"document.querySelector('h1')?.textContent.includes('RD01')",'detalhe RD01');
 assert.ok(await evaluate(detail,"document.querySelectorAll('.rd-rich-text p').length")>=4,'RD01 deve preservar parágrafos.');
 assert.ok(await evaluate(detail,"document.querySelectorAll('.rd-pager').length")>=2,'RD01 deve ter navegação no topo e rodapé.');
 assert.equal(await evaluate(detail,"[...document.links].some(link=>/notion\\.(so|com)/i.test(link.href))"),false);
 assert.equal(await evaluate(detail,"document.body.textContent.includes('Reescrita concluída')"),true);
 await evaluate(detail,"document.querySelector('#offline-rd').click(); true");
 await waitFor(detail,"localStorage.getItem('tdas-redactions-offline-index-v1')?.includes('RD01')",'índice offline');
 await waitFor(detail,"caches.keys().then(keys=>keys.includes('tdas-redactions-user-v1'))",'cache offline');
 await evaluate(detail,`navigator.serviceWorker.register('${base}/sw.js?audit='+Date.now()).then(reg=>new Promise(resolve=>{const worker=reg.installing||reg.waiting||reg.active;if(worker?.state==='activated')return resolve(true);const done=()=>worker?.state==='activated'&&resolve(true);worker?.addEventListener('statechange',done);setTimeout(()=>resolve(true),15000);}));`);
 assert.equal(await evaluate(detail,"caches.keys().then(keys=>keys.includes('tdas-redactions-user-v1'))"),true,'Atualização do service worker não pode apagar a cache pessoal.');
 assert.equal(await evaluate(detail,"caches.open('tdas-redactions-user-v1').then(cache=>Promise.all([cache.match(location.origin+'/sedes-tdas-dashboard/redacoes/detalhe/?rd=RD01'),cache.match(location.origin+'/sedes-tdas-dashboard/data/redactions/rd01.json')])).then(items=>items.every(Boolean))"),true,'Os recursos essenciais da RD01 devem existir na cache.');

 if(lockedRd){
  const locked=await newPage(1100,900);
  await navigate(locked,`${base}/redacoes/detalhe/?rd=${lockedRd}`);
  await waitFor(locked,"document.body.textContent.includes('Aplicação cega protegida')",`bloqueio ${lockedRd}`);
  assert.equal(await evaluate(locked,"document.querySelector('#offline-rd')===null"),true);
  assert.equal(await evaluate(locked,"document.body.textContent.includes('Proposta completa')"),false);
 }

 console.log(JSON.stringify({browser:'ok',homePublication:true,mobileCards:true,mobileFiveActions:true,drawerRedaction:true,tabsAccessible:true,paragraphs:true,offlinePersistent:true,futureLocked:Boolean(lockedRd),lockedRd:lockedRd||null}));
}finally{
 await stopChrome();
 await fs.rm(profile,{recursive:true,force:true,maxRetries:8,retryDelay:200}).catch(()=>{});
}
