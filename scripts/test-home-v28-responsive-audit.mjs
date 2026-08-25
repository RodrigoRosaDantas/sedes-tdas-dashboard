import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const ROOT=process.cwd();
const PREFIX='/sedes-tdas-dashboard/';
const port=Number(process.env.TDAS_V28_AUDIT_PORT||4198);
const chromePort=Number(process.env.TDAS_V28_AUDIT_CHROME_PORT||9772);
const chromeBin=process.env.CHROME_BIN||'google-chrome';
const base=`http://127.0.0.1:${port}${PREFIX}`;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};

const profiles=[
 {name:'mobile-360',width:360,height:800,touch:true,mobile:true},
 {name:'mobile-390',width:390,height:844,touch:true,mobile:true},
 {name:'mobile-430',width:430,height:932,touch:true,mobile:true},
 {name:'ipad-portrait-768',width:768,height:1024,touch:true,mobile:true},
 {name:'ipad-portrait-820',width:820,height:1180,touch:true,mobile:true},
 {name:'ipad-portrait-834',width:834,height:1194,touch:true,mobile:true},
 {name:'ipad-pro-portrait-1024',width:1024,height:1366,touch:true,mobile:true},
 {name:'ipad-landscape-1024',width:1024,height:768,touch:true,mobile:true},
 {name:'ipad-landscape-1194',width:1194,height:834,touch:true,mobile:true},
 {name:'desktop-1280',width:1280,height:800,touch:false,mobile:false},
 {name:'desktop-1366',width:1366,height:768,touch:false,mobile:false},
 {name:'desktop-1440',width:1440,height:900,touch:false,mobile:false},
 {name:'desktop-1920',width:1920,height:1080,touch:false,mobile:false}
];

const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(!url.pathname.startsWith(PREFIX)){res.writeHead(404);res.end('not found');return}
  let relative=decodeURIComponent(url.pathname.slice(PREFIX.length));
  if(!relative||relative.endsWith('/'))relative+='index.html';
  const file=path.resolve(ROOT,relative);
  if(!file.startsWith(ROOT)){res.writeHead(403);res.end('forbidden');return}
  const body=await fs.readFile(file);
  res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});
  res.end(body);
 }catch{res.writeHead(404);res.end('not found')}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve)});

