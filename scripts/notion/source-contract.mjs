import fs from 'node:fs/promises';
import path from 'node:path';
import {ROOT,hash,localIso,readJson,writeJson} from './config.mjs';
import {fetchMarkdown,mapLimit,request} from './api.mjs';
import {TDAS_SOURCE_MANIFEST,microPageForPe} from './source-manifest.mjs';
import {buildContractAssessment,parseMicroMarkdown,peCode} from './source-contract-policy.mjs';

const CONTROL_FILES=Object.freeze([
 'data/export/actual-01.json','data/export/actual-02.json','data/export/actual-03.json','data/export/future-01.json','data/export/future-02.json'
]);
const compact=value=>String(value??'').replaceAll('-','').toLowerCase();
const required=(condition,message)=>{if(!condition)throw new Error(`Contrato multifornte TDAS: ${message}`)};
const sourceRecord=(key,page,metadata,markdown='')=>({key,name:page.name,id:page.id,url:metadata?.url||page.url,access:true,lastEditedTime:metadata?.last_edited_time||'',contentHash:markdown?hash(markdown):null});

async function loadControls(){
 const records=[];
 for(const file of CONTROL_FILES){
  const data=JSON.parse(await fs.readFile(path.join(ROOT,file),'utf8'));
  required(Array.isArray(data),`${file} não contém uma lista.`);
  records.push(...data);
 }
 const byPe=new Map();
 for(const record of records){
  const pe=peCode(record?.pe);if(!pe)continue;
  if(byPe.has(pe)){
   const previous=byPe.get(pe);
   required(previous.date===record.date&&String(previous.planned_questions??previous.meta)===String(record.planned_questions??record.meta),`${pe} diverge entre arquivos de controle.`);
   continue;
  }
  byPe.set(pe,record);
 }
 return[...byPe.values()].sort((a,b)=>Number(a.pe.slice(2))-Number(b.pe.slice(2)));
}

async function pageMetadata(page){
 const metadata=await request(`/pages/${compact(page.id)}`);
 required(metadata?.object==='page',`${page.name} não retornou uma página.`);
 const titleProperty=Object.values(metadata.properties||{}).find(item=>item?.type==='title');
 const title=(titleProperty?.title||[]).map(item=>item.plain_text||item.text?.content||'').join('').trim();
 required(!/EDAS|Cargo\s*400/i.test(`${title} ${page.name}`),`${page.name} aponta para conteúdo do Cargo 400.`);
 return metadata;
}

function validateParent(child,parent,label){
 const parentId=child?.parent?.page_id||child?.parent?.database_id||child?.parent?.data_source_id||'';
 required(!parentId||compact(parentId)===compact(parent.id),`${label} saiu da raiz autorizada ${parent.name}.`);
}

function validateRootContent(markdown){
 const text=String(markdown||'');
 required(/TDAS[\s\S]{0,80}Cargo\s*202/i.test(text),'Dashboard não declara TDAS Cargo 202.');
 required(/Não misturar[\s\S]{0,80}Cargo\s*400/i.test(text),'Dashboard perdeu a regra de isolamento Cargo 202 × Cargo 400.');
 required(/Edital oficial[\s\S]*Macro PE01[–-]PE112[\s\S]*Micro semanal[\s\S]*Banco de Controle/i.test(text),'hierarquia Edital → Macro → Micro → Controle não foi localizada no Dashboard.');
}

function validateMacroContent(markdown){
 const text=String(markdown||'');
 required(/PE01\s*(?:a|–|—|-)\s*PE112/i.test(text)||(/PE01/i.test(text)&&/PE112/i.test(text)),'Macro não cobre PE01–PE112.');
 required(/Microdose de Português/i.test(text)&&/Microdose de Específicos peso 2/i.test(text),'Macro perdeu as duas microdoses obrigatórias.');
 required(/Semana 16/i.test(text)&&/PE111/i.test(text)&&/0 questões/i.test(text)&&/PE112/i.test(text),'exceção da Semana 16 não foi localizada no Macro.');
}

function decorateDays(days,page){return days.map(day=>({...day,source:{id:page.id,name:page.name,url:page.url}}))}

