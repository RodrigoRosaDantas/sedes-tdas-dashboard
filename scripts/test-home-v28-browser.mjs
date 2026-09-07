import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const ROOT=process.cwd(),PREFIX='/sedes-tdas-dashboard/',port=Number(process.env.TDAS_V28_TEST_PORT||4197),chromePort=Number(process.env.TDAS_V28_CHROME_PORT||9771),chromeBin=process.env.CHROME_BIN||'google-chrome',base=`http://127.0.0.1:${port}${PREFIX}`;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith(PREFIX)){res.writeHead(404);res.end('not found');return}let relative=decodeURIComponent(url.pathname.slice(PREFIX.length));if(!relative||relative.endsWith('/'))relative+='index.html';const file=path.resolve(ROOT,relative);if(!file.startsWith(ROOT)){res.writeHead(403);res.end('forbidden');return}const body=await fs.readFile(file);res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(body)}catch{res.writeHead(404);res.end('not found')}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve)});
const profile=await fs.mkdtemp(path.join(os.tmpdir(),'tdas-home-v28-')),chrome=spawn(chromeBin,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-debugging-address=127.0.0.1',`--remote-debugging-port=${chromePort}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});let chromeError='';chrome.stderr.on('data',chunk=>chromeError+=chunk);const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitJson(url,attempts=160){let last;for(let i=0;i<attempts;i++){try{const response=await fetch(url);if(response.ok)return response.json();last=new Error(String(response.status))}catch(error){last=error}await delay(200)}throw new Error(`${last?.message||'timeout'}${chromeError?`\n${chromeError.slice(-1200)}`:''}`)}
function connect(wsUrl){const socket=new WebSocket(wsUrl);let id=0;const pending=new Map(),listeners=new Map();socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const item=pending.get(message.id);if(!item)return;pending.delete(message.id);message.error?item.reject(new Error(message.error.message)):item.resolve(message.result);return}for(const fn of listeners.get(message.method)||[])fn(message.params);listeners.delete(message.method)};const ready=new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=()=>reject(new Error('Falha no DevTools'))});const send=async(method,params={})=>{await ready;const current=++id;return new Promise((resolve,reject)=>{pending.set(current,{resolve,reject});socket.send(JSON.stringify({id:current,method,params}))})};const once=method=>new Promise(resolve=>{const list=listeners.get(method)||[];list.push(resolve);listeners.set(method,list)});return{socket,ready,send,once}}
async function page(width,height){const target=await fetch(`http://127.0.0.1:${chromePort}/json/new?about:blank`,{method:'PUT'}).then(response=>response.json()),client=connect(target.webSocketDebuggerUrl);await client.ready;await client.send('Page.enable');await client.send('Runtime.enable');await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<1200});return client}
async function nav(client,url){const loaded=client.once('Page.loadEventFired');await client.send('Page.navigate',{url});await loaded}
async function evalJs(client,expression){const result=await client.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Erro no navegador');return result.result?.value}
async function waitFor(client,expression,label,attempts=160){for(let i=0;i<attempts;i++){try{if(await evalJs(client,expression))return}catch{}await delay(120)}throw new Error(`Timeout: ${label}`)}
async function inspect(width,height){const client=await page(width,height);await nav(client,base);await waitFor(client,"document.querySelector('.post26-home')&&document.querySelector('.post26-hero')&&document.querySelector('.post26-next')",`Home pós-prova em ${width}px`);await delay(450);return evalJs(client,`(()=>{const visible=n=>n&&getComputedStyle(n).display!=='none'&&getComputedStyle(n).visibility!=='hidden'&&n.getBoundingClientRect().height>0&&n.getBoundingClientRect().width>0;const hero=document.querySelector('.post26-hero'),primary=hero?.querySelector('.post26-hero-actions .primary'),next=document.querySelector('.post26-next'),system=document.querySelector('.post26-system');const keepY=scrollY;window.scrollTo(9999,keepY);const attemptedX=scrollX;window.scrollTo(0,keepY);return{heroTitle:hero?.querySelector('h1')?.textContent.trim()||'',primaryHref:primary?.href||'',primaryText:primary?.textContent.trim()||'',nextTitle:next?.querySelector('h2')?.textContent.trim()||'',nextNote:next?.querySelector('.post26-next-note')?.textContent.trim()||'',timelineSteps:document.querySelectorAll('.post26-step').length,currentSteps:document.querySelectorAll('.post26-step.current').length,doneSteps:document.querySelectorAll('.post26-step.done').length,metrics:document.querySelectorAll('.post26-summary>.post26-metric').length,archiveLinks:document.querySelectorAll('.post26-archive-link').length,facts:document.querySelectorAll('.post26-facts>div').length,updateControls:Boolean(document.querySelector('[data-post26-sync-open]')&&document.querySelector('[data-post26-sync-check]')),systemVisible:visible(system),systemText:system?.textContent||'',oldDashboard:Boolean(document.querySelector('.pro26-dashboard,.pro26-plan,.pro26-analytics,[data-continue-action]')),docWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,viewport:innerWidth,attemptedX,height:document.body.getBoundingClientRect().height}})()`)}
async function stop(){server.close();if(chrome.exitCode!==null)return;await new Promise(resolve=>{const timer=setTimeout(()=>{if(chrome.exitCode===null)chrome.kill('SIGKILL');resolve()},2200);chrome.once('exit',()=>{clearTimeout(timer);resolve()});chrome.kill('SIGTERM')})}
try{
 await waitJson(`http://127.0.0.1:${chromePort}/json/version`);
 for(const[width,height]of[[390,844],[1024,768],[1366,1024]]){
  const d=await inspect(width,height);console.log(`HOME_POST_EXAM_${width}=${JSON.stringify(d)}`);
  assert.equal(d.heroTitle,'O ciclo terminou. Agora é acompanhar o concurso.',`Mensagem principal pós-prova incorreta em ${width}px.`);
  assert.ok(d.primaryHref.includes('/sedes-tdas-dashboard/desempenho/'),`CTA principal deve abrir histórico em ${width}px.`);
  assert.match(d.primaryText,/histórico do ciclo/i,`CTA principal deve falar em histórico em ${width}px.`);
  assert.equal(d.nextTitle,'Gabarito preliminar',`Próximo marco incorreto em ${width}px.`);
  assert.match(d.nextNote,/não inventa prazo/i,`Home deve declarar ausência de data oficial em ${width}px.`);
  assert.equal(d.timelineSteps,6,`Linha do tempo deve conter seis marcos em ${width}px.`);
  assert.equal(d.currentSteps,1,`Linha do tempo deve ter um único marco atual em ${width}px.`);
  assert.equal(d.doneSteps,1,`Linha do tempo deve registrar a prova como concluída em ${width}px.`);
  assert.equal(d.metrics,4,`Home deve manter quatro indicadores históricos em ${width}px.`);
  assert.ok(d.archiveLinks>=6,`Arquivo do ciclo deve expor pelo menos seis destinos em ${width}px.`);
  assert.equal(d.facts,4,`Fotografia final deve manter quatro fatos históricos em ${width}px.`);
  assert.equal(d.updateControls,true,'Atualização e verificação do snapshot devem permanecer acessíveis.');
  assert.equal(d.systemVisible,true,'Barra de publicação deve permanecer visível.');
  assert.ok(/notion/i.test(d.systemText)&&/github/i.test(d.systemText)&&/site/i.test(d.systemText),'Sistema deve preservar a cadeia Notion → GitHub → site.');
  assert.equal(d.oldDashboard,false,`Home pós-prova não pode montar Central/Plano/Analytics pré-prova em ${width}px.`);
  assert.ok(d.docWidth<=d.viewport+1&&d.bodyWidth<=d.viewport+1,`Home não pode exceder a viewport em ${width}px.`);
  assert.equal(d.attemptedX,0,`Home pós-prova não pode rolar horizontalmente em ${width}px.`);
 }
 console.log('Home pós-prova v2 validada no Chrome: próximo marco, timeline, memória do ciclo, arquivo, publicação segura e zero dashboard pré-prova.');
}finally{await stop();await fs.rm(profile,{recursive:true,force:true}).catch(()=>{})}
