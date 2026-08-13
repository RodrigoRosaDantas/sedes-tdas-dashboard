import fs from 'node:fs/promises';
import path from 'node:path';
import {request} from './api.mjs';
import {ROOT,SOURCES} from './config.mjs';

const read=async file=>JSON.parse(await fs.readFile(path.join(ROOT,file),'utf8'));
const write=async(file,value)=>fs.writeFile(path.join(ROOT,file),`${JSON.stringify(value)}\n`,'utf8');

function formulaValue(property){
 const value=property?.formula;
 if(!value)return'';
 if(value.type==='string')return String(value.string??'').trim();
 if(value.type==='boolean')return value.boolean===true?'Sim':value.boolean===false?'Não':'';
 if(value.type==='number')return value.number==null?'':String(value.number);
 return'';
}
function selectValue(property){return String(property?.select?.name??'').trim()}
function relationIds(property){
 if(!property)return[];
 if(property.has_more)throw new Error('Tópico do edital possui relação paginada; enriquecimento recusado para evitar vínculo incompleto.');
 return [...new Set((property.relation||[]).map(item=>String(item.id||'').trim()).filter(Boolean))];
}
async function queryRawErrors(){
 const endpoint=`/data_sources/${SOURCES.errors.dataSourceId}/query`;
 const pages=[];let cursor=null,rounds=0;
 do{
  if(++rounds>100)throw new Error('Caderno de Erros excedeu o limite de paginação do enriquecimento do Mentor.');
  const body={page_size:25,...(cursor?{start_cursor:cursor}:{})};
  const data=await request(endpoint,{method:'POST',body:JSON.stringify(body)});
  if(!Array.isArray(data?.results))throw new Error('Caderno de Erros retornou resposta sem results no enriquecimento do Mentor.');
  pages.push(...data.results.filter(item=>item.object==='page'));
  cursor=data.has_more?data.next_cursor:null;
  if(data.has_more&&!cursor)throw new Error('Paginação inconsistente no enriquecimento do Mentor.');
 }while(cursor);
 const unique=new Map(pages.map(page=>[page.url,page]));
 if(unique.size!==pages.length)throw new Error('Caderno de Erros retornou URLs duplicadas no enriquecimento do Mentor.');
 return unique;
}

export async function enrichMentorErrors(){
 const index=await read('data/error-questions/index.json');
 const rawByUrl=await queryRawErrors();
 const parts=[];let matched=0,needsReview=0,linkedTopics=0,withWindow=0;
 for(const part of index.parts||[]){
  const file=`data/error-questions/${part.file}`;
  const rows=await read(file);
  const enriched=rows.map(record=>{
   const page=rawByUrl.get(record.url);
   if(!page)throw new Error(`Mentor: registro publicado sem página correspondente no Notion: ${record.url}`);
   matched++;
   const properties=page.properties||{};
   const precisaRevisar=formulaValue(properties['Precisa revisar?']);
   const janelaReaparecimento=selectValue(properties['Janela de reaparecimento']);
   const topicoEditalIds=relationIds(properties['Tópico do edital']);
   if(/revisar/i.test(precisaRevisar))needsReview++;
   if(janelaReaparecimento)withWindow++;
   if(topicoEditalIds.length)linkedTopics++;
   return{...record,precisaRevisar,janelaReaparecimento,topicoEditalIds};
  });
  parts.push({file,rows:enriched});
 }
 if(matched!==Number(index.total||0))throw new Error(`Mentor: enriquecimento cobriu ${matched}/${index.total} erros; publicação bloqueada.`);
 for(const part of parts)await write(part.file,part.rows);
 index.mentorEnrichment={schemaVersion:'1.0.0',records:matched,needsReview,withReappearanceWindow:withWindow,linkedEditalTopics:linkedTopics};
 await write('data/error-questions/index.json',index);
 console.log(JSON.stringify({mentorEnrichment:'ok',records:matched,needsReview,withWindow,linkedTopics}));
 return index.mentorEnrichment;
}

if(import.meta.url===`file://${process.argv[1]}`)await enrichMentorErrors();