export async function buildSourceContract({enforce=true}={}){
 const generatedAt=localIso();
 const [controls,today,catalog]=await Promise.all([loadControls(),readJson('data/today.json',{}),readJson('data/integration/question-catalog.json',null)]);
 const currentPe=peCode(today?.current?.pe)||peCode(catalog?.peId)||'';
 required(currentPe,'PE atual não pôde ser determinado.');

 const primaryPages=[TDAS_SOURCE_MANIFEST.root,TDAS_SOURCE_MANIFEST.editalCheck,TDAS_SOURCE_MANIFEST.planningRoot,TDAS_SOURCE_MANIFEST.macro];
 const metadata=await mapLimit([...primaryPages,...TDAS_SOURCE_MANIFEST.micros],4,page=>pageMetadata(page));
 const metaById=new Map(metadata.map(item=>[compact(item.id),item]));
 validateParent(metaById.get(compact(TDAS_SOURCE_MANIFEST.macro.id)),TDAS_SOURCE_MANIFEST.planningRoot,'Macro');
 for(const page of TDAS_SOURCE_MANIFEST.micros)validateParent(metaById.get(compact(page.id)),TDAS_SOURCE_MANIFEST.planningRoot,page.name);

 const [rootMarkdown,macroMarkdown,microMarkdown]=await Promise.all([
  fetchMarkdown(TDAS_SOURCE_MANIFEST.root.id),fetchMarkdown(TDAS_SOURCE_MANIFEST.macro.id),mapLimit(TDAS_SOURCE_MANIFEST.micros,3,page=>fetchMarkdown(page.id))
 ]);
 required(rootMarkdown.trim().length>300,'Dashboard retornou conteúdo insuficiente.');
 required(macroMarkdown.trim().length>500,'Macro retornou conteúdo insuficiente.');
 validateRootContent(rootMarkdown);validateMacroContent(macroMarkdown);

 const microDays=[];
 for(let index=0;index<TDAS_SOURCE_MANIFEST.micros.length;index++){
  const page=TDAS_SOURCE_MANIFEST.micros[index],markdown=microMarkdown[index];
  required(markdown.trim().length>150,`${page.name} retornou conteúdo insuficiente.`);
  const days=parseMicroMarkdown(markdown,index+1);
  required(days.length===7,`${page.name} contém ${days.length} PE; esperado 7.`);
  microDays.push(...decorateDays(days,page));
 }
 const uniquePe=new Set(microDays.map(item=>item.pe));
 required(microDays.length===112&&uniquePe.size===112,`Micros cobrem ${uniquePe.size}/112 PE.`);
 for(let number=1;number<=112;number++)required(uniquePe.has(`PE${String(number).padStart(2,'0')}`),`PE${String(number).padStart(2,'0')} ausente nos Micros.`);

 const assessment=buildContractAssessment({controls,microDays,catalog,currentPe,snapshotDate:today?.meta?.snapshotDate||generatedAt.slice(0,10)});
 if(assessment.current?.micro){const page=microPageForPe(currentPe);assessment.current.micro={...assessment.current.micro,source:{id:page?.id||'',name:page?.name||'',url:page?.url||''}}}
 const sources=[
  sourceRecord('dashboard',TDAS_SOURCE_MANIFEST.root,metaById.get(compact(TDAS_SOURCE_MANIFEST.root.id)),rootMarkdown),
  sourceRecord('edital-check',TDAS_SOURCE_MANIFEST.editalCheck,metaById.get(compact(TDAS_SOURCE_MANIFEST.editalCheck.id))),
  sourceRecord('planning-root',TDAS_SOURCE_MANIFEST.planningRoot,metaById.get(compact(TDAS_SOURCE_MANIFEST.planningRoot.id))),
  sourceRecord('macro',TDAS_SOURCE_MANIFEST.macro,metaById.get(compact(TDAS_SOURCE_MANIFEST.macro.id)),macroMarkdown),
  ...TDAS_SOURCE_MANIFEST.micros.map((page,index)=>sourceRecord(`micro-${String(index+1).padStart(2,'0')}`,page,metaById.get(compact(page.id)),microMarkdown[index])),
  {key:'materials',...TDAS_SOURCE_MANIFEST.execution.materials,access:true},{key:'questions',...TDAS_SOURCE_MANIFEST.execution.questions,access:true}
 ];
 const contract={
  schemaVersion:'1.0.0',generatedAt,project:TDAS_SOURCE_MANIFEST.project,cargo:TDAS_SOURCE_MANIFEST.cargo,status:assessment.status,
  policy:{priority:TDAS_SOURCE_MANIFEST.priority,enforcement:'PE atual',week16:'Micro soberano e adaptativo',archiveAllowed:false,cargo400Allowed:false},
  current:assessment.current,
  summary:{sources:sources.length,microDays:microDays.length,conflicts:assessment.conflicts.length,critical:assessment.conflicts.filter(item=>item.severity==='critical').length,warnings:assessment.conflicts.filter(item=>item.severity==='warning').length},
  conflicts:assessment.conflicts,sources
 };
 await writeJson('data/source-contract.json',contract);
 console.log(`${currentPe}: contrato multifornte ${contract.status}; ${contract.summary.conflicts} divergência(s), ${contract.summary.critical} crítica(s).`);
 if(enforce&&contract.status==='blocked'){
  const detail=contract.current.conflicts.filter(item=>item.severity==='critical').map(item=>item.message).join(' | ');
  throw new Error(`Contrato multifornte bloqueou ${currentPe}: ${detail}`);
 }
 return contract;
}
