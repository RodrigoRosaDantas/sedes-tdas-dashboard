import {localIso,writeJson} from './config.mjs';
import {queryAll} from './api.mjs';
import {TDAS_SOURCE_MANIFEST} from './source-manifest.mjs';

const required=(condition,message)=>{if(!condition)throw new Error(`Edital vivo TDAS: ${message}`)};
const text=value=>String(value??'').trim();
const number=value=>{if(value==null||text(value)==='')return null;const parsed=Number(value);return Number.isFinite(parsed)?parsed:null};
const normalized=value=>text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
const expectedItems=Number(TDAS_SOURCE_MANIFEST.editalChecklist.expectedItems||0);
const unique=values=>[...new Set(values.filter(Boolean))];
const canonicalId=pageId=>`TDAS202:${text(pageId).replaceAll('-','').toLowerCase()}`;
function riskBucket(value){
 const current=normalized(value);
 if(!current)return'unknown';
 if(current.includes('🔴')||current.includes('critic'))return'critical';
 if(current.includes('🟠')||current.includes('atenc'))return'attention';
 if(current.includes('⚪')||current.includes('sem afer')||current.includes('sem evid'))return'no_evidence';
 if(current.includes('🟢')||current.includes('forte'))return'strong';
 if(current.includes('🟡')||current.includes('estavel'))return'stable';
 return'unknown';
}
const coverageBucket=value=>{const current=normalized(value);if(current.includes('nao estud'))return'not_studied';if(current.includes('revis'))return'review';if(current.includes('estud'))return'studied';return'unknown'};
const priorityRank=value=>({alta:3,media:2,baixa:1}[normalized(value)]||0);
const riskRank=value=>({critical:5,attention:4,no_evidence:3,stable:2,strong:1,unknown:0}[value]||0);
function evidenceReferences(value){
 const raw=text(value),pes=unique([...raw.matchAll(/\bPE\s*0*(\d{1,3})\b/gi)].map(match=>`PE${String(Number(match[1])).padStart(2,'0')}`));
 const questions=unique([...raw.matchAll(/\bPE\s*0*(\d{1,3})\s*\/\s*Q\s*0*(\d{1,3})\b/gi)].map(match=>`PE${String(Number(match[1])).padStart(2,'0')}/Q${Number(match[2])}`));
 return{pes,questions};
}
function recordFromPage(page){
 const p=page.properties||{},rawQuestions=number(p['Questões']),rawCorrect=number(p['Acertos']),formulaAccuracy=number(p['Aproveitamento']);
 const questions=rawQuestions!=null&&rawQuestions>0?rawQuestions:0,measured=questions>0,correct=rawCorrect??0;
 const accuracy=measured?(formulaAccuracy!=null?formulaAccuracy:(correct/questions*100)):null;
 const evidence=text(p['Evidência de estudo']);
 return{
  id:page.id,canonicalId:canonicalId(page.id),url:page.url,code:text(p['Código']),topic:text(p['Tópico']||page.title),discipline:text(p['Disciplina'])||'Sem disciplina',block:text(p['Bloco']),
  coverage:text(p['Cobertura de estudo']),coverageBucket:coverageBucket(p['Cobertura de estudo']),priority:text(p['Prioridade edital/ciclo']),
  strategicAction:text(p['Ação estratégica inicial']),evidence,questions,correct,accuracy,lastReview:text(p['Última revisão']),
  ray:text(p['Raio-X automático']),risk:riskBucket(p['Raio-X automático']),nextAction:text(p['Próxima ação automática']),lastEditedTime:page.last_edited_time||'',
  measurement:{state:measured?'measured':'unmeasured',questions,correct:measured?correct:null,errors:measured?questions-correct:null,accuracy},
  references:evidenceReferences(evidence)
 };
}
export function buildEditalStatus(pages=[],generatedAt=localIso()){
 required(Array.isArray(pages)&&pages.length>0,'checklist retornou zero registros.');
 const records=pages.map(recordFromPage);
 required(records.every(item=>item.topic),'há registro sem Tópico.');
 required(records.every(item=>!/EDAS|Cargo\s*400/i.test(`${item.topic} ${item.discipline} ${item.block}`)),'conteúdo do Cargo 400 apareceu no checklist do Cargo 202.');
 required(new Set(records.map(item=>item.canonicalId)).size===records.length,'há IDs canônicos duplicados no checklist.');
 for(const item of records){
  required(item.questions>=0,`${item.canonicalId} possui quantidade de questões negativa.`);
  if(item.measurement.state==='measured'){
   required(item.correct>=0&&item.correct<=item.questions,`${item.canonicalId} possui Acertos incompatíveis com Questões.`);
   required(item.accuracy!=null&&item.accuracy>=0&&item.accuracy<=100,`${item.canonicalId} possui Aproveitamento inválido.`);
  }else required(item.accuracy==null,`${item.canonicalId} não possui bateria específica, mas recebeu percentual.`);
 }
 const coverage={studied:0,review:0,not_studied:0,unknown:0},risk={critical:0,attention:0,no_evidence:0,strong:0,stable:0,unknown:0};
 for(const item of records){coverage[item.coverageBucket]=(coverage[item.coverageBucket]||0)+1;risk[item.risk]=(risk[item.risk]||0)+1}
 const withQuestions=records.filter(item=>item.measurement.state==='measured'),questions=withQuestions.reduce((sum,item)=>sum+item.questions,0),correct=withQuestions.reduce((sum,item)=>sum+item.correct,0),errors=questions-correct;
 const byDiscipline=new Map();
 for(const item of records){
  const current=byDiscipline.get(item.discipline)||{discipline:item.discipline,items:0,covered:0,critical:0,attention:0,noEvidence:0,questionItems:0,unmeasured:0,questions:0,correct:0};
  current.items++;if(item.coverageBucket==='studied'||item.coverageBucket==='review')current.covered++;if(item.risk==='critical')current.critical++;if(item.risk==='attention')current.attention++;if(item.risk==='no_evidence')current.noEvidence++;
  if(item.measurement.state==='measured'){current.questionItems++;current.questions+=item.questions;current.correct+=item.correct}else current.unmeasured++;
  byDiscipline.set(item.discipline,current);
 }
 const disciplines=[...byDiscipline.values()].map(item=>({...item,accuracy:item.questions?item.correct/item.questions*100:null})).sort((a,b)=>b.critical-a.critical||b.attention-a.attention||b.items-a.items||a.discipline.localeCompare(b.discipline,'pt-BR'));
 const priorityTopics=[...records].sort((a,b)=>riskRank(b.risk)-riskRank(a.risk)||priorityRank(b.priority)-priorityRank(a.priority)||(a.accuracy??101)-(b.accuracy??101)||a.topic.localeCompare(b.topic,'pt-BR')).slice(0,24);
 const latestEdited=records.map(item=>item.lastEditedTime).filter(Boolean).sort().at(-1)||'';
 const measured=withQuestions.length,unmeasured=records.length-measured,accuracy=questions?correct/questions*100:null;
 return{
  schemaVersion:'1.1.0',generatedAt,
  analyticsPolicy:{canonicalIdentity:'notion-page-id',topicPerformance:'explicit-topic-counters-only',peAggregation:'never-distributed-to-topics',missingEvidence:'null-not-zero'},
  source:{name:TDAS_SOURCE_MANIFEST.editalChecklist.name,url:TDAS_SOURCE_MANIFEST.editalChecklist.url,viewUrl:TDAS_SOURCE_MANIFEST.editalChecklist.viewUrl||TDAS_SOURCE_MANIFEST.editalChecklist.url,dataSourceId:TDAS_SOURCE_MANIFEST.editalChecklist.dataSourceId,checkUrl:TDAS_SOURCE_MANIFEST.editalCheck.url,lastEditedTime:latestEdited},
  summary:{total:records.length,coverage,risk,evidence:{measured,unmeasured},granular:{questions,correct,errors,accuracy},contentGaps:(coverage.not_studied||0)+(coverage.unknown||0),highPriority:records.filter(item=>normalized(item.priority)==='alta').length,questionItems:measured,questions,correct,accuracy},
  disciplines,priorityTopics,topics:records
 };
}
export async function syncEditalStatus({write=true}={}){
 const pages=await queryAll(TDAS_SOURCE_MANIFEST.editalChecklist);
 const status=buildEditalStatus(pages);
 required(!expectedItems||status.summary.total===expectedItems,`checklist retornou ${status.summary.total} itens; esperado exatamente ${expectedItems} na verticalização vigente.`);
 if(write)await writeJson('data/edital-status.json',status);
 console.log(`Edital vivo: ${status.summary.total} tópicos; aferidos=${status.summary.evidence.measured}; sem bateria=${status.summary.evidence.unmeasured}; críticos=${status.summary.risk.critical}; atenção=${status.summary.risk.attention}; lacunas=${status.summary.contentGaps}.`);
 return status;
}
