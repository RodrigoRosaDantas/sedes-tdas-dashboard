import {loadAllCatalogs} from './question-catalog-archive.js?v=1.1.0';

const BASE='/sedes-tdas-dashboard/';
const MASTER_PATH='data/integration/master-question-bank.json';
const safeKeyPath=path=>/^data\/integration\/question-keys\/[a-z0-9._-]+\.json$/i.test(String(path||''));
const text=value=>String(value??'').trim();
export const normalizeBankText=value=>text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export const questionMateria=question=>text(question?.materia||question?.disciplina||question?.area||question?.subject||'');

export function flattenBankCatalogs(catalogs=[]){
 const seen=new Set(),rows=[];
 for(const catalog of catalogs){
  if(!catalog||!Array.isArray(catalog.questions))continue;
  for(const question of catalog.questions){
   const id=text(question?.id);if(!id||seen.has(id))continue;seen.add(id);
   rows.push({...question,sourceCatalogId:text(catalog.catalogId),sourcePe:text(catalog.peId),sourceTitle:text(catalog.title),sourceKeyPath:text(catalog.keyPath),sourceKind:text(question.sourceKind)||'daily-catalog',materia:questionMateria(question)});
  }
 }
 return rows;
}
export function flattenMasterSnapshot(snapshot){
 if(!snapshot||snapshot.mode!=='tdas-master-question-bank'||!Array.isArray(snapshot.questions))return[];
 return snapshot.questions.filter(question=>question?.id&&question?.enunciado&&!('gabarito'in question)).map(question=>({...question,materia:questionMateria(question),sourcePe:text(question.sourcePe)||'Banco Mestre',sourceKind:'master-bank',sourceKeyPath:text(question.sourceKeyPath||snapshot.keyPath)}));
}
const unique=values=>[...new Set(values.map(text).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR',{numeric:true,sensitivity:'base'}));
export function bankFacets(questions=[]){return{pes:unique(questions.map(q=>q.sourcePe)),materias:unique(questions.map(questionMateria)),assuntos:unique(questions.map(q=>q.assunto)),materiais:unique(questions.map(q=>q.materialName)),bancas:unique(questions.map(q=>q.banca)),tipos:unique(questions.map(q=>q.tipoMaterial))}}
export function filterBankQuestions(questions=[],filters={}){
 const pe=text(filters.pe),materia=text(filters.materia),assunto=text(filters.assunto),material=text(filters.material),banca=text(filters.banca),tipo=text(filters.tipo),query=normalizeBankText(filters.query);
 return questions.filter(question=>{
  if(pe&&question.sourcePe!==pe)return false;
  if(materia&&questionMateria(question)!==materia)return false;
  if(assunto&&text(question.assunto)!==assunto)return false;
  if(material&&text(question.materialName)!==material)return false;
  if(banca&&text(question.banca)!==banca)return false;
  if(tipo&&text(question.tipoMaterial)!==tipo)return false;
  if(query){const haystack=normalizeBankText([question.id,question.codigo,question.sourcePe,questionMateria(question),question.assunto,question.subassunto,question.materialName,question.banca,question.orgao,question.enunciado].join(' '));if(!haystack.includes(query))return false;}
  return true;
 });
}
function hashString(value){let hash=2166136261;for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619)}return(hash>>>0).toString(36)}
function seededRandom(seed){let state=(Number(seed)||0x6d2b79f5)>>>0;return()=>{state+=0x6d2b79f5;let t=state;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
export function selectBankQuestions(questions=[],count=questions.length,{random=false,seed=Date.now()}={}){
 const limit=Math.max(0,Math.min(questions.length,Math.floor(Number(count)||0)));if(!random)return questions.slice(0,limit);
 const rows=[...questions],rnd=seededRandom(seed);for(let i=rows.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[rows[i],rows[j]]=[rows[j],rows[i]]}return rows.slice(0,limit);
}
export function buildBankCatalog(questions=[],options={}){
 if(!Array.isArray(questions)||!questions.length)throw new TypeError('Selecione ao menos uma questão para iniciar a bateria.');
 const ids=questions.map(q=>text(q.id));if(ids.some(id=>!id)||new Set(ids).size!==ids.length)throw new TypeError('A bateria contém questões inválidas ou duplicadas.');
 const fingerprint=hashString(ids.join('|'));
 return{schemaVersion:'2.1.0',mode:'question-bank',catalogId:`tdas-bank-${fingerprint}`,title:options.title||`Banco de questões — ${questions.length} itens`,description:'Bateria montada a partir dos catálogos autorizados e do Banco Mestre publicado. A correção continua oculta até a finalização.',peId:'BANCO',questionCount:questions.length,suggestedMinutes:Math.max(1,Math.round(questions.length*1.5)),questions:questions.map(question=>({...question}))};
}
export function rebuildBankCatalogFromDraft(draft,questions=[]){
 if(!draft?.catalogId?.startsWith('tdas-bank-')||!Array.isArray(draft?.session?.questionIds))return null;
 const byId=new Map(questions.map(question=>[text(question.id),question]));const selected=draft.session.questionIds.map(id=>byId.get(text(id)));
 if(selected.some(item=>!item))return null;const catalog=buildBankCatalog(selected);return catalog.catalogId===draft.catalogId?catalog:null;
}
export function buildMergedBankKey(catalog,keyPayloads=[]){
 if(!catalog?.catalogId||!Array.isArray(catalog.questions))throw new TypeError('Catálogo do banco inválido.');
 const answerMap=new Map();
 for(const payload of keyPayloads)for(const answer of payload?.answers||[])if(answer?.id)answerMap.set(String(answer.id),answer.gabarito);
 const answers=catalog.questions.map(question=>({id:String(question.id),gabarito:answerMap.get(String(question.id))}));
 const missing=answers.filter(answer=>!['A','B','C','D','E'].includes(answer.gabarito));if(missing.length)throw new Error(`Gabarito ausente para ${missing.length} questão(ões) selecionada(s).`);
 return{schemaVersion:'1.0.0',material_id:catalog.catalogId,answers};
}
export async function loadMergedBankKey(catalog,{fetchFn=fetch,base=BASE}={}){
 const paths=unique((catalog?.questions||[]).map(question=>question.sourceKeyPath));if(!paths.length||paths.some(path=>!safeKeyPath(path)))throw new Error('A bateria contém origem de gabarito inválida.');
 const payloads=await Promise.all(paths.map(async path=>{const response=await fetchFn(base+path,{cache:'no-store'});if(!response.ok)throw new Error(`Falha ao carregar gabarito (${response.status}).`);return response.json()}));
 return buildMergedBankKey(catalog,payloads);
}
export async function loadMasterQuestionBank({fetchFn=fetch,base=BASE}={}){
 try{const response=await fetchFn(base+MASTER_PATH,{cache:'no-store'});if(response.status===404)return{snapshot:null,questions:[]};if(!response.ok)throw new Error(`Falha ao carregar Banco Mestre (${response.status}).`);const snapshot=await response.json();const questions=flattenMasterSnapshot(snapshot);if(Number(snapshot.questionCount)!==questions.length)throw new Error('Snapshot do Banco Mestre está incompleto ou contém correção na superfície pública.');return{snapshot,questions};}catch(error){if(error instanceof TypeError)return{snapshot:null,questions:[]};throw error}
}
export async function loadQuestionBank({fetchFn=fetch,base=BASE}={}){
 const[catalogs,master]=await Promise.all([loadAllCatalogs(),loadMasterQuestionBank({fetchFn,base})]);const daily=flattenBankCatalogs(catalogs),seen=new Set(daily.map(item=>text(item.id))),masterRows=master.questions.filter(item=>!seen.has(text(item.id)));
 return{catalogs,master:master.snapshot,questions:[...masterRows,...daily]};
}
