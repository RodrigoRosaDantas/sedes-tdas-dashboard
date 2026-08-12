import assert from'node:assert/strict';
import{spawn}from'node:child_process';
import{createServer}from'node:http';
import fs from'node:fs/promises';
import path from'node:path';
import os from'node:os';

const ROOT=process.cwd(),PREFIX='/sedes-tdas-dashboard/',port=Number(process.env.TDAS_HOME_TEST_PORT||4184),chromePort=Number(process.env.TDAS_HOME_CHROME_PORT||9665),chromeBin=process.env.CHROME_BIN||'google-chrome',base=`http://127.0.0.1:${port}${PREFIX}`;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith(PREFIX)){res.writeHead(404);res.end('not found');return}let relative=decodeURIComponent(url.pathname.slice(PREFIX.length));if(!relative||relative.endsWith('/'))relative+='index.html';const file=path.resolve(ROOT,relative);if(!file.startsWith(ROOT)){res.writeHead(403);res.end('forbidden');return}const body=await fs.readFile(file);res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(body)}catch{res.writeHead(404);res.end('not found')}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve)});
const profile=await fs.mkdtemp(path.join(os.tmpdir(),'tdas-home-mobile-')),chrome=spawn(chromeBin,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-debugging-address=127.0.0.1',`--remote-debugging-port=${chromePort}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});let chromeError='';chrome.stderr.on('data',chunk=>chromeError+=chunk);const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitJson(url,attempts=160){let last;for(let i=0;i<attempts;i++){try{const response=await fetch(url);if(response.ok)return response.json();last=new Error(String(response.status))}catch(error){last=error}await delay(200)}throw new Error(`${last?.message||'timeout'}${chromeError?`\n${chromeError.slice(-1200)}`:''}`)}
function connect(wsUrl){const socket=new WebSocket(wsUrl);let id=0;const pending=new Map(),listeners=new Map();socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const item=pending.get(message.id);if(!item)return;pending.delete(message.id);message.error?item.reject(new Error(message.error.message)):item.resolve(message.result);return}for(const fn of listeners.get(message.method)||[])fn(message.params);listeners.delete(message.method)};const ready=new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=()=>reject(new Error('Falha no DevTools'))});const send=async(method,params={})=>{await ready;const current=++id;return new Promise((resolve,reject)=>{pending.set(current,{resolve,reject});socket.send(JSON.stringify({id:current,method,params}))})};const once=method=>new Promise(resolve=>{const list=listeners.get(method)||[];list.push(resolve);listeners.set(method,list)});return{socket,ready,send,once}}
async function page(width,height=844){const target=await fetch(`http://127.0.0.1:${chromePort}/json/new?about:blank`,{method:'PUT'}).then(response=>response.json()),client=connect(target.webSocketDebuggerUrl);await client.ready;await client.send('Page.enable');await client.send('Runtime.enable');await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});return client}
async function nav(client,url){const loaded=client.once('Page.loadEventFired');await client.send('Page.navigate',{url});await loaded}
async function evalJs(client,expression){const result=await client.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Erro no navegador');return result.result?.value}
async function waitFor(client,expression,label,attempts=120){for(let i=0;i<attempts;i++){try{if(await evalJs(client,expression))return}catch{}await delay(150)}throw new Error(`Timeout: ${label}`)}
async function inspect(width){const client=await page(width);await nav(client,base);await waitFor(client,"document.querySelector('.tdas-home-focus')&&document.querySelector('.tdas-command-trigger')&&document.querySelector('.tdas-performance-svg')",`Home carregada em ${width}px`);await delay(300);return evalJs(client,`(()=>{const rect=s=>document.querySelector(s)?.getBoundingClientRect();const topbar=rect('.topbar'),crumb=rect('.topbar .crumb'),actions=rect('.topbar .actions'),chart=rect('.tdas-performance-svg'),chartCard=rect('.tdas-performance-card'),metrics=[...document.querySelectorAll('.tdas-home-metrics .metric')].map(x=>x.getBoundingClientRect()),heads=[...document.querySelectorAll('.tdas-dashboard-section .section-head')].map(x=>x.getBoundingClientRect()),badge=document.querySelector('.topbar .tdas-publication-badge');return{width:innerWidth,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,topbar,crumb,actions,chart,chartCard,metrics,heads,badge:badge?getComputedStyle(badge).display:null,hotfix:Boolean([...document.styleSheets].some(x=>String(x.href||'').includes('home-mobile-hotfix.css')))}})()`)}
async function stop(){server.close();if(chrome.exitCode!==null)return;await new Promise(resolve=>{const timer=setTimeout(()=>{if(chrome.exitCode===null)chrome.kill('SIGKILL');resolve()},2200);chrome.once('exit',()=>{clearTimeout(timer);resolve()});chrome.kill('SIGTERM')})}
try{
 await waitJson(`http://127.0.0.1:${chromePort}/json/version`);
 for(const width of[360,390,430]){
  const d=await inspect(width);
  console.log(`HOME_LAYOUT_${width}=${JSON.stringify({topbar:d.topbar,crumb:d.crumb,actions:d.actions,doc:d.doc,body:d.body,chart:d.chart,chartCard:d.chartCard})}`);
  assert.equal(d.hotfix,true,`Hotfix mobile deve estar carregado em ${width}px.`);
  assert.ok(d.doc<=width+1,`Home não pode criar scroll horizontal em ${width}px: scrollWidth=${d.doc}.`);
  assert.ok(d.body<=width+1,`Body não pode exceder a viewport em ${width}px: scrollWidth=${d.body}.`);
  assert.equal(d.badge,'none',`Status textual deve sair do cabeçalho estreito em ${width}px e permanecer no drawer.`);
  assert.ok(d.crumb.right<=d.actions.left+1,`Identidade e ações do topo não podem se sobrepor em ${width}px: ${JSON.stringify({crumb:d.crumb,actions:d.actions,topbar:d.topbar})}`);
  assert.ok(d.actions.right<=width+1,`Busca/menu devem caber no cabeçalho em ${width}px.`);
  assert.ok(d.chart.width<=d.chartCard.width+1,`Gráfico deve ser responsivo em ${width}px.`);
  assert.ok(d.metrics.every(box=>box.left>=-1&&box.right<=width+1),`Cards de métricas devem permanecer dentro da viewport em ${width}px.`);
  assert.ok(d.heads.every(box=>box.left>=-1&&box.right<=width+1),`Cabeçalhos de seção devem permanecer dentro da viewport em ${width}px.`);
 }
 console.log('Home mobile validada em 360, 390 e 430px: sem overflow, cabeçalho sem colisão e gráfico responsivo.');
}finally{await stop();await fs.rm(profile,{recursive:true,force:true}).catch(()=>{})}
