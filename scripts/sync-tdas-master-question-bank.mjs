import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const ROOT=process.cwd();
const SOURCE_REPO='RodrigoRosaDantas/sedes-df-questoes';
const SOURCE_API=`https://api.github.com/repos/${SOURCE_REPO}`;
const CARGO_CODE='202';
const CARGO_NAME='TDAS — Técnico Administrativo';
const PUBLIC_PATH=path.join(ROOT,'data/integration/master-question-bank.json');
const KEY_PATH=path.join(ROOT,'data/integration/question-keys/master-tdas-202.json');
const PUBLIC_WEB_PATH='data/integration/master-question-bank.json';
const KEY_WEB_PATH='data/integration/question-keys/master-tdas-202.json';
const FETCH_TIMEOUT_MS=20000;

const clean=value=>String(value??'').trim();
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const letter=value=>clean(value).toUpperCase();

async function fetchJson(url,{retries=2}={}){
 let lastError;
 for(let attempt=0;attempt<=retries;attempt++){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),FETCH_TIMEOUT_MS);
  try{
   const response=await fetch(url,{headers:{accept:'application/vnd.github+json','user-agent':'tdas-dashboard-master-bank-sync'},signal:controller.signal,cache:'no-store'});
   if(!response.ok)throw new Error(`HTTP ${response.status} em ${url}`);
   return await response.json();
  }catch(error){lastError=error;if(attempt<retries)await new Promise(resolve=>setTimeout(resolve,400*(attempt+1)))}finally{clearTimeout(timer)}
 }
 throw lastError;
}

export function selectTdasMaterials(catalog){
 const materials=Array.isArray(catalog?.materials)?catalog.materials:[];
 return materials.filter(item=>clean(item?.codigo_cargo)===CARGO_CODE&&clean(item?.cargo)===CARGO_NAME&&/^publicad/i.test(clean(item?.status)));
}

export function buildTdasSnapshot(catalog,materialPayloads,{sourceSha='fixture'}={}){
 const selected=selectTdasMaterials(catalog);
 const payloadById=new Map(materialPayloads.map(item=>[clean(item?.id),item]));
 const questions=[],answers=[],seen=new Set(),materials=[];
 for(const descriptor of selected){
  const payload=payloadById.get(clean(descriptor.id));if(!payload)throw new Error(`Material TDAS ausente: ${descriptor.id}`);
  if(clean(payload.codigo_cargo)!==CARGO_CODE||clean(payload.cargo)!==CARGO_NAME)throw new Error(`Identidade de cargo divergente em ${descriptor.id}.`);
  const rows=Array.isArray(payload.questoes)?payload.questoes:[];
  if(Number(descriptor.quantidade_questoes)!==rows.length)throw new Error(`Quantidade divergente em ${descriptor.id}: catálogo=${descriptor.quantidade_questoes}, arquivo=${rows.length}.`);
  materials.push({id:clean(payload.id),nome:clean(payload.nome),tipoMaterial:clean(payload.tipo_material),materia:clean(payload.disciplina),banca:clean(payload.fonte),ano:Number(payload.ano)||null,orgao:clean(payload.orgao),questionCount:rows.length});
  for(const item of rows){
   const id=clean(item.codigo||item.id);if(!id||seen.has(id))throw new Error(`Código de questão vazio ou duplicado em ${descriptor.id}.`);seen.add(id);
   const alternativas={};for(const option of ['A','B','C','D','E']){const value=clean(item?.alternativas?.[option]);if(!value)throw new Error(`Alternativa ${option} ausente em ${id}.`);alternativas[option]=value}
   const gabarito=letter(item.gabarito);if(!['A','B','C','D','E'].includes(gabarito))throw new Error(`Gabarito inválido em ${id}: ${item.gabarito}`);
   questions.push({
    id,codigo:id,numeroOriginal:Number(item.numero_original)||null,materia:clean(item.disciplina||payload.disciplina),assunto:clean(item.assunto),subassunto:clean(item.subassunto),texto_base:clean(item.texto_base)||null,enunciado:clean(item.enunciado),alternativas,
    sourceCatalogId:`master:${clean(payload.id)}`,sourcePe:'Banco Mestre',sourceTitle:clean(payload.nome),sourceKeyPath:KEY_WEB_PATH,sourceKind:'master-bank',materialId:clean(payload.id),materialName:clean(payload.nome),tipoMaterial:clean(payload.tipo_material),banca:clean(payload.fonte),ano:Number(payload.ano)||null,orgao:clean(payload.orgao),cargo:CARGO_NAME,codigoCargo:CARGO_CODE,dificuldade:clean(item.dificuldade)
   });
   answers.push({id,gabarito});
  }
 }
 if(!questions.length)throw new Error('Nenhuma questão TDAS publicada foi encontrada na release técnica.');
 questions.sort((a,b)=>a.materialName.localeCompare(b.materialName,'pt-BR',{numeric:true,sensitivity:'base'})||(a.numeroOriginal??0)-(b.numeroOriginal??0)||a.id.localeCompare(b.id));
 answers.sort((a,b)=>a.id.localeCompare(b.id));
 materials.sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR',{numeric:true,sensitivity:'base'}));
 const generatedAt=new Date().toISOString();
 const fingerprint=hash(JSON.stringify(questions.map(item=>[item.id,item.enunciado,item.alternativas]))).slice(0,16);
 const publicSnapshot={schemaVersion:'1.0.0',mode:'tdas-master-question-bank',generatedAt,source:{repository:SOURCE_REPO,commit:sourceSha,releaseVersion:clean(catalog.release_version),exportedAt:clean(catalog.exported_at),notion:catalog?.source?.notion_url||null},cargo:{code:CARGO_CODE,name:CARGO_NAME},materialCount:materials.length,questionCount:questions.length,keyPath:KEY_WEB_PATH,fingerprint,materials,questions};
 const keySnapshot={schemaVersion:'1.0.0',material_id:`tdas-master-202-${fingerprint}`,sourceCommit:sourceSha,questionCount:answers.length,answers};
 return{publicSnapshot,keySnapshot};
}

