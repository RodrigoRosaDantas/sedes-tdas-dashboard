import {DIAGNOSTIC_STORAGE_KEY,readDiagnosticState,normalizeTopicKey,diagnosticSearchTerm} from './edital-diagnostic.js?v=1.0.0';
import {queueMutableRecord} from './persistence-queue.js?v=1.0.0';
import {syncPrivateHistory} from './private-history-sync-v3.js?v=3.1.0';
import {dbList,STORES} from './history-db-core.js?v=1.0.0';
import {getPrivateSession,privateHistoryEnabled} from './private-history-auth.js?v=1.2.0';

const BASE='/sedes-tdas-dashboard/';
const MAX_ATTEMPTS=120;
const text=value=>String(value??'').trim();
const safe=value=>text(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmtPct=value=>Number.isFinite(Number(value))?`${Number(value).toFixed(0)}%`:'—';
const canonicalId=item=>item?.canonicalId||`TDAS202:${text(item?.id).replaceAll('-','').toLowerCase()}`;
const measurementState=item=>item?.measurement?.state||(Number(item?.questions)>0?'measured':'unmeasured');
const riskRank=value=>({critical:5,attention:4,no_evidence:3,stable:2,strong:1}[value]||0);
const priorityRank=value=>{const key=normalizeTopicKey(value);return key==='alta'?3:key==='media'?2:key==='baixa'?1:0};
const sortTopics=(a,b)=>riskRank(b.risk)-riskRank(a.risk)||priorityRank(b.priority)-priorityRank(a.priority)||text(a.topic).localeCompare(text(b.topic),'pt-BR');
const waitFor=(selector,timeout=15000)=>new Promise(resolve=>{const found=document.querySelector(selector);if(found)return resolve(found);const observer=new MutationObserver(()=>{const node=document.querySelector(selector);if(node){observer.disconnect();resolve(node)}});observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>{observer.disconnect();resolve(null)},timeout)});

export function diagnosticUrlForTopic(item,count=10){const params=new URLSearchParams({modo:'banco',source:'edital',editalId:canonicalId(item),editalTopic:text(item?.topic),editalCode:text(item?.code),editalDiscipline:text(item?.discipline),q:diagnosticSearchTerm(item?.topic),count:String(Math.max(1,Math.min(50,Number(count)||10)))});return`${BASE}resolver/?${params.toString()}`}

export function buildEditalEvidenceSummary({edital={},diagnosticState=null,storage}={}){
 const state=diagnosticState||readDiagnosticState(storage),topics=Array.isArray(edital?.topics)?edital.topics:[],latestByTopic={};
 for(const attempt of state.attempts||[]){if(attempt?.measurementEligible!==true)continue;const id=text(attempt?.target?.canonicalId);if(!id)continue;if(!latestByTopic[id]||Number(attempt.finishedAt||0)>Number(latestByTopic[id].finishedAt||0))latestByTopic[id]=attempt}
 const officialUnmeasured=topics.filter(item=>measurementState(item)==='unmeasured'),officialMeasured=topics.filter(item=>measurementState(item)!=='unmeasured');
 const exactCurrent=officialUnmeasured.map(item=>({item,attempt:latestByTopic[canonicalId(item)]||null})).filter(row=>row.attempt).sort((a,b)=>Number(a.attempt.percent??101)-Number(b.attempt.percent??101)||sortTopics(a.item,b.item));
 const pending=officialUnmeasured.filter(item=>!latestByTopic[canonicalId(item)]).sort(sortTopics),intentOnly=(state.attempts||[]).filter(item=>item?.measurementEligible!==true);
 const nextDiagnostic=pending[0]||null,lowestExact=exactCurrent[0]||null;
 return Object.freeze({
  totalTopics:topics.length,
  officialMeasured:officialMeasured.length,
  officialUnmeasured:officialUnmeasured.length,
  localExactCurrent:exactCurrent.length,
  localExactAll:Object.keys(latestByTopic).length,
  pending:pending.length,
  highPriorityPending:pending.filter(item=>normalizeTopicKey(item.priority)==='alta').length,
  intentOnly:intentOnly.length,
  nextDiagnostic,
  lowestExact,
  pendingTopics:pending,
  exactCurrent,
  latestByTopic,
  recommendation:nextDiagnostic?Object.freeze({kind:'measure',topic:nextDiagnostic.topic,discipline:nextDiagnostic.discipline,url:diagnosticUrlForTopic(nextDiagnostic),reason:'Tópico ainda sem bateria oficial nem aferição local exata.'}):lowestExact?Object.freeze({kind:'revisit',topic:lowestExact.item.topic,discipline:lowestExact.item.discipline,url:diagnosticUrlForTopic(lowestExact.item),reason:`Menor aferição local disponível: ${fmtPct(lowestExact.attempt.percent)} em ${lowestExact.attempt.total} questão(ões).`}):null,
 });
}

