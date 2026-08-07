import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.cwd();
const TIME_ZONE='America/Sao_Paulo';
const REPORT_PATH=process.env.EDAS_MONITOR_REPORT_PATH||'/tmp/edas-publication-monitor.json';
const DEFAULT_MAX_AGE_MINUTES=420;
const readText=file=>fs.readFile(path.join(ROOT,file),'utf8');
const readJson=async file=>JSON.parse(await readText(file));
const validIso=value=>!Number.isNaN(Date.parse(String(value||'')));
const sprintCode=value=>String(value||'').toUpperCase().match(/^S\d{2}$/)?.[0]||'';
const issue=(code,message,detail='')=>({code,message,detail});
const warning=(code,message,detail='')=>({code,message,detail});

function formatLocal(value){
 const date=new Date(value);if(Number.isNaN(date.getTime()))return'não informada';
 return new Intl.DateTimeFormat('pt-BR',{timeZone:TIME_ZONE,day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(date).replace(',',' às');
}
function localDate(value){return new Intl.DateTimeFormat('en-CA',{timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}
function latestValidEvent(history){return (history?.events||[]).filter(item=>['success','no_changes'].includes(item?.status)&&validIso(item?.at)).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0]||null;}
function latestPreservationWarning(history){return (history?.events||[]).filter(item=>item?.status==='warning'&&/quest(ões|oes).*(sem acesso|indispon)|cat[aá]logo.*preserv/i.test(`${item?.title||''} ${item?.detail||''}`)).sort((a,b)=>Date.parse(b.at||0)-Date.parse(a.at||0))[0]||null;}
function catalogLeaksAnswers(catalog){return (catalog?.questions||[]).some(q=>Object.prototype.hasOwnProperty.call(q,'gabarito')||Object.prototype.hasOwnProperty.call(q,'justificativa'));}
function answerKeyInPrecache(sw){const start=sw.indexOf('const CORE=['),end=sw.indexOf('];',start);return start>=0&&end>start&&sw.slice(start,end).includes('answer-key.json');}

export function evaluateEdas({site,history,catalog,answerKey,commonJs,sw,player,now=new Date(),requireFreshness=false,maxAgeMinutes=DEFAULT_MAX_AGE_MINUTES}){
 const issues=[];const warnings=[];
 const version=String(site?.meta?.version||'');
 const sprint=sprintCode(site?.today?.sprint);
 const catalogSprint=sprintCode(catalog?.sprintId);
 const planned=Number(site?.today?.planned);
 const questions=Array.isArray(catalog?.questions)?catalog.questions:[];
 const answers=answerKey?.answers&&typeof answerKey.answers==='object'?answerKey.answers:{};
 const commonRelease=commonJs.match(/export const RELEASE='([^']+)'/)?.[1]||'';
 const swVersion=sw.match(/const VERSION='edas-([^']+)'/)?.[1]||'';
 const latest=latestValidEvent(history);
 const preserved=latestPreservationWarning(history);

 if(!version)issues.push(issue('VERSION_MISSING','O snapshot EDAS não informa versão.'));
 if(history?.release!==version)issues.push(issue('HISTORY_VERSION_DIVERGENCE','Histórico e snapshot usam versões diferentes.',`site=${version}; histórico=${history?.release||'ausente'}`));
 if(commonRelease!==version)issues.push(issue('COMMON_VERSION_DIVERGENCE','common.js não usa a versão do snapshot.',`site=${version}; common=${commonRelease||'ausente'}`));
 if(swVersion!==version)issues.push(issue('SW_VERSION_DIVERGENCE','Service worker não usa a versão do snapshot.',`site=${version}; sw=${swVersion||'ausente'}`));
 if(!sprint)issues.push(issue('SPRINT_INVALID','O Sprint atual do EDAS é inválido.',String(site?.today?.sprint||'ausente')));
 if(Number(site?.plan?.totalSprints)!==42)issues.push(issue('SPRINT_TOTAL_INVALID','O planejamento EDAS deve preservar 42 Sprints.',String(site?.plan?.totalSprints)));
 if(!catalog?.catalogId||!catalogSprint||questions.length===0)issues.push(issue('CATALOG_INVALID','O catálogo oficial está ausente ou incompleto.'));

 const preservedCatalog=catalogSprint&&sprint&&catalogSprint!==sprint&&preserved;
 if(catalogSprint&&sprint&&catalogSprint!==sprint){
  if(preservedCatalog)warnings.push(warning('CATALOG_PRESERVED','O catálogo anterior foi preservado por indisponibilidade documentada da fonte.',`Sprint atual=${sprint}; catálogo=${catalogSprint}; aviso=${preserved.title}`));
  else issues.push(issue('CATALOG_SPRINT_DIVERGENCE','O catálogo não corresponde ao Sprint atual.',`Sprint atual=${sprint}; catálogo=${catalogSprint}`));
 }
 if(Number.isFinite(planned)&&planned>0&&catalogSprint===sprint&&questions.length!==planned)issues.push(issue('QUESTION_COUNT_DIVERGENCE','A bateria publicada diverge da meta objetiva do Sprint.',`planejado=${planned}; catálogo=${questions.length}`));
 if(catalogLeaksAnswers(catalog))issues.push(issue('CATALOG_ANSWER_LEAK','O catálogo público contém gabarito ou justificativa.'));
 if(answerKey?.catalogId!==catalog?.catalogId)issues.push(issue('ANSWER_KEY_CATALOG_DIVERGENCE','A ficha de correção não corresponde ao catálogo atual.',`catálogo=${catalog?.catalogId||'ausente'}; chave=${answerKey?.catalogId||'ausente'}`));
 if(Object.keys(answers).length!==questions.length)issues.push(issue('ANSWER_KEY_COUNT_DIVERGENCE','A ficha de correção não possui uma resposta para cada questão.',`questões=${questions.length}; respostas=${Object.keys(answers).length}`));
 const ids=new Set(questions.map(q=>q.id));
 if(Object.keys(answers).some(id=>!ids.has(id)))issues.push(issue('ANSWER_KEY_EXTRA_ID','A ficha de correção contém ID inexistente no catálogo.'));
 if(questions.some(q=>!answers[q.id]?.gabarito))issues.push(issue('ANSWER_KEY_MISSING_ID','Há questão sem gabarito correspondente na ficha reservada.'));
 if(answerKeyInPrecache(sw))issues.push(issue('ANSWER_KEY_PRECACHE','O gabarito reservado está no bloco CORE do precache.'));
 if(!sw.includes("url.pathname.startsWith(BASE+'data/')"))issues.push(issue('DATA_NETWORK_FIRST_MISSING','O service worker não mantém a estratégia network-first para dados EDAS.'));
 if(!sw.includes('RESERVED_DATA'))issues.push(issue('RESERVED_DATA_GUARD_MISSING','O service worker não remove cópias antigas do gabarito durante atualização.'));
 if(!player.includes("fetch('../data/integration/answer-key.json"))issues.push(issue('PLAYER_KEY_FETCH_MISSING','O player não contém a carga explícita da ficha de correção.'));
 const finishIndex=player.indexOf('const finish=async');const keyCallIndex=player.indexOf('readAnswerKey(catalog)');
 if(finishIndex<0||keyCallIndex<finishIndex)issues.push(issue('PLAYER_KEY_GATE_INVALID','A ficha de correção não está claramente condicionada à finalização da sessão.'));

 if(requireFreshness){
  const nowDate=localDate(now);
  if(String(site?.meta?.snapshotDate||'')!==nowDate)issues.push(issue('SNAPSHOT_STALE','O snapshot EDAS não corresponde à data atual.',`snapshot=${site?.meta?.snapshotDate||'ausente'}; esperado=${nowDate}`));
  if(!latest)issues.push(issue('HISTORY_VALID_EVENT_MISSING','O histórico EDAS não possui revalidação válida.'));
  else{
   const age=Math.floor((new Date(now).getTime()-Date.parse(latest.at))/60000);
   if(age< -10)issues.push(issue('HISTORY_EVENT_FUTURE','A última revalidação EDAS está registrada no futuro.',latest.at));
   if(age>maxAgeMinutes)issues.push(issue('HISTORY_STALE',`O EDAS está há ${age} minutos sem revalidação técnica válida.`,`Limite=${maxAgeMinutes}; última=${formatLocal(latest.at)}`));
  }
 }
 const healthy=issues.length===0;
 return{healthy,status:healthy?(warnings.length?'degraded':'healthy'):'blocked',checkedAt:new Date(now).toISOString(),checkedAtLocal:formatLocal(now),version,sprint,catalogSprint,planned:Number.isFinite(planned)?planned:null,questionCount:questions.length,latestValidationAt:latest?.at||null,latestValidationAtLocal:formatLocal(latest?.at),issues,warnings,summary:healthy?`${sprint||'EDAS'}: publicação local íntegra${warnings.length?' com preservação controlada do catálogo anterior':''}.`:`EDAS inconsistente: ${issues.map(x=>x.code).join(', ')}.`};
}

function markdown(report){
 const lines=['## Monitoramento da publicação EDAS','','- **Estado:** '+(report.healthy?(report.warnings.length?'íntegro com ressalva':'íntegro'):'inconsistente'),`- **Sprint atual:** ${report.sprint||'não identificado'}`,`- **Versão:** ${report.version||'não identificada'}`,`- **Catálogo:** ${report.catalogSprint||'não identificado'} · ${report.questionCount} questões`,`- **Última revalidação:** ${report.latestValidationAtLocal||'não informada'}`,`- **Resumo:** ${report.summary}`];
 if(report.warnings.length){lines.push('','### Ressalvas');for(const x of report.warnings)lines.push(`- **${x.code}:** ${x.message}${x.detail?` — ${x.detail}`:''}`);}
 if(report.issues.length){lines.push('','### Inconsistências');for(const x of report.issues)lines.push(`- **${x.code}:** ${x.message}${x.detail?` — ${x.detail}`:''}`);}
 return lines.join('\n');
}

async function loadCurrent(){
 const [site,history,catalog,answerKey,commonJs,sw,player]=await Promise.all([
  readJson('edas-administracao/data/site.json'),readJson('edas-administracao/data/sync-history.json'),readJson('edas-administracao/data/integration/question-catalog.json'),readJson('edas-administracao/data/integration/answer-key.json'),readText('edas-administracao/assets/common.js'),readText('edas-administracao/sw.js'),readText('edas-administracao/assets/integration/module-player.js')
 ]);return{site,history,catalog,answerKey,commonJs,sw,player};
}

if(process.env.MONITOR_SELF_TEST==='true'){
 const fixture={site:{meta:{version:'20260807.1',snapshotDate:'2026-08-07'},plan:{totalSprints:42},today:{sprint:'S12',planned:2}},history:{release:'20260807.1',events:[{at:'2026-08-07T16:00:00-03:00',status:'no_changes'}]},catalog:{catalogId:'c1',sprintId:'S12',questions:[{id:'q1'},{id:'q2'}]},answerKey:{catalogId:'c1',answers:{q1:{gabarito:'A'},q2:{gabarito:'B'}}},commonJs:"export const RELEASE='20260807.1';",sw:"const VERSION='edas-20260807.1'; const RESERVED_DATA=[]; const CORE=[]; if(url.pathname.startsWith(BASE+'data/')){}",player:"const finish=async()=>{const key=await readAnswerKey(catalog)}; fetch('../data/integration/answer-key.json')"};
 const ok=evaluateEdas({...fixture,now:new Date('2026-08-07T16:30:00-03:00'),requireFreshness:true});assert.equal(ok.healthy,true);
 const leak=evaluateEdas({...fixture,catalog:{...fixture.catalog,questions:[{id:'q1',gabarito:'A'},{id:'q2'}]}});assert.equal(leak.healthy,false);assert.ok(leak.issues.some(x=>x.code==='CATALOG_ANSWER_LEAK'));
 console.log('Monitor EDAS auditado: versão, Sprint, catálogo, gabarito, PWA e frescor cobertos.');
}else{
 const current=await loadCurrent();const report=evaluateEdas({...current,requireFreshness:process.env.REQUIRE_EDAS_FRESHNESS==='true',maxAgeMinutes:Number(process.env.EDAS_MAX_AGE_MINUTES||DEFAULT_MAX_AGE_MINUTES)});report.markdown=markdown(report);await fs.writeFile(REPORT_PATH,JSON.stringify(report,null,2));console.log(report.markdown);if(!report.healthy)process.exitCode=1;
}