export async function syncTdasMasterQuestionBank(){
 const commit=await fetchJson(`${SOURCE_API}/commits/main`);const sourceSha=clean(commit?.sha);if(!/^[0-9a-f]{40}$/i.test(sourceSha))throw new Error('SHA da release de questões não pôde ser resolvido.');
 const rawBase=`https://raw.githubusercontent.com/${SOURCE_REPO}/${sourceSha}/`;
 const catalog=await fetchJson(rawBase+'data/release/catalogo.json');const selected=selectTdasMaterials(catalog);
 if(!selected.length)throw new Error('A release técnica não contém materiais publicados do TDAS cargo 202.');
 const payloads=[];
 for(const descriptor of selected){const relative=clean(descriptor.file).replace(/^\.\//,'');if(!/^data\/release\/materials\/[a-z0-9._-]+\.json$/i.test(relative))throw new Error(`Caminho de material inválido: ${descriptor.file}`);payloads.push(await fetchJson(rawBase+relative));}
 const{publicSnapshot,keySnapshot}=buildTdasSnapshot(catalog,payloads,{sourceSha});
 if(publicSnapshot.questionCount<570)throw new Error(`Release TDAS regressiva: ${publicSnapshot.questionCount} questões; mínimo histórico esperado 570.`);
 await fs.mkdir(path.dirname(PUBLIC_PATH),{recursive:true});await fs.mkdir(path.dirname(KEY_PATH),{recursive:true});
 await fs.writeFile(PUBLIC_PATH,JSON.stringify(publicSnapshot)+'\n','utf8');await fs.writeFile(KEY_PATH,JSON.stringify(keySnapshot)+'\n','utf8');
 console.log(`Banco Mestre TDAS sincronizado: ${publicSnapshot.questionCount} questões em ${publicSnapshot.materialCount} materiais · fonte ${sourceSha.slice(0,12)}.`);
 return publicSnapshot;
}

async function main(){
 try{await syncTdasMasterQuestionBank()}
 catch(error){
  const strict=process.env.MASTER_BANK_STRICT==='1';
  const existing=await fs.access(PUBLIC_PATH).then(()=>true).catch(()=>false);
  if(existing&&!strict){console.warn(`Banco Mestre TDAS: fonte temporariamente indisponível; snapshot anterior preservado. ${error.message}`);return}
  throw error;
 }
}

if(import.meta.url===pathToFileURL(process.argv[1]||'').href)main().catch(error=>{console.error(error);process.exit(1)});

export const MASTER_BANK_PUBLIC_PATH=PUBLIC_WEB_PATH;
export const MASTER_BANK_KEY_PATH=KEY_WEB_PATH;