const profileDir=await fs.mkdtemp(path.join(os.tmpdir(),'tdas-v28-responsive-audit-'));
const chrome=spawn(chromeBin,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-debugging-address=127.0.0.1',`--remote-debugging-port=${chromePort}`,`--user-data-dir=${profileDir}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let chromeError='';chrome.stderr.on('data',chunk=>chromeError+=chunk);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function waitJson(url,attempts=160){let last;for(let i=0;i<attempts;i++){try{const response=await fetch(url);if(response.ok)return response.json();last=new Error(String(response.status))}catch(error){last=error}await delay(200)}throw new Error(`${last?.message||'timeout'}${chromeError?`\n${chromeError.slice(-1200)}`:''}`)}
function connect(wsUrl){const socket=new WebSocket(wsUrl);let id=0;const pending=new Map(),listeners=new Map();socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const item=pending.get(message.id);if(!item)return;pending.delete(message.id);message.error?item.reject(new Error(message.error.message)):item.resolve(message.result);return}for(const fn of listeners.get(message.method)||[])fn(message.params);listeners.delete(message.method)};const ready=new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=()=>reject(new Error('Falha no DevTools'))});const send=async(method,params={})=>{await ready;const current=++id;return new Promise((resolve,reject)=>{pending.set(current,{resolve,reject});socket.send(JSON.stringify({id:current,method,params}))})};const once=method=>new Promise(resolve=>{const list=listeners.get(method)||[];list.push(resolve);listeners.set(method,list)});return{socket,ready,send,once}}
async function page(p){const target=await fetch(`http://127.0.0.1:${chromePort}/json/new?about:blank`,{method:'PUT'}).then(response=>response.json());const client=connect(target.webSocketDebuggerUrl);await client.ready;await client.send('Page.enable');await client.send('Runtime.enable');await client.send('Emulation.setDeviceMetricsOverride',{width:p.width,height:p.height,deviceScaleFactor:p.touch?2:1,mobile:p.mobile});if(p.touch)await client.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});else await client.send('Emulation.setTouchEmulationEnabled',{enabled:false});return client}
async function nav(client,url){const loaded=client.once('Page.loadEventFired');await client.send('Page.navigate',{url});await loaded}
async function evalJs(client,expression){const result=await client.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Erro no navegador');return result.result?.value}
async function waitFor(client,expression,label,attempts=160){for(let i=0;i<attempts;i++){try{if(await evalJs(client,expression))return}catch{}await delay(120)}throw new Error(`Timeout: ${label}`)}

async function inspect(p){
 const client=await page(p);await nav(client,base);await waitFor(client,"document.documentElement.dataset.dashboardPro2026==='1'&&document.querySelector('.pro26-dashboard')",`Dashboard PRO ${p.name}`);await delay(450);
 return evalJs(client,`(()=>{
  const visible=n=>n&&getComputedStyle(n).display!=='none'&&getComputedStyle(n).visibility!=='hidden'&&n.getBoundingClientRect().width>0&&n.getBoundingClientRect().height>0;
  const rect=n=>{if(!n)return null;const r=n.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
  const hero=document.querySelector('.tdas-home-focus');
  const heroActions=[...(hero?.querySelectorAll('.tdas-home-actions a')||[])].filter(visible).map(n=>({text:n.textContent.trim(),...rect(n)}));
  const sections=['.pro26-sync-card','.pro26-operational-bridge','.pro26-decision-grid','.pro26-metrics','.pro26-plan','.pro26-analytics'].filter(selector=>visible(document.querySelector(selector)));
  const headings=[...document.querySelectorAll('.pro26-dashboard h1,.pro26-dashboard h2')].filter(visible).map(n=>({text:n.textContent.trim(),client:n.clientHeight,scroll:n.scrollHeight,overflow:getComputedStyle(n).overflow}));
  const mainOffenders=[...document.querySelectorAll('main *')].filter(visible).map(n=>({node:n.tagName.toLowerCase(),cls:String(n.className||'').slice(0,90),...rect(n)})).filter(r=>r.left<-1||r.right>innerWidth+1).slice(0,12);
  const primary=hero?.querySelector('.tdas-home-actions .btn.primary');
  const center=document.querySelector('[data-operational-center]');
  const centerPrimary=center?.querySelector('[data-continue-action]');
  const mobileNav=document.querySelector('#mobile-nav');
  const sidebar=document.querySelector('.sidebar');
  const navLinks=[...(mobileNav?.querySelectorAll('a')||[])].filter(visible).map(n=>({text:n.textContent.trim(),...rect(n)}));
  const system=document.querySelector('.pro26-sync-card');
  const tabs=[...document.querySelectorAll('[data-pro26-tab]')].filter(visible);
  const keepY=scrollY;window.scrollTo(9999,keepY);const attemptedX=scrollX;window.scrollTo(0,keepY);
  return {
   width:innerWidth,height:innerHeight,docWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,bodyHeight:document.body.getBoundingClientRect().height,attemptedX,
   sections,heroActions,primaryHref:primary?.href||'',centerHref:centerPrimary?.href||'',headings,mainOffenders,tabs:tabs.length,metrics:document.querySelectorAll('.pro26-metrics>.pro26-metric').length,
   mobileNavVisible:visible(mobileNav),sidebarVisible:visible(sidebar),navLinks,
   systemVisible:visible(system),systemRect:rect(system)
  };
 })()`);
}

async function stop(){server.close();if(chrome.exitCode!==null)return;await new Promise(resolve=>{const timer=setTimeout(()=>{if(chrome.exitCode===null)chrome.kill('SIGKILL');resolve()},2200);chrome.once('exit',()=>{clearTimeout(timer);resolve()});chrome.kill('SIGTERM')})}

try{
 await waitJson(`http://127.0.0.1:${chromePort}/json/version`);
 for(const p of profiles){
  const d=await inspect(p);console.log(`AUDIT_${p.name}=${JSON.stringify(d)}`);
  assert.equal(d.sections.length,6,`${p.name}: as seis áreas principais do Dashboard PRO devem permanecer visíveis.`);
  assert.equal(d.primaryHref,d.centerHref,`${p.name}: hero e Central divergem na ação canônica.`);
  assert.equal(d.heroActions.length,4,`${p.name}: esperado 1 CTA + 3 atalhos; encontrado ${d.heroActions.map(x=>x.text).join(' | ')}.`);
  assert.equal(d.tabs,3,`${p.name}: três visões analíticas devem permanecer acessíveis.`);
  assert.equal(d.metrics,5,`${p.name}: cinco indicadores principais devem permanecer visíveis.`);
  assert.equal(d.attemptedX,0,`${p.name}: rolagem horizontal funcional detectada.`);
  assert.equal(d.mainOffenders.length,0,`${p.name}: elementos saindo da viewport: ${JSON.stringify(d.mainOffenders)}.`);
  assert.equal(d.systemVisible,true,`${p.name}: atualização Notion/GitHub deve permanecer visível.`);
  assert.ok(d.headings.every(h=>h.overflow!=='hidden'||h.scroll<=h.client+4),`${p.name}: título truncado: ${JSON.stringify(d.headings)}.`);
  if(p.touch){
   assert.ok(d.heroActions.every(a=>a.height>=43.5),`${p.name}: CTA/atalho do hero abaixo de 44px: ${JSON.stringify(d.heroActions)}.`);
   if(d.mobileNavVisible)assert.ok(d.navLinks.every(a=>a.height>=43.5),`${p.name}: item da navegação móvel abaixo de 44px: ${JSON.stringify(d.navLinks)}.`);
  }
  if(p.width<=834)assert.equal(d.sidebarVisible,false,`${p.name}: sidebar desktop não deve ocupar tela em retrato/tablet estreito.`);
  if(p.width>=1280&&!p.mobile)assert.equal(d.sidebarVisible,true,`${p.name}: sidebar deve permanecer disponível no desktop.`);
 }
 console.log('Auditoria responsiva do Dashboard PRO aprovada: mobile, iPad retrato/paisagem e desktop sem overflow, truncamento ou alvo de toque crítico.');
}finally{await stop();await fs.rm(profileDir,{recursive:true,force:true}).catch(()=>{})}