function validRemoteAttempt(value){
 if(!value||!value.attemptId||!value.target||!/^TDAS202:[a-f0-9]{32}$/i.test(text(value.target.canonicalId))||!text(value.target.topic))return null;
 return{attemptId:text(value.attemptId),catalogId:text(value.catalogId),target:{source:'edital',canonicalId:text(value.target.canonicalId),topic:text(value.target.topic),code:text(value.target.code),discipline:text(value.target.discipline),searchTerm:text(value.target.searchTerm)||diagnosticSearchTerm(value.target.topic)},measurementEligible:value.measurementEligible===true,attribution:value.measurementEligible===true?'exact-assunto':'intent-only',correct:Math.max(0,Number(value.correct)||0),total:Math.max(0,Number(value.total)||0),percent:Number.isFinite(Number(value.percent))?Number(value.percent):null,finishedAt:Number(value.finishedAt)||0,recordedAt:Number(value.recordedAt)||Number(value.finishedAt)||Date.now()};
}

export function mergeRemoteDiagnosticEvidence(remoteRows=[],storage=globalThis.localStorage){
 if(!storage||typeof storage.setItem!=='function')return readDiagnosticState(storage);
 const current=readDiagnosticState(storage),map=new Map((current.attempts||[]).map(item=>[item.attemptId,item]));
 for(const row of remoteRows){const candidate=validRemoteAttempt(row?.payload??row);if(!candidate)continue;const old=map.get(candidate.attemptId);if(!old||Number(candidate.recordedAt||candidate.finishedAt)>=Number(old.recordedAt||old.finishedAt))map.set(candidate.attemptId,candidate)}
 const attempts=[...map.values()].sort((a,b)=>Number(b.finishedAt||0)-Number(a.finishedAt||0)||Number(b.recordedAt||0)-Number(a.recordedAt||0)).slice(0,MAX_ATTEMPTS),next={schemaVersion:'1.0.0',updatedAt:Date.now(),active:current.active||{},attempts};storage.setItem(DIAGNOSTIC_STORAGE_KEY,JSON.stringify(next));return readDiagnosticState(storage);
}

export async function syncDiagnosticEvidence(){
 if(typeof localStorage==='undefined'||typeof indexedDB==='undefined'||!privateHistoryEnabled())return{status:'disabled',uploaded:0,remote:0};
 const local=readDiagnosticState();
 for(const attempt of local.attempts||[])await queueMutableRecord('state',`editalDiagnostic:${attempt.attemptId}`,attempt,attempt.recordedAt||attempt.finishedAt,{recordType:'editalDiagnostic',recordId:attempt.attemptId});
 const sync=await syncPrivateHistory().catch(error=>({status:'partial',error:String(error?.message||error)})),session=await getPrivateSession().catch(()=>null);if(!session?.user?.id)return{...sync,remote:0};
 const rows=(await dbList(STORES.meta).catch(()=>[])).filter(row=>row.userId===session.user.id&&row.value?.recordType==='editalDiagnostic').map(row=>row.value);mergeRemoteDiagnosticEvidence(rows);return{...sync,remote:rows.length};
}

async function loadEdital(){try{const response=await fetch(BASE+'data/edital-status.json',{cache:'no-store'});return response.ok?response.json():null}catch{return null}}
function evidenceMetrics(summary){return`<div class="grid metrics"><article class="card metric"><small>Aferidos oficialmente</small><strong>${summary.officialMeasured}</strong><span>de ${summary.totalTopics} tópicos</span></article><article class="card metric"><small>Aferidos localmente</small><strong>${summary.localExactCurrent}</strong><span>ainda sem bateria oficial</span></article><article class="card metric"><small>Lacunas restantes</small><strong>${summary.pending}</strong><span>${summary.highPriorityPending} de prioridade alta</span></article><article class="card metric"><small>Tentativas auxiliares</small><strong>${summary.intentOnly}</strong><span>não entram na aferição tópica</span></article></div>`}
function nextCard(summary){const item=summary.nextDiagnostic;if(!item)return'<article class="card panel"><small>Fila de evidência</small><h3>Sem lacuna local pendente</h3><p>Todos os tópicos oficialmente sem bateria já possuem ao menos uma aferição local com correspondência exata de Assunto.</p></article>';return`<article class="card panel"><small>Próxima bateria diagnóstica</small><h3>${safe(item.topic)}</h3><p>${safe(item.discipline)} · ${item.risk==='critical'?'risco crítico':item.risk==='attention'?'em atenção':'sem evidência granular'}.</p><div class="hero-actions"><a class="btn primary" href="${safe(diagnosticUrlForTopic(item))}">Aferir 10 questões →</a><a class="btn" href="${BASE}edital/?q=${encodeURIComponent(item.topic)}">Ver no Edital</a></div></article>`}
function lowestCard(summary){const row=summary.lowestExact;if(!row)return'';return`<article class="card panel"><small>Menor aferição local disponível</small><h3>${safe(row.item.topic)}</h3><p>${row.attempt.correct}/${row.attempt.total} · ${fmtPct(row.attempt.percent)} · vínculo exato de Assunto. Isso é evidência local, não percentual oficial do Notion.</p><div class="hero-actions"><a class="btn" href="${safe(diagnosticUrlForTopic(row.item))}">Nova bateria</a></div></article>`}

