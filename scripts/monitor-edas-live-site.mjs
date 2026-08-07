import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.cwd();
const BASE=(process.env.EDAS_SITE_BASE_URL||'https://rodrigorosadantas.github.io/sedes-tdas-dashboard/edas-administracao').replace(/\/$/,'');
const ATTEMPTS=Number(process.env.EDAS_LIVE_MAX_ATTEMPTS||12);
const DELAY=Number(process.env.EDAS_LIVE_RETRY_DELAY_MS||15000);
const REPORT_PATH=process.env.EDAS_LIVE_REPORT_PATH||'/tmp/edas-live-monitor.json';
const readJson=async file=>JSON.parse(await fs.readFile(path.join(ROOT,file),'utf8'));
const readText=file=>fs.readFile(path.join(ROOT,file),'utf8');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const bust=url=>`${url}${url.includes('?')?'&':'?'}monitor=${Date.now()}-${Math.random().toString(16).slice(2)}`;

async function fetchText(url){const response=await fetch(bust(url),{cache:'no-store',headers:{'cache-control':'no-cache'}});if(!response.ok)throw new Error(`${response.status} ${url}`);return response.text();}
async function fetchJson(url){return JSON.parse(await fetchText(url));}
const leaksAnswers=catalog=>(catalog?.questions||[]).some(q=>Object.prototype.hasOwnProperty.call(q,'gabarito')||Object.prototype.hasOwnProperty.call(q,'justificativa'));
const precachesAnswerKey=sw=>{const start=sw.indexOf('const CORE=['),end=sw.indexOf('];',start);return start>=0&&end>start&&sw.slice(start,end).includes('answer-key.json');};

export function compareLive(expected,live){
 const issues=[];const add=(code,detail)=>issues.push({code,detail});
 if(live.site?.meta?.version!==expected.site?.meta?.version)add('VERSION_DIVERGENCE',`main=${expected.site?.meta?.version}; pages=${live.site?.meta?.version}`);
 if(live.site?.meta?.snapshotDate!==expected.site?.meta?.snapshotDate)add('SNAPSHOT_DIVERGENCE',`main=${expected.site?.meta?.snapshotDate}; pages=${live.site?.meta?.snapshotDate}`);
 if(live.site?.today?.sprint!==expected.site?.today?.sprint)add('SPRINT_DIVERGENCE',`main=${expected.site?.today?.sprint}; pages=${live.site?.today?.sprint}`);
 if(live.history?.updatedAt!==expected.history?.updatedAt)add('HISTORY_DIVERGENCE',`main=${expected.history?.updatedAt}; pages=${live.history?.updatedAt}`);
 if(live.catalog?.catalogId!==expected.catalog?.catalogId)add('CATALOG_DIVERGENCE',`main=${expected.catalog?.catalogId}; pages=${live.catalog?.catalogId}`);
 if((live.catalog?.questions||[]).length!==(expected.catalog?.questions||[]).length)add('QUESTION_COUNT_DIVERGENCE',`main=${expected.catalog?.questions?.length}; pages=${live.catalog?.questions?.length}`);
 if(leaksAnswers(live.catalog))add('LIVE_CATALOG_ANSWER_LEAK','O catálogo servido pelo Pages contém gabarito ou justificativa.');
 const version=expected.site?.meta?.version||'';
 if(!live.sw.includes(`const VERSION='edas-${version}'`))add('SW_VERSION_DIVERGENCE',`Service worker publicado não usa edas-${version}.`);
 if(precachesAnswerKey(live.sw))add('ANSWER_KEY_PRECACHE','O GitHub Pages ainda pré-carrega o gabarito EDAS no bloco CORE.');
 if(!live.sw.includes("url.pathname.startsWith(BASE+'data/')"))add('NETWORK_FIRST_MISSING','A estratégia network-first dos dados não está publicada.');
 if(!live.sw.includes('RESERVED_DATA'))add('RESERVED_DATA_GUARD_MISSING','O service worker publicado não remove cópias antigas da correção reservada.');
 if(!live.home.ok)add('HOME_UNAVAILABLE',`status=${live.home.status}`);
 if(!live.resolver.ok)add('RESOLVER_UNAVAILABLE',`status=${live.resolver.status}`);
 return{healthy:issues.length===0,issues,summary:issues.length?`GitHub Pages EDAS divergente: ${issues.map(x=>x.code).join(', ')}.`:`GitHub Pages EDAS alinhado à main: ${expected.site?.today?.sprint||'Sprint'} · ${version}.`};
}

