import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchWithTimeout, normalizeTimeoutMs } from './http-monitor.mjs';

const ROOT=process.cwd();
const DEFAULT_BASE='https://rodrigorosadantas.github.io/sedes-tdas-dashboard';
const REPORT_PATH=process.env.SHELL_MONITOR_REPORT_PATH||'/tmp/tdas-shell-monitor.json';
const REQUEST_TIMEOUT_MS=normalizeTimeoutMs(process.env.SHELL_MONITOR_REQUEST_TIMEOUT_MS,8000);
const FILES=[
 'index.html',
 'mentor/index.html',
 'assets/tdas-mobile-ux.js',
 'assets/tdas-mobile-ux.css',
 'assets/tdas-pro-dashboard.css',
 'assets/home-mobile-hotfix.css',
 'assets/tdas-pro-modules.js',
 'assets/tdas-pro-modules.css',
 'assets/tdas-command-palette.js',
 'assets/tdas-command-palette.css',
 'assets/mentor.js',
 'assets/mentor.css',
 'assets/integration/mentor-engine.js',
 'assets/integration/mentor-ux.js',
 'sw.js'
];
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const normalizeBase=value=>String(value||DEFAULT_BASE).replace(/\/+$/,'');
const readLocal=async()=>Object.fromEntries(await Promise.all(FILES.map(async file=>[file,await fs.readFile(path.join(ROOT,file))])));
const signatures=map=>Object.fromEntries(Object.entries(map).map(([file,value])=>[file,hash(value)]));
export function compareShell(local,live){
 const missing=FILES.filter(file=>!live[file]);
 const mismatched=FILES.filter(file=>live[file]&&local[file]!==live[file]);
 return{healthy:missing.length===0&&mismatched.length===0,missing,mismatched,checked:FILES.length};
}
async function fetchLive(base){
 return Object.fromEntries(await Promise.all(FILES.map(async file=>{
  const response=await fetchWithTimeout(`${base}/${file}?shell=${Date.now()}`,{cache:'no-store',headers:{'cache-control':'no-cache'}},{timeoutMs:REQUEST_TIMEOUT_MS});
  if(!response.ok)throw new Error(`${response.status} ${response.statusText} em ${file}`);
  return[file,Buffer.from(await response.arrayBuffer())];
 })));
}
function reportFor(result,{attempt=1,attempts=1,baseUrl=DEFAULT_BASE}={}){
 const summary=result.healthy
  ? `Camada TDAS PRO confirmada no GitHub Pages (${result.checked} arquivos críticos idênticos à main, incluindo Mentor).`
  : `Camada TDAS PRO divergente no GitHub Pages: ${[...result.missing,...result.mismatched].join(', ')||'falha não classificada'}.`;
 const lines=['## Paridade da interface TDAS','',`- **Estado:** ${result.healthy?'íntegro':'divergente'}`,`- **Arquivos críticos:** ${result.checked}`,`- **Tentativa:** ${attempt}/${attempts}`,`- **Timeout HTTP:** ${REQUEST_TIMEOUT_MS} ms`,`- **Resumo:** ${summary}`];
 if(result.missing.length)lines.push(`- **Ausentes:** ${result.missing.join(', ')}`);
 if(result.mismatched.length)lines.push(`- **Divergentes:** ${result.mismatched.join(', ')}`);
 return{...result,summary,attempt,attempts,baseUrl,requestTimeoutMs:REQUEST_TIMEOUT_MS,markdown:lines.join('\n')};
}
async function selfTest(){
 const local=await readLocal();
 const index=local['index.html'].toString('utf8'),mentor=local['mentor/index.html'].toString('utf8'),sw=local['sw.js'].toString('utf8');
 assert.match(index,/assets\/home-mobile-hotfix\.css/,'Home deve referenciar o hotfix mobile.');
 assert.match(mentor,/assets\/mentor\.js/,'Rota Mentor deve referenciar o módulo analítico.');
 assert.match(sw,/assets\/home-mobile-hotfix\.css/,'Service worker deve precachear o hotfix mobile.');
 assert.match(sw,/mentor\//,'Service worker deve precachear a rota Mentor.');
 assert.match(sw,/assets\/integration\/mentor-engine\.js/,'Service worker deve precachear o motor do Mentor.');
 assert.ok(!sw.includes('question-keys/'),'Gabarito não pode entrar no shell precacheado.');
 assert.ok(REQUEST_TIMEOUT_MS>=20&&REQUEST_TIMEOUT_MS<=60000,'Timeout HTTP do shell deve permanecer limitado.');
 const sig=signatures(local),same=compareShell(sig,{...sig});
 assert.equal(same.healthy,true);
 const changed={...sig,'assets/mentor.js':'divergente'};
 const broken=compareShell(sig,changed);
 assert.equal(broken.healthy,false);
 assert.deepEqual(broken.mismatched,['assets/mentor.js']);
 console.log(`Monitor do shell validado: ${FILES.length} arquivos críticos, Mentor e hotfix no PWA, timeout HTTP de ${REQUEST_TIMEOUT_MS} ms.`);
}

if(process.env.SHELL_MONITOR_SELF_TEST==='true'){
 await selfTest();
}else{
 const baseUrl=normalizeBase(process.env.SITE_BASE_URL),attempts=Math.max(1,Number(process.env.SHELL_MONITOR_MAX_ATTEMPTS||12)),delay=Math.max(0,Number(process.env.SHELL_MONITOR_RETRY_DELAY_MS||10000));
 const local=signatures(await readLocal());
 let report=null;
 for(let attempt=1;attempt<=attempts;attempt++){
  try{
   const live=signatures(await fetchLive(baseUrl));
   report=reportFor(compareShell(local,live),{attempt,attempts,baseUrl});
  }catch(error){
   report=reportFor({healthy:false,missing:FILES,mismatched:[],checked:FILES.length},{attempt,attempts,baseUrl});
   report.summary=`Não foi possível verificar integralmente a camada TDAS PRO: ${error instanceof Error?error.message:String(error)}`;
   report.markdown+=`\n- **Erro:** ${report.summary}`;
  }
  if(report.healthy||attempt===attempts)break;
  await sleep(delay);
 }
 report.checkedAt=new Date().toISOString();
 await fs.writeFile(REPORT_PATH,`${JSON.stringify(report)}\n`,'utf8');
 console.log(report.summary);
 if(!report.healthy)process.exitCode=1;
}