async function renderEdital(summary){const box=await waitFor('.edital-diagnostic-summary');if(box){const cards=box.querySelectorAll(':scope > div');if(cards[0]?.querySelector('strong'))cards[0].querySelector('strong').textContent=String(summary.pending);if(cards[1]?.querySelector('strong'))cards[1].querySelector('strong').textContent=String(summary.localExactCurrent)}for(const node of document.querySelectorAll('.edital-detail-foot .mono')){const hit=summary.latestByTopic[text(node.textContent)];if(!hit)continue;const details=node.closest('.edital-detail');if(!details||details.querySelector('[data-local-diagnostic]'))continue;const badge=document.createElement('div');badge.className='edital-local-diagnostic';badge.dataset.localDiagnostic='1';badge.innerHTML=`<strong>✓ Aferição privada exata</strong><span>${hit.correct}/${hit.total} · ${fmtPct(hit.percent)} · disponível neste histórico privado</span>`;details.append(badge)}}
async function renderPerformance(summary){const hero=await waitFor('main .hero');if(!hero||document.querySelector('[data-edital-evidence-performance]'))return;const section=document.createElement('section');section.className='section';section.dataset.editalEvidencePerformance='1';section.innerHTML=`<div class="section-head"><div><span class="kicker">Evidência do Edital</span><h2>O que já foi medido e o que ainda precisa de bateria</h2><p>Camada privada e auditável. Não altera a Evolução oficial, os PE nem o Notion.</p></div><a class="btn" href="${BASE}edital/">Abrir Edital</a></div>${evidenceMetrics(summary)}<div class="grid two">${nextCard(summary)}${lowestCard(summary)}</div>`;hero.after(section)}
async function renderMentor(summary){const anchor=await waitFor('main .mentor-now, main .mentor-hero');if(!anchor||document.querySelector('[data-edital-evidence-mentor]'))return;const section=document.createElement('section');section.className='section';section.dataset.editalEvidenceMentor='1';section.innerHTML=`<div class="section-head"><div><span class="kicker">Lacuna de evidência</span><h2>O que o Mentor ainda precisa medir</h2><p>Esta camada não modifica o score 0–100 de gravidade. Ela separa “não tenho evidência” de “tenho evidência de dificuldade”.</p></div></div>${evidenceMetrics(summary)}<div class="grid two">${nextCard(summary)}${lowestCard(summary)}</div>`;anchor.after(section)}
async function renderHome(summary){const anchor=await waitFor('[data-study-intelligence], main .tdas-dashboard-section');if(!anchor||document.querySelector('[data-edital-evidence-home]'))return;const section=document.createElement('section');section.className='tdas-dashboard-section';section.dataset.editalEvidenceHome='1';const item=summary.nextDiagnostic;section.innerHTML=`<div class="section-head"><div><span class="kicker">Sua maior oportunidade agora</span><h2>${safe(item?.topic||'Fila diagnóstica local concluída')}</h2><p>${item?`${safe(item.discipline)} · ainda sem bateria oficial ou aferição privada exata.`:`${summary.localExactCurrent} tópicos sem bateria oficial já possuem aferição privada exata.`}</p></div><div class="hero-actions">${item?`<a class="btn primary" href="${safe(diagnosticUrlForTopic(item))}">Aferir agora →</a>`:''}<a class="btn" href="${BASE}edital/">Ver Edital</a></div></div>`;anchor.after(section)}
function observeResolverSync(){const run=()=>{if(document.querySelector('[data-edital-result-note]'))syncDiagnosticEvidence().catch(()=>{})};run();const observer=new MutationObserver(run);observer.observe(document.querySelector('main')||document.body,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),120000)}

async function init(){
 const path=location.pathname.replace(/\/+$/,'/');
 if(path.endsWith('/resolver/')){observeResolverSync();return}
 await syncDiagnosticEvidence().catch(()=>{});
 const edital=await loadEdital();if(!edital)return;const summary=buildEditalEvidenceSummary({edital});
 if(path.endsWith('/edital/'))await renderEdital(summary);
 else if(path.endsWith('/desempenho/'))await renderPerformance(summary);
 else if(path.endsWith('/mentor/'))await renderMentor(summary);
 else if(path===BASE||path===BASE+'index.html')await renderHome(summary);
}

if(typeof window!=='undefined'&&typeof document!=='undefined')init().catch(error=>console.warn('Evidência privada do Edital indisponível:',error));