async function expectedState(){return{site:await readJson('edas-administracao/data/site.json'),history:await readJson('edas-administracao/data/sync-history.json'),catalog:await readJson('edas-administracao/data/integration/question-catalog.json'),sw:await readText('edas-administracao/sw.js')};}
async function liveState(){
 const [site,history,catalog,sw,home,resolver]=await Promise.all([
  fetchJson(`${BASE}/data/site.json`),fetchJson(`${BASE}/data/sync-history.json`),fetchJson(`${BASE}/data/integration/question-catalog.json`),fetchText(`${BASE}/sw.js`),fetch(bust(`${BASE}/`),{cache:'no-store'}),fetch(bust(`${BASE}/resolver/`),{cache:'no-store'})
 ]);return{site,history,catalog,sw,home:{ok:home.ok,status:home.status},resolver:{ok:resolver.ok,status:resolver.status}};
}
function markdown(report){const lines=['## Monitoramento do GitHub Pages — EDAS','',`- **Estado:** ${report.healthy?'alinhado':'divergente'}`,`- **Resumo:** ${report.summary}`];if(report.issues.length){lines.push('','### Divergências');for(const x of report.issues)lines.push(`- **${x.code}:** ${x.detail}`);}return lines.join('\n');}

if(process.env.MONITOR_SELF_TEST==='true'){
 const expected={site:{meta:{version:'v1',snapshotDate:'2026-08-07'},today:{sprint:'S12'}},history:{updatedAt:'x'},catalog:{catalogId:'c',questions:[{id:'q'}]}};
 const live={site:structuredClone(expected.site),history:{updatedAt:'x'},catalog:structuredClone(expected.catalog),sw:"const VERSION='edas-v1'; const RESERVED_DATA=[]; const CORE=[]; if(url.pathname.startsWith(BASE+'data/')){}",home:{ok:true,status:200},resolver:{ok:true,status:200}};
 assert.equal(compareLive(expected,live).healthy,true);live.catalog.questions[0].gabarito='A';assert.equal(compareLive(expected,live).healthy,false);console.log('Monitor do GitHub Pages EDAS auditado.');
}else{
 const expected=await expectedState();let last=null;let live=null;
 for(let attempt=1;attempt<=ATTEMPTS;attempt++){
  try{live=await liveState();last=compareLive(expected,live);if(last.healthy)break;}catch(error){last={healthy:false,issues:[{code:'FETCH_FAILED',detail:error.message}],summary:`Falha ao consultar o GitHub Pages EDAS: ${error.message}`};}
  if(attempt<ATTEMPTS)await sleep(DELAY);
 }
 const report={...last,checkedAt:new Date().toISOString(),baseUrl:BASE,expected:{version:expected.site?.meta?.version,snapshotDate:expected.site?.meta?.snapshotDate,sprint:expected.site?.today?.sprint,catalogId:expected.catalog?.catalogId,historyUpdatedAt:expected.history?.updatedAt},observed:live?{version:live.site?.meta?.version,snapshotDate:live.site?.meta?.snapshotDate,sprint:live.site?.today?.sprint,catalogId:live.catalog?.catalogId,historyUpdatedAt:live.history?.updatedAt}:null};report.markdown=markdown(report);await fs.writeFile(REPORT_PATH,JSON.stringify(report,null,2));console.log(report.markdown);if(!report.healthy)process.exitCode=1;
}
